import type { DateiEintrag, Zeitpunkt } from '../domain/modell';
import { neueUnterlagen } from '../domain/zeit';
import {
  BackupFehler,
  backupErstellen,
  backupOeffnen,
  type BackupEintrag,
  type BackupLeser,
} from './backup';
import { DATENORTE, SCHEMA_VERSION, datenMigrieren, type HeftaDb } from './db';
import { teilbestand, zusammenfuehren } from './haushalte';
import { dateiSpeichern } from './speicher';

// Backup aller Angaben und Dateien (docs/07-speicher-backup-sicherheit.md).
// Inhalt der Datei: manifest.json mit allen Angaben, danach jede Datei unter dateien/<id>.
// Einspielen ersetzt den ganzen Bestand, aber erst, wenn das Backup vollständig gelesen ist.
//
// Zwei Versionen, beide mit Absicht getrennt:
// - formatVersion: Wie die Datei aufgebaut ist. Ändert sich so gut wie nie.
// - schemaVersion: Wie die Angaben aussehen. Ältere werden beim Einspielen umgerechnet (datenMigrieren).
// Backups aus jeder bisherigen Version müssen sich einspielen lassen; das prüfen die Dateien in
// tests/fixtures/backup, die nie gelöscht werden.

const FORMAT = 'hefta-backup';
const FORMAT_VERSION = 1;
const MANIFEST = 'manifest.json';

interface Manifest {
  format: typeof FORMAT;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  erstellt: Zeitpunkt;
  daten: Record<string, unknown[]>;
  dateien: Omit<DateiEintrag, 'daten'>[];
  /** Nur ein Haushalt (Backup je Haushalt); Einspielen fügt ihn dann eher hinzu. */
  haushalt?: string;
}

export interface SicherungsInhalt {
  personen: number;
  /** Unterlagen mit mindestens einer Version, wie in `Bestand`. */
  unterlagen: number;
  dateien: number;
  erstellt: Zeitpunkt;
}

export async function sicherungErstellen(
  db: HeftaDb,
  passwort?: string,
  appVersion = '',
  runden?: number,
  /** Version 2: nur diesen Haushalt mit allem, was dazugehört. */
  { haushaltId }: { haushaltId?: string } = {},
): Promise<Blob> {
  let daten: Record<string, unknown[]> = {};
  for (const ort of DATENORTE) daten[ort] = await db.getAll(ort);
  let dateien = await db.getAll('dateien');
  if (haushaltId) {
    const teil = teilbestand(daten, haushaltId);
    const noetig = new Set(teil.dateien);
    daten = teil.daten;
    dateien = dateien.filter((d) => noetig.has(d.id));
  }
  const manifest: Manifest = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    erstellt: new Date().toISOString(),
    daten,
    dateien: dateien.map(({ id, createdAt, typ, groesse }) => ({ id, createdAt, typ, groesse })),
    ...(haushaltId ? { haushalt: haushaltId } : {}),
  };
  async function* eintraege(): AsyncGenerator<BackupEintrag> {
    yield {
      pfad: MANIFEST,
      daten: new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
    };
    for (const d of dateien) {
      yield {
        pfad: `dateien/${d.id}`,
        daten: d.daten instanceof Blob ? d.daten : new Blob([d.daten]),
      };
    }
  }
  return backupErstellen(eintraege(), passwort, runden);
}

function manifestPruefen(wert: unknown): Manifest {
  const m = wert as Partial<Manifest> | null;
  if (
    !m ||
    m.format !== FORMAT ||
    typeof m.schemaVersion !== 'number' ||
    typeof m.formatVersion !== 'number' ||
    !m.daten ||
    !Array.isArray(m.dateien)
  ) {
    throw new BackupFehler('kein_backup');
  }
  if (m.schemaVersion > SCHEMA_VERSION || m.formatVersion > FORMAT_VERSION) {
    throw new BackupFehler('version_neu');
  }
  return m as Manifest;
}

async function manifestLesen(leser: BackupLeser): Promise<Manifest> {
  if (!leser.pfade.includes(MANIFEST)) throw new BackupFehler('kein_backup');
  const daten = await leser.lesen(MANIFEST);
  try {
    return manifestPruefen(JSON.parse(await daten.text()));
  } catch (e) {
    throw e instanceof BackupFehler ? e : new BackupFehler('beschaedigt');
  }
}

/** Liest ein frisch erstelltes Backup einmal ganz: Ein defektes soll niemand für sicher halten. */
export async function sicherungPruefen(datei: Blob, passwort?: string): Promise<void> {
  const leser = await backupOeffnen(datei, passwort);
  const m = await manifestLesen(leser);
  for (const d of m.dateien) {
    if ((await leser.lesen(`dateien/${d.id}`)).size !== d.groesse) {
      throw new BackupFehler('beschaedigt');
    }
  }
}

/**
 * Spielt ein Backup ein und ersetzt alle bisherigen Angaben und Dateien.
 * Scheitert das Lesen, bleibt der bisherige Bestand unverändert.
 */
export async function sicherungEinspielen(
  db: HeftaDb,
  datei: Blob,
  passwort?: string,
  /**
   * Version 2: „hinzufuegen“ führt das Backup mit dem Bestand zusammen (nichts geht verloren,
   * bei gleicher ID gewinnt der neuere Stand); Standard bleibt „ersetzen“.
   */
  { art = 'ersetzen' }: { art?: 'ersetzen' | 'hinzufuegen' } = {},
): Promise<SicherungsInhalt> {
  const leser = await backupOeffnen(datei, passwort);
  const m = await manifestLesen(leser);
  // Vor dem ersten Schreiben: Lassen sich die Angaben umrechnen, und ist jede Datei da?
  let daten = datenMigrieren(m.daten, m.schemaVersion);
  if (m.dateien.some((d) => !leser.pfade.includes(`dateien/${d.id}`))) {
    throw new BackupFehler('beschaedigt');
  }

  const vorher = new Set(await db.getAllKeys('dateien'));
  const neuGeschrieben: string[] = [];
  const behalten = new Set(m.dateien.map((d) => d.id));
  try {
    // Datei für Datei, mit geprüfter Prüfsumme. Eine gleiche ID heißt gleicher Inhalt: Das Überschreiben
    // ändert nichts, selbst wenn das Einspielen danach scheitert. Beim Hinzufügen bleibt sie, wie sie ist.
    for (const pfad of leser.pfade) {
      if (!pfad.startsWith('dateien/')) continue;
      const id = pfad.slice('dateien/'.length);
      if (!behalten.has(id) || (art === 'hinzufuegen' && vorher.has(id))) continue;
      const inhalt = await leser.lesen(pfad);
      await dateiSpeichern(db, inhalt, id);
      if (!vorher.has(id)) neuGeschrieben.push(id);
    }
    if (art === 'hinzufuegen') {
      const jetzt: Record<string, unknown[]> = {};
      for (const ort of DATENORTE) jetzt[ort] = await db.getAll(ort);
      daten = zusammenfuehren(jetzt, daten).daten;
      for (const id of vorher) behalten.add(id);
    }

    const tx = db.transaction([...DATENORTE, 'dateien'], 'readwrite');
    for (const ort of DATENORTE) {
      const store = tx.objectStore(ort);
      await store.clear();
      for (const datensatz of daten[ort] ?? []) await store.put(datensatz as never);
    }
    const dateiStore = tx.objectStore('dateien');
    for (const id of await dateiStore.getAllKeys()) {
      if (!behalten.has(id)) await dateiStore.delete(id);
    }
    for (const meta of m.dateien) {
      const eintrag = await dateiStore.get(meta.id);
      if (eintrag) await dateiStore.put({ ...eintrag, createdAt: meta.createdAt, typ: meta.typ });
    }
    await tx.done;
  } catch (e) {
    for (const id of neuGeschrieben) await db.delete('dateien', id).catch(() => {});
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new BackupFehler('kein_platz');
    }
    throw e;
  }

  const bestand = bestandZaehlen(daten);
  return {
    personen: bestand.personen,
    unterlagen: bestand.unterlagen,
    dateien: m.dateien.length,
    erstellt: m.erstellt,
  };
}

/** Was ein Bestand enthält, in Zahlen (für „Jetzt in der App“, „Im Backup“, „Alles löschen“). */
export interface Bestand {
  personen: number;
  kinder: number;
  /** Ziehen mit ein, stehen aber nicht im Vertrag. */
  weitere: number;
  unterlagen: number;
  bewerbungen: number;
}

/** Zählt aus den Datensätzen: Personen in Haushalten, Kinder, Unterlagen mit mindestens einer Version. */
export function bestandZaehlen(daten: Record<string, unknown[]>): Bestand {
  const zug = (daten.zugehoerigkeiten ?? []) as {
    personId: string;
    herausgenommenAm?: string | null;
  }[];
  const versionen = (daten.versionen ?? []) as { dokumentId: string }[];
  const mitVersion = new Set(versionen.map((v) => v.dokumentId));
  const haushalte = (daten.haushalte ?? []) as { kinder?: number; weitereErwachsene?: number }[];
  return {
    personen: new Set(zug.filter((z) => !z.herausgenommenAm).map((z) => z.personId)).size,
    kinder: haushalte.reduce((s, h) => s + (h.kinder ?? 0), 0),
    weitere: haushalte.reduce((s, h) => s + (h.weitereErwachsene ?? 0), 0),
    unterlagen: ((daten.dokumente ?? []) as { id: string }[]).filter((d) => mitVersion.has(d.id))
      .length,
    bewerbungen: (daten.bewerbungen ?? []).length,
  };
}

export async function bestandAusDb(db: HeftaDb): Promise<Bestand> {
  const daten: Record<string, unknown[]> = {};
  for (const ort of DATENORTE) daten[ort] = await db.getAll(ort);
  return bestandZaehlen(daten);
}

/** Unterlagen, die seit dem letzten Backup dazugekommen sind. */
export async function neuSeitBackup(db: HeftaDb, letztesBackup: string | null): Promise<number> {
  return neueUnterlagen(await db.getAll('versionen'), letztesBackup);
}

export interface SicherungsVorschau {
  bestand: Bestand;
  erstellt: Zeitpunkt;
  appVersion: string;
  /** Version 2: Backup eines einzelnen Haushalts (dann eher hinzufügen als ersetzen). */
  nurHaushalt: boolean;
}

/**
 * Liest nur das Manifest eines Backups (prüft dabei das Passwort) und zeigt, was drin ist.
 * Wirft `BackupFehler` wie beim Einspielen.
 */
export async function sicherungVorschau(
  datei: Blob,
  passwort?: string,
): Promise<SicherungsVorschau> {
  const m = await manifestLesen(await backupOeffnen(datei, passwort));
  return {
    bestand: bestandZaehlen(datenMigrieren(m.daten, m.schemaVersion)),
    erstellt: m.erstellt,
    appVersion: m.appVersion,
    nurHaushalt: !!m.haushalt,
  };
}

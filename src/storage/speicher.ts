import { VERGABE } from '../domain/personenfarben';
import { wohnungsSchluessel } from '../domain/adresse';
import { sortieren } from '../domain/bewerbungen';
import { hefteAusVersion1Einordnen } from '../domain/hefte';
import {
  type Bewerbung,
  jetzt,
  KEINE_EREIGNISSE,
  neueId,
  rufnameAus,
  type Bezeichnung,
  type DateiEintrag,
  type DateiVersion,
  type Dokument,
  type Einstellungen,
  type Haushalt,
  type Heft,
  type Id,
  type AusbildungArt,
  type Lebenssituation,
  type Person,
  type Rolle,
  type Zugehoerigkeit,
  type VersionFakten,
} from '../domain/modell';
import { dokumenttyp } from '../domain/regelkatalog';
import { erklaerungenFestlegen, farbeImHaushalt, giltImHaushalt } from '../domain/zugehoerigkeiten';
import { ALLE_ORTE, type HeftaDb } from './db';
import type { HeftaSchema } from './db';

// Lesen und Schreiben der Angaben. Alles, was zusammengehört, läuft in einer Transaktion,
// damit nie ein halber Haushalt gespeichert ist.

export function standardEinstellungen(): Einstellungen {
  return {
    id: 'app',
    updatedAt: jetzt(),
    letztesBackup: null,
    speicherAngefragt: false,
    homescreenHinweisGezeigt: false,
    ohnePasswortHinweisGezeigt: false,
    sprache: 'de',
    fristen: {},
    rutsch: null,
  };
}

export async function einstellungenLaden(db: HeftaDb): Promise<Einstellungen> {
  return (await db.get('einstellungen', 'app')) ?? standardEinstellungen();
}

/**
 * Hefta 2, einmal beim ersten Start (Nachricht 10.11. l): Hefte aus Version 1 ohne eigene Ereignisse
 * bekommen ihren Stand. Danach nie wieder, auch wenn später noch eine Kennung entsteht.
 */
export async function hefteAusVersion1EinordnenEinmal(db: HeftaDb): Promise<void> {
  const tx = db.transaction(['hefte', 'bewerbungen', 'einstellungen'], 'readwrite');
  const einstellungen =
    (await tx.objectStore('einstellungen').get('app')) ?? standardEinstellungen();
  if (einstellungen.version1Eingeordnet) {
    await tx.done;
    return;
  }
  const geaendert = hefteAusVersion1Einordnen(
    await tx.objectStore('hefte').getAll(),
    await tx.objectStore('bewerbungen').getAll(),
  );
  for (const h of geaendert) await tx.objectStore('hefte').put(h);
  const zeit = jetzt();
  await tx
    .objectStore('einstellungen')
    .put({ ...einstellungen, version1Eingeordnet: zeit, updatedAt: zeit });
  await tx.done;
}

export async function einstellungenAendern(
  db: HeftaDb,
  teil: Partial<Omit<Einstellungen, 'id'>>,
): Promise<Einstellungen> {
  const neu = { ...(await einstellungenLaden(db)), ...teil, updatedAt: jetzt() };
  await db.put('einstellungen', neu);
  return neu;
}

export interface PersonEntwurf {
  vorname: string;
  nachname: string;
  /** Leer: aus dem Vornamen vorbelegt. */
  rufname?: string;
  nameMappe?: { vorname: string; nachname: string } | null;
  bezeichnung: Bezeichnung;
  rolle: Rolle;
  lebenssituation: Lebenssituation | null;
  ausbildungArt?: AusbildungArt | null;
}

export interface HaushaltEntwurf {
  kinder: number;
  weitereErwachsene: number;
  personen: PersonEntwurf[];
}

function personAus(entwurf: PersonEntwurf, zeit: string): Person {
  return {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    vorname: entwurf.vorname.trim(),
    nachname: entwurf.nachname.trim(),
    rufname: entwurf.rufname?.trim() || rufnameAus(entwurf.vorname),
    nameMappe: entwurf.nameMappe ?? null,
    kontakt: { telefon: '', email: '' },
    lebenssituation: entwurf.lebenssituation,
    ausbildungArt: entwurf.ausbildungArt ?? null,
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: null,
    abrechnungMeist: null,
  };
}

/** Personenfarben in der Reihenfolge aus B14 (Fassung 3), danach wieder von vorn. */
export function farbeFuer(index: number): number {
  return VERGABE[index % VERGABE.length]!;
}

/** Erste Farbe, die im Haushalt noch frei ist (sonst reihum nach Anzahl). */
export function freieFarbe(belegt: number[]): number {
  for (const f of VERGABE) if (!belegt.includes(f)) return f;
  return farbeFuer(belegt.length);
}

/** Typen, die zur Zugehörigkeit gehören, nicht zur Person (E53). */
const jeHaushalt = (typ: string) => dokumenttyp(typ)?.jeHaushalt === true;

/** Legt Haushalt, Personen und Rollen in einer Transaktion an. */
export async function haushaltAnlegen(db: HeftaDb, entwurf: HaushaltEntwurf): Promise<Haushalt> {
  const zeit = jetzt();
  const haushalt: Haushalt = {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    name: '',
    notiz: '',
    kinder: Math.max(0, entwurf.kinder),
    weitereErwachsene: Math.max(0, entwurf.weitereErwachsene),
  };
  const tx = db.transaction(['haushalte', 'personen', 'zugehoerigkeiten'], 'readwrite');
  await tx.objectStore('haushalte').put(haushalt);
  const alle = await tx.objectStore('zugehoerigkeiten').getAll();
  for (const [i, p] of entwurf.personen.entries()) {
    const person = personAus(p, zeit);
    await tx.objectStore('personen').put(person);
    const zug: Zugehoerigkeit = {
      id: neueId(),
      createdAt: zeit,
      updatedAt: zeit,
      haushaltId: haushalt.id,
      personId: person.id,
      rolle: p.rolle,
      bezeichnung: p.bezeichnung,
      farbe: farbeImHaushalt(person.id, haushalt.id, alle),
      reihenfolge: i,
      herausgenommenAm: null,
    };
    alle.push(zug);
    await tx.objectStore('zugehoerigkeiten').put(zug);
  }
  await tx.done;
  return haushalt;
}

export interface Mitglied {
  zugehoerigkeit: Zugehoerigkeit;
  person: Person;
}

export interface HaushaltAnsicht {
  haushalt: Haushalt;
  mitglieder: Mitglied[];
  /** Herausgenommene, neueste zuerst; Unterlagen bleiben gespeichert. */
  herausgenommen: Mitglied[];
  dokumente: Dokument[];
  versionen: DateiVersion[];
}

/** Lädt den (ersten) Haushalt mit allem, was die Übersicht braucht. Null, wenn es keinen gibt. */
/**
 * Lädt einen Haushalt mit Mitgliedern und Unterlagen. Ohne `haushaltId` (oder wenn es ihn nicht
 * mehr gibt) den ältesten; Version 1 kennt nur einen, Version 2 merkt sich den gewählten.
 */
export async function haushaltLaden(
  db: HeftaDb,
  haushaltId?: Id | null,
): Promise<HaushaltAnsicht | null> {
  const haushalte = (await db.getAll('haushalte')).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const haushalt = haushalte.find((h) => h.id === haushaltId) ?? haushalte[0];
  if (!haushalt) return null;
  // Ein Lesevorgang über alle Orte, Abfragen parallel: wird nach jeder Änderung aufgerufen.
  const tx = db.transaction(['zugehoerigkeiten', 'personen', 'dokumente', 'versionen'], 'readonly');
  const zugehoerigkeiten = (
    await tx.objectStore('zugehoerigkeiten').index('haushaltId').getAll(haushalt.id)
  ).sort((a, b) => a.reihenfolge - b.reihenfolge);
  const personen = await Promise.all(
    zugehoerigkeiten.map((z) => tx.objectStore('personen').get(z.personId)),
  );
  const dokumenteJe = await Promise.all(
    personen.map((p) =>
      p ? tx.objectStore('dokumente').index('personId').getAll(p.id) : Promise.resolve([]),
    ),
  );
  const hier = new Set(zugehoerigkeiten.map((z) => z.id));
  const dokumente = dokumenteJe.flat().filter((d) => giltImHaushalt(d, hier, jeHaushalt));
  const versionen = (
    await Promise.all(
      dokumente.map((d) => tx.objectStore('versionen').index('dokumentId').getAll(d.id)),
    )
  ).flat();
  await tx.done;
  const mitglieder: Mitglied[] = [];
  const herausgenommen: Mitglied[] = [];
  zugehoerigkeiten.forEach((zugehoerigkeit, i) => {
    const person = personen[i];
    if (!person) return;
    (zugehoerigkeit.herausgenommenAm ? herausgenommen : mitglieder).push({
      zugehoerigkeit,
      person,
    });
  });
  herausgenommen.sort((a, b) =>
    (b.zugehoerigkeit.herausgenommenAm ?? '').localeCompare(
      a.zugehoerigkeit.herausgenommenAm ?? '',
    ),
  );
  return { haushalt, mitglieder, herausgenommen, dokumente, versionen };
}

export async function personAendern(
  db: HeftaDb,
  id: Id,
  teil: Partial<Omit<Person, 'id' | 'createdAt'>>,
): Promise<void> {
  const person = await db.get('personen', id);
  if (!person) throw new Error('Person nicht gefunden');
  await db.put('personen', { ...person, ...teil, updatedAt: jetzt() });
}

/** Kinder oder weitere Erwachsene zählen: Lesen und Schreiben in einer Transaktion, damit zwei
 * schnelle Tipps nicht denselben alten Stand überschreiben. */
export async function haushaltZaehlen(
  db: HeftaDb,
  id: Id,
  feld: 'kinder' | 'weitereErwachsene',
  schritt: number,
): Promise<number> {
  const tx = db.transaction('haushalte', 'readwrite');
  const haushalt = await tx.store.get(id);
  if (!haushalt) throw new Error('Haushalt nicht gefunden');
  const neu = Math.max(0, haushalt[feld] + schritt);
  await tx.store.put({ ...haushalt, [feld]: neu, updatedAt: jetzt() });
  await tx.done;
  return neu;
}

/** Farbe wählen. Hat sie schon jemand im Haushalt, tauscht ihr: Sie oder er bekommt die bisherige. */
export async function farbeSetzen(db: HeftaDb, zugehoerigkeitId: Id, farbe: number): Promise<void> {
  const tx = db.transaction('zugehoerigkeiten', 'readwrite');
  const zug = await tx.store.get(zugehoerigkeitId);
  if (!zug) throw new Error('Zugehörigkeit nicht gefunden');
  const zeit = jetzt();
  if (zug.farbe !== farbe) {
    for (const andere of await tx.store.index('haushaltId').getAll(zug.haushaltId)) {
      if (andere.id !== zug.id && andere.farbe === farbe && !andere.herausgenommenAm)
        await tx.store.put({ ...andere, farbe: zug.farbe, updatedAt: zeit });
    }
    await tx.store.put({ ...zug, farbe, updatedAt: zeit });
  }
  await tx.done;
}

/** Rolle, Bezeichnung oder Farbe in diesem Haushalt ändern (gilt nur hier). */
export async function zugehoerigkeitAendern(
  db: HeftaDb,
  id: Id,
  teil: Partial<Pick<Zugehoerigkeit, 'rolle' | 'bezeichnung' | 'farbe' | 'behalten'>>,
): Promise<void> {
  const zug = await db.get('zugehoerigkeiten', id);
  if (!zug) throw new Error('Zugehörigkeit nicht gefunden');
  await db.put('zugehoerigkeiten', { ...zug, ...teil, updatedAt: jetzt() });
}

export async function haushaltAendern(
  db: HeftaDb,
  id: Id,
  teil: Partial<Omit<Haushalt, 'id' | 'createdAt'>>,
): Promise<void> {
  const haushalt = await db.get('haushalte', id);
  if (!haushalt) throw new Error('Haushalt nicht gefunden');
  await db.put('haushalte', { ...haushalt, ...teil, updatedAt: jetzt() });
}

/**
 * Rolle wechseln (design/unterlage-warum-haushalt.md, HA1). Aus der Bürgschaft kommt man hinten in den
 * Vertrag. Wird die hauptmietende Person Bürge, rückt die nächste im Vertrag an ihre Stelle.
 */
export async function rolleWechseln(db: HeftaDb, id: Id, neu: Rolle): Promise<void> {
  const tx = db.transaction('zugehoerigkeiten', 'readwrite');
  const ort = tx.objectStore('zugehoerigkeiten');
  const z = await ort.get(id);
  if (!z) throw new Error('Zugehörigkeit nicht gefunden');
  const zeit = jetzt();
  const andere = (await ort.index('haushaltId').getAll(z.haushaltId)).filter((x) => x.id !== id);
  if (z.rolle === 'hauptmieter' && neu === 'buerge') {
    const naechste = andere
      .filter((x) => x.rolle === 'mitmieter' && !x.herausgenommenAm)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];
    if (naechste) await ort.put({ ...naechste, rolle: 'hauptmieter', updatedAt: zeit });
  }
  const reihenfolge =
    z.rolle === 'buerge'
      ? andere.reduce((max, x) => Math.max(max, x.reihenfolge + 1), z.reihenfolge)
      : z.reihenfolge;
  await ort.put({ ...z, rolle: neu, reihenfolge, updatedAt: zeit });
  await tx.done;
}

/** Fügt eine neue Person mit Rolle hinten an den Haushalt an. */
export async function mitgliedHinzufuegen(
  db: HeftaDb,
  haushaltId: Id,
  entwurf: PersonEntwurf,
): Promise<Person> {
  const zeit = jetzt();
  const tx = db.transaction(['personen', 'zugehoerigkeiten'], 'readwrite');
  const bisher = await tx.objectStore('zugehoerigkeiten').index('haushaltId').getAll(haushaltId);
  const reihenfolge = bisher.reduce((max, z) => Math.max(max, z.reihenfolge + 1), 0);
  const person = personAus(entwurf, zeit);
  const alle = await tx.objectStore('zugehoerigkeiten').getAll();
  await tx.objectStore('personen').put(person);
  await tx.objectStore('zugehoerigkeiten').put({
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    haushaltId,
    personId: person.id,
    rolle: entwurf.rolle,
    bezeichnung: entwurf.bezeichnung,
    farbe: farbeImHaushalt(person.id, haushaltId, alle),
    reihenfolge,
    herausgenommenAm: null,
  });
  await tx.done;
  return person;
}

/**
 * Nimmt eine Person, die es schon gibt, in einen weiteren Haushalt auf (E53, Modell für Schritt 2).
 * Sie bringt ihre Farbe mit. Ihre Erklärungen ohne Zugehörigkeit bekommen die ihres ersten
 * Haushalts, damit sie dort bleiben und im neuen nicht zählen. Ist sie schon darin, ändert sich nichts.
 */
export async function personAufnehmen(
  db: HeftaDb,
  haushaltId: Id,
  personId: Id,
  rolle: Rolle,
  bezeichnung: Bezeichnung,
): Promise<Zugehoerigkeit> {
  const zeit = jetzt();
  const tx = db.transaction(['zugehoerigkeiten', 'dokumente'], 'readwrite');
  const alle = await tx.objectStore('zugehoerigkeiten').getAll();
  const da = alle.find((z) => z.personId === personId && z.haushaltId === haushaltId);
  if (da) {
    await tx.done;
    return da;
  }
  const eigene = alle
    .filter((z) => z.personId === personId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const erste = eigene[0];
  if (erste) {
    const dokumente = await tx.objectStore('dokumente').index('personId').getAll(personId);
    for (const d of erklaerungenFestlegen(dokumente, erste.id, jeHaushalt))
      await tx.objectStore('dokumente').put({ ...d, updatedAt: zeit });
  }
  const zug: Zugehoerigkeit = {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    haushaltId,
    personId,
    rolle,
    bezeichnung,
    farbe: farbeImHaushalt(personId, haushaltId, alle),
    reihenfolge: alle
      .filter((z) => z.haushaltId === haushaltId)
      .reduce((m, z) => Math.max(m, z.reihenfolge + 1), 0),
    herausgenommenAm: null,
  };
  await tx.objectStore('zugehoerigkeiten').put(zug);
  await tx.done;
  return zug;
}

/**
 * Nimmt eine Person aus dem Haushalt, behält aber ihre Angaben und Unterlagen
 * (Person ist unabhängig vom Haushalt, docs/03-datenmodell.md).
 */
export async function mitgliedHerausnehmen(db: HeftaDb, zugehoerigkeitId: Id): Promise<void> {
  const zug = await db.get('zugehoerigkeiten', zugehoerigkeitId);
  if (!zug) return;
  const zeit = jetzt();
  await db.put('zugehoerigkeiten', { ...zug, herausgenommenAm: zeit, updatedAt: zeit });
}

/**
 * Holt eine herausgenommene Person zurück, hinten an den Haushalt, mit ihren Unterlagen.
 * Ist ihre Farbe inzwischen vergeben, bekommt sie eine freie.
 */
export async function mitgliedZurueckholen(
  db: HeftaDb,
  zugehoerigkeitId: Id,
  teil: Partial<Pick<Zugehoerigkeit, 'rolle' | 'bezeichnung'>> = {},
): Promise<void> {
  const tx = db.transaction('zugehoerigkeiten', 'readwrite');
  const zug = await tx.store.get(zugehoerigkeitId);
  if (!zug) return;
  const ueberall = await tx.store.getAll();
  const alle = ueberall.filter((z) => z.haushaltId === zug.haushaltId);
  const belegt = alle.filter((z) => !z.herausgenommenAm && z.id !== zug.id).map((z) => z.farbe);
  await tx.store.put({
    ...zug,
    ...teil,
    herausgenommenAm: null,
    farbe: belegt.includes(zug.farbe)
      ? farbeImHaushalt(zug.personId, zug.haushaltId, ueberall)
      : zug.farbe,
    reihenfolge: alle.reduce((m, z) => Math.max(m, z.reihenfolge + 1), 0),
    updatedAt: jetzt(),
  });
  await tx.done;
}

/**
 * Nimmt eine Person aus dem Haushalt. Gehört sie zu keinem anderen Haushalt mehr,
 * werden ihre Angaben, Unterlagen und Dateien gelöscht. Nur nach Rückfrage in der Oberfläche aufrufen.
 */
export async function mitgliedEntfernen(db: HeftaDb, zugehoerigkeitId: Id): Promise<void> {
  const tx = db.transaction(
    ['zugehoerigkeiten', 'personen', 'dokumente', 'versionen', 'dateien'],
    'readwrite',
  );
  const zug = await tx.objectStore('zugehoerigkeiten').get(zugehoerigkeitId);
  if (!zug) return;
  await tx.objectStore('zugehoerigkeiten').delete(zug.id);
  const weitere = await tx.objectStore('zugehoerigkeiten').index('personId').getAll(zug.personId);
  if (weitere.length === 0) {
    // Eine verschobene Seite kann die Datei mit einer anderen Person teilen.
    const kandidaten: (Id | null)[] = [];
    for (const dok of await tx.objectStore('dokumente').index('personId').getAll(zug.personId)) {
      for (const v of await tx.objectStore('versionen').index('dokumentId').getAll(dok.id)) {
        kandidaten.push(v.original, v.aufbereitet);
        await tx.objectStore('versionen').delete(v.id);
      }
      await tx.objectStore('dokumente').delete(dok.id);
    }
    await tx.objectStore('personen').delete(zug.personId);
    await verwaisteLoeschen(tx.objectStore('versionen'), tx.objectStore('dateien'), kandidaten);
  }
  await tx.done;
}

/**
 * „Von vorn beginnen“ (B26, E93): Ein angefangener Haushalt wird mit seinen Personen entfernt, nur nach dem
 * Blatt „Von vorn beginnen?“. Hefte bleiben und gelten wieder als Hefte ohne Haushalt (E45).
 */
export async function haushaltVonVorn(db: HeftaDb, haushaltId: Id): Promise<void> {
  const haushalt = await db.get('haushalte', haushaltId);
  if (!haushalt?.einrichtungOffen)
    throw new Error('Nur ein angefangener Haushalt beginnt von vorn');
  const plaetze = await db.getAllFromIndex('zugehoerigkeiten', 'haushaltId', haushaltId);
  for (const z of plaetze) {
    const anderswo = (await db.getAllFromIndex('zugehoerigkeiten', 'personId', z.personId)).some(
      (x) => x.haushaltId !== haushaltId,
    );
    if (anderswo) await db.delete('zugehoerigkeiten', z.id);
    else await personGanzLoeschen(db, z.personId);
  }
  const tx = db.transaction(['haushalte', 'hefte', 'bewerbungen'], 'readwrite');
  for (const h of await tx.objectStore('hefte').getAll())
    if (h.haushaltId === haushaltId) await tx.objectStore('hefte').put({ ...h, haushaltId: null });
  for (const b of await tx.objectStore('bewerbungen').index('haushaltId').getAll(haushaltId))
    await tx.objectStore('bewerbungen').delete(b.id);
  await tx.objectStore('haushalte').delete(haushaltId);
  await tx.done;
}

/**
 * Löscht eine Person ganz: alle Plätze in Haushalten, Unterlagen mit allen Versionen und Dateien,
 * Selbstauskunft (design/person-und-haushalt.md, Abschnitt 4). Nur nach eigener Rückfrage-Seite aufrufen.
 */
export async function personGanzLoeschen(db: HeftaDb, personId: Id): Promise<void> {
  const tx = db.transaction(
    ['zugehoerigkeiten', 'personen', 'dokumente', 'versionen', 'dateien'],
    'readwrite',
  );
  for (const z of await tx.objectStore('zugehoerigkeiten').index('personId').getAll(personId))
    await tx.objectStore('zugehoerigkeiten').delete(z.id);
  // Eine verschobene Seite kann die Datei mit einer anderen Person teilen.
  const kandidaten: (Id | null)[] = [];
  for (const dok of await tx.objectStore('dokumente').index('personId').getAll(personId)) {
    for (const v of await tx.objectStore('versionen').index('dokumentId').getAll(dok.id)) {
      kandidaten.push(v.original, v.aufbereitet);
      await tx.objectStore('versionen').delete(v.id);
    }
    await tx.objectStore('dokumente').delete(dok.id);
  }
  await tx.objectStore('personen').delete(personId);
  await verwaisteLoeschen(tx.objectStore('versionen'), tx.objectStore('dateien'), kandidaten);
  await tx.done;
}

/** Die aktuelle Bewerbung des Haushalts (zuletzt geändert), oder null. */
export async function bewerbungLaden(db: HeftaDb, haushaltId: Id): Promise<Bewerbung | null> {
  const alle = await db.getAllFromIndex('bewerbungen', 'haushaltId', haushaltId);
  return alle.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** Ändert die aktuelle Bewerbung oder legt sie an (Adresse, Satz, Einstellungen der Mappe). */
export async function bewerbungSpeichern(
  db: HeftaDb,
  haushaltId: Id,
  teil: Partial<Pick<Bewerbung, 'adresse' | 'satz' | 'export' | 'bitteSatz' | 'einzug'>>,
): Promise<Bewerbung> {
  const zeit = jetzt();
  // Lesen und Schreiben in einer Transaktion: zwei Änderungen kurz nacheinander (Adresse und
  // Einstellungen) dürfen sich nicht gegenseitig überschreiben.
  const tx = db.transaction('bewerbungen', 'readwrite');
  const bisher =
    (await tx.store.index('haushaltId').getAll(haushaltId)).sort((x, y) =>
      y.updatedAt.localeCompare(x.updatedAt),
    )[0] ?? null;
  const bewerbung: Bewerbung = {
    ...(bisher ?? neueBewerbung(haushaltId, zeit)),
    ...teil,
    updatedAt: zeit,
  };
  await tx.store.put(bewerbung);
  await tx.done;
  return bewerbung;
}

function neueBewerbung(haushaltId: Id, zeit: string): Bewerbung {
  return {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    haushaltId,
    adresse: '',
    quelle: '',
    inseratText: null,
    anrede: '',
    ansprechpartner: '',
    personen: [],
    exportprofilId: null,
    verwendeteVersionen: [],
    bestandteile: {
      deckblatt: true,
      inhaltsverzeichnis: true,
      anschreiben: false,
      fusszeile: true,
    },
    dateiname: null,
    kontakt: null,
    status: null,
    anschreiben: null,
  };
}

/**
 * Die Kennung der aktuellen Bewerbung für diese Wohnung (E6): dieselbe in jeder neuen Fassung, eine neue
 * für eine andere Wohnung. Legt die Bewerbung an, wenn es noch keine gibt.
 */
export async function bewerbungsKennung(
  db: HeftaDb,
  haushaltId: Id,
  adresse: string,
): Promise<string> {
  const schluessel = wohnungsSchluessel(adresse);
  const tx = db.transaction('bewerbungen', 'readwrite');
  const bisher =
    (await tx.store.index('haushaltId').getAll(haushaltId)).sort((x, y) =>
      y.updatedAt.localeCompare(x.updatedAt),
    )[0] ?? null;
  const vorhanden = bisher?.kennungen?.[schluessel];
  if (vorhanden) {
    await tx.done;
    return vorhanden;
  }
  const kennung = neueId();
  // Der Zeitpunkt der Bewerbung bleibt: Die Kennung ist keine Änderung, die der Nutzer gemacht hat.
  const bewerbung: Bewerbung = {
    ...(bisher ?? neueBewerbung(haushaltId, jetzt())),
    kennungen: { ...bisher?.kennungen, [schluessel]: kennung },
  };
  await tx.store.put(bewerbung);
  await tx.done;
  return kennung;
}

// ---------- Version 2: mehrere Bewerbungen je Haushalt (Tracker) ----------

/** Alle Bewerbungen des Haushalts, laufende zuerst. */
export async function bewerbungenLaden(db: HeftaDb, haushaltId: Id): Promise<Bewerbung[]> {
  return sortieren(await db.getAllFromIndex('bewerbungen', 'haushaltId', haushaltId));
}

/** Legt eine weitere Bewerbung an (eine Wohnung). */
export async function bewerbungAnlegen(
  db: HeftaDb,
  haushaltId: Id,
  teil: Partial<Omit<Bewerbung, 'id' | 'haushaltId' | 'createdAt' | 'updatedAt'>> = {},
): Promise<Bewerbung> {
  const bewerbung = { ...neueBewerbung(haushaltId, jetzt()), ...teil };
  await db.put('bewerbungen', bewerbung);
  return bewerbung;
}

/** Ändert eine bestimmte Bewerbung (gelesen und geschrieben in einer Transaktion). */
export async function bewerbungAendern(
  db: HeftaDb,
  id: Id,
  teil: Partial<Omit<Bewerbung, 'id' | 'haushaltId' | 'createdAt' | 'updatedAt'>>,
): Promise<Bewerbung | null> {
  const tx = db.transaction('bewerbungen', 'readwrite');
  const bisher = await tx.store.get(id);
  if (!bisher) return null;
  const bewerbung = { ...bisher, ...teil, updatedAt: jetzt() };
  await tx.store.put(bewerbung);
  await tx.done;
  return bewerbung;
}

export async function bewerbungLoeschen(db: HeftaDb, id: Id): Promise<void> {
  await db.delete('bewerbungen', id);
}

/** Speichert eine Datei getrennt von den Angaben. Wo Blobs nicht gehen, als ArrayBuffer. */
export async function dateiSpeichern(db: HeftaDb, datei: Blob, id: Id = neueId()): Promise<Id> {
  const eintrag: DateiEintrag = {
    id,
    createdAt: jetzt(),
    typ: datei.type,
    groesse: datei.size,
    daten: datei,
  };
  try {
    await db.put('dateien', eintrag);
  } catch {
    // Safari „Privat“ und WebKit im Test speichern keine Blobs in IndexedDB.
    await db.put('dateien', { ...eintrag, daten: await datei.arrayBuffer() });
  }
  return id;
}

export async function dateiLesen(db: HeftaDb, id: Id): Promise<Blob | null> {
  const eintrag = await db.get('dateien', id);
  if (!eintrag) return null;
  return eintrag.daten instanceof Blob
    ? eintrag.daten
    : new Blob([eintrag.daten], { type: eintrag.typ });
}

/** Wie viel Hefta selbst belegt, in Byte. Selbst gezählt, weil Safari den Verbrauch nicht verlässlich meldet. */
export async function speicherBelegt(db: HeftaDb): Promise<number> {
  let summe = 0;
  for (const eintrag of await db.getAll('dateien')) summe += eintrag.groesse;
  return summe;
}

/** Löscht alle Angaben und Dateien. Nur nach ausdrücklicher Bestätigung aufrufen. */
export async function allesLoeschen(db: HeftaDb): Promise<void> {
  const tx = db.transaction([...ALLE_ORTE], 'readwrite');
  await Promise.all(ALLE_ORTE.map((ort) => tx.objectStore(ort).clear()));
  await tx.done;
}

// ---------- Unterlagen (M3) ----------

export interface UnterlageEntwurf {
  /** Nur bei Typen mit `jeHaushalt`, wenn die Person in mehreren Haushalten ist (E53, Schritt 2). */
  zugehoerigkeitId?: Id | null;
  /** Name der hochgeladenen Datei, für die Seite der Unterlage. */
  dateiname?: string | null;
  personId: Id;
  /** ID des Dokumenttyps aus dem Regelkatalog. */
  typ: string;
  /** Bei Serientypen die Soll-Anzahl aus dem Katalog. */
  serie: number | null;
  original: Blob;
  /** Aufbereitete Fassung, z. B. ein entsperrtes und gerastertes PDF. */
  aufbereitet: Blob | null;
  ausstellungsdatum: string | null;
  abrechnungsmonat: string | null;
  /** Weitere Monate in derselben Datei (Serie, Entwurf RS2): je Monat eine Version, eine Datei. */
  /** Schon beim Hochladen gelesen, damit es nicht noch einmal nötig ist. */
  fakten?: VersionFakten | null;
  /** „Passt so“ schon beim Hochladen. */
  bestaetigt?: string[];
  /** Eine Datei, mehrere Monate: je Monat eine Version mit ihren Seiten (OR3). */
  aufteilung?: { monat: string; seiten: number[] }[];
  variante: string | null;
  /** Ausgewählte Seiten (0-basiert), null = alle. */
  seiten: number[] | null;
  gerastert: boolean;
}

function neuesDokument(personId: Id, typ: string, serie: number | null): Dokument {
  const zeit = jetzt();
  return {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    personId,
    typ,
    notiz: '',
    serie,
    stummBis: null,
  };
}

/**
 * Speichert eine neue Version einer Unterlage. Eine neue Gehaltsabrechnung ersetzt nichts,
 * sondern schiebt die Serie weiter; ältere Versionen bleiben, bis der Nutzer sie löscht.
 */
export async function unterlageSpeichern(db: HeftaDb, e: UnterlageEntwurf): Promise<DateiVersion> {
  // Dateien zuerst (eigene Transaktionen mit Blob-Ausweichweg), dann Dokument und Version zusammen.
  const original = await dateiSpeichern(db, e.original);
  let aufbereitet: Id | null = null;
  try {
    aufbereitet = e.aufbereitet ? await dateiSpeichern(db, e.aufbereitet) : null;
    return await versionAnlegen(db, e, original, aufbereitet);
  } catch (fehler) {
    // Speicher voll: Sonst bliebe die Datei liegen, ohne dass sie je jemand sieht oder löschen kann.
    await db.delete('dateien', original);
    if (aufbereitet) await db.delete('dateien', aufbereitet);
    throw fehler;
  }
}

async function versionAnlegen(
  db: HeftaDb,
  e: UnterlageEntwurf,
  original: Id,
  aufbereitet: Id | null,
): Promise<DateiVersion> {
  const zeit = jetzt();
  const tx = db.transaction(['dokumente', 'versionen'], 'readwrite');
  const zugId = jeHaushalt(e.typ) ? (e.zugehoerigkeitId ?? null) : null;
  const bisher = (await tx.objectStore('dokumente').index('personId').getAll(e.personId)).find(
    (d) => d.typ === e.typ && (d.zugehoerigkeitId ?? null) === zugId,
  );
  // Neue Unterlage: Erinnerungen dürfen wieder fragen.
  const dokument: Dokument = {
    ...(bisher ?? {
      ...neuesDokument(e.personId, e.typ, e.serie),
      ...(zugId ? { zugehoerigkeitId: zugId } : {}),
    }),
    stummBis: null,
    updatedAt: zeit,
  };
  await tx.objectStore('dokumente').put(dokument);
  const version: DateiVersion = {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    dokumentId: dokument.id,
    dateiname: e.dateiname ?? null,
    ausstellungsdatum: e.ausstellungsdatum,
    abrechnungsmonat: e.abrechnungsmonat,
    variante: e.variante,
    original,
    aufbereitet,
    seiten: e.seiten,
    schwaerzungen: {},
    gerastert: e.gerastert,
    erkannteWerte: e.fakten ?? null,
    vomNutzerBestaetigt: e.bestaetigt?.length ? e.bestaetigt : null,
  };
  const [erste, ...weitere] = e.aufteilung ?? [];
  if (erste) {
    version.abrechnungsmonat = erste.monat;
    version.seiten = erste.seiten;
    version.eigene = erste.seiten;
  }
  await tx.objectStore('versionen').put(version);
  for (const teil of weitere) {
    await tx.objectStore('versionen').put({
      ...version,
      id: neueId(),
      abrechnungsmonat: teil.monat,
      seiten: teil.seiten,
      eigene: teil.seiten,
    });
  }
  await tx.done;
  return version;
}

/** Was „Rückgängig“ braucht, um eine Änderung an Versionen zurückzunehmen. */
export interface VersionenStand {
  vorher: DateiVersion[];
  neu: Id[];
  neueDateien: Id[];
}

/** Löscht Dateien, auf die keine Version mehr zeigt; gibt sie für „Rückgängig“ zurück. */
async function verwaisteLoeschen(
  versionen: { getAll(): Promise<DateiVersion[]> },
  dateien: {
    get(id: Id): Promise<HeftaSchema['dateien']['value'] | undefined>;
    delete(id: Id): Promise<void>;
  },
  kandidaten: (Id | null)[],
): Promise<HeftaSchema['dateien']['value'][]> {
  const genutzt = new Set((await versionen.getAll()).flatMap((v) => [v.original, v.aufbereitet]));
  const weg: HeftaSchema['dateien']['value'][] = [];
  for (const id of new Set(kandidaten)) {
    if (!id || genutzt.has(id)) continue;
    const datei = await dateien.get(id);
    if (datei) weg.push(datei);
    await dateien.delete(id);
  }
  return weg;
}

/**
 * Löscht Dateien, auf die keine Version mehr zeigt. Läuft, wenn „Rückgängig“ vorbei ist, nicht beim
 * Löschen selbst: Safari verliert den Inhalt einer Datei, sobald ihr Eintrag weg ist, und „Rückgängig“
 * könnte sie nicht zurückschreiben. Ganz frische bleiben: Sie gehören vielleicht zu einem Hochladen,
 * das gerade läuft (Datei und Version entstehen in zwei Schritten).
 */
export async function verwaisteDateienLoeschen(
  db: HeftaDb,
  schonfristMs = 10 * 60_000,
): Promise<void> {
  const grenze = new Date(Date.now() - schonfristMs).toISOString();
  const tx = db.transaction(['versionen', 'dateien'], 'readwrite');
  const genutzt = new Set(
    (await tx.objectStore('versionen').getAll()).flatMap((v) => [v.original, v.aufbereitet]),
  );
  for (const id of await tx.objectStore('dateien').getAllKeys()) {
    if (genutzt.has(id)) continue;
    const datei = await tx.objectStore('dateien').get(id);
    if (datei && datei.createdAt <= grenze) await tx.objectStore('dateien').delete(id);
  }
  await tx.done;
}

/**
 * Schreibt und löscht Versionen in einem Schritt. Eine Datei wird erst gelöscht, wenn keine Version
 * mehr auf sie zeigt. `neueDateien` sind eigens dafür gespeicherte Dateien: „Rückgängig“ nimmt sie mit.
 */
export async function versionenAendern(
  db: HeftaDb,
  aenderung: { schreiben?: DateiVersion[]; loeschen?: Id[]; neueDateien?: Id[] },
): Promise<VersionenStand> {
  const tx = db.transaction(['versionen', 'dateien'], 'readwrite');
  const ort = tx.objectStore('versionen');
  const vorher: DateiVersion[] = [];
  const neu: Id[] = [];
  const zeit = jetzt();
  for (const id of aenderung.loeschen ?? []) {
    const v = await ort.get(id);
    if (v) vorher.push(v);
    await ort.delete(id);
  }
  for (const v of aenderung.schreiben ?? []) {
    const alt = await ort.get(v.id);
    if (alt) vorher.push(alt);
    else neu.push(v.id);
    // Kommt aus dem Zustand der Oberfläche: IndexedDB speichert nur einfache Objekte.
    await ort.put({ ...(JSON.parse(JSON.stringify(v)) as DateiVersion), updatedAt: zeit });
  }
  await tx.done;
  return { vorher, neu, neueDateien: aenderung.neueDateien ?? [] };
}

export async function versionenZurueck(db: HeftaDb, stand: VersionenStand): Promise<void> {
  const tx = db.transaction(['versionen', 'dateien'], 'readwrite');
  for (const id of stand.neu) await tx.objectStore('versionen').delete(id);
  for (const v of stand.vorher) await tx.objectStore('versionen').put(v);
  for (const id of stand.neueDateien) await tx.objectStore('dateien').delete(id);
  await tx.done;
}

/** Löscht eine Version sofort, ihre Dateien erst, wenn keine andere Version sie mehr nutzt. */
export function versionLoeschen(db: HeftaDb, versionId: Id): Promise<VersionenStand> {
  return versionenAendern(db, { loeschen: [versionId] });
}

/** Dokument einer Person für eine Unterlage; legt es an, falls es fehlt. */
export async function dokumentFuer(
  db: HeftaDb,
  ziel: { personId: Id; typ: string; serie: number | null },
): Promise<Dokument> {
  const bisher = (await db.getAllFromIndex('dokumente', 'personId', ziel.personId)).find(
    (d) => d.typ === ziel.typ,
  );
  if (bisher) return bisher;
  const dokument = neuesDokument(ziel.personId, ziel.typ, ziel.serie);
  await db.put('dokumente', dokument);
  return dokument;
}

/** Trägt nach, was Hefta in der Datei gesehen hat. Ändert sonst nichts, auch nicht `updatedAt`. */
export async function faktenSpeichern(
  db: HeftaDb,
  versionId: Id,
  fakten: VersionFakten,
): Promise<void> {
  const tx = db.transaction('versionen', 'readwrite');
  const v = await tx.store.get(versionId);
  if (v) await tx.store.put({ ...v, erkannteWerte: JSON.parse(JSON.stringify(fakten)) });
  await tx.done;
}

/** Neue Version aus Seiten einer vorhandenen Datei („Verschieben“); legt das Dokument bei Bedarf an. */
export async function versionAusSeiten(
  db: HeftaDb,
  ziel: { personId: Id; typ: string; serie: number | null },
  vorlage: DateiVersion,
  teil: Pick<DateiVersion, 'abrechnungsmonat' | 'ausstellungsdatum' | 'variante'> & {
    seite: number;
  },
): Promise<DateiVersion> {
  const dokument = await dokumentFuer(db, ziel);
  const zeit = jetzt();
  return {
    ...vorlage,
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    dokumentId: dokument.id,
    abrechnungsmonat: teil.abrechnungsmonat,
    ausstellungsdatum: teil.ausstellungsdatum,
    variante: teil.variante,
    eigene: [teil.seite],
    seiten: [teil.seite],
  };
}

/** Verteilt die Seiten einer Datei auf Monate. Monate ohne Seite fallen weg, die Datei bleibt. */
export function seitenAufteilen(
  db: HeftaDb,
  quellen: DateiVersion[],
  zuordnung: { monat: string; seiten: number[] }[],
): Promise<VersionenStand> {
  const vorlage = quellen[0]!;
  return versionenAendern(db, {
    loeschen: quellen.map((v) => v.id),
    schreiben: zuordnung.map(({ monat, seiten }) => ({
      ...(quellen.find((v) => v.abrechnungsmonat === monat) ?? vorlage),
      // Zweimal hochgeladen: Danach bleibt die Datei nur einmal gespeichert.
      original: vorlage.original,
      aufbereitet: vorlage.aufbereitet,
      id: neueId(),
      abrechnungsmonat: monat,
      eigene: seiten,
      seiten,
    })),
  });
}

/** Ausstellungsdatum nachtragen, ändern oder entfernen: Es ist freiwillig. */
export async function versionDatumSetzen(
  db: HeftaDb,
  versionId: Id,
  tag: string | null,
): Promise<void> {
  const version = await db.get('versionen', versionId);
  if (!version) throw new Error('Version nicht gefunden');
  await db.put('versionen', { ...version, ausstellungsdatum: tag, updatedAt: jetzt() });
}

/** Setzt Felder am Dokument einer Person (z. B. „Noch nicht“); legt es an, falls es fehlt. */
export async function dokumentAendern(
  db: HeftaDb,
  personId: Id,
  typ: string,
  serie: number | null,
  teil: Partial<Pick<Dokument, 'stummBis' | 'stummMonat' | 'stummAnzahl' | 'notiz'>>,
): Promise<void> {
  const bisher = (await db.getAllFromIndex('dokumente', 'personId', personId)).find(
    (d) => d.typ === typ,
  );
  const dokument = bisher ?? neuesDokument(personId, typ, serie);
  await db.put('dokumente', { ...dokument, ...teil, updatedAt: jetzt() });
}

// Hefte (Hefta 2, Schema 2). Ein Heft gehört zu einem Haushalt oder zu keinem (E45).

/** Die Hefte des Haushalts und die ohne Haushalt, in der Reihenfolge ihres Entstehens. */
export async function hefteLaden(db: HeftaDb, haushaltId: Id | null): Promise<Heft[]> {
  const alle = await db.getAll('hefte');
  return alle
    .filter((h) => h.haushaltId === null || h.haushaltId === haushaltId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Ändert ein Heft; `updatedAt` setzt Hefta. Gibt es das Heft nicht mehr, geschieht nichts. */
export async function heftAendern(
  db: HeftaDb,
  id: Id,
  aenderung: Partial<Omit<Heft, 'id' | 'createdAt'>>,
): Promise<Heft | null> {
  const tx = db.transaction('hefte', 'readwrite');
  const alt = await tx.store.get(id);
  if (!alt) {
    await tx.done;
    return null;
  }
  const neu: Heft = {
    ...alt,
    ...aenderung,
    id: alt.id,
    createdAt: alt.createdAt,
    updatedAt: jetzt(),
  };
  await tx.store.put(neu);
  await tx.done;
  return neu;
}

/** Ein neues Heft, „Gemerkt“, mit eigener Kennung für die Lesehilfe (E6). */
export async function heftAnlegen(
  db: HeftaDb,
  entwurf: Pick<Heft, 'haushaltId' | 'adresse' | 'link' | 'quelle' | 'inseratText' | 'angaben'>,
): Promise<Heft> {
  const zeit = jetzt();
  const heft: Heft = {
    id: neueId(),
    createdAt: zeit,
    updatedAt: zeit,
    kennung: neueId(),
    ereignisse: { ...KEINE_EREIGNISSE },
    notiz: '',
    ...entwurf,
  };
  if (!heft.angaben) delete heft.angaben;
  await db.put('hefte', heft);
  return heft;
}

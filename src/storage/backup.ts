import { BACKUP_ENDUNG } from '../app/name';
import {
  ZipFehler,
  zipBauen,
  zipLesen,
  zipVerzeichnis,
  type ZipEintrag,
  type ZipQuelle,
} from './zip';

// Backup-Datei von Hefta (docs/07-speicher-backup-sicherheit.md).
//
// Ohne Passwort: ein normales ZIP ohne Kompression (die Dateien sind schon komprimiert),
// das jeder mit Bordmitteln öffnen kann.
//
// Mit Passwort: Kopf + das ZIP, verschlüsselt in Blöcken (Web Crypto, keine Eigenbauten):
//   Kopf (42 Byte): "HEFTABAK" | Formatversion (1) | KDF (1 = PBKDF2-SHA-256) | Runden (u32)
//                   | Salz (16) | Nonce-Präfix (8) | Blockgröße (u32)
//   Passwortprobe (16 Byte): GCM-Prüfsumme über nichts, Nonce = Präfix || FFFFFFFF
//   je Block:       Länge (u32) | AES-256-GCM-Chiffrat mit Prüfsumme
//   Nonce = Präfix || Blocknummer; zusätzlich authentifiziert: Kopf || Blocknummer || letzter Block?
// So fällt jedes veränderte, vertauschte oder abgeschnittene Stück beim Einlesen auf,
// und das iPhone muss nie die ganze Datei auf einmal im Arbeitsspeicher entschlüsseln.
//
// Dieser Aufbau bleibt: Alle je geschriebenen Backups müssen sich lesen lassen (tests/fixtures/backup).

const MAGIE = new TextEncoder().encode('HEFTABAK');

/**
 * Aufgabe 53: Die Dateiauswahl für ein Backup zeigt keine Fotos und keine Kamera, sondern die Dateien.
 * Am iPhone getestet (6.11.): Mit `.hefta` und `application/octet-stream` öffnet iOS direkt „Dateien“, das
 * Backup ist wählbar, andere Dateien aber auch. Mit `.hefta` allein bietet iOS wieder Fotos und Kamera an,
 * weil es die Endung nicht kennt. Ausgrauen geht am iPhone also nicht; ob eine Datei wirklich ein Backup
 * ist, prüft danach `backupArt` am Inhalt.
 */
export const BACKUP_ACCEPT = `.${BACKUP_ENDUNG},application/octet-stream`;

/** In der App meldet Hefta `.hefta` als eigenen Dateityp an; dort graut die Auswahl alles andere aus. */
export const backupAccept = (app: boolean) => (app ? `.${BACKUP_ENDUNG}` : BACKUP_ACCEPT);
const FORMAT = 1;
const KDF_PBKDF2 = 1;
const KOPF_LAENGE = 42;
const PROBE_LAENGE = 16;
const PROBE_NUMMER = 0xffffffff;
export const RUNDEN = 600_000;
const BLOCK = 4 * 1024 * 1024;
const PRUEFSUMME = 16;

export type BackupFehlerGrund =
  | 'kein_backup'
  | 'passwort_noetig'
  | 'passwort_falsch'
  | 'beschaedigt'
  | 'version_neu'
  | 'zu_gross'
  | 'kein_platz';

export class BackupFehler extends Error {
  constructor(readonly grund: BackupFehlerGrund) {
    super(grund);
    this.name = 'BackupFehler';
  }
}

export interface BackupEintrag {
  pfad: string;
  daten: Blob;
}

function zahl32(wert: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, wert);
  return b;
}

function verbinden(...teile: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const ergebnis = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let pos = 0;
  for (const t of teile) {
    ergebnis.set(t, pos);
    pos += t.length;
  }
  return ergebnis;
}

async function schluessel(passwort: string, salz: Uint8Array<ArrayBuffer>, runden: number) {
  const basis = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passwort.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salz, iterations: runden },
    basis,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function blockParameter(kopf: Uint8Array, praefix: Uint8Array, nummer: number, letzter: boolean) {
  return {
    name: 'AES-GCM',
    iv: verbinden(praefix, zahl32(nummer)),
    additionalData: verbinden(kopf, zahl32(nummer), new Uint8Array([letzter ? 1 : 0])),
    tagLength: 128,
  } satisfies AesGcmParams;
}

/**
 * Erstellt die Backup-Datei. Mit `passwort` verschlüsselt, sonst ein offenes ZIP.
 * `runden` nur für Tests ändern.
 */
export async function backupErstellen(
  eintraege: AsyncIterable<BackupEintrag> | Iterable<BackupEintrag>,
  passwort?: string,
  runden = RUNDEN,
): Promise<Blob> {
  const zip = await zipBauen(eintraege).catch((e: unknown) => {
    throw e instanceof ZipFehler ? new BackupFehler(e.grund) : e;
  });
  if (!passwort) return new Blob([zip], { type: 'application/zip' });

  const salz = crypto.getRandomValues(new Uint8Array(16));
  const praefix = crypto.getRandomValues(new Uint8Array(8));
  const kopf = verbinden(
    MAGIE,
    new Uint8Array([FORMAT, KDF_PBKDF2]),
    zahl32(runden),
    salz,
    praefix,
    zahl32(BLOCK),
  );
  const key = await schluessel(passwort, salz, runden);
  const probe = new Uint8Array(
    await crypto.subtle.encrypt(
      blockParameter(kopf, praefix, PROBE_NUMMER, true),
      key,
      new Uint8Array(0),
    ),
  );
  const teile: BlobPart[] = [kopf, probe];
  const bloecke = Math.max(1, Math.ceil(zip.size / BLOCK));
  for (let nummer = 0; nummer < bloecke; nummer++) {
    const klar = await zip.slice(nummer * BLOCK, (nummer + 1) * BLOCK).arrayBuffer();
    const chiffrat = new Uint8Array(
      await crypto.subtle.encrypt(
        blockParameter(kopf, praefix, nummer, nummer === bloecke - 1),
        key,
        klar,
      ),
    );
    teile.push(zahl32(chiffrat.length) as Uint8Array<ArrayBuffer>, new Blob([chiffrat]));
  }
  return new Blob(teile, { type: 'application/octet-stream' });
}

async function lesen(datei: Blob, von: number, laenge: number): Promise<Uint8Array> {
  return new Uint8Array(await datei.slice(von, von + laenge).arrayBuffer());
}

function gleich(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((wert, i) => wert === b[i]);
}

/** Welche Art Datei: verschlüsseltes Backup, offenes ZIP oder etwas anderes. */
export async function backupArt(datei: Blob): Promise<'verschluesselt' | 'offen' | 'unbekannt'> {
  const anfang = await lesen(datei, 0, 8);
  if (gleich(anfang, MAGIE)) return 'verschluesselt';
  if (anfang[0] === 0x50 && anfang[1] === 0x4b && anfang[2] === 0x03 && anfang[3] === 0x04) {
    return 'offen';
  }
  return 'unbekannt';
}

/** Macht aus dem verschlüsselten Backup eine Quelle, die an jeder Stelle lesbar ist. */
async function verschluesselteQuelle(
  datei: Blob,
  passwort: string | undefined,
): Promise<ZipQuelle> {
  const kopf = await lesen(datei, 0, KOPF_LAENGE);
  if (kopf.length < KOPF_LAENGE) throw new BackupFehler('beschaedigt');
  const ansicht = new DataView(kopf.buffer, kopf.byteOffset, kopf.byteLength);
  if ((kopf[8] ?? 0) > FORMAT) throw new BackupFehler('version_neu');
  if (kopf[9] !== KDF_PBKDF2) throw new BackupFehler('beschaedigt');
  if (!passwort) throw new BackupFehler('passwort_noetig');
  const runden = ansicht.getUint32(10);
  const salz = kopf.slice(14, 30);
  const praefix = kopf.slice(30, 38);
  const block = ansicht.getUint32(38);
  const key = await schluessel(passwort, salz, runden);
  const probe = await lesen(datei, KOPF_LAENGE, PROBE_LAENGE);
  try {
    await crypto.subtle.decrypt(
      blockParameter(kopf, praefix, PROBE_NUMMER, true),
      key,
      probe as Uint8Array<ArrayBuffer>,
    );
  } catch {
    throw new BackupFehler('passwort_falsch');
  }

  // Alle Blöcke außer dem letzten sind gleich groß: So lässt sich jede Stelle ausrechnen.
  const beginn = KOPF_LAENGE + PROBE_LAENGE;
  const schritt = 4 + block + PRUEFSUMME;
  const rest = datei.size - beginn;
  if (!block || rest < 4 + PRUEFSUMME) throw new BackupFehler('beschaedigt');
  const anzahl = Math.ceil(rest / schritt);
  const stelleVon = (n: number) => beginn + n * schritt;
  const laengeVon = async (n: number) => {
    const feld = await lesen(datei, stelleVon(n), 4);
    if (feld.length < 4) throw new BackupFehler('beschaedigt');
    return new DataView(feld.buffer, feld.byteOffset, 4).getUint32(0);
  };
  const letzte = await laengeVon(anzahl - 1);
  if (letzte < PRUEFSUMME || stelleVon(anzahl - 1) + 4 + letzte !== datei.size) {
    throw new BackupFehler('beschaedigt');
  }

  let zuletzt: { nummer: number; klar: Uint8Array } | null = null;
  const blockLesen = async (nummer: number): Promise<Uint8Array> => {
    if (zuletzt?.nummer === nummer) return zuletzt.klar;
    const laenge = await laengeVon(nummer);
    const istLetzter = nummer === anzahl - 1;
    if (laenge > block + PRUEFSUMME || (!istLetzter && laenge !== block + PRUEFSUMME)) {
      throw new BackupFehler('beschaedigt');
    }
    const chiffrat = await lesen(datei, stelleVon(nummer) + 4, laenge);
    try {
      const klar = new Uint8Array(
        await crypto.subtle.decrypt(
          blockParameter(kopf, praefix, nummer, istLetzter),
          key,
          chiffrat as Uint8Array<ArrayBuffer>,
        ),
      );
      zuletzt = { nummer, klar };
      return klar;
    } catch {
      throw new BackupFehler('beschaedigt');
    }
  };

  const groesse = (anzahl - 1) * block + (letzte - PRUEFSUMME);
  return {
    groesse,
    async lesen(von, laenge) {
      const ende = Math.min(groesse, von + laenge);
      const ergebnis = new Uint8Array(Math.max(0, ende - von));
      let pos = von;
      while (pos < ende) {
        const klar = await blockLesen(Math.floor(pos / block));
        const innen = pos % block;
        const stueck = klar.subarray(innen, Math.min(klar.length, innen + (ende - pos)));
        if (!stueck.length) throw new BackupFehler('beschaedigt');
        ergebnis.set(stueck, pos - von);
        pos += stueck.length;
      }
      return ergebnis;
    },
  };
}

export interface BackupLeser {
  pfade: string[];
  /** Liest eine Datei aus dem Backup und prüft dabei ihre Prüfsumme. */
  lesen(pfad: string): Promise<Blob>;
}

function zipFehler<T>(versprechen: Promise<T>): Promise<T> {
  return versprechen.catch((e: unknown) => {
    throw e instanceof ZipFehler ? new BackupFehler('beschaedigt') : e;
  });
}

/**
 * Öffnet eine Backup-Datei; nur das Passwort wird geprüft und das Verzeichnis gelesen.
 * Wirft `BackupFehler` mit einem Grund, den die Oberfläche in einen klaren Satz übersetzt.
 */
export async function backupOeffnen(
  datei: Blob,
  passwort: string | undefined,
): Promise<BackupLeser> {
  const art = await backupArt(datei);
  if (art === 'unbekannt') throw new BackupFehler('kein_backup');
  const quelle: ZipQuelle =
    art === 'verschluesselt'
      ? await verschluesselteQuelle(datei, passwort)
      : { groesse: datei.size, lesen: (von, laenge) => lesen(datei, von, laenge) };
  const eintraege = await zipFehler(zipVerzeichnis(quelle));
  const nachPfad = new Map<string, ZipEintrag>(eintraege.map((e) => [e.pfad, e]));
  return {
    pfade: eintraege.map((e) => e.pfad),
    lesen: (pfad) => {
      const eintrag = nachPfad.get(pfad);
      if (!eintrag) return Promise.reject(new BackupFehler('beschaedigt'));
      return zipFehler(zipLesen(quelle, eintrag));
    },
  };
}

/** Liest eine Backup-Datei ganz und gibt jede enthaltene Datei an `jeEintrag` weiter. */
export async function backupLesen(
  datei: Blob,
  passwort: string | undefined,
  jeEintrag: (eintrag: BackupEintrag) => Promise<void>,
): Promise<void> {
  const leser = await backupOeffnen(datei, passwort);
  for (const pfad of leser.pfade) await jeEintrag({ pfad, daten: await leser.lesen(pfad) });
}

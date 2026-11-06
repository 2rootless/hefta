// ZIP ohne Kompression, nur was das Backup braucht (docs/07-speicher-backup-sicherheit.md). Die Datei
// öffnet jedes Packprogramm. Gelesen wird immer über das Verzeichnis am Dateiende, nie durch Suchen
// nach Markierungen: Die Bytes einer PDF dürfen aussehen, wie sie wollen. Backups aus älteren Versionen
// (ohne Größen im Kopf der Einträge) haben dasselbe Verzeichnis und lesen sich genauso.

const LOKAL = 0x04034b50;
const VERZEICHNIS = 0x02014b50;
const ENDE = 0x06054b50;
const UTF8 = 0x0800;
const STUECK = 1024 * 1024;
const GRENZE = 0xffffffff;
/** 1. Januar 1980: ZIP verlangt ein Datum, es sagt hier nichts. */
const DOS_DATUM = 0x0021;

export type ZipGrund = 'beschaedigt' | 'zu_gross';

export class ZipFehler extends Error {
  constructor(readonly grund: ZipGrund) {
    super(grund);
    this.name = 'ZipFehler';
  }
}

export interface ZipDatei {
  pfad: string;
  daten: Blob;
}

const TABELLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  return c >>> 0;
});

function crcWeiter(crc: number, daten: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < daten.length; i++) c = TABELLE[(c ^ daten[i]!) & 0xff]! ^ (c >>> 8);
  return c;
}

export function crc32(daten: Uint8Array): number {
  return (crcWeiter(0xffffffff, daten) ^ 0xffffffff) >>> 0;
}

function kopf(groesse: number, fuellen: (d: DataView) => void, name?: Uint8Array) {
  const puffer = new Uint8Array(groesse + (name?.length ?? 0));
  fuellen(new DataView(puffer.buffer));
  if (name) puffer.set(name, groesse);
  return puffer;
}

/**
 * Baut das ZIP. Jede Datei wird einmal ganz gelesen (für die Prüfsumme) und in Stücken als Blob
 * abgelegt: So liegt nie die ganze Sicherung im Arbeitsspeicher der Seite.
 */
export async function zipBauen(
  dateien: AsyncIterable<ZipDatei> | Iterable<ZipDatei>,
): Promise<Blob> {
  const teile: BlobPart[] = [];
  const verzeichnis: Uint8Array<ArrayBuffer>[] = [];
  let pos = 0;
  for await (const { pfad, daten } of dateien) {
    const name = new TextEncoder().encode(pfad);
    if (pos + daten.size + 30 + name.length > GRENZE) throw new ZipFehler('zu_gross');
    let crc = 0xffffffff;
    const inhalt: Blob[] = [];
    for (let von = 0; von < daten.size; von += STUECK) {
      const stueck = new Uint8Array(await daten.slice(von, von + STUECK).arrayBuffer());
      crc = crcWeiter(crc, stueck);
      inhalt.push(new Blob([stueck]));
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const groesse = daten.size;
    const lokal = kopf(
      30,
      (d) => {
        d.setUint32(0, LOKAL, true);
        d.setUint16(4, 20, true);
        d.setUint16(6, UTF8, true);
        d.setUint16(12, DOS_DATUM, true);
        d.setUint32(14, crc, true);
        d.setUint32(18, groesse, true);
        d.setUint32(22, groesse, true);
        d.setUint16(26, name.length, true);
      },
      name,
    );
    verzeichnis.push(
      kopf(
        46,
        (d) => {
          d.setUint32(0, VERZEICHNIS, true);
          d.setUint16(4, 20, true);
          d.setUint16(6, 20, true);
          d.setUint16(8, UTF8, true);
          d.setUint16(14, DOS_DATUM, true);
          d.setUint32(16, crc, true);
          d.setUint32(20, groesse, true);
          d.setUint32(24, groesse, true);
          d.setUint16(28, name.length, true);
          d.setUint32(42, pos, true);
        },
        name,
      ),
    );
    teile.push(lokal, ...inhalt);
    pos += lokal.length + groesse;
  }
  if (verzeichnis.length > 0xffff) throw new ZipFehler('zu_gross');
  const laenge = verzeichnis.reduce((s, v) => s + v.length, 0);
  if (pos + laenge + 22 > GRENZE) throw new ZipFehler('zu_gross');
  const ende = kopf(22, (d) => {
    d.setUint32(0, ENDE, true);
    d.setUint16(8, verzeichnis.length, true);
    d.setUint16(10, verzeichnis.length, true);
    d.setUint32(12, laenge, true);
    d.setUint32(16, pos, true);
  });
  return new Blob([...teile, ...verzeichnis, ende]);
}

/** Lesbar an beliebiger Stelle: eine Datei oder das Entschlüsselte eines Backups. */
export interface ZipQuelle {
  groesse: number;
  lesen(von: number, laenge: number): Promise<Uint8Array>;
}

export interface ZipEintrag {
  pfad: string;
  kopf: number;
  groesse: number;
  crc: number;
}

const ansicht = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Liest das Verzeichnis am Dateiende. Ohne gültiges Verzeichnis ist die Datei abgeschnitten. */
export async function zipVerzeichnis(q: ZipQuelle): Promise<ZipEintrag[]> {
  const fenster = Math.min(q.groesse, 22 + 0xffff);
  if (fenster < 22) throw new ZipFehler('beschaedigt');
  const hinten = await q.lesen(q.groesse - fenster, fenster);
  const h = ansicht(hinten);
  let stelle = -1;
  for (let i = hinten.length - 22; i >= 0; i--) {
    if (h.getUint32(i, true) === ENDE && i + 22 + h.getUint16(i + 20, true) === hinten.length) {
      stelle = i;
      break;
    }
  }
  if (stelle < 0) throw new ZipFehler('beschaedigt');
  const anzahl = h.getUint16(stelle + 10, true);
  const laenge = h.getUint32(stelle + 12, true);
  const beginn = h.getUint32(stelle + 16, true);
  if (beginn + laenge > q.groesse) throw new ZipFehler('beschaedigt');
  const inhalt = await q.lesen(beginn, laenge);
  const d = ansicht(inhalt);
  const eintraege: ZipEintrag[] = [];
  let pos = 0;
  for (let n = 0; n < anzahl; n++) {
    if (pos + 46 > inhalt.length || d.getUint32(pos, true) !== VERZEICHNIS) {
      throw new ZipFehler('beschaedigt');
    }
    // Backups sind immer unkomprimiert: Etwas anderes hat Hefta nie geschrieben.
    if (d.getUint16(pos + 10, true) !== 0) throw new ZipFehler('beschaedigt');
    const nameLaenge = d.getUint16(pos + 28, true);
    eintraege.push({
      pfad: new TextDecoder().decode(inhalt.subarray(pos + 46, pos + 46 + nameLaenge)),
      crc: d.getUint32(pos + 16, true),
      groesse: d.getUint32(pos + 24, true),
      kopf: d.getUint32(pos + 42, true),
    });
    pos += 46 + nameLaenge + d.getUint16(pos + 30, true) + d.getUint16(pos + 32, true);
  }
  return eintraege;
}

/** Liest einen Eintrag und prüft seine Prüfsumme. */
export async function zipLesen(q: ZipQuelle, e: ZipEintrag): Promise<Blob> {
  const anfang = await q.lesen(e.kopf, 30);
  if (anfang.length < 30) throw new ZipFehler('beschaedigt');
  const d = ansicht(anfang);
  if (d.getUint32(0, true) !== LOKAL) throw new ZipFehler('beschaedigt');
  const start = e.kopf + 30 + d.getUint16(26, true) + d.getUint16(28, true);
  if (start + e.groesse > q.groesse) throw new ZipFehler('beschaedigt');
  let crc = 0xffffffff;
  const teile: Blob[] = [];
  for (let von = 0; von < e.groesse; von += STUECK) {
    const laenge = Math.min(STUECK, e.groesse - von);
    const stueck = await q.lesen(start + von, laenge);
    if (stueck.length !== laenge) throw new ZipFehler('beschaedigt');
    crc = crcWeiter(crc, stueck);
    teile.push(new Blob([stueck as Uint8Array<ArrayBuffer>]));
  }
  if ((crc ^ 0xffffffff) >>> 0 !== e.crc) throw new ZipFehler('beschaedigt');
  return new Blob(teile);
}

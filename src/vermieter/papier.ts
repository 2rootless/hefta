// Was die Prüfung der Lesehilfe über das Papier braucht (FORMAT.md, Abschnitt 11, Punkt 7; E223, V1, V2, V11, V12):
// Text von Seite 1 und der Seiten vor der ersten Unterlage in der Reihenfolge des Inhalts, wie PDF.js ihn liefert,
// Zeilen mit Zeilenumbruch; dazu, welche Seiten einer Unterlage leer sind, und das Erstelldatum der PDF.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Lesehilfe, Papier } from '../../pakete/hefta-json/src/index';

type Dok = pdfjs.PDFDocumentProxy;
const ZEILE = String.fromCharCode(10);

/** Text einer Seite in der Reihenfolge des Inhalts (V2); ein Zeilenende von PDF.js wird ein Zeilenumbruch. */
export async function seitenText(dok: Dok, nummer: number): Promise<string> {
  const seite = await dok.getPage(nummer);
  try {
    const inhalt = await seite.getTextContent();
    let text = '';
    for (const teil of inhalt.items) {
      if (!('str' in teil)) continue;
      text += teil.str;
      if (teil.hasEOL) text += ZEILE;
    }
    return text;
  } finally {
    seite.cleanup();
  }
}

const BILD = new Set([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
  pdfjs.OPS.paintImageXObjectRepeat,
  pdfjs.OPS.paintInlineImageXObjectGroup,
]);

/** V12: Eine Seite ist leer, wenn sie weder Text noch Bild trägt. */
async function leer(dok: Dok, nummer: number): Promise<boolean> {
  if ((await seitenText(dok, nummer)).trim()) return false;
  const seite = await dok.getPage(nummer);
  try {
    const ops = await seite.getOperatorList();
    return !ops.fnArray.some((f) => BILD.has(f));
  } finally {
    seite.cleanup();
  }
}

/** „D:20261118120000+01'00'“ aus den Eigenschaften der PDF als Zeitpunkt; null, wenn es fehlt oder kaputt ist. */
export function pdfDatum(roh: unknown): Date | null {
  if (typeof roh !== 'string') return null;
  const m = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z|([+-])(\d{2})'?(\d{2})'?)?/.exec(roh);
  if (!m) return null;
  const utc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
  const versatz = m[8] ? (m[8] === '-' ? -1 : 1) * (+m[9]! * 60 + +m[10]!) : 0;
  return new Date(utc - versatz * 60_000);
}

/** Alles, was `passt()` aus dem Paket über das Papier wissen muss. */
export async function papierLesen(dok: Dok, l: Lesehilfe): Promise<Papier> {
  const unterlagen = l.haushalt.personen.flatMap((p) => p.unterlagen);
  // V1: Deckblatt und Verzeichnis sind die Seiten vor der kleinsten `seiten_mappe.von`.
  const erste = unterlagen.length ? Math.min(...unterlagen.map((u) => u.seiten_mappe.von)) : 2;
  const vorne = Math.max(1, Math.min(erste - 1, dok.numPages));
  const texte: string[] = [];
  for (let n = 1; n <= vorne; n++) texte.push(await seitenText(dok, n));
  const leereSeiten: number[] = [];
  for (const u of unterlagen)
    for (let n = u.seiten_mappe.von; n <= Math.min(u.seiten_mappe.bis, dok.numPages); n++)
      if (!leereSeiten.includes(n) && (await leer(dok, n))) leereSeiten.push(n);
  const info = (await dok.getMetadata().catch(() => null))?.info as
    Record<string, unknown> | undefined;
  return {
    seite1: texte[0] ?? '',
    text: texte.join(ZEILE),
    leereSeiten,
    erstellt: pdfDatum(info?.CreationDate),
  };
}

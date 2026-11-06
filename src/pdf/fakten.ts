import { monatFinden, type TextStueck } from '../domain/datumErkennen';
import type { SeitenFakten, VersionFakten } from '../domain/modell';
import { FAKTEN_STAND, woerterAus } from '../domain/pruefhinweise';
import { seiteFastWeiss, seitenStuecke, type PdfDokument } from './pdfjs';

// Was Hefta für die Prüfhinweise in einer Datei liest (design/nachtraeglich-ordnen.md, Abschnitt 6).
// Läuft auf dem Gerät. Gemerkt wird, was die Prüfungen brauchen, nicht der Text selbst.

const HOECHSTENS_SEITEN = 40;
const HOECHSTENS_WOERTER = 400;
const GENUG_TEXT = 200;

async function pruefsumme(daten: BufferSource): Promise<string> {
  const summe = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(summe)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const dateiPruefsumme = (daten: Uint8Array) => pruefsumme(daten as Uint8Array<ArrayBuffer>);

function seiteVon(text: string): [number, number] | null {
  const m = text.match(/\bSeite\s+(\d{1,2})\s*(?:von|\/)\s*(\d{1,2})\b/i);
  if (!m) return null;
  const [n, gesamt] = [Number(m[1]), Number(m[2])];
  return n >= 1 && n <= gesamt ? [n, gesamt] : null;
}

async function seitenFakten(
  dokument: PdfDokument,
  nummer: number,
  heute: Date,
): Promise<SeitenFakten> {
  const stuecke: TextStueck[] = await seitenStuecke(dokument, nummer);
  const text = stuecke.map((s) => s.text).join(' ');
  const rein = text.replace(/\s+/g, ' ').trim();
  return {
    // Für den Prüfhinweis „anderer Monat“: Ein Monat allein auf der Seite reicht dafür nicht.
    monat: monatFinden(stuecke, heute, false),
    von: seiteVon(rein),
    leer: rein.length < 3 && (await seiteFastWeiss(dokument, nummer)),
    textHash:
      rein.length >= GENUG_TEXT
        ? (await pruefsumme(new TextEncoder().encode(rein))).slice(0, 16)
        : null,
    woerter: woerterAus(rein).slice(0, HOECHSTENS_WOERTER),
  };
}

export async function faktenAus(
  dokument: PdfDokument,
  hash: string | null,
  heute: Date = new Date(),
): Promise<VersionFakten> {
  const seiten: SeitenFakten[] = [];
  for (let n = 1; n <= Math.min(dokument.numPages, HOECHSTENS_SEITEN); n++)
    seiten.push(await seitenFakten(dokument, n, heute));
  return { stand: FAKTEN_STAND, hash, seiten };
}

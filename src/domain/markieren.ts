// PC64, Punkt 4 (W20): Was Hefta auf einem Gehaltsnachweis erkannt hat, steht in der Vorschau wie mit
// Textmarker hinterlegt: der gewählte Monat und der Name der Person. Rechnet ohne Browser-APIs.
import {
  ABRECHNUNG,
  MONATSWORT,
  NICHT_MONAT,
  STARK,
  monatNummer,
  zeilenAus,
  type TextStueck,
} from './datumErkennen';
import { stelleAus, vollerNameFinden, type Stelle } from './nameFinden';

/**
 * Wo der Monat `monat` („JJJJ-MM“) auf der Seite steht: als Wort („Oktober 2026“, „Aug 26“) oder als Zahl
 * („10/2026“). Zeilen mit „Verdienstabrechnung“ und ähnlichen Wörtern gehen vor, Zeilen wie „Auszahlung“
 * zählen nicht. Null, wenn der Monat nicht auf der Seite steht (etwa nach Hand gewählt).
 */
export function monatStelle(
  stuecke: TextStueck[],
  monat: string,
  messen: (text: string) => number = (text) => text.length,
): Stelle | null {
  const [jahr, nummer] = monat.split('-').map(Number);
  if (!jahr || !nummer) return null;
  const kurz = String(jahr).slice(2);
  const wort = new RegExp(
    `(?<![\\p{L}\\d.])(${MONATSWORT})(?![\\p{L}\\d])(?:\\.?\\s*[-/.]?\\s*['’]?(?:${jahr}|${kurz})(?!\\d))?`,
    'giu',
  );
  const zahl = new RegExp(`(?<![\\d./-])0?${nummer}\\s?[-/.]\\s?(?:${jahr}|${kurz})(?!\\d)`, 'g');
  let beste: { herkunft: ReturnType<typeof zeilenAus>[number]['herkunft']; punkte: number } | null =
    null;
  for (const zeile of zeilenAus(stuecke)) {
    const stark = STARK.test(zeile.text);
    if (NICHT_MONAT.test(zeile.text) && !stark) continue;
    const grund = stark ? 4 : ABRECHNUNG.test(zeile.text) ? 2 : 0;
    const treffer: { start: number; ende: number; mitJahr: boolean }[] = [];
    for (const m of zeile.text.matchAll(wort))
      if (monatNummer(m[1]!) === nummer)
        treffer.push({
          start: m.index,
          ende: m.index + m[0].trimEnd().length,
          mitJahr: m[0] !== m[1],
        });
    for (const m of zeile.text.matchAll(zahl))
      treffer.push({ start: m.index, ende: m.index + m[0].length, mitJahr: true });
    for (const t of treffer) {
      const punkte = grund + (t.mitJahr ? 1 : 0);
      if (!beste || punkte > beste.punkte)
        beste = { herkunft: zeile.herkunft.slice(t.start, t.ende), punkte };
    }
  }
  return beste ? stelleAus(beste.herkunft, messen) : null;
}

/** Monat und Name zusammen, für die Vorschau beim Zuordnen (DP39 1.4 und 1.5). */
export function gehaltsMarken(
  stuecke: TextStueck[] | null | undefined,
  monat: string | null | undefined,
  person: { vorname: string; nachname: string },
  messen?: (text: string) => number,
): Stelle[] {
  if (!stuecke?.length) return [];
  return [
    monat ? monatStelle(stuecke, monat, messen) : null,
    vollerNameFinden(stuecke, person.vorname, person.nachname, messen),
  ].filter((s): s is Stelle => !!s);
}

import vorlage from '../../data/absage.de.json';
import type { HeftaAnhang } from '../pdf/anhang';
import { fuellen, reihe, wohnungText } from './nachforderung';
import { imVertrag } from './regel';

// Die Mail „Absagen“ (design/nachforderung.md, Abschnitt Absage; Aufgabe 38): Die Wohnung ist vergeben,
// Dank, und was mit den Unterlagen geschieht. Kein Grund, keine Unterlage, kein Vergleich (VS16): Ein Grund
// wäre eine Wertung aus Unterlagen, die die Seite nie bewertet. Der Text ist Vorlage in data/absage.de.json.

export interface Absage {
  betreff: string;
  text: string;
}

/** `geloescht`: „Schon gelöscht“ (Standard) oder „Lösche ich später“. */
export function absage(a: HeftaAnhang, geloescht: boolean): Absage {
  const personen = a.haushalt.personen;
  const vertrag = personen.filter(imVertrag);
  const wohnung = wohnungText(a);
  const z = [
    fuellen(vorlage.anrede, {
      namen: reihe((vertrag.length ? vertrag : personen).map((p) => p.name)),
    }),
    '',
    wohnung ? fuellen(vorlage.vergeben, { wohnung }) : vorlage.vergebenOhne,
    geloescht
      ? fuellen(vorlage.geloescht, { wunsch: a.loeschwunsch ? vorlage.wunsch : '' })
      : vorlage.spaeter,
    '',
    vorlage.erfolg,
    '',
    vorlage.gruss,
    vorlage.absender,
  ];
  return {
    betreff: fuellen(vorlage.betreff, { wohnung: wohnung ?? vorlage.wohnungOhne }),
    text: z.join('\n'),
  };
}

/** VS16 als Regel, für Test und Prüfkatalog: was die Mail enthalten muss und was nie. */
export function absageBefunde(text: string): string[] {
  const out: string[] = [];
  if (!/vergeben/.test(text) || !/gelöscht|löschen/.test(text)) out.push('VS16-kern');
  const grund = text.match(
    /(?<![\p{L}])(weil|da |Einkommen|Bonität|Selbstauskunft|SCHUFA|andere Bewerber|anderen Bewerber|entschieden für|Grund)(?![\p{L}])/u,
  );
  if (grund) out.push(`VS16-grund:${grund[1]}`);
  if (!text.trimEnd().endsWith('[Ihr Name]')) out.push('VS16-absender');
  return out;
}

import woerter from '../../data/nachricht.de.json';
import type { Person } from './modell';
import { betragText, type Einziehend, type HaushaltsAngaben, type Schritt } from './selbstauskunft';

// Die Nachricht ans Inserat (design/nachricht-ans-inserat.md). Ein Abgleich von Wörtern auf dem Gerät. Die
// Wortlisten in data/nachricht.de.json sind die Bezugsfassung (25. Runde), jeder Fall steht mit Text und
// Erwartung in data/nachricht-faelle.de.json. Angaben zählen nur aus Sätzen, die etwas erbitten: „Haustiere
// nach Absprache“ ist eine Auskunft des Inserats und keine Frage.

export type AngabeId = 'adresse' | 'einzug' | 'personen' | 'beruf' | 'einkommen' | 'haustiere';
export type WegId = 'formular' | 'mail' | 'besichtigung' | 'mappe';

export const ANGABEN = woerter.angaben as {
  id: AngabeId;
  /** Die Zeile in der Nachricht, also ein Etikett. */
  text: string;
  /** So steht sie im Satz darunter („Mit …“, „Nach … fragt“); fehlt es, wie `text`. */
  imSatz?: string;
  schritt: Schritt;
  muster: string;
  /** Steht das im selben Satz, schließt das Inserat die Angabe aus: „Bitte keine Haustiere.“ */
  nicht?: string;
}[];
const FRAGE = new RegExp(woerter.frage);
const MAILADRESSE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

export interface Erkannt {
  angaben: AngabeId[];
  unzulaessig: string[];
  wege: WegId[];
  /** Die Mailadresse aus dem Text, wenn er eine nennt. */
  mail: string | null;
}

/**
 * Die Sätze, die etwas erbitten. Endet einer mit Doppelpunkt, gilt die Bitte auch für das, was folgt
 * („Bitte nennen Sie uns: Beruf, Einkommen.“), bis ein Satz zu Ende ist oder der Absatz.
 */
function erbeteneSaetze(klein: string): string[] {
  const treffer: string[] = [];
  for (const absatz of klein.split(/\n\s*\n/)) {
    let offen = false;
    for (const satz of absatz.split(/(?<=[.!?:;])\s+|\n+/)) {
      const bittet = FRAGE.test(satz);
      if (bittet || offen) treffer.push(satz);
      if (/[.!?]\s*$/.test(satz)) offen = false;
      else if (bittet && /:\s*$/.test(satz)) offen = true;
    }
  }
  return treffer;
}

export function erkennen(text: string): Erkannt {
  const roh = (text ?? '').trim();
  const t = roh.toLowerCase().replace(/\s+/g, ' ');
  const saetze = erbeteneSaetze(roh.toLowerCase());
  return {
    angaben: ANGABEN.filter((a) =>
      saetze.some((s) => new RegExp(a.muster).test(s) && !(a.nicht && new RegExp(a.nicht).test(s))),
    ).map((a) => a.id),
    unzulaessig: woerter.unzulaessig.filter((u) => new RegExp(u.muster).test(t)).map((u) => u.text),
    wege: woerter.wege.filter((w) => new RegExp(w.muster).test(t)).map((w) => w.id as WegId),
    mail: MAILADRESSE.exec(roh)?.[0] ?? null,
  };
}

/** Was Hefta zu jeder Angabe weiß. Wozu es nichts gibt, das fehlt: Hefta erfindet nichts. */
export function angabenWerte(
  person: Pick<
    Person,
    'kontakt' | 'beruf' | 'arbeitgeber' | 'nettoeinkommen' | 'selbstauskunft' | 'lebenssituation'
  >,
  wer: Einziehend,
  hh: HaushaltsAngaben,
  /** Das freiwillige Feld an der Bewerbung. */
  einzug?: string,
): Partial<Record<AngabeId, string>> {
  const werte: Partial<Record<AngabeId, string>> = {};
  const anschrift = person.kontakt.anschrift?.trim();
  if (anschrift) werte.adresse = anschrift;
  // Die Zeile heißt „Einzug ab“; ein „ab“ aus dem Feld stünde sonst doppelt da.
  const termin = einzug?.trim().replace(/^ab\s+/i, '');
  if (termin) werte.einzug = termin;
  const leute = [
    wer.erwachsene === 1 ? '1 Erwachsener' : `${wer.erwachsene} Erwachsene`,
    ...(wer.kinder ? [wer.kinder === 1 ? '1 Kind' : `${wer.kinder} Kinder`] : []),
  ];
  werte.personen = leute.join(', ');
  const beruf = person.beruf.trim();
  const arbeitgeber = person.arbeitgeber.trim();
  if (beruf || arbeitgeber)
    werte.beruf = [beruf, arbeitgeber && `bei ${arbeitgeber}`].filter(Boolean).join(' ');
  const betrag = betragText(person);
  if (betrag && person.lebenssituation !== 'leistungsbezug')
    werte.einkommen = `${betrag} netto im Monat`;
  if (hh.haustiere === 'ja') werte.haustiere = hh.haustiereText.trim() || 'ja';
  if (hh.haustiere === 'nein') werte.haustiere = 'keine';
  return werte;
}

/**
 * Mail mit fertigem Text. Einen Anhang kann so ein Link nicht tragen. Zeilenumbrüche als CRLF, wie RFC 6068
 * es für `mailto:` verlangt; sonst verlieren manche Mail-Apps die Absätze (PC8 A7).
 */
export function mailLink(an: string | null, betreff: string, text: string): string {
  const body = encodeURIComponent(text.replace(/\r?\n/g, '\r\n'));
  return `mailto:${an ?? ''}?subject=${encodeURIComponent(betreff)}&body=${body}`;
}

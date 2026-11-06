import { APP_NAME } from '../app/name';
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

export interface NachrichtAuftrag {
  name: string;
  telefon: string;
  mail: string;
  /** „Hauptstraße 12, 3. OG links“; ohne: „die angebotene Wohnung“. */
  wohnung: string;
  satz: string;
  /** Was mitgeht, mit Wert. */
  angaben: Partial<Record<AngabeId, string>>;
  mappe: boolean;
}

export function nachrichtText(a: NachrichtAuftrag): string {
  const z: string[] = ['Guten Tag,', ''];
  z.push(
    a.wohnung
      ? `ich interessiere mich für die Wohnung ${a.wohnung}.`
      : 'ich interessiere mich für die angebotene Wohnung.',
  );
  if (a.satz.trim()) z.push(a.satz.trim());
  const zeilen = ANGABEN.filter((x) => a.angaben[x.id]).map((x) => `${x.text}: ${a.angaben[x.id]}`);
  if (zeilen.length) z.push('', ...zeilen);
  z.push(
    '',
    a.mappe
      ? 'Meine Bewerbungsmappe mit Selbstauskunft und Nachweisen hängt an.'
      : 'Eine vollständige Bewerbungsmappe schicke ich gern, sobald Sie sie brauchen.',
    'Über einen Besichtigungstermin freue ich mich.',
    '',
    'Freundliche Grüße',
    a.name,
  );
  const kontakt = [a.telefon.trim(), a.mail.trim()].filter(Boolean).join(' · ');
  if (kontakt) z.push(kontakt);
  return z.join('\n');
}

/** Steckt in einem Punkt schon ein „und“, verbindet „sowie“: „Einzugstermin sowie Beruf und Arbeitgeber“. */
const aufzaehlen = (l: string[]) => {
  if (l.length < 2) return l[0] ?? '';
  const verbinder = l.some((x) => x.includes(' und ')) ? 'sowie' : 'und';
  return `${l.slice(0, -1).join(', ')} ${verbinder} ${l[l.length - 1]}`;
};
const imSatz = (id: AngabeId) => {
  const a = ANGABEN.find((x) => x.id === id)!;
  return a.imSatz ?? a.text;
};
const schrittVon = (id: AngabeId) => ANGABEN.find((a) => a.id === id)!.schritt;

/** Der eine Satz unter der Nachricht (PN3): sagt zu jeder Ergänzung, warum sie dasteht. */
export function erklaerung({
  mitText,
  gefragt,
  dabei,
  unzulaessig,
  mailImInserat,
  unterlagenGefragt,
}: {
  /** Ist überhaupt ein Inseratstext da? Ohne ihn sagt der Satz nichts über das Inserat. */
  mitText: boolean;
  gefragt: AngabeId[];
  dabei: AngabeId[];
  unzulaessig: string[];
  mailImInserat: boolean;
  unterlagenGefragt: boolean;
}): string {
  const s: string[] = [];
  if (dabei.length) {
    s.push(`Mit ${aufzaehlen(dabei.map(imSatz))}, weil das Inserat danach fragt.`);
    const spaet = dabei.filter((id) => schrittVon(id) !== 'besichtigung');
    if (spaet.length)
      s.push(
        `${spaet.length === 1 ? 'Das' : 'Diese Angaben'} sieht die Datenschutzkonferenz erst ab dem Mietwunsch vor; du gibst hier mehr als nötig.`,
      );
  } else {
    s.push(
      mitText && !gefragt.length
        ? 'Name und Telefon genügen für die erste Nachricht. Mehr verlangt das Inserat nicht.'
        : 'Name und Telefon genügen für die erste Nachricht.',
    );
  }
  const fehlend = gefragt.filter((id) => !dabei.includes(id));
  if (fehlend.length)
    s.push(
      `Nach ${aufzaehlen(fehlend.map(imSatz))} fragt das Inserat auch; das steht nicht in der Nachricht.`,
    );
  if (unzulaessig.length)
    s.push(
      `Nicht dabei: ${aufzaehlen(unzulaessig)}. Diese Fragen halten die Datenschutzbehörden für unzulässig, und ${APP_NAME} fragt sie nicht ab.`,
    );
  if (mailImInserat)
    s.push('Das Inserat nennt eine Mailadresse; dort kannst du die Mappe gleich anhängen.');
  else if (unterlagenGefragt)
    s.push('Das Inserat fragt nach Unterlagen; du kannst die Mappe anhängen.');
  return s.join(' ');
}

/** Mail mit fertigem Text. Einen Anhang kann so ein Link nicht tragen. */
export function mailLink(an: string | null, betreff: string, text: string): string {
  return `mailto:${an ?? ''}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
}

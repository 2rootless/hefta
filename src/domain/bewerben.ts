// Bewerben in einer Minute (Zeile 8, Konzept Hefta 2 Abschnitt 4, B12a, B16, B23 `s=bewerben`): Weg,
// Anrede, Anschreiben und was das Inserat wissen will. Hefta verschickt nichts selbst; es legt bereit,
// was hinausgeht, und merkt sich den Weg. Reine Rechnung; die Oberfläche steht in BewerbenSeite.svelte.
import { erkennen } from './nachricht';
import type { HeftAngaben } from './modell';

export type BewerbungsWeg = 'portal' | 'mail' | 'website';

/**
 * Welcher Weg vorgewählt ist: Nennt das Inserat eine Mailadresse, die Mail; kam das Heft aus einem Portal,
 * das Portal; sonst die Mail. Die Website nie (PC8 A8): Hefta kennt keine eigene Website des Anbieters,
 * „Website öffnen“ führte nur zum Inserat. Gewählt werden kann sie weiter von Hand.
 */
export function wegVorschlag(o: {
  inseratText: string | null;
  angaben: Pick<HeftAngaben, 'portal'> | undefined;
}): BewerbungsWeg {
  const e = erkennen(o.inseratText ?? '');
  if (e.mail) return 'mail';
  if (o.angaben?.portal) return 'portal';
  return 'mail';
}

/** Anrede aus dem Namen im Inserat, wenn einer da ist („Frau Hansen“); sonst eine neutrale. */
export function anrede(anbieter: string | null | undefined): string {
  const name = (anbieter ?? '').trim().replace(/\s+/g, ' ');
  const m =
    /^(Frau|Herr|Herrn)\s+((?:Dr\.\s+)?[A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+)?)$/u.exec(name);
  if (!m) return 'Sehr geehrte Damen und Herren,';
  return m[1] === 'Frau' ? `Sehr geehrte Frau ${m[2]},` : `Sehr geehrter Herr ${m[2]},`;
}

/**
 * „in der Lindenallee 3“, „im Eppendorfer Weg 211“: die Präposition nach dem Geschlecht des Straßennamens.
 * Beginnt der Name schon mit einer („Am Markt 4“), bleibt er, wie er ist. Ist das Geschlecht unbekannt
 * oder steht ein gebeugtes Adjektiv davor („Lange Reihe“ hieße „in der Langen Reihe“), gibt es keine:
 * Dann steht „die Wohnung Lange Reihe 5“, ungelenk, aber nie falsch.
 */
export function inDerStrasse(strasse: string): string {
  const s = strasse.trim();
  if (!s) return '';
  const name = s.replace(/\s+\d+\s*[a-z]?(?:[-–/]\d+\s*[a-z]?)?(?:,.*)?$/i, '').trim();
  const letztes = name.split(/[\s-]/).pop()?.toLowerCase() ?? '';
  const weiblich =
    /(straße|strasse|str\.|allee|gasse|chaussee|promenade|zeile|twiete|aue|reihe|koppel|brücke|höhe)$/;
  const maennlich =
    /(weg|ring|damm|platz|stieg|steig|kamp|deich|wall|markt|graben|berg|hof|pfad|gang|park|kai|winkel|grund)$/;
  if (
    /^(am|an der|an den|auf der|auf dem|im|in der|zum|zur|beim|hinter der|hinter dem|unter den)\b/i.test(
      name,
    )
  )
    return s;
  // Ein Wort davor, das auf „e“ endet, ist ein Adjektiv, das sich beugen müsste.
  const davor = name.split(/\s+/).slice(0, -1);
  if (davor.some((w) => /e$/i.test(w))) return '';
  if (weiblich.test(letztes)) return `in der ${s}`;
  if (maennlich.test(letztes)) return `im ${s}`;
  return '';
}

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** „1. Januar“ aus „JJJJ-MM-TT“; ein anderes Jahr als dieses kommt dazu. */
export function einzugText(tag: string, heute: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if (!m) return tag.trim();
  const [, j, mo, t] = m;
  const jahr = Number(j) !== heute.getFullYear() ? ` ${j}` : '';
  return `${Number(t)}. ${MONATE[Number(mo) - 1]}${jahr}`;
}

export interface AnschreibenAuftrag {
  /** Mehrere im Mietvertrag oder ohne Haushalt: „wir“ (E74, E83). */
  wir: boolean;
  anbieter: string | null | undefined;
  /** Erste Zeile der Adresse des Hefts. */
  strasse: string;
  /** „JJJJ-MM-TT“ oder freier Text; leer: kein Satz zum Einzug. */
  einzug: string;
  heute: Date;
}

/** Das Anschreiben nach B23 (`s=bewerben`), ohne Gruß und Unterschrift. */
export function anschreibenText(a: AnschreibenAuftrag): { anrede: string; text: string } {
  const wo = a.strasse.trim() ? inDerStrasse(a.strasse) : '';
  const wohnung = wo
    ? `um die Wohnung ${wo}`
    : a.strasse.trim()
      ? `um die Wohnung ${a.strasse.trim()}`
      : 'um die Wohnung';
  const saetze = [
    a.wir ? `wir möchten uns ${wohnung} bewerben.` : `ich möchte mich ${wohnung} bewerben.`,
  ];
  if (a.einzug.trim()) {
    const wann = einzugText(a.einzug, a.heute);
    saetze.push(a.wir ? `Wir können zum ${wann} einziehen.` : `Ich kann zum ${wann} einziehen.`);
  }
  saetze.push(
    a.wir
      ? 'Unsere Mappe mit allen Unterlagen, die Sie verlangen, liegt bei.'
      : 'Meine Mappe mit allen Unterlagen, die Sie verlangen, liegt bei.',
  );
  return { anrede: anrede(a.anbieter), text: saetze.join(' ') };
}

export interface NachrichtAuftrag {
  /** Mehrere im Mietvertrag oder ohne Haushalt: „wir“ (E74, E83). */
  wir: boolean;
  anbieter: string | null | undefined;
  /** Erste Zeile der Adresse des Hefts. */
  strasse: string;
  /** Wann die Bewerbung hinausging; ohne Datum ohne „am …“. */
  beworbenAm: string | null;
  /** Für den Gruß, etwa „Max Mustermann“; leer: nur „Freundliche Grüße“. */
  namen: string[];
  heute: Date;
}

function wohnungUndDatum(a: NachrichtAuftrag): { wohnung: string; am: string } {
  const s = a.strasse.trim();
  const wohnung = s ? `die Wohnung ${inDerStrasse(s) || s}` : 'Ihre Wohnung';
  const am = a.beworbenAm ? `am ${einzugText(a.beworbenAm.slice(0, 10), a.heute)} ` : '';
  return { wohnung, am };
}

function gruss(namen: string[]): string {
  const n = namen.filter(Boolean);
  const liste = n.length < 2 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} und ${n.at(-1)}`;
  return liste ? `Freundliche Grüße\n${liste}` : 'Freundliche Grüße';
}

/** Löschbitte nach B18 (`s=loeschbitte`): kurz und freundlich, der Nutzer schickt sie selbst. */
export function loeschbitteText(a: NachrichtAuftrag): { betreff: string; text: string } {
  const { wohnung, am } = wohnungUndDatum(a);
  const satz = a.wir
    ? `wir haben uns ${am}um ${wohnung} beworben. Da wir sie nicht mehr suchen, bitten wir Sie, unsere Unterlagen zu löschen, auch Ausdrucke und Anhänge.`
    : `ich habe mich ${am}um ${wohnung} beworben. Da ich sie nicht mehr suche, bitte ich Sie, meine Unterlagen zu löschen, auch Ausdrucke und Anhänge.`;
  return {
    betreff: a.wir ? 'Bitte um Löschung unserer Unterlagen' : 'Bitte um Löschung meiner Unterlagen',
    text: `${anrede(a.anbieter)}\n\n${satz}\n\n${gruss(a.namen)}`,
  };
}

/** Kurz nachfragen nach B18 (`s=nachfassen`), wenn lange keine Antwort kam. */
export function nachfassText(a: NachrichtAuftrag): { betreff: string; text: string } {
  const { wohnung, am } = wohnungUndDatum(a);
  // Nach der Anrede mit Komma beginnt der Brief klein (B18: „am 15. Oktober haben wir …“).
  const satz = a.wir
    ? `${am ? `${am}haben wir` : 'wir haben'} uns um ${wohnung} beworben. Ist sie noch zu haben? Wir würden sie uns gern ansehen.`
    : `${am ? `${am}habe ich` : 'ich habe'} mich um ${wohnung} beworben. Ist sie noch zu haben? Ich würde sie mir gern ansehen.`;
  const s = a.strasse.trim();
  return {
    betreff: s ? `Nachfrage zur Wohnung ${s}` : 'Nachfrage zur Wohnung',
    text: `${anrede(a.anbieter)}\n\n${satz}\n\n${gruss(a.namen)}`,
  };
}

const ZAHL = [
  '',
  'Eine',
  'Zwei',
  'Drei',
  'Vier',
  'Fünf',
  'Sechs',
  'Sieben',
  'Acht',
  'Neun',
  'Zehn',
];
const zahl = (n: number) => ZAHL[n] ?? String(n);
const klein = (w: string) => w.charAt(0).toLowerCase() + w.slice(1);

/**
 * „Wer einzieht“ in der Kurzform (E25, B23): „Eine Person im Mietvertrag.“, „Zwei im Mietvertrag, ein
 * Kind zieht mit ein. Eine Person bürgt.“
 */
export function werZiehtEin(o: {
  vertrag: number;
  kinder: number;
  weitere: number;
  buergen: number;
}): string {
  const teile = [
    o.vertrag === 1 ? 'Eine Person im Mietvertrag' : `${zahl(o.vertrag)} im Mietvertrag`,
  ];
  if (o.weitere)
    teile.push(
      o.weitere === 1
        ? 'eine weitere Person zieht mit ein'
        : `${klein(zahl(o.weitere))} weitere Personen ziehen mit ein`,
    );
  if (o.kinder)
    teile.push(
      o.kinder === 1 ? 'ein Kind zieht mit ein' : `${klein(zahl(o.kinder))} Kinder ziehen mit ein`,
    );
  let satz = `${teile.join(', ')}.`;
  if (o.buergen)
    satz += o.buergen === 1 ? ' Eine Person bürgt.' : ` ${zahl(o.buergen)} Personen bürgen.`;
  return satz;
}

/** Der ganze Text für Mail und Portal: Anrede, Anschreiben, die Angaben, Gruß und Kontakt. */
export function bewerbungsText(o: {
  anrede: string;
  text: string;
  angaben: { label: string; wert: string }[];
  name: string;
  telefon: string;
  mail: string;
}): string {
  const z = [o.anrede, '', o.text];
  if (o.angaben.length) z.push('', ...o.angaben.map((a) => `${a.label}: ${a.wert}`));
  z.push('', 'Mit freundlichen Grüßen', o.name.trim());
  const kontakt = [o.telefon.trim(), o.mail.trim()].filter(Boolean).join(' · ');
  if (kontakt) z.push(kontakt);
  return z.join('\n').trim();
}

// Bewerben in einer Minute (Zeile 8, Konzept Hefta 2 Abschnitt 4, B12a, B16, B23 `s=bewerben`): Weg,
// Anrede, Anschreiben und was das Inserat wissen will. Hefta verschickt nichts selbst; es legt bereit,
// was hinausgeht, und merkt sich den Weg. Reine Rechnung; die Oberfläche steht in BewerbenSeite.svelte.
import pools from '../../data/satzpools.de.json';
import { erkennen } from './nachricht';
import type { HeftAngaben } from './modell';
import { streuung } from './streuung';

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
 * „im Lindenring 3“, „am Musterplatz 1“: die Präposition nach dem Grundwort des Straßennamens.
 * Beginnt der Name schon mit einer („Am Markt 4“), bleibt er, wie er ist. Ist das Grundwort unbekannt
 * oder steht ein gebeugtes Adjektiv davor („Lange Reihe“ hieße „in der Langen Reihe“), gibt es keine:
 * Dann steht „die Wohnung Lange Reihe 5“, ungelenk, aber nie falsch.
 * PC120 (§8, 5): An einem Platz, Markt, Kai, Ufer, Hang, Damm, Wall, Deich, Berg, Graben, Stieg oder Steig
 * wohnt man „am“, an einer Brücke „an der“; „im“ bleibt für Weg, Ring, Hof und die übrigen.
 */
export function inDerStrasse(strasse: string): string {
  const s = strasse.trim();
  if (!s) return '';
  const name = s.replace(/\s+\d+\s*[a-z]?(?:[-–/]\d+\s*[a-z]?)?(?:,.*)?$/i, '').trim();
  const letztes = name.split(/[\s-]/).pop()?.toLowerCase() ?? '';
  const weiblich =
    /(straße|strasse|str\.|allee|gasse|chaussee|promenade|zeile|twiete|aue|reihe|koppel|höhe)$/;
  const anDer = /brücke$/;
  const am = /(platz|markt|kai|ufer|hang|damm|wall|deich|berg|graben|stieg|steig)$/;
  const im = /(weg|ring|kamp|hof|pfad|gang|park|winkel|grund)$/;
  if (
    /^(am|an der|an den|auf der|auf dem|im|in der|zum|zur|beim|hinter der|hinter dem|unter den)\b/i.test(
      name,
    )
  )
    return s;
  // Ein Wort davor, das auf „e“ endet, ist ein Adjektiv, das sich beugen müsste.
  const davor = name.split(/\s+/).slice(0, -1);
  if (davor.some((w) => /e$/i.test(w))) return '';
  if (anDer.test(letztes)) return `an der ${s}`;
  if (weiblich.test(letztes)) return `in der ${s}`;
  if (am.test(letztes)) return `am ${s}`;
  if (im.test(letztes)) return `im ${s}`;
  return '';
}

/**
 * „für den Lindenring 3“, „für die Beispielstraße 1“ (DP50, Zusage): der Artikel nach dem Geschlecht des
 * Straßennamens, wie bei `inDerStrasse`. Ist es unbekannt, steht „für die Wohnung Lange Reihe 5“.
 */
export function fuerDieStrasse(strasse: string): string {
  const s = strasse.trim();
  if (!s) return '';
  const wo = inDerStrasse(s);
  if (wo.startsWith('in der ')) return `für die ${s}`;
  if (wo.startsWith('im ')) return `für den ${s}`;
  return `für die Wohnung ${s}`;
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
  /**
   * PC81 A1: Nur per Mail liegt die Mappe bei. Über ein Portal oder eine Website geht keine Datei mit; dann
   * bietet der Satz die Mappe an, sobald der Vermieter eine Mailadresse nennt.
   */
  weg: BewerbungsWeg;
  /** PC126 K5: Die Mappe hat eine eigene Auswahl, etwa nach „Diesmal weglassen“. */
  eigeneAuswahl?: boolean;
  /** W37: Kennung des Hefts, daraus die Fassung je Baustein. Ohne Kennung die Fassung von Release 2.0. */
  heftId?: string;
  /** W37: „Andere Fassung“ zählt alle Bausteine eins weiter. */
  versatz?: number;
  /** W37 (W10): Der Einstieg „Ihr Inserat gesehen“ steht nur, wenn das Heft ein Inserat hat. */
  inserat?: boolean;
  /** Feste Nummern je Baustein statt der gestreuten; so prüfen die Tests jede Verbindung. */
  nummern?: Partial<Record<Baustein, number>>;
}

export type Baustein = 'anrede' | 'einstieg' | 'einzug' | 'schluss' | 'gruss';

/** Das Anschreiben aus Bausteinen (W37): Rahmen wechselt je Heft, der Kern bleibt wörtlich. */
export interface AnschreibenTeile {
  anrede: string;
  /** Einstieg, Einzug (nur mit Datum) und der Satz zur Mappe (Kern). */
  text: string;
  /** Schluss vor dem Gruß; leer: keiner, wie in Release 2.0. */
  schluss: string;
  gruss: string;
}

type WirIch = { wir: string; ich: string };
const BAUSTEINE = pools.anschreiben.bausteine;
const KERN = pools.anschreiben.kern;

/** Nummer eines Bausteins: aus der Kennung des Hefts gestreut, „Andere Fassung“ zählt eins weiter. */
function bausteinNr(a: AnschreibenAuftrag, baustein: Baustein, n: number): number {
  const fest = a.nummern?.[baustein];
  if (fest !== undefined) return fest % n;
  if (!a.heftId) return (a.versatz ?? 0) % n;
  return (streuung(`${a.heftId}|${baustein}`) + (a.versatz ?? 0)) % n;
}

/** „Frau Hansen“ → Art und Name; ohne erkennbare Anrede null (dann „Damen und Herren“ oder „Guten Tag,“). */
function anbieterName(anbieter: string | null | undefined): { frau: boolean; name: string } | null {
  const name = (anbieter ?? '').trim().replace(/\s+/g, ' ');
  const m =
    /^(Frau|Herr|Herrn)\s+((?:Dr\.\s+)?[A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+)?)$/u.exec(name);
  return m ? { frau: m[1] === 'Frau', name: m[2]! } : null;
}

/** Das Anschreiben nach B23 (`s=bewerben`), mit Bausteinen nach W37 (DP68, Endfassung PC94). */
export function anschreibenText(a: AnschreibenAuftrag): AnschreibenTeile {
  // Steht in der ersten Zeile nur Postleitzahl und Ort, nennt der Brief keinen Ort (DP68, Teil C).
  const s = /^\d{5}\s/.test(a.strasse.trim()) ? '' : a.strasse.trim();
  const wo = s ? inDerStrasse(s) : '';
  const ort = wo || s;
  const um = ort ? `um die Wohnung ${ort}` : 'um die Wohnung';
  const die = ort ? `die Wohnung ${ort}` : 'Ihre Wohnung';
  const form = (b: WirIch) => (a.wir ? b.wir : b.ich);

  // Anrede: zwei Formen je Fall; „Sehr geehrte …“ oder „Guten Tag …“ bestimmt die passenden Grüße.
  const person = anbieterName(a.anbieter);
  const anreden = person ? BAUSTEINE.anrede.mit_namen : BAUSTEINE.anrede.ohne_namen;
  const anredeNr = bausteinNr(a, 'anrede', anreden.length);
  const anredeText = person
    ? anreden[anredeNr]!.split(' / ')[person.frau ? 0 : 1]!.replace('{name}', person.name)
    : anreden[anredeNr]!;
  const gruesse =
    pools.anschreiben.gruss_zur_anrede[
      anredeText.startsWith('Sehr geehrte') ? 'Sehr geehrte …' : 'Guten Tag …'
    ];

  const einstiege = BAUSTEINE.einstieg.filter((e) => a.inserat || !('nur_wenn' in e));
  const saetze = [
    form(einstiege[bausteinNr(a, 'einstieg', einstiege.length)]!)
      .replace('{um}', um)
      .replace('{die}', die),
  ];
  if (a.einzug.trim()) {
    const wann = einzugText(a.einzug, a.heute);
    saetze.push(
      form(BAUSTEINE.einzug[bausteinNr(a, 'einzug', BAUSTEINE.einzug.length)]!).replace(
        '{datum}',
        wann,
      ),
    );
  }
  // Kern, wörtlich (A1): Nur per Mail liegt die Mappe bei.
  const kern = form(a.weg === 'mail' ? KERN.mappe.mail : KERN.mappe.portal_und_website);
  // PC126 K5 (DP83 a, W10): Mit „Eigener Auswahl“ liegen nicht die üblichen Unterlagen bei; dann sagt der Satz es nicht.
  saetze.push(a.eigeneAuswahl ? kern.replace(' mit den üblichen Unterlagen', '') : kern);
  return {
    anrede: anredeText,
    text: saetze.join(' '),
    schluss: form(BAUSTEINE.schluss[bausteinNr(a, 'schluss', BAUSTEINE.schluss.length)]!),
    gruss: gruesse[bausteinNr(a, 'gruss', gruesse.length)]!,
  };
}

/**
 * Wie die Wohnung im Betreff heißt (DP68 Teil C, PD101 U2, W10): die Straße, wie sie im Heft steht; ohne Straße
 * „in“ und der Ort; ohne beides leer. Steht in der ersten Zeile nur Postleitzahl und Ort, ist das der Ort.
 */
export function betreffWohnung(strasse: string, ort: string): string {
  const s = strasse.trim();
  const plzOrt = /^\d{5}\s+(.+)$/.exec(s);
  if (s && !plzOrt) return s;
  const o = (plzOrt?.[1] ?? ort).trim();
  return o ? `in ${o}` : '';
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
  /** W37 (PD101 U2): Ort für den Betreff, wenn das Heft keine Straße kennt. */
  ort?: string;
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

/**
 * Löschbitte nach B18 (`s=loeschbitte`): kurz und freundlich, der Nutzer schickt sie selbst.
 * PC92 K4 (DP66 U1, E192): Der Satz mit dem Datum bleibt; danach „Unsere Bewerbung ist erledigt. Bitte löschen
 * Sie unsere Unterlagen, auch Ausdrucke und Anhänge.“ Allein steht dasselbe mit „Meine“ und „meine“.
 */
export function loeschbitteText(a: NachrichtAuftrag): { betreff: string; text: string } {
  const { wohnung, am } = wohnungUndDatum(a);
  const satz = a.wir
    ? `wir haben uns ${am}um ${wohnung} beworben. Unsere Bewerbung ist erledigt. Bitte löschen Sie unsere Unterlagen, auch Ausdrucke und Anhänge.`
    : `ich habe mich ${am}um ${wohnung} beworben. Meine Bewerbung ist erledigt. Bitte löschen Sie meine Unterlagen, auch Ausdrucke und Anhänge.`;
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
  const imBetreff = betreffWohnung(a.strasse, a.ort ?? '');
  return {
    betreff: imBetreff ? `Nachfrage zur Wohnung ${imBetreff}` : 'Nachfrage zur Wohnung',
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

/**
 * PC92 K3 (DP66, E192): Jede Angabe-Zeile endet mit Punkt („Haustiere: keine.“). Zieht Gmail die Absätze
 * zusammen, bleiben die Angaben so trotzdem Sätze. Steht schon ein Satzzeichen am Ende, kommt keins dazu.
 */
export function angabeZeile(a: { label: string; wert: string }): string {
  const wert = a.wert.trim();
  return `${a.label}: ${wert}${/[.!?…]$/.test(wert) ? '' : '.'}`;
}

/**
 * Der ganze Text für Mail und Portal: Anrede, Anschreiben, die Angaben, Schluss, Gruß und Kontakt; zwischen den
 * Teilen eine Leerzeile (DP68, Teil C). Ohne Schluss fällt sein Absatz ganz weg.
 */
export function bewerbungsText(o: {
  anrede: string;
  text: string;
  angaben: { label: string; wert: string }[];
  name: string;
  telefon: string;
  mail: string;
  /** W37: Schluss vor dem Gruß; leer oder fehlend: keiner. */
  schluss?: string;
  /** W37: Gruß; fehlt er, der von Release 2.0. */
  gruss?: string;
}): string {
  const z = [o.anrede, '', o.text];
  if (o.angaben.length) z.push('', ...o.angaben.map(angabeZeile));
  if (o.schluss?.trim()) z.push('', o.schluss.trim());
  z.push('', o.gruss ?? 'Mit freundlichen Grüßen', o.name.trim());
  // 2.1.1 (PC191): Telefon und Mail je in einer eigenen Zeile, nicht mehr mit „·“ in einer.
  for (const k of [o.telefon.trim(), o.mail.trim()]) if (k) z.push(k);
  return z.join('\n').trim();
}

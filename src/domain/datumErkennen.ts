// Datum und Abrechnungsmonat im Text eines PDFs finden (nur auf dem Gerät, nur Vorschläge): Was
// Hefta findet, trägt sie vor und man kann es ändern. Bei gescannten Seiten gibt es keinen Text,
// dann findet sie nichts. Rechnet ohne Browser-APIs, damit es testbar ist.

/** Ein Textstück einer Seite, Lage relativ zur Seite (0 bis 1), y von oben. */
export interface TextStueck {
  text: string;
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

export interface DatumFund {
  /** Kalendertag „JJJJ-MM-TT“. */
  tag: string;
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  /** Die ganze Zeile, zum Einordnen („Ausgestellt am …“, „geboren am …“). */
  zeile: string;
  /** Die Wörter direkt davor, zum Anzeigen („Ausgestellt am“, „Kundin seit“). */
  davor: string;
}

const MONATE: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};
const MONATSWORT = Object.keys(MONATE).join('|');

interface Zeile {
  text: string;
  /** Für jedes Zeichen der Zeile: aus welchem Stück es kommt und wo darin. */
  herkunft: { stueck: TextStueck; stelle: number }[];
}

/** Stücke zu Zeilen: PDFs zerlegen Text oft mitten im Datum („20.“, „Oktober“, „2026“). */
export function zeilenAus(stuecke: TextStueck[]): Zeile[] {
  const gefuellt = stuecke
    .filter((s) => s.text.trim())
    .sort((a, b) => a.y + a.hoehe / 2 - (b.y + b.hoehe / 2) || a.x - b.x);
  const gruppen: TextStueck[][] = [];
  for (const s of gefuellt) {
    const letzte = gruppen.at(-1);
    const bezug = letzte?.[0];
    if (
      letzte &&
      bezug &&
      Math.abs(s.y + s.hoehe / 2 - (bezug.y + bezug.hoehe / 2)) < bezug.hoehe / 2
    )
      letzte.push(s);
    else gruppen.push([s]);
  }
  return gruppen.map((gruppe) => {
    gruppe.sort((a, b) => a.x - b.x);
    let text = '';
    const herkunft: Zeile['herkunft'] = [];
    gruppe.forEach((s, i) => {
      const vorher = gruppe[i - 1];
      if (vorher && s.x - (vorher.x + vorher.breite) > s.hoehe * 0.15 && !text.endsWith(' ')) {
        text += ' ';
        herkunft.push({ stueck: s, stelle: 0 });
      }
      for (let k = 0; k < s.text.length; k++) {
        text += s.text[k];
        herkunft.push({ stueck: s, stelle: k });
      }
    });
    return { text, herkunft };
  });
}

function tagAus(jahr: number, monat: number, tag: number): string | null {
  const d = new Date(jahr, monat - 1, tag);
  if (d.getFullYear() !== jahr || d.getMonth() !== monat - 1 || d.getDate() !== tag) return null;
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${jahr}-${zwei(monat)}-${zwei(tag)}`;
}

function jahrAus(text: string): number {
  const j = Number(text);
  return text.length === 2 ? 2000 + j : j;
}

/** Höchstens drei Wörter vor dem Datum, bis zum letzten Satzzeichen oder Datum in der Zeile. */
function wortDavor(zeile: string, start: number): string {
  const davor = zeile.slice(0, start).replace(/[\s:,;(–-]+$/, '');
  const stueck = davor.split(/[,;:()]|\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}/).at(-1) ?? '';
  return stueck.trim().split(/\s+/).filter(Boolean).slice(-3).join(' ');
}

/** Für die Auswahl (D11b): je Tag der erste Fund in Reihenfolge des Dokuments, höchstens acht. */
export function datenZurAuswahl<T extends DatumFund>(funde: T[]): T[] {
  const tage = new Set<string>();
  return funde
    .filter((f) => {
      if (tage.has(f.tag)) return false;
      tage.add(f.tag);
      return true;
    })
    .slice(0, 8);
}

/** Alle Daten einer Seite: echte Kalendertage, nicht in der Zukunft, nicht vor 2000. */
export function datenFinden(stuecke: TextStueck[], heute: Date = new Date()): DatumFund[] {
  const muster: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [
      /(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?![\d.]*\d)/g,
      (m) => tagAus(jahrAus(m[3]!), Number(m[2]), Number(m[1])),
    ],
    [
      new RegExp(`(?<!\\d)(\\d{1,2})\\.?\\s*(${MONATSWORT})\\.?\\s*(\\d{4})(?!\\d)`, 'gi'),
      (m) => tagAus(Number(m[3]), MONATE[m[2]!.toLowerCase()]!, Number(m[1])),
    ],
    [
      /(?<!\d)(20\d\d)-(\d{2})-(\d{2})(?!\d)/g,
      (m) => tagAus(Number(m[1]), Number(m[2]), Number(m[3])),
    ],
  ];
  const grenze = tagAus(heute.getFullYear(), heute.getMonth() + 1, heute.getDate())!;
  const funde: DatumFund[] = [];
  for (const zeile of zeilenAus(stuecke))
    for (const [regel, lesen] of muster)
      for (const m of zeile.text.matchAll(regel)) {
        const tag = lesen(m);
        if (!tag || tag > grenze || tag < '2000-01-01') continue;
        const start = m.index;
        const ende = start + m[0].length - 1;
        const a = zeile.herkunft[start]!;
        const b = zeile.herkunft[ende]!;
        const anteil = (h: Zeile['herkunft'][number], plus: number) =>
          h.stueck.x + (h.stueck.breite * (h.stelle + plus)) / Math.max(1, h.stueck.text.length);
        const links = anteil(a, 0);
        funde.push({
          tag,
          x: links,
          y: Math.min(a.stueck.y, b.stueck.y),
          breite: Math.max(anteil(b, 1) - links, 0.02),
          hoehe: Math.max(a.stueck.hoehe, b.stueck.hoehe),
          zeile: zeile.text,
          davor: wortDavor(zeile.text, start),
        });
      }
  return funde;
}

const STICHWORT = /ausgestellt|ausstellung|erstellt|bescheid|datum|stand|vom\b/i;
const NICHT = /geb\.|geboren|geburt|gültig bis|fällig|zahlbar|kündig/i;

/**
 * Der wahrscheinlichste Ausstellungstag: der neueste Tag in einer Zeile mit passendem Wort, sonst
 * das einzige Datum überhaupt. Bleibt es unklar, schlägt Hefta lieber nichts vor.
 */
export function ausstellungstag(funde: (DatumFund & { seite: number })[]): {
  tag: string;
  seite: number;
} | null {
  const moeglich = funde.filter((f) => !NICHT.test(f.zeile));
  const neuester = (liste: typeof moeglich) =>
    [...liste].sort((a, b) => b.tag.localeCompare(a.tag))[0];
  const mitWort = neuester(moeglich.filter((f) => STICHWORT.test(f.zeile)));
  if (mitWort) return { tag: mitWort.tag, seite: mitWort.seite };
  const tage = new Set(moeglich.map((f) => f.tag));
  const einziger = moeglich[0];
  return tage.size === 1 && einziger ? { tag: einziger.tag, seite: einziger.seite } : null;
}

const ABRECHNUNG = /abrechnung|entgelt|gehalt|lohn|verdienst|bezüge|monat|zeitraum|periode/i;
const STARK =
  /abrechnungs(monat|zeitraum|periode)|lohnmonat|entgeltmonat|für\s+(den\s+)?monat|gehaltsabrechnung|lohnabrechnung|verdienstabrechnung|entgeltabrechnung|zeitraum/i;
// Hier steht ein Monat, aber nicht der abgerechnete: Das Gehalt für August kommt im September.
const NICHT_MONAT =
  /auszahl|überweis|ueberweis|zahlbar|fällig|wertstellung|erstellt|gedruckt|druckdatum|eintritt|austritt|geb\.|geboren|gültig|kündig|seit\b|stand\b|jahres|kumuliert/i;

// Diese Monate sind auch Namen: „Jan Meier“, „Anna Mai“. Ohne jedes passende Wort zählen sie darum nicht
// neben einem anderen großgeschriebenen Wort.
const AUCH_NAME = /^(jan|märz|april|mai|juni|juli|august)$/i;

function vielleichtName(wort: string, davor: string, danach: string): boolean {
  return AUCH_NAME.test(wort) && (/\p{Lu}\p{L}+[\s,]+$/u.test(davor) || /^\s+\p{Lu}/u.test(danach));
}

/**
 * Abrechnungsmonat aus dem Text einer Seite: „Gehaltsabrechnung Oktober 2026“, „Monat 09/2026“,
 * „Aug 26“, „Zeitraum 01.08.2026 - 31.08.2026“. Zeilen mit passendem Wort zählen, stärkere mehr; ein
 * Monat, der nur neben „Auszahlung“ steht, zählt nicht. Bleibt es unentschieden, rät Hefta nicht.
 *
 * Zuletzt reicht auch ein Monat ganz allein auf der Seite, etwa „Aug (Nachzahlung)“. Für einen Vorschlag
 * beim Hochladen ist das genug, für einen Prüfhinweis nicht: Dort mit `auchAllein = false`.
 */
export function monatFinden(
  stuecke: TextStueck[],
  heute: Date = new Date(),
  auchAllein = true,
): string | null {
  const zwei = (n: number) => String(n).padStart(2, '0');
  const grenze = `${heute.getFullYear() + (heute.getMonth() === 11 ? 1 : 0)}-${zwei(((heute.getMonth() + 1) % 12) + 1)}`;
  const jahrZu = (monat: number) =>
    monat > heute.getMonth() + 1 ? heute.getFullYear() - 1 : heute.getFullYear();
  const monate: string[] = [];
  const allein: string[] = [];
  const punkte = new Map<string, number>();
  const monatswort = new RegExp(
    `(?<![\\p{L}\\d.])(${MONATSWORT})(?![\\p{L}\\d])(?:\\.?\\s*[-/.]?\\s*['’]?(20\\d\\d|\\d\\d)(?!\\d|[.,]\\d))?`,
    'giu',
  );
  // „Aug 26“ ist 2026; „Mai 12“ eher ein Tag oder eine Zahl als das Jahr 2012.
  const jahrAus = (text: string | undefined) => {
    if (!text) return null;
    const jahr = text.length === 4 ? Number(text) : 2000 + Number(text);
    return text.length === 4 || Math.abs(jahr - heute.getFullYear()) <= 2 ? jahr : null;
  };
  for (const { text } of zeilenAus(stuecke)) {
    const stark = STARK.test(text);
    const mitWort = stark || ABRECHNUNG.test(text);
    if (NICHT_MONAT.test(text) && !stark) continue;
    const treffer = [
      ...text.matchAll(/(?<![\d./-])(0?[1-9]|1[0-2])\s?[-/.]\s?(20\d\d)(?!\d)/g),
    ].map((m) => `${m[2]}-${zwei(Number(m[1]))}`);
    for (const m of text.matchAll(monatswort)) {
      const monat = MONATE[m[1]!.toLowerCase()]!;
      const jahr = jahrAus(m[2]);
      if (jahr) treffer.push(`${jahr}-${zwei(monat)}`);
      // Ohne Jahr nur neben einem passenden Wort sicher genug. Sonst merken, für ganz zuletzt.
      else if (mitWort) treffer.push(`${jahrZu(monat)}-${zwei(monat)}`);
      else {
        const davor = text.slice(0, m.index);
        const danach = text.slice(m.index + m[1]!.length);
        // „Hamburg, den 3. September“ ist der Tag, an dem jemand unterschrieben hat.
        if (!/\d\.?\s*$/.test(davor) && !vielleichtName(m[1]!, davor, danach))
          allein.push(`${jahrZu(monat)}-${zwei(monat)}`);
      }
    }
    if (mitWort) {
      for (const m of text.matchAll(/(?<![\d./])(0?[1-9]|1[0-2])\s?\/\s?(\d{2})(?!\d)/g))
        treffer.push(`20${m[2]}-${zwei(Number(m[1]))}`);
    }
    // „01.08.2026 - 31.08.2026“, auch „01.08. - 31.08.2026“: ein Zeitraum innerhalb eines Monats.
    for (const m of text.matchAll(
      /(?<![\d.])\d{1,2}\.\s?(\d{1,2})\.\s?(?:20\d\d|\d\d)?\s*(?:-|–|—|bis)\s*\d{1,2}\.\s?(\d{1,2})\.\s?(20\d\d|\d\d)(?!\d)/g,
    )) {
      if (m[1] !== m[2] && Number(m[1]) !== Number(m[2])) continue;
      const jahr = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
      const monat = `${jahr}-${zwei(Number(m[2]))}`;
      if (monat <= grenze) punkte.set(monat, (punkte.get(monat) ?? 0) + 3);
      treffer.push(monat);
    }
    const gueltig = treffer.filter((m) => m <= grenze);
    monate.push(...gueltig);
    if (!mitWort) continue;
    for (const m of new Set(gueltig)) punkte.set(m, (punkte.get(m) ?? 0) + (stark ? 4 : 2));
  }
  const rangliste = [...punkte].sort((a, b) => b[1] - a[1]);
  if (rangliste.length) {
    const [erster, zweiter] = rangliste;
    return zweiter && zweiter[1] === erster![1] ? null : erster![0];
  }
  const verschieden = [...new Set(monate)];
  if (verschieden.length || !auchAllein) return verschieden.length === 1 ? verschieden[0]! : null;
  const einzeln = [...new Set(allein)];
  return einzeln.length === 1 ? einzeln[0]! : null;
}

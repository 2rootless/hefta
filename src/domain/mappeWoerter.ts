// Wörter, die die PDF-Mappe selbst bildet: Monate einer Serie, „vom …“ und Zählungen. Eine Stelle für
// den Bau der Mappe und die Wortliste fürs Design (docs/wortliste-mappe.md), damit beide gleich bleiben.
// Die PDFs bleiben immer Deutsch, unabhängig von der Sprache der Oberfläche.

const NUR_MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' });
const MIT_JAHR = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const TAG = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const alsDatum = (tag: string) =>
  new Date(`${tag.length === 7 ? `${tag}-01` : tag}T00:00:00Z`);
const nurMonat = (m: string) => NUR_MONAT.format(alsDatum(m));
const mitJahr = (m: string) => MIT_JAHR.format(alsDatum(m));

/** „Juli bis September“, über einen Jahreswechsel mit Jahr; ein Monat: „Oktober“. */
export function monatsSpanne(monate: string[], jahr: boolean): string {
  const liste = [...monate].sort();
  const von = liste[0]!;
  const bis = liste.at(-1)!;
  if (von === bis) return jahr ? mitJahr(bis) : nurMonat(bis);
  const anders = von.slice(0, 4) !== bis.slice(0, 4);
  return `${anders ? mitJahr(von) : nurMonat(von)} bis ${jahr || anders ? mitJahr(bis) : nurMonat(bis)}`;
}

/** „vom 20. Oktober 2026“ für Unterlagen mit Datum. */
export const vomText = (tag: string) => `vom ${TAG.format(alsDatum(tag))}`;

/** „ein Kind“, „zwei weitere Personen“: Zahlen bis zwölf als Wort (T6). */
const ZAHLWORT = [
  '',
  '',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
];
export const menge = (n: number, eins: string, viele: string) =>
  n === 1 ? eins : `${ZAHLWORT[n] ?? n} ${viele}`;

const gross = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Kinder und weitere Personen ohne Vertrag, wie sie auf dem Deckblatt stehen. */
/** Wer ohne Mietvertrag mit einzieht, je Art gezählt (E25, Nachtrag n). */
export interface Mitziehend {
  text: string;
  anzahl: number;
  art: 'kind' | 'erwachsen';
}

export function mitziehendeTexte(kinder: number, weitere: number): Mitziehend[] {
  return [
    ...(kinder
      ? [{ text: gross(menge(kinder, 'ein Kind', 'Kinder')), anzahl: kinder, art: 'kind' as const }]
      : []),
    ...(weitere
      ? [
          {
            text: gross(menge(weitere, 'eine weitere Person', 'weitere Personen')),
            anzahl: weitere,
            art: 'erwachsen' as const,
          },
        ]
      : []),
  ];
}

// ---------- Wer ist dabei (E25, design/wer-ist-dabei.md) ----------
// Drei Gruppen nach dem Verhältnis zum Mietvertrag, immer in dieser Reihenfolge, nie eine Summe über
// die Gruppen. Gilt auf dem Deckblatt und in der App gleich; darum steht es hier an einer Stelle.

export const GRUPPE_VERTRAG = 'Im Mietvertrag';
export const GRUPPE_MIT = 'Ziehen mit ein';
export const GRUPPE_BUERGT = 'Bürgt';

export interface WerIstDabei {
  /** Namen der Personen im Mietvertrag. */
  vertrag: string[];
  kinder: number;
  weitere: number;
  /** Namen der Bürgen. */
  buergen: string[];
}

const ZAHL_GROSS = (n: number) => gross(ZAHLWORT[n] || String(n));

/** Kurzform aus den Einträgen, wie sie auf dem Deckblatt stehen („Ein Kind“, „Eine weitere Person“). */
export function werIstDabeiSatz(
  vertrag: number,
  mitziehende: Mitziehend[],
  buergen: number,
): string {
  const saetze: string[] = [];
  const mit = mitziehende.map((m) => m.text.charAt(0).toLowerCase() + m.text.slice(1));
  const einer = mitziehende.length === 1 && mitziehende[0]!.anzahl === 1;
  const mitTeil = mit.length ? `${mit.join(' und ')} ${einer ? 'zieht' : 'ziehen'} mit ein` : '';
  if (vertrag) {
    const v =
      vertrag === 1 ? 'Eine Person im Mietvertrag' : `${ZAHL_GROSS(vertrag)} im Mietvertrag`;
    saetze.push(`${v}${mitTeil ? `, ${mitTeil}` : ''}.`);
  } else if (mitTeil) saetze.push(`${gross(mitTeil)}.`);
  if (buergen)
    saetze.push(buergen === 1 ? 'Eine Person bürgt.' : `${ZAHL_GROSS(buergen)} Personen bürgen.`);
  return saetze.join(' ');
}

/** Erste Zeile des Hinweises in der Übersicht (55): „Ein Kind und eine weitere Person ziehen mit ein“. */
export function mitEinSatz(kinder: number, weitere: number): string {
  const satz = werIstDabeiSatz(0, mitziehendeTexte(kinder, weitere), 0);
  return satz.endsWith('.') ? satz.slice(0, -1) : satz;
}

/** Kurzform als Satz: „Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.“ */
export function werIstDabeiKurz(
  w: Omit<WerIstDabei, 'vertrag' | 'buergen'> & {
    vertrag: number;
    buergen: number;
  },
): string {
  return werIstDabeiSatz(w.vertrag, mitziehendeTexte(w.kinder, w.weitere), w.buergen);
}

/**
 * E26, Ausnahme zu E25: Wo ein Formular nach der Zahl fragt, bleibt sie, mit den Gruppen in Klammern:
 * „Drei Personen ziehen ein (zwei im Mietvertrag, ein Kind)“. Bürgen zählen nicht mit.
 */
export function personenZiehenEin(w: { vertrag: number; kinder: number; weitere: number }): string {
  const gesamt = w.vertrag + w.kinder + w.weitere;
  if (gesamt <= 1) return 'Eine Person zieht ein';
  const teile = [
    ...(w.vertrag
      ? [
          w.vertrag === 1
            ? 'eine im Mietvertrag'
            : `${ZAHLWORT[w.vertrag] ?? w.vertrag} im Mietvertrag`,
        ]
      : []),
    ...mitziehendeTexte(w.kinder, w.weitere).map(
      (m) => m.text.charAt(0).toLowerCase() + m.text.slice(1),
    ),
  ];
  return `${ZAHL_GROSS(gesamt)} Personen ziehen ein (${teile.join(', ')})`;
}

/** Langform als Gruppen: Gruppenwort, darunter Namen oder Zählungen. Leere Gruppen fallen weg. */
export function werIstDabeiLang(w: WerIstDabei): { titel: string; eintraege: string[] }[] {
  return [
    { titel: GRUPPE_VERTRAG, eintraege: w.vertrag },
    { titel: GRUPPE_MIT, eintraege: mitziehendeTexte(w.kinder, w.weitere).map((m) => m.text) },
    { titel: GRUPPE_BUERGT, eintraege: w.buergen },
  ].filter((g) => g.eintraege.length);
}

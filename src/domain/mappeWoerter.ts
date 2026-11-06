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
export function mitziehendeTexte(
  kinder: number,
  weitere: number,
): { text: string; anzahl: number }[] {
  return [
    ...(kinder ? [{ text: gross(menge(kinder, 'ein Kind', 'Kinder')), anzahl: kinder }] : []),
    ...(weitere
      ? [
          {
            text: gross(menge(weitere, 'eine weitere Person', 'weitere Personen')),
            anzahl: weitere,
          },
        ]
      : []),
  ];
}

/** „1 Person“, „3 Personen“ neben „Wer einzieht“. */
export const personenZahl = (n: number) => (n === 1 ? '1 Person' : `${n} Personen`);

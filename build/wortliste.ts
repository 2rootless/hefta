import { readFileSync } from 'node:fs';
import katalogDaten from '../data/regelkatalog.de.json' with { type: 'json' };
import {
  mitziehendeTexte,
  personenZiehenEin,
  monatsSpanne,
  GRUPPE_BUERGT,
  GRUPPE_MIT,
  GRUPPE_VERTRAG,
  werIstDabeiKurz,
  vomText,
} from '../src/domain/mappeWoerter.ts';
import {
  eintragenText,
  listenText,
  ohneTrennstellen,
  type Dokumenttyp,
} from '../src/domain/regelkatalog.ts';

// Wortliste für das Design (Aufgabe 41): alle Bezeichnungen, die Deckblatt, Kopfzeile und Lesezeichen
// der Mappe drucken, mit der Stelle im Regelkatalog. Erzeugt aus dem Katalog und denselben Funktionen,
// mit denen die Mappe gebaut wird; build/wortliste.test.ts hält docs/wortliste-mappe.md aktuell.

export const WORTLISTE_DATEI = 'docs/wortliste-mappe.md';

interface Rolle {
  text: string;
  textWeiblich?: string;
  textNeutral?: string;
  textMehrzahl?: string;
  nurAnzahl?: boolean;
}
const katalog = katalogDaten as unknown as {
  rollen: Record<string, Rolle>;
  dokumenttypen: (Dokumenttyp & { varianten?: { id: string; text: string }[] })[];
  lebenssituationen: {
    studierend_azubi: { arten: Record<string, { text: string }> };
  };
};

const zelle = (t: string) => t.replaceAll('|', '\\|');
const code = (t: string) => `\`${t}\``;

/** Feste Wörter, die der Bau der Mappe selbst zeichnet: aus dem Quelltext gelesen, nicht abgeschrieben. */
export function festeWoerter(quelle: string): string[] {
  const woerter = new Set<string>();
  for (const [, wort] of quelle.matchAll(/\b(?:text|schrift)\(\s*'([^']+)'/g)) woerter.add(wort!);
  for (const [, wort] of quelle.matchAll(/\btitel: '([^']+)'/g)) woerter.add(wort!);
  for (const [, wort] of quelle.matchAll(/' · ([A-ZÄÖÜ][^']+)'/g)) woerter.add(wort!);
  // Die Zeile unter einem Eintrag auf dem Deckblatt, etwa „ohne Mietvertrag“.
  for (const [, wort] of quelle.matchAll(/\beintrag\([^)]*'([^']+)'\)/g)) woerter.add(wort!);
  return [...woerter].sort((a, b) => a.localeCompare(b, 'de'));
}

export function wortliste(): string {
  const z: string[] = [];
  z.push(
    '# Wortliste der Mappe',
    '',
    'Alle Bezeichnungen, die Deckblatt, Kopfzeile und Lesezeichen der PDF-Mappe drucken. Erzeugt aus `data/regelkatalog.de.json` und denselben Funktionen, mit denen die Mappe gebaut wird (`build/wortliste.ts`), nicht von Hand. Ein Test schlägt an, sobald die Liste nicht mehr stimmt; neu schreiben mit `npm run wortliste`.',
    '',
    'Wo ein Wort steht: **D** Deckblatt, **I** Inhalt auf dem Deckblatt, **K** Kopfzeile jeder Seite, **L** Lesezeichen, **F** Fußzeile.',
    '',
  );

  z.push('## Rollen', '');
  z.push(
    'Unter dem Namen auf dem Deckblatt (D), in der Kopfzeile als „Name · Rolle“ (K), im Lesezeichen als „Name (Rolle)“ (L). Bürgen tragen in der Kopfzeile „Bürgschaft“ statt der Rolle. Welche Form gilt, wählt die Person beim Anlegen (männlich oder ohne Angabe, weiblich, neutral).',
    '',
    '| Kennung | Männlich oder ohne Angabe | Weiblich | Neutral | Stelle im Regelkatalog |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const [id, r] of Object.entries(katalog.rollen)) {
    if (r.nurAnzahl) continue;
    z.push(
      `| ${code(id)} | ${r.text} | ${r.textWeiblich ?? r.text} | ${r.textNeutral ?? r.text} | ${code(`rollen.${id}.text`)}, ${code('textWeiblich')}, ${code('textNeutral')} |`,
    );
  }
  z.push(
    '',
    'Nicht gedruckt werden `rollen.kind` („Kind“, „Kinder“) und `rollen.weitere_erwachsene` („Weitere Erwachsene“). Auf dem Deckblatt stehen stattdessen die Zählungen unten („Ein Kind“, „Eine weitere Person“).',
    '',
  );

  z.push('## Unterlagen', '');
  z.push(
    'Im Inhalt und in den Lesezeichen steht die Kurzform (I, L), in der Kopfzeile die Einzahl (K), jeweils ohne weiche Trennstellen. Bei Unterlagen mit Varianten, die je Variante einen Eintrag bekommen, steht der Name der Variante.',
    '',
    '| Kennung | Inhalt, Lesezeichen | Kopfzeile | Stelle im Regelkatalog |',
    '| --- | --- | --- | --- |',
  );
  katalog.dokumenttypen.forEach((d, i) => {
    const stelle = `dokumenttypen[${i}]`;
    const quelleListe = d.textKurz ? `${stelle}.textKurz` : `${stelle}.text`;
    const quelleKopf = d.textEinzeln
      ? `${stelle}.textEinzeln`
      : d.textKurz
        ? `${stelle}.textKurz`
        : `${stelle}.text`;
    if (d.id === 'anschreiben') {
      z.push(`| ${code(d.id)} | (nicht in der Mappe) | | ${code(`${stelle}.text`)} |`);
      return;
    }
    const kopf = d.inAppErstellt
      ? '(eigener Kopf der Selbstauskunft)'
      : ohneTrennstellen(eintragenText(d));
    z.push(
      `| ${code(d.id)} | ${zelle(ohneTrennstellen(listenText(d)))} | ${zelle(kopf)} | ${code(quelleListe)}${d.inAppErstellt ? '' : `, ${code(quelleKopf)}`} |`,
    );
    if (d.jeVariante)
      d.varianten?.forEach((v, j) =>
        z.push(
          `| ${code(`${d.id}:${v.id}`)} | ${zelle(v.text)} | ${zelle(v.text)} | ${code(`${stelle}.varianten[${j}].text`)} |`,
        ),
      );
  });
  z.push('');

  z.push('## Serien und Daten', '');
  const serien = katalog.dokumenttypen
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.serie && d.id !== 'anschreiben');
  for (const { d, i } of serien) {
    const name = ohneTrennstellen(listenText(d));
    const einzeln = ohneTrennstellen(eintragenText(d));
    z.push(
      `${name} (${code(`dokumenttypen[${i}].serie`)}): Im Inhalt steht nach dem Namen der Zeitraum aller Monate (I). Jede Datei bekommt ein eigenes Kopfband mit ihren Monaten (K), das auch im Lesezeichen unter der Unterlage steht (L).`,
      '',
      '| Fall | Inhalt (I) | Kopfzeile und Lesezeichen (K, L) |',
      '| --- | --- | --- |',
    );
    const faelle: [string, string[], string[][]][] = [
      ['ein Monat', ['2026-09'], [['2026-09']]],
      [
        'drei Monate, drei Dateien',
        ['2026-07', '2026-08', '2026-09'],
        [['2026-07'], ['2026-08'], ['2026-09']],
      ],
      [
        'drei Monate in einer Datei',
        ['2026-07', '2026-08', '2026-09'],
        [['2026-07', '2026-08', '2026-09']],
      ],
      [
        'über den Jahreswechsel',
        ['2025-11', '2025-12', '2026-01'],
        [['2025-11'], ['2025-12'], ['2026-01']],
      ],
    ];
    for (const [fall, alle, dateien] of faelle)
      z.push(
        `| ${fall} | ${name}, ${monatsSpanne(alle, false)} | ${dateien.map((m) => `${einzeln} ${monatsSpanne(m, true)}`).join('<br>')} |`,
      );
    z.push('');
  }
  const mitDatum = katalog.dokumenttypen.find((d) => d.id === 'bonitaet')!;
  z.push(
    `Unterlagen mit Datum (${code('dokumenttypen[].datum')} ist ${code('ausstellungsdatum')}): im Inhalt „${ohneTrennstellen(listenText(mitDatum))}, ${vomText('2026-10-20')}“ (I), in der Kopfzeile „${ohneTrennstellen(eintragenText(mitDatum))} ${vomText('2026-10-20')}“ (K). Ohne Datum nur der Name.`,
    '',
  );

  z.push('## Wer ist dabei (E25)', '');
  z.push(
    `Auf dem Deckblatt (D) oben die Kurzform als Satz, darunter drei Gruppen in dieser Reihenfolge: „${GRUPPE_VERTRAG}“ (mit Namen), „${GRUPPE_MIT}“ (Kinder und weitere Erwachsene, nur gezählt) und „${GRUPPE_BUERGT}“ (mit Namen). Leere Gruppen fallen weg. Keine Summe über die Gruppen. Zahlen bis zwölf als Wort. System: \`design/wer-ist-dabei.md\`; die Wörter stehen in \`src/domain/mappeWoerter.ts\`, nicht im Regelkatalog.`,
    '',
    '| Im Mietvertrag | Kinder | Weitere | Bürgen | Kurzform |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const [vertrag, kinder, weitere, buergen] of [
    [1, 0, 0, 0],
    [2, 1, 0, 1],
    [3, 2, 1, 0],
    [2, 0, 0, 2],
    [1, 0, 2, 0],
  ] as const)
    z.push(
      `| ${vertrag} | ${kinder} | ${weitere} | ${buergen} | ${werIstDabeiKurz({ vertrag, kinder, weitere, buergen })} |`,
    );
  z.push(
    '',
    'Ausnahme (E26): Wo ein Formular oder Inserat nach der Zahl fragt, bleibt sie. In der Selbstauskunft stehen die Gruppen in Klammern dahinter, Bürgen zählen nicht mit:',
    '',
  );
  for (const [vertrag, kinder, weitere] of [
    [1, 0, 0],
    [2, 1, 0],
    [1, 2, 1],
  ] as const)
    z.push(`- ${personenZiehenEin({ vertrag, kinder, weitere })}`);
  z.push('', '| Anzahl | Kinder | Weitere Personen |', '| --- | --- | --- |');
  for (const n of [1, 2, 3, 4, 5, 12, 13]) {
    const [kind, weitere] = [mitziehendeTexte(n, 0)[0]!.text, mitziehendeTexte(0, n)[0]!.text];
    z.push(`| ${n} | ${kind} | ${weitere} |`);
  }
  z.push('');

  z.push('## Studium und Ausbildung', '');
  z.push(
    'Hat eine Person im Studium oder in der Ausbildung keinen Beruf eingetragen, steht auf dem Deckblatt statt des Berufs:',
    '',
    '| Art | Text | Stelle im Regelkatalog |',
    '| --- | --- | --- |',
  );
  for (const [id, art] of Object.entries(katalog.lebenssituationen.studierend_azubi.arten))
    z.push(
      `| ${code(id)} | ${art.text} | ${code(`lebenssituationen.studierend_azubi.arten.${id}.text`)} |`,
    );
  z.push('');

  z.push('## Fußzeile', '');
  z.push(
    'Unten auf jeder Seite (F), links Wohnung und Namen der Vertragsparteien, rechts die Seitenzahl:',
    '',
    '- „Bewerbung Hauptstraße 12 · Max und Lea Mustermann“: Straße und Nummer aus der ersten Zeile der Adresse bis zum ersten Komma; ohne Adresse „Bewerbung · Max und Lea Mustermann“',
    '- „Seite 3 von 16“',
    '',
  );

  z.push('## Feste Wörter', '');
  z.push(
    'Überschriften und Marken, die der Bau der Mappe selbst zeichnet, aus `src/pdf/bewerbung.ts` gelesen. Sie stehen nicht im Regelkatalog.',
    '',
  );
  for (const w of festeWoerter(readFileSync('src/pdf/bewerbung.ts', 'utf8'))) z.push(`- ${w}`);
  z.push('');
  return z.join('\n');
}

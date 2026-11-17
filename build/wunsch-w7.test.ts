import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// wunsch-W7 (Wunschliste, PC45): nur Musterdaten. In Mustern, Tests und Testdaten stehen nur Rufnummern aus
// dem Bereich, den die Bundesnetzagentur für Medienproduktionen freihält (0171 39200xx), und nur Mailadressen
// auf example.com oder example.org. Ausgenommen: Design-Pakete (unverändert) und weitergegebene Berichte.
// Musteradressen nur aus der Liste, die die Planung geprüft hat (PC52, PC53, Wunschliste Fassung 10).

// Eine Vorlage wie „0171 39200${…}“ ist keine Nummer.
const RUFNUMMER = /(?<![\d.,-])0(?:1[5-7]\d|[2-9]\d{1,3})[ /-]?\d{2,4}[ -]?\d{2,6}(?![\d.,]|\$\{)/g;
const ERLAUBT_NUMMER = /^0171[ /-]?3920\d{3}$/;
const MAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const ERLAUBT_MAIL =
  /@(?:(?:[\w-]+\.)*example\.(?:com|org)|hefta\.de|users\.noreply\.github\.com)$/;

/**
 * Straße mit Hausnummer, wie sie in Adressen steht („Lindenring 3“, „Beispielstr. 1“). Aus zwei Wörtern nur, wenn
 * das erste auf „-er“ oder „-e“ endet („Eppendorfer Weg“, „Alte Straße“), nicht „Wohnung Weg 2“.
 */
const ADRESSE =
  /(?<![\wäöüß-])((?:[A-ZÄÖÜ][\wäöüß-]*(?:straße|strasse|str\.|weg|allee|ring|platz|gasse|damm|chaussee|stieg|kamp|ufer|deich|markt))|(?:[A-ZÄÖÜ][\wäöüß-]*(?:er|e) (?:Weg|Straße|Allee|Ring|Platz)))[ \u00a0]+(\d{1,5})(?![\d:]|[.,]\d)/g;
/** Geprüft von der Planung (PC53): Lindenring 3 und 8 in 20259 Hamburg, Musterweg 7 und Beispielstraße 1 in Musterstadt. */
export const MUSTERADRESSEN = [
  'Lindenring 3',
  'Lindenring 8',
  'Musterweg 7',
  'Beispielstraße 1',
  // Am Musterplatz 1, 12345 Musterstadt (PC56)
  'Musterplatz 1',
];
/** Die Anschrift des Anbieters im Impressum ist echt und gehört nicht zu den Mustern. */
const ANBIETER = ['Friedensallee 378'];

/** Fundstellen, die nicht nach Musterdaten aussehen. */
export function verstoesse(text: string): string[] {
  const aus: string[] = [];
  for (const m of text.matchAll(RUFNUMMER)) {
    const n = m[0].replace(/\s+/g, ' ');
    if (n.replace(/\D/g, '').length >= 9 && !ERLAUBT_NUMMER.test(n)) aus.push(n);
  }
  for (const m of text.matchAll(MAIL)) if (!ERLAUBT_MAIL.test(m[0])) aus.push(m[0]);
  for (const m of text.matchAll(ADRESSE)) {
    const adresse = `${m[1]!.replace(/str\.$/, 'straße')} ${m[2]}`;
    // Hausnummern ab vier Stellen sind Grenzfälle der Erkennung („Beispielstraße 12345“), keine Adresse.
    const grenzfall =
      m[2]!.length >= 4 && MUSTERADRESSEN.some((a) => a.startsWith(adresse.split(' ')[0]!));
    if (!MUSTERADRESSEN.includes(adresse) && !ANBIETER.includes(adresse) && !grenzfall)
      aus.push(adresse);
  }
  return aus;
}

const dateien = execFileSync(
  'git',
  ['ls-files', 'tests', 'scripts', 'src', 'data', 'pakete', 'docs/format-hefta-json.md'],
  {
    encoding: 'utf8',
  },
)
  .split('\n')
  .filter((d) => /\.(ts|mjs|js|json|md|svelte)$/.test(d))
  // Die Regelkataloge und Wortlisten enthalten keine Personen; Postleitzahlen sehen aus wie Nummern.
  .filter((d) => !/^data\/(plz|regelkatalog)/.test(d))
  // Die Zuordnung alt → neu nennt die alten Adressen der Design-Pakete mit Absicht.
  .filter((d) => d !== 'src/test/musteradressen.ts');

describe('wunsch-W7: nur Musterdaten', () => {
  it('keine echten Rufnummern und Mailadressen in Mustern, Tests und Testdaten', () => {
    const funde: string[] = [];
    for (const d of dateien) {
      let text: string;
      try {
        text = readFileSync(d, 'utf8');
      } catch {
        continue;
      }
      for (const v of verstoesse(text)) funde.push(`${d}: ${v}`);
    }
    expect(funde).toEqual([]);
  });

  it('Gegenprobe: eine echte Rufnummer und eine echte Mail schlagen an', () => {
    expect(verstoesse("telefon: '0170 1234567', email: 'max@gmx.de'")).toEqual([
      '0170 1234567',
      'max@gmx.de',
    ]);
    expect(verstoesse("telefon: '0171 3920001', email: 'max.mustermann@example.com'")).toEqual([]);
  });

  it('Gegenprobe Adresse: die echte Lindenallee schlägt an, die geprüften Musteradressen nicht', () => {
    expect(verstoesse('Lindenallee 3, EG\n20259 Hamburg')).toEqual(['Lindenallee 3']);
    expect(verstoesse('Eppendorfer Weg 211, Hauptstraße 12')).toEqual([
      'Eppendorfer Weg 211',
      'Hauptstraße 12',
    ]);
    expect(
      verstoesse(
        'Lindenring 3, Erdgeschoss; Lindenring 8, 2. OG, 20259 Hamburg; Musterweg 7, Beispielstr. 1, 12345 Musterstadt',
      ),
    ).toEqual([]);
  });
});

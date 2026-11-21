import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import strassen from '../data/musterstrassen.json' with { type: 'json' };
import { bf2, bf2b, bf2Paarung } from '../tests/w7-bf2b';

// wunsch-W7 (Wunschliste, PC45): nur Musterdaten. In Mustern, Tests und Testdaten stehen nur Rufnummern aus
// dem Bereich, den die Bundesnetzagentur für Medienproduktionen freihält (0171 39200xx), und nur Mailadressen
// auf example.com oder example.org. Ausgenommen: Design-Pakete (unverändert) und weitergegebene Berichte.
// Musteradressen nur aus der Liste, die die Planung geprüft hat (PC52, PC53, Wunschliste Fassung 10).

// Eine Vorlage wie „0171 39200${…}“ ist keine Nummer.
const RUFNUMMER =
  /(?<![\d.,-])0(?:1[5-7]\d|[2-9]\d{1,3})[ ./-]?\d{2,5}[ .-]?\d{2,6}(?:[ -]\d{3,6})?(?![\d.,]|\$\{)/g;
// Wunschliste Fassung 24 (E224): dazu Festnetz Hamburg 040 66969 000 bis 999, ebenfalls Medienproduktionen; der
// britische Bereich +44 20 7946 0xxx (E214) erscheint hier als „020 7946 0xxx“ hinter der Landesvorwahl.
const ERLAUBT_NUMMER = /^(?:0171[ ./-]?3920\d{3}|040[ /-]?66969 ?\d{3}|020 7946 0\d{3})$/;
/**
 * Aus 2.0.1 (Fassung 23, E214): Nummern mit Vorwahl des Landes („+44 20 7946 0018“, „0049 (0)171 39 200 01“). Ohne
 * diese Prüfung blieb eine österreichische Nummer in den Tests unbemerkt (PC123). Eine Vorlage wie „+4917139200${…}“
 * ist keine Nummer.
 */
const INTERNATIONAL = /(?<![\w+])(?:\+|00)[1-9][\d ()./-]{6,22}\d(?!\d|\$\{)/g;
/**
 * Erlaubt: die reservierten Bereiche (Mobil 0171 39200xx und Festnetz 040 66969xxx international, der britische Bereich),
 * auch in absichtlich falscher Länge als Testeingabe, dazu die nicht vergebene Landesvorwahl +999.
 */
const ERLAUBT_INTERNATIONAL = /^(?:4917139200\d*|494066969\d*|442079460\d*|999\d*)$/;
const MAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const ERLAUBT_MAIL =
  /@(?:(?:[\w-]+\.)*example\.(?:com|org)|hefta\.de|users\.noreply\.github\.com)$/;

/**
 * Straße mit Hausnummer, wie sie in Adressen steht („Lindenring 3“, „Beispielstr. 1“). Aus zwei Wörtern nur, wenn
 * das erste auf „-er“ oder „-e“ endet („Eppendorfer Weg“, „Alte Straße“), nicht „Wohnung Weg 2“.
 */
const ADRESSE =
  /(?<![\wäöüß-])((?:[A-ZÄÖÜ][\wäöüß-]*(?:straße|strasse|str\.|weg|allee|ring|platz|gasse|damm|chaussee|stieg|kamp|ufer|deich|markt|wisch|koppel|bogen|reihe|schlag|höfe))|(?:[A-ZÄÖÜ][\wäöüß-]*(?:er|e) (?:Weg|Straße|Allee|Ring|Platz)))[ \u00a0]+(\d{1,5})(?![\d:]|[.,]\d)/g;
/** Geprüft von der Planung (PC53): Lindenring 3 und 8 in 20259 Hamburg, Musterweg 7 und Beispielstraße 1 in Musterstadt. */
export const MUSTERADRESSEN = [
  'Lindenring 3',
  'Lindenring 8',
  'Musterweg 7',
  'Beispielstraße 1',
  // Am Musterplatz 1, 12345 Musterstadt (PC56)
  'Musterplatz 1',
];
/**
 * W40 (PC176, 2.1): In sichtbaren Mustern (App, Beispiel-Mappe, Website, Store) stehen Straßen aus der Namensliste,
 * jede gegen OpenStreetMap geprüft (data/musterstrassen.json, frei). In Tests gelten weiter nur MUSTERADRESSEN.
 * Eine Straße, die es laut OSM gibt (vorhanden), ist nie erlaubt.
 */
export const NAMENSLISTE_STRASSEN: readonly string[] = strassen.frei.map((x) => x.strasse);
const VORHANDEN: readonly string[] = strassen.vorhanden.map((x) => x.strasse);

/** Die Anschrift des Anbieters im Impressum ist echt und gehört nicht zu den Mustern. */
const ANBIETER = ['Friedensallee 378'];

/**
 * Wunschliste Fassung 25 (E233): Für erzeugte Varianten sind erfundene Straßen erlaubt, wenn ihre Postleitzahl
 * zwischen 00000 und 00999 liegt; die gibt es in Deutschland nicht. Gesucht wird die erste fünfstellige Zahl
 * hinter der Straße, in derselben oder der nächsten Zeile (auch „\n“ in JSON und Vorlagen).
 */
function mitPlzOhneOrt(text: string, ende: number): boolean {
  const danach = text
    .slice(ende, ende + 80)
    .split(/\n|\\n/)
    .slice(0, 2)
    .join(' ');
  const plz = /(?<!\d)(\d{5})(?!\d)/.exec(danach)?.[1];
  return !!plz && /^00\d{3}$/.test(plz);
}

/**
 * Fundstellen, die nicht nach Musterdaten aussehen. `sichtbar`: Die Datei liefert sichtbare Muster (nicht Tests);
 * dort sind auch die Straßen der Namensliste erlaubt.
 */
export function verstoesse(text: string, sichtbar = false): string[] {
  const aus: string[] = [];
  for (const m of text.matchAll(RUFNUMMER)) {
    const n = m[0].replace(/\s+/g, ' ');
    if (n.replace(/\D/g, '').length >= 9 && !ERLAUBT_NUMMER.test(n)) aus.push(n);
  }
  for (const m of text.matchAll(INTERNATIONAL)) {
    // „+49 0171 …“ oder „+44 020 …“ (die Null nach der Landesvorwahl) ist dieselbe Nummer in falscher Schreibweise.
    const ziffern = m[0]
      .replace('(0)', '')
      .replace(/\D/g, '')
      .replace(/^00/, '')
      .replace(/^(49|44)0/, '$1');
    if (ziffern.length >= 9 && !ERLAUBT_INTERNATIONAL.test(ziffern)) aus.push(m[0].trim());
  }
  for (const m of text.matchAll(MAIL)) if (!ERLAUBT_MAIL.test(m[0])) aus.push(m[0]);
  for (const m of text.matchAll(ADRESSE)) {
    const adresse = `${m[1]!.replace(/str\.$/, 'straße')} ${m[2]}`;
    // Hausnummern ab vier Stellen sind Grenzfälle der Erkennung („Beispielstraße 12345“), keine Adresse.
    const grenzfall =
      m[2]!.length >= 4 && MUSTERADRESSEN.some((a) => a.startsWith(adresse.split(' ')[0]!));
    const erfunden = mitPlzOhneOrt(text, (m.index ?? 0) + m[0].length);
    const strasse = adresse.replace(/ \d+$/, '');
    if (VORHANDEN.includes(strasse)) {
      aus.push(adresse);
      continue;
    }
    const ausListe = sichtbar && NAMENSLISTE_STRASSEN.includes(strasse);
    if (
      !MUSTERADRESSEN.includes(adresse) &&
      !ANBIETER.includes(adresse) &&
      !grenzfall &&
      !erfunden &&
      !ausListe
    )
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
      // Das Musterbackup für Vorschau und Store-Bilder ist ein sichtbares Muster, auch wenn es in tests/ entsteht.
      const sichtbar =
        d === 'tests/e2e/vorschau-muster.spec.ts' ||
        (!d.startsWith('tests/') && !/\.test\.ts$/.test(d));
      for (const v of verstoesse(text, sichtbar)) funde.push(`${d}: ${v}`);
    }
    expect(funde).toEqual([]);
  });

  it('W40 (PC176): Straßen der Namensliste nur in sichtbaren Mustern; eine Straße, die es laut OSM gibt, wird rot', () => {
    expect(NAMENSLISTE_STRASSEN).toHaveLength(16);
    const sichtbar =
      'Kranichstieg 3, Erdgeschoss\n20259 Hamburg; Lotsenwisch 8; Holunderkoppel 12; Fährhausbogen 1';
    expect(verstoesse(sichtbar, true)).toEqual([]);
    // In Tests gelten weiter nur die geprüften Musteradressen.
    expect(verstoesse('Kranichstieg 3', false)).toEqual(['Kranichstieg 3']);
    // Gegenproben: eine Straße, die es laut OSM in Hamburg gibt, und eine Straße außerhalb der Liste.
    expect(verstoesse('Lindenallee 3, 20259 Hamburg', true)).toEqual(['Lindenallee 3']);
    expect(verstoesse('Elbchaussee 12', true)).toEqual(['Elbchaussee 12']);
  });

  it('Gegenprobe: eine echte Rufnummer und eine echte Mail schlagen an', () => {
    expect(verstoesse("telefon: '0170 1234567', email: 'max@gmx.de'")).toEqual([
      '0170 1234567',
      'max@gmx.de',
    ]);
    expect(verstoesse("telefon: '0171 3920001', email: 'max.mustermann@example.com'")).toEqual([]);
  });

  it('Fassung 23: Nummern mit Landesvorwahl; nur die reservierten Bereiche, Gegenproben schlagen an', () => {
    expect(
      verstoesse(
        '+44 20 7946 0018, +442079460999, +49 171 3920001, 0049 (0)171 39 200 01, +49 (0)171 3920006, +49 40 66969123, +44 020 7946 0018',
      ),
    ).toEqual([]);
    expect(
      verstoesse('+44 20 7946 1234 und +44 20 7123 4567, +49 170 1234567, +43 1 5880000'),
    ).toEqual(['+44 20 7946 1234', '+44 20 7123 4567', '+49 170 1234567', '+43 1 5880000']);
  });

  it('Fassung 24: Festnetz Hamburg 040 66969xxx ist erlaubt, 040 66968 000 schlägt an (PC114)', () => {
    expect(verstoesse("'040 66969123', '040/66969000', '04066969999', '040 66969 123'")).toEqual(
      [],
    );
    expect(verstoesse("telefon: '040 66968000'")).toEqual(['040 66968000']);
    // Auch mit Punkt als Trenner (PC123): „0171.1234567“ schlägt an, „0171.3920008“ nicht.
    expect(verstoesse("'0171.1234567', '0171.3920008'")).toEqual(['0171.1234567']);
    expect(verstoesse("telefon: '040 66968 000'")).toEqual(['040 66968 000']);
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

  it('Fassung 25 (E233): erfundene Straße mit Postleitzahl 00000 bis 00999 ist erlaubt, mit 12346 schlägt sie an', () => {
    expect(verstoesse('Mustermarkt 2, 00100 Musterstadt')).toEqual([]);
    expect(verstoesse('Musterdamm 6\n00999 Musterstadt')).toEqual([]);
    expect(verstoesse('"adresse": "Musterufer 4, 2. OG\\n00000 Musterstadt"')).toEqual([]);
    // Gegenproben: andere Postleitzahl, keine Postleitzahl, Postleitzahl erst weit danach.
    expect(verstoesse('Mustermarkt 2, 12346 Musterstadt')).toEqual(['Mustermarkt 2']);
    expect(verstoesse('Mustermarkt 2, 01000 Musterstadt')).toEqual(['Mustermarkt 2']);
    expect(verstoesse('Mustermarkt 2')).toEqual(['Mustermarkt 2']);
    expect(verstoesse(`Mustermarkt 2\nZeile\nZeile\n00100 Musterstadt`)).toEqual(['Mustermarkt 2']);
    // Die echte Lindenallee bleibt verboten, auch mit erfundener Postleitzahl nicht in der Liste.
    expect(verstoesse('Lindenallee 3, 20259 Hamburg')).toEqual(['Lindenallee 3']);
  });
  it('BF2b (PC137, DP86): die Muster der Bildschirmfotos stehen nur in ihrer Paarung', () => {
    // Im Quelltext des Bilder-Laufs steht der Stadtteil einige Zeilen unter der Adresse; darum sechs Zeilen.
    expect(bf2b(readFileSync('tests/e2e/store-bilder.spec.ts', 'utf8'), 6)).toEqual([]);
  });

  it('BF2b, Gegenproben: Musterweg 7 mit Hoheluft, mit Neustadt und mit 20255 Hamburg werden rot', () => {
    const z = String.fromCharCode(10);
    expect(bf2b('Musterweg 7, Hoheluft')).toEqual(['Musterweg 7 mit Hoheluft']);
    expect(bf2b(['Musterweg 7', 'Neustadt'].join(z))).toEqual(['Musterweg 7 mit Neustadt']);
    expect(bf2b(['Musterweg 7', '20255 Hamburg'].join(z))).toEqual([
      'Musterweg 7 mit Hamburg/20259',
    ]);
    expect(bf2b('Lindenring 8, Hoheluft')).toEqual(['Lindenring 8 mit Hoheluft']);
    // Erlaubt: Lindenring mit Eimsbüttel und 20259 Hamburg, Musterweg und Beispielstraße mit Musterstadt.
    expect(bf2b(['Lindenring 8', '20259 Hamburg', 'Eimsbüttel'].join(z))).toEqual([]);
    expect(bf2b(['Musterweg 7', '12345 Musterstadt', 'Musterstadt'].join(z))).toEqual([]);
    expect(bf2b('Beispielstraße 1, Musterstadt')).toEqual([]);
    // Nicht „Hamm“ in „Hammerbrook“ und kein Stadtteil in einem längeren Wort.
    expect(bf2b('Musterweg 7, Hammerweg')).toEqual([]);
  });

  // PC138, PC139: BF2b und die Paarung der Postleitzahlen (BF2) auch für die Testmappen aus dem Schreiber
  // und für die öffentlichen Beispiele im Paket hefta.json.
  const MIT_PAARUNG: [datei: string, folgeZeilen: number][] = [
    ['tests/e2e/store-bilder.spec.ts', 6],
    ['src/vermieter/stressSchreiber.test.ts', 3],
    ...readdirSync('pakete/hefta-json/beispiele').map((d): [string, number] => [
      `pakete/hefta-json/beispiele/${d}`,
      8,
    ]),
    ['pakete/hefta-json/FORMAT.md', 3],
  ];
  it('BF2b und BF2 (PC138, PC139): Bilder, Testmappen und Beispiele im Paket stehen in ihrer Paarung', () => {
    const falsch = MIT_PAARUNG.flatMap(([datei, n]) => {
      const text = readFileSync(datei, 'utf8');
      return [...bf2b(text, n), ...bf2Paarung(text, n)].map((f) => `${datei}: ${f}`);
    });
    expect(falsch).toEqual([]);
    expect(MIT_PAARUNG.length).toBeGreaterThanOrEqual(8);
  });

  it('BF2, Gegenproben: Musterweg mit 00100, Lindenring mit 12345 und eine fremde Postleitzahl werden rot', () => {
    const z = String.fromCharCode(10);
    expect(bf2Paarung("adresse: ['Musterweg 7, 2. OG', '00100 Musterstadt'],")).toEqual([
      'Musterweg 7 mit 00100',
    ]);
    expect(bf2Paarung(['Lindenring 3', 'Erdgeschoss, 12345 Musterstadt'].join(z))).toEqual([
      'Lindenring 3 mit 12345',
    ]);
    // Das Beispiel 1 im Paket bis CP77: Musterweg 7 mit 20259 Hamburg.
    const alt = ['"strasse": "Musterweg 7",', '"rest": "1. OG rechts, 20259 Hamburg",'].join(z);
    expect(bf2Paarung(alt)).toEqual(['Musterweg 7 mit 20259']);
    expect(bf2b(alt)).toEqual(['Musterweg 7 mit Hamburg/20259']);
    expect(bf2('Musterweg 7, 12345 Musterstadt')).toEqual([]);
    expect(bf2('Lindenring 3, 20259 Hamburg')).toEqual([]);
    expect(bf2('Fichtenweg 4, 00120 Musterstadt')).toEqual([]);
    expect(bf2('Hauptstraße 2, 20146 Hamburg')).toEqual(['Postleitzahl 20146']);
    // Telefonnummern und Preise sind keine Postleitzahlen.
    expect(bf2('0171 3920001, 1.180 €, 040 66969123')).toEqual([]);
  });
});

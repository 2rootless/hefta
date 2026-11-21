import { describe, expect, it } from 'vitest';
import { PDFDocument } from '@cantoo/pdf-lib';
import type { BuergschaftAngaben } from '../domain/buergschaft';
import { pdfSchriften, textJeSeite } from '../test/hilfen';
import { buergschaftBauen, tagLang } from './buergschaft';

// E112 (DP41 Prüfkatalog E5 bis E8): zwei Blätter, je einseitig, auch mit langen Namen und drei Mietern.

const schriften = pdfSchriften();

const PETRA: BuergschaftAngaben = {
  buerge: { name: 'Petra Mustermann', anschrift: 'Musterweg 7, 12345 Musterstadt' },
  mieter: ['Max Mustermann', 'Lea Mustermann'],
  vermieter: {
    name: 'Hausverwaltung Beispiel GmbH',
    anschrift: 'Beispielstraße 1, 12345 Musterstadt',
  },
  wohnung: 'Lindenring 3, Erdgeschoss, 20259 Hamburg',
  vertrag: 'nochNicht',
  vertragTag: '2027-01-01',
  hoechstbetrag: 3600,
  art: 'ausfall',
  bezeichnung: 'weiblich',
};

const LANG: BuergschaftAngaben = {
  buerge: {
    name: 'Dr. Konstantin Alexander von Hohenstein-Schwarzenberg',
    anschrift: 'Am Großen Wiesengrund 117a, Hinterhaus, 3. Obergeschoss, 12345 Musterstadt',
  },
  mieter: ['Max Mustermann', 'Lea Mustermann', 'Olena Beispielowa-Musterfrau'],
  vermieter: {
    name: 'Wohnungsbaugenossenschaft Beispiel-Musterstadt von 1921 eG',
    anschrift: 'Postfach 12 34 56, 12345 Musterstadt',
  },
  wohnung: 'Lindenring 3, Erdgeschoss links, Hinterhaus, 20259 Hamburg',
  vertrag: 'nochNicht',
  vertragTag: '2027-01-01',
  hoechstbetrag: 12600,
  art: 'selbstschuldnerisch',
  bezeichnung: 'maennlich',
};

const texte = async (bytes: Uint8Array) =>
  (await textJeSeite(bytes)).map((t) => t.replace(/\s+/g, ' '));

describe('Bürgschaftserklärung als PDF (E112)', () => {
  it('zwei Blätter: Blatt 1 für den Vermieter, Blatt 2 nur für die Bürgin', async () => {
    const erg = await buergschaftBauen(PETRA, schriften);
    expect(erg.seiten).toBe(2);
    const [eins, zwei] = await texte(erg.bytes);
    expect(eins).toContain('Bürgschaftserklärung für ein Mietverhältnis');
    expect(eins).toContain('Petra Mustermann, Bürgin');
    expect(eins).toContain('Mietvertrag abzuschließen zum 1. Januar 2027');
    expect(eins).toMatch(/höchstens bis zu einem Betrag von 3\.600.Euro/);
    expect(eins).toContain('Unterschrift der Bürgin (eigenhändig)');
    expect(eins).toContain('Muster von Hefta, keine Rechtsberatung.');
    // W10: kein „freiwillig und unaufgefordert“ auf Blatt 1, kein Datum von Hefta.
    expect(eins).not.toMatch(/freiwillig/);
    expect(eins).not.toMatch(/2026/);
    expect(zwei).toContain('Nur für Petra Mustermann');
    expect(zwei).toContain('Bevor Sie unterschreiben');
    // PC79: Die Regel zur Ausfallbürgschaft mit ihrer echten Quelle, dem Gesetz (W32).
    expect(zwei).toMatch(/Nach dem Gesetz der Regelfall \(§.771 BGB\)/);
    expect(zwei).not.toContain('MieterGemeinschaft der Regelfall');
    expect(zwei).toContain(
      'Dieses Blatt bleibt bei Ihnen. Es geht nicht an den Vermieter und nicht in die Mappe.',
    );
    expect(zwei).toMatch(/Höchstbetrag 3\.600.Euro/);
  });

  it('E6: die gewählte Art trägt auf Blatt 2 „auf Blatt 1 gewählt“, an der richtigen Stelle', async () => {
    for (const art of ['ausfall', 'selbstschuldnerisch'] as const) {
      const [, zwei] = await texte((await buergschaftBauen({ ...PETRA, art }, schriften)).bytes);
      const name = art === 'ausfall' ? 'Ausfallbürgschaft' : 'Selbstschuldnerische Bürgschaft';
      expect(zwei).toContain(`${name} auf Blatt 1 gewählt`);
      expect(zwei?.match(/auf Blatt 1 gewählt/g)).toHaveLength(1);
    }
  });

  it('E5: „Schon unterschrieben“ heißt auf Blatt 1 „Mietvertrag vom …“', async () => {
    const erg = await buergschaftBauen(
      { ...PETRA, vertrag: 'unterschrieben', vertragTag: '2026-10-15' },
      schriften,
    );
    const [eins] = await texte(erg.bytes);
    expect(eins).toContain('Mietvertrag vom 15. Oktober 2026');
    expect(eins).not.toContain('abzuschließen');
  });

  it('E8: Bürge und neutral: Etikett und Unterschriftszeile passen (PC51)', async () => {
    const [bm] = await texte(
      (await buergschaftBauen({ ...PETRA, bezeichnung: 'maennlich' }, schriften)).bytes,
    );
    expect(bm).toContain('Unterschrift des Bürgen (eigenhändig)');
    expect(bm).toContain('Petra Mustermann, Bürge');
    const [neutral] = await texte(
      (await buergschaftBauen({ ...PETRA, bezeichnung: 'neutral' }, schriften)).bytes,
    );
    expect(neutral).toContain('Bürgschaft von');
    expect(neutral).toContain('Unterschrift (eigenhändig)');
    expect(neutral).not.toMatch(/Bürgin|des Bürgen/);
  });

  it('E7: sehr lange Namen, drei Mieter, Genossenschaft: beide Blätter bleiben einseitig, nichts im Fuß', async () => {
    const erg = await buergschaftBauen(LANG, schriften);
    expect(erg.seiten).toBe(2);
    for (const m of erg.mass) expect(m.unten).toBeGreaterThan(m.grenze);
    const pdf = await PDFDocument.load(erg.bytes);
    expect(pdf.getPageCount()).toBe(2);
    // Gegenprobe: Ein Blatt 2 mit doppelt so viel Text liefe in den Fuß; das Maß würde es melden.
    const [eins] = await texte(erg.bytes);
    expect(eins).toContain('Olena Beispielowa-Musterfrau');
  });

  it('Ohne Angaben: Linien für die Hand statt Text, das PDF entsteht trotzdem (nur Betrag und Art sind Pflicht)', async () => {
    const erg = await buergschaftBauen(
      {
        ...PETRA,
        buerge: { name: '', anschrift: '' },
        vermieter: { name: '', anschrift: '' },
        mieter: [''],
        wohnung: '',
        vertragTag: '',
        bezeichnung: 'neutral',
      },
      schriften,
    );
    const [eins, zwei] = await texte(erg.bytes);
    expect(eins).toMatch(/^Mietverhältnis /);
    expect(zwei).toContain('Nur für Sie');
  });

  it('tagLang schreibt das Jahr immer aus', () => {
    expect(tagLang('2027-01-01')).toBe('1. Januar 2027');
    expect(tagLang('frei')).toBe('frei');
  });
});

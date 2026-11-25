import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { haushaltsAngaben, einziehend, selbstauskunftBloecke } from '../domain/selbstauskunft';
import type { Person } from '../domain/modell';
import { pdfSchriften, textJeSeite } from '../test/hilfen';
import { selbstauskunftBauen } from './selbstauskunft';

const MAX = {
  vorname: 'Max',
  nachname: 'Mustermann',
  rufname: 'Max',
  kontakt: {
    telefon: '0171 3920001',
    telefonLand: 'DE',
    telefonE164: '+491713920001',
    email: 'max.mustermann@example.com',
  },
  lebenssituation: 'angestellt',
  beruf: 'Elektroniker',
  arbeitgeber: 'Musterfirma GmbH, Hamburg',
  nettoeinkommen: 2643,
  selbstauskunft: {
    einkommenArt: 'betrag',
    haustiere: null,
    haustiereText: '',
    insolvenz: 'nein',
    raeumungstitel: 'nein',
    mietrueckstaende: 'nein',
    stellungnahme: '',
    ort: '',
  },
} as unknown as Person;
const HH = haushaltsAngaben({ haustiere: 'ja', haustiereText: 'eine Katze', ort: 'Hamburg' });
const WER = einziehend(2, { kinder: 1, weitereErwachsene: 0 });
const ETIKETTEN = [
  'Selbstauskunft',
  'Nach dem Musterbogen der Datenschutzkonferenz, Stand Januar 2026',
  'Zur Person',
  'Name',
  'Telefon oder E-Mail',
  'Beruf',
  'Arbeitgeber',
  'Einkommen',
  'Lebenslage',
  'Fragen nach dem Musterbogen',
  'Laufendes Insolvenzverfahren',
  'Räumungstitel in den letzten fünf Jahren',
  'Mietrückstände',
  'Ort, Datum',
];

async function bauen(
  person: Person = MAX,
  rolle: 'vertrag' | 'buerge' = 'vertrag',
  rolleText = 'Hauptmieter',
  teil: { unterschrift?: boolean; mitHinweis?: boolean; schritt?: 'will_wohnung' | 'zusage' } = {},
) {
  return selbstauskunftBauen({
    dateiname: '01_Selbstauskunft_Mustermann.pdf',
    name: 'Max Mustermann',
    rolle: rolleText,
    buerge: rolle === 'buerge',
    farbe: '#e9a970',
    bloecke: selbstauskunftBloecke(person, rolle, WER, HH, teil.schritt ?? 'zusage', {}),
    ortDatum: 'Hamburg, 6. November 2026',
    schriften: pdfSchriften(),
    datum: new Date(2026, 10, 6),
    unterschrift: teil.unterschrift,
    mitHinweis: teil.mitHinweis,
  });
}
const text = async (e: { bytes: Uint8Array }) =>
  (await textJeSeite(e.bytes)).join(' ').replace(/\s+/g, ' ');

describe('Selbstauskunft als festes Formular', () => {
  it('P27: eine Seite, jedes Etikett steht da, mit Werten und Kreuzen', async () => {
    const e = await bauen();
    expect(e.seiten).toBe(1);
    const t = await text(e);
    for (const etikett of [...ETIKETTEN, 'Haushalt', 'Personen, die einziehen', 'Haustiere'])
      expect(t.toLowerCase(), etikett).toContain(etikett.toLowerCase());
    expect(t).toContain('Max Mustermann');
    // W57: kein Rollenwort mehr, nur „Im Mietvertrag.“
    expect(t).toContain('Im Mietvertrag. Nach dem Musterbogen');
    // DP30: Komma statt Mittelpunkt.
    expect(t).toContain('0171 3920001, max.mustermann@example.com');
    expect(t).toContain('3 (2 Erwachsene, 1 Kind)');
    expect(t).toContain('Eine Katze');
    expect(t).toContain('2.643 €');
    expect(t).toContain('Hamburg, 6. November 2026');
  });

  it('P27: Fehlende Angaben stehen als „keine Angabe“ an ihrer Stelle, die Etiketten bleiben', async () => {
    const leer = {
      ...MAX,
      kontakt: { telefon: '', email: '' },
      beruf: '',
      arbeitgeber: '',
      nettoeinkommen: null,
      selbstauskunft: { ...MAX.selbstauskunft, insolvenz: null, raeumungstitel: null },
    } as Person;
    const t = await text(await bauen(leer));
    for (const etikett of ETIKETTEN)
      expect(t.toLowerCase(), etikett).toContain(etikett.toLowerCase());
    expect(t.match(/keine Angabe/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('P19: Bürgen haben statt des Haushalts die Bürgschaft', async () => {
    const t = await text(await bauen(MAX, 'buerge', 'Bürgin'));
    for (const etikett of ETIKETTEN)
      expect(t.toLowerCase(), etikett).toContain(etikett.toLowerCase());
    expect(t).toContain('Bürgschaft');
    // PC205 (E363): „Bürgt, zieht nicht ein.“ statt der gewählten Form.
    expect(t).toContain('Bürgt, zieht nicht ein.');
    expect(t).not.toContain('Bürgin');
    // DP130, Antwort 4: Bei Bürgen „Rolle: Bürgt“, bei allen im Mietvertrag keine Zeile.
    expect(t).toContain('Bürgt');
    expect(t).not.toContain('Rolle im Mietvertrag');
    expect(t).toContain('Bürgschaftserklärung folgt');
    expect(t).not.toContain('Haustiere');
    expect(t).not.toContain('Personen, die einziehen');
  });

  it('vor der Zusage: Die Frage steht da, mit dem Satz, wann sie kommt', async () => {
    const t = await text(await bauen(MAX, 'vertrag', 'Hauptmieter', { schritt: 'will_wohnung' }));
    expect(t).toContain('Mietrückstände');
    expect(t).toContain('Wird erst bei der Zusage gefragt und dann ergänzt');
  });

  it('Der Dienst steht nur in der Fußnote, wenn der Hinweis an ist', async () => {
    expect(await text(await bauen(MAX, 'vertrag', 'Hauptmieter', { mitHinweis: true }))).toContain(
      'fragt Hefta nicht',
    );
    expect(await text(await bauen())).not.toContain('Hefta');
  });

  it('lange Erklärungen gehen auf der nächsten Seite weiter, statt über den Rand zu laufen', async () => {
    const lang = {
      ...MAX,
      selbstauskunft: {
        ...MAX.selbstauskunft,
        mietrueckstaende: 'ja',
        stellungnahme: 'Zwei Monate im Jahr 2023, inzwischen vollständig beglichen. '.repeat(40),
      },
    } as Person;
    const e = await bauen(lang);
    // Ein Abschnitt wird nie geteilt: Die Fragen mit der langen Erläuterung gehen auf Seite 2. „Ort, Datum“
    // steht dort an festem Platz darunter (DP30); reichte der Platz nicht, käme er auf eine eigene Seite.
    expect(e.seiten).toBe(2);
    const seiten = await textJeSeite(e.bytes);
    expect(seiten[1]).toContain('inzwischen vollständig beglichen');
    expect(seiten[1]).toContain('Ort, Datum');
  });

  it('neutrale Metadaten', async () => {
    const pdf = await PDFDocument.load((await bauen()).bytes, { updateMetadata: false });
    expect(pdf.getProducer() ?? '').toBe('');
    expect(pdf.getCreator() ?? '').toBe('');
    expect(pdf.getTitle()).toBe('01_Selbstauskunft_Mustermann');
  });
});

describe('Unterschriftszeile (X8b)', () => {
  it('steht nur auf Wunsch im Bogen', async () => {
    expect(await text(await bauen())).not.toContain('Unterschrift');
    expect(
      await text(await bauen(MAX, 'vertrag', 'Hauptmieter', { unterschrift: true })),
    ).toContain('Unterschrift');
  });
});

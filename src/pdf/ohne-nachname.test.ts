import { describe, expect, it } from 'vitest';
import { haushaltsZeile, nameImPdf, nameText } from '../domain/namen';
import { pdfSchriften, teileJeSeite } from '../test/hilfen';
import { bewerbungBauen, type MappenBlock } from './bewerbung';

// DP74 C3, NN5 (PC109, F7): Wer keinen Nachnamen hat, steht in Deckblatt, Verzeichnis und Selbstauskunft nur mit dem
// Vornamen: ohne Lücke, ohne Leerzeichen vor einem Satzzeichen, ohne „undefined“ oder „null“.

/** NN5 (W14): kein doppeltes Leerzeichen, kein Leerzeichen vor Satzzeichen, kein „undefined“ oder „null“. */
const fehler = (text: string) => text.match(/ {2}\S| [,.;:!?]|undefined|\bnull\b/g) ?? [];

const aylin = nameText(nameImPdf({ vorname: 'Aylin', nachname: '' }));
const lea = nameText(nameImPdf({ vorname: 'Lea', nachname: 'Mustermann' }));

const person = (name: string, rolle: string) => ({
  person: { name, rolle, farbe: '#e9a970' },
  teile: [
    {
      abschnitt: 'Selbstauskunft',
      quellen: [],
      auskunft: {
        name,
        rolle,
        farbe: '#e9a970',
        bloecke: [
          {
            id: 'person' as const,
            titel: 'Zur Person',
            zeilen: [
              { id: 'name', etikett: 'Name', art: 'text' as const, wert: name },
              { id: 'kontakt', etikett: 'Kontakt', art: 'text' as const, wert: '0171 3920001' },
            ],
          },
        ],
        ortDatum: 'Hamburg, 6. November 2026',
      },
    },
  ],
});

describe('DP74 C3, NN5: nur ein Name', () => {
  it('Name, Haushaltszeile und Titel ohne Lücke', () => {
    expect(aylin).toBe('Aylin');
    expect(haushaltsZeile([{ vorname: 'Aylin', nachname: '' }])).toBe('Aylin');
    expect(
      haushaltsZeile([
        { vorname: 'Aylin', nachname: '' },
        { vorname: 'Lea', nachname: 'Mustermann' },
      ]),
    ).toBe('Aylin und Lea Mustermann');
    for (const t of [aylin, haushaltsZeile([{ vorname: 'Aylin', nachname: '' }])])
      expect(fehler(t)).toEqual([]);
  });

  it('Deckblatt, Verzeichnis und Selbstauskunft: nur „Aylin“, sauber auf jeder Seite', async () => {
    const haushalt = haushaltsZeile([
      { vorname: 'Aylin', nachname: '' },
      { vorname: 'Lea', nachname: 'Mustermann' },
    ]);
    const e = await bewerbungBauen({
      titel: `Bewerbung Beispielstraße 1 – ${haushalt}`,
      autor: aylin,
      fussName: haushalt,
      kurz: 'Beispielstraße 1',
      adresse: ['Beispielstraße 1, 2. OG', '12345 Musterstadt'],
      satz: 'Wir suchen eine ruhige Wohnung.',
      mitziehende: [],
      kontakt: [aylin, '0171 3920001'],
      bloecke: [person(aylin, 'Hauptmieterin'), person(lea, 'Mitmieterin')] as MappenBlock[],
      deckblatt: true,
      inhaltsverzeichnis: true,
      fusszeile: true,
      schriften: pdfSchriften(),
      datum: new Date(2026, 10, 6),
    });
    // Jedes Textstück für sich, wie es im PDF steht; zusammengefügt kämen Leerzeichen der Hilfe dazu.
    const seiten = await teileJeSeite(e.bytes);
    const alles = seiten.flat().join(' ');
    expect(alles).toContain('Aylin');
    expect(alles).toContain('Aylin und Lea Mustermann');
    const funde = seiten.flatMap((teile, i) =>
      teile.flatMap((t) => fehler(t.trim()).map((f) => `Seite ${i + 1}: „${t}“ (${f})`)),
    );
    expect(funde).toEqual([]);
  });

  it('Gegenprobe: zusammengesetzt ohne trim gäbe es eine Lücke, und die Prüfung findet sie', () => {
    const roh = `Aylin ${''}`;
    expect(fehler(`${roh}, Lea`)).toEqual([' ,']);
    expect(fehler('Max und Aylin  und Lea')).toHaveLength(1);
    expect(fehler('Name: undefined')).toEqual(['undefined']);
  });
});

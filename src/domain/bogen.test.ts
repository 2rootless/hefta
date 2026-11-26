import { describe, expect, it } from 'vitest';
import { pdfSchriften, textJeSeite } from '../test/hilfen';
import { bogenPdfBauen } from '../pdf/bogenPdf';
import {
  bogenBloecke,
  bogenDateinamen,
  fehltImBogen,
  fehltSatz,
  leerePerson,
  leereSelbstauskuenfte,
  nettoAus,
  type BogenPerson,
  type SelbstauskunftBoegen,
} from './bogen';

// E111 (DP134): der Bogen im Browser. Namen aus der Namensliste (W40), Telefon wie im Muster.
const JARNE: BogenPerson = {
  ...leerePerson('j', 1),
  vorname: 'Jarne',
  nachname: 'Ostendorp',
  telefon: '0171 3920011',
  beruf: 'Logistikplaner',
  netto: '2.800',
  insolvenz: 'nein',
  raeumungstitel: 'nein',
};
const SELIN: BogenPerson = {
  ...JARNE,
  id: 's',
  farbe: 2,
  vorname: 'Selin',
  nachname: 'Akgül',
  telefon: '0171 3920012',
  netto: 'mindestens 3.100',
};
const ZWEI: SelbstauskunftBoegen = {
  personen: [JARNE, SELIN],
  hh: { erwachsene: 2, kinder: 1, haustiere: 'nein', wbs: 'ja', ort: 'Lüneburg' },
  pdf: 'eine',
};

const schriften = pdfSchriften();

describe('E111: der Bogen im Browser', () => {
  it('„Es fehlt noch“ mit den Namen aus DP134; eine Kontaktangabe reicht', () => {
    expect(fehltImBogen(leerePerson('x'))).toEqual([
      'Vorname',
      'Nachname',
      'Kontakt',
      'Netto',
      '2 Fragen',
    ]);
    expect(fehltImBogen(JARNE)).toEqual([]);
    expect(fehltImBogen({ ...JARNE, telefon: '', email: 'jarne@example.com' })).toEqual([]);
    expect(fehltSatz(leereSelbstauskuenfte('x'))).toBe(
      'Es fehlt noch: Vorname, Nachname, Kontakt, Netto, 2 Fragen',
    );
    expect(fehltSatz({ ...ZWEI, personen: [JARNE, { ...SELIN, insolvenz: null }] })).toBe(
      'Es fehlt noch bei Selin: 1 Frage',
    );
  });

  it('Netto als Betrag oder Grenze', () => {
    expect(nettoAus('2.800')).toEqual({ betrag: 2800, mindestens: false });
    expect(nettoAus('mindestens 2.000')).toEqual({ betrag: 2000, mindestens: true });
    expect(nettoAus('2.800,50 €')).toEqual({ betrag: 2800, mindestens: false });
    expect(nettoAus('')).toEqual({ betrag: null, mindestens: false });
  });

  it('Dateinamen nach DP134, Abschnitt 4', () => {
    expect(bogenDateinamen(ZWEI)).toEqual(['Selbstauskünfte Jarne Ostendorp und Selin Akgül.pdf']);
    expect(bogenDateinamen({ ...ZWEI, pdf: 'je' })).toEqual([
      'Selbstauskunft Jarne Ostendorp.pdf',
      'Selbstauskunft Selin Akgül.pdf',
    ]);
    expect(bogenDateinamen({ ...ZWEI, personen: [JARNE] })).toEqual([
      'Selbstauskunft Jarne Ostendorp.pdf',
    ]);
  });

  it('Blöcke: ohne Frage 3, WBS unter HAUSHALT nur mit Antwort', () => {
    const b = bogenBloecke(JARNE, ZWEI.hh, '2026-11-25T10:00:00.000Z');
    const ids = b.flatMap((x) => x.zeilen.map((z) => z.id));
    expect(ids).not.toContain('rueckstand_monate');
    expect(ids).not.toContain('kuendigung');
    expect(b.find((x) => x.id === 'haushalt')?.zeilen.map((z) => z.id)).toEqual([
      'personenzahl',
      'wbs',
    ]);
    const ohne = bogenBloecke(JARNE, { ...ZWEI.hh, wbs: null }, '2026-11-25T10:00:00.000Z');
    expect(ohne.flatMap((x) => x.zeilen.map((z) => z.id))).not.toContain('wbs');
  });

  it('E18: eine Datei mit zwei Seiten, Name je Seite im Fuß, kein Rollenwort; je Person eine Seite', async () => {
    const [eine] = await bogenPdfBauen(ZWEI, schriften, new Date(2026, 10, 25));
    expect(eine!.seiten).toEqual(['Jarne Ostendorp', 'Selin Akgül']);
    const texte = (await textJeSeite(eine!.bytes)).map((t) => t.replace(/\s+/g, ' '));
    expect(texte[0]).toContain('Seite 1 von 2');
    expect(texte[1]).toContain('Selin Akgül');
    expect(texte[1]).toContain('Seite 2 von 2');
    expect(texte[0]).not.toContain('Im Mietvertrag.');
    expect(texte[0]).toContain('Wohnberechtigungsschein');
    expect(texte[0]).not.toMatch(/Mietzahlungspflicht/);
    const je = await bogenPdfBauen({ ...ZWEI, pdf: 'je' }, schriften, new Date(2026, 10, 25));
    expect(je.map((d) => d.seiten)).toEqual([['Jarne Ostendorp'], ['Selin Akgül']]);
    // Gegenprobe: Jarnes Datei hat nicht Selins Bogen.
    expect((await textJeSeite(je[0]!.bytes)).join(' ')).not.toContain('Selin');
  });
});

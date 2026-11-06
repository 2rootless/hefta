import fontkit from '@cantoo/fontkit';
import { describe, expect, it } from 'vitest';
import { pdfSchriften } from '../test/hilfen';
import {
  gleicherName,
  haushaltsZeile,
  imPdfSchreibbar,
  lateinFehlt,
  nameImPdf,
  nameMappeAus,
} from './namen';

describe('Namensabgleich', () => {
  it('erkennt denselben Namen trotz Schreibweise', () => {
    expect(
      gleicherName(
        { vorname: 'jonas', nachname: 'BECKER' },
        { vorname: 'Jonas', nachname: 'Becker' },
      ),
    ).toBe(true);
    expect(
      gleicherName(
        { vorname: 'Juergen', nachname: 'Strasser' },
        { vorname: 'Jürgen', nachname: 'Straßer' },
      ),
    ).toBe(true);
    expect(
      gleicherName(
        { vorname: 'Anna Lena', nachname: 'Muster' },
        { vorname: 'Anna-Lena', nachname: 'Muster' },
      ),
    ).toBe(true);
  });

  it('schlägt nichts vor, solange ein Teil fehlt oder anders ist', () => {
    expect(
      gleicherName({ vorname: 'Jonas', nachname: '' }, { vorname: 'Jonas', nachname: 'Becker' }),
    ).toBe(false);
    expect(
      gleicherName(
        { vorname: 'Jonas', nachname: 'Beck' },
        { vorname: 'Jonas', nachname: 'Becker' },
      ),
    ).toBe(false);
  });
});

describe('Name im PDF (K8)', () => {
  it('Latein, Latein erweitert und Vietnamesisch gehen, andere Schriften nicht', () => {
    for (const name of ['Wiśniewski', 'Őrsi', 'Dvořák', 'Çağlar', 'Nguyễn Thị Ánh', 'O’Brien'])
      expect(imPdfSchreibbar(name), name).toBe(true);
    for (const name of ['Олена', 'Ελένη', 'سارة', '王小明', 'Müller 王'])
      expect(imPdfSchreibbar(name), name).toBe(false);
    // Auf dem Mac kommen Akzente oft als eigene Zeichen.
    expect(imPdfSchreibbar('Jose\u0301')).toBe(true);
  });

  it('Was als schreibbar gilt, steht wirklich in allen drei Schriftschnitten', () => {
    const schriften = pdfSchriften();
    const schnitte = [schriften.regular, schriften.bold, schriften.titel].map((daten) =>
      fontkit.create(daten as never),
    ) as unknown as { hasGlyphForCodePoint: (c: number) => boolean }[];
    const fehlend: string[] = [];
    for (let c = 0x20; c < 0x2100; c++) {
      if (!imPdfSchreibbar(String.fromCodePoint(c))) continue;
      // Geschrieben wird die NFC-Form, wie im PDF.
      const z = String.fromCodePoint(c).normalize('NFC').codePointAt(0)!;
      if (schnitte.some((f) => !f.hasGlyphForCodePoint(z))) fehlend.push(c.toString(16));
    }
    expect(fehlend).toEqual([]);
  });

  it('Fehlt der lateinische Name, sagt es das Formular; ist er da, gilt er nur im PDF', () => {
    const olena = { vorname: 'Олена', nachname: 'Коваленко' };
    expect(lateinFehlt(olena)).toBe(true);
    expect(lateinFehlt({ ...olena, nameMappe: { vorname: 'Olena', nachname: '' } })).toBe(true);
    expect(lateinFehlt({ ...olena, nameMappe: { vorname: 'Олена', nachname: 'Kovalenko' } })).toBe(
      true,
    );
    const mitLatein = { ...olena, nameMappe: { vorname: 'Olena', nachname: 'Kovalenko' } };
    expect(lateinFehlt(mitLatein)).toBe(false);
    expect(nameImPdf(mitLatein)).toEqual({ vorname: 'Olena', nachname: 'Kovalenko' });
    expect(nameImPdf({ vorname: 'Max', nachname: 'Mustermann' }).nachname).toBe('Mustermann');
  });

  it('Wird der Name wieder schreibbar, zählt der lateinische nicht mehr', () => {
    const anders = {
      vorname: 'Olena',
      nachname: 'Kovalenko',
      nameMappe: { vorname: 'Alt', nachname: 'Name' },
    };
    expect(nameMappeAus(anders)).toBeNull();
    expect(nameImPdf(anders).vorname).toBe('Olena');
  });
});

describe('P18: Haushalt in der Fußzeile', () => {
  const p = (vorname: string, nachname: string) => ({ vorname, nachname });

  it('gleicher Nachname: Vornamen, dann der eine Nachname', () => {
    expect(haushaltsZeile([p('Max', 'Mustermann')])).toBe('Max Mustermann');
    expect(haushaltsZeile([p('Max', 'Mustermann'), p('Lea', 'Mustermann')])).toBe(
      'Max und Lea Mustermann',
    );
    expect(
      haushaltsZeile([p('Max', 'Mustermann'), p('Lea', 'Mustermann'), p('Tom', 'Mustermann')]),
    ).toBe('Max, Lea und Tom Mustermann');
  });

  it('zwei verschiedene: beide ganz', () => {
    expect(haushaltsZeile([p('Max', 'Mustermann'), p('Lea', 'Schmidt')])).toBe(
      'Max Mustermann und Lea Schmidt',
    );
  });

  it('ab drei, nicht alle gleich: nur die Nachnamen, keiner zusammengezogen oder gekürzt', () => {
    expect(
      haushaltsZeile([
        p('Maximilian-Alexander', 'Müller-Lüdenscheidt'),
        p('Bartholomäus', 'Wiśniewski-Kowalczyk'),
        p('Jonas', 'Becker'),
      ]),
    ).toBe('Müller-Lüdenscheidt, Wiśniewski-Kowalczyk und Becker');
    expect(haushaltsZeile([p('Max', 'Müller'), p('Lea', 'Müller'), p('Tom', 'Becker')])).toBe(
      'Müller und Becker',
    );
  });

  it('Ohne Nachnamen bleibt niemand weg', () => {
    expect(haushaltsZeile([p('Max', ''), p('Lea', 'Schmidt')])).toBe('Max und Lea Schmidt');
    expect(haushaltsZeile([p('Max', ''), p('Lea', 'Schmidt'), p('Tom', 'Becker')])).toBe(
      'Max, Schmidt und Becker',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  ausstellungstag,
  datenFinden,
  datenZurAuswahl,
  monatFinden,
  type TextStueck,
} from './datumErkennen';

const HEUTE = new Date(2026, 10, 6);

/** Eine Zeile aus Stücken, grob wie aus einem PDF: Breite passend zur Länge. */
function zeile(y: number, ...teile: string[]): TextStueck[] {
  let x = 0.1;
  return teile.map((text) => {
    const breite = text.length * 0.012;
    const s = { text, x, y, breite, hoehe: 0.015 };
    x += breite + 0.006;
    return s;
  });
}

describe('Daten finden', () => {
  it('liest die üblichen deutschen Schreibweisen', () => {
    expect(datenFinden(zeile(0.1, 'Datum: 20.10.2026'), HEUTE)[0]?.tag).toBe('2026-10-20');
    expect(datenFinden(zeile(0.1, 'am 3. Oktober 2026'), HEUTE)[0]?.tag).toBe('2026-10-03');
    expect(datenFinden(zeile(0.1, 'am 3.Okt. 2026'), HEUTE)[0]?.tag).toBe('2026-10-03');
    expect(datenFinden(zeile(0.1, 'vom 05.09.26'), HEUTE)[0]?.tag).toBe('2026-09-05');
    expect(datenFinden(zeile(0.1, '2026-08-14'), HEUTE)[0]?.tag).toBe('2026-08-14');
  });

  it('findet ein Datum, das über mehrere Stücke verteilt ist', () => {
    const funde = datenFinden(zeile(0.1, 'Ausgestellt am', '20.', 'Oktober', '2026'), HEUTE);
    expect(funde.map((f) => f.tag)).toEqual(['2026-10-20']);
    // Der Fund liegt auf dem Datum, nicht auf „Ausgestellt am“.
    expect(funde[0]!.x).toBeGreaterThan(0.25);
    expect(funde[0]!.breite).toBeGreaterThan(0.1);
  });

  it('nimmt keine unmöglichen, künftigen oder uralten Tage', () => {
    expect(datenFinden(zeile(0.1, '31.02.2026'), HEUTE)).toEqual([]);
    expect(datenFinden(zeile(0.1, '01.12.2030'), HEUTE)).toEqual([]);
    expect(datenFinden(zeile(0.1, '01.12.1985'), HEUTE)).toEqual([]);
    expect(datenFinden(zeile(0.1, 'IBAN 12.34.5678.90'), HEUTE)).toEqual([]);
  });
});

describe('Ausstellungstag vorschlagen', () => {
  const funde = (...zeilen: TextStueck[][]) =>
    zeilen.flatMap((z) => datenFinden(z, HEUTE).map((f) => ({ ...f, seite: 1 })));

  it('bevorzugt die Zeile mit passendem Wort', () => {
    const f = funde(zeile(0.1, 'Mietbeginn 01.03.2024'), zeile(0.2, 'Ausgestellt am 20.10.2026'));
    expect(ausstellungstag(f)?.tag).toBe('2026-10-20');
  });

  it('nimmt das einzige Datum, auch ohne Wort', () => {
    expect(ausstellungstag(funde(zeile(0.1, 'Hamburg, 12.09.2026')))?.tag).toBe('2026-09-12');
  });

  it('rät nicht, wenn es unklar bleibt', () => {
    const f = funde(zeile(0.1, 'Einzug 01.03.2024'), zeile(0.2, 'Auszug 01.05.2025'));
    expect(ausstellungstag(f)).toBeNull();
  });

  it('übersieht Geburtstage', () => {
    expect(ausstellungstag(funde(zeile(0.1, 'geboren am 03.04.2001')))).toBeNull();
  });
});

describe('Daten zur Auswahl', () => {
  it('nennt die Wörter davor, bis zum Satzzeichen oder zum Datum davor', () => {
    const davor = (text: string) => datenFinden(zeile(0.1, text), HEUTE).map((f) => f.davor);
    expect(davor('Ausgestellt am 20.10.2026')).toEqual(['Ausgestellt am']);
    expect(davor('Auskunft, ausgestellt am 20.10.2026')).toEqual(['ausgestellt am']);
    expect(davor('Datum: 20.10.2026')).toEqual(['Datum']);
    expect(davor('Einzug 01.03.2024, Auszug 15.05.2025')).toEqual(['Einzug', 'Auszug']);
    expect(davor('20.10.2026')).toEqual(['']);
    expect(davor('Das Schreiben der Bank vom 20.10.2026')).toEqual(['der Bank vom']);
  });

  it('nimmt jeden Tag einmal, in Reihenfolge des Dokuments, höchstens acht', () => {
    const funde = datenFinden(
      [
        ...zeile(0.1, 'Stand 20.10.2026'),
        ...zeile(0.2, 'Kundin seit 03.04.2019'),
        ...zeile(0.3, 'Stand 20.10.2026'),
      ],
      HEUTE,
    );
    expect(datenZurAuswahl(funde).map((f) => f.tag)).toEqual(['2026-10-20', '2019-04-03']);
    const viele = Array.from({ length: 12 }, (_, i) => ({
      ...funde[0]!,
      tag: `2020-01-${10 + i}`,
    }));
    expect(datenZurAuswahl(viele)).toHaveLength(8);
  });
});

describe('Abrechnungsmonat finden', () => {
  it('liest Monatsnamen und Ziffern', () => {
    expect(monatFinden(zeile(0.1, 'Gehaltsabrechnung Oktober 2026'), HEUTE)).toBe('2026-10');
    expect(monatFinden(zeile(0.1, 'Abrechnungsmonat 09/2026'), HEUTE)).toBe('2026-09');
  });

  it('bevorzugt die Zeile mit passendem Wort', () => {
    const stuecke = [...zeile(0.1, 'Eintritt März 2020'), ...zeile(0.2, 'Entgelt für August 2026')];
    expect(monatFinden(stuecke, HEUTE)).toBe('2026-08');
  });

  it('rät nicht bei mehreren Monaten ohne Bezug', () => {
    const stuecke = [...zeile(0.1, 'März 2020'), ...zeile(0.2, 'April 2021')];
    expect(monatFinden(stuecke, HEUTE)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { mrzForm, mrzLesen, pruefziffer, td1Bauen, td3Bauen } from './mrz';

// Testfälle nur aus der öffentlichen Norm ICAO 9303 (Muster „Utopia“, Anna Maria Eriksson) und aus
// erfundenen Musterdaten (Musterausweis aus DP46b K3, „IDX“). Keine Regeln oder Daten von anderswo.
const ICAO_TD1 = [
  'I<UTOD231458907<<<<<<<<<<<<<<<',
  '7408122F1204159UTO<<<<<<<<<<<6',
  'ERIKSSON<<ANNA<MARIA<<<<<<<<<<',
];
const ICAO_TD2 = ['I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<', 'D231458907UTO7408122F1204159<<<<<<<6'];
const ICAO_TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
];
const MUSTER = [
  'IDX<<MUSTER0A15<<<<<<<<<<<<<<<',
  '9503124<3108011D<<<<<<<<<<<<<0',
  'MUSTERMANN<<LEA<<<<<<<<<<<<<<<',
];

/** Zeile i (strikte Indizes: fehlt sie, leer). */
const zl = (zeilen: readonly string[], i: number): string => zeilen[i] ?? '';

function ersetzt(zeilen: string[], zeile: number, stelle: number, zeichen: string): string[] {
  return zeilen.map((z, i) =>
    i === zeile ? z.slice(0, stelle) + zeichen + z.slice(stelle + 1) : z,
  );
}

describe('Prüfziffer nach ICAO 9303 Teil 3', () => {
  it('rechnet mit 7, 3, 1 und Füllzeichen als 0', () => {
    expect(pruefziffer('D23145890')).toBe('7');
    expect(pruefziffer('740812')).toBe('2');
    expect(pruefziffer('120415')).toBe('9');
    expect(pruefziffer('<<<')).toBe('0');
  });
});

describe('Form der Zeilen', () => {
  it('erkennt drei zu 30, zwei zu 36 und zwei zu 44', () => {
    expect(mrzForm(ICAO_TD1)).toBe('TD1');
    expect(mrzForm(ICAO_TD2)).toBe('TD2');
    expect(mrzForm(ICAO_TD3)).toBe('TD3');
    expect(mrzForm(ICAO_TD1.slice(0, 2))).toBeNull();
    expect(mrzForm([zl(ICAO_TD3, 0), zl(ICAO_TD2, 1)])).toBeNull();
  });
});

describe('Zeilen unten lesen', () => {
  it.each([
    ['TD1', ICAO_TD1, 'D23145890'],
    ['TD2', ICAO_TD2, 'D23145890'],
    ['TD3', ICAO_TD3, 'L898902C3'],
    ['Musterausweis', MUSTER, 'MUSTER0A1'],
  ])('%s aus der Norm bzw. dem Muster ist sicher gelesen', (_, zeilen, nummer) => {
    const e = mrzLesen(zeilen);
    expect(e.ok).toBe(true);
    if (e.ok) expect(e.nummer).toBe(nummer);
  });

  it('gibt die Felder des Musterausweises mit ihrer Lage zurück (DP46b K3)', () => {
    const e = mrzLesen(MUSTER);
    if (!e.ok) throw new Error('nicht gelesen');
    const lage = Object.fromEntries(e.felder.map((f) => [f.name, [f.zeile, f.von, f.bis, f.wert]]));
    expect(lage.nummer).toEqual([0, 5, 14, 'MUSTER0A1']);
    expect(lage.nummerPruef).toEqual([0, 14, 15, '5']);
    expect(lage.geburt).toEqual([1, 0, 6, '950312']);
    expect(lage.geburtPruef).toEqual([1, 6, 7, '4']);
    expect(lage.staat).toEqual([1, 15, 18, 'D<<']);
    expect(lage.gesamtPruef).toEqual([1, 29, 30, '0']);
    expect(lage.ablauf).toEqual([1, 8, 14, '310801']);
    expect(lage.name).toEqual([2, 0, 30, zl(MUSTER, 2)]);
  });

  it('TD3: persönliche Nummer und Gesamtprüfziffer', () => {
    const e = mrzLesen(ICAO_TD3);
    if (!e.ok) throw new Error('nicht gelesen');
    const f = Object.fromEntries(e.felder.map((x) => [x.name, x.wert]));
    expect(f.zusatz2).toBe('ZE184226B<<<<<');
    expect(f.zusatzPruef).toBe('1');
    expect(f.gesamtPruef).toBe('0');
  });

  it('Bau der Muster ergibt dieselben Zeilen wie DP46b', () => {
    expect(
      td1Bauen({
        art: 'ID',
        aussteller: 'X',
        nummer: 'MUSTER0A1',
        geburt: '950312',
        geschlecht: '<',
        ablauf: '310801',
        staat: 'D',
        name: 'MUSTERMANN<<LEA',
      }),
    ).toEqual(MUSTER);
    const pass = td3Bauen({
      art: 'P',
      aussteller: 'UTO',
      name: 'MUSTERMANN<<LEA',
      nummer: 'MUSTER0P2',
      staat: 'UTO',
      geburt: '950312',
      geschlecht: 'F',
      ablauf: '310801',
    });
    expect(mrzLesen(pass).ok).toBe(true);
  });

  it('lange Nummer im TD1 (Teil 5): Rest im Zusatzfeld, Prüfziffer dahinter', () => {
    const zeilen = td1Bauen({
      art: 'I',
      aussteller: 'UTO',
      nummer: 'D23145890',
      geburt: '740812',
      geschlecht: 'F',
      ablauf: '120415',
      staat: 'UTO',
      name: 'ERIKSSON<<ANNA<MARIA',
    });
    // Nummer D23145890123 (12 Zeichen): neun vorn, Füllzeichen, dann „123“ und die Prüfziffer.
    const lang = 'D23145890123';
    const a =
      zl(zeilen, 0).slice(0, 5) +
      lang.slice(0, 9) +
      '<' +
      lang.slice(9) +
      pruefziffer(lang) +
      '<'.repeat(11);
    const b0 = zl(zeilen, 1).slice(0, 29);
    const b =
      b0 + pruefziffer(a.slice(5, 30) + b0.slice(0, 7) + b0.slice(8, 15) + b0.slice(18, 29));
    const e = mrzLesen([a, b, zl(zeilen, 2)]);
    expect(e.ok).toBe(true);
    if (e.ok) {
      expect(e.nummer).toBe(lang);
      const nr = e.felder.find((f) => f.name === 'nummer');
      expect([nr?.von, nr?.bis]).toEqual([5, 18]);
    }
  });
});

describe('Rückfall (E124 a, DP47b K4): passt nicht zur erkannten Form', () => {
  it.each([
    ['Ausweisnummer', 0, 14],
    ['Geburtsdatum', 1, 6],
    ['Ablaufdatum', 1, 14],
    ['Gesamtprüfziffer', 1, 29],
  ])('falsche Prüfziffer: %s', (_, zeile, stelle) => {
    const alt = zl(MUSTER, zeile).charAt(stelle);
    const neu = alt === '9' ? '8' : String((Number(alt) + 1) % 10);
    const e = mrzLesen(ersetzt(MUSTER, zeile, stelle, neu));
    expect(e).toMatchObject({ ok: false, grund: 'pruefziffer' });
  });

  it('ein falsch gelesenes Zeichen in der Nummer fällt über die Prüfziffer auf', () => {
    expect(mrzLesen(ersetzt(MUSTER, 0, 11, 'O'))).toMatchObject({
      ok: false,
      grund: 'pruefziffer',
    });
  });

  it('fehlende Zeichen oder Zeilen', () => {
    expect(mrzLesen([zl(MUSTER, 0), zl(MUSTER, 1).slice(0, 29), zl(MUSTER, 2)])).toMatchObject({
      ok: false,
      grund: 'form',
    });
    expect(mrzLesen(MUSTER.slice(0, 2))).toMatchObject({ ok: false, grund: 'form' });
    expect(mrzLesen([...MUSTER, zl(MUSTER, 2)])).toMatchObject({ ok: false, grund: 'form' });
  });

  it('Zeichen außerhalb der Norm', () => {
    expect(mrzLesen(ersetzt(MUSTER, 2, 3, 'ß'))).toMatchObject({ ok: false, grund: 'zeichen' });
    expect(mrzLesen(ersetzt(MUSTER, 0, 20, ' '))).toMatchObject({ ok: false, grund: 'zeichen' });
  });

  it('ein Füllzeichen an der Stelle einer Prüfziffer ist falsch, auch wenn die Summe 0 wäre', () => {
    // Die Gesamtprüfziffer des Musters ist 0; verschluckt das Lesen sie, darf „<“ nicht als 0 durchgehen.
    expect(mrzLesen(ersetzt(MUSTER, 1, 29, '<'))).toMatchObject({
      ok: false,
      grund: 'pruefziffer',
    });
  });

  it('TD3: leere persönliche Nummer darf „<“ als Prüfziffer haben (Teil 4)', () => {
    const z = td3Bauen({
      art: 'P',
      aussteller: 'UTO',
      name: 'MUSTERMANN<<LEA',
      nummer: 'MUSTER0P2',
      staat: 'UTO',
      geburt: '950312',
      geschlecht: 'F',
      ablauf: '310801',
    });
    expect(mrzLesen(z).ok).toBe(true);
    expect(mrzLesen(ersetzt(z, 1, 42, '<')).ok).toBe(true);
  });

  it('Gegenprobe: Ein Lesen, das Prüfziffern übergeht, wäre bei falscher Ziffer ok und wird hier rot', () => {
    const falsch = ersetzt(MUSTER, 1, 6, '5');
    const ohnePruefung = mrzForm(falsch) !== null && falsch.every((z) => /^[A-Z0-9<]+$/.test(z));
    expect(ohnePruefung).toBe(true);
    expect(mrzLesen(falsch).ok).toBe(false);
  });
});

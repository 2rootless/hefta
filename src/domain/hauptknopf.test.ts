import { describe, expect, it } from 'vitest';
import { hauptknopf, type TeilId } from './selbstauskunft';

// K9 (DP96, Abschnitt 3, Weg B): die sechs Fälle der Tabelle.
const stand = (offen: TeilId[], ohne: TeilId[] = []) =>
  (['kontakt', 'einkommen', 'fragen', 'haushalt'] as TeilId[])
    .filter((id) => !ohne.includes(id))
    .map((id) => ({ id, fertig: !offen.includes(id) }));

describe('K9: Hauptknopf der Selbstauskunft', () => {
  it('Fall 1: neu, Teil 1 offen → Weiter, Einkommen', () => {
    expect(hauptknopf(stand(['kontakt', 'einkommen', 'fragen', 'haushalt']), 'kontakt')).toEqual({
      art: 'weiter',
      ziel: 'einkommen',
    });
  });
  it('Fall 2: Einkommen offen, Netto leer → Weiter, Fragen (der Fall aus K9)', () => {
    expect(hauptknopf(stand(['einkommen', 'fragen', 'haushalt']), 'einkommen')).toEqual({
      art: 'weiter',
      ziel: 'fragen',
    });
  });
  it('Fall 3: Einkommen ausgefüllt, Teil 3 und 4 offen → wie Fall 2', () => {
    expect(hauptknopf(stand(['fragen', 'haushalt']), 'einkommen')).toEqual({
      art: 'weiter',
      ziel: 'fragen',
    });
  });
  it('Fall 4: letzter Teil ausgefüllt, Einkommen übersprungen → Weiter, Einkommen (wieder von vorn)', () => {
    expect(hauptknopf(stand(['einkommen']), 'haushalt')).toEqual({
      art: 'weiter',
      ziel: 'einkommen',
    });
  });
  it('Fall 5: nur noch Einkommen offen und geöffnet → blasses Fertig', () => {
    expect(hauptknopf(stand(['einkommen']), 'einkommen')).toEqual({ art: 'blass' });
  });
  it('Fall 6: alles ausgefüllt → Fertig, auch beim Ändern', () => {
    expect(hauptknopf(stand([]), 'einkommen')).toEqual({ art: 'fertig' });
    expect(hauptknopf(stand([]), null)).toEqual({ art: 'fertig' });
  });
  it('Bürgen haben keinen Teil „Haushalt“; alles zu → erster offener Teil', () => {
    expect(hauptknopf(stand(['fragen'], ['haushalt']), 'fragen')).toEqual({ art: 'blass' });
    expect(hauptknopf(stand(['einkommen', 'fragen']), null)).toEqual({
      art: 'weiter',
      ziel: 'einkommen',
    });
  });
  it('Gegenprobe: Netto leer (Fall 2) ist nie ein dunkles „Fertig“', () => {
    expect(hauptknopf(stand(['einkommen', 'fragen', 'haushalt']), 'einkommen').art).not.toBe(
      'fertig',
    );
  });
});

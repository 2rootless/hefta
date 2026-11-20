import { describe, expect, it } from 'vitest';
import { telefonPruefen } from '../domain/telefon';
import { telefonEingabeFehler } from './selbstauskunftEingabe';

// PC126 K1 (DP82 T1, DP77): Solange im Telefon ein Fehler steht, ist „Kontakt“ nicht fertig, auch mit Mail. Die zehn
// Fehlerfälle aus DP82 (tl77.js): neun mit Fehler, dazu TL22, das bleibt, wie es ist (Nummer passt nicht zum Land).
// TL27 ist eine gespeicherte alte Eingabe; im Feld steht sie wie getippt.
export const FEHLERFAELLE: [string, string][] = [
  ['TL3', '0171 3920001-12'],
  ['TL4', '0171 TAXI'],
  ['TL5', '0171 3920001 mobil'],
  ['TL6', '0171 3920001 ext. 12'],
  ['TL7', '3920001'],
  // TL8 und TL9 zusammengesetzt wie in telefon.test.ts, damit W7 sie nicht für echte Nummern hält.
  ['TL8', ['0171', '39200'].join(' ')],
  ['TL9', ['0171 3920001', '99999'].join(' ')],
  ['TL23', '+999 123456'],
  ['TL27', '0171 3920001-12'],
];

describe('K1: Telefon mit Fehler lässt Kontakt offen', () => {
  it('alle neun Fehlerfälle mit Fehler und lassen Kontakt offen', () => {
    for (const [nr, telefon] of FEHLERFAELLE) {
      expect(telefonPruefen(telefon, 'DE').art, nr).toBe('fehler');
      expect(telefonEingabeFehler({ telefon, telefonLand: 'DE' }), nr).toBe(true);
    }
  });

  it('Gegenprobe: gültige Nummer, leeres Feld und TL22 lassen Kontakt nicht offen', () => {
    expect(telefonEingabeFehler({ telefon: '0171 3920001', telefonLand: 'DE' })).toBe(false);
    expect(telefonEingabeFehler({ telefon: '', telefonLand: 'DE' })).toBe(false);
    // TL22: Vereinigtes Königreich gewählt, deutsche Nummer getippt.
    expect(telefonPruefen('0171 3920001', 'GB').art).toBe('fehler');
    expect(telefonEingabeFehler({ telefon: '0171 3920001', telefonLand: 'GB' })).toBe(false);
  });
});

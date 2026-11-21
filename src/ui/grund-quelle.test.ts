import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { einheit } from './selbstauskunftEingabe';

// DP116 (PC185): Selbstauskunft und Rutsch nehmen den Satz über dem blassen Knopf aus derselben Quelle, grundFuer.
describe('DP116: eine Quelle für den Satz, Feldnamen ohne Trennung', () => {
  it('Seite der Selbstauskunft und Rutsch rufen beide grundFuer', () => {
    for (const datei of ['src/screens/SelbstauskunftSeite.svelte', 'src/screens/Rutsch.svelte'])
      expect(readFileSync(datei, 'utf8'), datei).toMatch(/grundFuer\(/);
  });

  it('einheit(): Leerzeichen und Bindestrich geschützt; Gegenprobe: der normale Bindestrich bricht', () => {
    const e = einheit('E-Mail');
    expect(e).not.toContain('-');
    expect(e.charCodeAt(1)).toBe(0x2011);
    expect(einheit('Netto im Monat')).not.toContain(' ');
    expect('E-Mail'.charCodeAt(1)).toBe(0x2d);
  });
});

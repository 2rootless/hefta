import { describe, expect, it } from 'vitest';
import { uhrStellen } from './uhrStellen';

// PC209: Store-Bild 08 mit der Uhr am 18. November (DP138, W10).
describe('uhrStellen', () => {
  it('stellt new Date() und Date.now() auf das Ziel, feste Daten bleiben', () => {
    const ort = { Date };
    const ziel = new Date(2026, 10, 18, 10, 0);
    const echt = uhrStellen(ziel, ort);
    const jetzt = new ort.Date();
    expect(Math.abs(jetzt.getTime() - ziel.getTime())).toBeLessThan(1000);
    expect(Math.abs(ort.Date.now() - ziel.getTime())).toBeLessThan(1000);
    expect(new ort.Date('2026-08-25').toISOString()).toBe('2026-08-25T00:00:00.000Z');
    expect(new ort.Date(2026, 7, 25).getDate()).toBe(25);
    expect(jetzt instanceof echt).toBe(true);
    expect(ort.Date.UTC(2026, 0, 1)).toBe(Date.UTC(2026, 0, 1));
  });

  it('Gegenprobe: ohne Stellen liegt heute nicht am 18. November 2026', () => {
    const ort = { Date };
    expect(
      Math.abs(new ort.Date().getTime() - new Date(2026, 10, 18, 10, 0).getTime()),
    ).toBeGreaterThan(60_000);
  });
});

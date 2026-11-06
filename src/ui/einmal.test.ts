import { describe, expect, it } from 'vitest';
import { einmal } from './einmal';

describe('einmal', () => {
  it('lässt den zweiten Aufruf verfallen, solange der erste läuft, und danach wieder zu', async () => {
    let laeufe = 0;
    let frei!: () => void;
    const aktion = einmal(async (n: number) => {
      laeufe += n;
      await new Promise<void>((ok) => (frei = ok));
    });
    const erster = aktion(1);
    await aktion(10);
    expect(laeufe).toBe(1);
    frei();
    await erster;
    const dritter = aktion(100);
    frei();
    await dritter;
    expect(laeufe).toBe(101);
  });

  it('gibt nach einem Fehler wieder frei', async () => {
    const aktion = einmal(async () => {
      throw new Error('kaputt');
    });
    await expect(aktion()).rejects.toThrow('kaputt');
    await expect(aktion()).rejects.toThrow('kaputt');
  });
});

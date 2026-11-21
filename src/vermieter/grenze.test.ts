import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRENZE_BYTES, zuGross } from './grenze';
import { groesseText } from './regel';

describe('PC187: Grenze 100 MB auf der Vermieterseite', () => {
  it('genau 100 000 000 Byte gehen, ein Byte mehr nicht', () => {
    expect(GRENZE_BYTES).toBe(100_000_000);
    expect(zuGross(100_000_000)).toBe(false);
    expect(zuGross(100_000_001)).toBe(true);
    expect(groesseText(GRENZE_BYTES)).toBe(`100,0${String.fromCharCode(0xa0)}MB`);
  });

  it('Gegenprobe: 100,5 MB sind zu groß; mit der alten Grenze (100 × 1024 × 1024) gingen sie noch durch', () => {
    expect(zuGross(100_500_000)).toBe(true);
    expect(100_500_000 > 100 * 1024 * 1024).toBe(false);
  });

  it('das Lesen nimmt diese Grenze', () => {
    const lesen = readFileSync('src/vermieter/lesen.ts', 'utf-8');
    expect(lesen).toContain("from './grenze'");
    expect(lesen).not.toContain('100 * 1024 * 1024');
  });
});

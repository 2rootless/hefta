import { describe, expect, it } from 'vitest';
import { speicherIstKnapp } from './hinweise.svelte';

const MB = 1024 * 1024;

describe('Speicher knapp (G5)', () => {
  it('gilt unter 50 MB frei', () => {
    expect(speicherIstKnapp(980 * MB, 1000 * MB)).toBe(true);
    expect(speicherIstKnapp(900 * MB, 1000 * MB)).toBe(false);
    expect(speicherIstKnapp(0, 0)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { dreiMonateHer, heuteTag, neueUnterlagen, tageSeit } from './zeit';

describe('tageSeit', () => {
  it('zählt Kalendertage, nicht 24-Stunden-Blöcke', () => {
    expect(tageSeit(new Date(2026, 9, 30, 23, 0), new Date(2026, 9, 31, 1, 0))).toBe(1);
    expect(tageSeit(new Date(2026, 9, 31, 1, 0), new Date(2026, 9, 31, 23, 0))).toBe(0);
  });

  it('übersteht die Zeitumstellung', () => {
    expect(tageSeit(new Date(2026, 9, 24, 12), new Date(2026, 9, 26, 12))).toBe(2);
  });
});

describe('heuteTag', () => {
  it('nimmt den lokalen Tag, auch kurz nach Mitternacht', () => {
    expect(heuteTag(new Date(2026, 10, 1, 0, 15))).toBe('2026-11-01');
    expect(heuteTag(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });
});

describe('neueUnterlagen', () => {
  const versionen = [
    { dokumentId: 'gehalt', createdAt: '2026-11-01' },
    { dokumentId: 'gehalt', createdAt: '2026-11-02' },
    { dokumentId: 'bonitaet', createdAt: '2026-11-03' },
    { dokumentId: 'alt', createdAt: '2026-09-01' },
  ];

  it('zählt Unterlagen, nicht Versionen', () => {
    expect(neueUnterlagen(versionen, '2026-10-01')).toBe(2);
    expect(neueUnterlagen(versionen, null)).toBe(3);
    expect(neueUnterlagen(versionen, '2026-12-01')).toBe(0);
  });
});

describe('dreiMonateHer', () => {
  it('gilt ab dem gleichen Tag drei Monate später', () => {
    expect(dreiMonateHer(new Date(2026, 7, 6), new Date(2026, 10, 5))).toBe(false);
    expect(dreiMonateHer(new Date(2026, 7, 6), new Date(2026, 10, 6))).toBe(true);
  });
});

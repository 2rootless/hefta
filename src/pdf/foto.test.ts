import { describe, expect, it } from 'vitest';
import { seiteFuerFoto, verkleinernLohnt } from './foto';

describe('Fotos als PDF', () => {
  it('füllt A4, wenn das Foto fast A4 ist, hoch und quer', () => {
    expect(seiteFuerFoto(1654, 2339)).toEqual({ breite: 595.28, hoehe: 841.89 });
    expect(seiteFuerFoto(2339, 1700)).toEqual({ breite: 841.89, hoehe: 595.28 });
  });

  it('behält andere Seitenverhältnisse und passt sie in A4', () => {
    const kassenzettel = seiteFuerFoto(800, 2400);
    expect(kassenzettel.hoehe).toBeCloseTo(841.89, 1);
    expect(kassenzettel.breite).toBeCloseTo(280.6, 1);
    const ausweis = seiteFuerFoto(1700, 1070);
    expect(ausweis.breite).toBeCloseTo(841.89, 1);
    expect(ausweis.hoehe).toBeLessThan(595.28);
  });

  it('schlägt Verkleinern nur bei großen Dateien vor', () => {
    expect(verkleinernLohnt(24.6 * 1024 * 1024, 12)).toBe(true);
    expect(verkleinernLohnt(3 * 1024 * 1024, 2)).toBe(true);
    expect(verkleinernLohnt(800 * 1024, 2)).toBe(false);
  });
});

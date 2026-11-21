import { describe, expect, it } from 'vitest';
import { serieSatz } from './texte';

// K10 (DP96, Abschnitt 4, Wortlaut F): Der Satz im Rutsch nennt jeden Monat, der drin ist, und jeden, der fehlt.
const fenster = (monate: string[], drin: string[]) =>
  monate.map((monat) => ({ monat, da: drin.includes(monat) }));
const SON = ['2026-09', '2026-10', '2026-11'];

describe('K10: Satz der Serie im Rutsch', () => {
  it('die vier Fälle aus DP96 wörtlich', () => {
    expect(serieSatz(fenster(SON, ['2026-10', '2026-11']))).toBe(
      'Oktober und November sind drin. September fehlt noch.',
    );
    expect(serieSatz(fenster(SON, ['2026-09', '2026-11']))).toBe(
      'September und November sind drin. Oktober fehlt noch.',
    );
    expect(serieSatz(fenster(SON, ['2026-09', '2026-10']))).toBe(
      'September und Oktober sind drin. November fehlt noch.',
    );
    expect(serieSatz(fenster(SON, ['2026-10']))).toBe(
      'Oktober ist drin. September und November fehlen noch.',
    );
  });

  it('Kalenderfolge und ohne Jahr, auch über den Jahreswechsel und bei ungeordneter Eingabe', () => {
    const wechsel = [
      { monat: '2027-01', da: true },
      { monat: '2026-11', da: true },
      { monat: '2026-12', da: false },
    ];
    expect(serieSatz(wechsel)).toBe('November und Januar sind drin. Dezember fehlt noch.');
  });

  it('der Monat des Knopfs (neuester fehlender) steht immer im Satz', () => {
    for (const drin of [['2026-09'], ['2026-10'], ['2026-11'], ['2026-09', '2026-11']]) {
      const f = fenster(SON, drin);
      const knopf = f.filter((x) => !x.da).at(-1)!.monat;
      const name = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(
        new Date(Number(knopf.slice(0, 4)), Number(knopf.slice(5)) - 1, 1),
      );
      expect(serieSatz(f)).toContain(name);
    }
  });

  // Regel aus pruef97.py (K10-1): Jeder Monat des Fensters steht im Satz, der drin ist wie der fehlende.
  const fehltImSatz = (satz: string, f: { monat: string; da: boolean }[]) =>
    f
      .map((x) =>
        new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(
          new Date(Number(x.monat.slice(0, 4)), Number(x.monat.slice(5)) - 1, 1),
        ),
      )
      .filter((name) => !satz.includes(name));

  it('jeder Monat des Fensters steht im Satz, in allen Lücken', () => {
    for (const drin of [
      ['2026-09'],
      ['2026-10'],
      ['2026-11'],
      ['2026-09', '2026-11'],
      ['2026-10', '2026-11'],
    ]) {
      const f = fenster(SON, drin);
      expect(fehltImSatz(serieSatz(f), f), drin.join()).toEqual([]);
    }
  });

  it('Gegenprobe: der Satz von 2.0 wird bei einer Lücke in der Mitte rot', () => {
    const f = fenster(SON, ['2026-09', '2026-11']);
    // So stand es bis 2.1 (serieNoch): nur der neueste Monat, die Lücke ohne Namen.
    const alt = 'November ist drin. Noch ein Monat.';
    expect(fehltImSatz(alt, f)).toEqual(['September', 'Oktober']);
  });
});

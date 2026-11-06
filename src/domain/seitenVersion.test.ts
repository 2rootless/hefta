import { describe, expect, it } from 'vitest';
import type { DateiVersion } from './modell';
import {
  eigeneSeiten,
  letzteInMappe,
  seiteHeraus,
  seiteHinein,
  seiteUmschalten,
} from './seitenVersion';

const v = (teil: Partial<DateiVersion> = {}) =>
  ({ id: 'a', original: 'x', aufbereitet: null, seiten: null, ...teil }) as DateiVersion;

describe('Seiten einer Version', () => {
  it('ohne Angabe gehört die ganze Datei dazu', () => {
    expect(eigeneSeiten(v(), 3, [v()])).toEqual([0, 1, 2]);
  });

  it('eine Auswahl beim Hochladen: Die anderen Seiten gehören dazu, kommen aber nicht in die Mappe', () => {
    expect(eigeneSeiten(v({ seiten: [0] }), 3, [v({ seiten: [0] })])).toEqual([0, 1, 2]);
  });

  it('schon aufgeteilt: Nur die eigene Seite gehört dazu', () => {
    const juli = v({ seiten: [0] });
    const august = v({ id: 'b', seiten: [1] });
    expect(eigeneSeiten(juli, 3, [juli, august])).toEqual([0]);
  });

  it('umschalten nimmt aus der Mappe und wieder hinein, die Seite bleibt', () => {
    const aus = seiteUmschalten(v(), [0, 1, 2], 1);
    expect([aus.eigene, aus.seiten]).toEqual([
      [0, 1, 2],
      [0, 2],
    ]);
    const an = seiteUmschalten(aus, [0, 1, 2], 1);
    expect(an.seiten).toEqual([0, 1, 2]);
  });

  it('die letzte Seite in der Mappe lässt sich erkennen', () => {
    expect(letzteInMappe(v({ seiten: [2] }), [0, 2], 2)).toBe(true);
    expect(letzteInMappe(v({ seiten: [0, 2] }), [0, 2], 2)).toBe(false);
  });

  it('heraus: ohne Seite ist die Version weg, die letzte in der Mappe holt die übrigen hinein', () => {
    expect(seiteHeraus(v(), [0], 0)).toBeNull();
    expect(seiteHeraus(v({ seiten: [0] }), [0, 1], 0)?.seiten).toEqual([1]);
    expect(seiteHeraus(v(), [0, 1, 2], 1)?.eigene).toEqual([0, 2]);
  });

  it('hinein: sortiert wie in der Datei, was nicht in der Mappe war, bleibt draußen', () => {
    const r = seiteHinein(v({ seiten: [2] }), [0, 2], 1);
    expect([r.eigene, r.seiten]).toEqual([
      [0, 1, 2],
      [1, 2],
    ]);
  });
});

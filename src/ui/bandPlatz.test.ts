import { describe, expect, it } from 'vitest';
import { steineVerteilen } from './bandPlatz';

const steine = (...zustaende: string[]) => zustaende.map((zustand, id) => ({ zustand, id }));
const hoehen = (liste: { von: number; bis: number }[]) => liste.map((a) => a.bis - a.von);

describe('Steine im Band verteilen', () => {
  it('teilt gleich, wenn der Platz reicht', () => {
    const liste = steineVerteilen(steine('da', 'fehlt', 'bald'), 120);
    expect(hoehen(liste)).toEqual([40, 40, 40]);
  });

  it('gibt Punkten weniger Platz, wenn es eng wird', () => {
    const liste = steineVerteilen(steine('da', 'da', 'fehlt', 'fehlt'), 80);
    expect(liste).toHaveLength(4);
    expect(liste[0]!.bis - liste[0]!.von).toBeLessThan(liste[3]!.bis - liste[3]!.von);
    expect(liste[3]!.bis - liste[3]!.von).toBeGreaterThanOrEqual(27);
  });

  it('sammelt, wenn gar nichts mehr passt: nichts überlappt, nichts fehlt', () => {
    const eingabe = steine('da', 'fehlt', 'da', 'fehlt', 'fehlt', 'fehlt', 'fehlt', 'bald');
    const liste = steineVerteilen(eingabe, 100);
    for (const a of liste)
      expect(a.bis - a.von).toBeGreaterThanOrEqual(a.stein.zustand === 'da' ? 12 : 27);
    const gezaehlt = liste.reduce((n, a) => n + 1 + a.weitere.length, 0);
    expect(gezaehlt).toBe(eingabe.length);
    expect(liste[0]).toMatchObject({ stein: { zustand: 'da' }, weitere: [{ zustand: 'da' }] });
    expect(liste.at(-1)!.weitere.length).toBeGreaterThan(0);
    expect(liste.at(-1)!.bis).toBeCloseTo(100);
  });

  it('zeigt auch auf kleinstem Platz noch etwas', () => {
    const liste = steineVerteilen(steine('fehlt', 'fehlt', 'fehlt'), 20);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.weitere).toHaveLength(2);
  });
});

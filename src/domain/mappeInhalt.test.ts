import { describe, expect, it } from 'vitest';
import { mappeInhalt, type Block } from './export';

const typ = (id: string) => ({ id }) as never;
const person = (id: string) => ({ person: { id } }) as never;

describe('Was in der Mappe liegt (B23 s=teilen)', () => {
  it('je Unterlagenart einmal, mit den Personen, in der Reihenfolge der Mappe', () => {
    const max = person('max');
    const lea = person('lea');
    const b = [
      { person: max, teile: [{ stand: { typ: typ('sa') } }, { stand: { typ: typ('gehalt') } }] },
      { person: lea, teile: [{ stand: { typ: typ('sa') } }, { stand: { typ: typ('miete') } }] },
    ] as unknown as Block[];
    const inhalt = mappeInhalt(b);
    expect(inhalt.map((z) => (z.typ as { id: string }).id)).toEqual(['sa', 'gehalt', 'miete']);
    expect(inhalt[0]!.fuer).toEqual([max, lea]);
    expect(inhalt[2]!.fuer).toEqual([lea]);
  });
});

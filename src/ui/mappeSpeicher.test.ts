import { describe, expect, it } from 'vitest';
import { Zwischenspeicher, bauSchluessel } from './mappeSpeicher';
import { standardEinstellungen } from '../domain/export';
import type { HaushaltAnsicht } from '../storage/speicher';

describe('Zwischenspeicher', () => {
  it('räumt das am längsten Unbenutzte zuerst weg, das Neueste bleibt immer', () => {
    const weg: string[] = [];
    const z = new Zwischenspeicher<string>(10, (w) => weg.push(w));
    z.merken('a', 'A', 4);
    z.merken('b', 'B', 4);
    expect(z.holen('a')).toBe('A');
    z.merken('c', 'C', 4);
    expect(weg).toEqual(['B']);
    expect(z.holen('b')).toBeUndefined();
    z.merken('riesig', 'R', 100);
    expect(z.holen('riesig')).toBe('R');
    expect(weg).toEqual(['B', 'A', 'C']);
  });
});

describe('Schlüssel einer gebauten Mappe', () => {
  const ansicht = {
    haushalt: { id: 'h', updatedAt: '1', mappeAussehen: undefined },
    mitglieder: [
      { person: { id: 'p', updatedAt: '1' }, zugehoerigkeit: { id: 'z', updatedAt: '1' } },
    ],
    dokumente: [{ id: 'd', updatedAt: '1' }],
    versionen: [{ id: 'v', updatedAt: '1' }],
  } as unknown as HaushaltAnsicht;
  const e = standardEinstellungen();
  const heute = new Date(2026, 10, 4);
  const basis = bauSchluessel(ansicht, null, e, undefined, heute);

  it('bleibt gleich, solange sich nichts ändert', () => {
    expect(bauSchluessel(ansicht, null, { ...e }, undefined, heute)).toBe(basis);
  });

  it('ändert sich mit dem Inhalt, auch wenn das Änderungsdatum gleich bleibt', () => {
    const umbenannt = {
      ...ansicht,
      mitglieder: [
        {
          person: { id: 'p', updatedAt: '1', nachnameLatein: 'Kovalenko' },
          zugehoerigkeit: { id: 'z', updatedAt: '1' },
        },
      ],
    } as unknown as HaushaltAnsicht;
    expect(bauSchluessel(umbenannt, null, e, undefined, heute)).not.toBe(basis);
  });

  it('ändert sich mit Einstellung, Adresse, Aussehen, Unterlage, Person und Tag', () => {
    const anders = [
      bauSchluessel(ansicht, null, { ...e, kleiner: !e.kleiner }, undefined, heute),
      bauSchluessel(ansicht, { adresse: 'Neu', satz: '' }, e, undefined, heute),
      bauSchluessel(ansicht, null, e, { art: 'schlicht' }, heute),
      bauSchluessel(
        { ...ansicht, versionen: [{ id: 'v', updatedAt: '2' }] } as unknown as HaushaltAnsicht,
        null,
        e,
        undefined,
        heute,
      ),
      bauSchluessel(
        {
          ...ansicht,
          mitglieder: [
            { person: { id: 'p', updatedAt: '2' }, zugehoerigkeit: { id: 'z', updatedAt: '1' } },
          ],
        } as unknown as HaushaltAnsicht,
        null,
        e,
        undefined,
        heute,
      ),
      bauSchluessel(ansicht, null, e, undefined, new Date(2026, 10, 5)),
    ];
    for (const s of anders) expect(s).not.toBe(basis);
  });
});

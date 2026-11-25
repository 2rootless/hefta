import { describe, expect, it } from 'vitest';
import type { Rolle } from './modell';
import { ansprechNachruecken, ansprechperson, geordnet, imVertrag, rolleNeu } from './nachruecken';

// W57 (PC198, E363, E366): die Ansprechperson des Haushalts. Ersetzt die Tests zu `rollenNachruecken` (PC102).
const z = (
  personId: string,
  rolle: Rolle | 'hauptmieter' | 'mitmieter',
  reihenfolge: number,
  herausgenommenAm: string | null = null,
) => ({ personId, rolle: rolle as Rolle, reihenfolge, herausgenommenAm });

describe('Ansprechperson (W57, E366)', () => {
  it('alte Rollen: Hauptmieter und Mitmieter stehen im Vertrag, Bürgen nicht', () => {
    expect(['hauptmieter', 'mitmieter', 'vertrag', 'buerge'].map(rolleNeu)).toEqual([
      'vertrag',
      'vertrag',
      'vertrag',
      'buerge',
    ]);
    // Gegenprobe: Eine unbekannte Rolle gilt als im Vertrag, nie als Bürge.
    expect(rolleNeu('weitere')).toBe('vertrag');
  });

  it('die gespeicherte bleibt, solange sie im Vertrag steht; sonst die erste im Vertrag', () => {
    const alle = [z('max', 'vertrag', 0), z('lea', 'vertrag', 1), z('petra', 'buerge', 2)];
    expect(ansprechperson({ ansprechpersonId: 'lea' }, alle)).toBe('lea');
    expect(ansprechperson({ ansprechpersonId: null }, alle)).toBe('max');
    // herausgenommen oder Bürge: die nächste im Vertrag
    expect(
      ansprechperson({ ansprechpersonId: 'max' }, [
        z('max', 'vertrag', 0, '2026-11-24'),
        ...alle.slice(1),
      ]),
    ).toBe('lea');
    expect(ansprechperson({ ansprechpersonId: 'petra' }, alle)).toBe('max');
    // niemand im Vertrag
    expect(ansprechperson({ ansprechpersonId: 'petra' }, [z('petra', 'buerge', 0)])).toBeNull();
  });

  it('geordnet: Ansprechperson zuerst, dann der Vertrag nach der Reihenfolge, dann die Bürgen', () => {
    const alle = [
      z('petra', 'buerge', 0),
      z('max', 'vertrag', 1),
      z('lea', 'vertrag', 2),
      z('aylin', 'vertrag', 3),
    ];
    expect(geordnet({ ansprechpersonId: 'aylin' }, alle).map((x) => x.personId)).toEqual([
      'aylin',
      'max',
      'lea',
      'petra',
    ]);
    // Gegenprobe: ohne gespeicherte die erste im Vertrag
    expect(geordnet(null, alle).map((x) => x.personId)).toEqual(['max', 'lea', 'aylin', 'petra']);
  });

  it('nachrücken: nur wenn nötig; wer zurückkommt, bleibt hinten (E366)', () => {
    const alle = [z('max', 'vertrag', 0), z('lea', 'vertrag', 1)];
    expect(ansprechNachruecken({ ansprechpersonId: 'max' }, alle)).toBeUndefined();
    // Max geht: Lea wird es.
    const ohneMax = [z('max', 'vertrag', 0, '2026-11-24'), z('lea', 'vertrag', 1)];
    expect(ansprechNachruecken({ ansprechpersonId: 'max' }, ohneMax)).toBe('lea');
    // Max kommt zurück (hinten): Lea bleibt.
    const zurueck = [z('lea', 'vertrag', 1), z('max', 'vertrag', 2)];
    expect(ansprechNachruecken({ ansprechpersonId: 'lea' }, zurueck)).toBeUndefined();
    // ohne Ansprechperson: die erste im Vertrag
    expect(ansprechNachruecken({}, alle)).toBe('max');
  });

  it('imVertrag: ohne Herausgenommene und Bürgen, nach der Reihenfolge', () => {
    const alle = [
      z('b', 'vertrag', 2),
      z('a', 'hauptmieter', 1),
      z('c', 'buerge', 0),
      z('d', 'vertrag', 3, '2026-11-01'),
    ];
    expect(imVertrag(alle).map((x) => x.personId)).toEqual(['a', 'b']);
  });
});

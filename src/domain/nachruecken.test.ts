import { describe, expect, it } from 'vitest';
import type { Rolle } from './modell';
import { rollenNachruecken } from './nachruecken';

// PC102 (E209), Frage 1: Fehlt die hauptmietende Person, rückt die nächste im Mietvertrag nach.

const z = (id: string, rolle: Rolle, reihenfolge: number, rest: object = {}) => ({
  id,
  haushaltId: 'h1',
  rolle,
  reihenfolge,
  herausgenommenAm: null as string | null,
  ...rest,
});

describe('rollenNachruecken', () => {
  it('ändert nichts, wenn genau eine hauptmietet', () => {
    expect(
      rollenNachruecken([z('a', 'hauptmieter', 0), z('b', 'mitmieter', 1), z('c', 'buerge', 2)]),
    ).toEqual([]);
  });

  it('ist die hauptmietende Person herausgenommen, rückt die erste im Vertrag nach', () => {
    const neu = rollenNachruecken([
      z('a', 'hauptmieter', 0, { herausgenommenAm: '2026-11-18T10:00:00.000Z' }),
      z('c', 'mitmieter', 3),
      z('b', 'mitmieter', 1),
      z('d', 'buerge', 2),
    ]);
    expect(neu.map((x) => [x.id, x.rolle])).toEqual([['b', 'hauptmieter']]);
  });

  it('Bürgen rücken nie nach; ohne jemanden im Vertrag bleibt es, wie es ist', () => {
    expect(
      rollenNachruecken([
        z('a', 'hauptmieter', 0, { herausgenommenAm: '2026-11-18T10:00:00.000Z' }),
        z('d', 'buerge', 1),
      ]),
    ).toEqual([]);
  });

  it('kommt eine frühere hauptmietende Person zurück, gibt sie nach (sie steht hinten)', () => {
    const neu = rollenNachruecken([z('b', 'hauptmieter', 1), z('a', 'hauptmieter', 5)]);
    expect(neu.map((x) => [x.id, x.rolle])).toEqual([['a', 'mitmieter']]);
  });

  it('rechnet je Haushalt', () => {
    const neu = rollenNachruecken([
      z('a', 'mitmieter', 0),
      z('b', 'hauptmieter', 0, { haushaltId: 'h2' }),
      z('c', 'mitmieter', 1, { haushaltId: 'h2' }),
    ]);
    expect(neu.map((x) => [x.id, x.rolle])).toEqual([['a', 'hauptmieter']]);
  });
});

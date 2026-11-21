import { describe, expect, it } from 'vitest';
import {
  haushaltFuerHeft,
  haushaltSchein,
  mitgliedschaften,
  wbsAbgelaufen,
  wbsLaeuftBaldAb,
} from './haushaltUnterlagen';
import type { DateiVersion, Dokument } from './modell';

const HEUTE = '2026-11-16';

function dok(id: string, typ = 'wbs'): Dokument {
  return {
    id,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    personId: 'haushalt-1',
    typ,
    notiz: '',
    serie: null,
    stummBis: null,
  };
}

function version(
  id: string,
  dokumentId: string,
  am: string,
  gueltigBis: string | null,
): DateiVersion {
  return {
    id,
    createdAt: am,
    updatedAt: am,
    dokumentId,
    ausstellungsdatum: null,
    abrechnungsmonat: null,
    variante: null,
    original: `datei-${id}`,
    aufbereitet: null,
    seiten: null,
    schwaerzungen: {},
    gerastert: false,
    erkannteWerte: null,
    vomNutzerBestaetigt: null,
    wbs: { gueltigBis, personen: 3, raeume: 'Bis 3 Räume' },
  } as DateiVersion;
}

describe('Unterlagen des Haushalts (DP45 G1)', () => {
  const dokumente = [dok('d1')];
  const alt = version('v1', 'd1', '2026-10-01T10:00:00.000Z', '2026-12-31');
  const neu = version('v2', 'd1', '2026-11-10T10:00:00.000Z', '2027-03-31');

  it('nimmt die neueste Fassung des Scheins', () => {
    expect(haushaltSchein(dokumente, [alt, neu], 'wbs')?.version.id).toBe('v2');
    expect(haushaltSchein(dokumente, [], 'wbs')).toBeNull();
    expect(haushaltSchein(undefined, [neu], 'wbs')).toBeNull();
  });

  it('kennt abgelaufen und bald ablaufend (30 Tage vorher)', () => {
    expect(wbsAbgelaufen(version('a', 'd1', HEUTE, '2026-11-15'), HEUTE)).toBe(true);
    expect(wbsAbgelaufen(version('b', 'd1', HEUTE, '2026-11-16'), HEUTE)).toBe(false);
    expect(wbsAbgelaufen(version('c', 'd1', HEUTE, null), HEUTE)).toBe(false);
    expect(wbsLaeuftBaldAb(version('d', 'd1', HEUTE, '2026-12-16'), HEUTE)).toBe(true);
    expect(wbsLaeuftBaldAb(version('e', 'd1', HEUTE, '2026-12-17'), HEUTE)).toBe(false);
    expect(wbsLaeuftBaldAb(version('f', 'd1', HEUTE, '2026-11-15'), HEUTE)).toBe(false);
  });

  it('kommt nur in Hefte für Sozialwohnungen (W28 mit Gegenprobe)', () => {
    expect(haushaltFuerHeft(dokumente, [neu], { sozialwohnung: true }, HEUTE)).toHaveLength(1);
    expect(haushaltFuerHeft(dokumente, [neu], { sozialwohnung: false }, HEUTE)).toEqual([]);
    expect(haushaltFuerHeft(dokumente, [neu], {}, HEUTE)).toEqual([]);
    expect(haushaltFuerHeft(dokumente, [neu], null, HEUTE)).toEqual([]);
  });

  it('abgelaufen nur, wenn im Heft angeschaltet (K3)', () => {
    const vorbei = version('v3', 'd1', '2026-11-12T10:00:00.000Z', '2026-11-01');
    expect(haushaltFuerHeft(dokumente, [vorbei], { sozialwohnung: true }, HEUTE)).toEqual([]);
    const mit = haushaltFuerHeft(
      dokumente,
      [vorbei],
      { sozialwohnung: true, wbsAbgelaufenMit: true },
      HEUTE,
    );
    expect(mit).toHaveLength(1);
    expect(mit[0]).toMatchObject({ typ: 'wbs', abgelaufen: true });
  });

  it('Mitgliedschaft nur im Heft dieser Genossenschaft (G2a bis G2c)', () => {
    const a: Dokument = {
      ...dok('m1', 'mitgliedschaft'),
      genossenschaft: { name: 'Muster eG', nummer: '004711' },
    };
    const b: Dokument = {
      ...dok('m2', 'mitgliedschaft'),
      createdAt: '2026-11-02T10:00:00.000Z',
      genossenschaft: { name: 'Beispiel eG', nummer: '17' },
    };
    const nachweis = version('n1', 'm1', '2026-11-03T10:00:00.000Z', null);
    expect(
      mitgliedschaften([a, b, ...dokumente], [nachweis]).map((m) => [
        m.name,
        m.nachweis?.id ?? null,
      ]),
    ).toEqual([
      ['Muster eG', 'n1'],
      ['Beispiel eG', null],
    ]);
    const teile = (genossenschaft: string | null) =>
      haushaltFuerHeft([a, b], [nachweis], { genossenschaft }, HEUTE).map((x) =>
        x.typ === 'mitgliedschaft' ? x.mitgliedschaft.name : x.typ,
      );
    expect(teile('m1')).toEqual(['Muster eG']);
    expect(teile('m2')).toEqual(['Beispiel eG']);
    expect(teile(null)).toEqual([]);
    expect(teile('weg')).toEqual([]);
  });
});

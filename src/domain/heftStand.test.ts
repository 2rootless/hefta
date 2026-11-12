import { describe, expect, it } from 'vitest';
import {
  gruppieren,
  ohneLoeschbitte,
  stand,
  standFragen,
  standNummer,
  terminVorbei,
} from './heftStand';
import { KEINE_EREIGNISSE, type HeftEreignisse } from './modell';

const JETZT = new Date(2026, 10, 8, 19, 0);
const am = (tag: string) => `${tag}T10:00:00.000Z`;
const mit = (teil: Partial<HeftEreignisse>): HeftEreignisse => ({ ...KEINE_EREIGNISSE, ...teil });

describe('Stand aus Ereignissen (E43)', () => {
  it('ohne alles: Gemerkt, Stand 1 von 4', () => {
    expect(stand(KEINE_EREIGNISSE, JETZT)).toBe('gemerkt');
    expect(standNummer('gemerkt')).toBe(1);
  });

  it('Beworben nur, wenn Hefta es sicher weiß (Mailfenster) oder es bestätigt ist', () => {
    const sicher = mit({ beworben: { am: am('2026-11-04'), weg: 'mail', sicher: true } });
    const unsicher = mit({ beworben: { am: am('2026-11-04'), weg: 'portal', sicher: false } });
    expect(stand(sicher, JETZT)).toBe('beworben');
    expect(stand(unsicher, JETZT)).toBe('gemerkt');
    expect(standFragen(unsicher)).toBe(true);
    expect(standFragen(sicher)).toBe(false);
    // Einmal gefragt: nie wieder.
    expect(standFragen({ ...unsicher, gefragtAm: am('2026-11-05') })).toBe(false);
  });

  it('nach 21 Tagen ohne Termin: Keine Antwort, von selbst', () => {
    const e = mit({ beworben: { am: am('2026-10-18'), weg: 'mail', sicher: true } });
    expect(stand(e, JETZT)).toBe('keine_antwort');
    const knapp = mit({ beworben: { am: am('2026-10-19'), weg: 'mail', sicher: true } });
    expect(stand(knapp, JETZT)).toBe('beworben');
  });

  it('ein Termin macht Besichtigung, Stand 3 von 4; vorbei ohne Ergebnis fragt Hefta', () => {
    const e = mit({ termin: { am: am('2026-11-09'), ort: '', treffpunkt: '' } });
    expect(stand(e, JETZT)).toBe('besichtigung');
    expect(standNummer('besichtigung')).toBe(3);
    expect(terminVorbei(e, JETZT)).toBe(false);
    expect(terminVorbei(e, new Date(2026, 10, 10))).toBe(true);
  });

  it('ein Ergebnis oder Ablegen: abgelegt, Stand 4 von 4', () => {
    expect(stand(mit({ ergebnis: { art: 'absage', am: am('2026-11-06') } }), JETZT)).toBe(
      'abgelegt',
    );
    expect(stand(mit({ abgelegtAm: am('2026-11-06') }), JETZT)).toBe('abgelegt');
    expect(standNummer('abgelegt')).toBe(4);
  });
});

describe('Gruppen der Übersicht (B16)', () => {
  const heft = (id: string, createdAt: string, e: Partial<HeftEreignisse>) => ({
    id,
    createdAt: am(createdAt),
    ereignisse: mit(e),
  });
  const hefte = [
    heft('g-alt', '2026-11-01', {}),
    heft('g-neu', '2026-11-07', {}),
    heft('t-spaeter', '2026-11-01', { termin: { am: am('2026-11-12'), ort: '', treffpunkt: '' } }),
    heft('t-vorbei', '2026-11-01', { termin: { am: am('2026-11-05'), ort: '', treffpunkt: '' } }),
    heft('t-morgen', '2026-11-01', { termin: { am: am('2026-11-09'), ort: '', treffpunkt: '' } }),
    heft('w-kurz', '2026-11-01', { beworben: { am: am('2026-11-06'), weg: 'mail', sicher: true } }),
    heft('w-lang', '2026-11-01', { beworben: { am: am('2026-11-01'), weg: 'mail', sicher: true } }),
    heft('k', '2026-10-01', { beworben: { am: am('2026-10-01'), weg: 'mail', sicher: true } }),
    heft('a', '2026-10-01', { ergebnis: { art: 'zusage', am: am('2026-11-02') } }),
  ];
  const g = gruppieren(hefte, JETZT);
  const ids = (l: { id: string }[]) => l.map((h) => h.id);

  it('Steht an: vorbei ohne Ergebnis oben, dann nach Datum', () => {
    expect(ids(g.stehtAn)).toEqual(['t-vorbei', 't-morgen', 't-spaeter']);
  });

  it('Warten: wer am längsten wartet, oben; Gemerkt: neueste oben', () => {
    expect(ids(g.wartet)).toEqual(['w-lang', 'w-kurz']);
    expect(ids(g.gemerkt)).toEqual(['g-neu', 'g-alt']);
  });

  it('Keine Antwort und Abgelegt getrennt', () => {
    expect(ids(g.keineAntwort)).toEqual(['k']);
    expect(ids(g.abgelegt)).toEqual(['a']);
  });

  it('zählt Hefte ohne Löschbitte', () => {
    expect(
      ohneLoeschbitte([
        { ereignisse: mit({}) },
        { ereignisse: mit({ loeschbitteAm: am('2026-11-01') }) },
      ]),
    ).toBe(1);
  });
});

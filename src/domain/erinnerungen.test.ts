import { describe, expect, it } from 'vitest';
import { erinnerungenPlanen, erinnerungsNummer, ERINNERUNGEN_HOECHSTENS } from './erinnerungen';
import type { Heft } from './modell';

const JETZT = new Date(2026, 10, 13, 9, 0);

function heft(id: string, ereignisse: Partial<Heft['ereignisse']>): Heft {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    haushaltId: null,
    adresse: '',
    link: null,
    quelle: '',
    inseratText: null,
    kennung: id,
    notiz: '',
    ereignisse: {
      beworben: null,
      gefragtAm: null,
      termin: null,
      ergebnis: null,
      abgelegtAm: null,
      loeschbitteAm: null,
      nachgefasstAm: null,
      ...ereignisse,
    },
  } as Heft;
}

const termin = (am: Date) => ({ am: am.toISOString(), ort: '', treffpunkt: '' });
const beworben = (am: Date) => ({ am: am.toISOString(), weg: 'mail' as const, sicher: true });

const alle = { gehalt: [], besichtigungenAn: true, gehaltAn: true, jetzt: JETZT };

describe('Erinnerungen planen', () => {
  it('Besichtigung übermorgen: Vorabend 18 Uhr und eine Stunde vorher, früheste zuerst', () => {
    const am = new Date(2026, 10, 15, 17, 30);
    const liste = erinnerungenPlanen({ ...alle, hefte: [heft('a', { termin: termin(am) })] });
    expect(liste.map((e) => [e.art, e.am.toString()])).toEqual([
      ['vorabend', new Date(2026, 10, 14, 18).toString()],
      ['bald', new Date(2026, 10, 15, 16, 30).toString()],
    ]);
    expect(liste[0]!.ziel).toBe('/heft/a');
  });

  it('Besichtigung heute: nur noch eine Stunde vorher; vorbei: nichts', () => {
    const heute = erinnerungenPlanen({
      ...alle,
      hefte: [heft('a', { termin: termin(new Date(2026, 10, 13, 12)) })],
    });
    expect(heute.map((e) => e.art)).toEqual(['bald']);
    const vorbei = erinnerungenPlanen({
      ...alle,
      hefte: [heft('a', { termin: termin(new Date(2026, 10, 12, 12)) })],
    });
    expect(vorbei).toEqual([]);
  });

  it('Beworben vor zehn Tagen: nach drei Wochen einmal morgens; nachgefragt: nicht mehr', () => {
    const von = new Date(2026, 10, 3, 14);
    const liste = erinnerungenPlanen({ ...alle, hefte: [heft('b', { beworben: beworben(von) })] });
    expect(liste).toHaveLength(1);
    expect(liste[0]!.art).toBe('keineAntwort');
    expect(liste[0]!.am).toEqual(new Date(2026, 10, 24, 10));
    const nach = erinnerungenPlanen({
      ...alle,
      hefte: [heft('b', { beworben: beworben(von), nachgefasstAm: JETZT.toISOString() })],
    });
    expect(nach).toEqual([]);
  });

  it('Abgelegt oder nur gemerkt: keine Erinnerung', () => {
    const liste = erinnerungenPlanen({
      ...alle,
      hefte: [
        heft('c', { abgelegtAm: JETZT.toISOString(), termin: termin(new Date(2026, 10, 20)) }),
        heft('d', {}),
      ],
    });
    expect(liste).toEqual([]);
  });

  it('Gehaltsnachweis: der nächste Monat nach dem, der schon da sein kann', () => {
    const liste = erinnerungenPlanen({
      ...alle,
      hefte: [],
      gehalt: [{ personId: 'max', meist: 'ende' }],
    });
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ art: 'gehalt', ziel: '/unterlage/max/gehaltsnachweis' });
    expect(liste[0]!.am.getTime()).toBeGreaterThan(JETZT.getTime());
    expect(liste[0]!.am.getHours()).toBe(10);
  });

  it('Schalter aus: nichts aus dieser Gruppe', () => {
    const hefte = [heft('a', { termin: termin(new Date(2026, 10, 15, 17)) })];
    const gehalt = [{ personId: 'max', meist: 'ende' as const }];
    expect(
      erinnerungenPlanen({ ...alle, hefte, gehalt, besichtigungenAn: false }).map((e) => e.art),
    ).toEqual(['gehalt']);
    expect(
      erinnerungenPlanen({ ...alle, hefte, gehalt, gehaltAn: false }).every(
        (e) => e.art !== 'gehalt',
      ),
    ).toBe(true);
  });

  it('Höchstens 40, die frühesten', () => {
    const hefte = Array.from({ length: 30 }, (_, i) =>
      heft(`h${i}`, { termin: termin(new Date(2026, 10, 20 + i, 12)) }),
    );
    expect(erinnerungenPlanen({ ...alle, hefte })).toHaveLength(ERINNERUNGEN_HOECHSTENS);
  });

  it('Nummer: fest je Schlüssel, verschieden für verschiedene', () => {
    expect(erinnerungsNummer('bald:a:1')).toBe(erinnerungsNummer('bald:a:1'));
    expect(erinnerungsNummer('bald:a:1')).not.toBe(erinnerungsNummer('bald:a:2'));
  });
});

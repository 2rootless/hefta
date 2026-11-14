import { describe, expect, it } from 'vitest';
import { KEINE_EREIGNISSE, type HeftEreignisse } from './modell';
import {
  dochNichtBeworben,
  dochNochOffen,
  ergebnis,
  lage,
  ohneAntwortAblegen,
  schonBeworben,
  terminWeg,
  vorschlagJa,
  vorschlagNein,
  vorwaerts,
} from './heftLage';

const JETZT = new Date(2026, 10, 14, 12, 0);
const tag = (versatz: number, stunde = 12) =>
  new Date(2026, 10, 14 + versatz, stunde, 0).toISOString();
const e = (x: Partial<HeftEreignisse> = {}): HeftEreignisse => ({ ...KEINE_EREIGNISSE, ...x });
const art = (x: Partial<HeftEreignisse>, mit = true) => lage(e(x), JETZT, mit).art;

describe('Die 13 Lagen des Stands (B28b, DP21)', () => {
  it('Gemerkt, ohne Haushalt, Vorschlag', () => {
    expect(art({})).toBe('gemerkt');
    expect(art({}, false)).toBe('gemerktOhne');
    expect(art({ beworben: { am: tag(-1), weg: 'portal', sicher: false } })).toBe('vorschlag');
    // Nach „Noch nicht“ fragt Hefta nicht noch einmal.
    expect(
      art({ beworben: { am: tag(-1), weg: 'portal', sicher: false }, gefragtAm: tag(0) }),
    ).toBe('gemerkt');
  });

  it('Beworben heute, Tage später, keine Antwort, nachgefragt', () => {
    const heute = lage(e({ beworben: { am: tag(0, 9), weg: 'mail', sicher: true } }), JETZT, true);
    expect(heute).toMatchObject({ art: 'beworben', ort: 1, heute: true });
    const tage = lage(e({ beworben: { am: tag(-5), weg: 'mail', sicher: true } }), JETZT, true);
    expect(tage).toMatchObject({ art: 'beworben', heute: false, tage: 5 });
    expect(art({ beworben: { am: tag(-21), weg: 'mail', sicher: true } })).toBe('keineAntwort');
    expect(
      art({ beworben: { am: tag(-30), weg: 'mail', sicher: true }, nachgefasstAm: tag(-2) }),
    ).toBe('nachgefragt');
  });

  it('Termin bis zu seinem Ende, danach „Besichtigt“', () => {
    const termin = (am: string) => ({ termin: { am, ort: '', treffpunkt: '' } });
    expect(lage(e(termin(tag(1))), JETZT, true)).toMatchObject({ art: 'termin', ort: 2 });
    expect(art(termin(new Date(2026, 10, 14, 11, 30).toISOString()))).toBe('termin');
    expect(art(termin(new Date(2026, 10, 14, 11, 0).toISOString()))).toBe('besichtigt');
    expect(art(termin(tag(-1)))).toBe('besichtigt');
  });

  it('Ergebnisse, mit und ohne Löschbitte', () => {
    expect(lage(e({ ergebnis: { art: 'zusage', am: tag(0) } }), JETZT, true)).toEqual({
      art: 'zusage',
      ort: 3,
    });
    expect(
      lage(
        e({ ergebnis: { art: 'absage', am: tag(0) }, abgelegtAm: tag(0), loeschbitteAm: tag(0) }),
        JETZT,
        true,
      ),
    ).toEqual({ art: 'absage', ort: 3, bitte: true, abgelegt: true });
    expect(art({ ergebnis: { art: 'nicht_mehr', am: tag(0) }, abgelegtAm: tag(0) })).toBe(
      'nichtMehr',
    );
    expect(art({ abgelegtAm: tag(0) })).toBe('ohneAntwort');
  });
});

describe('Antworten im Stand', () => {
  it('Wir haben uns schon beworben, Ja, Noch nicht, Doch noch nicht beworben', () => {
    expect(lage(schonBeworben(e(), JETZT), JETZT, true).art).toBe('beworben');
    const vs = e({ beworben: { am: tag(-1), weg: 'portal', sicher: false } });
    expect(lage(vorschlagJa(vs, JETZT), JETZT, true).art).toBe('beworben');
    expect(lage(vorschlagNein(vs, JETZT), JETZT, true).art).toBe('gemerkt');
    const b = schonBeworben(e(), JETZT);
    expect(lage(dochNichtBeworben(b), JETZT, true).art).toBe('gemerkt');
  });

  it('Ergebnis, Ablegen ohne Antwort, Doch noch offen, Termin entfernen', () => {
    const b = e({ beworben: { am: tag(-30), weg: 'mail', sicher: true } });
    const z = ergebnis(b, 'zusage', JETZT);
    expect(z.abgelegtAm).toBeNull();
    expect(lage(ergebnis(b, 'absage', JETZT), JETZT, true).abgelegt).toBe(true);
    const o = ohneAntwortAblegen(b, JETZT);
    expect(lage(o, JETZT, true).art).toBe('ohneAntwort');
    expect(lage(dochNochOffen(o), JETZT, true).art).toBe('keineAntwort');
    const t = { ...b, termin: { am: tag(1), ort: '', treffpunkt: '' } };
    expect(lage(terminWeg(t), JETZT, true).art).toBe('keineAntwort');
  });

  it('Richtung: weiter auf dem Weg ist vorwärts, aus einem Ergebnis zurück ist rückwärts', () => {
    const l = (x: Partial<HeftEreignisse>) => lage(e(x), JETZT, true);
    const gemerkt = l({});
    const beworben = l({ beworben: { am: tag(0), weg: 'mail', sicher: true } });
    const absage = l({ ergebnis: { art: 'absage', am: tag(0) }, abgelegtAm: tag(0) });
    const bitte = l({
      ergebnis: { art: 'absage', am: tag(0) },
      abgelegtAm: tag(0),
      loeschbitteAm: tag(0),
    });
    expect(vorwaerts(gemerkt, beworben)).toBe(true);
    expect(vorwaerts(beworben, gemerkt)).toBe(false);
    expect(vorwaerts(absage, bitte)).toBe(true);
    expect(vorwaerts(absage, l({ termin: { am: tag(-1), ort: '', treffpunkt: '' } }))).toBe(false);
  });
});

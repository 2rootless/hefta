import { describe, expect, it } from 'vitest';
import { KEINE_EREIGNISSE, type HeftEreignisse } from './modell';
import { bisWort, HEUTE_LAGE, lage, seitWort, vorWort, zeile } from './tageslinie';

const JETZT = new Date(2026, 10, 8, 19, 0); // So, 8. November 2026, abends, wie B18
const tag = (d: number, h = 10) => new Date(2026, 10, 8 + d, h, 0).toISOString();
const e = (teil: Partial<HeftEreignisse>): HeftEreignisse => ({ ...KEINE_EREIGNISSE, ...teil });

describe('Tageslinie (B18 Abschnitt 1)', () => {
  it('Maßstab wie in build_b18.py: heute bei 56 %, vier Wochen zurück, zwei voraus, Wurzel', () => {
    expect(lage(0)).toBe(HEUTE_LAGE);
    expect(lage(-28)).toBe(0);
    expect(lage(-60)).toBe(0);
    expect(lage(14)).toBe(100);
    expect(lage(30)).toBe(100);
    expect(lage(-7)).toBeCloseTo(28);
    // „Gemerkt seit gestern“: Ring bei 45,4 % wie in der Datei des Designs.
    expect(lage(-1)).toBeCloseTo(45.4, 1);
    // Nahe Tage sind breiter als ferne.
    expect(lage(1) - lage(0)).toBeGreaterThan(lage(13) - lage(12));
  });

  it('Wörter: kommt, läuft seit, war; „nächste Woche“ gibt es nicht', () => {
    expect([0, 1, 2, 3, 6, 7, 13, 14, 20].map((n) => bisWort(n))).toEqual([
      { schluessel: 'zeit.heute' },
      { schluessel: 'zeit.morgen' },
      { schluessel: 'zeit.uebermorgen' },
      { schluessel: 'zeit.inTagen', werte: { anzahl: 3 } },
      { schluessel: 'zeit.inTagen', werte: { anzahl: 6 } },
      { schluessel: 'zeit.inEinerWoche' },
      { schluessel: 'zeit.inEinerWoche' },
      { schluessel: 'zeit.inWochen', werte: { anzahl: 2 } },
      { schluessel: 'zeit.inWochen', werte: { anzahl: 2 } },
    ]);
    expect([0, 1, 2, 13, 14, 22].map((n) => seitWort(n).schluessel)).toEqual([
      'zeit.seitHeute',
      'zeit.seitGestern',
      'zeit.seitTagen',
      'zeit.seitTagen',
      'zeit.seitWochen',
      'zeit.seitWochen',
    ]);
    expect(seitWort(22).werte).toEqual({ anzahl: 3 });
    expect([1, 5, 15].map((n) => vorWort(n))).toEqual([
      { schluessel: 'zeit.gestern' },
      { schluessel: 'zeit.vorTagen', werte: { anzahl: 5 } },
      { schluessel: 'zeit.vorWochen', werte: { anzahl: 2 } },
    ]);
  });

  it('eine Sache, eine Marke: Besichtigung kommt, war, wartet, keine Antwort, gemerkt', () => {
    const termin = { am: tag(2, 18), ort: '', treffpunkt: '' };
    expect(zeile(e({ termin }), tag(-5), JETZT)).toEqual({
      art: 'termin',
      wort: { schluessel: 'zeit.uebermorgen' },
      marke: { art: 'termin', punkt: lage(2) },
    });
    const war = zeile(e({ termin: { ...termin, am: tag(-3) } }), tag(-9), JETZT);
    expect(war.art).toBe('tun');
    expect(war.wort).toEqual({ schluessel: 'zeit.vorTagen', werte: { anzahl: 3 } });
    expect(war.marke).toEqual({ art: 'tun', raute: lage(-3) });

    const beworben = { am: tag(-10), weg: 'mail' as const, sicher: true };
    const wartet = zeile(e({ beworben }), tag(-12), JETZT);
    expect(wartet.art).toBe('wartet');
    expect(wartet.marke).toEqual({ art: 'wartet', von: lage(-10), dreiWochen: lage(-21) });
    expect(zeile(e({ beworben: { ...beworben, am: tag(-22) } }), tag(-30), JETZT).art).toBe(
      'keine',
    );

    expect(zeile(e({}), tag(-1), JETZT)).toEqual({
      art: 'gemerkt',
      wort: { schluessel: 'zeit.seitGestern' },
      marke: { art: 'gemerkt', ring: lage(-1) },
    });
  });

  it('Tage zählen nach dem Kalender, nicht nach 24 Stunden', () => {
    // Termin morgen früh, jetzt Sonntagabend: weniger als 24 Stunden, aber „morgen“.
    const termin = { am: tag(1, 8), ort: '', treffpunkt: '' };
    expect(zeile(e({ termin }), tag(-1), JETZT).wort).toEqual({ schluessel: 'zeit.morgen' });
  });
});

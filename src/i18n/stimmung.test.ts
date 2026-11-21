import { describe, expect, it } from 'vitest';
import pools from '../../data/satzpools.de.json';
import {
  fassungen,
  fassungNr,
  fassungText,
  stimmung,
  tagNummer,
  type Fassung,
  type Stelle,
} from './stimmung';

// wunsch-W37 (E190, E193): Stimmungssätze wechseln einmal am Tag, am selben Tag steht überall derselbe Satz.
// Hier die Rechnung und die Regeln für jede Fassung (nach pruef68.py aus DP68); im Browser prüft
// tests/e2e/wunsch-w37.spec.ts Knöpfe, feste Sätze und die Breite bei 320 px mit 130 %.

const STELLEN = pools.stellen.map((s) => s.nr as Stelle);
const TEILE: Record<string, (string | undefined)[]> = {
  P1: [undefined],
  P2: [undefined],
  P3: ['titel', 'satz'],
};
const teile = (s: Stelle) => TEILE[s] ?? ['satz'];
const ZAHLEN: Record<string, number[]> = { P1: [0, 1, 3, 12], P2: [1, 3, 12] };

/** Verstöße eines Stimmungssatzes gegen die Regeln aus DP68 (Teil B, Prüfung). */
function verstoesse(text: string, an: 'ihr' | 'du'): string[] {
  const f: string[] = [];
  if (/[{}]/.test(text)) f.push('Platzhalter offen');
  if (text.includes('!')) f.push('Ausrufezeichen');
  if (/\b(super|einfach|smart|perfekt|endlich|garantiert|ruhig|zuverlässig)\b/i.test(text))
    f.push('verbotenes Wort');
  if (/\bmuss/i.test(text) && !/müsst nichts tun|musst nichts tun/.test(text)) f.push('„muss“');
  if (/\b(wir|uns|unser\w*)\b/i.test(text)) f.push('Hefta spricht als „wir“');
  if (an === 'du' && /\b(ihr|euch|eure?[mnrs]?)\b/i.test(text)) f.push('„ihr“ in der Du-Form');
  if (an === 'ihr' && /\b(du|dich|dir|dein\w*)\b/i.test(text)) f.push('„du“ in der Ihr-Form');
  if (!/[.:]$/.test(text.trim())) f.push('kein Punkt am Ende');
  return f;
}

describe('wunsch-W37: Stimmungssätze', () => {
  it('am selben Tag dieselbe Fassung, früh wie spät; am nächsten Tag eine andere', () => {
    for (const s of STELLEN) {
      const frueh = new Date(2026, 10, 18, 0, 0, 1);
      const spaet = new Date(2026, 10, 18, 23, 59, 59);
      expect(fassungNr(s, spaet), s).toBe(fassungNr(s, frueh));
      expect(fassungNr(s, new Date(2026, 10, 19, 0, 0, 1)), s).not.toBe(fassungNr(s, frueh));
    }
  });

  it('reihum: nach so vielen Tagen, wie es Fassungen gibt, war jede einmal da', () => {
    for (const s of STELLEN) {
      const n = fassungen(s).length;
      const gesehen = new Set<number>();
      for (let d = 0; d < n; d++) gesehen.add(fassungNr(s, new Date(2026, 10, 18 + d, 12)));
      expect(gesehen.size, s).toBe(n);
    }
  });

  it('Zahl der Fassungen wie in der Endfassung der Planung (PC94)', () => {
    const zahl = Object.fromEntries(STELLEN.map((s) => [s, fassungen(s).length]));
    expect(zahl).toEqual({
      P1: 10,
      P2: 12,
      P3: 7,
      P4: 8,
      P5: 8,
      P6: 8,
      P7: 8,
      P8: 8,
      P9: 5,
      P10a: 7,
      P10b: 8,
      P11: 8,
    });
  });

  it('die erste Fassung ist der Satz aus Release 2.0', () => {
    const erste = (s: Stelle, o: { teil?: string; anzahl?: number; an: 'ihr' | 'du' }) =>
      fassungText(fassungen(s)[0]!, o, s);
    expect(erste('P1', { anzahl: 0, an: 'ihr' })).toBe('Keine Wohnung im Spiel.');
    expect(erste('P1', { anzahl: 3, an: 'ihr' })).toBe('Drei Wohnungen im Spiel.');
    expect(erste('P2', { anzahl: 3, an: 'du' })).toBe('Noch drei Dinge, dann bist du startklar.');
    expect(erste('P10a', { teil: 'satz', an: 'ihr' })).toBe('Gut gemacht.');
    expect(erste('P11', { teil: 'satz', an: 'du' })).toBe(
      'Die Wohnung liegt hier, bis du dich bewirbst.',
    );
  });

  it('jede Fassung: alle Formen da, Regeln eingehalten, Zahl in der Mehrzahl', () => {
    let geprueft = 0;
    for (const s of STELLEN)
      fassungen(s).forEach((f, i) => {
        for (const teil of teile(s))
          for (const anzahl of ZAHLEN[s] ?? [undefined])
            for (const an of ['ihr', 'du'] as const) {
              // DP109: P9 setzt die Rufnamen erst im Heft ein; geprüft wird mit einem Namen aus der Namensliste.
              const text = fassungText(f, { teil, anzahl, an }, s).replace('{namen}', 'Selin');
              expect(
                verstoesse(text, an),
                `${s} Nr. ${i + 1} ${teil ?? ''} ${anzahl ?? ''} ${an}: ${text}`,
              ).toEqual([]);
              if (anzahl && anzahl > 1) expect(text, `${s} Nr. ${i + 1}`).toMatch(/drei|zwölf/i);
              geprueft++;
            }
      });
    expect(geprueft).toBeGreaterThan(300);
  });

  it('höchstens ein Wortspiel je Pool', () => {
    for (const s of STELLEN)
      expect(fassungen(s).filter((f) => f.wortspiel).length, s).toBeLessThanOrEqual(1);
  });

  it('stimmung() nimmt die Fassung des Tages', () => {
    const tag = new Date(2026, 10, 18, 9);
    const f = fassungen('P10b')[fassungNr('P10b', tag)]!;
    expect(stimmung('P10b', { teil: 'satz', tag, an: 'ihr' })).toBe(
      fassungText(f, { teil: 'satz', an: 'ihr' }),
    );
    expect(tagNummer(new Date(2026, 0, 1, 23)) - tagNummer(new Date(2025, 11, 31, 1))).toBe(1);
  });

  it('Gegenproben: Ausrufezeichen, „wir“, vertauschte Anrede, offener Platzhalter, Wechsel am selben Tag', () => {
    const falsch: Fassung = {
      satz: { ihr: 'Super, ihr seid am Start!', du: 'Wir sind für euch da.' },
    };
    expect(verstoesse(fassungText(falsch, { teil: 'satz', an: 'ihr' }), 'ihr')).toEqual(
      expect.arrayContaining(['Ausrufezeichen', 'verbotenes Wort']),
    );
    expect(verstoesse(fassungText(falsch, { teil: 'satz', an: 'du' }), 'du')).toEqual(
      expect.arrayContaining(['Hefta spricht als „wir“', '„ihr“ in der Du-Form']),
    );
    expect(verstoesse('Noch {zahl} Dinge.', 'ihr')).toContain('Platzhalter offen');
    // Eine Rechnung, die auch die Stunde nimmt, wechselte am selben Tag: Das fiele im ersten Test auf.
    const nachStunde = (d: Date) => (tagNummer(d) * 24 + d.getHours()) % 8;
    expect(nachStunde(new Date(2026, 10, 18, 1))).not.toBe(nachStunde(new Date(2026, 10, 18, 23)));
  });
});

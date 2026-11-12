import { describe, expect, it } from 'vitest';
import { besichtigungsFragen, sicherImInserat, tierFrage } from './besichtigungsFragen';
import type { HeftAngaben } from './modell';
import type { Urteil } from './urteile';

const angaben = (teil: Partial<HeftAngaben>): HeftAngaben => ({
  titel: null,
  stadtteil: null,
  warm: null,
  zimmer: null,
  flaeche: null,
  ...teil,
});

const offen = (kriterium: Urteil['kriterium']): Urteil => ({
  kriterium,
  art: 'offen',
  wert: '–',
  abweichung: kriterium,
});

describe('Fragen für die Besichtigung (E52, B17c)', () => {
  it('ohne Angaben: alle elf in der Reihenfolge des Gangs durch die Wohnung', () => {
    const l = besichtigungsFragen({
      angaben: undefined,
      urteile: [],
      mitTieren: false,
      eigene: [],
    });
    expect(l.fragen.map((f) => f.id)).toEqual([
      'zustand',
      'uebernahme',
      'haus',
      'internet',
      'nebenkosten',
      'heizung',
      'kaution',
      'vertrag',
      'haustiere',
      'einzug',
      'ablauf',
    ]);
    expect(l.weg).toEqual([]);
  });

  it('lässt weg, was das Inserat sicher sagt, und nennt es in der Reihenfolge der Liste', () => {
    const a = angaben({
      warm: 1240,
      kaution: 3000,
      befristung: 'unbefristet',
      mietart: 'fest',
      tiere: 'nicht',
    });
    expect([...sicherImInserat(a)].sort()).toEqual(['haustiere', 'heizung', 'kaution', 'vertrag']);
    const l = besichtigungsFragen({ angaben: a, urteile: [], mitTieren: false, eigene: [] });
    expect(l.weg).toEqual(['heizung', 'kaution', 'vertrag', 'haustiere']);
    expect(l.fragen).toHaveLength(7);
    // Geschätzte Warmmiete klärt die Heizung nicht; Befristung ohne Mietart klärt den Vertrag nicht.
    const ca = besichtigungsFragen({
      angaben: angaben({ warm: 1000, warmCa: true, befristung: '2 Jahre' }),
      urteile: [],
      mitTieren: false,
      eigene: [],
    });
    expect(ca.weg).toEqual([]);
  });

  it('stellt Offenes bei den Wünschen nach oben; Haustiere nur, wenn der Haushalt welche hat', () => {
    const l = besichtigungsFragen({
      angaben: angaben({ warm: 1240 }),
      urteile: [offen('Warmmiete'), offen('Haustiere'), offen('Zimmer')],
      mitTieren: true,
      eigene: [],
    });
    expect(l.fragen.slice(0, 2).map((f) => [f.id, f.offen])).toEqual([
      ['heizung', true],
      ['haustiere', true],
    ]);
    // Offen geht vor „sicher“: Die Heizung fällt dann nicht weg.
    expect(l.weg).toEqual([]);
    const ohneTiere = besichtigungsFragen({
      angaben: undefined,
      urteile: [offen('Haustiere')],
      mitTieren: false,
      eigene: [],
    });
    expect(ohneTiere.fragen.find((f) => f.id === 'haustiere')?.offen).toBe(false);
  });

  it('hängt eigene Fragen an, ohne doppelte und leere', () => {
    const l = besichtigungsFragen({
      angaben: undefined,
      urteile: [],
      mitTieren: false,
      eigene: ['Wo stehen die Mülltonnen?', ' ', 'wo stehen die Mülltonnen?', 'Wie laut ist es?'],
    });
    expect(l.fragen.slice(-2).map((f) => f.text)).toEqual([
      'Wo stehen die Mülltonnen?',
      'Wie laut ist es?',
    ]);
  });

  it('nimmt das Tier aus der Selbstauskunft nur, wenn es in den Satz passt', () => {
    expect(tierFrage('eine Katze')).toEqual({ art: 'ein', tier: 'eine Katze' });
    expect(tierFrage('einen Hund.')).toEqual({ art: 'ein', tier: 'ein Hund' });
    expect(tierFrage('2 Kaninchen')).toEqual({ art: 'mehr', tier: '2 Kaninchen' });
    expect(tierFrage('Katze')).toBeNull();
    expect(tierFrage('')).toBeNull();
  });
});

describe('Ausgeblendete Fragen (E92, nur vorbereitet)', () => {
  it('fehlen, außer sie sind in diesem Heft schon beantwortet; der Zähler zählt nur sichtbare', () => {
    const l = besichtigungsFragen({
      angaben: undefined,
      urteile: [],
      mitTieren: false,
      eigene: [],
      ausgeblendet: { hier: ['haus', 'internet', 'ablauf'], neu: [], heftAngelegt: '2026-11-01' },
      antworten: {
        internet: { ab: true, antwort: '' },
        ablauf: { ab: false, antwort: 'bis Freitag' },
      },
    });
    const ids = l.fragen.map((f) => f.id);
    expect(ids).not.toContain('haus');
    expect(ids).toContain('internet');
    expect(ids).toContain('ablauf');
    expect(l.fragen).toHaveLength(10);
    // Ausgeblendet ist nicht „weggelassen, weil das Inserat es sagt“.
    expect(l.weg).toEqual([]);
  });
});

describe('Ausblenden: nur hier oder auch in neuen Heften (Planung 12x)', () => {
  const basis = { angaben: undefined, urteile: [], mitTieren: false, eigene: [] };
  const neu = [{ thema: 'haus' as const, seit: '2026-11-12T10:00:00.000Z' }];
  it('„auch in neuen“ trifft Hefte, die danach angelegt wurden; ältere bleiben', () => {
    const spaeter = besichtigungsFragen({
      ...basis,
      ausgeblendet: { hier: [], neu, heftAngelegt: '2026-11-13T09:00:00.000Z' },
    });
    expect(spaeter.fragen.map((f) => f.id)).not.toContain('haus');
    expect(spaeter.versteckt).toEqual([{ thema: 'haus', auchNeu: true }]);
    const frueher = besichtigungsFragen({
      ...basis,
      ausgeblendet: { hier: [], neu, heftAngelegt: '2026-11-10T09:00:00.000Z' },
    });
    expect(frueher.fragen.map((f) => f.id)).toContain('haus');
    expect(frueher.versteckt).toEqual([]);
  });
  it('im Heft, wo es geschah, steht es in „hier“; dort mit „auch in neuen Heften“', () => {
    const l = besichtigungsFragen({
      ...basis,
      ausgeblendet: { hier: ['haus', 'kaution'], neu, heftAngelegt: '2026-11-10T09:00:00.000Z' },
    });
    expect(l.versteckt).toEqual([
      { thema: 'haus', auchNeu: true },
      { thema: 'kaution', auchNeu: false },
    ]);
    expect(l.fragen).toHaveLength(9);
  });
});

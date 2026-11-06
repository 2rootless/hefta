import { describe, expect, it } from 'vitest';
import type { DateiVersion, SeitenFakten } from './modell';
import { FAKTEN_STAND, pruefcodeStand, pruefhinweise, woerterAus } from './pruefhinweise';
import type { Dokumenttyp, PersonStand } from './regelkatalog';

const seite = (teil: Partial<SeitenFakten> = {}): SeitenFakten => ({
  monat: null,
  von: null,
  leer: false,
  textHash: null,
  woerter: [],
  ...teil,
});

let nummer = 0;
const version = (teil: Partial<DateiVersion> & { fakten?: SeitenFakten[]; hash?: string } = {}) => {
  const { fakten, hash, ...rest } = teil;
  return {
    id: `v${++nummer}`,
    createdAt: `2026-10-${String(nummer).padStart(2, '0')}T10:00:00Z`,
    original: `d${nummer}`,
    aufbereitet: null,
    seiten: null,
    abrechnungsmonat: null,
    ausstellungsdatum: null,
    variante: null,
    vomNutzerBestaetigt: null,
    erkannteWerte: { stand: FAKTEN_STAND, hash: hash ?? null, seiten: fakten ?? [seite()] },
    ...rest,
  } as DateiVersion;
};

const GEHALT = { id: 'gehalt', etikett: 'ueblich', serie: { anzahl: 3 } } as Dokumenttyp;
const BONI = {
  id: 'boni',
  etikett: 'ueblich',
  erkennen: {
    passt: ['Bonitätsauskunft'],
    passtNicht: [
      { woerter: ['Datenkopie'], anzeige: 'Datenkopie', hinweis: 'Nicht der Nachweis.' },
    ],
  },
} as unknown as Dokumenttyp;

const person = (
  id: string,
  vorname: string,
  nachname: string,
  unterlagen: { typ: Dokumenttyp; versionen: DateiVersion[] }[],
) =>
  ({
    person: { id, vorname, nachname, rufname: vorname },
    unterlagen,
  }) as unknown as PersonStand;

const eins = (typ: Dokumenttyp, versionen: DateiVersion[], name = ['Max', 'Muster']) =>
  pruefhinweise([
    person('m', name[0]!, name[1]!, [{ typ, versionen }]),
    person('l', 'Lea', 'Becker', []),
  ]).get(`m/${typ.id}`);

describe('Prüfhinweise', () => {
  it('PH-a: dieselbe Datei in mehreren Monaten, auch zweimal hochgeladen', () => {
    const f = eins(GEHALT, [
      version({ abrechnungsmonat: '2026-08', hash: 'x' }),
      version({ abrechnungsmonat: '2026-09', hash: 'x' }),
    ]);
    expect(f?.art).toBe('datei');
    expect(f?.gruppe).toHaveLength(2);
  });

  it('PH-a: über Unterlagen hinweg bekommt die zweite Stelle den Hinweis', () => {
    const h = pruefhinweise([
      person('m', 'Max', 'Muster', [
        { typ: BONI, versionen: [version({ hash: 'x' })] },
        { typ: { ...BONI, id: 'miete', erkennen: undefined }, versionen: [version({ hash: 'x' })] },
      ]),
    ]);
    expect(h.get('m/boni')).toBeUndefined();
    expect(h.get('m/miete')?.anderswo?.typ.id).toBe('boni');
  });

  it('aufgeteilt ist kein Fund: Jeder Monat hat seine eigene Seite', () => {
    const f = eins(GEHALT, [
      version({
        abrechnungsmonat: '2026-08',
        hash: 'x',
        original: 'd',
        eigene: [0],
        seiten: [0],
        fakten: [seite({ monat: '2026-08' }), seite({ monat: '2026-09' })],
      }),
      version({
        abrechnungsmonat: '2026-09',
        hash: 'x',
        original: 'd',
        eigene: [1],
        seiten: [1],
        fakten: [seite({ monat: '2026-08' }), seite({ monat: '2026-09' })],
      }),
    ]);
    expect(f).toBeUndefined();
  });

  it('PH-b: dieselbe Seite in einer anderen Datei', () => {
    const f = eins(GEHALT, [
      version({ abrechnungsmonat: '2026-08', fakten: [seite({ textHash: 't' })] }),
      version({ abrechnungsmonat: '2026-09', fakten: [seite({ textHash: 't' })] }),
    ]);
    expect(f?.art).toBe('seite');
  });

  it('PH-c: Auf der Seite steht ein anderer, noch freier Monat', () => {
    const f = eins(GEHALT, [
      version({ abrechnungsmonat: '2026-08', fakten: [seite({ monat: '2026-07' })] }),
    ]);
    expect([f?.art, f?.monat]).toEqual(['monat', '2026-07']);
  });

  it('PH-d: Der Monat auf der Seite ist schon belegt', () => {
    const f = eins(GEHALT, [
      version({ abrechnungsmonat: '2026-07', fakten: [seite({ monat: '2026-07' })] }),
      version({ abrechnungsmonat: '2026-08', fakten: [seite({ monat: '2026-07' })] }),
    ]);
    expect(f?.art).toBe('monatDoppelt');
  });

  it('PH-e: Name einer anderen Person, nicht der eigene; beide Namen sind kein Fund', () => {
    const lea = eins(BONI, [version({ fakten: [seite({ woerter: ['lea', 'becker'] })] })]);
    expect([lea?.art, lea?.person?.rufname]).toEqual(['name', 'Lea']);
    expect(
      eins(BONI, [version({ fakten: [seite({ woerter: ['lea', 'becker', 'max', 'muster'] })] })]),
    ).toBeUndefined();
    expect(eins(BONI, [version({ fakten: [seite({ woerter: ['lea'] })] })])).toBeUndefined();
  });

  it('PH-f: „Seite 1 von 2“, aber nur eine Seite da', () => {
    expect(eins(BONI, [version({ fakten: [seite({ von: [1, 2] })] })])?.art).toBe('seiteFehlt');
    expect(
      eins(BONI, [version({ fakten: [seite({ von: [1, 2] }), seite({ von: [2, 2] })] })]),
    ).toBeUndefined();
  });

  it('PH-g: leere Seite, außer sie ist die einzige', () => {
    const f = eins(BONI, [version({ fakten: [seite(), seite({ leer: true })] })]);
    expect([f?.art, f?.seite]).toEqual(['leer', 1]);
    expect(eins(BONI, [version({ fakten: [seite({ leer: true })] })])).toBeUndefined();
  });

  it('PH-h: Wörter aus dem Regelkatalog', () => {
    expect(eins(BONI, [version({ fakten: [seite({ woerter: ['datenkopie'] })] })])?.art).toBe(
      'art',
    );
  });

  it('PH-h: Eine echte Auskunft darf die Datenkopie erwähnen', () => {
    expect(
      eins(BONI, [version({ fakten: [seite({ woerter: ['datenkopie', 'bonitaetsauskunft'] })] })]),
    ).toBeUndefined();
  });

  it('PH-i: Datum in der Zukunft oder vor 2000', () => {
    const heute = new Date(2026, 10, 3);
    const person1 = (tag: string) => [
      person('m', 'Max', 'Muster', [
        { typ: BONI, versionen: [version({ ausstellungsdatum: tag })] },
      ]),
    ];
    expect(pruefhinweise(person1('2027-01-01'), heute).get('m/boni')?.datum).toBe('zukunft');
    expect(pruefhinweise(person1('1999-01-01'), heute).get('m/boni')?.datum).toBe('alt');
    expect(pruefhinweise(person1('2026-10-01'), heute).get('m/boni')).toBeUndefined();
  });

  it('„Passt so“ gilt für diese Prüfung', () => {
    const v = version({
      fakten: [seite({ von: [1, 2] })],
      vomNutzerBestaetigt: ['seiteFehlt'],
    });
    expect(eins(BONI, [v])).toBeUndefined();
  });

  it('je Unterlage nur der wichtigste', () => {
    const f = eins(BONI, [
      version({ fakten: [seite({ von: [1, 2], woerter: ['datenkopie', 'lea', 'becker'] })] }),
    ]);
    expect(f?.art).toBe('name');
  });

  it('Wörter: klein, „ü“ wie „ue“, ohne Zahlen', () => {
    expect(woerterAus('Müller Straße 12, GARCÍA')).toEqual(['mueller', 'strasse', 'garcia']);
  });
});

describe('Prüfcode beim Bonitätsnachweis', () => {
  const typ = {
    fristen: { hinweisTage: 55, hinweisArt: 'info', pruefcodeTage: 60, warnungTage: 90 },
    erkennen: { pruefcode: ['Prüfcode', 'BonitätsCheck'], passtNicht: [] },
  } as unknown as Dokumenttyp;
  const stand = (tage: number, woerter = ['pruefcode'], veraltet = false) => {
    const tag = new Date(2026, 9, 15 + tage);
    return {
      typ,
      veraltet,
      neuestesDatum: '2026-10-15',
      versionen: [version({ ausstellungsdatum: '2026-10-15', fakten: [seite({ woerter })] })],
      heute: tag,
    };
  };

  it('bis Tag 54 nichts, Tag 55 bis 60 das Datum, danach abgelaufen', () => {
    const a = stand(54);
    expect(pruefcodeStand(a, a.heute)).toBeNull();
    const b = stand(55);
    const c = pruefcodeStand(b, b.heute);
    expect(c?.art).toBe('laeuft');
    expect(c?.art === 'laeuft' && c.am.getDate()).toBe(14);
    expect(c?.art === 'laeuft' && c.am.getMonth()).toBe(11);
    const d = stand(60);
    expect(pruefcodeStand(d, d.heute)?.art).toBe('laeuft');
    const e = stand(61);
    expect(pruefcodeStand(e, e.heute)?.art).toBe('abgelaufen');
    const f = stand(90);
    expect(pruefcodeStand(f, f.heute)?.art).toBe('abgelaufen');
  });

  it('zu alt und ohne Prüfcode im Text: nichts dazu', () => {
    const a = stand(91, ['pruefcode'], true);
    expect(pruefcodeStand(a, a.heute)).toBeNull();
    const b = stand(70, ['auskunft']);
    expect(pruefcodeStand(b, b.heute)).toBeNull();
    const c = stand(70, ['bonitaetscheck']);
    expect(pruefcodeStand(c, c.heute)?.art).toBe('abgelaufen');
  });
});

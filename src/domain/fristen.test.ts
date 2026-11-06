import { describe, expect, it } from 'vitest';
import {
  aktuelleVersionen,
  bewerten,
  erwarteterMonat,
  faelligAb,
  monatPlus,
  monatsAuswahl,
  nochNicht,
  serienMonate,
  type BewertungsTyp,
  type Kontext,
} from './fristen';
import type { DateiVersion } from './modell';

const GEHALT: BewertungsTyp = {
  etikett: 'ueblich',
  serie: { anzahl: 3 },
  fristen: { hinweis: 'naechster_monat_faellig', warnungTage: 90 },
};
const BONITAET: BewertungsTyp = {
  etikett: 'ueblich',
  fristen: { hinweisTage: 60, warnungTage: 90 },
};
const MIETE: BewertungsTyp = { etikett: 'kann_helfen', fristen: { warnungTage: 180 } };
const RENTE: BewertungsTyp = { etikett: 'ueblich', fristen: { hinweisTage: 365 } };

let zaehler = 0;
function v(teil: Partial<DateiVersion>): DateiVersion {
  zaehler++;
  return {
    id: `v${zaehler}`,
    createdAt: `2026-01-01T00:00:${String(zaehler).padStart(2, '0')}.000Z`,
    updatedAt: '',
    dokumentId: 'd',
    ausstellungsdatum: null,
    abrechnungsmonat: null,
    variante: null,
    original: 'f',
    aufbereitet: null,
    seiten: null,
    schwaerzungen: {},
    gerastert: false,
    erkannteWerte: null,
    vomNutzerBestaetigt: null,
    ...teil,
  };
}
const monate = (...m: string[]) => m.map((abrechnungsmonat) => v({ abrechnungsmonat }));
const k = (tag: string, teil: Partial<Kontext> = {}): Kontext => {
  const [j, m, d] = tag.split('-').map(Number) as [number, number, number];
  return { heute: new Date(j, m - 1, d), abrechnungMeist: null, stummBis: null, ...teil };
};

describe('Monate', () => {
  it('rechnet über Jahresgrenzen', () => {
    expect(monatPlus('2026-11', 2)).toBe('2027-01');
    expect(monatPlus('2026-01', -1)).toBe('2025-12');
  });

  it('Abrechnung für Oktober kommt im November: Anfang 5., Mitte 15., ohne Angabe spät am 28.', () => {
    expect(faelligAb('2026-10', 'anfang')).toEqual(new Date(2026, 10, 5));
    expect(faelligAb('2026-10', 'mitte')).toEqual(new Date(2026, 10, 15));
    expect(faelligAb('2026-10', null)).toEqual(new Date(2026, 10, 28));
  });

  it('wahrscheinlichster Monat beim Hochladen, wie im Entwurf (September, Oktober, November)', () => {
    expect(erwarteterMonat(new Date(2026, 10, 6), 'anfang')).toBe('2026-10');
    expect(monatsAuswahl(new Date(2026, 10, 6), 'anfang')).toEqual({
      monate: ['2026-09', '2026-10', '2026-11'],
      vorbelegt: '2026-10',
    });
    // Ohne Angabe spät: am 6. November ist Oktober noch nicht fällig, also September.
    expect(erwarteterMonat(new Date(2026, 10, 6), null)).toBe('2026-09');
  });
});

describe('Gehalt als Serie', () => {
  it('ohne Abrechnung: fehlt', () => {
    expect(bewerten(GEHALT, [], k('2026-10-31'))).toMatchObject({
      status: 'fehlt',
      grund: 'Fehlt noch',
    });
  });

  it('zwei von drei Monaten: fehlt noch', () => {
    expect(bewerten(GEHALT, monate('2026-08', '2026-09'), k('2026-10-10'))).toMatchObject({
      status: 'fehlt',
      monate: ['2026-08', '2026-09'],
    });
  });

  it('drei Monate: da; Lücke in der Serie zählt nicht mit', () => {
    expect(bewerten(GEHALT, monate('2026-07', '2026-08', '2026-09'), k('2026-10-10')).status).toBe(
      'da',
    );
    expect(bewerten(GEHALT, monate('2026-06', '2026-08', '2026-09'), k('2026-10-10')).status).toBe(
      'fehlt',
    );
  });

  it('eine vierte Abrechnung schiebt die Serie weiter, ältere bleiben gespeichert', () => {
    const vier = monate('2026-07', '2026-08', '2026-09', '2026-10');
    expect(serienMonate(vier, 3)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(aktuelleVersionen(vier, { anzahl: 3 }).map((x) => x.abrechnungsmonat)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(vier).toHaveLength(4);
  });

  it('dieselbe Monat zweimal: die neuere Version zählt', () => {
    const alt = v({ abrechnungsmonat: '2026-09' });
    const neu = v({ abrechnungsmonat: '2026-09' });
    expect(aktuelleVersionen([neu, alt], { anzahl: 3 })).toEqual([neu]);
  });

  it('„Neuer Monat“ erst, wenn die nächste Abrechnung da sein kann (ohne Angabe: spät)', () => {
    const serie = monate('2026-07', '2026-08', '2026-09');
    // Oktober-Abrechnung kommt ohne Angabe ab 28. November
    expect(bewerten(GEHALT, serie, k('2026-11-27')).status).toBe('da');
    expect(bewerten(GEHALT, serie, k('2026-11-28'))).toMatchObject({
      status: 'bald',
      grund: 'Neuer Monat',
      naechsterMonat: '2026-10',
    });
    // „kommt meist Anfang“: schon ab 5. November
    expect(bewerten(GEHALT, serie, k('2026-11-05', { abrechnungMeist: 'anfang' })).status).toBe(
      'bald',
    );
    expect(bewerten(GEHALT, serie, k('2026-11-04', { abrechnungMeist: 'anfang' })).status).toBe(
      'da',
    );
  });

  it('neueste Abrechnung älter als drei Monate zählt als fehlt', () => {
    const serie = monate('2026-05', '2026-06', '2026-07');
    // Juli kam am 28. August; 90 Tage später ist der 26. November
    expect(bewerten(GEHALT, serie, k('2026-11-26')).status).toBe('bald');
    expect(bewerten(GEHALT, serie, k('2026-11-27'))).toMatchObject({
      status: 'fehlt',
      veraltet: true,
    });
  });

  it('„Noch nicht“ lässt den Hinweis ruhen, aber nie eine echte Lücke', () => {
    const serie = monate('2026-07', '2026-08', '2026-09');
    expect(bewerten(GEHALT, serie, k('2026-11-28', { stummBis: '2026-12-05' })).status).toBe('da');
    expect(bewerten(GEHALT, serie, k('2026-12-06', { stummBis: '2026-12-05' })).status).toBe(
      'bald',
    );
    expect(
      bewerten(GEHALT, monate('2026-08'), k('2026-10-01', { stummBis: '2026-12-05' })).status,
    ).toBe('fehlt');
  });
});

describe('Unterlagen mit Ausstellungsdatum', () => {
  it('Bonitätsnachweis: nach 60 Tagen „Bald zu alt“, nach 90 „Zu alt“ und fehlt (Z1)', () => {
    const b = [v({ ausstellungsdatum: '2026-09-01' })];
    expect(bewerten(BONITAET, b, k('2026-10-31')).status).toBe('da'); // 60 Tage
    expect(bewerten(BONITAET, b, k('2026-11-01'))).toMatchObject({
      status: 'bald',
      grund: 'Bald zu alt, vom 1.\u00a0Sept.',
    });
    expect(bewerten(BONITAET, b, k('2026-11-30')).status).toBe('bald'); // 90 Tage
    expect(bewerten(BONITAET, b, k('2026-12-01'))).toMatchObject({
      status: 'fehlt',
      grund: 'Zu alt, vom 1.\u00a0Sept.',
    });
  });

  it('die neueste Version zählt', () => {
    const b = [v({ ausstellungsdatum: '2026-01-01' }), v({ ausstellungsdatum: '2026-10-20' })];
    expect(bewerten(BONITAET, b, k('2026-10-31'))).toMatchObject({
      status: 'da',
      neuestesDatum: '2026-10-20',
    });
  });

  it('freiwillige Unterlage wird nach 6 Monaten nur als veraltet markiert, nie als „fehlt“', () => {
    const m = [v({ ausstellungsdatum: '2026-01-15' })];
    expect(bewerten(MIETE, m, k('2026-10-31'))).toMatchObject({
      status: 'optional',
      veraltet: true,
    });
    expect(bewerten(MIETE, [], k('2026-10-31')).status).toBe('optional');
  });

  it('Rentenbescheid: nach einem Jahr „Bald zu alt“, nie „fehlt“', () => {
    const r = [v({ ausstellungsdatum: '2025-06-01' })];
    expect(bewerten(RENTE, r, k('2026-10-31')).status).toBe('bald');
  });

  it('Unterlagen ohne Fristen sind da, sobald eine Version da ist', () => {
    expect(
      bewerten({ etikett: 'ueblich' }, [v({ ausstellungsdatum: '2020-01-01' })], k('2026-10-31'))
        .status,
    ).toBe('da');
  });
});

describe('„Noch nicht“', () => {
  it('schweigt eine Woche und fragt höchstens zweimal pro Monat', () => {
    const erst = nochNicht({}, new Date(2026, 10, 3));
    expect(erst).toEqual({ stummBis: '2026-11-10', stummMonat: '2026-11', stummAnzahl: 1 });
    const zweit = nochNicht(erst, new Date(2026, 10, 11));
    expect(zweit).toEqual({ stummBis: '2026-11-30', stummMonat: '2026-11', stummAnzahl: 2 });
    const neuerMonat = nochNicht(zweit, new Date(2026, 11, 1));
    expect(neuerMonat).toEqual({ stummBis: '2026-12-08', stummMonat: '2026-12', stummAnzahl: 1 });
  });
});

describe('aktuelle Versionen je Variante', () => {
  it('nimmt von jeder Variante die neueste, zum Beispiel BAföG und Unterhalt', () => {
    const v = (id: string, variante: string, tag: string) =>
      ({ id, variante, ausstellungsdatum: tag, abrechnungsmonat: null }) as DateiVersion;
    const alle = [
      v('alt', 'bafoeg', '2025-10-01'),
      v('neu', 'bafoeg', '2026-10-01'),
      v('unterhalt', 'unterhalt', '2026-09-01'),
    ];
    expect(
      aktuelleVersionen(alle, undefined, true)
        .map((x) => x.id)
        .sort(),
    ).toEqual(['neu', 'unterhalt']);
    expect(aktuelleVersionen(alle).map((x) => x.id)).toEqual(['neu']);
  });
});

describe('Datum freiwillig', () => {
  const FRISTEN = {
    id: 'bonitaet',
    etikett: 'ueblich' as const,
    fristen: { hinweisTage: 60, warnungTage: 90 },
  };
  const kontext = {
    heute: new Date(2026, 10, 6),
    abrechnungMeist: null,
    stummBis: null,
  };
  const fassung = (id: string, tag: string | null, hochgeladen: string) =>
    ({
      id,
      ausstellungsdatum: tag,
      abrechnungsmonat: null,
      createdAt: hochgeladen,
    }) as DateiVersion;

  it('neue Fassung ohne Datum löst die alte mit Datum ab', () => {
    const alt = fassung('alt', '2026-06-01', '2026-06-02T10:00:00.000Z');
    const neu = fassung('neu', null, '2026-11-06T09:00:00.000Z');
    expect(aktuelleVersionen([alt, neu]).map((x) => x.id)).toEqual(['neu']);
    // Die alte war zu alt; die neue ohne Datum ist einfach da, ohne Warnung.
    expect(bewerten(FRISTEN, [alt], kontext).status).toBe('fehlt');
    expect(bewerten(FRISTEN, [alt, neu], kontext)).toMatchObject({
      status: 'da',
      neuestesDatum: null,
    });
  });

  it('eine neuere Fassung mit Datum zählt wieder', () => {
    const ohne = fassung('ohne', null, '2026-06-02T10:00:00.000Z');
    const neu = fassung('neu', '2026-10-20', '2026-11-06T09:00:00.000Z');
    expect(aktuelleVersionen([ohne, neu]).map((x) => x.id)).toEqual(['neu']);
    expect(bewerten(FRISTEN, [ohne, neu], kontext).neuestesDatum).toBe('2026-10-20');
  });
});

describe('Hinweis als Information', () => {
  const typ: BewertungsTyp = {
    etikett: 'ueblich',
    fristen: { hinweisTage: 55, hinweisArt: 'info', pruefcodeTage: 60, warnungTage: 90 },
  };
  const b = [v({ ausstellungsdatum: '2026-09-01' })];

  it('zählt nicht als offen, erst ab Tag 91 ist die Auskunft zu alt', () => {
    expect(bewerten(typ, b, k('2026-11-01')).status).toBe('da'); // Tag 61
    expect(bewerten(typ, b, k('2026-11-30')).status).toBe('da'); // Tag 90
    expect(bewerten(typ, b, k('2026-12-01')).status).toBe('fehlt'); // Tag 91
  });
});

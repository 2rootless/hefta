import { describe, expect, it } from 'vitest';
import type { DateiVersion, Dokument, Person } from './modell';
import { personStand, standFinden } from './regelkatalog';

// DP45 G3, Prüffälle G3a und G3b: „Neu im Job“ zählt Abrechnungen erst ab dem Anfang, dazu der
// Arbeitsvertrag; vor dem Anfang fragt Hefta nach nichts.

const HEUTE = new Date(2026, 10, 16);

function person(teil: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
    vorname: 'Max',
    nachname: 'Mustermann',
    rufname: 'Max',
    kontakt: { telefon: '', email: '' },
    lebenssituation: 'angestellt',
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: null,
    abrechnungMeist: 'ende',
    ...teil,
  };
}

function dok(typ: string): Dokument {
  return {
    id: `d-${typ}`,
    createdAt: '',
    updatedAt: '',
    personId: 'p1',
    typ,
    notiz: '',
    serie: null,
    stummBis: null,
  };
}

function version(dokumentId: string, monat: string | null, n = 0): DateiVersion {
  return {
    id: `${dokumentId}-${n}`,
    createdAt: `2026-11-0${n + 1}T10:00:00.000Z`,
    updatedAt: '',
    dokumentId,
    ausstellungsdatum: monat ? null : '2026-09-20',
    abrechnungsmonat: monat,
    variante: null,
    original: 'f',
    aufbereitet: null,
    seiten: null,
    schwaerzungen: {},
    gerastert: false,
    erkannteWerte: null,
    vomNutzerBestaetigt: null,
  };
}

const gehalt = (s: ReturnType<typeof personStand>) =>
  s.unterlagen.find((u) => u.typ.id === 'gehaltsnachweis')!;

describe('Neu im Job (DP45 G3)', () => {
  it('ohne „Neu im Job“: drei Monate wie bisher, kein Arbeitsvertrag', () => {
    const s = personStand(
      person(),
      'vertrag',
      [dok('gehaltsnachweis')],
      [version('d-gehaltsnachweis', '2026-10')],
      HEUTE,
    );
    expect(gehalt(s).status).toBe('fehlt');
    // Der Vertrag hängt als freiwilliger Zusatz dran, ohne eigene Zeile und ohne „fehlt“.
    expect(gehalt(s).zusatz?.versionen).toEqual([]);
    expect(gehalt(s).neuSeit).toBeUndefined();
    expect(s.unterlagen.map((u) => u.typ.id)).not.toContain('arbeitsvertrag');
  });

  it('G3a: Anfang 1. Oktober, Oktober da, Vertrag da: vollständig, kein „fehlt noch“ für August und September', () => {
    const p = person({ neuImJob: { seit: '2026-10-01' } });
    const s = personStand(
      p,
      'vertrag',
      [dok('gehaltsnachweis'), dok('arbeitsvertrag')],
      [version('d-gehaltsnachweis', '2026-10'), version('d-arbeitsvertrag', null)],
      HEUTE,
    );
    const g = gehalt(s);
    expect(g.status).toBe('da');
    expect(g.fehlend).toEqual([]);
    expect(g.neuSeit).toBe('2026-10-01');
    expect(g.zusatz?.typ.id).toBe('arbeitsvertrag');
    expect(standFinden(s, 'arbeitsvertrag')?.versionen).toHaveLength(1);
    // Der Vertrag ist keine eigene Zeile und nicht „nicht mehr nötig“.
    expect(s.pfad.map((u) => u.typ.id)).not.toContain('arbeitsvertrag');
    expect(s.nichtMehrNoetig).toEqual([]);
  });

  it('G3a: ohne Vertrag fehlt noch etwas', () => {
    const p = person({ neuImJob: { seit: '2026-10-01' } });
    const s = personStand(
      p,
      'vertrag',
      [dok('gehaltsnachweis')],
      [version('d-gehaltsnachweis', '2026-10')],
      HEUTE,
    );
    expect(gehalt(s).status).toBe('fehlt');
  });

  it('G3b: noch keine Abrechnung möglich: nur der Vertrag', () => {
    const p = person({ neuImJob: { seit: '2026-11-03' } });
    const ohne = personStand(p, 'vertrag', [], [], HEUTE);
    expect(gehalt(ohne).status).toBe('fehlt');
    const mit = personStand(
      p,
      'vertrag',
      [dok('arbeitsvertrag')],
      [version('d-arbeitsvertrag', null)],
      HEUTE,
    );
    expect(gehalt(mit).status).toBe('da');
  });

  it('wieder „Länger als drei Monate“: der Vertrag bleibt freiwillig dabei, ändert aber nichts am Stand', () => {
    const s = personStand(
      person(),
      'vertrag',
      [dok('arbeitsvertrag')],
      [version('d-arbeitsvertrag', null)],
      HEUTE,
    );
    expect(s.nichtMehrNoetig).toEqual([]);
    expect(gehalt(s).zusatz?.versionen).toHaveLength(1);
    expect(gehalt(s).status).toBe('fehlt');
  });
});

describe('Vorschlag „Länger als drei Monate“ (G3c)', () => {
  it('erst, wenn der Anfang mehr als drei Monate zurückliegt', async () => {
    const { neuImJobLange } = await import('./regelkatalog');
    expect(neuImJobLange(person({ neuImJob: { seit: '2026-08-16' } }), HEUTE)).toBe(false);
    expect(neuImJobLange(person({ neuImJob: { seit: '2026-08-15' } }), HEUTE)).toBe(true);
    expect(neuImJobLange(person({ neuImJob: { seit: null } }), HEUTE)).toBe(false);
    expect(neuImJobLange(person(), HEUTE)).toBe(false);
  });
});

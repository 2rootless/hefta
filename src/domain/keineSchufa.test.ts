import { describe, expect, it } from 'vitest';
import { bloecke, standardEinstellungen } from './export';
import { bonitaetZeile } from './mappeWoerter';
import type { DateiVersion, Dokument, Person } from './modell';
import { personStand, personZeilen } from './regelkatalog';

// DP45 G4 mit K1, Prüffälle G4a und G4b.

const HEUTE = new Date(2026, 10, 16);

const lea: Person = {
  id: 'p1',
  createdAt: '',
  updatedAt: '',
  vorname: 'Lea',
  nachname: 'Mustermann',
  rufname: 'Lea',
  kontakt: { telefon: '', email: '' },
  lebenssituation: 'angestellt',
  beruf: '',
  arbeitgeber: '',
  nettoeinkommen: null,
  abrechnungMeist: null,
};

function bonitaet(teil: Partial<Dokument> = {}): Dokument {
  return {
    id: 'd-bon',
    createdAt: '',
    updatedAt: '',
    personId: 'p1',
    typ: 'bonitaet',
    notiz: '',
    serie: null,
    stummBis: null,
    ...teil,
  };
}

const nachweis: DateiVersion = {
  id: 'v1',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '',
  dokumentId: 'd-bon',
  ausstellungsdatum: '2026-11-01',
  abrechnungsmonat: null,
  variante: null,
  original: 'f',
  aufbereitet: null,
  seiten: null,
  schwaerzungen: {},
  gerastert: false,
  erkannteWerte: null,
  vomNutzerBestaetigt: null,
};

const platz = { rolle: 'mitmieter' as const, farbe: 2, bezeichnung: 'weiblich' as const };

describe('Noch keine SCHUFA (DP45 G4, K1)', () => {
  it('G4a: zählt weder als da noch als offen, steht aber als Zeile', () => {
    const s = personStand(
      lea,
      platz,
      [bonitaet({ bonitaet: { art: 'keiner', grund: null } })],
      [],
      HEUTE,
    );
    const b = s.unterlagen.find((u) => u.typ.id === 'bonitaet')!;
    expect(b.status).toBe('optional');
    expect(s.pfad.map((u) => u.typ.id)).not.toContain('bonitaet');
    expect(personZeilen(s).map((u) => u.typ.id)).toContain('bonitaet');
    expect(s.naechster?.typ.id).not.toBe('bonitaet');
  });

  it('G4a: die Zeile in der Mappe, wörtlich, ohne Grund und mit beiden Gründen', () => {
    expect(bonitaetZeile({ grund: null }, 'Lea', 'weiblich')).toBe(
      'Bonitätsnachweis: noch keiner möglich',
    );
    expect(bonitaetZeile({ grund: 'keine_vertraege' }, 'Lea', 'weiblich')).toBe(
      'Bonitätsnachweis: noch keiner möglich. Angabe von Lea: bisher keine Verträge auf ihren Namen',
    );
    expect(bonitaetZeile({ grund: 'keine_vertraege' }, 'Max', 'maennlich')).toContain(
      'auf seinen Namen',
    );
    expect(bonitaetZeile({ grund: 'keine_vertraege' }, 'Kim', 'neutral')).toContain(
      'auf den eigenen Namen',
    );
    expect(
      bonitaetZeile({ grund: 'eigener', text: 'Erst seit Juni volljährig.' }, 'Lea', 'weiblich'),
    ).toBe('Bonitätsnachweis: noch keiner möglich. Angabe von Lea: Erst seit Juni volljährig');
    // K1: „Neu in Deutschland“ gibt es nicht als Vorgabe.
    expect(
      JSON.stringify(bonitaetZeile({ grund: 'keine_vertraege' }, 'Lea', 'weiblich')),
    ).not.toContain('Deutschland');
  });

  it('G4a: in der Mappe als Zeile ohne Seiten dabei', () => {
    const s = personStand(
      lea,
      platz,
      [bonitaet({ bonitaet: { art: 'keiner', grund: null } })],
      [],
      HEUTE,
    );
    const teile = bloecke([s], standardEinstellungen())[0]!.teile.map((x) => x.stand);
    expect(teile.find((u) => u.typ.id === 'bonitaet')?.keinerMoeglich).toBeTruthy();
  });

  it('G4b: später doch ein Nachweis, „Ich habe einen“: die Angabe ist weg', () => {
    const s = personStand(
      lea,
      platz,
      [bonitaet({ bonitaet: { art: 'habe', grund: null } })],
      [nachweis],
      HEUTE,
    );
    const b = s.unterlagen.find((u) => u.typ.id === 'bonitaet')!;
    expect(b.keinerMoeglich).toBeUndefined();
    expect(b.status).toBe('da');
    expect(s.pfad.map((u) => u.typ.id)).toContain('bonitaet');
  });
});

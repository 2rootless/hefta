import { describe, expect, it } from 'vitest';
import katalogRoh from '../../data/regelkatalog.de.json';
import type { HeftaAnhang } from '../pdf/anhang';
import { ansicht, bonitaetFrist, etikettVon } from './ansicht';

const M1: HeftaAnhang = {
  hefta: 3,
  erstellt: '2026-11-02',
  bewerbung: {
    kennung: '6f1c2b9e-4d7a-4c1e-9b2f-3a5d8e7c1f40',
    wohnung: { strasse: 'Hauptstraße 12', rest: '3. OG links · 22767 Hamburg' },
  },
  haushalt: {
    personen: [
      { name: 'Max Mustermann', rolle: 'hauptmieter', kontakt: true },
      { name: 'Lea Mustermann', rolle: 'mitmieter' },
      { name: 'Petra Mustermann', rolle: 'buerge' },
    ],
    mitziehende: [{ text: 'Ein Kind', anzahl: 1, art: 'kind' }],
  },
  unterlagen: [
    { person: 0, typ: 'selbstauskunft', seiten: [2, 2] },
    { person: 0, typ: 'gehaltsnachweis', seiten: [3, 6], monate: ['2026-07', '2026-09'] },
    { person: 0, typ: 'bonitaet', seiten: [7, 7], vom: '2026-10-20', pruefweg: 'pruefcode' },
    { person: 1, typ: 'selbstauskunft', seiten: [8, 8] },
    { person: 1, typ: 'gehaltsnachweis', seiten: [9, 12] },
    { person: 2, typ: 'selbstauskunft', seiten: [13, 13] },
    { person: 2, typ: 'buergschaftserklaerung', seiten: [14, 14] },
    { person: 2, typ: 'rentenbescheid', seiten: [15, 15] },
    { person: 2, typ: 'bonitaet', seiten: [16, 18], vom: '2026-10-18' },
  ],
  seitenzahl: 18,
  modus: 'marktueblich',
};
const HEUTE = new Date(2026, 10, 10);

describe('Etiketten der Zeilen (B10)', () => {
  it('kommen aus dem Katalog, unbekannte Typen unter „Weiteres“', () => {
    expect(etikettVon('selbstauskunft')).toBe('Selbstauskunft');
    expect(etikettVon('gehaltsnachweis')).toBe('Einkommen');
    expect(etikettVon('mietuebernahme_amt')).toBe('Einkommen');
    expect(etikettVon('bonitaet')).toBe('Bonität');
    expect(etikettVon('buergschaftserklaerung')).toBe('Bürgschaft');
    expect(etikettVon('mietzahlung')).toBe('Mietzahlungen');
    expect(etikettVon('empfehlung_vorvermieter')).toBe('Weiteres');
    expect(etikettVon('wbs')).toBe('Weiteres');
    expect(etikettVon('gibt-es-nicht')).toBe('Weiteres');
  });

  it('jeder Einkommenstyp der Vermieterseite heißt „Einkommen“', () => {
    const k = katalogRoh as unknown as { vermieter: { einkommen: string[] } };
    for (const typ of k.vermieter.einkommen) expect(etikettVon(typ)).toBe('Einkommen');
  });

  it('nennt nur Typen, die es im Katalog gibt', () => {
    const k = katalogRoh as unknown as {
      dokumenttypen: { id: string }[];
      vermieter: { etiketten: Record<string, string> };
    };
    const ids = new Set(k.dokumenttypen.map((t) => t.id));
    for (const typ of Object.keys(k.vermieter.etiketten)) expect(ids.has(typ)).toBe(true);
  });
});

describe('Frist der Bonität', () => {
  it('rechnet 60 Tage ab dem Datum der Lesehilfe', () => {
    const f = bonitaetFrist(M1.unterlagen[2]!, HEUTE)!;
    expect(f.bis).toBe('2026-12-19');
    expect(f.kurz).toBe('prüfbar bis 19. Dez.');
    expect(f.lang).toBe('Online prüfbar bis 19. Dezember 2026.');
    expect(f.hinweis).toBe('Endet die Frist, wird der Nachweis dadurch nicht ungültig.');
    expect(f.quelle).toMatch(/^Quelle: Muster des SCHUFA-BonitätsChecks, Stand Januar 2024/);
    expect(f.vorbei).toBe(false);
  });

  it('über den Jahreswechsel und am letzten Tag', () => {
    expect(
      bonitaetFrist({ person: 0, typ: 'bonitaet', seiten: [1, 1], vom: '2026-12-15' }, HEUTE)!.bis,
    ).toBe('2027-02-13');
    const am = bonitaetFrist(M1.unterlagen[2]!, new Date(2026, 11, 19))!;
    expect(am.vorbei).toBe(false);
    expect(bonitaetFrist(M1.unterlagen[2]!, new Date(2026, 11, 20))!.vorbei).toBe(true);
  });

  it('gibt es nur für die Bonität und nur mit Datum', () => {
    expect(bonitaetFrist(M1.unterlagen[0]!, HEUTE)).toBeNull();
    expect(bonitaetFrist({ person: 0, typ: 'bonitaet', seiten: [7, 7] }, HEUTE)).toBeNull();
  });
});

describe('Ansicht aus der Lesehilfe', () => {
  const a = ansicht(M1, HEUTE);

  it('Rahmen-Satz nach E25, Haushalt wie in der Fußzeile, Kennung', () => {
    expect(a.rahmen).toBe('Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.');
    expect(a.haushalt).toBe('Max und Lea Mustermann');
    expect(a.kennung).toBe('6f1c2b9e-4d7a-4c1e-9b2f-3a5d8e7c1f40');
    expect(a.erstellt).toBe('2026-11-02');
  });

  it('Zeilen je Person mit Etikett, Angabe, Gruppe und Frist, nach Seiten', () => {
    const max = a.personen[0]!;
    expect(max.imVertrag).toBe(true);
    expect(max.zeilen.map((z) => z.etikett)).toEqual(['Selbstauskunft', 'Einkommen', 'Bonität']);
    expect(max.zeilen[1]!.angabe).toBe('Juli bis September 2026');
    expect(max.zeilen[0]!.gruppe).toBe(1);
    expect(max.zeilen[2]!.gruppe).toBe(2);
    expect(max.zeilen[2]!.frist?.bis).toBe('2026-12-19');
    expect(max.zeilen[0]!.frist).toBeNull();
    const petra = a.personen[2]!;
    expect(petra.imVertrag).toBe(false);
    expect(petra.zeilen.map((z) => z.etikett)).toEqual([
      'Selbstauskunft',
      'Bürgschaft',
      'Einkommen',
      'Bonität',
    ]);
    expect(petra.zeilen.every((z) => z.gruppe === 2)).toBe(true);
  });

  it('Register: Deckblatt vorn, dann nach Seiten, mit Namen', () => {
    expect(a.register[0]).toEqual({ etikett: 'Deckblatt', name: '', seite: 1 });
    expect(a.register.map((r) => r.seite)).toEqual([1, 2, 3, 7, 8, 9, 13, 14, 15, 16]);
    expect(a.register[3]).toEqual({ etikett: 'Bonität', name: 'Max Mustermann', seite: 7 });
  });

  it('nennt nie Beträge (VS2)', () => {
    expect(JSON.stringify(a)).not.toMatch(/€|Euro|netto|brutto|\d\.\d{3},\d{2}/i);
  });

  it('ohne Kennung und ohne Bürgen', () => {
    const b = ansicht(
      {
        ...M1,
        bewerbung: { wohnung: null },
        haushalt: { personen: [M1.haushalt.personen[0]!], mitziehende: [] },
        unterlagen: [M1.unterlagen[0]!],
      },
      HEUTE,
    );
    expect(b.kennung).toBeNull();
    expect(b.rahmen).toBe('Eine Person im Mietvertrag.');
    expect(b.register).toHaveLength(2);
  });
});

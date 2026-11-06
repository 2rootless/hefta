import { describe, expect, it } from 'vitest';
import type { HeftaAnhang } from '../pdf/anhang';
import {
  datumText,
  fehlendeGruppe,
  groesseText,
  gruppe,
  haushaltTitel,
  lesehilfePasst,
  monateText,
  pruefPunkte,
  seitenText,
  standText,
  unterlageText,
  vollstaendigkeit,
  werKurz,
} from './regel';

const M1: HeftaAnhang = {
  hefta: 1,
  erstellt: '2026-11-02',
  bewerbung: { wohnung: { strasse: 'Hauptstraße 12', rest: '3. OG links · 22767 Hamburg' } },
  haushalt: {
    personen: [
      { name: 'Max Mustermann', rolle: 'hauptmieter', kontakt: true },
      { name: 'Lea Mustermann', rolle: 'mitmieter' },
      { name: 'Petra Mustermann', rolle: 'buerge' },
    ],
    mitziehende: [{ text: 'Ein Kind', anzahl: 1 }],
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
const ERSTE = 'Hauptstraße 12 Max Mustermann Lea Mustermann Petra Mustermann';

function mit(teil: Partial<HeftaAnhang>): HeftaAnhang {
  return { ...M1, ...teil };
}
const allein = (personen: HeftaAnhang['haushalt']['personen'], mitziehende = 0) =>
  mit({
    unterlagen: [],
    haushalt: {
      personen,
      mitziehende: mitziehende ? [{ text: 'Kinder', anzahl: mitziehende }] : [],
    },
  });

describe('Titel und Zeile im Eingang', () => {
  it('fasst den Haushalt wie in der Fußzeile zusammen', () => {
    expect(haushaltTitel(M1)).toBe('Max und Lea Mustermann');
    expect(
      haushaltTitel(
        allein([
          { name: 'Jonas Becker', rolle: 'hauptmieter' },
          { name: 'Mira Yılmaz', rolle: 'mitmieter' },
        ]),
      ),
    ).toBe('Jonas Becker und Mira Yılmaz');
  });

  it('nennt die Personenzahl, aber weder Kinder noch Bürgen', () => {
    const z = werKurz(M1);
    expect(z).toBe('Max und Lea im Vertrag · drei Personen');
    expect(z).not.toMatch(/Kind|bürgt|Petra/);
  });

  it('allein, mit Kindern und ab drei im Vertrag', () => {
    expect(werKurz(allein([{ name: 'Olena Kovalenko', rolle: 'hauptmieter' }]))).toBe(
      'Olena allein im Vertrag',
    );
    expect(werKurz(allein([{ name: 'Tom Nguyen', rolle: 'hauptmieter' }], 2))).toBe(
      'Tom im Vertrag · drei Personen',
    );
    expect(
      werKurz(
        allein([
          { name: 'A B', rolle: 'hauptmieter' },
          { name: 'C D', rolle: 'mitmieter' },
          { name: 'E F', rolle: 'mitmieter' },
        ]),
      ),
    ).toBe('Drei im Vertrag');
  });
});

describe('Vollständigkeit nach Schritten', () => {
  it('Im Eingang zählt nur der Mietwunsch: Fehlende Vertragsunterlagen sind keine Lücke (VS14)', () => {
    const { ziel, personen } = vollstaendigkeit(M1);
    expect(ziel).toBe('will_wohnung');
    expect(personen[1]!.fehlt).toEqual([]);
    expect(personen[1]!.spaeter.map((f) => f.typ)).toEqual(['bonitaet']);
    expect(standText(M1)).toBe('Selbstauskunft von allen dabei');
  });

  it('Jeder der sechs Einkommensnachweise erfüllt die Anforderung', () => {
    const { personen } = vollstaendigkeit(M1);
    expect(personen[2]!.spaeter).toEqual([]);
    const ohne = vollstaendigkeit(
      mit({ unterlagen: [{ person: 0, typ: 'selbstauskunft', seiten: [2, 2] }] }),
    );
    expect(ohne.personen[0]!.spaeter.map((f) => f.text.replace('\u00ad', ''))).toContain(
      'Einkommensnachweis',
    );
  });

  it('Stand nennt, von wem die Selbstauskunft fehlt, ohne Wertung (VS13)', () => {
    const ohneLea = mit({ unterlagen: M1.unterlagen.filter((u) => u.person !== 1) });
    expect(standText(ohneLea)).toBe('Selbstauskunft von Lea nicht dabei');
    const ohneBeide = mit({ unterlagen: [] });
    expect(standText(ohneBeide)).toBe('Selbstauskunft von Max und Lea nicht dabei');
    expect(standText(ohneBeide)).not.toMatch(/alles|vollständig|fehlt/i);
    expect(standText(allein([{ name: 'O K', rolle: 'hauptmieter' }]))).toBe(
      'Selbstauskunft nicht dabei',
    );
  });

  it('Datensparsam: Der gewählte Schritt zählt', () => {
    const b = mit({ modus: 'datensparsam', schritt: 'besichtigung', unterlagen: [] });
    expect(standText(b)).toBe('Zusammengestellt für die Besichtigung');
    expect(vollstaendigkeit(b).personen[0]!.fehlt).toEqual([]);
    const z = mit({ modus: 'datensparsam', schritt: 'zusage', unterlagen: [] });
    const fehlt = vollstaendigkeit(z).personen[0]!.fehlt;
    expect(fehlt.map((f) => f.schritt)).toEqual(['will_wohnung', 'zusage', 'zusage']);
    expect(fehlendeGruppe(fehlt[1]!, M1.haushalt.personen[0]!)).toBe(2);
  });

  it('Bürgen stehen ganz bei der Entscheidung', () => {
    const p = M1.haushalt.personen[2]!;
    expect(gruppe({ person: 2, typ: 'selbstauskunft', seiten: [13, 13] }, p)).toBe(2);
    const v = vollstaendigkeit(mit({ unterlagen: [] })).personen[2]!;
    expect(v.fehlt).toEqual([]);
    expect(v.spaeter).toHaveLength(4);
  });

  it('Gruppen der Unterlagen', () => {
    const p = M1.haushalt.personen[0]!;
    expect(gruppe({ person: 0, typ: 'selbstauskunft', seiten: [2, 2] }, p)).toBe(1);
    expect(gruppe({ person: 0, typ: 'wbs', seiten: [2, 2] }, p)).toBe(1);
    expect(gruppe({ person: 0, typ: 'gehaltsnachweis', seiten: [2, 2] }, p)).toBe(2);
    expect(gruppe({ person: 0, typ: 'ausweiskopie', seiten: [2, 2] }, p)).toBe(3);
    expect(gruppe({ person: 0, typ: 'schufa_datenkopie', seiten: [2, 2] }, p)).toBe(3);
  });

  it('Bezeichnungen nur aus dem Katalog, auch bei erfundenen Typen', () => {
    expect(unterlageText({ person: 0, typ: 'erfunden <b>', seiten: [1, 1] })).toBe(
      'Weitere Unterlage',
    );
  });
});

describe('Prüfen', () => {
  const { punkte, quelle } = pruefPunkte(M1);

  it('nennt den Code nur, wo die Lesehilfe ihn belegt, und rechnet kein Datum aus', () => {
    expect(punkte.map((p) => p.titel)).toEqual([
      'Bonitätsnachweis von Max',
      'Bürgschaft von Petra',
      'Bonitätsnachweis von Petra',
    ]);
    expect(punkte[0]!.text).toContain('steht auf dem Zertifikat');
    expect(punkte[0]!.text).toContain('Beides steht auf dem Zertifikat');
    expect(punkte[2]!.text).toMatch(/^Steht auf dem Zertifikat/);
    expect(punkte.map((p) => p.text).join(' ')).not.toMatch(/Dezember|November/);
    expect(punkte[0]!.link!.url).toBe('https://www.meineschufa.de/check');
  });

  it('nennt Quelle und Stand (VS10)', () => {
    expect(quelle).toMatch(/Stand 2022/);
    expect(quelle).toContain('keine Rechtsberatung');
  });
});

describe('Passt die Lesehilfe zur Mappe?', () => {
  it('nimmt eine stimmige Lesehilfe an, auch wenn die Zeilen anders brechen', () => {
    expect(lesehilfePasst(M1, 18, ERSTE)).toBe(true);
    expect(lesehilfePasst(M1, 18, 'Haupt\nstraße\u00a012 Max\nMustermann Lea Petra')).toBe(true);
  });

  it('Seite entfernt: Die Gesamtzahl stimmt nicht mehr', () => {
    expect(lesehilfePasst(M1, 17, ERSTE)).toBe(false);
  });

  it('ohne Gesamtzahl gilt der Bereich der Seiten', () => {
    expect(lesehilfePasst(mit({ seitenzahl: undefined }), 18, ERSTE)).toBe(true);
    expect(lesehilfePasst(mit({ seitenzahl: undefined }), 17, ERSTE)).toBe(false);
  });

  it('Namen und Straße müssen auf Seite 1 stehen', () => {
    expect(lesehilfePasst(M1, 18, 'Hauptstraße 12 Max Mustermann Lea')).toBe(false);
    expect(lesehilfePasst(M1, 18, 'Max Mustermann Lea Petra')).toBe(false);
  });

  it.each([
    ['Person ins Leere', { unterlagen: [{ person: 9, typ: 'wbs', seiten: [1, 1] }] }],
    ['Seite verkehrt', { unterlagen: [{ person: 0, typ: 'wbs', seiten: [5, 2] }] }],
    ['Seite null', { unterlagen: [{ person: 0, typ: 'wbs', seiten: [0, 1] }] }],
    ['Seite kein Bereich', { unterlagen: [{ person: 0, typ: 'wbs', seiten: [1] }] }],
    ['Datum falsch', { unterlagen: [{ person: 0, typ: 'wbs', seiten: [1, 1], vom: 'gestern' }] }],
    ['Monat falsch', { unterlagen: [{ person: 0, typ: 'wbs', seiten: [1, 1], monate: ['x'] }] }],
    ['Erstellt fehlt', { erstellt: undefined }],
    ['Schritt erfunden', { schritt: 'irgendwann' }],
    ['Bitte zu lang', { loeschwunsch: 'x'.repeat(501) }],
  ])('%s', (_, teil) => {
    expect(lesehilfePasst(mit(teil as unknown as Partial<HeftaAnhang>), 18, ERSTE)).toBe(false);
  });

  it('Name überlang, Rolle erfunden, niemand im Vertrag', () => {
    const name = 'x'.repeat(201);
    expect(
      lesehilfePasst(allein([{ name, rolle: 'hauptmieter' }]), 18, name + ' Hauptstraße 12'),
    ).toBe(false);
    expect(
      lesehilfePasst(
        allein([{ name: 'Max Mustermann', rolle: 'chef' as 'hauptmieter' }]),
        18,
        ERSTE,
      ),
    ).toBe(false);
    expect(lesehilfePasst(allein([{ name: 'Petra Mustermann', rolle: 'buerge' }]), 18, ERSTE)).toBe(
      false,
    );
  });
});

describe('Schreibweisen', () => {
  it('Datum, Monate, Seiten, Größe', () => {
    expect(datumText('2026-11-02')).toBe('2.\u00a0November 2026');
    expect(datumText('2026-11-02', false)).toBe('2.\u00a0November');
    expect(monateText(['2026-07', '2026-08', '2026-09'])).toBe('Juli bis September 2026');
    expect(monateText(['2025-12', '2026-01'])).toBe('Dezember 2025 bis Januar 2026');
    expect(seitenText([2, 2])).toBe('Seite\u00a02');
    expect(seitenText([3, 6])).toBe('Seiten\u00a03\u2060–\u20606');
    expect(groesseText(2_516_582)).toBe('2,4\u00a0MB');
    expect(groesseText(240 * 1024)).toBe('240\u00a0KB');
  });
});

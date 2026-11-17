import { describe, expect, it } from 'vitest';
import { anhangLesen, type AnhangPerson, type AnhangUnterlage } from '../pdf/anhang';
import * as regel from './regel';
import {
  datumText,
  groesseText,
  mailEmpfaenger,
  telefonLink,
  monateText,
  seitenText,
  unterlageText,
} from './regel';

// Fassung 4 (PC100): Die Testdaten bleiben in Fassung 3. Jede Prüfung bekommt sie so, wie die Vermieterseite sie
// liest: über lesen() aus dem Paket hefta-json, das Fassung 1 bis 3 in das Bild von Fassung 4 überträgt (F11).
interface AltUnterlage {
  person: number;
  typ: string;
  seiten: number[];
  vom?: string;
  monate?: string[];
  pruefweg?: string;
}
interface AltPerson {
  name: string;
  rolle: string;
  kontakt?: true;
}
interface Alt {
  hefta: number;
  erstellt?: string;
  bewerbung: { kennung?: string; wohnung: { strasse: string; rest: string } | null };
  haushalt: { personen: AltPerson[]; mitziehende: { text: string; anzahl: number; art: string }[] };
  unterlagen: AltUnterlage[];
  seitenzahl?: number;
  modus?: string;
  schritt?: string;
  loeschwunsch?: string;
}
const bild = (x: unknown) => anhangLesen(JSON.stringify(x));
const sicher = (x: unknown) => {
  const b = bild(x);
  if (!b) throw new Error('Testdaten sind keine Lesehilfe');
  return b;
};
const lesehilfePasst = (x: unknown, seiten: number, text: string) => {
  const b = bild(x);
  return !!b && regel.lesehilfePasst(b, seiten, text);
};
const haushaltTitel = (x: unknown) => regel.haushaltTitel(sicher(x));
const werKurz = (x: unknown) => regel.werKurz(sicher(x));
const vollstaendigkeit = (x: unknown) => regel.vollstaendigkeit(sicher(x));
const standText = (x: unknown) => regel.standText(sicher(x));
const pruefPunkte = (x: unknown) => regel.pruefPunkte(sicher(x));
const person = (p: AltPerson) => ({ ...p, unterlagen: [] }) as unknown as AnhangPerson;
const unterlage = (u: AltUnterlage): AnhangUnterlage =>
  ({ ...u, seiten_mappe: { von: u.seiten[0], bis: u.seiten[1] } }) as unknown as AnhangUnterlage;
const gruppe = (u: AltUnterlage, p: AltPerson) => regel.gruppe(unterlage(u), person(p));
const fehlendeGruppe = (f: regel.Fehlend, p: AltPerson) => regel.fehlendeGruppe(f, person(p));

const M1: Alt = {
  hefta: 3,
  erstellt: '2026-11-02',
  bewerbung: {
    kennung: '6f1c2b9e-4d7a-4c1e-9b2f-3a5d8e7c1f40',
    wohnung: { strasse: 'Beispielstraße 1', rest: '3. OG links · 12345 Musterstadt' },
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
const ERSTE = 'Beispielstraße 1 Max Mustermann Lea Mustermann Petra Mustermann';

function mit(teil: Partial<Alt>): Alt {
  return { ...M1, ...teil };
}
const allein = (personen: AltPerson[], mitziehende = 0) =>
  mit({
    unterlagen: [],
    haushalt: {
      personen,
      mitziehende: mitziehende ? [{ text: 'Kinder', anzahl: mitziehende, art: 'kind' }] : [],
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
    expect(z).toBe('Max und Lea im Vertrag, drei Personen');
    expect(z).not.toMatch(/Kind|bürgt|Petra/);
  });

  it('allein, mit Kindern und ab drei im Vertrag', () => {
    expect(werKurz(allein([{ name: 'Olena Kovalenko', rolle: 'hauptmieter' }]))).toBe(
      'Olena allein im Vertrag',
    );
    expect(werKurz(allein([{ name: 'Tom Nguyen', rolle: 'hauptmieter' }], 2))).toBe(
      'Tom im Vertrag, drei Personen',
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
    expect(unterlageText(unterlage({ person: 0, typ: 'erfunden <b>', seiten: [1, 1] }))).toBe(
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
    expect(quelle).toMatch(/Stand Januar 2024, abgerufen im November 2026/);
    expect(quelle).toContain('keine Rechtsberatung');
  });
});

describe('Passt die Lesehilfe zur Mappe?', () => {
  it('nimmt eine stimmige Lesehilfe an, auch wenn die Zeilen anders brechen', () => {
    expect(lesehilfePasst(M1, 18, ERSTE)).toBe(true);
    expect(lesehilfePasst(M1, 18, 'Beispiel\nstraße\u00a01 Max\nMustermann Lea Petra')).toBe(true);
  });

  it('seit der Veröffentlichung nur mit Kennung der Bewerbung (E21)', () => {
    const ohne = { ...M1, bewerbung: { wohnung: M1.bewerbung.wohnung } };
    expect(lesehilfePasst(ohne, 18, ERSTE)).toBe(false);
    const falsch = { ...M1, bewerbung: { ...M1.bewerbung, kennung: 'keine-uuid' } };
    expect(lesehilfePasst(falsch, 18, ERSTE)).toBe(false);
  });

  it('Seite entfernt: Die Gesamtzahl stimmt nicht mehr', () => {
    expect(lesehilfePasst(M1, 17, ERSTE)).toBe(false);
  });

  it('ohne Gesamtzahl gilt der Bereich der Seiten', () => {
    expect(lesehilfePasst(mit({ seitenzahl: undefined }), 18, ERSTE)).toBe(true);
    expect(lesehilfePasst(mit({ seitenzahl: undefined }), 17, ERSTE)).toBe(false);
  });

  it('Namen und Straße müssen auf Seite 1 stehen', () => {
    expect(lesehilfePasst(M1, 18, 'Beispielstraße 1 Max Mustermann Lea')).toBe(false);
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
    expect(lesehilfePasst(mit(teil as unknown as Partial<Alt>), 18, ERSTE)).toBe(false);
  });

  it('Name überlang, Rolle keine Kennung, niemand im Vertrag', () => {
    const name = 'x'.repeat(201);
    expect(
      lesehilfePasst(allein([{ name, rolle: 'hauptmieter' }]), 18, name + ' Beispielstraße 1'),
    ).toBe(false);
    expect(
      lesehilfePasst(
        allein([{ name: 'Max Mustermann', rolle: 'Chef!' as 'hauptmieter' }]),
        18,
        ERSTE,
      ),
    ).toBe(false);
    // U1 (PC101): Eine neue Rolle mit gültiger Kennung wird gelesen; die Seite zeigt sie neutral.
    expect(
      lesehilfePasst(
        allein([{ name: 'Max Mustermann', rolle: 'untermieter' as 'hauptmieter' }]),
        18,
        ERSTE,
      ),
    ).toBe(true);
    expect(lesehilfePasst(allein([{ name: 'Petra Mustermann', rolle: 'buerge' }]), 18, ERSTE)).toBe(
      false,
    );
  });
});

describe('Kontakt in der Lesehilfe (Fassung 3, E17)', () => {
  const KONTAKT = { telefon: '0171 3920001', email: 'max.mustermann@example.com' };
  const mitKontakt = (kontakt: unknown) =>
    ({ ...M1, haushalt: { ...M1.haushalt, kontakt } }) as unknown as Alt;
  const SEITE = `${ERSTE} Kontakt Max Mustermann 0171 3920001 max.mustermann@example.com`;

  it('gilt, wenn Telefon und Mail wörtlich auf Seite 1 stehen, auch über einen Zeilenumbruch', () => {
    expect(lesehilfePasst(mitKontakt(KONTAKT), 18, SEITE)).toBe(true);
    const umbrochen = `${ERSTE} 0171 3920001 max.mustermann
@example.com`;
    expect(lesehilfePasst(mitKontakt(KONTAKT), 18, umbrochen)).toBe(true);
    expect(lesehilfePasst(mitKontakt({ telefon: '0171 3920001' }), 18, SEITE)).toBe(true);
  });

  it('passt nicht, wenn eine Nummer oder Mail nicht auf Seite 1 steht: Schutz vor Fälschung', () => {
    expect(lesehilfePasst(mitKontakt({ ...KONTAKT, telefon: '0171 3920011' }), 18, SEITE)).toBe(
      false,
    );
    expect(lesehilfePasst(mitKontakt({ ...KONTAKT, email: 'betrug@example.org' }), 18, SEITE)).toBe(
      false,
    );
    expect(lesehilfePasst(mitKontakt({}), 18, SEITE)).toBe(false);
    expect(lesehilfePasst(mitKontakt('0171 3920001'), 18, SEITE)).toBe(false);
    const ohneKontaktperson = {
      ...M1,
      haushalt: {
        ...M1.haushalt,
        personen: M1.haushalt.personen.map((p) => ({ name: p.name, rolle: p.rolle })),
        kontakt: KONTAKT,
      },
    } as Alt;
    expect(lesehilfePasst(ohneKontaktperson, 18, SEITE)).toBe(false);
  });

  it('Links nur aus sauberen Werten', () => {
    expect(telefonLink('0171 3920001')).toBe('tel:01713920001');
    expect(telefonLink('+49 (0)40 123-456')).toBe('tel:+49040123456');
    expect(telefonLink('javascript:alert(1)')).toBeNull();
    expect(telefonLink('12')).toBeNull();
    expect(mailEmpfaenger('max.mustermann@example.com')).toBe('max.mustermann@example.com');
    expect(mailEmpfaenger('max@example.com?bcc=x@example.com')).toBeNull();
    expect(mailEmpfaenger('max mustermann@example.com')).toBeNull();
    expect(mailEmpfaenger(undefined)).toBeNull();
  });
});

describe('Schreibweisen', () => {
  it('Datum, Monate, Seiten, Größe', () => {
    expect(datumText('2026-11-02')).toBe('2.\u00a0November 2026');
    expect(datumText('2026-11-02', false)).toBe('2.\u00a0November');
    // Fassung 4: Zeitpunkt mit Uhrzeit und Zeitzone; es zählt der Tag am Ort der Mappe.
    expect(datumText('2026-11-18T23:30:00+01:00')).toBe('18.\u00a0November 2026');
    expect(monateText(['2026-07', '2026-08', '2026-09'])).toBe('Juli bis September 2026');
    expect(monateText(['2025-12', '2026-01'])).toBe('Dezember 2025 bis Januar 2026');
    expect(seitenText({ von: 2, bis: 2 })).toBe('Seite\u00a02');
    expect(seitenText({ von: 3, bis: 6 })).toBe('Seiten\u00a03\u2060–\u20606');
    expect(groesseText(2_516_582)).toBe('2,4\u00a0MB');
    expect(groesseText(240 * 1024)).toBe('240\u00a0KB');
  });
});

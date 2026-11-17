import Ajv from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  lesen,
  MITZIEHENDE,
  passt,
  ROLLEN,
  telefonE164,
  typText,
  UNBEKANNT,
  VERZEICHNIS,
  type Lesehilfe,
} from './index.js';

// Das Paket hefta-json (PC98 bis PC100, E205 bis E207): Beispiele gegen Schema und Prüfung, Gegenproben, Lesen von
// Fassung 1 bis 3, Telefonregel. Die Beispiele sind dieselben, die im Paket liegen.

const ORDNER = new URL('../beispiele/', import.meta.url);
const schema = JSON.parse(
  readFileSync(new URL('../schema.json', import.meta.url), 'utf8'),
) as object;
const schemaPruefen = new Ajv({ allErrors: true }).compile(schema);
const beispiele = readdirSync(ORDNER)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => [n, readFileSync(new URL(n, ORDNER), 'utf8')] as const);

/** Seite 1 so, wie ein PDF-Leser sie liefern könnte: alle Namen, Straße und Kontaktdaten, umbrochen. */
function seite1(l: Lesehilfe): string {
  const teile = [l.bewerbung.wohnung?.strasse ?? '', l.bewerbung.wohnung?.rest ?? ''];
  for (const p of l.haushalt.personen) teile.push(p.name, p.telefon ?? '', p.email ?? '');
  return teile.join('\n');
}
const mappe = (l: Lesehilfe) => ({ seiten: l.seitenzahl ?? 0, textSeite1: seite1(l) });
const kopie = (l: Lesehilfe): Lesehilfe => JSON.parse(JSON.stringify(l)) as Lesehilfe;

describe('hefta-json: die Beispiele', () => {
  it('gibt es fünf, und jedes besteht Schema, lesen() und passt()', () => {
    expect(beispiele.map(([n]) => n)).toHaveLength(5);
    for (const [name, text] of beispiele) {
      expect(
        schemaPruefen(JSON.parse(text)),
        `${name}: ${JSON.stringify(schemaPruefen.errors)}`,
      ).toBe(true);
      const l = lesen(text);
      expect(l, name).not.toBeNull();
      expect(passt(l!, mappe(l!)), name).toBe(true);
    }
  });

  it('Fassung 5 und ein anderes Land bleiben gültig (PC100)', () => {
    const l = lesen(beispiele[1]![1])!;
    const neu = { ...kopie(l), hefta: 5 };
    expect(schemaPruefen(neu)).toBe(true);
    expect(passt(neu, mappe(neu))).toBe(true);
    const at = kopie(l);
    at.bewerbung.wohnung!.teile!.land = 'AT';
    expect(schemaPruefen(at)).toBe(true);
    expect(passt(at, mappe(at))).toBe(true);
  });
});

describe('hefta-json: Gegenproben, jede passt nicht', () => {
  const basis = () => kopie(lesen(beispiele[1]![1])!);
  const faelle: [string, (l: Lesehilfe) => void, { schema?: boolean }?][] = [
    ['Fassung 3 mit Feldern von 4', (l) => (l.hefta = 3)],
    ['erstellt nur als Tag', (l) => (l.erstellt = '2026-11-18')],
    ['Seitenzahl stimmt nicht', (l) => (l.seitenzahl = 17), { schema: false }],
    ['Fassung fehlt', (l) => delete l.fassung],
    [
      'Name passt nicht zu Vor- und Nachname',
      (l) => (l.haushalt.personen[1]!.name = 'Lea M.'),
      { schema: false },
    ],
    [
      'Name nicht auf Seite 1',
      (l) => (l.haushalt.personen[1]!.name = 'Lea Fremd'),
      { schema: false },
    ],
    [
      'Seiten überschneiden sich',
      (l) => (l.haushalt.personen[1]!.unterlagen[0]!.seiten_mappe.von = 6),
      { schema: false },
    ],
    [
      'Seite hinter dem Ende',
      (l) => (l.haushalt.personen[2]!.unterlagen[2]!.seiten_mappe.bis = 17),
      { schema: false },
    ],
    ['zwei Kontaktpersonen', (l) => (l.haushalt.personen[1]!.kontakt = true), { schema: false }],
    [
      'Telefon bei einer Person ohne Kontakt',
      (l) => (l.haushalt.personen[1]!.telefon = '0171 3920001'),
    ],
    [
      'E.164 falsch abgeleitet',
      (l) => (l.haushalt.personen[0]!.telefon_e164 = '+4901713920001'),
      { schema: false },
    ],
    ['Land mit drei Buchstaben', (l) => (l.bewerbung.wohnung!.teile!.land = 'DEU')],
    ['Land klein', (l) => (l.bewerbung.wohnung!.teile!.land = 'de')],
    [
      'weggelassene Seiten ohne Seitenzahlen',
      (l) => delete l.haushalt.personen[0]!.unterlagen[2]!.vermerke![0]!.seiten_original,
    ],
    ['Schritt ohne datensparsam', (l) => (l.schritt = 'zusage'), { schema: false }],
    [
      'Rolle keine Kennung',
      (l) =>
        (l.haushalt.personen[1]!.rolle =
          'Mit Mieter' as Lesehilfe['haushalt']['personen'][0]['rolle']),
    ],
    ['zwei Hauptmieter', (l) => (l.haushalt.personen[1]!.rolle = 'hauptmieter'), { schema: false }],
    ['Bürgin vor jemandem im Mietvertrag', (l) => l.haushalt.personen.reverse(), { schema: false }],
    [
      'Unterlage auf dem Deckblatt (Seite 1)',
      (l) => (l.haushalt.personen[0]!.unterlagen[0]!.seiten_mappe.von = 1),
      { schema: false },
    ],
    [
      'Vorname leer',
      (l) => {
        const p = l.haushalt.personen[0]!;
        p.vorname = '';
        p.name = 'Mustermann';
      },
    ],
    ['Kennung keine UUID', (l) => (l.bewerbung.kennung = 'abc')],
  ];
  for (const [name, aendern, o] of faelle)
    it(name, () => {
      const l = basis();
      const seite = seite1(basis());
      aendern(l);
      expect(passt(l, { seiten: 16, textSeite1: seite })).toBe(false);
      // Was das Schema allein erkennt, fällt dort auch auf.
      if (o?.schema !== false) expect(schemaPruefen(l)).toBe(false);
    });
});

describe('hefta-json: offene Listen (U1, PC101)', () => {
  const basis = () => kopie(lesen(beispiele[1]![1])!);
  it('eine neue Rolle und eine neue Art der Mitziehenden werden gelesen und neutral gezeigt', () => {
    const l = basis();
    l.haushalt.personen[1]!.rolle = 'untermieter' as Lesehilfe['haushalt']['personen'][0]['rolle'];
    l.haushalt.mitziehende[0]!.art = 'pflegekind' as Lesehilfe['haushalt']['mitziehende'][0]['art'];
    expect(schemaPruefen(l)).toBe(true);
    expect(passt(l, mappe(l))).toBe(true);
    const zeige = (rolle: string) => (rolle in ROLLEN ? rolle : UNBEKANNT.rolle);
    expect(zeige(l.haushalt.personen[1]!.rolle)).toBe('Person');
    expect(l.haushalt.mitziehende[0]!.art in MITZIEHENDE ? 'bekannt' : UNBEKANNT.mitziehend).toBe(
      'weitere Person',
    );
  });

  it('Nachname leer: Name gleich Vorname (U2); BOM wird überlesen (U10)', () => {
    const l = lesen(beispiele[4]![1])!;
    expect(l.haushalt.personen[1]).toMatchObject({ name: 'Aylin', vorname: 'Aylin', nachname: '' });
    expect(passt(l, mappe(l))).toBe(true);
    expect(lesen(String.fromCharCode(0xfeff) + beispiele[0]![1])).toEqual(lesen(beispiele[0]![1]));
    expect(
      lesen(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(beispiele[0]![1])])),
    ).toEqual(lesen(beispiele[0]![1]));
  });

  it('der Wortlaut des Verzeichnisses enthält weder | noch ; (U5)', () => {
    for (const [typ, text] of Object.entries(VERZEICHNIS)) expect(text, typ).not.toMatch(/[|;]/);
  });
});

describe('hefta-json: lesen()', () => {
  // Die Lesehilfe der Beispiel-Mappe auf hefta.de, Fassung 3 (gekürzt um zwei Unterlagen).
  const fassung3 = {
    hefta: 3,
    erstellt: '2026-11-06',
    bewerbung: {
      kennung: 'd2e0f734-0b59-41ea-95f4-c9715acbe034',
      wohnung: { strasse: 'Lindenring 3', rest: 'Erdgeschoss, 20259 Hamburg' },
    },
    haushalt: {
      personen: [
        { name: 'Max Mustermann', rolle: 'hauptmieter', kontakt: true },
        { name: 'Lea Mustermann', rolle: 'mitmieter' },
      ],
      mitziehende: [{ text: 'Ein Kind', anzahl: 1, art: 'kind' }],
      kontakt: { telefon: '0171 3920001', email: 'max.mustermann@example.com' },
    },
    unterlagen: [
      { person: 0, typ: 'selbstauskunft', seiten: [2, 2] },
      {
        person: 0,
        typ: 'gehaltsnachweis',
        seiten: [3, 5],
        monate: ['2026-08', '2026-09', '2026-10'],
      },
      { person: 1, typ: 'selbstauskunft', seiten: [6, 6] },
    ],
    seitenzahl: 6,
    modus: 'marktueblich',
  };

  it('überträgt Fassung 3 in das Bild von Fassung 4', () => {
    const l = lesen(JSON.stringify(fassung3))!;
    expect(l.hefta).toBe(3);
    expect(l.haushalt.personen[0]).toEqual({
      name: 'Max Mustermann',
      rolle: 'hauptmieter',
      kontakt: true,
      telefon: '0171 3920001',
      email: 'max.mustermann@example.com',
      unterlagen: [
        { typ: 'selbstauskunft', seiten_mappe: { von: 2, bis: 2 } },
        {
          typ: 'gehaltsnachweis',
          seiten_mappe: { von: 3, bis: 5 },
          monate: ['2026-08', '2026-09', '2026-10'],
        },
      ],
    });
    expect(l.haushalt.personen[1]!.unterlagen).toEqual([
      { typ: 'selbstauskunft', seiten_mappe: { von: 6, bis: 6 } },
    ]);
    expect('kontakt' in l.haushalt).toBe(false);
    expect('unterlagen' in l).toBe(false);
    expect(passt(l, mappe(l))).toBe(true);
  });

  it('nimmt Bytes und überliest Unbekanntes; ergibt null für alles, was keine Lesehilfe ist, und wirft nie', () => {
    const text = beispiele[0]![1];
    expect(lesen(new TextEncoder().encode(text))).toEqual(lesen(text));
    expect(lesen(text.replace('"hefta": 4,', '"hefta": 4, "x_fremd": 1,'))).not.toBeNull();
    for (const kaputt of [
      '',
      'null',
      '[]',
      '{}',
      '{"hefta":"4"}',
      '{"hefta":0,"haushalt":{"personen":[]}}',
      '{',
      '\u0000',
    ])
      expect(lesen(kaputt), kaputt).toBeNull();
    expect(lesen(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
    // Fassung 3 mit falscher Nummer der Person oder Kontakt ohne Kontaktperson.
    const falsch = JSON.parse(JSON.stringify(fassung3)) as typeof fassung3;
    falsch.unterlagen[0]!.person = 7;
    expect(lesen(JSON.stringify(falsch))).toBeNull();
    const ohne = JSON.parse(JSON.stringify(fassung3)) as {
      haushalt: { personen: { kontakt?: boolean }[] };
    };
    delete ohne.haushalt.personen[0]!.kontakt;
    expect(lesen(JSON.stringify(ohne))).toBeNull();
  });
});

describe('hefta-json: Telefon und Listen', () => {
  it('telefonE164 nach Abschnitt 8', () => {
    const faelle: [string, string | null][] = [
      ['0171 3920001', '+491713920001'],
      ['+49 171 3920001', '+491713920001'],
      ['0049 (0)171 39 200 01', '+491713920001'],
      ['+49 (0)171 3920006', '+491713920006'],
      ['0171/3920007', '+491713920007'],
      ['+44 20 7946 0018', '+442079460018'],
      ['3920001', null],
      ['0171 BEISPIEL', null],
    ];
    for (const [ein, soll] of faelle) expect(telefonE164(ein), ein).toBe(soll);
  });

  it('typText: bekannte Arten mit Bedeutung, Unbekanntes neutral', () => {
    expect(typText('gehaltsnachweis')).toBe('Gehaltsnachweise');
    expect(typText('mietzahlung')).toBe('Mietzahlungen');
    expect(typText('neu_erfunden')).toBe('Unterlage');
  });
});

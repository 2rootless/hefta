import Ajv from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deckblattZeilen, musterMappe } from '../test/deckblatt.js';
import {
  lesen,
  lesenMitGrund,
  MITZIEHENDE,
  passt,
  pruefen,
  ROLLEN,
  SCHRITT_SATZ,
  telefonPasst,
  typText,
  UNBEKANNT,
  VERZEICHNIS,
  type Lesehilfe,
  type Mappe,
} from './index.js';

// Das Paket hefta-json in Fassung 1 (E216 bis E218, E222, E223, E227): Beispiele gegen Schema, lesen() und passt()
// mit ihrem Deckblatt, Gegenproben, Satz zum Schritt, Telefon. Die Beispiele sind dieselben, die im Paket liegen.
// Den ganzen Stresskatalog (DP76, DP78) prüft stress.test.ts gegen den fremden Leser.

const ORDNER = new URL('../beispiele/', import.meta.url);
const schema = JSON.parse(
  readFileSync(new URL('../schema.json', import.meta.url), 'utf8'),
) as object;
const schemaPruefen = new Ajv({ allErrors: true }).compile(schema);
const beispiele = readdirSync(ORDNER)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => [n, readFileSync(new URL(n, ORDNER), 'utf8')] as const);

const kopie = (l: Lesehilfe): Lesehilfe => JSON.parse(JSON.stringify(l)) as Lesehilfe;
/** Wie ein Leser urteilt: erst streng lesen, dann gegen das Papier prüfen. */
const gezeigt = (l: unknown, mappe: Mappe): boolean => {
  const x = lesen(JSON.stringify(l));
  return x !== null && passt(x, mappe);
};

describe('hefta-json: die Beispiele', () => {
  it('gibt es fünf, und jedes besteht Schema, lesen() und passt() mit seinem Deckblatt', () => {
    expect(beispiele.map(([n]) => n)).toHaveLength(5);
    for (const [name, text] of beispiele) {
      expect(
        schemaPruefen(JSON.parse(text)),
        `${name}: ${JSON.stringify(schemaPruefen.errors)}`,
      ).toBe(true);
      const g = lesenMitGrund(text);
      expect(g.grund, name).toBeNull();
      expect(pruefen(g.lesehilfe!, musterMappe(g.lesehilfe!)), name).toEqual([]);
      expect(JSON.parse(text).hefta, name).toBe(1);
      expect('modus' in JSON.parse(text), name).toBe(false);
    }
  });

  it('eine neuere Fassung (2) wird gelesen (E218); ein anderes Land erfüllt das Schema, passt aber nicht (V19)', () => {
    const l = lesen(beispiele[1]![1])!;
    const neu = { ...kopie(l), hefta: 2 };
    expect(schemaPruefen(neu)).toBe(true);
    expect(gezeigt(neu, musterMappe(l))).toBe(true);
    const at = kopie(l);
    at.bewerbung.wohnung!.teile!.land = 'AT';
    expect(schemaPruefen(at)).toBe(true);
    // V19: Leser rechnen `teile` aus `strasse` und `rest` nach, mit `land` „DE“; Hefta schreibt nur Deutschland.
    expect(gezeigt(at, musterMappe(at))).toBe(false);
  });
});

describe('hefta-json: Gegenproben, jede wird nicht gezeigt', () => {
  const basis = () => kopie(lesen(beispiele[1]![1])!);
  type P = Lesehilfe['haushalt']['personen'][0];
  const faelle: [string, (l: Lesehilfe) => void, { schema?: boolean }?][] = [
    ['Fassung 0', (l) => (l.hefta = 0)],
    ['erstellt nur als Tag', (l) => (l.erstellt = '2026-11-18')],
    ['Seitenzahl stimmt nicht', (l) => (l.seitenzahl = 17), { schema: false }],
    ['Fassung fehlt', (l) => delete (l as Partial<Lesehilfe>).fassung],
    [
      'Name passt nicht zu Vor- und Nachname',
      (l) => (l.haushalt.personen[1]!.name = 'Lea M.'),
      { schema: false },
    ],
    [
      'Name nicht auf Seite 1',
      (l) => {
        const p = l.haushalt.personen[1]!;
        p.name = 'Lea Fremd';
        p.nachname = 'Fremd';
      },
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
      (l) => {
        const p = l.haushalt.personen[1]!;
        p.telefon = '0171 3920001';
        p.telefon_e164 = '+491713920001';
      },
    ],
    ['Telefon ohne telefon_e164 (E222)', (l) => delete l.haushalt.personen[0]!.telefon_e164],
    ['telefon_e164 ohne Telefon (E222)', (l) => delete l.haushalt.personen[0]!.telefon],
    [
      'telefon_e164 nicht dieselbe Nummer',
      (l) => (l.haushalt.personen[0]!.telefon_e164 = '+491713920009'),
      { schema: false },
    ],
    [
      'Telefon nicht in fester Form (+49 (0)…)',
      (l) => {
        const p = l.haushalt.personen[0]!;
        p.telefon = '+49 (0)171 3920001';
        p.telefon_e164 = '+491713920001';
      },
      { schema: false },
    ],
    ['Land mit drei Buchstaben', (l) => (l.bewerbung.wohnung!.teile!.land = 'DEU')],
    ['Land klein', (l) => (l.bewerbung.wohnung!.teile!.land = 'de')],
    [
      'weggelassene Seiten ohne Seitenzahlen',
      (l) => delete l.haushalt.personen[0]!.unterlagen[2]!.vermerke![0]!.seiten_original,
    ],
    [
      'Schritt ohne seinen Satz auf dem Deckblatt (E227)',
      (l) => (l.schritt = 'zusage'),
      { schema: false },
    ],
    ['Rolle keine Kennung', (l) => (l.haushalt.personen[1]!.rolle = 'Mit Mieter' as P['rolle'])],
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
    [
      'Mitziehende nicht in fester Form (V22)',
      (l) => (l.haushalt.mitziehende[0]!.text = 'Unser Sohn'),
      { schema: false },
    ],
    [
      'Monat 13',
      (l) => (l.haushalt.personen[0]!.unterlagen[1]!.monate![0] = '2026-13'),
      { schema: false },
    ],
  ];
  for (const [name, aendern, o] of faelle)
    it(name, () => {
      const papier = musterMappe(basis());
      expect(gezeigt(basis(), papier)).toBe(true);
      const l = basis();
      aendern(l);
      expect(gezeigt(l, papier)).toBe(false);
      // Was das Schema allein erkennt, fällt dort auch auf.
      if (o?.schema !== false) expect(schemaPruefen(l)).toBe(false);
    });
});

describe('hefta-json: Satz zum Schritt (E227, L78-3, L78-4)', () => {
  it('Beispiel 3 trägt schritt „zusage“ und seinen Satz; ohne den Satz wird es nicht gezeigt', () => {
    const l = lesen(beispiele[2]![1])!;
    expect(l.schritt).toBe('zusage');
    const zeilen = deckblattZeilen(l);
    expect(zeilen).toContain(SCHRITT_SATZ.zusage);
    expect(gezeigt(l, musterMappe(l))).toBe(true);
    expect(
      gezeigt(
        l,
        musterMappe(
          l,
          zeilen.filter((z) => z !== SCHRITT_SATZ.zusage),
        ),
      ),
    ).toBe(false);
  });

  it('der Satz steht unter dem Satz zum Haushalt und vor „Im Mietvertrag“', () => {
    const z = deckblattZeilen(lesen(beispiele[2]![1])!);
    const i = z.indexOf(SCHRITT_SATZ.zusage!);
    expect(z[i - 1]).toBe('Ein Haushalt bewirbt sich.');
    expect(z[i + 1]).toBe('Im Mietvertrag');
  });

  it('ein Satz auf dem Deckblatt ohne schritt in der Lesehilfe passt nicht, ein fremder Satz auch nicht', () => {
    const l = lesen(beispiele[1]![1])!;
    const mitSatz = (satz: string) => {
      const z = deckblattZeilen(l);
      z.splice(z.indexOf('Im Mietvertrag'), 0, satz);
      return musterMappe(l, z);
    };
    for (const satz of Object.values(SCHRITT_SATZ))
      expect(gezeigt(l, mitSatz(satz)), satz).toBe(false);
    const zusage = { ...kopie(l), schritt: 'zusage' as const };
    expect(gezeigt(zusage, mitSatz(SCHRITT_SATZ.zusage!))).toBe(true);
    expect(gezeigt(zusage, mitSatz(SCHRITT_SATZ.besichtigung!))).toBe(false);
  });

  it('es gibt genau drei feste Sätze, je Schritt einen', () => {
    expect(Object.keys(SCHRITT_SATZ).sort()).toEqual(['besichtigung', 'will_wohnung', 'zusage']);
  });
});

describe('hefta-json: offene Listen (U1, PC101)', () => {
  const basis = () => kopie(lesen(beispiele[1]![1])!);
  it('eine neue Rolle und eine neue Art der Mitziehenden werden gelesen und neutral gezeigt', () => {
    const l = basis();
    l.haushalt.personen[1]!.rolle = 'untermieter' as Lesehilfe['haushalt']['personen'][0]['rolle'];
    l.haushalt.mitziehende[0]!.art = 'pflegekind' as Lesehilfe['haushalt']['mitziehende'][0]['art'];
    expect(schemaPruefen(l)).toBe(true);
    expect(gezeigt(l, musterMappe(l))).toBe(true);
    const zeige = (rolle: string) => (rolle in ROLLEN ? rolle : UNBEKANNT.rolle);
    expect(zeige(l.haushalt.personen[1]!.rolle)).toBe('Person');
    expect(l.haushalt.mitziehende[0]!.art in MITZIEHENDE ? 'bekannt' : UNBEKANNT.mitziehend).toBe(
      'weitere Person',
    );
  });

  it('Nachname leer: Name gleich Vorname (U2); BOM wird überlesen (U10)', () => {
    const l = lesen(beispiele[4]![1])!;
    expect(l.haushalt.personen[1]).toMatchObject({ name: 'Aylin', vorname: 'Aylin', nachname: '' });
    expect(passt(l, musterMappe(l))).toBe(true);
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
  it('nimmt Bytes und überliest x_-Felder; ergibt null für alles, was keine Lesehilfe ist, und wirft nie', () => {
    const text = beispiele[0]![1];
    expect(lesen(new TextEncoder().encode(text))).toEqual(lesen(text));
    expect(lesen(text.replace('"hefta": 1,', '"hefta": 1, "x_fremd": 1,'))).not.toBeNull();
    for (const kaputt of [
      '',
      'null',
      '[]',
      '{}',
      '{"hefta":"1"}',
      '{"hefta":0,"haushalt":{"personen":[]}}',
      '{',
      String.fromCharCode(0),
    ])
      expect(lesen(kaputt), kaputt).toBeNull();
    expect(lesen(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
  });

  it('die alte Form mit Unterlagen oben und Kontakt beim Haushalt ist keine Lesehilfe (E216)', () => {
    const alt = {
      hefta: 3,
      erstellt: '2026-11-06',
      bewerbung: { kennung: 'd2e0f734-0b59-41ea-95f4-c9715acbe034', wohnung: null },
      haushalt: {
        personen: [{ name: 'Max Mustermann', rolle: 'hauptmieter', kontakt: true }],
        mitziehende: [],
        kontakt: { telefon: '0171 3920001' },
      },
      unterlagen: [{ person: 0, typ: 'selbstauskunft', seiten: [2, 2] }],
      seitenzahl: 2,
    };
    expect(lesen(JSON.stringify(alt))).toBeNull();
    expect(schemaPruefen(alt)).toBe(false);
  });

  it('ein doppelter Schlüssel macht die Lesehilfe unlesbar', () => {
    const text = beispiele[0]![1].replace('"hefta": 1,', '"hefta": 1, "hefta": 1,');
    expect(lesenMitGrund(text).lesehilfe).toBeNull();
  });
});

describe('hefta-json: Telefon und Listen', () => {
  it('telefonPasst nach Abschnitt 8 (E222): feste Form, dieselbe Nummer', () => {
    const faelle: [string, string, boolean][] = [
      ['0171 3920001', '+491713920001', true],
      ['040 66969123', '+494066969123', true],
      ['+44 20 7946 0018', '+442079460018', true],
      // W7: im Ausland nur der britische Bereich für Film und Fernsehen (vorher eine österreichische Nummer).
      ['+44 20 7946 0019', '+442079460019', true],
      ['0171 3920001', '+491713920002', false],
      ['+49 171 3920001', '+491713920001', false],
      ['+49 (0)171 3920006', '+491713920006', false],
      ['0049 171 3920001', '+491713920001', false],
      ['0171/3920007', '+491713920007', false],
      ['040/66969123', '+494066969123', false],
      ['0171  3920001', '+491713920001', false],
      ['0171 BEISPIEL', '+491713920001', false],
    ];
    for (const [t, e, soll] of faelle) expect(telefonPasst(t, e), `${t} / ${e}`).toBe(soll);
  });

  it('typText: bekannte Arten mit Bedeutung, Unbekanntes neutral', () => {
    expect(typText('gehaltsnachweis')).toBe('Gehaltsnachweise');
    expect(typText('mietzahlung')).toBe('Mietzahlungen');
    expect(typText('neu_erfunden')).toBe('Unterlage');
  });
});

describe('hefta-json: die Zeile im Verzeichnis, genau die zwei Formen aus V6 (PC121, PC122)', () => {
  const l = lesen(beispiele[0]![1])!;
  const zeilen = deckblattZeilen(l);
  const eine = zeilen.findIndex((z) => / – Seite \d+$/.test(z));
  const mehrere = zeilen.findIndex((z) => / – Seiten \d+ bis \d+$/.test(z));
  const mit = (i: number, neu: string) => pruefen(l, musterMappe(l, zeilen.with(i, neu)));

  it('„– Seite n“ und „– Seiten n bis m“ passen', () => {
    expect(eine).toBeGreaterThanOrEqual(0);
    expect(mehrere).toBeGreaterThanOrEqual(0);
    expect(pruefen(l, musterMappe(l, zeilen))).toEqual([]);
  });

  it('Gegenproben: „Seiten n–m“, die Zahl allein, „Seite n bis m“ und ein Bindestrich passen nicht', () => {
    const [, wort, von, bis] = / ?(.*) – Seiten (\d+) bis (\d+)$/.exec(zeilen[mehrere]!)!;
    const [, wort1, s] = / ?(.*) – Seite (\d+)$/.exec(zeilen[eine]!)!;
    const falsch = [
      [mehrere, `${wort} – Seiten ${von}–${bis}`],
      [mehrere, `${wort} ${von}–${bis}`],
      [eine, `${wort1} ${s}`],
      [eine, `${wort1} – Seite ${s} bis ${Number(s) + 1}`],
      [eine, `${wort1} - Seite ${s}`],
    ] as const;
    for (const [i, neu] of falsch)
      expect(
        mit(i, neu).some((g) => g.endsWith('steht so nicht im Verzeichnis')),
        neu,
      ).toBe(true);
  });

  it('unbekannte Art (V10): gebunden werden nur die Seiten, aber mit „– “ davor', () => {
    const u = kopie(l);
    const p = u.haushalt.personen.find((x) => x.unterlagen.length)!;
    const unt = p.unterlagen[0]!;
    unt.typ = 'kuenftige_art';
    const z = deckblattZeilen(u);
    const seiten =
      unt.seiten_mappe.von === unt.seiten_mappe.bis
        ? `Seite ${unt.seiten_mappe.von}`
        : `Seiten ${unt.seiten_mappe.von} bis ${unt.seiten_mappe.bis}`;
    const i = z.findIndex((x) => x.endsWith(` – ${seiten}`));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(pruefen(u, musterMappe(u, z.with(i, `Neue Unterlage – ${seiten}`)))).toEqual([]);
    expect(
      pruefen(u, musterMappe(u, z.with(i, `Neue Unterlage ${seiten}`))).length,
    ).toBeGreaterThan(0);
  });
});

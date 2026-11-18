// Der Stresskatalog der Lesehilfe, Fassung 1 (DP76, DP78, PC110, PC113, PC116), als echte PDF-Mappen. Gemeinsam für
// den Stresstest der Vermieter-Seite (src/vermieter/stress.test.ts) und die Angriffe im Browser
// (tests/e2e/vermieter-angriffe.spec.ts). Läuft unter Node.
import fontkit from '@cantoo/fontkit';
import { readFileSync } from 'node:fs';
import { AFRelationship, PDFDocument, PDFName } from '@cantoo/pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { SCHRITT_SATZ, teileAus, type Lesehilfe } from '../../pakete/hefta-json/src/index';
import { deckblattZeilen } from '../../pakete/hefta-json/test/deckblatt';

const grund = JSON.parse(readFileSync('tests/fixtures/stress/grundlagen.json', 'utf8')) as {
  LH0: Lesehilfe;
  BSP0: Lesehilfe;
};
export const LH0 = grund.LH0;
export const BSP0 = grund.BSP0;
const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const ZEILE = String.fromCharCode(10);

export type Soll = 'gezeigt' | 'nicht' | '?';
export type Urteil = 'gezeigt' | 'passt nicht' | 'abgelehnt' | 'ABSTURZ';
export interface Fall {
  nr: string;
  was: string;
  soll: Soll;
  /** Was als `hefta.json` angehängt wird: Lesehilfe als JSON oder rohe Bytes. */
  lh?: unknown;
  roh?: Uint8Array;
  /** Text der Seiten vor der ersten Unterlage, Zeile für Zeile. */
  zeilen: string[];
  seiten: number;
  erstellt: string;
  leer?: number[];
  seite2?: string[];
  /** Eine fertige Mappe, deren Anhang ersetzt wird. */
  vorlage?: Uint8Array;
}

/** Zeilen je Seite des Deckblatts: Schrift 8 pt, Abstand 13 pt, von oben 810 bis unten 30. */
const JE_SEITE = 60;

export async function mappeBauen(f: Fall): Promise<Uint8Array> {
  const daten = f.roh ?? new TextEncoder().encode(JSON.stringify(f.lh));
  if (f.vorlage) {
    const dok = await PDFDocument.load(f.vorlage, { updateMetadata: false });
    dok.catalog.delete(PDFName.of('Names'));
    dok.catalog.delete(PDFName.of('AF'));
    await dok.attach(daten, 'hefta.json', {
      mimeType: 'application/json',
      afRelationship: AFRelationship.Data,
    });
    return dok.save();
  }
  const dok = await PDFDocument.create({ updateMetadata: false });
  dok.registerFontkit(fontkit);
  const schrift = await dok.embedFont(readFileSync('src/pdf/fonts/Archivo-Regular.ttf'), {
    subset: false,
  });
  const vorne = Math.ceil(f.zeilen.length / JE_SEITE);
  for (let i = 1; i <= Math.max(f.seiten, 1) && i <= 400; i++) {
    const seite = dok.addPage([595, 842]);
    const text =
      i <= vorne
        ? f.zeilen.slice((i - 1) * JE_SEITE, i * JE_SEITE)
        : f.leer?.includes(i)
          ? []
          : [`Unterlage, Seite ${i}`, ...(i === 2 ? (f.seite2 ?? []) : [])];
    text.forEach((z, k) => seite.drawText(z, { x: 30, y: 810 - k * 13, size: 8, font: schrift }));
  }
  const datum = new Date(f.erstellt);
  dok.setCreationDate(datum);
  dok.setModificationDate(datum);
  dok.setProducer('Hefta (Stresstest)');
  await dok.attach(daten, 'hefta.json', {
    mimeType: 'application/json',
    afRelationship: AFRelationship.Data,
  });
  return dok.save();
}

// ---------------------------------------------------------------- der Katalog
const p = (l: Lesehilfe, i: number) => l.haushalt.personen[i]!;
const m = (aendern: (l: Lesehilfe) => void, von = LH0): Lesehilfe => {
  const l = kopie(von);
  aendern(l);
  return l;
};
const json = (l: unknown) => JSON.stringify(l);
const bytes = (s: string) => new TextEncoder().encode(s);

/** Ein Fall auf dem Papier einer Grundlage (LH0 oder BSP0): Deckblatt aus der Grundlage, Lesehilfe geändert. */
function auf(
  basis: Lesehilfe,
  nr: string,
  was: string,
  soll: Soll,
  lh: unknown,
  mehr: Partial<Fall> = {},
): Fall {
  return {
    nr,
    was,
    soll,
    lh,
    zeilen: deckblattZeilen(basis),
    seiten: basis.seitenzahl,
    erstellt: basis.erstellt,
    ...mehr,
  };
}

type Person = [name: string, vorname: string, nachname: string, rolle: string, kontakt: boolean];
interface Bau {
  wohnung?: [string, string];
  mitziehende?: [string, number, string][];
  ohneUnterlagen?: boolean;
  telefon?: [string, string];
}
/** Eine synthetische Mappe im Aufbau von Hefta: je Person eine Selbstauskunft auf einer Seite. */
function bau(personen: Person[], o: Bau = {}): { lh: Lesehilfe; zeilen: string[]; seiten: number } {
  const [strasse, rest] = o.wohnung ?? ['Lindenring 8', '2. Obergeschoss, 20259 Hamburg'];
  const [telefon, e164] = o.telefon ?? ['0171 3920002', '+491713920002'];
  const lh = (vorne: number): Lesehilfe => ({
    hefta: 1,
    erstellt: '2026-11-18T09:00:00+01:00',
    fassung: 1,
    seitenzahl: o.ohneUnterlagen ? vorne : vorne + personen.length,
    bewerbung: {
      kennung: 'd2e0f734-0b59-41ea-95f4-c9715acbe034',
      wohnung: { strasse, rest, teile: teileAus(strasse, rest)! },
    },
    haushalt: {
      personen: personen.map(([name, vorname, nachname, rolle, kontakt], i) => ({
        name,
        vorname,
        nachname,
        rolle: rolle as Lesehilfe['haushalt']['personen'][0]['rolle'],
        ...(kontakt
          ? {
              kontakt: true as const,
              telefon,
              telefon_e164: e164,
              email: 'zoe.beispiel@example.com',
            }
          : {}),
        unterlagen: o.ohneUnterlagen
          ? []
          : [{ typ: 'selbstauskunft', seiten_mappe: { von: vorne + 1 + i, bis: vorne + 1 + i } }],
      })),
      mitziehende: (o.mitziehende ?? []).map(([text, anzahl, art]) => ({
        text,
        anzahl,
        art: art as 'kind',
      })),
    },
  });
  let vorne = 1;
  for (;;) {
    const l = lh(vorne);
    const zeilen = deckblattZeilen(l);
    const n = Math.ceil(zeilen.length / JE_SEITE);
    if (n === vorne) return { lh: l, zeilen, seiten: l.seitenzahl };
    vorne = n;
  }
}
const synth = (
  b: ReturnType<typeof bau>,
  nr: string,
  was: string,
  soll: Soll,
  lh: unknown = b.lh,
  mehr: Partial<Fall> = {},
): Fall => ({
  nr,
  was,
  soll,
  lh,
  zeilen: b.zeilen,
  seiten: b.seiten,
  erstellt: b.lh.erstellt,
  ...mehr,
});

/** Der Satz zum Schritt an einem Ort des Deckblatts (DP78): unter dem Satz zum Haushalt oder unter „Was beiliegt“. */
function mitSatz(zeilen: string[], satz: string[], ort: 'kopf' | 'beiliegt'): string[] {
  const z = [...zeilen];
  const nach = ort === 'kopf' ? 'Ein Haushalt bewirbt sich.' : 'Was beiliegt';
  z.splice(z.indexOf(nach) + 1, 0, ...satz);
  return z;
}

export function katalog(se1: Uint8Array, se1Lh: Lesehilfe): Fall[] {
  const F: Fall[] = [];
  const k = (nr: string, was: string, soll: Soll, lh: unknown, mehr: Partial<Fall> = {}) =>
    F.push(auf(LH0, nr, was, soll, lh, mehr));
  const kb = (nr: string, was: string, soll: Soll, lh: unknown) =>
    F.push(auf(BSP0, nr, was, soll, lh));
  // Kontrolle
  k('K1', 'echte Mappe aus DP73 (Lea, Aylin), Lesehilfe unverändert', 'gezeigt', LH0);
  kb('K2', 'Beispiel-Mappe (Max, Lea, Petra, ein Kind), Lesehilfe unverändert', 'gezeigt', BSP0);
  // A Robustheit
  k(
    'S1',
    'monate mit „2026-13“',
    'nicht',
    m((l) => (p(l, 0).unterlagen[1]!.monate = ['2026-09', '2026-10', '2026-13'])),
  );
  k(
    'S2',
    'vom „2026-02-30“',
    'nicht',
    m((l) => (p(l, 0).unterlagen[2]!.vom = '2026-02-30')),
  );
  k(
    'S3',
    'einzug „2027-00-10“',
    'nicht',
    m((l) => (l.bewerbung.einzug = '2027-00-10')),
  );
  k(
    'S4',
    'erstellt „2026-19-45T25:61:00Z“',
    'nicht',
    m((l) => (l.erstellt = '2026-19-45T25:61:00Z')),
  );
  k(
    'S4b1',
    'erstellt ohne Sekunden',
    'nicht',
    m((l) => (l.erstellt = l.erstellt.slice(0, 16) + l.erstellt.slice(19))),
  );
  k(
    'S4b2',
    'erstellt mit Millisekunden',
    'nicht',
    m((l) => (l.erstellt = `${l.erstellt.slice(0, 19)}.000${l.erstellt.slice(19)}`)),
  );
  k(
    'S4b3',
    'erstellt mit „+0100“',
    'nicht',
    m((l) => (l.erstellt = `${l.erstellt.slice(0, 19)}+0100`)),
  );
  k('S14', '„hefta“: 1.0', 'gezeigt', null, {
    roh: bytes(json(LH0).replace('"hefta":1,', '"hefta":1.0,')),
  });
  k('S21', 'doppelter Schlüssel „hefta“ (erst 4, dann 1)', '?', null, {
    roh: bytes(json(LH0).replace('"hefta":1,', '"hefta":4,"hefta":1,')),
  });
  k('S22a', 'Datei über 2 MB (Füllfeld x_)', 'nicht', { ...LH0, x_fuell: 'a'.repeat(2_100_000) });
  k(
    'S22b',
    '10.000 Personen',
    'nicht',
    m((l) => {
      for (let i = 0; i < 10_000; i++)
        l.haushalt.personen.push({ ...kopie(p(l, 1)), unterlagen: [] });
    }),
  );
  const tief = '{"a":'.repeat(1000) + '1' + '}'.repeat(1000);
  k('S22c', '1.000 Ebenen tief (in einem x_-Feld)', 'nicht', null, {
    roh: bytes(`${json(LH0).slice(0, -1)},"x_tief":${tief}}`),
  });
  k(
    'S23',
    'seitenzahl 2.000.000.000',
    'nicht',
    m((l) => (l.seitenzahl = 2_000_000_000)),
  );
  const utf16 = Buffer.from(String.fromCharCode(0xfeff) + json(LH0), 'utf16le');
  k('S24a', 'UTF-16', 'nicht', null, { roh: new Uint8Array(utf16) });
  const kaputt = Buffer.from(json(LH0), 'utf8');
  const stelle = kaputt.indexOf('Aylin');
  kaputt[stelle + 3] = 0xff;
  k('S24b', 'kaputtes UTF-8 in einem Namen', 'nicht', null, { roh: new Uint8Array(kaputt) });
  // B Reihenfolge und Doppeltes
  k(
    'S5',
    'monate absteigend',
    'nicht',
    m((l) => (p(l, 0).unterlagen[1]!.monate = ['2026-11', '2026-10', '2026-09'])),
  );
  k(
    'S6',
    'monate doppelt',
    'nicht',
    m((l) => (p(l, 0).unterlagen[1]!.monate = ['2026-09', '2026-09', '2026-11'])),
  );
  k(
    'S26',
    'dieselbe Unterlage doppelt',
    'nicht',
    m((l) => p(l, 0).unterlagen.push(kopie(p(l, 0).unterlagen[2]!))),
  );
  // C Sauberer Text
  const name = (i: number, w: Partial<Lesehilfe['haushalt']['personen'][0]>) =>
    m((l) => Object.assign(p(l, i), w));
  k(
    'S7',
    'Leerzeichen am Rand des Vornamens',
    'nicht',
    name(1, { vorname: ' Aylin', name: ' Aylin' }),
  );
  k('S8', 'Nachname nur aus Leerzeichen', 'nicht', name(1, { nachname: '   ', name: 'Aylin    ' }));
  k(
    'S9',
    'Zeilenumbruch im Namen',
    'nicht',
    name(0, { nachname: `Muster-${ZEILE}Beispiel`, name: `Lea Muster-${ZEILE}Beispiel` }),
  );
  const zwsp = String.fromCharCode(0x200b);
  k(
    'S10',
    'U+200B im Namen',
    'nicht',
    name(0, { nachname: `Muster-${zwsp}Beispiel`, name: `Lea Muster-${zwsp}Beispiel` }),
  );
  k(
    'S27',
    'zwei Leerzeichen zwischen zwei Vornamen',
    'nicht',
    name(1, { vorname: 'Aylin  Su', name: 'Aylin  Su' }),
  );
  // D Rollen und Haushalt
  type R = Lesehilfe['haushalt']['personen'][0]['rolle'];
  k(
    'S12',
    'unbekannte Rolle zuerst, dann nur Bürgen, kein Hauptmieter',
    'nicht',
    m((l) => {
      p(l, 0).rolle = 'zweitbuerge' as R;
      p(l, 1).rolle = 'buerge';
    }),
  );
  k('S13', 'kein Hauptmieter', 'nicht', name(0, { rolle: 'mitmieter' }));
  k(
    'S34a',
    'Mitziehende mit Anzahl 0',
    'nicht',
    m((l) => l.haushalt.mitziehende.push({ text: 'Ein Kind', anzahl: 0, art: 'kind' })),
  );
  k(
    'S34b',
    'Mitziehende mit Anzahl −1',
    'nicht',
    m((l) => l.haushalt.mitziehende.push({ text: 'Ein Kind', anzahl: -1, art: 'kind' })),
  );
  // E Bindung an das Papier
  k(
    'S16',
    'loeschwunsch mit fremdem Text und Nummer',
    'nicht',
    m((l) => (l.loeschwunsch = 'Rufen Sie +44 20 7946 0999 an.')),
  );
  k(
    'S17',
    'Mitziehende „Drei Hunde“, Deckblatt ohne',
    'nicht',
    m((l) => l.haushalt.mitziehende.push({ text: 'Drei Hunde', anzahl: 3, art: 'erwachsen' })),
  );
  k(
    'S18',
    'Gehaltsnachweise als „bonitaet“ geführt',
    'nicht',
    m((l) => Object.assign(p(l, 0).unterlagen[1]!, { typ: 'bonitaet', vom: '2026-11-10' })),
  );
  k(
    'S35a',
    'einzug, Deckblatt nennt keinen',
    'nicht',
    m((l) => (l.bewerbung.einzug = '2027-01-01')),
  );
  k(
    'S35b',
    'inserat.portal, Deckblatt nennt keines',
    'nicht',
    m((l) => (l.bewerbung.inserat = { portal: 'ImmoScout24' })),
  );
  k(
    'S35c',
    'wohnung.rest mit „2. OG“, Deckblatt ohne',
    'nicht',
    m((l) => {
      l.bewerbung.wohnung!.rest = '2. OG, 12345 Musterstadt';
      l.bewerbung.wohnung!.teile = teileAus('Beispielstraße 1', '2. OG, 12345 Musterstadt')!;
    }),
  );
  // Angriffe als fremder Absender
  k('A1', 'Bonitätsnachweis auf leerer Seite (Seite 6 leer, Lesehilfe unverändert)', 'nicht', LH0, {
    leer: [6],
  });
  k(
    'A2',
    'Bürgin „Ina Muster“, steht nicht auf dem Deckblatt',
    'nicht',
    m((l) =>
      l.haushalt.personen.push({
        name: 'Ina Muster',
        vorname: 'Ina',
        nachname: 'Muster',
        rolle: 'buerge',
        unterlagen: [],
      }),
    ),
  );
  k(
    'A3',
    'Bürgin „Aylin Muster-Beispiel“ aus Wörtern des Deckblatts gebaut',
    'nicht',
    m((l) =>
      l.haushalt.personen.push({
        name: 'Aylin Muster-Beispiel',
        vorname: 'Aylin',
        nachname: 'Muster-Beispiel',
        rolle: 'buerge',
        unterlagen: [],
      }),
    ),
  );
  k(
    'A4',
    'Einzug 1. Januar 2027, Deckblatt nennt keinen',
    'nicht',
    m((l) => (l.bewerbung.einzug = '2027-01-01')),
  );
  const kyr = String.fromCharCode(0x435);
  k(
    'A5',
    'Lea mit kyrillischem „е“ (U+0435)',
    'nicht',
    name(0, { vorname: `L${kyr}a`, name: `L${kyr}a Muster-Beispiel` }),
  );
  k(
    'A6',
    'Rollen getauscht: Aylin Hauptmieterin, Lea Mitmieterin',
    'nicht',
    m((l) => {
      l.haushalt.personen.reverse();
      p(l, 0).rolle = 'hauptmieter';
      p(l, 1).rolle = 'mitmieter';
    }),
  );
  k(
    'A7',
    'Kontakt bei Aylin, mit Leas Nummer und Mail',
    'nicht',
    m((l) => {
      const { kontakt, telefon, telefon_e164, email } = p(l, 0);
      for (const f of ['kontakt', 'telefon', 'telefon_e164', 'email'] as const) delete p(l, 0)[f];
      Object.assign(p(l, 1), { kontakt, telefon, telefon_e164, email });
    }),
  );
  k(
    'A8',
    'Seiten verschoben: Gehaltsnachweise 3–4, Bonität 5–6',
    'nicht',
    m((l) => {
      p(l, 0).unterlagen[1]!.seiten_mappe.bis = 4;
      p(l, 0).unterlagen[2]!.seiten_mappe.von = 5;
    }),
  );
  k(
    'A9',
    'Monate Juni bis August statt September bis November',
    'nicht',
    m((l) => (p(l, 0).unterlagen[1]!.monate = ['2026-06', '2026-07', '2026-08'])),
  );
  k(
    'A10',
    'Bonität vom 1. statt vom 10. November',
    'nicht',
    m((l) => (p(l, 0).unterlagen[2]!.vom = '2026-11-01')),
  );
  k(
    'A11',
    'Vermerk „Seiten 2 und 3 weggelassen“ erfunden',
    'nicht',
    m(
      (l) =>
        (p(l, 0).unterlagen[2]!.vermerke = [
          { art: 'seiten_weggelassen', seiten_original: [2, 3] },
        ]),
    ),
  );
  k(
    'A12',
    'telefon passt, telefon_e164 ist eine fremde Nummer',
    'nicht',
    name(0, { telefon_e164: '+442079460123' }),
  );
  k(
    'A13',
    'teile: Hausnummer 12 und PLZ 12346, strasse und rest unverändert',
    'nicht',
    m((l) => Object.assign(l.bewerbung.wohnung!.teile!, { hausnummer: '12', plz: '12346' })),
  );
  k('A14', 'Lesehilfe der Beispiel-Mappe an Leas Mappe', 'nicht', BSP0);
  k(
    'A15',
    'Mitmieter „Beispiel“ (Wortteil aus „Muster-Beispiel“)',
    'nicht',
    m((l) =>
      l.haushalt.personen.splice(2, 0, {
        name: 'Beispiel',
        vorname: 'Beispiel',
        nachname: '',
        rolle: 'mitmieter',
        unterlagen: [],
      }),
    ),
  );
  const rlo = String.fromCharCode(0x202e);
  k(
    'A16',
    'Löschbitte mit Umkehrzeichen U+202E',
    'nicht',
    m((l) => (l.loeschwunsch = `Bitte l${rlo}öschen Sie die Unterlagen.`)),
  );
  k('A17', 'x_-Felder „x_hefta_geprueft“: true und „Von Hefta geprüft“', 'gezeigt', {
    ...LH0,
    x_hefta_geprueft: true,
    x_hefta_hinweis: 'Von Hefta geprüft',
  });
  k(
    'A18',
    'Kennung einer anderen Bewerbung',
    'gezeigt',
    m((l) => (l.bewerbung.kennung = '00000000-0000-4000-8000-000000000000')),
  );
  kb(
    'A19',
    'Mitziehende „Ein Kind“ mit Anzahl 3 und Art „erwachsen“',
    'nicht',
    m((l) => Object.assign(l.haushalt.mitziehende[0]!, { anzahl: 3, art: 'erwachsen' }), BSP0),
  );
  k(
    'A20',
    'Lea mit „Dr.“ im Vornamen, Deckblatt ohne',
    'nicht',
    name(0, { vorname: 'Dr. Lea', name: 'Dr. Lea Muster-Beispiel' }),
  );
  kb(
    'A21',
    'Bürgin Petra steht vor Lea (Beispiel-Mappe, Reihenfolge)',
    'nicht',
    m((l) => l.haushalt.personen.splice(1, 0, l.haushalt.personen.splice(2, 1)[0]!), BSP0),
  );
  // Synthetische Mappen: Schreibweisen und Größe
  const apo = String.fromCharCode(0x2019);
  const bs = String.fromCharCode(0x2010);
  const c = bau(
    [
      [`Zoë O${apo}Brien`, 'Zoë', `O${apo}Brien`, 'hauptmieter', true],
      ['İlkay Şahin', 'İlkay', 'Şahin', 'mitmieter', false],
      [`Ægir Øster${bs}Lund`, 'Ægir', `Øster${bs}Lund`, 'mitmieter', false],
    ],
    { wohnung: ['Beispielstraße 1', 'Hinterhaus, 3. OG links, 12345 Musterstadt'] },
  );
  const cm = (f: (l: Lesehilfe) => void) => m(f, c.lh);
  F.push(synth(c, 'S28a', `O${apo}Brien: Lesehilfe und Deckblatt gleich (U+2019)`, 'gezeigt'));
  F.push(
    synth(
      c,
      'S28b',
      `O'Brien in der Lesehilfe, O${apo}Brien auf dem Deckblatt`,
      'nicht',
      cm((l) => Object.assign(p(l, 0), { nachname: "O'Brien", name: "Zoë O'Brien" })),
    ),
  );
  F.push(
    synth(
      c,
      'S29',
      `Øster-Lund mit „-“, Deckblatt mit „${bs}“ (U+2010)`,
      'nicht',
      cm((l) => Object.assign(p(l, 2), { nachname: 'Øster-Lund', name: 'Ægir Øster-Lund' })),
    ),
  );
  F.push(
    synth(
      c,
      'S30a',
      'İlkay Şahin klein in der Lesehilfe („ilkay şahin“)',
      'nicht',
      cm((l) =>
        Object.assign(p(l, 1), { vorname: 'ilkay', nachname: 'şahin', name: 'ilkay şahin' }),
      ),
    ),
  );
  F.push(
    synth(
      c,
      'S30b',
      'Straße in Versalien „BEISPIELSTRASSE 1“, Deckblatt „Beispielstraße 1“',
      '?',
      cm((l) => {
        l.bewerbung.wohnung!.strasse = 'BEISPIELSTRASSE 1';
        l.bewerbung.wohnung!.teile = teileAus('BEISPIELSTRASSE 1', l.bewerbung.wohnung!.rest)!;
      }),
    ),
  );
  F.push(
    synth(
      c,
      'S11',
      'Name in NFD („Zoë“ zerlegt), Deckblatt in NFC (V16: nur NFC, Katalog sagte „gelesen“)',
      'nicht',
      cm((l) =>
        Object.assign(p(l, 0), {
          vorname: 'Zoë'.normalize('NFD'),
          name: `Zoë O${apo}Brien`.normalize('NFD'),
        }),
      ),
    ),
  );
  F.push(synth(c, 'G7s', 'Lage mit Komma „Hinterhaus, 3. OG links“ (zu G7)', 'gezeigt'));
  const s36 = bau([['Leander Muster', 'Leander', 'Muster', 'hauptmieter', true]], {
    wohnung: ['Musterweg 7', '12345 Musterstadt'],
  });
  F.push(
    synth(
      s36,
      'S36',
      'Name „Lea Muster“, Deckblatt nur „Leander Muster“',
      'nicht',
      m((l) => Object.assign(p(l, 0), { vorname: 'Lea', name: 'Lea Muster' }), s36.lh),
    ),
  );
  const vn = [
    'Anna',
    'Ben',
    'Cem',
    'Dana',
    'Emil',
    'Fiona',
    'Gül',
    'Hanno',
    'Ida',
    'Jonas',
    'Kaja',
    'Luis',
  ];
  const s31 = bau(
    [
      ...vn.map((v, i): Person => [
        `${v} Muster`,
        v,
        'Muster',
        i === 0 ? 'hauptmieter' : 'mitmieter',
        i === 0,
      ]),
      ...['Mira', 'Nils', 'Olga'].map((v): Person => [
        `${v} Beispiel`,
        v,
        'Beispiel',
        'buerge',
        false,
      ]),
    ],
    {
      mitziehende: [
        ['Zwei Kinder', 2, 'kind'],
        ['Zwei weitere Personen', 2, 'erwachsen'],
      ],
    },
  );
  F.push(synth(s31, 'S31', '12 im Vertrag, 3 Bürgen, 4 Mitziehende', 'gezeigt'));
  const zweiAnna: Person[] = [
    ['Anna Muster', 'Anna', 'Muster', 'hauptmieter', true],
    ['Anna Muster', 'Anna', 'Muster', 'mitmieter', false],
  ];
  F.push(
    synth(
      bau(zweiAnna, { wohnung: ['Musterweg 7', '12345 Musterstadt'] }),
      'S32',
      'zwei Personen mit genau gleichem Namen',
      'gezeigt',
    ),
  );
  const s33 = bau(
    [
      ['Anna Muster', 'Anna', 'Muster', 'hauptmieter', true],
      ['Ben Muster', 'Ben', 'Muster', 'mitmieter', false],
    ],
    { wohnung: ['Musterweg 7', '12345 Musterstadt'] },
  );
  F.push(
    synth(
      s33,
      'S33',
      'Person ohne jede Unterlage (Deckblatt nennt Ben im Vertrag)',
      'gezeigt',
      m((l) => (p(l, 1).unterlagen = []), s33.lh),
    ),
  );
  // DP78: Satz zum Schritt (E227), Mitziehende (V22), Telefon (E222)
  const SZ = SCHRITT_SATZ as Record<'besichtigung' | 'will_wohnung' | 'zusage', string>;
  const ZWEI: Person[] = [
    ['Zoë Beispiel', 'Zoë', 'Beispiel', 'hauptmieter', true],
    ['Aylin Muster', 'Aylin', 'Muster', 'mitmieter', false],
  ];
  const mit = (l: Lesehilfe, schritt?: string) => ({
    ...kopie(l),
    ...(schritt ? { schritt } : {}),
  });
  const sb1 = bau(ZWEI, { ohneUnterlagen: true });
  const sb1z = mitSatz(sb1.zeilen, [SZ.besichtigung], 'kopf');
  F.push(
    synth(
      sb1,
      'SB1',
      'Besichtigung: nur Deckblatt, Satz unter dem Satz zum Haushalt, schritt „besichtigung“',
      'gezeigt',
      mit(sb1.lh, 'besichtigung'),
      { zeilen: sb1z },
    ),
  );
  F.push(
    synth(
      sb1,
      'SG1',
      'Gegenprobe: derselbe Satz, Lesehilfe ohne schritt (wie 2.0 heute, D1)',
      'nicht',
      sb1.lh,
      { zeilen: sb1z },
    ),
  );
  F.push(
    synth(
      sb1,
      'SG2',
      'Gegenprobe: schritt „zusage“, auf dem Deckblatt steht der Satz zur Besichtigung',
      'nicht',
      mit(sb1.lh, 'zusage'),
      { zeilen: sb1z },
    ),
  );
  const z2 = bau(ZWEI);
  const z2k = mitSatz(z2.zeilen, [SZ.will_wohnung], 'kopf');
  F.push(
    synth(
      z2,
      'SB2',
      'Mietwunsch: Satz unter dem Satz zum Haushalt, schritt „will_wohnung“',
      'gezeigt',
      mit(z2.lh, 'will_wohnung'),
      { zeilen: z2k },
    ),
  );
  F.push(
    synth(z2, 'SG3', 'Gegenprobe: Satz zum Mietwunsch, Lesehilfe ohne schritt', 'nicht', z2.lh, {
      zeilen: z2k,
    }),
  );
  const [vor, nach] = SZ.will_wohnung.split('Einkommens- ');
  F.push(
    synth(
      z2,
      'SB2w',
      'Mietwunsch, Satz auf zwei Zeilen umbrochen nach „Einkommens-“',
      'gezeigt',
      mit(z2.lh, 'will_wohnung'),
      { zeilen: mitSatz(z2.zeilen, [`${vor}Einkommens-`, nach!], 'kopf') },
    ),
  );
  F.push(
    synth(
      z2,
      'SB3',
      'Vertrag: Satz unter dem Satz zum Haushalt, schritt „zusage“',
      'gezeigt',
      mit(z2.lh, 'zusage'),
      { zeilen: mitSatz(z2.zeilen, [SZ.zusage], 'kopf') },
    ),
  );
  F.push(
    synth(
      z2,
      'SG4',
      'Gegenprobe: schritt „will_wohnung“, Deckblatt ohne Satz',
      'nicht',
      mit(z2.lh, 'will_wohnung'),
    ),
  );
  F.push(
    synth(z2, 'SK1', 'ohne schritt, ohne Satz (Nur das Übliche, Alles, Eigene Auswahl)', 'gezeigt'),
  );
  F.push(
    synth(
      z2,
      'SG5',
      'schritt „vorab“ (unbekannt), kein Satz: gezeigt, Schritt nicht (L78-4)',
      'gezeigt',
      mit(z2.lh, 'vorab'),
    ),
  );
  F.push(
    synth(
      z2,
      'SG6',
      'Gegenprobe: ein Wort anders („Beide folgen später.“)',
      'nicht',
      mit(z2.lh, 'will_wohnung'),
      {
        zeilen: mitSatz(z2.zeilen, [SZ.will_wohnung.replace('nach der Zusage', 'später')], 'kopf'),
      },
    ),
  );
  F.push(
    synth(
      z2,
      'SG7',
      'Gegenprobe: Satz unter „Was beiliegt“ statt unter dem Satz zum Haushalt',
      'nicht',
      mit(z2.lh, 'will_wohnung'),
      { zeilen: mitSatz(z2.zeilen, [SZ.will_wohnung], 'beiliegt') },
    ),
  );
  F.push(
    synth(
      z2,
      'SG8',
      'Gegenprobe: Satz nur auf Seite 2 (in einer Unterlage)',
      'nicht',
      mit(z2.lh, 'zusage'),
      { seite2: [SZ.zusage] },
    ),
  );
  F.push(
    synth(
      z2,
      'SG9',
      'Gegenprobe: zwei Sätze, schritt „will_wohnung“',
      'nicht',
      mit(z2.lh, 'will_wohnung'),
      { zeilen: mitSatz(z2.zeilen, [SZ.will_wohnung, SZ.zusage], 'kopf') },
    ),
  );
  const echt = { zeilen: [], seiten: 0, erstellt: se1Lh.erstellt, vorlage: se1 };
  F.push({
    nr: 'SE1',
    was: 'echte 2.0-Mappe (DP78, Lauf B): Satz unter „Was beiliegt“, Lesehilfe ohne schritt',
    soll: 'nicht',
    lh: se1Lh,
    ...echt,
  });
  F.push({
    nr: 'SE2',
    was: 'dieselbe mit schritt „besichtigung“: Satz steht nicht am festen Ort',
    soll: 'nicht',
    lh: mit(se1Lh, 'besichtigung'),
    ...echt,
  });
  // V22
  kb('MZ1', 'Beispiel-Mappe „Ein Kind“, 1, kind', 'gezeigt', BSP0);
  kb(
    'MZ2',
    '„Ein Kind“ mit Anzahl 2',
    'nicht',
    m((l) => (l.haushalt.mitziehende[0]!.anzahl = 2), BSP0),
  );
  kb(
    'MZ3',
    '„Ein Kind“ zweimal, je Anzahl 1',
    'nicht',
    m((l) => l.haushalt.mitziehende.push({ ...l.haushalt.mitziehende[0]! }), BSP0),
  );
  F.push(
    synth(
      bau(ZWEI, {
        mitziehende: [
          ['13 Kinder', 13, 'kind'],
          ['Eine weitere Person', 1, 'erwachsen'],
        ],
      }),
      'MZ4',
      '„13 Kinder“ und „Eine weitere Person“',
      'gezeigt',
    ),
  );
  F.push(
    synth(
      bau(ZWEI, { mitziehende: [['Dreizehn Kinder', 13, 'kind']] }),
      'MZ5',
      'Gegenprobe: „Dreizehn Kinder“ statt „13 Kinder“',
      'nicht',
    ),
  );
  F.push(
    synth(
      bau(ZWEI, { mitziehende: [['Ein Hund', 1, 'haustier']] }),
      'MZ6',
      'unbekannte Art „haustier“, Text auf dem Papier: gezeigt, nicht gezählt (L78-1)',
      'gezeigt',
    ),
  );
  // E222 in der ganzen Mappe
  F.push(
    synth(
      bau(ZWEI, { telefon: ['040 66969123', '+494066969123'] }),
      'TL11',
      'Festnetz Hamburg 040 66969123 (W7, Fassung 24)',
      'gezeigt',
    ),
  );
  const tlx = bau(ZWEI, { telefon: ['+44 20 7946 0018', '+442079460018'] });
  F.push(synth(tlx, 'TLX', 'Nummer in Großbritannien, international', 'gezeigt'));
  F.push(
    synth(
      tlx,
      'TLX1',
      'Gegenprobe: dieselbe, telefon_e164 fehlt',
      'nicht',
      m((l) => delete p(l, 0).telefon_e164, tlx.lh),
    ),
  );
  F.push(
    synth(
      tlx,
      'TLX2',
      'Gegenprobe: telefon_e164 ohne telefon',
      'nicht',
      m((l) => (p(l, 1).telefon_e164 = '+442079460018'), tlx.lh),
    ),
  );
  // E227, PC116: was 2.0 bei „Nur das Nötige, Besichtigung“ schreibt: kein Satz, kein schritt; die Gegenprobe mit Satz.
  F.push(
    synth(
      z2,
      'E227a',
      'gespeicherter Stand „datensparsam, Besichtigung“ in 2.0: ohne Satz, ohne schritt',
      'gezeigt',
    ),
  );
  F.push(
    synth(
      z2,
      'E227b',
      'Gegenprobe: derselbe Stand, der Satz zur Besichtigung steht doch auf dem Deckblatt',
      'nicht',
      z2.lh,
      { zeilen: mitSatz(z2.zeilen, [SZ.besichtigung], 'kopf') },
    ),
  );
  return F;
}

/** Der ganze Katalog; SE1 und SE2 nutzen Designs echte 2.0-Mappe aus DP78, Lauf B (ohne `modus`). */
export async function katalogLaden(): Promise<Fall[]> {
  const se1 = new Uint8Array(readFileSync('tests/fixtures/stress/SE1-2-0-alt.pdf'));
  const aufgabe = pdfjs.getDocument({ data: se1.slice(), verbosity: 0 });
  const dok = await aufgabe.promise;
  const anh = await dok.getAttachments();
  const t = [...anh!.entries()].find(([, a]) => a.filename === 'hefta.json')!;
  const roh = (await dok.getAttachmentContent(t[0]))!;
  await aufgabe.destroy();
  const se1Lh = JSON.parse(new TextDecoder().decode(roh)) as Lesehilfe & { modus?: string };
  delete se1Lh.modus;
  return katalog(se1, se1Lh);
}

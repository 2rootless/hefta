import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { lesenMitGrund, pruefen } from '../../pakete/hefta-json/src/index';
import { BITTE_VORSCHLAG } from '../domain/export';
import { monatsSpanne } from '../domain/mappeWoerter';
import {
  bewerbungBauen,
  type BewerbungAuftrag,
  type MappenBlock,
  type MappenPerson,
} from '../pdf/bewerbung';
import { pdfSchriften } from '../test/hilfen';
import { anhangLesen } from '../pdf/anhang';
import { papierLesen } from './papier';
import { lesehilfePasst } from './regel';

// PC126 (DP76 Teil 2, DP82 F1): die Fälle G1, G2, G4, G6 und G8 aus dem Stresskatalog (PC110) als echte Mappen aus dem
// Schreiber von 2.0 (`bewerbungBauen`), mit den Feldern, die die App ihm gibt (mappeErstellen.ts). Drei Leser urteilen
// über dieselbe Datei: das Paket, die Vermieter-Seite und Designs leser78 (Fassung 4). Jede Mappe soll mit Lesehilfe
// gezeigt werden. STRESS_G=<ordner> legt die PDFs für Design ab. Nur Musterdaten nach W7 (Fassung 25).

type Urteil = 'gezeigt' | 'passt nicht' | 'abgelehnt' | 'ABSTURZ';

async function quelle(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(text, { x: 60, y: 700, size: 18, font: schrift });
  return doc.save();
}

interface Person {
  vorname: string;
  nachname: string;
  rolle: 'hauptmieter' | 'mitmieter';
}
interface Bau {
  personen: Person[];
  telefon?: [anzeige: string, e164: string];
  email?: string;
  monate?: string[];
}

async function mappe(nr: string, b: Bau): Promise<Uint8Array> {
  const q = await quelle(nr);
  const monate = b.monate ?? ['2026-08', '2026-09', '2026-10'];
  const name = (p: Person) => `${p.vorname} ${p.nachname}`.trim();
  const haupt = b.personen[0]!;
  const bloecke: MappenBlock[] = b.personen.map((p, i) => {
    const person: MappenPerson = {
      name: name(p),
      vorname: p.vorname,
      nachname: p.nachname,
      // W57: kein Rollenwort für den Vertrag; die Kennung ist „vertrag“.
      rolle: '',
      rolleId: 'vertrag',
      farbe: ['#e9a970', '#8fb9e8', '#a8d5a2', '#c8abff'][i % 4]!,
    };
    return {
      person,
      teile: [
        { abschnitt: 'Selbstauskunft', typ: 'selbstauskunft', quellen: [{ daten: q }] },
        {
          abschnitt: 'Gehaltsnachweise',
          detail: monatsSpanne(monate, false),
          typ: 'gehaltsnachweis',
          monate,
          quellen: monate.map((m) => ({
            daten: q,
            kopf: `Gehaltsnachweis ${monatsSpanne([m], true)}`,
          })),
        },
      ],
    };
  });
  const [telefon, e164] = b.telefon ?? [undefined, undefined];
  const auftrag: BewerbungAuftrag = {
    titel: `Bewerbung Musterweg 7 – ${name(haupt)}`,
    autor: name(haupt),
    fussName: name(haupt),
    kurz: 'Musterweg 7',
    // W7 (PC138): der Musterweg nur mit 12345 Musterstadt.
    adresse: ['Musterweg 7, 2. OG', '12345 Musterstadt'],
    satz: '',
    fassung: 'Fassung 1 vom 19. November 2026',
    lesehilfeWerte: { fassung: 1 },
    mitziehende: [],
    kennung: KENNUNG[nr]!,
    hinweis: true,
    modus: 'marktueblich',
    bitte: BITTE_VORSCHLAG,
    kontakt: [name(haupt), telefon, b.email].filter((x): x is string => !!x),
    kontaktwege: { telefon, telefonE164: e164, email: b.email },
    bloecke,
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    schriften: pdfSchriften(),
    datum: new Date(2026, 10, 19, 9, 0),
  };
  return (await bewerbungBauen(auftrag)).bytes;
}

// PC138: Jede Mappe ist eine eigene Bewerbung eines eigenen Haushalts, also mit eigener Kennung, wie in der
// App (zufällig je Haushalt und Wohnung, `bewerbungsKennung`). Bis CP75 trugen alle dieselbe.
const KENNUNG: Record<string, string> = {
  G1: '62c20427-10a3-4652-902f-cf8934a70d4d',
  G2: '52fe18d9-cce9-4aa8-aa1e-30f2ede655ad',
  G4: 'e0d5e11c-c43d-4978-a3bf-24be64e04214',
  G6: '02c03c49-d3a3-40f2-b7a1-46a9b9ffd0fa',
  G8a: '073277da-714a-4960-bf85-27c05430e3c8',
  G8b: 'd473b1f6-c7de-41da-b1a2-7aaf1345d299',
  G8c: '326b1dab-ac83-4b72-97cd-5909813f0bfc',
};

/**
 * PC138: Mappen verschiedener Haushalte mit derselben Kennung. Eine Software, die nach der Kennung
 * zusammenführt, machte daraus eine Bewerbung. Dieselbe Kennung ist nur bei Fassungen derselben Bewerbung
 * richtig, also mit denselben Personen.
 */
function gleicheKennung(mappen: { nr: string; kennung: string; personen: string[] }[]): string[] {
  const funde: string[] = [];
  mappen.forEach((a, i) => {
    for (const b of mappen.slice(i + 1)) {
      if (a.kennung === b.kennung && a.personen.join('|') !== b.personen.join('|')) {
        funde.push(`${a.nr} und ${b.nr} mit ${a.kennung}`);
      }
    }
  });
  return funde;
}

/** Kennung und Personen aus dem Anhang hefta.json einer Mappe. */
async function lesehilfeVon(bytes: Uint8Array): Promise<{ kennung: string; personen: string[] }> {
  const dok = await PDFDocument.load(bytes, { updateMetadata: false });
  const anh = dok.getAttachments().find((a) => a.name === 'hefta.json')!;
  const lh = JSON.parse(new TextDecoder().decode(anh.data)) as {
    bewerbung: { kennung: string };
    haushalt: { personen: { name: string }[] };
  };
  return { kennung: lh.bewerbung.kennung, personen: lh.haushalt.personen.map((p) => p.name) };
}

const TEL: [string, string] = ['0171 3920001', '+491713920001'];
const MAIL = 'max.mustermann@example.com';
// 60 Zeichen, bricht auf dem Deckblatt um (G8).
const LANGE_MAIL = 'maximiliane-charlotte.beispielsdorf-mustermann.1@example.com';

const FAELLE: [nr: string, was: string, bau: Bau][] = [
  [
    'G1',
    'langer Name der Hauptmieterin, das Deckblatt bricht um',
    {
      personen: [
        {
          vorname: 'Dr. Maximiliane-Charlotte Henriette',
          nachname: 'von Beispielsdorf-Mustermann',
          rolle: 'hauptmieter',
        },
      ],
      telefon: TEL,
      email: MAIL,
    },
  ],
  [
    'G2',
    'Schriftzeichen: Thị Mai Nguyễn, Zoë O’Brien, Ægir Øster, İlkay Şahin',
    {
      personen: [
        { vorname: 'Thị Mai', nachname: 'Nguyễn', rolle: 'hauptmieter' },
        { vorname: 'Zoë', nachname: 'O’Brien', rolle: 'mitmieter' },
        { vorname: 'Ægir', nachname: 'Øster', rolle: 'mitmieter' },
        { vorname: 'İlkay', nachname: 'Şahin', rolle: 'mitmieter' },
      ],
      telefon: TEL,
      email: MAIL,
    },
  ],
  [
    'G4',
    'Aylin ohne Nachnamen',
    {
      personen: [
        { vorname: 'Lea', nachname: 'Muster', rolle: 'hauptmieter' },
        { vorname: 'Aylin', nachname: '', rolle: 'mitmieter' },
      ],
      telefon: TEL,
      email: MAIL,
    },
  ],
  [
    'G6',
    'Gehaltsnachweise Dezember 2026 bis Februar 2027 (S25)',
    {
      personen: [{ vorname: 'Lea', nachname: 'Muster', rolle: 'hauptmieter' }],
      telefon: TEL,
      email: MAIL,
      monate: ['2026-12', '2027-01', '2027-02'],
    },
  ],
  [
    'G8a',
    'Kontakt nur mit Mail',
    { personen: [{ vorname: 'Lea', nachname: 'Muster', rolle: 'hauptmieter' }], email: MAIL },
  ],
  [
    'G8b',
    'Kontakt nur mit Telefon',
    { personen: [{ vorname: 'Lea', nachname: 'Muster', rolle: 'hauptmieter' }], telefon: TEL },
  ],
  [
    'G8c',
    'sehr lange Mail (60 Zeichen), bricht auf dem Deckblatt um',
    {
      personen: [{ vorname: 'Lea', nachname: 'Muster', rolle: 'hauptmieter' }],
      telefon: TEL,
      email: LANGE_MAIL,
    },
  ],
];

async function unserUrteil(
  bytes: Uint8Array,
): Promise<{ urteil: Urteil; grund: string; einig: boolean }> {
  const aufgabe = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
  const dok = await aufgabe.promise;
  try {
    const anh = await dok.getAttachments();
    const t = anh ? [...anh.entries()].find(([, a]) => a.filename === 'hefta.json') : undefined;
    const roh = t ? await dok.getAttachmentContent(t[0]) : null;
    if (!roh) return { urteil: 'abgelehnt', grund: 'kein Anhang', einig: true };
    const g = lesenMitGrund(roh);
    const app = anhangLesen(roh);
    if (!g.lesehilfe) return { urteil: 'abgelehnt', grund: g.grund, einig: app === null };
    const papier = await papierLesen(dok, g.lesehilfe);
    const gruende = pruefen(g.lesehilfe, { ...papier, seiten: dok.numPages });
    const seite = !!app && lesehilfePasst(app, dok.numPages, papier);
    return gruende.length
      ? { urteil: 'passt nicht', grund: gruende.join('; '), einig: !seite }
      : { urteil: 'gezeigt', grund: '', einig: seite };
  } catch (e) {
    return { urteil: 'ABSTURZ', grund: String(e).slice(0, 200), einig: false };
  } finally {
    await aufgabe.destroy();
  }
}

function python(): string | null {
  for (const p of ['python3', 'python']) {
    const r = spawnSync(
      p,
      ['-E', '-P', '-B', '-c', 'import pypdf, pdfplumber, jsonschema; print(1)'],
      {
        encoding: 'utf8',
      },
    );
    if (r.status === 0 && r.stdout.trim() === '1') return p;
  }
  return null;
}

describe('Stresstest, Teil G: echte Mappen aus dem Schreiber (PC126, DP76 Teil 2)', () => {
  const ergebnisse: {
    nr: string;
    datei: string;
    bytes: Uint8Array;
    unser: Awaited<ReturnType<typeof unserUrteil>>;
    fremd?: [Urteil, string];
  }[] = [];
  const ordner = process.env.STRESS_G ?? mkdtempSync(join(tmpdir(), 'hefta-stress-g-'));

  beforeAll(async () => {
    mkdirSync(ordner, { recursive: true });
    for (const [nr, , bau] of FAELLE) {
      const bytes = await mappe(nr, bau);
      const datei = join(ordner, `${nr}.pdf`);
      writeFileSync(datei, bytes);
      ergebnisse.push({ nr, datei, bytes, unser: await unserUrteil(bytes) });
    }
    const py = python();
    if (!py) return;
    const liste = join(ordner, 'liste.json');
    const aus = join(ordner, 'urteil78.json');
    writeFileSync(liste, JSON.stringify(ergebnisse.map((e) => e.datei)));
    const lauf = spawnSync(
      py,
      [
        '-E',
        '-P',
        '-B',
        'pakete/hefta-json/test/fremd/urteil78.py',
        'pakete/hefta-json/schema.json',
        liste,
        aus,
      ],
      { encoding: 'utf8', maxBuffer: 1 << 26 },
    );
    if (lauf.status !== 0) throw new Error(`urteil78.py: ${lauf.stdout}${lauf.stderr}`);
    const u = JSON.parse(readFileSync(aus, 'utf8')) as Record<string, [Urteil, string]>;
    for (const e of ergebnisse) e.fremd = u[e.datei];
  }, 300_000);

  it('jede Mappe zeigt die Vermieter-Seite mit Lesehilfe; Seite und Paket sind sich einig', () => {
    const falsch = ergebnisse
      .filter((e) => e.unser.urteil !== 'gezeigt' || !e.unser.einig)
      .map((e) => `${e.nr}: ${e.unser.urteil} ${e.unser.grund}`);
    expect(falsch).toEqual([]);
    expect(ergebnisse.map((e) => e.nr)).toEqual(FAELLE.map((f) => f[0]));
  });

  // W57 (PC198): Der Schreiber schreibt Fassung 2. leser78 kennt nur Fassung 1 (Rollenwort, `kontakt`) und kann diese
  // Mappen nicht beurteilen. Der Vergleich wartet auf einen fremden Leser für Fassung 2 (PC198, E356); bis dahin
  // prüft fremd.test.ts leser78 gegen die Beispiele in Fassung 1.
  it.skip('leser78 (Fassung 1) urteilt bei jeder Mappe wie die Seite: wartet auf den Leser für Fassung 2', () => {
    if (!python()) return;
    const anders = ergebnisse
      .filter((e) => e.fremd?.[0] !== e.unser.urteil)
      .map(
        (e) => `${e.nr}: Seite ${e.unser.urteil}, leser78 ${e.fremd?.[0]} ${e.fremd?.[1] ?? ''}`,
      );
    expect(anders).toEqual([]);
  });

  it('jede Mappe hat ihre eigene Kennung; zwei Haushalte mit derselben werden angemahnt (PC138)', async () => {
    const mappen = await Promise.all(
      ergebnisse.map(async (e) => ({ nr: e.nr, ...(await lesehilfeVon(e.bytes)) })),
    );
    expect(mappen.map((m) => m.kennung)).toEqual(FAELLE.map(([nr]) => KENNUNG[nr]));
    expect(gleicheKennung(mappen)).toEqual([]);
    // Gegenprobe: die feste Kennung bis CP75 für alle Mappen wird rot.
    const alt = mappen.map((m) => ({ ...m, kennung: '5a1c9e2b-7d3f-4b8a-9c6e-2f0d1b3a4c5e' }));
    expect(gleicheKennung(alt)).toContain(`G1 und G2 mit ${alt[0]!.kennung}`);
    // Zwei Fassungen derselben Bewerbung (gleiche Personen) dürfen sie teilen.
    expect(gleicheKennung([mappen[0]!, { ...mappen[0]!, nr: 'G1, Fassung 2' }])).toEqual([]);
  });

  it('Gegenprobe: dieselbe Mappe mit einem anderen Namen in der Lesehilfe passt nicht', async () => {
    const g1 = ergebnisse.find((e) => e.nr === 'G1')!;
    const dok = await PDFDocument.load(g1.bytes, { updateMetadata: false });
    const anh = dok.getAttachments().find((a) => a.name === 'hefta.json')!;
    const lh = JSON.parse(new TextDecoder().decode(anh.data)) as {
      haushalt: { personen: { name: string; nachname?: string }[] };
    };
    lh.haushalt.personen[0]!.name = 'Dr. Maximiliane-Charlotte Henriette von Beispielsdorf';
    lh.haushalt.personen[0]!.nachname = 'von Beispielsdorf';
    const { PDFName, AFRelationship } = await import('@cantoo/pdf-lib');
    dok.catalog.delete(PDFName.of('Names'));
    dok.catalog.delete(PDFName.of('AF'));
    await dok.attach(new TextEncoder().encode(JSON.stringify(lh)), 'hefta.json', {
      mimeType: 'application/json',
      afRelationship: AFRelationship.Data,
    });
    const u = await unserUrteil(await dok.save());
    expect(u.urteil).toBe('passt nicht');
    expect(u.einig).toBe(true);
  });
});

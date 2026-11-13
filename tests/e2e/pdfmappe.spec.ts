import { BITTE_VORSCHLAG } from '../../src/domain/export';
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Person, Rolle } from '../../src/domain/modell';
import { haushaltsZeile, nameImPdf, nameText } from '../../src/domain/namen';
import { einziehend, ortUndDatum, selbstauskunftBloecke } from '../../src/domain/selbstauskunft';
import {
  bewerbungBauen,
  type BewerbungAuftrag,
  type MappenBlock,
  type MappenTeil,
} from '../../src/pdf/bewerbung';

// Die PDF-Mappe als Bild (design/mappe-pdf.md, Szenarien MP1 bis MP9): rendert jede Seite mit PDF.js im
// Browser, prüft P17 (hartes Schwarzweiß) und schreibt Kontaktbögen nach docs/screenshots/bogen-MP*.png.
// Personen, Selbstauskunft, Haushaltszeile und Kontakt kommen aus dem Code der App, nicht von Hand.

const SCHRIFTEN = 'src/pdf/fonts';
const schriften = {
  regular: readFileSync(join(SCHRIFTEN, 'Archivo-Regular.ttf')),
  bold: readFileSync(join(SCHRIFTEN, 'Archivo-Bold.ttf')),
  titel: readFileSync(join(SCHRIFTEN, 'Archivo-ExtraBold-Wide.ttf')),
};

const FARBEN = ['#e9a970', '#b8e07c', '#e3b25a', '#ffadc9'];
const BUERGE = '#c8abff';

async function zeilen(
  titel: string,
  texte: string[],
  groesse: [number, number] = [595.28, 841.89],
  seiten = 1,
) {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (let n = 1; n <= seiten; n++) {
    const seite = pdf.addPage(groesse);
    const oben = groesse[1] - 70;
    seite.drawText('Musterfirma GmbH', { x: 60, y: oben, size: 13, font: fett });
    seite.drawText(titel, { x: 60, y: oben - 40, size: 11, font: fett });
    texte.forEach((t, i) => seite.drawText(t, { x: 60, y: oben - 70 - i * 18, size: 9, font: f }));
    if (seiten > 1) seite.drawText(`Blatt ${n}/${seiten}`, { x: 60, y: 60, size: 8, font: f });
  }
  return pdf.save();
}

const abrechnung = (monat: string, seiten = 1) =>
  zeilen(
    `Verdienstabrechnung ${monat} 2026`,
    ['Grundgehalt 3.980,00', 'Lohnsteuer 512,33', 'Sozialabgaben 824,67', 'Auszahlung 2.643,00'],
    undefined,
    seiten,
  );

async function scan() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.TimesRoman);
  const seite = pdf.addPage([595.28, 841.89]);
  // Graues Papier wie vom Handy: Im harten Schwarzweiß fällt die Fläche weg.
  seite.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.86, 0.86, 0.85) });
  seite.drawText('Bürgschaftserklärung', { x: 60, y: 760, size: 20, font: f });
  for (let i = 0; i < 12; i++)
    seite.drawLine({
      start: { x: 60, y: 700 - i * 34 },
      end: { x: 500 - (i % 4) * 30, y: 702 - i * 34 },
      thickness: 1,
      color: rgb(0.25, 0.25, 0.25),
    });
  return pdf.save();
}

async function gedreht() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const seite = pdf.addPage([841.89, 595.28]);
  seite.setRotation(degrees(90));
  seite.drawText('Verdienstabrechnung Oktober 2026 (Handy-Scan)', {
    x: 80,
    y: 60,
    size: 14,
    font: f,
    rotate: degrees(90),
  });
  return pdf.save();
}

async function formular() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.HelveticaBold);
  const seite = pdf.addPage([595.28, 841.89]);
  seite.drawText('Mieterselbstauskunft des Vermieters (Formular)', {
    x: 60,
    y: 780,
    size: 12,
    font: f,
  });
  seite.drawText('Name:', { x: 60, y: 740, size: 12, font: f });
  const feld = pdf.getForm().createTextField('name');
  feld.setText('Max Mustermann');
  feld.addToPage(seite, { x: 120, y: 730, width: 250, height: 20 });
  return pdf.save();
}

interface Mensch {
  person: Person;
  rolle: Rolle;
  rolleText: string;
  farbe: string;
}

function mensch(
  vorname: string,
  nachname: string,
  rolle: Rolle,
  rolleText: string,
  angaben: Partial<Person> & { n?: number } = {},
): Mensch {
  const { n = 0, ...rest } = angaben;
  return {
    rolle,
    rolleText,
    farbe: rolle === 'buerge' ? BUERGE : FARBEN[n % FARBEN.length]!,
    person: {
      id: `${vorname}-${nachname}`,
      createdAt: '',
      updatedAt: '',
      vorname,
      nachname,
      rufname: vorname,
      kontakt: { telefon: '0151 23456789', email: `${vorname.toLowerCase()}@example.com` },
      lebenssituation: 'angestellt',
      beruf: '',
      arbeitgeber: '',
      nettoeinkommen: 2643,
      abrechnungMeist: null,
      selbstauskunft: {
        einkommenArt: 'betrag',
        haustiere: null,
        haustiereText: '',
        insolvenz: 'nein',
        raeumungstitel: 'nein',
        mietrueckstaende: 'nein',
        stellungnahme: '',
        ort: '',
      },
      ...rest,
    } as Person,
  };
}

const HH = { haustiere: 'nein' as const, haustiereText: '', ort: 'Hamburg' };

function auskunft(m: Mensch, alle: Mensch[]): MappenTeil {
  const wer = einziehend(alle.filter((x) => x.rolle !== 'buerge').length, {
    kinder: 1,
    weitereErwachsene: 0,
  });
  return {
    abschnitt: 'Selbstauskunft',
    quellen: [],
    auskunft: {
      name: nameText(nameImPdf(m.person)),
      rolle: m.rolleText,
      farbe: m.farbe,
      bloecke: selbstauskunftBloecke(m.person, m.rolle, wer, HH, 'zusage', {
        rolleText: m.rolleText,
        buergschaftDabei: m.rolle === 'buerge',
      }),
      ...ortUndDatum(m.rolle, HH.ort, '2. November 2026'),
    },
  };
}

async function gehalt(): Promise<MappenTeil> {
  return {
    abschnitt: 'Gehaltsnachweise',
    detail: 'Juli bis September',
    quellen: [
      { daten: await abrechnung('September'), kopf: 'Gehaltsnachweis September 2026' },
      { daten: await abrechnung('August', 2), kopf: 'Gehaltsnachweis August 2026' },
      { daten: await abrechnung('Juli'), kopf: 'Gehaltsnachweis Juli 2026' },
    ],
  };
}

async function bonitaet(): Promise<MappenTeil> {
  return {
    abschnitt: 'Bonitätsnachweis',
    detail: 'vom 20. Oktober 2026',
    kopf: 'Bonitätsnachweis vom 20. Oktober 2026',
    quellen: [{ daten: await zeilen('Bonitätsauskunft', ['Ausgestellt am 20.10.2026']) }],
  };
}

const block = (m: Mensch, teile: MappenTeil[]): MappenBlock => ({
  person: {
    name: nameText(nameImPdf(m.person)),
    rolle: m.rolleText,
    beruf: m.person.beruf,
    farbe: m.farbe,
    buerge: m.rolle === 'buerge',
  },
  teile,
});

/** Baut den Auftrag wie src/ui/mappeErstellen.ts: Haushaltszeile, Autor und Kontakt aus den Personen. */
function auftrag(
  menschen: Mensch[],
  bloecke: MappenBlock[],
  teil: Partial<BewerbungAuftrag> = {},
): BewerbungAuftrag {
  const vertrag = menschen.filter((m) => m.rolle !== 'buerge');
  const fussName = haushaltsZeile(vertrag.map((m) => nameImPdf(m.person)));
  const erste = vertrag[0]!.person;
  const kurz =
    teil.kurz === undefined && 'kurz' in teil ? undefined : (teil.kurz ?? 'Hauptstraße 12');
  return {
    titel: kurz ? `Bewerbung ${kurz} – ${fussName}` : `Bewerbung – ${fussName}`,
    autor: nameText(nameImPdf(erste)),
    fussName,
    kurz,
    adresse: ['Hauptstraße 12, 3. OG links', '22767 Hamburg'],
    satz: 'Wir sind ein ruhiges Paar mit einem Kind und suchen ab Januar 2027 eine Wohnung für die nächsten Jahre. Alle Unterlagen liegen bei.',
    mitziehende: [{ text: 'Ein Kind', anzahl: 1, art: 'kind' }],
    // Wie in der App: Mit Lesehilfe trägt jede Mappe die Kennung der Bewerbung (Pflicht seit E21).
    kennung: '6f1c2b9e-4d7a-4c1e-9b2f-3a5d8e7c1f40',
    hinweis: true,
    aussehen: { art: 'personen' },
    kontakt: [nameText(nameImPdf(erste)), erste.kontakt.telefon, erste.kontakt.email],
    bloecke,
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    schriften,
    datum: new Date(2026, 10, 2),
    ...teil,
  };
}

const MAX = mensch('Max', 'Mustermann', 'hauptmieter', 'Hauptmieter', { beruf: 'Elektroniker' });
const LEA = mensch('Lea', 'Mustermann', 'mitmieter', 'Mitmieterin', {
  n: 1,
  beruf: 'Lehrerin',
  nettoeinkommen: 2310,
});
const PETRA = mensch('Petra', 'Mustermann', 'buerge', 'Bürgin', { nettoeinkommen: 1850 });

async function mp1(): Promise<MappenBlock[]> {
  const alle = [MAX, LEA, PETRA];
  return [
    block(MAX, [auskunft(MAX, alle), await gehalt(), await bonitaet()]),
    block(LEA, [
      auskunft(LEA, alle),
      await gehalt(),
      {
        abschnitt: 'Mietzahlungen',
        detail: 'August bis Oktober',
        kopf: 'Mietzahlungen August bis Oktober',
        quellen: [
          {
            daten: await zeilen(
              'Umsatzübersicht',
              ['01.10.2026 Dauerauftrag Miete 980,00', '01.09.2026 Dauerauftrag Miete 980,00'],
              [841.89, 595.28],
            ),
          },
        ],
      },
      {
        abschnitt: 'Mietschuldenfreiheit',
        detail: 'vom 12. Oktober 2026',
        kopf: 'Mietschuldenfreiheitsbescheinigung',
        quellen: [
          {
            daten: await zeilen(
              'Mietschuldenfreiheit',
              ['Die Miete wurde stets pünktlich gezahlt.'],
              [419.53, 595.28],
            ),
          },
        ],
      },
    ]),
    block(PETRA, [
      auskunft(PETRA, alle),
      { abschnitt: 'Bürgschaftserklärung', quellen: [{ daten: await scan() }] },
      {
        abschnitt: 'Rentenbescheid',
        detail: 'Juli 2026',
        kopf: 'Rentenbescheid Juli 2026',
        quellen: [{ daten: await zeilen('Deutsche Rentenversicherung', [], [612, 792]) }],
      },
      await bonitaet(),
    ]),
  ];
}

const SZENARIEN: Record<string, () => Promise<BewerbungAuftrag>> = {
  'MP1-standard': async () => auftrag([MAX, LEA, PETRA], await mp1()),
  'MP2-allein': async () =>
    auftrag([MAX], [block(MAX, [auskunft(MAX, [MAX]), await gehalt(), await bonitaet()])], {
      kurz: undefined,
      adresse: [],
      satz: '',
      mitziehende: [],
    }),
  'MP3-lange-namen': async () => {
    const a = mensch(
      'Maximilian-Alexander',
      'Müller-Lüdenscheidt',
      'hauptmieter',
      'Hauptmietpartei',
      {
        beruf: 'Elektroingenieur im öffentlichen Dienst',
      },
    );
    const b = mensch('Bartholomäus', 'Wiśniewski-Kowalczyk', 'mitmieter', 'Mitmietpartei', {
      n: 1,
    });
    const c = mensch('Jonas', 'Becker', 'mitmieter', 'Mitmieter', { n: 2 });
    const d = mensch('Anna-Katharina Josephine', 'von Hohenstein', 'buerge', 'Bürgin');
    return auftrag(
      [a, b, c, d],
      [
        block(a, [await gehalt(), await bonitaet()]),
        block(b, [await bonitaet()]),
        block(c, [await gehalt()]),
        block(d, [{ abschnitt: 'Bürgschaftserklärung', quellen: [{ daten: await scan() }] }]),
      ],
      {
        kurz: 'Große Bergstraße 152',
        adresse: ['Große Bergstraße 152, Hinterhaus, 4. OG rechts', '22767 Hamburg-Altona'],
        mitziehende: [],
      },
    );
  },
  'MP4-datensparsam': async () =>
    auftrag(
      [MAX, LEA],
      [block(MAX, [auskunft(MAX, [MAX, LEA])]), block(LEA, [auskunft(LEA, [MAX, LEA])])],
      { satz: '' },
    ),
  'MP5-ohne-kopfzeile': async () => auftrag([MAX, LEA, PETRA], await mp1(), { fusszeile: false }),
  'MP6-einzeldatei-gehalt': async () =>
    auftrag([MAX, LEA], [block(MAX, [await gehalt()])], {
      titel: 'Gehaltsnachweise – Max Mustermann – Bewerbung Hauptstraße 12',
      deckblatt: false,
      inhaltsverzeichnis: false,
    }),
  'MP7-randfaelle': async () =>
    auftrag(
      [MAX],
      [
        block(MAX, [
          {
            abschnitt: 'Formular des Vermieters',
            detail: 'ausgefüllt',
            quellen: [{ daten: await formular() }],
          },
          {
            abschnitt: 'Gehaltsnachweis',
            detail: 'Oktober',
            kopf: 'Gehaltsnachweis Oktober 2026',
            quellen: [{ daten: await gedreht() }],
          },
        ]),
      ],
      { adresse: [], kurz: undefined, satz: '', mitziehende: [] },
    ),
  'MP8-langer-inhalt': async () => {
    const leute = [
      mensch('Max', 'Mustermann', 'hauptmieter', 'Hauptmieter', { beruf: 'Elektroniker' }),
      mensch('Lea', 'Mustermann', 'mitmieter', 'Mitmieterin', { n: 1 }),
      mensch('Tom', 'Becker', 'mitmieter', 'Mitmieter', { n: 2 }),
      mensch('Anna', 'Schmidt', 'mitmieter', 'Mitmieterin', { n: 3 }),
      mensch('Petra', 'Mustermann', 'buerge', 'Bürgin'),
    ];
    const seite = await zeilen('Unterlage', ['Eine Seite']);
    const namen = [
      'Selbstauskunft',
      'Gehaltsnachweise',
      'Bonitätsnachweis',
      'Mietzahlungen',
      'Mietschuldenfreiheit',
      'Ausweis',
    ];
    return auftrag(
      leute,
      leute.map((m) =>
        block(
          m,
          namen.map((abschnitt) => ({ abschnitt, quellen: [{ daten: seite }] })),
        ),
      ),
    );
  },
  'MP1-bitte': async () => ({ ...(await SZENARIEN['MP1-standard']!()), bitte: BITTE_VORSCHLAG }),
  'MP8-bitte': async () => ({
    ...(await SZENARIEN['MP8-langer-inhalt']!()),
    bitte: BITTE_VORSCHLAG,
  }),
  // Die volle Leiste: passt noch ohne Stufe (mappe-pdf.md, „Volle Leiste“).
  'MP10-volle-leiste': async () => {
    const vertrag = [
      mensch('Maximilian-Alexander', 'Müller-Lüdenscheidt', 'hauptmieter', 'Hauptmietpartei', {
        beruf: 'Elektroingenieur im öffentlichen Dienst',
      }),
      mensch('Bartholomäus', 'Wiśniewski-Kowalczyk', 'mitmieter', 'Mitmietpartei', {
        n: 1,
        beruf: 'Auszubildender zum Mechatroniker',
      }),
      mensch('Anna-Katharina Josephine', 'von Hohenstein', 'mitmieter', 'Mitmieterin', {
        n: 2,
        beruf: 'Fachärztin für Kinder- und Jugendmedizin',
      }),
      mensch('Jonas', 'Becker', 'mitmieter', 'Mitmieter', { n: 3, beruf: 'Pflegefachmann' }),
      mensch('Mira', 'Yılmaz', 'mitmieter', 'Mitmieterin', {
        n: 4,
        beruf: 'Studentin der Rechtswissenschaft',
      }),
      mensch('Tom', 'Nguyen', 'mitmieter', 'Mitmieter', { n: 5, beruf: 'Koch' }),
    ];
    const buergen = [
      mensch('Petra', 'Mustermann', 'buerge', 'Bürgin'),
      mensch('Hans-Jürgen', 'Wiśniewski-Kowalczyk', 'buerge', 'Bürge'),
    ];
    const seite = await zeilen('Unterlage', ['Eine Seite']);
    const leute = [...vertrag, ...buergen];
    return auftrag(
      leute,
      leute.map((m) => block(m, [{ abschnitt: 'Selbstauskunft', quellen: [{ daten: seite }] }])),
      {
        adresse: ['Große Bergstraße 152, Hinterhaus, 4. OG rechts', '22767 Hamburg-Altona'],
        kurz: 'Große Bergstraße 152',
        satz: 'Wir sind eine große Wohngemeinschaft mit zwei Kindern und suchen ab März eine Wohnung für mehrere Jahre.',
        mitziehende: [
          { text: 'Zwei Kinder', anzahl: 2, art: 'kind' },
          { text: 'Eine weitere Person', anzahl: 1, art: 'erwachsen' },
        ],
      },
    );
  },
  'MP9-andere-schrift': async () => {
    const olena = mensch('Олена', 'Коваленко', 'hauptmieter', 'Hauptmieterin', {
      nameMappe: { vorname: 'Olena', nachname: 'Kovalenko' },
      kontakt: { telefon: '0151 23456789', email: 'olena@example.com' },
    });
    const piotr = mensch('Piotr', 'Wiśniewski', 'mitmieter', 'Mitmieter', { n: 1 });
    const mai = mensch('Thị Mai', 'Nguyễn', 'mitmieter', 'Mitmieterin', {
      n: 2,
      kontakt: { telefon: '0151 23456789', email: 'mai@example.com' },
    });
    const alle = [olena, piotr, mai];
    return auftrag(alle, [
      block(olena, [auskunft(olena, alle), await bonitaet()]),
      block(piotr, [auskunft(piotr, alle)]),
      block(mai, [auskunft(mai, alle)]),
    ]);
  },
};

/** Stellt PDF.js unter einer eigenen Adresse bereit, ganz ohne die App. */
async function pdfjsLaden(page: Page) {
  const wurzel = 'node_modules/pdfjs-dist';
  await page.route('http://pdf.test/**', async (route) => {
    const pfad = new URL(route.request().url()).pathname;
    if (pfad === '/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>PDF</title>' });
      return;
    }
    const datei = pfad.startsWith('/standard_fonts/')
      ? join(wurzel, pfad)
      : join(wurzel, 'legacy/build', pfad);
    await route.fulfill({
      contentType: pfad.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream',
      body: readFileSync(datei),
    });
  });
  await page.goto('http://pdf.test/');
}

interface Art {
  name: string;
  bild: string;
  kopf: string;
}

interface Seite {
  bild: string;
  grau: string;
  fehler: string[];
  arten?: Art[];
}

/** Rendert bei 200 dpi und misst P17 wie design/mappe-pdf/druck_sw.py: Schwelle 140 von 255. */
function rendern(
  page: Page,
  bytes: Uint8Array,
  mitKopf: boolean,
  deckblaetter: number,
  druck: number[] = [],
) {
  return page.evaluate(
    async ({ b64, mitKopf, deckblaetter, druck }) => {
      const pdfjs = await import(/* @vite-ignore */ '/pdf.min.mjs' as string);
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dok = await pdfjs.getDocument({ data, standardFontDataUrl: '/standard_fonts/' })
        .promise;
      const MM = 200 / 25.4;
      const seiten: Seite[] = [];
      for (let n = 1; n <= dok.numPages; n++) {
        const seite = await dok.getPage(n);
        const ansicht = seite.getViewport({ scale: 200 / 72 });
        const leinwand = document.createElement('canvas');
        leinwand.width = ansicht.width;
        leinwand.height = ansicht.height;
        const ctx = leinwand.getContext('2d', { willReadFrequently: true })!;
        await seite.render({ canvasContext: ctx, viewport: ansicht }).promise;
        const W = leinwand.width;
        const H = leinwand.height;
        const bild = ctx.getImageData(0, 0, W, H);
        const grau = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++)
          grau[i] =
            0.299 * bild.data[i * 4]! +
            0.587 * bild.data[i * 4 + 1]! +
            0.114 * bild.data[i * 4 + 2]!;
        const zaehlen = (x0: number, y0: number, x1: number, y1: number) => {
          let z = 0;
          for (let y = Math.floor(y0); y < y1; y++)
            for (let x = Math.floor(x0); x < x1; x++) if (grau[y * W + x]! <= 140) z++;
          return z;
        };
        const fehler: string[] = [];
        if (mitKopf && n > deckblaetter) {
          if (zaehlen(12 * MM, 5 * MM, W / 2, 12 * MM) < 20)
            fehler.push(`Seite ${n}: Kopfzeile links ohne lesbare Schrift`);
          if (zaehlen(W / 2, 5 * MM, W - 12 * MM, 12 * MM) < 20)
            fehler.push(`Seite ${n}: Kopfzeile rechts ohne lesbare Schrift`);
          let linie = 0;
          for (let y = Math.floor(13 * MM); y < 15 * MM; y++)
            linie = Math.max(linie, zaehlen(0, y, W, y + 1));
          if (linie < 0.8 * W)
            fehler.push(`Seite ${n}: keine durchgehende Linie (${linie} von ${W})`);
        }
        if (mitKopf && zaehlen(W - 50 * MM, H - 12 * MM, W - 12 * MM, H - 6 * MM) < 10)
          fehler.push(`Seite ${n}: Seitenzahl unten nicht lesbar`);

        const klein = (quelle: HTMLCanvasElement) => {
          const c = document.createElement('canvas');
          c.width = Math.round(W * 0.28);
          c.height = Math.round(H * 0.28);
          const k = c.getContext('2d')!;
          k.imageSmoothingQuality = 'high';
          k.drawImage(quelle, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        };
        const band = (quelle: HTMLCanvasElement) => {
          const c = document.createElement('canvas');
          c.width = Math.round(W * 0.75);
          c.height = Math.round(24 * MM * 0.75);
          const k = c.getContext('2d')!;
          k.imageSmoothingQuality = 'high';
          k.drawImage(quelle, 0, 0, W, 24 * MM, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        };
        const gefaerbt = (wert: (g: number, i: number) => number) => {
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const k = c.getContext('2d')!;
          const d = k.createImageData(W, H);
          for (let i = 0; i < W * H; i++) {
            const v = wert(grau[i]!, i);
            d.data[i * 4] = v;
            d.data[i * 4 + 1] = v;
            d.data[i * 4 + 2] = v;
            d.data[i * 4 + 3] = 255;
          }
          k.putImageData(d, 0, 0);
          return c;
        };
        const eintrag: Seite = { bild: klein(leinwand), grau: klein(gefaerbt((g) => g)), fehler };
        if (druck.includes(n)) {
          // Fehlerverteilung, wie ein Laserdrucker rastert.
          const rest = Float32Array.from(grau);
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
              const i = y * W + x;
              const alt = rest[i]!;
              const neu = alt > 127 ? 255 : 0;
              rest[i] = neu;
              const f = alt - neu;
              if (x + 1 < W) rest[i + 1] = rest[i + 1]! + (f * 7) / 16;
              if (y + 1 < H) {
                if (x > 0) rest[i + W - 1] = rest[i + W - 1]! + (f * 3) / 16;
                rest[i + W] = rest[i + W]! + (f * 5) / 16;
                if (x + 1 < W) rest[i + W + 1] = rest[i + W + 1]! + f / 16;
              }
            }
          const art = (name: string, c: HTMLCanvasElement): Art => ({
            name,
            bild: klein(c),
            kopf: band(c),
          });
          eintrag.arten = [
            art('Farbe', leinwand),
            art(
              'Graustufen',
              gefaerbt((g) => g),
            ),
            art(
              'Schwarzweiß, gerastert',
              gefaerbt((_, i) => rest[i]!),
            ),
            art(
              'Schwarzweiß, hart',
              gefaerbt((g) => (g > 140 ? 255 : 0)),
            ),
            art(
              'Tonersparen',
              gefaerbt((g) => 255 - (255 - g) * 0.45),
            ),
          ];
        }
        seiten.push(eintrag);
      }
      return seiten;
    },
    { b64: Buffer.from(bytes).toString('base64'), mitKopf, deckblaetter, druck },
  );
}

async function bild(page: Page, html: string, breite: number, pfad: string) {
  const kontext = await page
    .context()
    .browser()!
    .newContext({ viewport: { width: breite, height: 800 }, deviceScaleFactor: 1 });
  const blatt = await kontext.newPage();
  await blatt.setContent(
    `<body style="margin:0;padding:16px;background:#c9ccd6;font:bold 18px sans-serif;color:#191a2c">${html}</body>`,
  );
  await blatt.waitForLoadState('load');
  await blatt.screenshot({ path: pfad, fullPage: true });
  await kontext.close();
}

const BLATT = 'display:block;background:#fff';

const bogen = (page: Page, bilder: string[], pfad: string) =>
  bild(
    page,
    `<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">${bilder
      .map((b) => `<img src="${b}" style="${BLATT}">`)
      .join('')}</div>`,
    2900,
    pfad,
  );

/** Die Mappe in fünf Druckarten: je Zeile eine Seite, je Spalte eine Art. */
function druckBogen(page: Page, zeilen: Art[][], pfad: string) {
  const kopf = zeilen[0]!.map((a) => `<div>${a.name}</div>`).join('');
  const seiten = zeilen.flat().map((a) => `<img src="${a.bild}" style="${BLATT}">`);
  return bild(
    page,
    `<div style="display:grid;grid-template-columns:repeat(5,max-content);gap:16px">${kopf}${seiten.join('')}</div>`,
    2500,
    pfad,
  );
}

/** Das Kopfband groß in allen Druckarten untereinander. */
function kopfBogen(page: Page, arten: Art[], pfad: string) {
  return bild(
    page,
    arten
      .map(
        (a) =>
          `<div style="margin-bottom:8px">${a.name}</div><img src="${a.kopf}" style="${BLATT};margin-bottom:20px">`,
      )
      .join(''),
    1300,
    pfad,
  );
}

/** Der Text jeder Seite, wie ihn ein Programm liest. */
async function textJeSeite(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const texte: string[] = [];
  for (let n = 1; n <= dok.numPages; n++) {
    const { items } = await (await dok.getPage(n)).getTextContent();
    texte.push(items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  return texte;
}

test.describe('PDF-Mappe als Bild', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'PDF.js im Browser nur in Chromium');

  for (const [id, bauen] of Object.entries(SZENARIEN)) {
    test(`${id}: P17 und Kontaktbogen`, async ({ page }) => {
      test.setTimeout(240_000);
      const a = await bauen();
      const e = await bewerbungBauen(a);
      await pdfjsLaden(page);
      const standard = id === 'MP1-standard';
      const deckblaetter = a.deckblatt ? e.inhalt[0]!.seite - 1 : 0;
      const seiten = await rendern(
        page,
        e.bytes,
        a.fusszeile,
        deckblaetter,
        standard ? [1, 9, 16] : [],
      );
      expect(seiten).toHaveLength(e.seiten);
      await bogen(
        page,
        seiten.map((s) => s.bild),
        `docs/screenshots/bogen-${id}.png`,
      );
      if (standard) {
        await bogen(
          page,
          seiten.map((s) => s.grau),
          `docs/screenshots/bogen-${id}-grau.png`,
        );
        const zeilen = seiten.flatMap((s) => (s.arten ? [s.arten] : []));
        await druckBogen(page, zeilen, 'docs/screenshots/druck-arten-MP1.png');
        await kopfBogen(page, zeilen[1]!, 'docs/screenshots/druck-kopfband.png');
        // vermieter.spec.ts liest die Datei womöglich gerade: Sie erscheint erst, wenn sie ganz ist.
        const muster = `docs/screenshots/muster-${id}.pdf`;
        writeFileSync(`${muster}.tmp`, e.bytes);
        renameSync(`${muster}.tmp`, muster);
      }
      expect(seiten.flatMap((s) => s.fehler)).toEqual([]);
      expect(e.ersetzt).toEqual([]);
    });
  }

  // Aussehen der Mappe: P17 gilt in allen drei, Schlicht hat keine Farbe, die anderen nur wenig.
  for (const aussehen of [
    { art: 'schlicht' },
    { art: 'einefarbe', akzent: 'bordeaux' },
    { art: 'personen' },
  ] as const) {
    test(`Aussehen ${aussehen.art}: P17, Farbe nur als Zusatz`, async ({ page }) => {
      test.setTimeout(240_000);
      const a = { ...(await SZENARIEN['MP1-standard']!()), aussehen };
      const e = await bewerbungBauen(a);
      await pdfjsLaden(page);
      const deckblaetter = e.inhalt[0]!.seite - 1;
      const seiten = await rendern(page, e.bytes, a.fusszeile, deckblaetter);
      expect(seiten.flatMap((s) => s.fehler)).toEqual([]);
      await bogen(
        page,
        seiten.map((s) => s.bild),
        `docs/screenshots/bogen-MP1-aussehen-${aussehen.art}.png`,
      );
      // Bunte Punkte auf Deckblatt und in der Kopfzeile einer eigenen Seite.
      const bunt = await page.evaluate(
        async ({ b64, seite }) => {
          const pdfjs = await import(/* @vite-ignore */ '/pdf.min.mjs' as string);
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const dok = await pdfjs.getDocument({ data, standardFontDataUrl: '/standard_fonts/' })
            .promise;
          const zaehlen = async (nummer: number, hoehe: number) => {
            const s = await dok.getPage(nummer);
            const ansicht = s.getViewport({ scale: 2 });
            const c = document.createElement('canvas');
            c.width = ansicht.width;
            c.height = ansicht.height;
            const k = c.getContext('2d', { willReadFrequently: true })!;
            await s.render({ canvasContext: k, viewport: ansicht }).promise;
            const d = k.getImageData(0, 0, c.width, Math.round(c.height * hoehe)).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4)
              if (
                Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!) >
                40
              )
                n++;
            return n;
          };
          return { deck: await zaehlen(1, 1), kopf: await zaehlen(seite, 0.06) };
        },
        { b64: Buffer.from(e.bytes).toString('base64'), seite: e.inhalt[0]!.seite },
      );
      if (aussehen.art === 'schlicht') expect(bunt).toEqual({ deck: 0, kopf: 0 });
      else {
        expect(bunt.deck).toBeGreaterThan(0);
        expect(bunt.kopf).toBeGreaterThan(0);
      }
    });
  }

  test('P19: Die Selbstauskunft der Bürgin nennt nur ihre eigenen Angaben', async () => {
    const texte = await textJeSeite(
      (await bewerbungBauen(await SZENARIEN['MP1-standard']!())).bytes,
    );
    const auskunftVon = (name: string) =>
      texte.slice(1).find((t) => t.includes(name) && /Selbstauskunft.*Insolvenz/.test(t))!;
    const petra = auskunftVon('Petra Mustermann');
    expect(petra).toContain('1.850 €');
    expect(petra).not.toContain('Personen, die einziehen');
    expect(petra).not.toContain('Haustiere');
    expect(petra).not.toContain('Hamburg');
    const max = auskunftVon('Max Mustermann');
    expect(max).toContain('Personen, die einziehen');
    expect(max).toContain('Hamburg, 2. November 2026');
  });

  test('P18, Kontakt: Bei drei Nachnamen nur diese, Kontakt ist die erste im Vertrag', async () => {
    const texte = await textJeSeite(
      (await bewerbungBauen(await SZENARIEN['MP3-lange-namen']!())).bytes,
    );
    expect(texte[1]).toContain('Müller-Lüdenscheidt, Wiśniewski-Kowalczyk und Becker');
    expect(texte[1]).not.toContain('Hohenstein ·');
    expect(texte[0]).toMatch(/Kontakt\s+Maximilian-Alexander Müller-Lüdenscheidt/);
  });

  test('MP8: Der Inhalt läuft weiter, der Kontakt bleibt auf der ersten Seite', async () => {
    const e = await bewerbungBauen(await SZENARIEN['MP8-langer-inhalt']!());
    const texte = await textJeSeite(e.bytes);
    expect(e.inhalt[0]!.seite).toBe(3);
    expect(texte[0]).toContain('Kontakt');
    expect(texte[1]).toContain('(Fortsetzung)');
    expect(texte[1]).not.toContain('Kontakt');
  });

  test('P12, MP9: Im PDF steht der Name in lateinischen Buchstaben, kein Fragezeichen', async () => {
    const e = await bewerbungBauen(await SZENARIEN['MP9-andere-schrift']!());
    const alles = (await textJeSeite(e.bytes)).join(' ');
    expect(alles).toContain('Olena Kovalenko');
    expect(alles).toContain('Piotr Wiśniewski');
    expect(alles).toContain('Thị Mai Nguyễn');
    expect(alles).toContain('Kovalenko, Wiśniewski und Nguyễn');
    expect(alles).not.toContain('Олена');
    expect(alles).not.toContain('?');
    expect(e.ersetzt).toEqual([]);
  });
});

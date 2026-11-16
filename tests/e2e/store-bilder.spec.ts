import { test, type Browser, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { mkdirSync } from 'node:fs';
import { animationenFertig } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Bildschirmfotos für den App Store (PC74, Release-Mappe Abschnitt 5). Kein Test im eigentlichen Sinn: läuft
// nur mit STORE_BILDER=1 und nur in Chromium (docs/29: WebKit unter Windows setzt die breite Archivo falsch).
//   npm run build && STORE_BILDER=1 npx playwright test store-bilder --project=chromium
// Nur Musterdaten (W7): Haushalt Mustermann aus „04-fertig“ (Max, Lea, Bürgin Petra), Adressen aus der Liste
// der Planung, ein erfundenes Inserat auf example.com, Fotos hier gezeichnet. Größen nach App Store Connect
// (16.11.2026): 1206 × 2622 (iPhone mit Dynamic Island, mittel, verlangt) und 1320 × 2868 (groß).
test.skip(!process.env.STORE_BILDER, 'nur mit STORE_BILDER=1');
test.use({ actionTimeout: 15_000 });

const ZIEL = 'docs/release-2-0/bilder';
const GROESSEN = [
  { ordner: '1206x2622', breite: 402, hoehe: 874 },
  { ordner: '1320x2868', breite: 440, hoehe: 956 },
];

/** Ein Zeitpunkt relativ zu HEUTE (Freitag, 6. November 2026, 10 Uhr). */
function tag(versatz: number, stunde = 12, minute = 0): string {
  const d = new Date(HEUTE);
  d.setDate(d.getDate() + versatz);
  d.setHours(stunde, minute, 0, 0);
  return d.toISOString();
}

const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

function heft(id: string, erstellt: number, extra: Record<string, unknown>) {
  return {
    id,
    createdAt: tag(erstellt),
    updatedAt: tag(erstellt),
    haushaltId: null as string | null,
    link: `https://wohnungen.example.com/inserat/${id}`,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer },
    notiz: '',
    foto: `foto-${id}`,
    ...extra,
  };
}

const HEFTE = [
  heft('linden', -6, {
    adresse: 'Lindenring 3, EG\n20259 Hamburg',
    angaben: {
      titel: 'Helle Wohnung mit Garten',
      merkmal: 'Altbau mit Garten',
      stadtteil: 'Eimsbüttel',
      warm: 1240,
      zimmer: 3,
      flaeche: 74,
      anbieter: 'Frau Hansen',
    },
    ereignisse: {
      ...leer,
      beworben: { am: tag(-5), weg: 'mail', sicher: true },
      termin: {
        am: tag(1, 17, 30),
        ort: 'Lindenring 3, EG',
        treffpunkt: 'Frau Hansen erwartet euch vor dem Haus.',
      },
    },
  }),
  heft('acht', -4, {
    adresse: 'Lindenring 8\n20259 Hamburg',
    angaben: {
      titel: 'Altbau mit Balkon',
      stadtteil: 'Eimsbüttel',
      warm: 1310,
      zimmer: 3,
      flaeche: 78,
    },
    ereignisse: { ...leer, beworben: { am: tag(-3), weg: 'mail', sicher: true } },
  }),
  heft('muster', -1, {
    adresse: 'Musterweg 7\n20255 Hamburg',
    einzug: '2027-01-01',
    angaben: {
      titel: 'Dachgeschoss mit Gaube',
      stadtteil: 'Hoheluft',
      warm: 1180,
      zimmer: 3,
      flaeche: 71,
      anbieter: 'Herr Kraus',
    },
  }),
];

const WUENSCHE = {
  warmBis: 1300,
  zimmerAb: 3,
  flaecheAb: 75,
  ort: null,
  einzugVon: '2026-12-01',
  einzugBis: '2027-02-28',
};

/** Das erfundene Inserat für „Wohnung hinzufügen“, im Aufbau einer Portal-Seite (Probe 2), auf example.com. */
const INSERAT_URL = 'https://wohnungen.example.com/inserat/4711';
const INSERAT_TITEL = 'Ruhige Wohnung am Park';
const INSERAT_TEXT = [
  'Inserieren',
  '',
  INSERAT_TITEL,
  'Beispielstraße 1, Musterstadt, 12345 Musterstadt',
  '1.050,00 €',
  'Kaltmiete 15,00 €/m²',
  '2',
  'Zi.',
  '70 m²',
  'Fläche',
  '1.320,00 €',
  'Warmmiete',
  'Typ',
  'Etagenwohnung',
  'Etage',
  '2 von 4',
  'Wohnfläche ca.',
  '70 m²',
  'Zimmer',
  '2',
  'Kosten',
  'Kaltmiete',
  '1.050,00 €',
  'Nebenkosten',
  '+ 190 €',
  'Heizkosten',
  '+ 80 €',
  'Gesamtmiete',
  '1.320,00 €',
  'Beschreibung',
  'Helle Zweizimmerwohnung mit Blick ins Grüne. Musterdaten für Hefta.',
  'Lage',
  'Beispielstraße 1, Musterstadt, 12345 Musterstadt',
].join('\n');

/** Ein gezeichnetes Zimmer als JPEG-Daten-Adresse: Wand, Fenster mit Himmel, Boden, eine Pflanze. */
async function zimmerZeichnen(page: Page, farben: [string, string, string]): Promise<string> {
  return page.evaluate(([wand, boden, akzent]) => {
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 640;
    const g = c.getContext('2d')!;
    g.fillStyle = wand!;
    g.fillRect(0, 0, 960, 640);
    g.fillStyle = boden!;
    g.fillRect(0, 470, 960, 170);
    // Fenster mit Himmel und Rahmen.
    const himmel = g.createLinearGradient(0, 90, 0, 400);
    himmel.addColorStop(0, '#bcd7ea');
    himmel.addColorStop(1, '#e8f1f6');
    g.fillStyle = himmel;
    g.fillRect(380, 90, 300, 310);
    g.fillStyle = '#7fa36b';
    g.fillRect(380, 330, 300, 70);
    g.strokeStyle = '#f4f1ea';
    g.lineWidth = 16;
    g.strokeRect(380, 90, 300, 310);
    g.beginPath();
    g.moveTo(530, 90);
    g.lineTo(530, 400);
    g.moveTo(380, 245);
    g.lineTo(680, 245);
    g.stroke();
    // Licht auf dem Boden.
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo(380, 470);
    g.lineTo(680, 470);
    g.lineTo(760, 640);
    g.lineTo(300, 640);
    g.fill();
    // Topf und Pflanze.
    g.fillStyle = akzent!;
    g.fillRect(150, 400, 90, 80);
    g.fillStyle = '#5d7f4f';
    for (const [x, y, r] of [
      [195, 360, 46],
      [160, 330, 34],
      [232, 322, 36],
      [196, 292, 30],
    ] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // Ein Bild an der Wand.
    g.fillStyle = '#f4f1ea';
    g.fillRect(760, 170, 120, 150);
    g.fillStyle = akzent!;
    g.fillRect(776, 186, 88, 118);
    return c.toDataURL('image/jpeg', 0.9);
  }, farben);
}

const FOTO_FARBEN: Record<string, [string, string, string]> = {
  linden: ['#e9dfcf', '#b48a5f', '#c9653f'],
  acht: ['#dfe5e0', '#9c7a58', '#4f6f8f'],
  muster: ['#efe6da', '#c4a27a', '#8a5a7a'],
  inserat: ['#e6e1d6', '#a8835c', '#5f8a6a'],
};

let musterPdf = '';
async function beispielPdf() {
  if (musterPdf) return musterPdf;
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  doc
    .addPage([595, 842])
    .drawText('MUSTER – Testdaten für Hefta', { x: 60, y: 760, size: 18, font: schrift });
  musterPdf = Buffer.from(await doc.save()).toString('base64');
  return musterPdf;
}

/** Haushalt, Unterlagen, Hefte, Fotos und Wünsche direkt in die Datenbank, wie bilder-app.spec.ts. */
async function laden(page: Page) {
  const s = SZENARIEN.find((x) => x.id === '04-fertig')!;
  await page.route('**/__leer', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>leer</title>' }),
  );
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.goto('/__leer');
  const fotos: Record<string, string> = {};
  for (const [id, farben] of Object.entries(FOTO_FARBEN))
    fotos[`foto-${id}`] = await zimmerZeichnen(page, farben);
  await page.evaluate(
    async ({ daten, pdf, hefte, fotos, wuensche }) => {
      const db = await new Promise<IDBDatabase>((ok, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      const haushaltId = (daten as { haushalte: { id: string }[] }).haushalte[0]!.id;
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[])
          tx.objectStore(ort).put(ort === 'haushalte' ? { ...d, wuensche } : d);
      const bytes = Uint8Array.from(atob(pdf), (z) => z.charCodeAt(0));
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: bytes.length,
          daten: new Blob([bytes], { type: 'application/pdf' }),
        });
      for (const [id, adresse] of Object.entries(fotos)) {
        const roh = Uint8Array.from(atob(adresse.split(',')[1]!), (z) => z.charCodeAt(0));
        tx.objectStore('dateien').put({
          id,
          createdAt: new Date().toISOString(),
          typ: 'image/jpeg',
          groesse: roh.length,
          daten: new Blob([roh], { type: 'image/jpeg' }),
        });
      }
      for (const h of hefte as object[]) tx.objectStore('hefte').put({ ...h, haushaltId });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    {
      daten: datensaetze(s),
      pdf: await beispielPdf(),
      hefte: HEFTE,
      fotos,
      wuensche: WUENSCHE,
    },
  );
  return fotos['foto-inserat']!;
}

/** Der Knopf von iOS und die Vorschau aus der App, nachgestellt wie in neues-heft-app.spec.ts. */
async function appNachstellen(page: Page, bild: () => string) {
  await page.exposeFunction('__inseratBild', bild);
  await page.addInitScript(
    ({ url, titel, text }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__heftaInseratTest = {
        knopf: async () => ({ geht: true, sichtbar: false }),
        knopfWeg: async () => {},
        ablage: async () => ({ link: true, inhalt: true }),
        vorschau: async () => ({
          url,
          zustand: 'ok',
          h1: titel,
          titel: 'Wohnungen',
          text,
          bild: await (w.__inseratBild as () => Promise<string>)(),
        }),
        vorschauAbbrechen: async () => {},
        seite: async () => {},
        addListener: async (_e: string, tun: unknown) => {
          w.__einsetzen = tun;
          return { remove: async () => {} };
        },
      };
    },
    { url: INSERAT_URL, titel: INSERAT_TITEL, text: INSERAT_TEXT },
  );
}

async function ruhig(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Der Wechsel zwischen Seiten beginnt erst nach dem nächsten Bild; darum zweimal warten.
  for (let i = 0; i < 2; i++) {
    await page.waitForTimeout(900);
    await animationenFertig(page);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
    );
  }
}

async function heftOeffnen(page: Page, id: string) {
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.locator('main h1').first().waitFor();
  await page.evaluate((h) => (window.location.hash = h), `#/heft/${id}`);
  await page.locator('main h1').first().waitFor();
}

async function bilderMachen(browser: Browser, g: (typeof GROESSEN)[number], dunkel: boolean) {
  const context = await browser.newContext({
    viewport: { width: g.breite, height: g.hoehe },
    deviceScaleFactor: 3,
    colorScheme: dunkel ? 'dark' : 'light',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(HEUTE);
  page.on('pageerror', (e) => console.log(`Fehler: ${e.message}`));
  let inseratBild = '';
  await appNachstellen(page, () => inseratBild);
  inseratBild = await laden(page);
  const ordner = `${ZIEL}/${dunkel ? 'dunkel-zur-pruefung/' : ''}${g.ordner}`;
  mkdirSync(ordner, { recursive: true });
  const bild = async (name: string) => {
    await ruhig(page);
    await page.screenshot({ path: `${ordner}/${name}.jpg`, type: 'jpeg', quality: 92 });
  };

  // 1 Liste „Wohnungen“: drei Wohnungen mit Foto, oben die Karte der Besichtigung.
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await bild('01-wohnungen');

  // 2 Heft: Kopf mit Foto, Stand „Besichtigung morgen, 17:30 Uhr“.
  await heftOeffnen(page, 'linden');
  await bild('02-heft');

  // 3 Neues Heft, Vorschau mit Eckdaten und Abweichungen von den Wünschen.
  await page.goto('/#/wohnungen');
  await page.getByRole('link', { name: 'Wohnung hinzufügen' }).first().click();
  await page.waitForFunction(() => typeof (window as never)['__einsetzen'] === 'function');
  await page.evaluate(
    (url) => (window as never as { __einsetzen: (x: unknown) => void }).__einsetzen({ url }),
    INSERAT_URL,
  );
  await page.getByRole('heading', { level: 1, name: 'Ist das die Wohnung?' }).waitFor();
  await page.getByRole('heading', { level: 2, name: INSERAT_TITEL }).waitFor();
  await page.locator('.punkte li').first().waitFor();
  await bild('03-inserat');

  // 4 Heft: „Zu euren Wünschen“ und die Fragen für die Besichtigung.
  await heftOeffnen(page, 'linden');
  const wuensche = page.getByRole('heading', { name: /^Zu (euren|deinen) Wünschen$/ }).first();
  await wuensche.waitFor();
  await wuensche.evaluate((e) => {
    const oben = e.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: oben, behavior: 'instant' });
  });
  await bild('04-wuensche-fragen');

  // 5 Bewerben mit wenigen Tipps: Anschreiben und Mappe.
  await heftOeffnen(page, 'muster');
  await page.getByRole('link', { name: 'Jetzt bewerben' }).click();
  await page.getByRole('heading', { level: 1, name: 'Bewerben mit wenigen Tipps' }).waitFor();
  await bild('05-bewerben');

  // 6 Tab „Mappe“: Haushalt zu zweit mit Bürgin, alles da.
  await page.goto('/#/');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await bild('06-mappe');

  // 7 Deckblatt im Briefbogen, Lindenring 3.
  await page.evaluate(() => (location.hash = '#/mappe/deckblatt'));
  await page.getByRole('heading', { level: 1, name: 'Deckblatt' }).waitFor();
  await page.getByRole('button', { name: 'Wohnung ändern' }).click();
  const blatt = page.getByRole('dialog', { name: 'Für welche Wohnung?' });
  await blatt.getByRole('textbox').fill('Lindenring 3, EG\n20259 Hamburg');
  await blatt.getByRole('button', { name: 'Übernehmen' }).click();
  await page.locator('.deck-gross img').waitFor();
  await page.waitForTimeout(800);
  await bild('07-deckblatt');

  await context.close();
}

for (const g of GROESSEN)
  for (const dunkel of [false, true])
    test(`Store-Bilder ${g.ordner} ${dunkel ? 'dunkel' : 'hell'}`, async ({
      browser,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'nur Chromium');
      test.setTimeout(300_000);
      await bilderMachen(browser, g, dunkel);
    });

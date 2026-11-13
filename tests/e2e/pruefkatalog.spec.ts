import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { backupErstellen } from '../../src/storage/backup';
import { SCHEMA_VERSION } from '../../src/storage/db';
import { animationenFertig } from './hilfen';
import { pruefen } from './pruef-c';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Prüfkatalog (design/pruefkatalog.md, Stil C): alle Szenarien der Übersicht, der Einrichtung und
// des Rutschs in allen Ansichten, automatische Prüfungen C1 bis C12 (ohne C8, entfällt in Stil C),
// Kontaktbögen für die Sichtprüfung in docs/screenshots/bogen-{U,E,R}-<ansicht>.png.
// Nur Chromium: WebKit unter Windows stellt die variable Schrift falsch dar (Maße wären falsch).

interface Ansicht {
  id: string;
  breite: number;
  hoehe: number;
  /** Textgröße wie Safari „aA“: vergrößert die ganze Darstellung. */
  zoom?: number;
  /** „Größerer Text“ des iPhones: Nur die Schrift wächst, Abstände und Kästen bleiben (--px). */
  schrift?: number;
  /** Nur diese Bildschirme (Teil des Namens). */
  nur?: string[];
  grau?: boolean;
  dunkel?: boolean;
}

const ANSICHTEN: Ansicht[] = [
  { id: '390', breite: 390, hoehe: 844 },
  { id: '320', breite: 320, hoehe: 568 },
  { id: '430', breite: 430, hoehe: 932 },
  { id: '390-text130', breite: 390, hoehe: 844, zoom: 1.3 },
  // B9: der engste Fall, 320 px mit Text 130 % zugleich.
  { id: '320-text130', breite: 320, hoehe: 568, zoom: 1.3 },
  { id: '390-grau', breite: 390, hoehe: 844, grau: true },
  { id: '390-dunkel', breite: 390, hoehe: 844, dunkel: true },
  // Vorschlag des Designs vom 2.11.: sehr große Schrift, zunächst nur auf den drei wichtigsten Seiten.
  {
    id: '390-text200',
    breite: 390,
    hoehe: 844,
    schrift: 2,
    nur: [
      '01-standard',
      'R1-schritt',
      'X1-',
      'H2-heft',
      'H3-heft',
      'H5-heft',
      'H7-termin',
      'H8-bewerben',
    ],
  },
];

/** Höhe der Bildschirmtastatur auf dem iPhone (B8). */
const TASTATUR = 291;

interface Bild {
  id: string;
  gruppe: 'U' | 'E' | 'R' | 'S' | 'P' | 'X' | 'B' | 'Z' | 'D' | 'G' | 'N' | 'H';
  /** Szenario aus szenarien.ts oder null für ein leeres Gerät. */
  szenario: string | null;
  pfad: string;
  vorher?: (page: Page) => Promise<void>;
  /** B8: mit offener Tastatur prüfen (fokussiertes Feld). */
  tastatur?: boolean;
  /** Zustand des Geräts für diesen Bildschirm (siehe `geraetNachstellen`). */
  geraet?: 'kein-speicher' | 'knapp' | 'neue-version';
  /** Hefta 2: Hefte, die mit dem Szenario eingespielt werden (am ersten Haushalt). */
  hefte?: () => object[];
  /** Andere Datei hinter allen Versionen des Szenarios statt der kleinen Beispiel-PDF. */
  pdf?: () => number[];
}

interface RuheStand {
  __arbeit: number;
  __offen: number;
  __mitWorker: boolean;
}

/**
 * Zustände des Geräts, die sich im Testbrowser nicht von selbst ergeben (G1, G3, G5). Hängt an der
 * Adresse, damit es nur für diesen einen Bildschirm gilt; die App selbst weiß davon nichts.
 */
function geraetNachstellen() {
  // Zählt, was noch arbeitet: Nachrichten an den Worker von PDF.js, Bilder, Änderungen der Seite (`ruhe`).
  const stand = window as unknown as RuheStand & { Worker: typeof Worker };
  stand.__arbeit = 0;
  stand.__offen = 0;
  stand.__mitWorker = false;
  const EchterWorker = stand.Worker;
  const senden = EchterWorker.prototype.postMessage as (...werte: unknown[]) => void;
  EchterWorker.prototype.postMessage = function (this: Worker, ...werte: unknown[]) {
    stand.__arbeit++;
    senden.apply(this, werte);
  };
  stand.Worker = class extends EchterWorker {
    constructor(adresse: string | URL, optionen?: WorkerOptions) {
      super(adresse, optionen);
      stand.__mitWorker = true;
      this.addEventListener('message', () => {
        stand.__arbeit++;
      });
    }
  };
  const echtesToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (fertig, typ, qualitaet) {
    stand.__offen++;
    echtesToBlob.call(
      this,
      (blob) => {
        stand.__offen--;
        stand.__arbeit++;
        fertig(blob);
      },
      typ,
      qualitaet,
    );
  };
  new MutationObserver(() => {
    stand.__arbeit++;
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });

  const zustand = new URLSearchParams(window.location.search).get('geraet');
  if (zustand === 'kein-speicher')
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => ({
        open: () => {
          throw new DOMException('Speicher gesperrt', 'UnknownError');
        },
      }),
    });
  if (zustand === 'knapp')
    navigator.storage.estimate = async () => ({ usage: 1_000_000_000, quota: 1_020_000_000 });
  if (zustand === 'neue-version')
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        addEventListener: () => {},
        register: async () => ({
          waiting: { postMessage: () => {} },
          addEventListener: () => {},
          update: async () => {},
        }),
      },
    });
  // Sonst gar kein Service Worker: Der Katalog prüft Bildschirme, nicht das Offline-Laden. Das spart den
  // Zwischenspeicher je Ansicht, und die leere Seite von `laden` kommt wirklich an.
  else if ('serviceWorker' in navigator)
    navigator.serviceWorker.register = () => new Promise<ServiceWorkerRegistration>(() => {});
}

/** Bytes, die sich nicht packen lassen, in festem Ablauf: in allen Ansichten dieselben. */
function rauschenRoh(laenge: number): Uint8Array {
  const aus = new Uint8Array(laenge);
  let x = 1;
  for (let i = 0; i < laenge; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    aus[i] = x >>> 24;
  }
  return aus;
}

/** Wie ein Scan: helles Papier mit leichtem Rauschen, verlustfrei groß, als JPEG sehr klein. */
function papierPng(breite: number, hoehe: number): Uint8Array {
  const block = (art: string, daten: Uint8Array) => {
    const inhalt = Buffer.concat([Buffer.from(art, 'latin1'), daten]);
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const pruefsumme = Buffer.alloc(4);
    pruefsumme.writeUInt32BE(crc32(inhalt));
    return Buffer.concat([laenge, inhalt, pruefsumme]);
  };
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf.set([8, 2, 0, 0, 0], 8);
  const zeilen = Buffer.alloc((breite * 3 + 1) * hoehe);
  let x = 1;
  for (let i = 0; i < zeilen.length; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    zeilen[i] = i % (breite * 3 + 1) === 0 ? 0 : 228 + ((x >>> 24) % 21);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    block('IHDR', kopf),
    block('IDAT', deflateSync(zeilen, { level: 1 })),
    block('IEND', new Uint8Array()),
  ]);
}

/** Groß: entweder reine Textseiten mit einem nicht gezeigten CMYK-Bild, das Mappe nicht tauscht (X6b), oder zwei Scans (X6c). */
async function grossesPdf(mitText: boolean): Promise<number[]> {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  const bild = mitText ? null : await doc.embedPng(papierPng(1000, 1400));
  const cmyk = doc.context.register(
    doc.context.stream(deflateSync(rauschenRoh(500 * 700 * 4)), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 500,
      Height: 700,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceCMYK',
      Filter: 'FlateDecode',
    }),
  );
  for (const n of [1, 2]) {
    const seite = doc.addPage([595, 842]);
    if (mitText) {
      seite.drawText(`Seite ${n}`, { x: 60, y: 700, size: 18, font: schrift });
      // Hängt an der Seite und macht sie groß, wird aber nicht gezeigt: Die Vorschau bleibt Text.
      seite.node.newXObject('Rauschen', cmyk);
    } else seite.drawImage(bild!, { x: 0, y: 0, width: 595, height: 842 });
  }
  return [...(await doc.save())];
}

let pdfPfad = '';
/** Backups für „Backup einspielen“ (S6, S7): ohne und mit Passwort „Sommer in Hamburg“. */
let backupOffen = '';
/** Schwierige Dateien (D2, D5): zwölf Seiten, mit Passwort „geheim“. */
let vielePfad = '';
/** Eine Seite mit erkennbarem Ausstellungsdatum und einem zweiten Datum (D10, D11). */
let datumPfad = '';
/** Große Dateien hinter den Versionen (X6b, X6c). */
let grossText: number[] = [];
let grossScan: number[] = [];
let gesperrtPfad = '';
let backupPasswort = '';
/** Kleine Beispiel-PDF hinter allen Versionen der Szenarien (Datei „keine-datei“). */
let beispielPdf: number[] = [];
/** Warten, bis die Vorschau der Mappe gebaut ist. */
async function vorschau(page: Page) {
  await page
    .getByText(/^\d+ (Seiten?|Dateien?)$/)
    .first()
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(200);
}

// Seit „Mappe teilen“ (B23): Wohnung und Satz ändert man auf der großen Ansicht des Deckblatts.
const zumDeckblatt = async (page: Page) => {
  await page.evaluate(() => (location.hash = '#/mappe/deckblatt'));
  await page.getByRole('heading', { level: 1, name: 'Deckblatt' }).waitFor();
};
const zurueckZurMappe = async (page: Page) => {
  await page.evaluate(() => (location.hash = '#/mappe'));
  await page.getByRole('heading', { level: 1, name: 'Mappe teilen' }).waitFor();
};

const wohnungEintragen = async (page: Page, adresse: string) => {
  await zumDeckblatt(page);
  await page.getByRole('button', { name: 'Wohnung ändern' }).click();
  const blatt = page.getByRole('dialog', { name: 'Für welche Wohnung?' });
  await blatt.getByRole('textbox').fill(adresse);
  await blatt.getByRole('button', { name: 'Übernehmen' }).click();
  await blatt.waitFor({ state: 'hidden' });
  await zurueckZurMappe(page);
};

const satzEintragen = async (page: Page, satz: string) => {
  await zumDeckblatt(page);
  await page.getByRole('button', { name: 'Satz ändern' }).click();
  const blatt = page.getByRole('dialog', { name: /^Ein Satz zu/ });
  await blatt.getByRole('textbox').fill(satz);
  await blatt.getByRole('button', { name: 'Übernehmen' }).click();
  await blatt.waitFor({ state: 'hidden' });
  await zurueckZurMappe(page);
};

/** Hefte für Gruppe H, Zeiten relativ zu HEUTE. */
function katalogHefte(): object[] {
  const tag = (n: number, stunde = 12) => {
    const d = new Date(HEUTE);
    d.setDate(d.getDate() + n);
    d.setHours(stunde, 0, 0, 0);
    return d.toISOString();
  };
  const leer = { beworben: null, gefragtAm: null, termin: null, ergebnis: null };
  const heft = (id: string, adresse: string, ereignisse: object, extra: object = {}) => ({
    id,
    createdAt: tag(-30),
    updatedAt: tag(-1),
    adresse,
    link: null,
    quelle: 'ImmoScout24',
    inseratText: null,
    kennung: `k-${id}`,
    notiz: '',
    angaben: {
      titel: 'Helle Altbauwohnung mit Balkon und Blick ins Grüne',
      stadtteil: 'Eimsbüttel',
      warm: 1240,
      zimmer: 3,
      flaeche: 74,
      portal: 'ImmoScout24',
      anbieter: 'Frau Hansen',
    },
    ereignisse: { ...leer, ...ereignisse },
    ...extra,
  });
  const mappe = {
    am: tag(-25),
    art: 'mappe',
    weg: 'mail',
    an: 'Frau Hansen',
    fassung: 1,
    unterlagen: 4,
    seiten: 9,
    personen: ['Max', 'Lea'],
  };
  return [
    heft(
      'kh-beworben',
      'Lindenallee 3, EG\n20259 Hamburg',
      {
        beworben: { am: tag(-5), weg: 'mail', sicher: true },
      },
      { spur: [{ ...mappe, am: tag(-5) }] },
    ),
    heft(
      'kh-keine',
      'Bismarckstraße 56\n20259 Hamburg',
      {
        beworben: { am: tag(-25), weg: 'mail', sicher: true },
        nachgefasstAm: tag(-2),
      },
      { spur: [mappe, { am: tag(-2), art: 'nachfrage', weg: 'mail', an: 'Frau Hansen' }] },
    ),
    heft(
      'kh-zusage',
      'Kaiser-Friedrich-Ufer 9\n20253 Hamburg',
      {
        beworben: { am: tag(-20), weg: 'portal', sicher: true },
        termin: { am: tag(-6, 17), ort: '', treffpunkt: '' },
        ergebnis: { art: 'absage', am: tag(-1) },
        abgelegtAm: tag(-1),
      },
      { spur: [{ ...mappe, weg: 'portal', an: 'ImmoScout24', ueber: 'WhatsApp' }] },
    ),
    heft('kh-termin', 'Grindelallee 140\n20146 Hamburg', {
      beworben: { am: tag(-8), weg: 'mail', sicher: true },
      termin: { am: tag(2, 18), ort: '', treffpunkt: 'Vor dem Haus' },
    }),
  ];
}

const los = (page: Page) => page.getByRole('button', { name: 'Los geht’s' }).click();

const farbeZeigen = async (page: Page) => {
  // In die Mitte: Am unteren Rand läge die Reihe unter der festen Leiste.
  await page
    .getByRole('radiogroup', { name: /^Farbe/ })
    .evaluate((e) => e.scrollIntoView({ block: 'center' }));
};

const amVorschau = async (page: Page) => {
  await page.getByRole('button', { name: /^Vorschau .* Mappe groß ansehen/ }).waitFor({
    timeout: 30_000,
  });
  await page.waitForTimeout(200);
};

/** Ändert gespeicherte Versionen wie im echten Leben (dieselbe Datei, Gelesenes) und lädt neu. */
async function versionenPatchen(
  page: Page,
  endung: string,
  patch: Record<string, unknown>,
  gleicheDatei = false,
) {
  await page.evaluate(
    async ({ endung, patch, gleicheDatei }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const tx = db.transaction('versionen', 'readwrite');
      const ort = tx.objectStore('versionen');
      const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
        const r = ort.getAll();
        r.onsuccess = () => ok(r.result);
      });
      const treffer = alle.filter((x) => x.dokumentId.endsWith(endung));
      for (const v of treffer)
        ort.put({ ...v, ...patch, ...(gleicheDatei ? { original: treffer[0]!.original } : {}) });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { endung, patch, gleicheDatei },
  );
  await page.reload();
}

const FAKTEN = (seite: Record<string, unknown>) => ({
  erkannteWerte: {
    stand: 1,
    hash: null,
    seiten: [{ monat: null, von: null, leer: false, textHash: null, woerter: [], ...seite }],
  },
  eigene: [0],
  seiten: [0],
});

const BILDER: Bild[] = [
  // „Nachricht ans Inserat“ (Gruppe N) ist seit 13.11. entfernt: Das macht „Bewerben“ im Heft.
  {
    id: 'ME11-deckblatt-gross',
    gruppe: 'X',
    szenario: '01-standard',
    pfad: '/mappe/deckblatt',
    // Das Bild, nicht die Ladeanzeige: Sonst prüft der Katalog „Mappe wird erstellt …“.
    vorher: async (page) => {
      await page.getByRole('img', { name: /^Deckblatt der Mappe/ }).waitFor({ timeout: 60_000 });
    },
  },
  {
    id: 'A6-uebertragen',
    gruppe: 'N',
    szenario: '01-standard',
    pfad: '/selbstauskunft/p-01-standard-0/uebertragen',
  },
  ...SZENARIEN.map((s): Bild => ({ id: s.id, gruppe: 'U', szenario: s.id, pfad: '/' })),
  { id: 'E1-werbistdu', gruppe: 'E', szenario: null, pfad: '/einrichtung', tastatur: true },
  {
    id: 'E1b-details',
    gruppe: 'E',
    szenario: null,
    pfad: '/einrichtung',
    vorher: async (page) => {
      await page.getByLabel('Vorname').fill('Max');
      await page.getByLabel('Nachname').fill('Mustermann');
      await page.getByRole('radio', { name: 'Hauptmieter', exact: true }).click();
    },
  },
  { id: 'E2-H1', gruppe: 'E', szenario: '11-allein', pfad: '/einrichtung/2' },
  {
    id: 'E2-H1-mitmieter',
    gruppe: 'E',
    szenario: '11-allein',
    pfad: '/person-neu/mitmieter/einrichtung',
    tastatur: true,
  },
  { id: 'E2-H4', gruppe: 'E', szenario: '01-standard', pfad: '/einrichtung/2' },
  {
    id: 'E2-H4-buerge',
    gruppe: 'E',
    szenario: '01-standard',
    pfad: '/person-neu/buerge/einrichtung',
    tastatur: true,
  },
  { id: 'E2-H5', gruppe: 'E', szenario: '06-drei-erwachsene', pfad: '/einrichtung/2' },
  { id: 'E2-H7', gruppe: 'E', szenario: '08-zwei-buergen', pfad: '/einrichtung/2' },
  { id: 'E3-bearbeiten-H4', gruppe: 'E', szenario: '01-standard', pfad: '/haushalt' },
  {
    id: 'E3-bearbeiten-lea',
    gruppe: 'E',
    szenario: '01-standard',
    pfad: '/person-aendern/p-01-standard-1',
  },
  { id: 'E3-lange-namen', gruppe: 'E', szenario: '10-lange-namen', pfad: '/haushalt' },
  { id: 'E3d-herausgenommen', gruppe: 'E', szenario: '15-herausgenommen', pfad: '/haushalt' },
  {
    id: 'K1-schon-in-mappe',
    gruppe: 'E',
    szenario: '15-herausgenommen',
    pfad: '/person-neu/mitmieter',
  },
  {
    id: 'K8-name-lateinisch',
    gruppe: 'E',
    szenario: '01-standard',
    pfad: '/person-neu/mitmieter',
    vorher: async (page) => {
      await page.getByLabel('Vorname', { exact: true }).fill('Олена');
      await page.getByLabel('Nachname', { exact: true }).fill('Коваленко');
      await page.getByRole('radio', { name: 'Mitmieterin' }).click();
    },
  },
  {
    id: 'K8b-name-lateinisch-ausgefuellt',
    gruppe: 'E',
    szenario: '01-standard',
    pfad: '/person-neu/mitmieter',
    vorher: async (page) => {
      await page.getByLabel('Vorname', { exact: true }).fill('Олена');
      await page.getByLabel('Nachname', { exact: true }).fill('Коваленко');
      await page.getByRole('radio', { name: 'Mitmieterin' }).click();
      await page.getByLabel('Vorname in der Mappe').fill('Olena');
      await page.getByLabel('Nachname in der Mappe').fill('Kovalenko');
    },
  },
  {
    id: 'K8c-mappe-wartet-auf-namen',
    gruppe: 'E',
    szenario: '24-name-ohne-latein',
    pfad: '/mappe',
  },
  {
    id: 'K1b-name-erkannt',
    gruppe: 'E',
    szenario: '15-herausgenommen',
    pfad: '/person-neu/mitmieter',
    vorher: async (page) => {
      await page.getByRole('button', { name: /Neue Person anlegen/ }).click();
      await page.getByLabel('Vorname').fill('Jonas');
      await page.getByLabel('Nachname').fill('Becker');
      await page.getByRole('status').waitFor();
    },
  },
  {
    id: 'K2-bekannte-person',
    gruppe: 'E',
    szenario: '15-herausgenommen',
    pfad: '/person-neu/mitmieter',
    vorher: async (page) => {
      await page.getByRole('button', { name: /Jonas Becker/ }).click();
      await page.getByRole('heading', { level: 1, name: 'Jonas kommt dazu' }).waitFor();
    },
  },
  {
    id: 'K3b-person-seite',
    gruppe: 'E',
    szenario: '15-herausgenommen',
    pfad: '/person-aendern/p-15-herausgenommen-2',
  },
  {
    id: 'PF1-farbe-person',
    gruppe: 'E',
    szenario: '01-standard',
    pfad: '/person-aendern/p-01-standard-2',
    vorher: farbeZeigen,
  },
  {
    id: 'PF1b-farbe-vergeben',
    gruppe: 'E',
    szenario: '01-standard',
    pfad: '/person-aendern/p-01-standard-2',
    vorher: async (page) => {
      await farbeZeigen(page);
      await page.getByRole('radio', { name: 'Apricot, hat Max' }).click();
      await page.getByText(/^Max bekommt dafür/).waitFor();
    },
  },
  {
    id: 'PF1c-alle-vergeben',
    gruppe: 'E',
    szenario: '27-sechs-personen',
    pfad: '/person-aendern/p-27-sechs-personen-3',
    vorher: farbeZeigen,
  },
  {
    id: 'K4b-ganz-loeschen',
    gruppe: 'E',
    szenario: '15-herausgenommen',
    pfad: '/person-loeschen/p-15-herausgenommen-3',
  },
  { id: 'R0-start-S6', gruppe: 'R', szenario: '02-neustart', pfad: '/rutsch' },
  {
    id: 'R1-selbstauskunft-S6',
    gruppe: 'R',
    szenario: '02-neustart',
    pfad: '/rutsch',
    vorher: los,
    tastatur: true,
  },
  { id: 'A2-rutsch-lea', gruppe: 'R', szenario: '16-auskunft-lea', pfad: '/rutsch', vorher: los },
  {
    id: 'A3-rutsch-buergin',
    gruppe: 'R',
    szenario: '05-nur-buerge-offen',
    pfad: '/rutsch',
    vorher: los,
  },
  {
    id: 'R1-schritt-fehlt',
    gruppe: 'R',
    szenario: '03-mehrere-offen',
    pfad: '/rutsch',
    vorher: los,
  },
  { id: 'R1-schritt-laeuftab', gruppe: 'R', szenario: '01-standard', pfad: '/rutsch', vorher: los },
  {
    // R4/T3: langer Unterlagen-Name (Abgleich Design 31.10.); Lea ist in Ausbildung.
    id: 'R1-lange-unterlage',
    gruppe: 'R',
    szenario: '09-lebenslagen',
    pfad: '/rutsch',
    vorher: async (page) => {
      await los(page);
      const titel = page.getByRole('heading', { level: 1 });
      const zaehler = page.getByText(/^\d+ von \d+$/);
      while (!/BAföG/.test(await titel.innerText())) {
        const vorher = await zaehler.innerText();
        await page.getByRole('button', { name: /^(Überspringen|Noch nicht da)$/ }).click();
        await expect(zaehler.filter({ hasNotText: vorher })).toBeVisible();
      }
    },
  },
  {
    id: 'R1-langer-name',
    gruppe: 'R',
    szenario: '10-lange-namen',
    pfad: '/rutsch',
    vorher: los,
  },
  {
    id: 'R2-gewaehlt',
    gruppe: 'R',
    szenario: '03-mehrere-offen',
    pfad: '/rutsch',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(pdfPfad);
      await page.getByText('abrechnung_oktober.pdf, 2 Seiten').waitFor();
    },
  },
  {
    id: 'R3b-ende-alle-uebersprungen',
    gruppe: 'R',
    szenario: '02-neustart',
    pfad: '/rutsch',
    vorher: async (page) => {
      await los(page);
      const ende = page.getByRole('heading', {
        level: 1,
        name: /Gut gemacht\.|Dann eben später\./,
      });
      const zaehler = page.getByText(/^\d+ von \d+$/);
      while (!(await ende.isVisible())) {
        const vorher = await zaehler.innerText();
        await page.getByRole('button', { name: /^(Überspringen|Noch nicht da)$/ }).click();
        await expect(ende.or(zaehler.filter({ hasNotText: vorher }))).toBeVisible();
      }
    },
  },
  { id: 'A5-selbstauskuenfte', gruppe: 'S', szenario: '01-standard', pfad: '/selbstauskuenfte' },
  {
    id: 'S-selbstauskunft-leer',
    gruppe: 'S',
    szenario: '02-neustart',
    pfad: '/selbstauskunft/p-02-neustart-0',
  },
  {
    // Teil „Kontakt“ aufgeklappt, Tastatur offen (B8).
    id: 'S-kontakt-tastatur',
    gruppe: 'S',
    szenario: '02-neustart',
    pfad: '/selbstauskunft/p-02-neustart-0',
    tastatur: true,
    vorher: async (page) => {
      await page.getByRole('button', { name: /^Kontakt/ }).click();
      await page.getByLabel('Telefon').focus();
    },
  },
  {
    id: 'A1c-offen-fragen',
    gruppe: 'S',
    szenario: '02-neustart',
    pfad: '/selbstauskunft/p-02-neustart-0',
    vorher: async (page) => {
      await page.getByRole('button', { name: /^Fragen, die Vermieter/ }).click();
    },
  },
  {
    id: 'S-selbstauskunft-lea',
    gruppe: 'S',
    szenario: '01-standard',
    pfad: '/selbstauskunft/p-01-standard-1',
  },
  {
    id: 'S-selbstauskunft-buergin',
    gruppe: 'S',
    szenario: '01-standard',
    pfad: '/selbstauskunft/p-01-standard-2',
  },
  {
    id: 'S-selbstauskunft-amt',
    gruppe: 'S',
    szenario: '09-lebenslagen',
    pfad: '/selbstauskunft/p-09-lebenslagen-2',
  },
  {
    id: 'S-selbstauskunft-lang',
    gruppe: 'S',
    szenario: '10-lange-namen',
    pfad: '/selbstauskunft/p-10-lange-namen-2',
  },
  // „Mappe erstellen“ (design/mappe-erstellen-neu.md): ME2 ist X1, ME4 X2, ME5 X9, ME6 X7, ME7 X12,
  // ME3 PH5 und X6c, ME10 X6d. Eigene Bögen brauchen nur die Fälle, die es sonst nicht gibt.
  { id: 'X1-markt', gruppe: 'X', szenario: '04-fertig', pfad: '/mappe', vorher: vorschau },
  {
    id: 'ME1-standard',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    vorher: async (page) => {
      await wohnungEintragen(page, 'Hauptstraße 12, 3. OG links\n22767 Hamburg');
      await satzEintragen(
        page,
        'Wir sind ein ruhiges Paar mit einem Kind und suchen ab Januar 2027 eine Wohnung für die nächsten Jahre. Alle Unterlagen liegen bei.',
      );
      await vorschau(page);
    },
  },
  {
    id: 'ME8-allein',
    gruppe: 'X',
    szenario: '11-allein',
    pfad: '/mappe',
    vorher: async (page) => {
      await wohnungEintragen(page, 'Hauptstraße 12, 3. OG links\n22767 Hamburg');
      await vorschau(page);
    },
  },
  {
    id: 'ME9-lange-namen',
    gruppe: 'X',
    szenario: '10-lange-namen',
    pfad: '/mappe',
    vorher: async (page) => {
      await wohnungEintragen(
        page,
        'Große Bergstraße 152, Hinterhaus, 4. OG rechts\n22767 Hamburg-Altona',
      );
      await vorschau(page);
    },
  },
  {
    id: 'X2-eigene-miet',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    vorher: async (page) => {
      // E49: Statt „Datensparsam“ die Eigene Auswahl mit dem Schalter für Mietrückstände.
      await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
      await page.getByRole('switch', { name: /^Mietrückstände erst nach der Zusage/ }).click();
      await vorschau(page);
    },
  },
  {
    id: 'X4-ohne-buerge',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    vorher: async (page) => {
      await page.getByRole('checkbox', { name: /Petra/ }).click();
      await vorschau(page);
    },
  },
  { id: 'X5-offen', gruppe: 'X', szenario: '01-standard', pfad: '/mappe', vorher: vorschau },
  {
    id: 'X9-eigene-auswahl',
    gruppe: 'X',
    szenario: '01-standard',
    pfad: '/mappe',
    vorher: async (page) => {
      await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
      await vorschau(page);
    },
  },
  {
    id: 'AM1-schlicht',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      // Der Standard ist seit dem 4.11. „Farben der Personen“: Hier ausdrücklich „Schlicht“.
      await amVorschau(page);
      await page.getByRole('radio', { name: /^Schlicht/ }).click();
      await amVorschau(page);
    },
  },
  // Bitte zum Löschen (design/bitte-zum-loeschen.md).
  {
    id: 'AM4a-bitte-aus',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: amVorschau,
  },
  {
    id: 'AM4b-bitte-an',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page.getByRole('switch', { name: 'Bitte, die Unterlagen zu löschen' }).click();
      await page.getByRole('link', { name: 'Satz ändern' }).waitFor();
    },
  },
  {
    id: 'AM4c-bitte-satz',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen/bitte',
    vorher: async (page) => {
      await page
        .getByRole('textbox', { name: 'Bitte an den Vermieter' })
        .fill(
          'Falls die Wohnung an jemand anderen geht, löschen Sie unsere Unterlagen bitte nach vier Wochen. Danke!',
        );
      await page.getByRole('button', { name: 'Vorschlag wieder einsetzen' }).waitFor();
    },
  },
  {
    id: 'AM4d-ohne-deckblatt',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page.getByRole('switch', { name: 'Deckblatt' }).click();
      await page.getByText('Nur mit Deckblatt').waitFor();
    },
  },
  {
    id: 'AM2-eine-farbe',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page.getByRole('radio', { name: /^Eine Farbe/ }).click();
      await page.getByRole('radio', { name: 'Tanne' }).waitFor();
    },
  },
  {
    id: 'AM3-personen',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page.getByRole('radio', { name: /^Farben der Personen/ }).click();
      await page.getByText(/^Ein kleines Quadrat vor dem Namen/).waitFor();
    },
  },
  {
    id: 'AM5c-flaeche',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page
        .getByRole('radiogroup', { name: 'Fläche hinter „Wer einzieht“' })
        .getByRole('radio', { name: 'Keine' })
        .click();
    },
  },
  {
    id: 'AM-aus',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page.getByRole('switch', { name: 'Deckblatt' }).click();
      await page.getByRole('switch', { name: 'Kopf- und Fußzeile' }).click();
      await page.getByText('Kopfzeile ist aus. So sähe sie aus.').waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    id: 'AM-beispiel',
    gruppe: 'X',
    szenario: '02-neustart',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await amVorschau(page);
      await page.getByText(/^Beispiel\. Mit/).waitFor();
    },
  },
  {
    id: 'X11-fremde-zeichen',
    gruppe: 'X',
    szenario: '26-fremde-zeichen',
    pfad: '/mappe',
    vorher: async (page) => {
      await page.getByText(/solltest du vorher ansehen/).waitFor({ timeout: 30_000 });
      await vorschau(page);
    },
  },
  {
    id: 'X12-datei-nicht-lesbar',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/',
    vorher: async (page) => {
      // Die Datei der Bonität von Max ist weg, alle anderen sind da.
      await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((ok) => {
          const r = indexedDB.open('hefta');
          r.onsuccess = () => ok(r.result);
        });
        const tx = db.transaction('versionen', 'readwrite');
        const ort = tx.objectStore('versionen');
        const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
          const r = ort.getAll();
          r.onsuccess = () => ok(r.result);
        });
        for (const v of alle.filter((x) => x.dokumentId.endsWith('-0-bonitaet')))
          ort.put({ ...v, original: 'gibt-es-nicht' });
        await new Promise((ok) => (tx.oncomplete = ok));
        db.close();
        location.hash = '#/mappe';
        location.reload();
      });
      await expect(page.getByText(/(Datei fehlt|Dateien fehlen) in der Mappe/)).toBeVisible({
        timeout: 30_000,
      });
    },
  },
  {
    id: 'X6b-zu-gross-text',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    pdf: () => grossText,
    vorher: async (page) => {
      await vorschau(page);
      await page.getByText(/Die Seiten sind schon so klein/).waitFor({ timeout: 60_000 });
    },
  },
  {
    id: 'X6c-zu-gross-scans',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    pdf: () => grossScan,
    vorher: async (page) => {
      await vorschau(page);
      await page.getByText(/Verkleinert wären es etwa/).waitFor({ timeout: 60_000 });
    },
  },
  {
    id: 'X6d-verkleinert',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    pdf: () => grossScan,
    vorher: async (page) => {
      await vorschau(page);
      await page
        .getByRole('button', { name: 'Scans und Bilder verkleinern' })
        .click({ timeout: 60_000 });
      await page
        .getByRole('button', { name: 'Originale wiederherstellen' })
        .waitFor({ timeout: 60_000 });
      // Der Knopf steht schon, während es noch läuft: warten, bis das Ergebnis dasteht.
      await page.getByText('verkleinert', { exact: true }).waitFor({ timeout: 90_000 });
      await vorschau(page);
    },
  },
  {
    id: 'X7-einzeln',
    gruppe: 'X',
    szenario: '10-lange-namen',
    pfad: '/mappe/anpassen',
    vorher: async (page) => {
      await page.getByRole('radio', { name: 'Einzeldateien' }).click();
      await page.getByRole('button', { name: 'Fertig' }).click();
      await vorschau(page);
    },
  },
  { id: 'P-person-max', gruppe: 'P', szenario: '01-standard', pfad: '/person/p-01-standard-0' },
  { id: 'P-person-petra', gruppe: 'P', szenario: '01-standard', pfad: '/person/p-01-standard-2' },
  {
    id: 'P-person-neustart',
    gruppe: 'P',
    szenario: '02-neustart',
    pfad: '/person/p-02-neustart-0',
  },
  {
    id: 'P-person-lang',
    gruppe: 'P',
    szenario: '10-lange-namen',
    pfad: '/person/p-10-lange-namen-0',
  },
  { id: 'S1-einstellungen', gruppe: 'B', szenario: '01-standard', pfad: '/einstellungen' },
  {
    id: 'S1b-rechtliches',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen/rechtliches',
  },
  { id: 'S2-backup-alt', gruppe: 'B', szenario: '17-backup-alt', pfad: '/einstellungen' },
  {
    id: 'S3-backup',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen/backup',
    tastatur: true,
  },
  {
    id: 'S4-ungleich',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen/backup',
    vorher: async (page) => {
      await page.getByLabel('Passwort', { exact: true }).fill('Sommer in Hamburg');
      await page.getByLabel('Noch einmal').fill('Sommer in Hambur');
      await page.getByLabel('Noch einmal').blur();
      await page.getByText('Die beiden Passwörter sind nicht gleich.').waitFor();
    },
  },
  {
    id: 'S5-ohne',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen/backup',
    vorher: (page) => page.getByRole('radio', { name: /^Ohne Passwort/ }).click(),
  },
  {
    id: 'S6-einspielen',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen',
    vorher: async (page) => {
      await page.locator('input[type=file]').setInputFiles(backupOffen);
      await page.getByText(/^Erstellt am/).waitFor();
    },
  },
  {
    id: 'S7-falsch',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen',
    vorher: async (page) => {
      await page.locator('input[type=file]').setInputFiles(backupPasswort);
      await page.getByLabel('Passwort des Backups').fill('sommer in hamburg');
      await page.getByLabel('Passwort des Backups').press('Enter');
      await page.getByText(/Das Passwort passt nicht/).waitFor();
    },
  },
  {
    id: 'S3b-backup-fertig',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen/backup',
    vorher: async (page) => {
      // Der Tipp ist zu lange her: Das Teilen-Blatt lehnt ab, ein zweiter Tipp ist nötig.
      await page.evaluate(() => {
        navigator.canShare = () => true;
        navigator.share = () => Promise.reject(new DOMException('zu spät', 'NotAllowedError'));
      });
      await page.getByLabel('Passwort', { exact: true }).fill('Sommer in Hamburg');
      await page.getByLabel('Noch einmal').fill('Sommer in Hamburg');
      await page.getByRole('button', { name: 'Backup sichern' }).click();
      await page.getByText(/^Das Verschlüsseln hat etwas gedauert/).waitFor({ timeout: 30_000 });
    },
  },
  { id: 'S9-loeschen', gruppe: 'B', szenario: '17-backup-alt', pfad: '/einstellungen/loeschen' },
  {
    id: 'S9b-loeschen-ohne-backup',
    gruppe: 'B',
    szenario: '01-standard',
    pfad: '/einstellungen/loeschen',
    vorher: async (page) => {
      await page.evaluate(
        () =>
          new Promise((ok) => {
            const r = indexedDB.open('hefta');
            r.onsuccess = () => {
              const tx = r.result.transaction('einstellungen', 'readwrite');
              const ort = tx.objectStore('einstellungen');
              const g = ort.get('app');
              g.onsuccess = () => ort.put({ ...g.result, letztesBackup: null });
              tx.oncomplete = () => ok(null);
            };
          }),
      );
      await page.reload();
      await page.getByText(/^Noch kein Backup/).waitFor();
    },
  },
  {
    id: 'G1-speicher-nicht-erreichbar',
    gruppe: 'G',
    szenario: null,
    pfad: '/',
    geraet: 'kein-speicher',
  },
  {
    id: 'G2-fehler-hinweis',
    gruppe: 'G',
    szenario: '01-standard',
    pfad: '/',
    vorher: async (page) => {
      await page.evaluate(() => {
        void Promise.reject(new Error('Prüfkatalog'));
      });
      await page.getByText('Das hat nicht geklappt.').waitFor();
    },
  },
  {
    id: 'G3-neue-version',
    gruppe: 'G',
    szenario: '01-standard',
    pfad: '/',
    geraet: 'neue-version',
  },
  { id: 'G4-erster-start', gruppe: 'G', szenario: null, pfad: '/' },
  { id: 'G4b-homescreen', gruppe: 'G', szenario: null, pfad: '/homescreen/einrichtung' },
  { id: 'G5-speicher-knapp', gruppe: 'G', szenario: '01-standard', pfad: '/', geraet: 'knapp' },
  // Hefta 2 (Zeile 11): Wohnungen und Heft in ihren Ständen, Löschbitte, Termin.
  {
    id: 'H1-wohnungen',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/wohnungen',
    hefte: katalogHefte,
  },
  {
    id: 'H2-heft-beworben',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/heft/kh-beworben',
    hefte: katalogHefte,
  },
  {
    id: 'H3-heft-keine',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/heft/kh-keine',
    hefte: katalogHefte,
  },
  {
    id: 'H4-heft-abgelegt',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/heft/kh-zusage',
    hefte: katalogHefte,
  },
  {
    id: 'H5-heft-termin',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/heft/kh-termin',
    hefte: katalogHefte,
  },
  {
    id: 'H6-loeschbitte',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/heft/kh-keine/loeschbitte',
    hefte: katalogHefte,
  },
  {
    id: 'H7-termin-eintragen',
    gruppe: 'H',
    szenario: '01-standard',
    pfad: '/heft/kh-beworben/termin',
    hefte: katalogHefte,
  },
  {
    id: 'H8-bewerben',
    gruppe: 'H',
    szenario: '04-fertig',
    pfad: '/heft/kh-beworben/bewerben',
    hefte: katalogHefte,
  },
  { id: 'Z1-uebersicht', gruppe: 'Z', szenario: '18-zeit', pfad: '/' },
  {
    id: 'Z2-rutsch-zu-alt',
    gruppe: 'Z',
    szenario: '18-zeit',
    pfad: '/rutsch/p-18-zeit-2',
    vorher: los,
  },
  {
    id: 'Z3-noch-nicht-zweimal',
    gruppe: 'Z',
    szenario: '18-zeit',
    pfad: '/rutsch/p-18-zeit-1',
    vorher: los,
  },
  {
    id: 'Z4-ende-neu-faellig',
    gruppe: 'Z',
    szenario: '19-neu-faellig',
    pfad: '/rutsch',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Überspringen' }).click();
      await page.getByText('Seit dem Start neu dazugekommen').waitFor();
    },
  },
  { id: 'Z5-export-zu-alt', gruppe: 'Z', szenario: '18-zeit', pfad: '/mappe', vorher: vorschau },
  { id: 'E3d-drei-monate', gruppe: 'D', szenario: '20-lange-raus', pfad: '/haushalt' },
  {
    id: 'D2-viele-seiten',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(vielePfad);
      await page.getByText(/^Zwölf Seiten machen/).waitFor();
    },
  },
  {
    id: 'D3-seiten-auswaehlen',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(vielePfad);
      await page.getByRole('button', { name: 'Seiten auswählen' }).click();
      for (const n of [1, 2, 5])
        await page.getByRole('checkbox', { name: `Seite ${n} kommt in die Mappe` }).click();
      await page.getByText('3 von 12 Seiten kommen in die Mappe').waitFor();
    },
  },
  {
    id: 'D3b-seiten-leer',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(vielePfad);
      await page.getByRole('button', { name: 'Seiten auswählen' }).click();
      await page.getByText('Tipp die Seiten an, die der Vermieter sehen soll.').waitFor();
    },
  },
  {
    id: 'D5-passwort-falsch',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(gesperrtPfad);
      await page.getByLabel('Passwort der Datei').fill('Geheim');
      await page.getByRole('button', { name: 'Entsperren' }).click();
      await page.getByText(/Das Passwort passt nicht/).waitFor();
    },
  },
  {
    id: 'D6-datum-fehlt',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(pdfPfad);
      await page.locator('[data-feld="datum"]').waitFor();
    },
  },
  {
    id: 'D9-seite-gross',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(pdfPfad);
      await page.getByRole('button', { name: 'Seite 1 ansehen' }).click();
      await page.getByRole('img', { name: 'Seite 1' }).waitFor();
    },
  },
  {
    id: 'D10-datum-erkannt',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(datumPfad);
      await page.getByText(/^Im Dokument gefunden/).waitFor();
    },
  },
  {
    id: 'D11c-kein-datum',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles({
        name: 'scan_bonitaet.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(grossScan),
      });
      await page.getByRole('button', { name: 'Auf der Seite nachsehen' }).click();
      await page.getByRole('heading', { name: 'Kein Datum gefunden.' }).waitFor();
      await page.getByRole('img', { name: 'Seite 1' }).waitFor();
    },
  },
  {
    id: 'D11b-datum-auswaehlen',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(datumPfad);
      await page.getByRole('button', { name: 'Im Dokument auswählen' }).click();
      await page.getByRole('radio', { name: /^20\.10\.2026/ }).waitFor();
      await page.getByRole('img', { name: 'Seite 1' }).waitFor();
    },
  },
  {
    id: 'R3e-schon-da-rest-offen',
    gruppe: 'R',
    szenario: '22-alles-schon-da',
    pfad: '/rutsch',
    vorher: async (page) => {
      await page.getByRole('heading', { name: 'Hier war schon alles da.' }).waitFor();
    },
  },
  {
    id: 'A6-teil-nach-ja',
    gruppe: 'R',
    szenario: '02-neustart',
    pfad: '/rutsch/p-02-neustart-0',
    vorher: async (page) => {
      await los(page);
      await page.getByRole('button', { name: /^Fragen, die Vermieter/ }).click();
      for (const [frage, wert] of [
        ['Insolvenz', 'Nein'],
        ['Räumungstitel', 'Ja'],
      ] as const)
        await page
          .getByRole('radiogroup', { name: new RegExp(frage) })
          .getByRole('radio', { name: wert })
          .click();
      await page.getByRole('button', { name: /^Weiter: / }).waitFor();
    },
  },
  {
    id: 'UL1-bonitaet',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Seite 1 groß ansehen' }).waitFor();
    },
  },
  {
    id: 'UL2-gehalt-serie',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis',
  },
  {
    id: 'OR8-ohne-datum',
    gruppe: 'P',
    szenario: '23-ohne-datum',
    pfad: '/unterlage/p-23-ohne-datum-0/bonitaet',
  },
  {
    id: 'OR9b-datum-eintragen',
    gruppe: 'P',
    szenario: '23-ohne-datum',
    pfad: '/unterlage/p-23-ohne-datum-0/bonitaet/datum',
    tastatur: true,
  },
  {
    id: 'OR9-datum-aendern',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet/datum',
  },
  {
    id: 'UL4-aeltere-version',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('link', { name: /Version vom 12\.\sJuli/ }).click();
      await page.getByRole('button', { name: 'Seite 1 groß ansehen' }).waitFor();
    },
  },
  {
    id: 'OR1-dieselbe-datei',
    gruppe: 'P',
    szenario: '04-fertig',
    pfad: '/unterlage/p-04-fertig-0/gehaltsnachweis',
    vorher: async (page: Page) => {
      await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((ok) => {
          const r = indexedDB.open('hefta');
          r.onsuccess = () => ok(r.result);
        });
        const tx = db.transaction('versionen', 'readwrite');
        const ort = tx.objectStore('versionen');
        const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
          const r = ort.getAll();
          r.onsuccess = () => ok(r.result);
        });
        const serie = alle.filter((x) => x.dokumentId.endsWith('-0-gehaltsnachweis'));
        for (const v of serie) ort.put({ ...v, original: serie[0]!.original });
        await new Promise((ok) => (tx.oncomplete = ok));
        db.close();
        location.reload();
      });
      await page.getByRole('link', { name: 'Seiten aufteilen' }).waitFor();
    },
  },
  {
    id: 'OR2-aufteilen',
    gruppe: 'P',
    szenario: '04-fertig',
    pfad: '/unterlage/p-04-fertig-0/gehaltsnachweis',
    vorher: async (page: Page) => {
      await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((ok) => {
          const r = indexedDB.open('hefta');
          r.onsuccess = () => ok(r.result);
        });
        const tx = db.transaction('versionen', 'readwrite');
        const ort = tx.objectStore('versionen');
        const alle = await new Promise<{ dokumentId: string; original: string }[]>((ok) => {
          const r = ort.getAll();
          r.onsuccess = () => ok(r.result);
        });
        const serie = alle.filter((x) => x.dokumentId.endsWith('-0-gehaltsnachweis'));
        for (const v of serie) ort.put({ ...v, original: serie[0]!.original });
        await new Promise((ok) => (tx.oncomplete = ok));
        db.close();
        location.reload();
      });
      await page.getByRole('link', { name: 'Seiten aufteilen' }).click();
      await page.getByRole('combobox').first().waitFor();
    },
  },
  {
    id: 'OR4-seiten-bearbeiten',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
      await page.getByRole('button', { name: 'Seite 2 groß ansehen' }).locator('img').waitFor();
    },
  },
  {
    id: 'OR5-seite-aktionen',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
      await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^Verschieben/ })
        .waitFor();
    },
  },
  {
    id: 'OR6-wohin',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('link', { name: 'Seiten bearbeiten' }).click();
      await page.getByRole('button', { name: 'Was mit Seite 2 geschehen soll' }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^Verschieben/ })
        .click();
      await page.getByRole('heading', { name: 'Wohin mit Seite 2?' }).waitFor();
    },
  },
  {
    id: 'OR7c-bearbeiten',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Bearbeiten' }).click();
      await page.getByRole('button', { name: 'Fertig' }).waitFor();
    },
  },
  {
    id: 'Z-pruefcode-laeuft',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await versionenPatchen(page, '-0-bonitaet', {
        ...FAKTEN({ woerter: ['pruefcode'] }),
        ausstellungsdatum: '2026-09-10',
      });
      await page.getByText(/^Der Prüfcode läuft am/).waitFor();
    },
  },
  {
    id: 'Z-pruefcode-abgelaufen',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await versionenPatchen(page, '-0-bonitaet', {
        ...FAKTEN({ woerter: ['pruefcode'] }),
        ausstellungsdatum: '2026-08-28',
      });
      await page.getByText(/Prüfcode abgelaufen, kommt in die Mappe\.$/).waitFor();
    },
  },
  {
    id: 'PH1-uebersicht-pruefen',
    gruppe: 'U',
    szenario: '01-standard',
    pfad: '/',
    vorher: async (page) => {
      await versionenPatchen(page, '-0-gehaltsnachweis', {}, true);
      await page.getByRole('link', { name: /prüfen ?: Dieselbe Datei/ }).waitFor();
    },
  },
  {
    id: 'PH2-monat-passt-nicht',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/mietzahlung',
    vorher: async (page) => {
      await versionenPatchen(page, '-0-gehaltsnachweis', FAKTEN({ monat: '2025-03' }));
      await page.evaluate(
        () => (location.hash = '#/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis'),
      );
      await page.getByRole('group', { name: 'Bitte prüfen' }).waitFor();
    },
  },
  {
    id: 'PH3-name-andere-person',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await versionenPatchen(page, '-0-bonitaet', FAKTEN({ woerter: ['lea', 'mustermann'] }));
      await page.getByRole('group', { name: 'Bitte prüfen' }).waitFor();
    },
  },
  {
    id: 'PH4-rutsch-seite-fehlt',
    gruppe: 'R',
    szenario: '03-mehrere-offen',
    pfad: '/rutsch',
    vorher: async (page) => {
      await los(page);
      const doc = await PDFDocument.create();
      const schrift = await doc.embedFont(StandardFonts.Helvetica);
      doc.addPage([595, 842]).drawText('Seite 1 von 2', { x: 60, y: 700, size: 12, font: schrift });
      await page.locator('[data-feld="pdf"]').setInputFiles({
        name: 'abrechnung_oktober.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(await doc.save()),
      });
      await page.getByRole('group', { name: 'Bitte prüfen' }).waitFor({ timeout: 30_000 });
    },
  },
  {
    id: 'PH5-mappe-vorher-ansehen',
    gruppe: 'X',
    szenario: '25-unterlage-seiten',
    pfad: '/mappe',
    vorher: async (page) => {
      await versionenPatchen(page, '-0-bonitaet', FAKTEN({ woerter: ['lea', 'mustermann'] }));
      await page.getByText(/solltest du vorher ansehen/).waitFor({ timeout: 30_000 });
      await vorschau(page);
    },
  },
  {
    id: 'OR7b-rueckgaengig',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('link', { name: /Version vom 12\.\sJuli/ }).click();
      await page.getByRole('button', { name: 'Diese Version löschen' }).click();
      await page.getByRole('button', { name: 'Rückgängig' }).waitFor();
      await page.waitForTimeout(300);
    },
  },
  {
    id: 'UL5-zu-alt-buergin',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-2/bonitaet',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Seite 1 groß ansehen' }).waitFor();
    },
  },
  {
    id: 'UL6-meist-unnoetig',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/ausweiskopie',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Seite 1 groß ansehen' }).waitFor();
    },
  },
  {
    id: 'WB1-warum-bonitaet',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/bonitaet',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Warum?' }).click();
      await page.getByRole('button', { name: 'Verstanden' }).waitFor();
    },
  },
  {
    id: 'WB2-warum-mietzahlung',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/mietzahlung',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Warum?' }).click();
      await page.getByRole('button', { name: 'Verstanden' }).waitFor();
    },
  },
  {
    id: 'WB3-warum-ausweis',
    gruppe: 'P',
    szenario: '25-unterlage-seiten',
    pfad: '/unterlage/p-25-unterlage-seiten-0/ausweiskopie',
    vorher: async (page) => {
      await page.getByRole('button', { name: 'Warum?' }).click();
      await page.getByRole('button', { name: 'Verstanden' }).waitFor();
    },
  },
  {
    id: 'HA1-rollentausch',
    gruppe: 'E',
    szenario: '25-unterlage-seiten',
    pfad: '/person-aendern/p-25-unterlage-seiten-2',
    vorher: async (page) => {
      await page.getByRole('radio', { name: 'Im Mietvertrag' }).click();
    },
  },
  {
    id: 'HA2-lebenslage',
    gruppe: 'E',
    szenario: '09-lebenslagen',
    pfad: '/person-aendern/p-09-lebenslagen-1',
    vorher: async (page) => {
      await page.getByLabel(/Einkommen\?$/).selectOption({ label: 'Angestellt' });
    },
  },
  {
    id: 'P-ohne-datum',
    gruppe: 'P',
    szenario: '23-ohne-datum',
    pfad: '/person/p-23-ohne-datum-0',
  },
  {
    id: 'R3c-ende-nichts-uebersprungen',
    gruppe: 'R',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles(pdfPfad);
      await page.getByText('abrechnung_oktober.pdf, 2 Seiten').waitFor();
      await page.getByRole('button', { name: 'Speichern und weiter' }).click();
      await page.getByRole('heading', { name: 'Gut gemacht.' }).waitFor();
    },
  },
  {
    id: 'R4-schon-da',
    gruppe: 'R',
    szenario: '03-mehrere-offen',
    pfad: '/rutsch',
    vorher: async (page) => {
      await los(page);
      await page.locator('button[aria-label^="Schritt 2 von"]').click();
      await page.locator('[data-feld="pdf"]').setInputFiles(pdfPfad);
      await page.getByRole('button', { name: 'Speichern und weiter' }).click();
      await page.getByText(/^3 von \d+$/).waitFor();
      await page.getByRole('button', { name: 'Zurück', exact: true }).click();
      await page.getByText(/^Ist schon da/).waitFor();
    },
  },
  {
    id: 'X10-vorschau-gross',
    gruppe: 'X',
    szenario: '04-fertig',
    pfad: '/mappe',
    vorher: async (page) => {
      await vorschau(page);
      await page.getByRole('button', { name: 'Deckblatt groß ansehen' }).click();
      await page.getByRole('button', { name: 'Ganze Mappe ansehen' }).click();
      await page.getByRole('img', { name: 'Seite 1' }).waitFor();
    },
  },
  {
    id: 'RS3-drei-auf-einmal',
    gruppe: 'D',
    szenario: '03-mehrere-offen',
    pfad: '/rutsch',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles([
        {
          name: 'Gehalt_September_2026.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from(beispielPdf),
        },
        {
          name: 'Gehalt_August_2026.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from(beispielPdf),
        },
        {
          name: 'Verdienstabrechnung Juli.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from(beispielPdf),
        },
      ]);
      // Erst wenn alle drei gelesen sind: Sonst zeigt das Bild „Einen Moment …“ und zu wenige Seiten.
      await page.getByText('6 Seiten aus 3 Dateien').waitFor();
      await page.getByText('Welcher Monat ist welche Datei?').waitFor();
    },
  },
  {
    id: 'D7-geht-nicht',
    gruppe: 'D',
    szenario: '01-standard',
    pfad: '/rutsch/p-01-standard-2',
    vorher: async (page) => {
      await los(page);
      await page.locator('[data-feld="pdf"]').setInputFiles({
        name: 'Lebenslauf.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('Kein PDF, sondern Word'),
      });
      await page.getByText(/^Diese Datei kann Hefta nicht öffnen/).waitFor();
    },
  },
];

/**
 * Wartet, bis die App fertig ist, statt eine feste Zeit zu hoffen: Sonst zeigt das Bild „Einen Moment …“ oder
 * eine Karte ohne Vorschaubilder, und die Prüfungen laufen auf einem halben Bildschirm. Mit PDF.js im Spiel
 * dauert die Stille länger: Zwischen zwei Nachrichten zeichnet die Seite.
 */
async function ruhe(page: Page) {
  let zuletzt = -1;
  for (let i = 0; i < 100; i++) {
    const { arbeit, frei, mitWorker } = await page.evaluate(() => {
      const stand = window as unknown as RuheStand;
      const beschaeftigt = [...document.querySelectorAll('[role="status"]')].some((e) =>
        e.textContent?.includes('Einen Moment'),
      );
      return {
        arbeit: stand.__arbeit,
        frei: !stand.__offen && !beschaeftigt,
        mitWorker: stand.__mitWorker,
      };
    });
    if (arbeit === zuletzt && frei) return;
    zuletzt = arbeit;
    await page.waitForTimeout(mitWorker ? 200 : 60);
  }
}

const gestartet = new WeakSet<Page>();

async function laden(page: Page, bild: Bild) {
  const s = bild.szenario ? SZENARIEN.find((x) => x.id === bild.szenario)! : null;
  // Einmal die App: Sie legt die Datenbank an. Danach reicht eine leere Seite derselben Adresse. Dort läuft
  // keine App, die beim Einspielen noch etwas schreibt, und der nächste Aufruf ist ein echter Neustart.
  if (!gestartet.has(page)) {
    gestartet.add(page);
    await page.route('**/__leer', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>leer</title>' }),
    );
    await page.goto('/');
    await page.locator('h1').first().waitFor();
  }
  await page.goto('/__leer');
  await page.evaluate(
    async ({ daten, pdf, hefte }) => {
      const db = await new Promise<IDBDatabase>((ok, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten ?? {}))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      const haushaltId =
        (daten as { haushalte?: { id: string }[] } | null)?.haushalte?.[0]?.id ?? null;
      for (const h of hefte ?? []) tx.objectStore('hefte').put({ ...h, haushaltId });
      if (daten && pdf) {
        const bytes = Uint8Array.from(atob(pdf), (z) => z.charCodeAt(0));
        for (const v of (daten as { versionen: { original: string }[] }).versionen)
          tx.objectStore('dateien').put({
            id: v.original,
            createdAt: new Date().toISOString(),
            typ: 'application/pdf',
            groesse: bytes.length,
            daten: bytes.buffer,
          });
      }
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    {
      daten: s ? datensaetze(s) : null,
      // Als Text: Eine Zahlenliste überträgt Playwright Wert für Wert, das kostete ein Viertel der Zeit.
      pdf: Buffer.from(bild.pdf?.() ?? beispielPdf).toString('base64'),
      hefte: bild.hefte?.() ?? null,
    },
  );
  await page.goto(`/${bild.geraet ? `?geraet=${bild.geraet}` : ''}#${bild.pfad}`);
  await page.locator('main h1').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (bild.vorher) await bild.vorher(page);
  await ruhe(page);
  await animationenFertig(page);
}

/** C12 (B8): Tastatur offen; das fokussierte Feld liegt sichtbar darüber und nicht unter der Leiste. */
async function tastaturPruefen(page: Page, ansicht: Ansicht): Promise<string> {
  await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe - TASTATUR });
  const gefunden = await page.evaluate(() => {
    // Der Titel kann den Fokus haben (nach einem Seitenwechsel); geprüft wird ein Feld.
    let feld = document.activeElement as HTMLElement | null;
    if (!feld?.matches('input, textarea, select')) {
      feld = document.querySelector('main input');
      feld?.focus();
    }
    return !!feld;
  });
  // Die Oberfläche darf auf den Fokus reagieren (z. B. Hinweise ausblenden), wie beim echten Tippen.
  await page.waitForTimeout(50);
  const ergebnis = !gefunden
    ? 'kein Feld'
    : await page.evaluate(() => {
        const feld = document.activeElement as HTMLElement;
        // Wie der Browser: fokussiertes Feld in den sichtbaren Bereich holen.
        feld.scrollIntoView({ block: 'center' });
        const r = feld.getBoundingClientRect();
        const leiste = document.querySelector('.leiste .innen')?.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight)
          return `Feld außerhalb (${Math.round(r.bottom)})`;
        if (leiste?.height && r.bottom > leiste.top) return 'Feld unter der Leiste';
        return '';
      });
  await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
  return ergebnis;
}

// Ohne Trace: Bei 170 Bildschirmen wird er 300 MB groß und sagt weniger als die Befunde.
test.use({ trace: 'off' });

test.describe('Prüfkatalog Stil C', () => {
  // Die Ansichten dauern am längsten und teilen nichts: Jede schreibt ihre eigenen Bögen, `beforeAll` läuft je Worker.
  test.describe.configure({ mode: 'parallel' });
  // Fehlt ein Knopf, früh abbrechen: Sonst wartet jeder Bildschirm bis zur Grenze des ganzen Tests.
  test.use({ actionTimeout: 30_000 });

  test.skip(({ browserName }) => browserName !== 'chromium', 'Maße nur in Chromium verlässlich');

  // Playwright verlangt das Objekt als ersten Parameter, auch ohne Fixtures.
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, info) => {
    const doc = await PDFDocument.create();
    const schrift = await doc.embedFont(StandardFonts.Helvetica);
    for (const text of ['Abrechnung Oktober', 'Seite 2'])
      doc.addPage([595, 842]).drawText(text, { x: 60, y: 700, size: 18, font: schrift });
    pdfPfad = info.outputPath('abrechnung_oktober.pdf');
    const bytes = await doc.save();
    writeFileSync(pdfPfad, bytes);
    beispielPdf = [...bytes];

    const viele = await PDFDocument.create();
    const s12 = await viele.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= 12; n++)
      viele
        .addPage([595, 842])
        .drawText(`Kontoauszug, Seite ${n}`, { x: 60, y: 700, size: 18, font: s12 });
    vielePfad = info.outputPath('bonitaetsauskunft_2026.pdf');
    writeFileSync(vielePfad, await viele.save());
    const mitDatum = await PDFDocument.create();
    const sd = await mitDatum.embedFont(StandardFonts.Helvetica);
    const datumSeite = mitDatum.addPage([595, 842]);
    datumSeite.drawText('Bonitaetsauskunft', { x: 60, y: 760, size: 22, font: sd });
    datumSeite.drawText('Ausgestellt am 20.10.2026', { x: 60, y: 720, size: 14, font: sd });
    datumSeite.drawText('Kundin seit 03.04.2019', { x: 60, y: 696, size: 14, font: sd });
    datumPfad = info.outputPath('auskunft_mit_datum.pdf');
    writeFileSync(datumPfad, await mitDatum.save());
    const gesperrt = await PDFDocument.create();
    const sg = await gesperrt.embedFont(StandardFonts.Helvetica);
    gesperrt.addPage([595, 842]).drawText('Bonitaet', { x: 60, y: 700, size: 18, font: sg });
    gesperrt.encrypt({ userPassword: 'geheim', ownerPassword: 'geheim-x' });
    gesperrtPfad = info.outputPath('bonitaetsauskunft.pdf');
    writeFileSync(gesperrtPfad, await gesperrt.save());

    grossText = await grossesPdf(true);
    grossScan = await grossesPdf(false);

    // Backups wie aus der App: Manifest mit den Datensätzen von 04-fertig und der Beispiel-PDF.
    const manifest = {
      format: 'hefta-backup',
      formatVersion: 1,
      schemaVersion: SCHEMA_VERSION,
      appVersion: '0.9.0',
      erstellt: new Date(2026, 9, 28, 12).toISOString(),
      daten: datensaetze(SZENARIEN.find((s) => s.id === '04-fertig')!),
      dateien: [
        {
          id: 'keine-datei',
          createdAt: new Date(2026, 9, 28).toISOString(),
          typ: 'application/pdf',
          groesse: bytes.length,
        },
      ],
    };
    const eintraege = () => [
      { pfad: 'manifest.json', daten: new Blob([JSON.stringify(manifest)]) },
      { pfad: 'dateien/keine-datei', daten: new Blob([bytes]) },
    ];
    for (const [passwort, name] of [
      [undefined, 'offen'],
      ['Sommer in Hamburg', 'passwort'],
    ] as const) {
      const pfad = info.outputPath(name, 'hefta-backup-2026-10-28.hefta');
      mkdirSync(dirname(pfad), { recursive: true });
      const blob = await backupErstellen(eintraege(), passwort, 1000);
      writeFileSync(pfad, new Uint8Array(await blob.arrayBuffer()));
      if (passwort) backupPasswort = pfad;
      else backupOffen = pfad;
    }
  });

  // Wie test_c22.py des Designs: Prüfungen gegen den Fehler, für den sie gedacht sind.
  test('C3 und C22 finden ihren Fehler, und ohne ihn nichts', async ({ page }) => {
    test.setTimeout(120_000);
    await page.clock.setFixedTime(HEUTE);
    await page.addInitScript(geraetNachstellen);
    await page.setViewportSize({ width: 320, height: 568 });
    const zoomen = () =>
      page.evaluate(async () => {
        document.documentElement.style.setProperty('zoom', '1.3');
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      });

    await laden(
      page,
      BILDER.find((b) => b.id === 'D11b-datum-auswaehlen')!,
    );
    await zoomen();
    expect((await page.evaluate(pruefen)).c22).toEqual([]);
    // D11b als feste Ansicht: Die Auswahl rutscht aus dem Bild.
    await page.evaluate(() => {
      const inhalt = document.querySelector<HTMLElement>('dialog.ansicht .inhalt')!;
      inhalt.style.overflow = 'hidden';
    });
    const fest = (await page.evaluate(pruefen)).c22.join(' ');
    expect(fest).toContain('Datum übernehmen');

    await laden(
      page,
      BILDER.find((b) => b.id === 'D2-viele-seiten')!,
    );
    await zoomen();
    expect((await page.evaluate(pruefen)).c3.filter((x) => x.startsWith('senkrecht'))).toEqual([]);
    // Ein Hinweis ohne Innenabstand: Der Text liegt auf dem Rand.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.notiz')!.style.padding = '0';
    });
    expect(
      (await page.evaluate(pruefen)).c3.filter((x) => x.startsWith('senkrecht')).length,
    ).toBeGreaterThan(0);
  });

  // Wie test_c23_25.py des Designs: je ein Fall ohne und mit Fehler.
  test('C23 bis C26 finden ihren Fehler, und ohne ihn nichts', async ({ page }) => {
    test.setTimeout(120_000);
    await page.clock.setFixedTime(HEUTE);
    await page.addInitScript(geraetNachstellen);
    await page.setViewportSize({ width: 390, height: 844 });
    await laden(
      page,
      BILDER.find((b) => b.id === '01-standard')!,
    );
    const sauber = await page.evaluate(pruefen);
    expect([sauber.c23, sauber.c24, sauber.c25, sauber.c26]).toEqual([[], [], [], []]);
    await page.evaluate(() => {
      document.querySelector('main h1')!.textContent = 'Version vom 12. Juli';
      document.querySelector<HTMLElement>('.aufgaben')!.style.marginLeft = '-16px';
      document.querySelector<HTMLElement>('.leiste .haupt')!.style.maxWidth = '50%';
      // Wie im ersten Entwurf von PF1: Knöpfe über dem Hinweis.
      for (const [art, text] of [
        ['button', 'Knopf'],
        ['span', 'Hinweis'],
      ] as const) {
        const e = document.createElement(art);
        e.textContent = text;
        e.style.cssText = 'position:absolute;left:40px;top:300px;width:60px;height:44px';
        document.querySelector('main')!.append(e);
      }
    });
    const kaputt = await page.evaluate(pruefen);
    expect(kaputt.c23).toEqual(['12. Juli']);
    expect(kaputt.c24.length).toBeGreaterThan(0);
    expect(kaputt.c25.length).toBeGreaterThan(0);
    expect(kaputt.c26).toContain('Knopf / Hinweis');
  });

  for (const ansicht of ANSICHTEN) {
    test(`alle Bildschirme in Ansicht ${ansicht.id}`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.clock.setFixedTime(HEUTE);
      await page.addInitScript(geraetNachstellen);
      await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
      await page.emulateMedia({ colorScheme: ansicht.dunkel ? 'dark' : 'light' });

      const bilder: { id: string; gruppe: string; png: string }[] = [];
      const befunde: Record<string, object> = {};
      // C27: Kein Bildschirm wirft Fehler in die Konsole, auch keinen stillen.
      const konsole: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') konsole.push(m.text());
      });
      page.on('pageerror', (e) => konsole.push(e.message));
      const scrollen: Record<string, number> = {};
      // Für schnelle Läufe: KATALOG_NUR=D9,R1-lange. Überschreibt die Bögen, danach einmal voll laufen lassen.
      const nur = process.env.KATALOG_NUR?.split(',') ?? ansicht.nur;
      for (const bild of BILDER) {
        if (nur && !nur.some((n) => bild.id.includes(n))) continue;
        konsole.length = 0;
        await laden(page, bild);
        if (ansicht.schrift) {
          await page.evaluate(
            (f) => document.documentElement.style.setProperty('--px', `${f}px`),
            ansicht.schrift,
          );
          await page.evaluate(
            () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))),
          );
          await page.waitForTimeout(100);
        }
        if (ansicht.zoom) {
          // CSSOM ist mit der CSP erlaubt (keine Inline-Styles im HTML).
          await page.evaluate(
            (z) => document.documentElement.style.setProperty('zoom', String(z)),
            ansicht.zoom,
          );
          // Größenbeobachter (Schrift anpassen, Band) laufen nach dem nächsten Bild: zwei Bilder abwarten.
          await page.evaluate(
            () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))),
          );
          await page.waitForTimeout(100);
        }
        const r = await page.evaluate(pruefen);
        const fehler: Record<string, unknown> = Object.fromEntries(
          Object.entries(r).filter(
            ([k, v]) => k !== 'hoehe' && (Array.isArray(v) ? v.length : !!v),
          ),
        );
        const ueber = Math.round(r.hoehe * (ansicht.zoom ?? 1)) - ansicht.hoehe;
        if (ueber > 0) scrollen[bild.id] = ueber;
        // Ganzseitenbild: die feste Leiste ans Seitenende setzen (so sieht man es nach dem Scrollen).
        await page.evaluate(() => {
          document.body.style.position = 'relative';
          document
            .querySelectorAll<HTMLElement>('.leiste')
            .forEach((e) => (e.style.position = 'absolute'));
        });
        // Ein Vollbild-Dialog deckt nur den Bildschirm; ein Ganzseiten-Bild zeigte die Seite darunter.
        const vollbild = await page.evaluate(() => !!document.querySelector('dialog[open]'));
        // „Welches Datum?“ scrollt als Ganzes: im Bogen die ganze Seite zeigen, nicht nur den Anfang.
        const ganzeHoehe = await page.evaluate(() => {
          // Ein Blatt nimmt höchstens 92 % des Bildschirms: so hoch, dass es ganz zu sehen ist.
          const blatt = document.querySelector('dialog[open]:not(.ansicht)');
          if (blatt) return blatt.scrollHeight / 0.92 + 8;
          const inhalt = document.querySelector('dialog.ansicht .inhalt');
          if (!inhalt) return 0;
          // Der Ausschnitt hängt an vh: festhalten, sonst wächst er mit dem größeren Bild.
          inhalt.querySelectorAll<HTMLElement>('.flaeche').forEach((f) => {
            f.style.height = getComputedStyle(f).height;
          });
          return inhalt.getBoundingClientRect().top + inhalt.scrollHeight;
        });
        if (ganzeHoehe)
          await page.setViewportSize({
            width: ansicht.breite,
            height: Math.ceil(Math.max(ganzeHoehe * (ansicht.zoom ?? 1), ansicht.hoehe)),
          });
        const png = await page.screenshot({ fullPage: !vollbild });
        if (ganzeHoehe)
          await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
        await page.evaluate(() => {
          document.body.style.position = '';
          document.querySelectorAll<HTMLElement>('.leiste').forEach((e) => (e.style.position = ''));
        });
        bilder.push({ id: bild.id, gruppe: bild.gruppe, png: png.toString('base64') });
        if (bild.tastatur) {
          const c12 = await tastaturPruefen(page, ansicht);
          if (c12) fehler.c12 = c12;
        }
        // G2 wirft den Fehler absichtlich, um den Hinweis zu zeigen.
        const echte = konsole.filter((z) => !z.includes('Prüfkatalog'));
        if (echte.length) fehler.c27 = echte.map((z) => z.slice(0, 160));
        if (Object.keys(fehler).length) befunde[bild.id] = fehler;
      }

      // C6: Scrollhöhe notieren
      test.info().annotations.push({
        type: 'C6 Scrollen (px über Bildschirm)',
        description: JSON.stringify(scrollen),
      });

      // Kontaktbögen für die Sichtprüfung (eigene leere Seite, ohne CSP der App)
      const bogenKontext = await page.context().browser()!.newContext({ deviceScaleFactor: 1.5 });
      const bogen = await bogenKontext.newPage();
      for (const gruppe of ['U', 'E', 'R', 'S', 'P', 'X', 'B', 'Z', 'D', 'G', 'N', 'H']) {
        if (!bilder.some((b) => b.gruppe === gruppe)) continue;
        await bogen.setViewportSize({ width: 1200, height: 800 });
        await bogen.setContent(
          `<body style="margin:0;background:#c9ccd6;display:flex;gap:30px;align-items:flex-start;width:max-content;font:14px sans-serif">` +
            bilder
              .filter((b) => b.gruppe === gruppe)
              .map(
                (b) =>
                  `<figure style="margin:0"><figcaption style="padding:6px 0">${b.id}</figcaption><img style="display:block;width:${ansicht.breite}px${ansicht.grau ? ';filter:grayscale(1)' : ''}" src="data:image/png;base64,${b.png}"></figure>`,
              )
              .join('') +
            '</body>',
        );
        await bogen.waitForLoadState('load');
        await bogen.screenshot({
          path: `docs/screenshots/bogen-${gruppe}-${ansicht.id}.png`,
          fullPage: true,
        });
      }
      await bogenKontext.close();

      expect(befunde).toEqual({});
    });
  }
});

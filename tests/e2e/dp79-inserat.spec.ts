import { expect, test, type Browser, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// DP79 (E235, PC120 Abschnitt 4): Wenn Hefta ein Inserat nicht lesen kann. Prüfkatalog IL1 bis IL14 aus Designs
// pruef79.py, an der echten Seite: Die Antwort des Lesers kommt über den Prüfhaken `window.__heftaInseratTest`, kein
// Inserat wird geöffnet, jede andere Adresse ist gesperrt (IL14). Jeder Fall bei 390 px und bei 320 px mit 130 %
// (als 246 × 437, wie bei Design), hell und dunkel, mit ihr und du; in Chromium und WebKit. Dazu Designs
// Gegenproben: Fassungen, die eine Regel brechen, müssen die Prüfung rot machen.
// Nur Musterdaten (W7): erfundene Nummer 000000123, Lindenring 3 und Musterweg 7.

const LINK = 'https://www.immobilienscout24.de/expose/000000123';
const NL = String.fromCharCode(10);

type Antwort = Record<string, unknown>;
type Anrede = 'ihr' | 'du';
type Fall =
  'weg' | 'gesperrt' | 'nichts' | 'netz' | 'offen' | 'teil' | 'teilk' | 'teilks' | 'selbst';

/** Der geteilte Text von ImmoScout24, nachgebaut wie im Test zu F8a (erfundene Nummer). */
const geteilt = (adresse: string[]) =>
  [
    'Dieses Angebot habe ich bei ImmoScout24 gefunden:',
    LINK,
    '',
    '        Details',
    '-------------------------',
    'Kaltmiete 12,59 €/m²: 754,76 €',
    'Wohnfläche:     59,96 m²',
    'Zimmer:         2',
    'Warmmiete:      951,76 €',
    '',
    ...adresse,
  ].join(NL);

const SEITE: Record<string, Antwort> = {
  weg: { zustand: 'ok', http: 404, text: 'Seite nicht gefunden' },
  weg410: { zustand: 'ok', http: 410, text: '' },
  gesperrt: { zustand: 'ok', http: 403, text: '' },
  gesperrt401: { zustand: 'ok', http: 401, text: '' },
  gesperrt429: { zustand: 'ok', http: 429, text: '' },
  gesperrt451: { zustand: 'ok', http: 451, text: '' },
  roboter: {
    zustand: 'ok',
    http: 200,
    text: ['Ich bin kein Roboter', 'Bitte bestätige, dass du ein Mensch bist.'].join(NL),
  },
  roboter2: { zustand: 'ok', http: 200, text: 'Gleich geht’s weiter' },
  nichts: {
    zustand: 'ok',
    http: 200,
    text: ['Willkommen', 'Jetzt registrieren', 'Cookies akzeptieren'].join(NL),
  },
  netz: { zustand: 'netz' },
  zeit: { zustand: 'zeit' },
  http500: { zustand: 'ok', http: 500, text: '' },
  fehler: { zustand: 'fehler' },
  ohneAdresse: {
    zustand: 'ok',
    http: 200,
    h1: 'Helle Zwei-Zimmer-Wohnung mit Balkon',
    text: [
      'Helle Zwei-Zimmer-Wohnung mit Balkon',
      'Warmmiete 1.240 €',
      'Wohnfläche ca. 58 m²',
      'Zimmer 2',
    ].join(NL),
  },
};

/** Wortlaut nach DP79, Abschnitt 2 und 3 (vorschlag-texte.json), dazu D wie heute. */
const T: Record<Fall, { ihr: string[]; du: string[]; knoepfe: string[] }> = {
  weg: {
    ihr: [
      'Das Inserat ist nicht mehr online.',
      'Die Seite meldet, dass es das Inserat nicht mehr gibt.',
    ],
    du: [
      'Das Inserat ist nicht mehr online.',
      'Die Seite meldet, dass es das Inserat nicht mehr gibt.',
    ],
    knoepfe: ['Anderer Link', 'Ganze Seite ansehen', 'Trotzdem anlegen'],
  },
  gesperrt: {
    ihr: [
      'Die Seite lässt Hefta nicht lesen.',
      'Ob das Inserat noch online ist, sagt das nicht. Die Angaben könnt ihr selbst eintragen.',
    ],
    du: [
      'Die Seite lässt Hefta nicht lesen.',
      'Ob das Inserat noch online ist, sagt das nicht. Die Angaben kannst du selbst eintragen.',
    ],
    knoepfe: ['Selbst ausfüllen', 'Ganze Seite ansehen', 'Anderer Link'],
  },
  nichts: {
    ihr: [
      'Hefta hat keine Eckdaten gefunden.',
      'Miete, Zimmer und Fläche könnt ihr selbst eintragen.',
    ],
    du: [
      'Hefta hat keine Eckdaten gefunden.',
      'Miete, Zimmer und Fläche kannst du selbst eintragen.',
    ],
    knoepfe: ['Selbst ausfüllen', 'Ganze Seite ansehen', 'Anderer Link'],
  },
  netz: {
    ihr: [
      'Gerade kein Netz.',
      'Hefta hat das Inserat noch nicht geöffnet. Versucht es gleich noch einmal.',
    ],
    du: [
      'Gerade kein Netz.',
      'Hefta hat das Inserat noch nicht geöffnet. Versuch es gleich noch einmal.',
    ],
    knoepfe: ['Noch einmal versuchen', 'Selbst ausfüllen'],
  },
  offen: {
    ihr: [
      'Hefta konnte die Seite gerade nicht öffnen.',
      'Ob das Inserat noch online ist, sagt das nicht. Versucht es gleich noch einmal.',
    ],
    du: [
      'Hefta konnte die Seite gerade nicht öffnen.',
      'Ob das Inserat noch online ist, sagt das nicht. Versuch es gleich noch einmal.',
    ],
    knoepfe: ['Noch einmal versuchen', 'Ganze Seite ansehen', 'Selbst ausfüllen'],
  },
  teil: {
    ihr: [
      'ImmoScout24 · aus dem geteilten Text',
      'Hefta hat nur den geteilten Text gelesen, nicht die Seite. Gespeichert wird erst, was ihr gleich bestätigt.',
    ],
    du: [
      'ImmoScout24 · aus dem geteilten Text',
      'Hefta hat nur den geteilten Text gelesen, nicht die Seite. Gespeichert wird erst, was du gleich bestätigst.',
    ],
    knoepfe: ['Ja, einlesen', 'Anderer Link', 'Ganze Seite ansehen'],
  },
  teilk: {
    ihr: [
      'Gelesen aus dem geteilten Text.',
      'Im geteilten Text fand Hefta keine Adresse. Sie kommt in Betreff und Deckblatt.',
      'nicht gefunden',
    ],
    du: [
      'Gelesen aus dem geteilten Text.',
      'Im geteilten Text fand Hefta keine Adresse. Sie kommt in Betreff und Deckblatt.',
      'nicht gefunden',
    ],
    knoepfe: ['Adresse eintragen', 'Heft anlegen'],
  },
  teilks: {
    ihr: [
      'Im Inserat fand Hefta keine Adresse. Sie kommt in Betreff und Deckblatt.',
      'nicht gefunden',
    ],
    du: [
      'Im Inserat fand Hefta keine Adresse. Sie kommt in Betreff und Deckblatt.',
      'nicht gefunden',
    ],
    knoepfe: ['Adresse eintragen', 'Heft anlegen'],
  },
  selbst: {
    ihr: [
      'Die Adresse kommt in Betreff und Deckblatt.',
      'Tippt auf eine Angabe, um sie einzutragen.',
    ],
    du: [
      'Die Adresse kommt in Betreff und Deckblatt.',
      'Tipp auf eine Angabe, um sie einzutragen.',
    ],
    knoepfe: ['Adresse eintragen', 'Heft anlegen'],
  },
};

/** Ein Lauf: die Antwort der Seite, der geteilte Text, was man antippt, welcher Fall erwartet ist. */
interface Lauf {
  name: string;
  seite: Antwort;
  text?: string;
  offline?: boolean;
  klick?: string;
  fall: Fall;
  /** Nur bei 390 px, hell, ihr (Varianten der Erkennung). */
  kurz?: boolean;
}

const OHNE_ADRESSE = geteilt(['12345 Neustadt, Musterstadt']);
const LAEUFE: Lauf[] = [
  { name: 'A 404', seite: SEITE.weg!, fall: 'weg' },
  { name: 'A 410', seite: SEITE.weg410!, fall: 'weg', kurz: true },
  { name: 'B 403', seite: SEITE.gesperrt!, fall: 'gesperrt' },
  { name: 'B 401', seite: SEITE.gesperrt401!, fall: 'gesperrt', kurz: true },
  { name: 'B 429', seite: SEITE.gesperrt429!, fall: 'gesperrt', kurz: true },
  { name: 'B 451', seite: SEITE.gesperrt451!, fall: 'gesperrt', kurz: true },
  { name: 'B Roboterprüfung', seite: SEITE.roboter!, fall: 'gesperrt' },
  { name: 'B „Gleich geht’s weiter“', seite: SEITE.roboter2!, fall: 'gesperrt', kurz: true },
  { name: 'C keine Eckdaten', seite: SEITE.nichts!, fall: 'nichts' },
  { name: 'D Gerät offline', seite: SEITE.netz!, offline: true, fall: 'netz' },
  { name: 'F kein Netz, Gerät online', seite: SEITE.netz!, fall: 'offen', kurz: true },
  { name: 'F zu lange', seite: SEITE.zeit!, fall: 'offen' },
  { name: 'F 500', seite: SEITE.http500!, fall: 'offen', kurz: true },
  { name: 'F Fehler des Lesers', seite: SEITE.fehler!, fall: 'offen', kurz: true },
  {
    name: 'E geteilter Text, Seite gesperrt',
    seite: SEITE.gesperrt!,
    text: OHNE_ADRESSE,
    fall: 'teil',
  },
  {
    name: 'E Kontrolle',
    seite: SEITE.gesperrt!,
    text: OHNE_ADRESSE,
    klick: 'Ja, einlesen',
    fall: 'teilk',
  },
  {
    name: 'Kontrolle, Seite ohne Adresse',
    seite: SEITE.ohneAdresse!,
    klick: 'Ja, einlesen',
    fall: 'teilks',
  },
  {
    name: 'B, dann „Selbst ausfüllen“',
    seite: SEITE.gesperrt!,
    klick: 'Selbst ausfüllen',
    fall: 'selbst',
  },
];

const ANSICHTEN = [
  { id: '390', breite: 390, hoehe: 844 },
  { id: '320-130', breite: 246, hoehe: 437 },
] as const;

/** Was eine Messung festhält (wie `m79.js`). */
interface Messung {
  text: string;
  breite: number;
  scroll: number;
  ueber: string[];
  kontrast: { t: string; r: number; farbe: string }[];
  ziele: { t: string; w: number; h: number }[];
  rand: string;
  abst: { oben: number; unten: number } | null;
  sichtbar: { t: string; ok: boolean }[];
  fremd: string[];
}

function messen(page: Page): Promise<Omit<Messung, 'fremd'>> {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const main = document.querySelector('main')!;
    const lum = (c: string) => {
      const m = (c.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(m[0]!) + 0.7152 * f(m[1]!) + 0.0722 * f(m[2]!);
    };
    const grund = (e: Element | null): string => {
      while (e) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/rgba\([^)]*, 0\)$/.test(c))
          return c;
        e = e.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const texte = [...main.querySelectorAll('*')].filter(
      (e) =>
        [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) &&
        e.getBoundingClientRect().width > 0 &&
        !e.closest('header'),
    );
    const kontrast = texte.map((e) => {
      const a = lum(getComputedStyle(e).color);
      const b = lum(grund(e));
      const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return {
        t: (e.textContent ?? '').trim().slice(0, 40),
        r: Math.round(r * 100) / 100,
        farbe: getComputedStyle(e).color,
      };
    });
    const ueber = texte
      .filter((e) => e.getBoundingClientRect().right > W + 0.5 || e.scrollWidth > e.clientWidth + 1)
      .map((e) => (e.textContent ?? '').trim().slice(0, 40));
    const ziele = [...main.querySelectorAll('.cta button, .zus.adresse button')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { t: (e.textContent ?? '').trim(), w: Math.round(r.width), h: Math.round(r.height) };
      });
    const ad = document.querySelector('.zus.adresse');
    const rand = ad ? getComputedStyle(ad).border : '';
    const q = document.querySelector('.herkunft');
    const abst = q
      ? {
          oben: Math.round(
            q.getBoundingClientRect().top -
              q.previousElementSibling!.getBoundingClientRect().bottom,
          ),
          unten: Math.round(
            (q.nextElementSibling?.getBoundingClientRect().top ?? 0) -
              q.getBoundingClientRect().bottom,
          ),
        }
      : null;
    const cta = document.querySelector('.cta');
    const ct =
      cta && getComputedStyle(cta).position === 'sticky'
        ? cta.getBoundingClientRect().top
        : innerHeight;
    const grenze = Math.min(ct, innerHeight);
    const sichtbar = [
      ...document.querySelectorAll(
        '.karte .fh, .karte .fs, p.satz, .herkunft, .zus.adresse .zf, .karte .q',
      ),
    ]
      .filter((e) => e.getBoundingClientRect().height > 0 && e.getAttribute('role') !== 'status')
      .map((e) => ({
        t: (e.textContent ?? '').trim().slice(0, 40),
        ok: e.getBoundingClientRect().bottom <= grenze + 0.5,
      }));
    return {
      text: (main as HTMLElement).innerText,
      breite: W,
      scroll: document.documentElement.scrollWidth,
      ueber,
      kontrast,
      ziele,
      rand,
      abst,
      sichtbar,
    };
  });
}

const VERMUTUNG = /\b(vielleicht|wahrscheinlich|vermutlich|offenbar|scheint|wohl)\b/i;
const FORM_DU = /\b(kannst du|Versuch es|Tipp auf|bestätigst|dir|dein\w*)\b/;
const FORM_IHR = /\b(könnt ihr|Versucht es|Tippt auf|bestätigt\.|euch|eur\w*)\b/;
const LOB = /\b(einfach|schnell|smart|super|perfekt|endlich|mühelos)\b/i;
const RASTER = new Set([4, 8, 12, 16, 20, 24, 32, 48]);
const KONTROLLE: Fall[] = ['teilk', 'teilks', 'selbst'];

function rgb(s: string): [number, number, number] {
  const m = (s.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return [m[0]!, m[1]!, m[2]!];
}
function rotOderBernstein(c: string): boolean {
  const [r, g, b] = rgb(c);
  return (
    (r > g + 60 && r > b + 60) || ['168,90,0', '245,165,36', '179,38,30'].includes(`${r},${g},${b}`)
  );
}

/** Die Prüfungen IL1 bis IL14 für eine Messung; jede Zeile: Nummer, Was, ob grün, Befund. */
export function pruefen(
  m: Messung,
  fall: Fall,
  anrede: Anrede,
): [string, string, boolean, unknown][] {
  const t = m.text.replace(/\u00a0/g, ' ');
  const z: [string, string, boolean, unknown][] = [];
  z.push(['IL1', 'keine Vermutung (W10)', !VERMUTUNG.test(t), t.match(VERMUTUNG)?.[0]]);
  if (fall !== 'weg')
    z.push(['IL1', '„nicht mehr online“ nur bei A', !t.includes('nicht mehr online'), '']);
  if (KONTROLLE.includes(fall))
    z.push([
      'IL2',
      'kein „nicht angegeben“ für Ungelesenes (W10)',
      !t.includes('nicht angegeben'),
      '',
    ]);
  const fehlt = T[fall][anrede].filter((s) => !t.includes(s));
  z.push(['IL3', 'Wortlaut wie DP79', fehlt.length === 0, fehlt[0]]);
  const kn = m.ziele.map((k) => k.t);
  z.push(['IL3', 'Knöpfe wie DP79', JSON.stringify(kn) === JSON.stringify(T[fall].knoepfe), kn]);
  const fremd = (anrede === 'du' ? FORM_IHR : FORM_DU).exec(t);
  z.push(['IL4', `nur ${anrede}-Form`, !fremd, fremd?.[0]]);
  z.push([
    'IL5',
    '„Trotzdem“ nur bei A, nie „Trotzdem einlesen“',
    (!t.includes('Trotzdem') || fall === 'weg') && !t.includes('Trotzdem einlesen'),
    '',
  ]);
  const unsichtbar = m.sichtbar.filter(
    (s) => !s.ok && !(fall === 'teil' && s.t.includes('geteilten Text gelesen')),
  );
  z.push([
    'IL6',
    'Satz zum Fall ohne Scrollen sichtbar',
    unsichtbar.length === 0 && m.sichtbar.length > 0,
    unsichtbar[0],
  ]);
  z.push(['IL7', 'kein Überlauf', m.ueber.length === 0 && m.scroll <= m.breite, m.ueber[0]]);
  const klein = m.ziele.filter((k) => k.h < 44 || k.w < 44);
  z.push(['IL8', 'Tippziele mindestens 44 px', klein.length === 0, klein[0]]);
  const mi = m.kontrast.reduce((a, b) => (b.r < a.r ? b : a), m.kontrast[0]!);
  z.push(['IL9', 'Kontrast mindestens 4,5 : 1', mi.r >= 4.5, mi]);
  const rb = m.kontrast.filter((k) => rotOderBernstein(k.farbe));
  z.push(['IL10', 'kein Rot, kein Bernstein (W5)', rb.length === 0, rb[0]]);
  if (KONTROLLE.includes(fall))
    z.push([
      'IL11',
      'Adress-Block ohne Tintenrand (W33)',
      !!m.rand && !m.rand.includes('1.5px') && !m.rand.includes('rgb(38, 34, 30)'),
      m.rand,
    ]);
  if (m.abst)
    z.push([
      'IL12',
      'Abstände der neuen Zeile aus dem Raster (W22)',
      RASTER.has(m.abst.oben) && RASTER.has(m.abst.unten),
      m.abst,
    ]);
  const satz = T[fall][anrede][1];
  if (satz && !KONTROLLE.includes(fall) && fall !== 'teil')
    z.push([
      'IL13',
      'höchstens zwei kurze Sätze, kein Lob (W30)',
      (satz.match(/[.!?](\s|$)/g) ?? []).length <= 2 && !LOB.test(t),
      satz,
    ]);
  z.push(['IL14', 'keine andere Adresse aufgerufen', m.fremd.length === 0, m.fremd]);
  return z;
}

/** Eine Seite mit dem Prüfhaken; jede Adresse außer der eigenen ist gesperrt und wird gezählt (IL14). */
async function oeffnen(browser: Browser, lauf: Lauf, anrede: Anrede, baseURL: string) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const fremd: string[] = [];
  const eigen = new URL(baseURL).host;
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    let h = '';
    try {
      h = new URL(u).host;
    } catch {
      /* data: oder blob: */
    }
    if (u.startsWith('data:') || u.startsWith('blob:') || h === eigen) return r.continue();
    fremd.push(h);
    return r.abort();
  });
  await ctx.addInitScript((antwort) => {
    const w = window as unknown as Record<string, unknown>;
    // D: Das Gerät ist offline. Nachgestellt über `navigator.onLine`, damit die Seite selbst geladen bleibt.
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => w.__geraetOffline !== true,
    });
    w.__heftaInseratTest = {
      vorschau: async ({ url }: { url: string }) => ({ url, ...antwort }),
      vorschauAbbrechen: async () => {},
      seite: async () => {},
      knopf: async () => ({ geht: false }),
      knopfWeg: async () => {},
      ablage: async () => null,
      addListener: async () => ({ remove: async () => {} }),
    };
  }, lauf.seite);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(2026, 10, 18, 10, 0));
  // Ohne Haushalt „ihr“ (E74.4); allein im Haushalt „du“.
  if (anrede === 'du') await haushaltMitMax(page);
  return { ctx, page, fremd };
}

async function lauf(
  page: Page,
  l: Lauf,
  ansicht: (typeof ANSICHTEN)[number],
  farbe: 'light' | 'dark',
) {
  await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
  await page.emulateMedia({ colorScheme: farbe });
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.waitForFunction(() => typeof (window as never)['__heftaTeilen'] === 'function');
  if (l.offline)
    await page.evaluate(
      () => ((window as unknown as Record<string, unknown>).__geraetOffline = true),
    );
  await page.evaluate(
    ([link, text]) =>
      (window as never as { __heftaTeilen: (a: string, b: string) => void }).__heftaTeilen(
        link!,
        text!,
      ),
    [LINK, l.text ?? ''],
  );
  await expect(page.locator('.karte:not(.laden)')).toBeVisible();
  if (l.klick) {
    await page.getByRole('button', { name: l.klick, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Letzte Kontrolle' })).toBeVisible();
  }
  // Die Karte blendet ruhig ein (W9); gemessen wird danach.
  await page.waitForTimeout(400);
  return messen(page);
}

for (const l of LAEUFE)
  for (const anrede of ['ihr', 'du'] as const) {
    if (l.kurz && anrede === 'du') continue;
    test(`DP79 ${l.name}, ${anrede}: IL1 bis IL14`, async ({ browser, baseURL }) => {
      test.setTimeout(120_000);
      const { ctx, page, fremd } = await oeffnen(browser, l, anrede, baseURL!);
      const rot: string[] = [];
      for (const ansicht of ANSICHTEN)
        for (const farbe of ['light', 'dark'] as const) {
          if (l.kurz && (ansicht.id !== '390' || farbe !== 'light')) continue;
          const m = await lauf(page, l, ansicht, farbe);
          for (const [nr, was, ok, wert] of pruefen({ ...m, fremd }, l.fall, anrede))
            if (!ok) rot.push(`${nr} ${was} (${ansicht.id}, ${farbe}): ${JSON.stringify(wert)}`);
        }
      await ctx.close();
      expect(rot).toEqual([]);
    });
  }

// Gegenproben (Designs Liste aus pruef79.py, dazu je eine für IL3, IL11, IL12, IL13, IL14): Eine Fassung, die eine
// Regel bricht, macht die Prüfung rot. Gemessen an der echten Seite, dann gezielt verdorben.
test('DP79 Gegenproben: jede gebrochene Regel wird rot', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const rotBei = (m: Messung, fall: Fall, nr: string, anrede: Anrede = 'ihr') =>
    pruefen(m, fall, anrede).some(([n, , ok]) => n === nr && !ok);

  const b = await oeffnen(
    browser,
    LAEUFE.find((x) => x.name === 'B 403')!,
    'ihr',
    baseURL!,
  );
  const g390 = { ...(await lauf(b.page, LAEUFE[2]!, ANSICHTEN[0], 'light')), fremd: [] };
  expect(rotBei(g390, 'gesperrt', 'IL1')).toBe(false);
  // IL1: die alte Vermutung.
  expect(
    rotBei(
      { ...g390, text: `${g390.text}\nVielleicht ist das Inserat nicht mehr online.` },
      'gesperrt',
      'IL1',
    ),
  ).toBe(true);
  // IL4: du-Form in der ihr-Fassung.
  expect(
    rotBei({ ...g390, text: `${g390.text}\nVersuch es gleich noch einmal.` }, 'gesperrt', 'IL4'),
  ).toBe(true);
  // IL5: „Trotzdem einlesen“ wie im Bau vor DP79.
  expect(rotBei({ ...g390, text: `${g390.text}\nTrotzdem einlesen` }, 'offen', 'IL5')).toBe(true);
  // IL10: Satz in Bernstein.
  expect(
    rotBei(
      { ...g390, kontrast: [...g390.kontrast, { t: 'x', r: 5.6, farbe: 'rgb(168, 90, 0)' }] },
      'gesperrt',
      'IL10',
    ),
  ).toBe(true);
  // IL3: ein anderer Knopf.
  expect(
    rotBei(
      { ...g390, ziele: g390.ziele.map((k, i) => (i ? k : { ...k, t: 'Trotzdem einlesen' })) },
      'gesperrt',
      'IL3',
    ),
  ).toBe(true);
  // IL13: drei Sätze und Lob.
  expect(rotBei({ ...g390, text: `${g390.text}\nGanz einfach.` }, 'gesperrt', 'IL13')).toBe(true);
  // IL14: eine fremde Adresse.
  expect(rotBei({ ...g390, fremd: ['example.com'] }, 'gesperrt', 'IL14')).toBe(true);

  // Gebaut bei 320 px mit 130 %: Titel ohne Umbruch (IL7), Satz blass (IL9), Knopf 30 px (IL8), Knöpfe haften
  // unten wie vor DP79 (IL6).
  const verdorben = async (tun: () => void) => {
    await b.page.setViewportSize({ width: 246, height: 437 });
    await b.page.goto('/#/wohnungen');
    await b.page.reload();
    await b.page.waitForFunction(() => typeof (window as never)['__heftaTeilen'] === 'function');
    await b.page.evaluate(
      (link) =>
        (window as never as { __heftaTeilen: (a: string, b: string) => void }).__heftaTeilen(
          link,
          '',
        ),
      LINK,
    );
    await expect(b.page.locator('.karte.still')).toBeVisible();
    await b.page.evaluate(tun);
    return { ...(await messen(b.page)), fremd: [] };
  };
  expect(
    rotBei(
      await verdorben(() => {
        const e = document.querySelector<HTMLElement>('.karte .fh')!;
        e.textContent = 'Eckdatenlesehilfeseitenvorschaufehler'.repeat(2);
        e.style.whiteSpace = 'nowrap';
      }),
      'gesperrt',
      'IL7',
    ),
  ).toBe(true);
  expect(
    rotBei(
      await verdorben(() => {
        document.querySelector<HTMLElement>('.karte .fs')!.style.color = '#b8afa6';
      }),
      'gesperrt',
      'IL9',
    ),
  ).toBe(true);
  expect(
    rotBei(
      await verdorben(() => {
        const e = document.querySelector<HTMLElement>('.cta button.zweit')!;
        Object.assign(e.style, { minHeight: '0', height: '30px', padding: '0', border: '0' });
      }),
      'gesperrt',
      'IL8',
    ),
  ).toBe(true);
  expect(
    rotBei(
      await verdorben(() => {
        // Knöpfe haften unten wie vor DP79, der Satz rutscht darunter (CSSOM, die Inhaltsrichtlinie erlaubt kein CSS).
        const cta = document.querySelector<HTMLElement>('.cta.folgt')!;
        cta.style.setProperty('position', 'sticky', 'important');
        cta.style.setProperty('bottom', '0px');
        document.querySelector<HTMLElement>('.karte.still .t')!.style.paddingTop = '240px';
        document.querySelector<HTMLElement>('.karte.still')!.style.marginBottom = '400px';
      }),
      'gesperrt',
      'IL6',
    ),
  ).toBe(true);
  await b.ctx.close();

  // Kontrolle: „nicht angegeben“ wie vor DP79 (IL2), Tintenrand am Adress-Block (IL11), Abstand der Quelle (IL12).
  const k = await oeffnen(
    browser,
    LAEUFE.find((x) => x.name === 'E Kontrolle')!,
    'ihr',
    baseURL!,
  );
  const kontrolle = {
    ...(await lauf(
      k.page,
      LAEUFE.find((x) => x.name === 'E Kontrolle')!,
      ANSICHTEN[0],
      'light',
    )),
    fremd: [],
  };
  expect(rotBei(kontrolle, 'teilk', 'IL2')).toBe(false);
  expect(rotBei({ ...kontrolle, text: `${kontrolle.text}\nnicht angegeben` }, 'teilk', 'IL2')).toBe(
    true,
  );
  expect(rotBei({ ...kontrolle, rand: '1.5px solid rgb(38, 34, 30)' }, 'teilk', 'IL11')).toBe(true);
  expect(rotBei({ ...kontrolle, abst: { oben: 6, unten: 12 } }, 'teilk', 'IL12')).toBe(true);
  await k.ctx.close();
});

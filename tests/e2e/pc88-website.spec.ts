// PC88, Abschnitt 2: QA16 (Kopf auf „/“ in sechs Breiten), QA17 (Favicon auf allen Seiten gleich F1) und QA18
// (Listen mit fester Zahl), dazu U9 (Symbol für den Home-Bildschirm auf jeder Seite). Je mit Gegenprobe.
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const WEB = 'http://localhost:4175';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
  andere:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
};

/** Alle HTML-Seiten von hefta.de, wie build/webseite.ts sie schreibt; dazu ein unbekannter Pfad (404). */
const SEITEN = [
  '/',
  '/ratgeber/',
  '/ratgeber/was-darf-der-vermieter-verlangen/',
  '/impressum/',
  '/datenschutz/',
  '/rueckmeldung/',
  '/mappe/',
  '/gibt-es-nicht/',
];

// ---------------------------------------------------------------------------------------------------------------
// QA16: Kopf auf „/“ in sechs Breiten

/** Die Zeilen eines Elements, wie sie gesetzt sind. Ein weiches Trennzeichen am Zeilenende wird zu „-“. */
const zeilen = (page: Page, wahl: string) =>
  page.locator(wahl).evaluate((el) => {
    const zeichen: { z: string; oben: number }[] = [];
    const gang = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = gang.nextNode(); n; n = gang.nextNode()) {
      const t = n.textContent ?? '';
      for (let i = 0; i < t.length; i++) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        // Nach einem weichen Umbruch liefert Chromium zuerst ein Rechteck am Ende der vorigen Zeile; es zählt das letzte.
        const k = [...r.getClientRects()].filter((x) => x.width > 0).pop();
        zeichen.push({ z: t[i]!, oben: k ? Math.round(k.top) : NaN });
      }
    }
    const aus: string[] = [];
    let jetzt = '';
    let oben = NaN;
    for (const { z, oben: o } of zeichen) {
      if (Number.isNaN(o)) {
        // Unsichtbar: Leerzeichen am Umbruch oder ein weiches Trennzeichen, das nicht trennt.
        if (z === '­') jetzt += z;
        else if (z === ' ') jetzt += ' ';
        continue;
      }
      if (!Number.isNaN(oben) && Math.abs(o - oben) > 4) {
        aus.push(jetzt);
        jetzt = '';
      }
      oben = o;
      jetzt += z;
    }
    aus.push(jetzt);
    return aus.map((s, i) =>
      (i < aus.length - 1 ? s.replace(/­$/, '-') : s).replaceAll('­', '').trim(),
    );
  });

/** Eine Regel ins letzte Stylesheet der Seite. Die CSP (style-src 'self') sperrt eingeschobene style-Elemente. */
const regel = (page: Page, css: string) =>
  page.evaluate((c) => {
    const s = document.styleSheets[document.styleSheets.length - 1]!;
    s.insertRule(c, s.cssRules.length);
  }, css);

/**
 * Sechs Breiten. Die Zeilen der Überschrift sind der Stand vom 17.11. (PC88). DP60-3, Abschnitt 2 lag Code nicht vor;
 * Design gleicht die Tabelle in PD95 mit der eigenen Messung ab.
 * Am Telefon misst die Probe mit Android: Dort steht „Im Browser“ vorn. Am iPhone steht „Als App“ vorn (Auftraggeber
 * 15.11., web/hefta.js); dafür gilt der eigene Test darunter.
 */
const BREITEN = [
  { breite: 320, hoehe: 568, zoom: 1.3, ua: 'android', erstesBild: false },
  { breite: 360, hoehe: 740, zoom: 1, ua: 'android', erstesBild: false },
  { breite: 390, hoehe: 844, zoom: 1, ua: 'android', erstesBild: true },
  { breite: 768, hoehe: 1024, zoom: 1, ua: 'andere', erstesBild: true },
  { breite: 1280, hoehe: 800, zoom: 1, ua: 'andere', erstesBild: true },
  { breite: 1440, hoehe: 900, zoom: 1, ua: 'andere', erstesBild: true },
] as const;

const UEBERSCHRIFT: Record<number, string[]> = {
  320: ['Die Mappe', 'für die', 'Wohnungs-', 'suche.'],
  360: ['Die Mappe für', 'die Wohnungs-', 'suche.'],
  390: ['Die Mappe für', 'die Wohnungs-', 'suche.'],
  768: ['Die Mappe für', 'die Wohnungs-', 'suche.'],
  1280: ['Die Mappe für die', 'Wohnungssuche.'],
  1440: ['Die Mappe für die', 'Wohnungssuche.'],
};

async function kopfMessen(page: Page) {
  const h1 = await zeilen(page, '.kopf h1');
  const knopf = await page
    .locator('.kopf .im-browser .weg-knopf')
    .evaluate(
      (e) =>
        e.getBoundingClientRect().bottom *
        Number(getComputedStyle(document.documentElement).zoom || 1),
    );
  const ueberlauf = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  return { h1, knopf, ueberlauf };
}

for (const b of BREITEN) {
  test(`QA16: Kopf auf „/“ bei ${b.breite} px${b.zoom !== 1 ? ' mit 130 %' : ''}: Zeilen der Überschrift, „Mappe erstellen“ ${b.erstesBild ? 'im' : 'nicht zugesagt im'} ersten Bild`, async ({
    browser,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Zeilen und Maße in Chromium; WebKit unter Windows trennt Deutsch nicht',
    );
    const k = await browser.newContext({
      viewport: { width: b.breite, height: b.hoehe },
      userAgent: UA[b.ua],
    });
    const page = await k.newPage();
    await page.goto(`${WEB}/`);
    await page.evaluate(() => document.fonts.ready);
    if (b.zoom !== 1) {
      await page.evaluate(
        (z) => document.documentElement.style.setProperty('zoom', String(z)),
        b.zoom,
      );
      await page.waitForTimeout(100);
    }
    const m = await kopfMessen(page);
    expect(m.h1, `Zeilen bei ${b.breite} px`).toEqual(UEBERSCHRIFT[b.breite]);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
    if (b.erstesBild)
      expect(m.knopf, '„Mappe erstellen“ im ersten Bild').toBeLessThanOrEqual(b.hoehe);
    // Gegenprobe 1: Eine kleine Überschrift steht auf einer Zeile, der Vergleich der Zeilen fällt auf. (Größer hilft
    // nicht: Die Spalte wächst mit dem längsten Wort, die Umbrüche bleiben.)
    await regel(page, '.kopf h1{font-size:12px!important}');
    await page.waitForTimeout(50);
    expect((await kopfMessen(page)).h1).not.toEqual(UEBERSCHRIFT[b.breite]);
    // Gegenprobe 2: 600 px mehr über den Wegen schieben „Mappe erstellen“ aus dem ersten Bild.
    if (b.erstesBild) {
      await regel(page, '.kopf h1{font-size:revert!important}');
      await regel(page, '.kopf .wege{margin-top:600px!important}');
      await page.waitForTimeout(50);
      expect((await kopfMessen(page)).knopf).toBeGreaterThan(b.hoehe);
    }
    await k.close();
  });
}

test('QA16 am iPhone, 390 × 844: „Als App“ vorn im ersten Bild, „Mappe erstellen“ darunter', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Maße in Chromium');
  const k = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: UA.iphone,
  });
  const page = await k.newPage();
  await page.goto(`${WEB}/`);
  await page.evaluate(() => document.fonts.ready);
  const unten = (w: string) => page.locator(w).evaluate((e) => e.getBoundingClientRect().bottom);
  expect(await zeilen(page, '.kopf h1')).toEqual(UEBERSCHRIFT[390]);
  const app = await unten('.kopf .als-app .abz');
  const mappe = await unten('.kopf .im-browser .weg-knopf');
  expect(app).toBeLessThanOrEqual(844);
  // Stand 17.11.: „Mappe erstellen“ endet bei 879 px, unter dem ersten Bild (Befund für die CP).
  expect(mappe).toBeGreaterThan(app);
  await k.close();
});

// ---------------------------------------------------------------------------------------------------------------
// QA17: Favicon auf allen Seiten gleich F1 (DP63a); U9: Symbol für den Home-Bildschirm auf allen Seiten

/** SHA-256 der Dateien aus DP63a, favicon/F1/ (Wahl des Auftraggebers, PC85), je nach Art und Größe des Links. */
const F1: Record<string, string> = {
  'image/svg+xml': 'f8ac682e3647710196d6d84421a7e3c697dc7978f140f01770810cef68223d8d',
  'image/png 32x32': 'f50a4977f22971893b3dd7b9fd449076ba40b75b8887094a8e6c47878af6ddad',
  'image/png 16x16': 'd7b0d029220d53a4529e8f68412b923957b481ac3cac462ef6e95f65b131b8c0',
};

/** Welche Favicons nennt die Seite, und welche Prüfsumme hat die Datei, die hinter jedem Link liegt? */
async function favicons(page: Page) {
  const links = await page.locator('link[rel~="icon"]').evaluateAll((ls) =>
    ls.map((l) => ({
      art: [l.getAttribute('type'), l.getAttribute('sizes')].filter(Boolean).join(' '),
      ziel: (l as HTMLLinkElement).href,
    })),
  );
  const aus: { art: string; sha: string }[] = [];
  for (const l of links) {
    const antwort = await page.request.get(l.ziel);
    expect(antwort.status(), l.ziel).toBe(200);
    aus.push({
      art: l.art,
      sha: createHash('sha256')
        .update(await antwort.body())
        .digest('hex'),
    });
  }
  return aus;
}

const istF1 = (liste: { art: string; sha: string }[]) =>
  liste.length === 3 && liste.every((f) => F1[f.art] === f.sha);

test.describe('QA17 und U9', () => {
  test.use({ serviceWorkers: 'block' });

  for (const pfad of SEITEN) {
    test(`QA17: Favicon auf ${pfad} ist F1; U9: Symbol für den Home-Bildschirm`, async ({
      page,
    }) => {
      const antwort = await page.goto(`${WEB}${pfad}`);
      if (pfad === '/gibt-es-nicht/') expect(antwort!.status()).toBe(404);
      const liste = await favicons(page);
      expect(liste.map((f) => f.art).sort()).toEqual(Object.keys(F1).sort());
      expect(istF1(liste), JSON.stringify(liste)).toBe(true);
      // U9: dasselbe apple-touch-icon wie auf „/“, sonst nimmt iOS ein Bildschirmfoto.
      const symbol = page.locator('link[rel="apple-touch-icon"]');
      await expect(symbol).toHaveCount(1);
      const ziel = await symbol.evaluate((l: HTMLLinkElement) => new URL(l.href).pathname);
      expect(ziel.endsWith('/icons/apple-touch-icon.png'), ziel).toBe(true);
      expect((await page.request.get(`${WEB}${ziel}`)).status()).toBe(200);
    });
  }

  test('QA17, Gegenprobe: Mit dem App-Symbol als Favicon wird die Probe rot', async ({ page }) => {
    await page.goto(`${WEB}/ratgeber/`);
    expect(istF1(await favicons(page))).toBe(true);
    await page.evaluate(() => {
      document.querySelector<HTMLLinkElement>('link[rel~="icon"][sizes="32x32"]')!.href =
        '/icons/apple-touch-icon.png';
    });
    expect(istF1(await favicons(page))).toBe(false);
  });

  test('U9, Gegenprobe: Eine Seite ohne Symbol für den Home-Bildschirm fällt auf', async ({
    page,
  }) => {
    await page.goto(`${WEB}/ratgeber/`);
    await page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]')!.remove());
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// QA18: Listen mit fester Zahl. Gezählt werden sichtbare Einträge, nicht nur der Text.

/** Feste Listen auf „/“ nach PC84 und PC85. */
const LISTEN = [
  {
    name: 'Was Hefta nicht tut',
    wahl: '.nicht li',
    eintraege: ['Keine Werbung, kein Tracking', 'Verschickt nichts von selbst'],
  },
  {
    name: 'Jede Wohnung ein Heft',
    wahl: '.tut ol.weg > li',
    eintraege: ['Vorher', 'Gemerkt', 'Beworben', 'Danach'],
  },
  {
    name: 'Reiter im Kopf',
    wahl: 'header .reiter a',
    eintraege: ['Für Mieter', 'Für Vermieter', 'Ratgeber'],
  },
  // Die Reihenfolge der Wege setzt web/hefta.js je nach Gerät; hier zählt nur, welche und wie viele.
  {
    name: 'Zwei Wege',
    wahl: '.kopf .wege > .weg',
    eintraege: ['Als App', 'Im Browser'],
    ohneFolge: true,
  },
  {
    name: 'Fuß',
    wahl: 'footer nav a',
    eintraege: ['Impressum', 'Datenschutz', 'Rückmeldung', 'hallo@hefta.de'],
  },
] as const;

/** Sichtbare Einträge: mit Fläche, nicht versteckt; je der erste Text (Titel oder Reiter). */
const sichtbar = (page: Page, wahl: string) =>
  page.locator(wahl).evaluateAll((els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0;
      })
      .map((e) => {
        const kopf = e.querySelector(':scope > span, :scope > .weg-reiter') ?? e;
        return (kopf.textContent ?? '').replaceAll('­', '').replace(/\s+/g, ' ').trim();
      }),
  );

for (const [breite, hoehe] of [
  [390, 844],
  [1280, 800],
] as const) {
  test(`QA18: Listen mit fester Zahl auf „/“, ${breite} px`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: hoehe });
    await page.goto(`${WEB}/`);
    await page.locator('#mieter').scrollIntoViewIfNeeded();
    for (const l of LISTEN) {
      const ist = await sichtbar(page, l.wahl);
      expect(ist.length, `${l.name}: Zahl der Einträge`).toBe(l.eintraege.length);
      expect('ohneFolge' in l ? [...ist].sort() : ist, l.name).toEqual([...l.eintraege]);
    }
  });
}

test('QA18, Gegenprobe: ein dritter Eintrag bei „Was Hefta nicht tut“ und ein doppelter Schritt werden rot', async ({
  page,
}) => {
  await page.goto(`${WEB}/`);
  // Gleicher Text, ein Eintrag mehr: Ein Vergleich nur des Textes sähe das nicht.
  await page.evaluate(() => {
    const ul = document.querySelector('.nicht ul')!;
    ul.append(ul.lastElementChild!.cloneNode(true));
    const ol = document.querySelector('.tut ol.weg')!;
    ol.append(ol.lastElementChild!.cloneNode(true));
  });
  const nicht = await sichtbar(page, '.nicht li');
  expect(nicht.length).not.toBe(2);
  expect(new Set(nicht).size).toBe(2);
  expect((await sichtbar(page, '.tut ol.weg > li')).length).not.toBe(4);
  // Ein versteckter Eintrag zählt nicht mit.
  await regel(page, '.nicht li:first-child{visibility:hidden}');
  expect(await sichtbar(page, '.nicht li')).not.toContain('Keine Werbung, kein Tracking');
});

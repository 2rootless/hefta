import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { beobachten, fremde } from './hilfen';
import { pruefen } from './pruef-c';

// Die Website hefta.de (B22, Planung 13e, build/webseite.ts): Landingpage auf „/“, die Mappe unter /mappe/,
// der Ratgeber unter /ratgeber/. Geprüft wird Verhalten (E98): Wege je Gerät, Marke, Weiterleitungen, der
// alte Service Worker, Größe, Lesbarkeit. Ganze Sätze prüft hier nichts.

const WEB = 'http://localhost:4175';
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
  andere:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
};

const mieter = (page: Page) => page.locator('#mieter');
const wege = (page: Page) => mieter(page).locator('.wege');

test('Landingpage: eigenes HTML, nichts Fremdes, unter 150 KB beim ersten Aufruf', async ({
  page,
}) => {
  const beobachtung = beobachten(page);
  let groesse = 0;
  let stapel = 0;
  // Jede Datei zählt einmal: WebKit fragt dasselbe Bild des Stapels zweimal an, seit es auch im Blatt des
  // Beitrags steht (15.11.). Der Testserver schickt keine Angaben zum Zwischenspeichern; im Netz kommt es
  // beim zweiten Mal aus dem Speicher.
  const gezaehlt = new Set<string>();
  page.on('response', (r) => {
    void r
      .body()
      .then((b) => {
        if (gezaehlt.has(r.url())) return;
        gezaehlt.add(r.url());
        if (/\/mappe-seite-\d\.jpg$/.test(r.url())) stapel += b.length;
        else groesse += b.length;
      })
      .catch(() => {});
  });
  await page.goto(`${WEB}/`);
  await expect(mieter(page).getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(fremde(beobachtung.anfragen, WEB)).toEqual([]);
  expect(beobachtung.fehler).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check('700 20px Archivo'))).toBe(true);
  // Bericht 33, Abschnitt 5: erster Aufruf mit Schrift unter 150 KB, ohne die Bilder des Stapels.
  // DP34: Der Stapel selbst wiegt höchstens 95 KB (PC77 E155/3, vorher 90 KB; gemessen 94.136 Byte).
  // Zusammen sind es rund 215 KB; ob die Grenze damit neu gilt, ist Frage 1 in CP24.
  expect(groesse).toBeLessThan(150_000);
  expect(groesse).toBeGreaterThan(50_000);
  expect(stapel).toBeGreaterThan(0);
  expect(stapel).toBeLessThan(95_000);
  // Das Abzeichen von Apple ist geladen, hell wie dunkel.
  for (const schema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: schema });
    const bild = mieter(page).getByRole('link', { name: 'Laden im App Store' }).locator('img');
    await expect
      .poll(() => bild.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
    await expect
      .poll(() => bild.evaluate((i: HTMLImageElement) => i.currentSrc))
      .toContain(schema === 'dark' ? '/app-store-dunkel.svg' : '/app-store.svg');
  }
  // Smart App Banner und Link in den App Store tragen die Kennung von Hefta.
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
    'content',
    'app-id=6831939371',
  );
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  // Kein Platzhalter bleibt stehen.
  expect(await page.content()).not.toMatch(/%[A-Z_]+%|data-platzhalter|0000000000/);
});

// Wege oben (DP6, Planung PC5): je Gerät und Mappe, welcher Weg „dran“ ist, die Reihenfolge (auch im DOM, damit
// Fokus und Vorleser dem Bild folgen), das Abzeichen und genau ein Satz je Heft. Wortlaute prüft das nicht (E98).
const FAELLE = [
  { geraet: 'andere', marke: false, reihe: ['im-browser', 'als-app'], dran: 'im-browser' },
  { geraet: 'andere', marke: true, reihe: ['im-browser', 'als-app'], dran: 'im-browser' },
  { geraet: 'iphone', marke: false, reihe: ['als-app', 'im-browser'], dran: 'als-app' },
  { geraet: 'iphone', marke: true, reihe: ['im-browser', 'als-app'], dran: 'im-browser' },
  { geraet: 'android', marke: false, reihe: ['im-browser'], dran: 'im-browser' },
  { geraet: 'android', marke: true, reihe: ['im-browser'], dran: 'im-browser' },
] as const;

for (const f of FAELLE) {
  test(`Wege für ${f.geraet}, ${f.marke ? 'mit' : 'ohne'} Mappe`, async ({
    browser,
    browserName,
  }) => {
    const kontext = await browser.newContext({ userAgent: UA[f.geraet] });
    const page = await kontext.newPage();
    if (f.marke)
      await page.addInitScript(() => {
        localStorage.setItem('hefta.haushalt', 'ja');
      });
    await page.goto(`${WEB}/`);
    await expect(page.locator('html')).toHaveAttribute('data-geraet', f.geraet);
    // Reihenfolge der sichtbaren Hefte, im DOM wie im Bild.
    const reihe = await wege(page)
      .locator('section.weg:visible')
      .evaluateAll((s) =>
        s.map((e) => (e.classList.contains('als-app') ? 'als-app' : 'im-browser')),
      );
    expect(reihe).toEqual([...f.reihe]);
    // Genau ein Weg ist „dran“.
    await expect(wege(page).locator('section.weg.dran')).toHaveCount(1);
    await expect(wege(page).locator(`section.${f.dran}`)).toHaveClass(/\bdran\b/);
    // Je Heft genau ein Satz und genau ein Ziel.
    for (const art of f.reihe) {
      const heft = wege(page).locator(`section.${art}`);
      await expect(heft.locator('.weg-satz > span:visible, .weg-satz:not(:has(span))')).toHaveCount(
        1,
      );
      await expect(heft.locator('a:visible')).toHaveCount(1);
    }
    // DP32: unter Android ein eigener Satz zu Chrome, sonst der allgemeine.
    if (!f.marke)
      await expect(wege(page).locator('section.im-browser .weg-satz > span:visible')).toHaveText(
        f.geraet === 'android'
          ? 'Ohne Konto. Alles bleibt in Chrome auf diesem Gerät. Legt Hefta auf den Startbildschirm, dann räumt Chrome eure Unterlagen nicht so leicht weg, wenn der Speicher knapp wird.'
          : f.geraet === 'iphone'
            ? /^In Safari, ohne App\./
            : 'Ohne Installation. Eure Daten bleiben in diesem Browser. Unter Android legt ihr Hefta von hier auf den Startbildschirm.',
      );
    // DP32: „ein PDF“, nie „eine PDF“, „einer PDF“ oder „die PDF“.
    expect(await page.locator('body').innerText()).not.toMatch(/\b(eine|einer|die) PDF\b/);
    // Mit Mappe zeigt der Browser-Weg den Teil „Mappe öffnen“, ohne Mappe den Teil „anfangen“.
    const browserKnopf = wege(page).locator('section.im-browser a.weg-knopf');
    await expect(browserKnopf).toHaveAttribute('href', '/mappe/');
    await expect(browserKnopf.locator(f.marke ? '.nur-marke' : '.nur-neu')).toBeVisible();
    await expect(browserKnopf.locator(f.marke ? '.nur-neu' : '.nur-marke')).toBeHidden();
    // Abzeichen von Apple nur, wo der App-Weg steht; unter Android keins. Ohne Freigabe kein Google Play (E66).
    if (f.geraet === 'android') await expect(page.locator('a.abz:visible')).toHaveCount(0);
    else
      await expect(wege(page).locator('a.abz')).toHaveAttribute(
        'href',
        /apps\.apple\.com\/.*id6831939371$/,
      );
    await expect(page.locator('a.abz-play')).toHaveCount(0);
    // Fokus folgt dem Bild: vom ersten Ziel der Wege mit Tab zum nächsten. WebKit (Windows) springt mit Tab nicht
    // zu Links; dort reicht die Reihenfolge im DOM oben, die Taste prüft Chromium.
    if (browserName !== 'webkit') {
      const ziele = wege(page).locator('a:visible');
      const anzahl = await ziele.count();
      await ziele.first().focus();
      for (let i = 1; i < anzahl; i++) {
        await page.keyboard.press('Tab');
        await expect(ziele.nth(i)).toBeFocused();
      }
    }
    await kontext.close();
  });
}

test('W5 (PC77 E155/1): Auf „/“ steht kein Text in Akzent, hell wie dunkel; Gegenprobe wird rot', async ({
  browser,
}) => {
  for (const schema of ['light', 'dark'] as const) {
    const kontext = await browser.newContext({
      userAgent: UA.andere,
      viewport: { width: 1280, height: 860 },
      colorScheme: schema,
    });
    const page = await kontext.newPage();
    await page.goto(`${WEB}/`);
    await expect(wege(page).locator('section.im-browser.dran')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const jetzt = (await page.evaluate(pruefen)) as { c28: string[] };
    expect(jetzt.c28).toEqual([]);
    // Gegenprobe: Kicker, Überschrift und Reiter in Akzent werden rot (PC84: neuer Kopf).
    await page.evaluate(() => {
      const s = document.styleSheets[0]!;
      for (const regel of ['.kopf .kicker', '.kopf h1', '.wege>.weg.dran .weg-reiter'])
        s.insertRule(`${regel}{color:var(--akzent-text)!important}`, s.cssRules.length);
    });
    const frueher = (await page.evaluate(pruefen)) as { c28: string[] };
    expect(frueher.c28.map((t) => t.replaceAll('\u00ad', ''))).toEqual(
      expect.arrayContaining([
        'Kostenlos und ohne Konto',
        'Die Mappe für die Wohnungssuche.',
        'Im Browser',
      ]),
    );
    await kontext.close();
  }
});

test('Ohne Skript stehen beide Wege da, ohne „dran“', async ({ browser }) => {
  const kontext = await browser.newContext({ javaScriptEnabled: false });
  const page = await kontext.newPage();
  await page.goto(`${WEB}/`);
  await expect(wege(page).locator('section.im-browser a.weg-knopf')).toBeVisible();
  await expect(wege(page).locator('a.abz')).toBeVisible();
  await expect(wege(page).locator('section.weg.dran')).toHaveCount(0);
  await kontext.close();
});

test('Im Druck steht nur der Browser-Weg', async ({ page }) => {
  await page.goto(`${WEB}/`);
  await page.emulateMedia({ media: 'print' });
  await expect(wege(page).locator('section.als-app')).toBeHidden();
  await expect(wege(page).locator('section.im-browser')).toBeVisible();
});

test('Marke: Nach dem Anlegen eines Haushalts führt der Browser-Weg in die eigene Mappe', async ({
  page,
}) => {
  await page.goto(`${WEB}/`);
  await expect(wege(page).locator('.weg-knopf .nur-marke')).toBeHidden();
  await haushaltMitMax(page, `${WEB}/mappe/`);
  expect(await page.evaluate(() => localStorage.getItem('hefta.haushalt'))).toBe('ja');
  await page.goto(`${WEB}/`);
  await expect(page.locator('html')).toHaveAttribute('data-marke', 'ja');
  const oeffnen = wege(page).locator('section.im-browser a.weg-knopf');
  await expect(oeffnen.locator('.nur-marke')).toBeVisible();
  await oeffnen.click();
  await expect(page).toHaveURL(`${WEB}/mappe/`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test.describe('Weiterleitungen', () => {
  test('Alte Links mit „#/…“ führen in die Mappe', async ({ page }) => {
    await page.goto(`${WEB}/#/einstellungen/rechtliches`);
    await expect(page).toHaveURL(`${WEB}/mappe/#/einstellungen/rechtliches`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('Lesezeichen auf „/“ und Sprungmarken der Seite bleiben auf der Landingpage', async ({
    page,
  }) => {
    await page.goto(`${WEB}/#vermieter`);
    await expect(page).toHaveURL(`${WEB}/#vermieter`);
    await expect(page.locator('#vermieter h1')).toBeVisible();
  });

  test('Vom Home-Bildschirm gestartet: immer die Mappe', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'standalone', { get: () => true }),
    );
    await page.goto(`${WEB}/`);
    await expect(page).toHaveURL(`${WEB}/mappe/`);
  });

  test('Der Ratgeber zieht dauerhaft um (301)', async ({ request, page }) => {
    for (const alt of ['/was-darf-der-vermieter-verlangen', '/was-darf-der-vermieter-verlangen/']) {
      const antwort = await request.get(`${WEB}${alt}`, { maxRedirects: 0 });
      expect(antwort.status()).toBe(301);
      expect(antwort.headers().location).toBe('/ratgeber/was-darf-der-vermieter-verlangen/');
    }
    await page.goto(`${WEB}/was-darf-der-vermieter-verlangen/`);
    await expect(page).toHaveURL(`${WEB}/ratgeber/was-darf-der-vermieter-verlangen/`);
  });

  test('Unbekanntes bekommt die 404-Seite mit Weg zur Startseite', async ({ request }) => {
    const antwort = await request.get(`${WEB}/gibt-es-nicht`);
    expect(antwort.status()).toBe(404);
    expect(await antwort.text()).toContain('href="/"');
  });
});

test('Links der Landingpage führen zu Seiten, die es gibt', async ({ page, request }) => {
  await page.goto(`${WEB}/`);
  const ziele = await page
    .locator('a[href^="/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  expect(ziele).toEqual(
    expect.arrayContaining([
      '/mappe/',
      '/impressum/',
      '/datenschutz/',
      '/rueckmeldung/',
      '/beispiel-mappe.pdf',
    ]),
  );
  for (const ziel of ziele) expect((await request.get(`${WEB}${ziel}`)).status(), ziel).toBe(200);
});

test('Ratgeber: Übersicht mit dem Beitrag, Impressum als eigene Seite', async ({ page }) => {
  const beobachtung = beobachten(page);
  await page.goto(`${WEB}/ratgeber/`);
  await expect(page.locator('script')).toHaveCount(0);
  await page.getByRole('link', { name: /Was darf der Vermieter verlangen/ }).click();
  await expect(page).toHaveURL(`${WEB}/ratgeber/was-darf-der-vermieter-verlangen/`);
  // DP36: Kopf und Fuß wie die Landingpage; „Hefta öffnen“ führt zur Mappe, „Zurück“ zur Übersicht.
  await expect(page.getByRole('link', { name: 'Hefta öffnen' })).toHaveAttribute('href', '/mappe/');
  await expect(page.locator('main a.zurueck')).toHaveAttribute('href', '/#ratgeber');
  await expect(page.locator('.reiter .r-verm')).toHaveAttribute('href', '/#vermieter');
  await expect(page.locator('footer a[href="/impressum/"]')).toBeVisible();
  await page.goto(`${WEB}/impressum/`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('main a[href="mailto:hallo@hefta.de"]')).toBeVisible();
  expect(fremde(beobachtung.anfragen, WEB)).toEqual([]);
});

test('Der frühere Service Worker auf „/“ räumt auf und meldet sich ab; der der Mappe bleibt', async ({
  page,
  browserName,
}) => {
  await page.goto(`${WEB}/mappe/`);
  const mitWorker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  test.skip(!mitWorker, `Kein Service Worker in ${browserName}`);
  await page.goto(`${WEB}/`);
  // So sah es bei Besuchern der früheren Mappe auf „/“ aus: ihr Zwischenspeicher und ein Worker für „/“.
  await page.evaluate(async () => {
    await caches.open('hefta-0123456789ab');
    await caches.open('kalender');
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
  await expect
    .poll(
      () =>
        page
          .evaluate(async () => ({
            speicher: (await caches.keys()).sort(),
            worker: (await navigator.serviceWorker.getRegistrations()).map(
              (r) => new URL(r.scope).pathname,
            ),
          }))
          .catch(() => null),
      { timeout: 20_000 },
    )
    .toEqual({
      speicher: expect.arrayContaining(['kalender']) as unknown,
      worker: ['/mappe/'],
    });
  const speicher = await page.evaluate(() => caches.keys());
  expect(speicher).not.toContain('hefta-0123456789ab');
  expect(speicher.some((n) => n.startsWith('hefta-mappe-'))).toBe(true);
});

const THEMEN = ['light', 'dark'] as const;
for (const thema of THEMEN) {
  test(`Lesbar und ohne Überlauf: 320 px mit 130 %, 390, 700, 760, 1280, 1440, ${thema}`, async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Maße und axe in Chromium');
    // Je Gerät ein eigener Kontext: Die Wege oben hängen am Gerät (DP6).
    const kontexte: Record<string, Awaited<ReturnType<typeof browser.newContext>>> = {};
    const seite = async (ua: keyof typeof UA) => {
      kontexte[ua] ??= await browser.newContext({ colorScheme: thema, userAgent: UA[ua] });
      return kontexte[ua].pages()[0] ?? (await kontexte[ua].newPage());
    };
    for (const [breite, hoehe, zoom, ua] of [
      [320, 568, 1.3, 'andere'],
      [320, 568, 1.3, 'iphone'],
      [320, 568, 1.3, 'android'],
      [390, 844, 1, 'andere'],
      [700, 900, 1, 'andere'],
      [760, 900, 1, 'andere'],
      [1280, 800, 1, 'andere'],
      [1440, 900, 1, 'andere'],
    ] as const) {
      const page = await seite(ua);
      await page.setViewportSize({ width: breite, height: hoehe });
      for (const pfad of ua === 'andere'
        ? ['/', '/#vermieter', '/ratgeber/', '/impressum/']
        : ['/']) {
        await page.goto(`${WEB}${pfad}`);
        await page.evaluate(() => document.fonts.ready);
        if (zoom !== 1)
          await page.evaluate(
            (z) => document.documentElement.style.setProperty('zoom', String(z)),
            zoom,
          );
        await page.waitForTimeout(100);
        const ort = `${pfad} ${breite}${zoom !== 1 ? ' 130 %' : ''} ${ua}`;
        // Nichts ragt seitlich aus der Seite.
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
          ort,
        ).toBeLessThanOrEqual(0);
        // Die Prüfungen des Katalogs gelten für Telefone; am Rechner reicht: nichts ragt hinaus (oben).
        if (breite > 760) continue;
        const r = (await page.evaluate(pruefen)) as Record<string, unknown>;
        // Links im Fließtext (hallo@hefta.de) sind nach WCAG 2.5.8 von der Mindestgröße ausgenommen.
        const imText = await page.locator('main p a').allInnerTexts();
        r.c5 = (r.c5 as string[]).filter((f) => !imText.some((t) => f.startsWith(t.slice(0, 30))));
        const fehler = Object.entries(r).filter(
          ([k, v]) => k !== 'hoehe' && (Array.isArray(v) ? v.length : !!v),
        );
        expect(fehler, ort).toEqual([]);
      }
    }
    for (const [pfad, ua] of [
      ['/', 'andere'],
      ['/', 'iphone'],
      ['/', 'android'],
      ['/#vermieter', 'andere'],
      ['/ratgeber/', 'andere'],
    ] as const) {
      const page = await seite(ua);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${WEB}${pfad}`);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        axe.violations.map((v) => v.id),
        `${pfad} ${ua}`,
      ).toEqual([]);
    }
    for (const k of Object.values(kontexte)) await k.close();
  });
}

// B30 (PC7, DP15): Klemmmappe, Deckblatt und Zeichen; Papier bleibt im Dunkeln Papier.
for (const thema of THEMEN) {
  test(`DP34: Mappe als Stapel an allen drei Stellen, nichts ragt heraus, nichts springt, ${thema}`, async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Maße in Chromium');
    const kontext = await browser.newContext({ colorScheme: thema });
    const page = await kontext.newPage();
    for (const [breite, hoehe, zoom, pfad, erwartet] of [
      [1280, 800, 1, '/', ['g-deck', 'g-stapel']],
      [390, 844, 1, '/', ['g-deck', 'g-stapel']],
      [320, 568, 1.3, '/', ['g-deck', 'g-stapel']],
      [1280, 800, 1, '/#vermieter', ['g-deck']],
      [390, 844, 1, '/#vermieter', ['g-deck']],
    ] as const) {
      await page.setViewportSize({ width: breite, height: hoehe });
      await page.goto(`${WEB}${pfad}`);
      if (zoom !== 1)
        await page.evaluate(
          (z) => document.documentElement.style.setProperty('zoom', String(z)),
          zoom,
        );
      await page.evaluate(() => document.fonts.ready);
      // Jeden sichtbaren Stapel ins Bild holen: Die Seiten dahinter laden erst dann (loading="lazy").
      for (const f of await page.locator('figure.mappe-stapel:visible').all()) {
        await f.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            f.evaluate((x) =>
              [...x.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0),
            ),
          )
          .toBe(true);
      }
      const stapel = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('figure.mappe-stapel')]
          .filter((s) => s.getBoundingClientRect().width > 0)
          .map((s) => {
            const r = s.getBoundingClientRect();
            const bilder = [...s.querySelectorAll('img')];
            // Gedrehte Seiten: Die Ecken liegen innerhalb des Bausteins (1 px Rand für Kanten).
            const drin = bilder.every((b) => {
              const q = b.getBoundingClientRect();
              return (
                q.left >= r.left - 1 &&
                q.top >= r.top - 1 &&
                q.right <= r.right + 1 &&
                q.bottom <= r.bottom + 1
              );
            });
            return {
              art: s.classList.contains('g-stapel') ? 'g-stapel' : 'g-deck',
              label: s.getAttribute('aria-label') ?? '',
              bilder: bilder.length,
              masse: bilder.every(
                (b) => b.getAttribute('width') === '520' && b.getAttribute('height') === '735',
              ),
              alt: bilder.every((b) => b.getAttribute('alt') === ''),
              vornSofort: bilder.at(-1)?.getAttribute('loading') !== 'lazy',
              drin,
              hoeheZuBreite: r.height / r.width,
              papier: [...new Set(bilder.map((b) => getComputedStyle(b).backgroundColor))],
              animiert: s.getAnimations({ subtree: true }).length,
              breite: r.width,
            };
          }),
      );
      const ort = `${pfad} ${breite} ${zoom} ${thema}`;
      expect(stapel.map((s) => s.art).sort(), ort).toEqual([...erwartet]);
      for (const s of stapel) {
        expect(s.label, ort).toMatch(/^Beispiel einer Mappe: vorn das Deckblatt/);
        expect(s.bilder, ort).toBe(4);
        expect(s.masse, ort).toBe(true);
        expect(s.alt, ort).toBe(true);
        expect(s.vornSofort, ort).toBe(true);
        expect(s.drin, `${s.art} ${ort}`).toBe(true);
        // Der Platz steht vorher fest (420 : 430): Beim Laden der Bilder springt nichts.
        expect(s.hoeheZuBreite, ort).toBeCloseTo(430 / 420, 2);
        // Das Papier ist in beiden Themen weiß.
        expect(s.papier, ort).toEqual(['rgb(255, 255, 255)']);
        expect(s.animiert, ort).toBe(0);
        expect(s.breite, ort).toBeGreaterThan(100);
        expect(s.breite, ort).toBeLessThanOrEqual(420);
      }
    }
    await page.goto(`${WEB}/`);
    const text = await page.locator('#mieter').innerHTML();
    for (const w of [
      'Musterweg 7, gemerkt',
      'Lindenring 8, beworben',
      // PC84 (U4): „Nur, was Vermieter fragen dürfen“ statt „Nichts Unzulässiges“ (DP36).
      '<i>Mappe</i><h3>Nur, was Vermieter fragen dürfen</h3>',
      '<i>Heft</i><h3>Wohnungen sammeln</h3>',
      '<i>Abschicken</i><h3>Wie das Inserat es will</h3>',
      // DP32: „Wer was hat“ statt „Datenspur“.
      '<i>Wer was hat</i><h3>Wissen, wer was von euch hat</h3>',
    ])
      expect(text).toContain(w);
    for (const w of ['Altbau mit Garten', 'Neubau mit Aufzug', 'M8 6h16v20l-8-5-8 5z'])
      expect(text).not.toContain(w);
    await page.emulateMedia({ media: 'print' });
    // Im Druck kein Stapel (DP34).
    expect(await page.locator('.g-mappe:visible').count()).toBe(0);
    await kontext.close();
  });
}

test('Auftraggeber 15.11.: Die Reiter wechseln auf derselben Höhe, ohne Sprung zum Abschnitt', async ({
  page,
}) => {
  for (const breite of [1280, 390]) {
    await page.setViewportSize({ width: breite, height: 800 });
    await page.goto(`${WEB}/`);
    const reiter = page.getByRole('navigation', { name: 'Für wen' });
    for (const [name, start] of [
      ['Für Vermieter', 0],
      ['Für Mieter', 0],
      ['Für Vermieter', 60],
      // Seit dem 15.11. auch der Ratgeber: ein drittes Blatt, ohne Laden einer neuen Seite.
      ['Ratgeber', 0],
      ['Für Mieter', 0],
      ['Ratgeber', 60],
    ] as const) {
      await page.evaluate((y) => window.scrollTo(0, y), start);
      // Ohne das Scrollen, das Playwright vor einem Klick macht: Es verfälschte die Höhe.
      await reiter.getByRole('link', { name }).dispatchEvent('click');
      await expect(reiter.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
      await page.waitForTimeout(150);
      // Ist der andere Abschnitt kürzer, steht die Seite so weit unten, wie es geht.
      const { y, max } = await page.evaluate(() => ({
        y: Math.round(window.scrollY),
        max: Math.max(0, Math.floor(document.documentElement.scrollHeight - window.innerHeight)),
      }));
      expect(Math.abs(y - Math.min(start, max)), `${name} ${breite}: ${y}`).toBeLessThanOrEqual(1);
    }
    // Das zuletzt gewählte Blatt steht wirklich da.
    await expect(page.getByRole('heading', { level: 1, name: /^Ratgeber$/ })).toBeVisible();
  }
});

test('Auftraggeber 15.11.: Zum Ratgeber und zurück bleiben die Reiter an ihrem Platz', async ({
  page,
}) => {
  for (const breite of [1280, 390]) {
    await page.setViewportSize({ width: breite, height: 800 });
    await page.goto(`${WEB}/`);
    const reiter = page.getByRole('navigation', { name: 'Für wen' });
    const lage = async () =>
      page.evaluate(() => ({
        y: Math.round(window.scrollY),
        oben: Math.round(document.querySelector('.reiter .r-rat')!.getBoundingClientRect().top),
      }));
    const vorher = await lage();
    // Merkzeichen im Fenster: Es verschwindet, sobald eine neue Seite lädt.
    await page.evaluate(() => ((window as unknown as { gleich: boolean }).gleich = true));
    const geladen = () => page.evaluate(() => !(window as unknown as { gleich?: boolean }).gleich);
    for (const [name, url, h1] of [
      ['Ratgeber', `${WEB}/#ratgeber`, /^Ratgeber$/],
      ['Für Vermieter', `${WEB}/#vermieter`, /vermieten\?$/],
      ['Ratgeber', `${WEB}/#ratgeber`, /^Ratgeber$/],
      ['Für Mieter', `${WEB}/#mieter`, /^Die Mappe für die Wohnungs.?suche\.$/],
    ] as const) {
      await reiter.getByRole('link', { name }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
      await page.waitForTimeout(250);
      // Kein Laden, kein Sprung: Die Seite steht oben, die Reiter dort, wo sie waren.
      expect(await geladen(), `${name} ${breite}: neu geladen`).toBe(false);
      expect(await lage(), `${name} ${breite}`).toEqual(vorher);
    }
    // Auch der Beitrag ist keine eigene Seite: Er öffnet sich als Blatt, ohne Laden, oben.
    await reiter.getByRole('link', { name: 'Ratgeber' }).click();
    await page.getByRole('link', { name: /Was darf der Vermieter verlangen/ }).click();
    await expect(page).toHaveURL(`${WEB}/#was-darf-der-vermieter-verlangen`);
    const titel = page.getByRole('heading', {
      level: 1,
      name: 'Was darf der Vermieter verlangen?',
    });
    await expect(titel).toBeVisible();
    await expect(reiter.getByRole('link', { name: 'Ratgeber' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.waitForTimeout(250);
    expect(await geladen(), `Beitrag ${breite}: neu geladen`).toBe(false);
    expect(await lage(), `Beitrag ${breite}`).toEqual(vorher);
    // Ein Sprung zu einem Abschnitt lässt den Beitrag offen.
    if (breite > 760) {
      await page
        .getByRole('navigation', { name: 'Auf dieser Seite' })
        .getByRole('link', { name: 'Quellen' })
        .click();
      await expect(page.getByRole('heading', { level: 2, name: 'Quellen' })).toBeInViewport();
      await expect(titel).toBeAttached();
      await expect(page.locator('.blatt-artikel')).toBeVisible();
      await expect(reiter.getByRole('link', { name: 'Ratgeber' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    // „Zurück“ führt auf die Liste, oben, ohne Laden.
    await page.locator('.blatt-artikel a.zurueck').click();
    await expect(page).toHaveURL(`${WEB}/#ratgeber`);
    await expect(page.getByRole('heading', { level: 1, name: /^Ratgeber$/ })).toBeVisible();
    await page.waitForTimeout(250);
    expect(await geladen(), `zurück ${breite}: neu geladen`).toBe(false);
    expect(await lage(), `zurück ${breite}`).toEqual(vorher);
  }
});

// PC40: Datenschutz, Impressum und Rückmeldung im Rahmen der Landingpage, ohne aufgeschlagenen Reiter.
for (const thema of THEMEN) {
  test(`PC40: Datenschutz, Impressum, Rückmeldung mit Kopf und Fuß der Landingpage, ${thema}`, async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Maße und axe in Chromium');
    for (const breite of [320, 390, 768, 1280]) {
      const k = await browser.newContext({
        viewport: { width: breite, height: 800 },
        colorScheme: thema,
      });
      const page = await k.newPage();
      for (const [pfad, h1] of [
        ['/datenschutz/', 'Datenschutzerklärung'],
        ['/impressum/', /Impressum/],
        ['/rueckmeldung/', 'Vier kurze Fragen'],
      ] as const) {
        await page.goto(`${WEB}${pfad}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
        const reiter = page.getByRole('navigation', { name: 'Für wen' });
        await expect(reiter.getByRole('link')).toHaveCount(3);
        await expect(reiter.locator('[aria-current]')).toHaveCount(0);
        // Auch im Bild ist kein Reiter aufgeschlagen: alle drei in derselben Farbe.
        const flaechen = await reiter
          .getByRole('link')
          .evaluateAll((l) => l.map((a) => getComputedStyle(a).backgroundColor));
        expect(new Set(flaechen).size, pfad).toBe(1);
        await expect(
          page.getByRole('navigation', { name: 'Rechtliches und Kontakt' }).getByRole('link'),
        ).toHaveCount(4);
        const ueber = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(ueber, `${pfad} ${breite}`).toBeLessThanOrEqual(0);
        if (breite === 390) {
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            axe.violations.map((v) => v.id),
            pfad,
          ).toEqual([]);
        }
      }
      // Die Rückmeldung geht weiter: Erst eine Wahl macht „Abschicken“ frei.
      await expect(page.getByRole('button', { name: 'Abschicken' })).toBeDisabled();
      await page.getByRole('radio', { name: 'Suche im Netz' }).check();
      await expect(page.getByRole('button', { name: 'Abschicken' })).toBeEnabled();
      await k.close();
    }
  });
}

test('Auftraggeber 15.11.: Der Weg zur App steht im ersten Bild, am iPhone und am Rechner', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Maße in Chromium');
  for (const [ua, breite, hoehe, knopf] of [
    ['iphone', 390, 844, '.als-app .abz'],
    ['iphone', 375, 812, '.als-app .abz'],
    ['andere', 1280, 800, '.als-app .abz'],
    ['andere', 1280, 800, '.im-browser .weg-knopf'],
  ] as const) {
    const k = await browser.newContext({
      viewport: { width: breite, height: hoehe },
      userAgent: UA[ua],
    });
    const page = await k.newPage();
    await page.goto(`${WEB}/`);
    await page.evaluate(() => document.fonts.ready);
    const unten = await page
      .locator(`.kopf ${knopf}`)
      .evaluate((e) => e.getBoundingClientRect().bottom);
    expect(unten, `${knopf} ${breite}×${hoehe}`).toBeLessThanOrEqual(hoehe);
    await k.close();
  }
});

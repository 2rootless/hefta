import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// wunsch-W34 und wunsch-W35 (Wunschliste Fassung 19) mit dem Prüfkatalog aus DP63a (PC85): LG1, LG3, FV1 bis FV4.
// LG2 (Vermieterseite) prüft der Zweig der Vermieterseite. Die Gegenprobe FV3 folgt werkzeug/tabs.py aus DP63a:
// jedes Favicon bei 32 px auf hellem und dunklem Tab gegen das App-Symbol; unter 25 von 255 gilt es als App-Symbol.

const WEB = 'http://localhost:4175';
const VERMIETER = 'http://localhost:4174';

const datenUrl = (pfad: string) => {
  const typ = pfad.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  return `data:${typ};base64,${readFileSync(pfad).toString('base64')}`;
};
/** Das App-Symbol, wie es Hefta im Browser auf dem Home-Bildschirm zeigt (bleibt nach DP63a). */
const APP_SYMBOL = 'public/icons/apple-touch-icon.png';
/** Die Favicons der vier Websites: hefta.de mit Ratgeber, „/mappe/“ und die Vermieterseite. */
const FAVICONS = [
  'dist-web/icons/favicon.svg',
  'dist-web/icons/favicon-32.png',
  'dist-web/icons/favicon-16.png',
  'dist/icons/favicon.svg',
  'dist/icons/favicon-32.png',
  'dist/icons/favicon-16.png',
  'dist-vermieter/icons/favicon.svg',
  'dist-vermieter/icons/favicon-32.png',
  'dist-vermieter/icons/favicon-16.png',
];
const TAB = { light: '#ffffff', dark: '#35363a' } as const;
const GRENZE = 25;

/** Mittlere Abweichung je Farbkanal (0 bis 255), beide Bilder bei 32 px auf dem Tab gezeichnet (tabs.py). */
async function abweichung(page: Page, a: string, b: string, tab: string): Promise<number> {
  return page.evaluate(
    async ([x, y, grund]) => {
      const pixel = async (url: string) => {
        const bild = new Image();
        bild.src = url;
        await bild.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const g = c.getContext('2d')!;
        g.fillStyle = grund!;
        g.fillRect(0, 0, 32, 32);
        g.drawImage(bild, 0, 0, 32, 32);
        return g.getImageData(0, 0, 32, 32).data;
      };
      const [p, q] = [await pixel(x!), await pixel(y!)];
      let summe = 0;
      for (let i = 0; i < p.length; i += 4)
        for (let k = 0; k < 3; k++) summe += Math.abs(p[i + k]! - q[i + k]!);
      return summe / ((p.length / 4) * 3);
    },
    [a, b, tab],
  );
}

/** Rot, wenn das Bild das App-Symbol ist: gleiche Datei oder unter der Grenze auf einem der beiden Tabs. */
async function istAppSymbol(page: Page, pfad: string): Promise<boolean> {
  if (readFileSync(pfad).equals(readFileSync(APP_SYMBOL))) return true;
  for (const schema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: schema });
    if ((await abweichung(page, datenUrl(pfad), datenUrl(APP_SYMBOL), TAB[schema])) < GRENZE)
      return true;
  }
  return false;
}

test('wunsch-W34 (FV3): Die Favicons aller vier Websites sind nicht das App-Symbol; Gegenprobe wird rot', async ({
  page,
}) => {
  await page.setContent('<p>Probe</p>');
  for (const f of FAVICONS) expect(await istAppSymbol(page, f), f).toBe(false);
  // Gegenprobe (tabs.py): das App-Symbol selbst und das frühere Favicon (das App-Symbol im Tab) werden rot.
  expect(await istAppSymbol(page, APP_SYMBOL)).toBe(true);
  expect(await istAppSymbol(page, 'design/logo/favicon.svg')).toBe(true);
});

test('FV1: Das Zeichen ist bei 16 und 32 px auf hellem und dunklem Tab zu sehen', async ({
  page,
  browserName,
}) => {
  await page.setContent('<p>Probe</p>');
  for (const schema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: schema });
    // Safari nimmt das PNG (DP63a, FV2); WebKit zeichnet ein SVG als Bild immer hell. Das SVG prüft Chromium.
    for (const f of FAVICONS.filter((x) => browserName === 'chromium' || x.endsWith('.png'))) {
      for (const px of [16, 32]) {
        // Anteil der Pixel, die sich deutlich vom Tab abheben (mindestens 3 : 1 Kontrast).
        const anteil = await page.evaluate(
          async ([url, grund, n]) => {
            const bild = new Image();
            bild.src = url!;
            await bild.decode();
            const c = document.createElement('canvas');
            c.width = c.height = Number(n);
            const g = c.getContext('2d')!;
            g.fillStyle = grund!;
            g.fillRect(0, 0, c.width, c.height);
            g.drawImage(bild, 0, 0, c.width, c.height);
            const d = g.getImageData(0, 0, c.width, c.height).data;
            const lum = (r: number, gr: number, b: number) => {
              const k = (v: number) => {
                const x = v / 255;
                return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * k(r) + 0.7152 * k(gr) + 0.0722 * k(b);
            };
            const lt = lum(d[0]!, d[1]!, d[2]!);
            let deutlich = 0;
            for (let i = 0; i < d.length; i += 4) {
              const l = lum(d[i]!, d[i + 1]!, d[i + 2]!);
              if ((Math.max(l, lt) + 0.05) / (Math.min(l, lt) + 0.05) >= 3) deutlich++;
            }
            return deutlich / (d.length / 4);
          },
          [datenUrl(f), TAB[schema], String(px)],
        );
        expect(anteil, `${f} ${px} px ${schema}`).toBeGreaterThan(0.08);
      }
    }
  }
});

test('FV2: Das SVG folgt dem Tab (dunkles Zeichen hell, helles Zeichen dunkel); die PNG tragen beide', async ({
  page,
  browserName,
}) => {
  const strich = async (schema: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: schema });
    await page.setContent('<p>Probe</p>');
    return page.evaluate(async (url) => {
      const bild = new Image();
      bild.src = url;
      await bild.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      g.drawImage(bild, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      let summe = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3]! > 200) {
          summe += (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
          n++;
        }
      return summe / n;
    }, datenUrl('dist-web/icons/favicon.svg'));
  };
  // Browser mit SVG-Favicon (Chrome, Edge, Firefox); Safari nimmt das PNG, das FV1 auf beiden Tabs prüft.
  if (browserName === 'chromium') {
    expect(await strich('light')).toBeLessThan(80);
    expect(await strich('dark')).toBeGreaterThan(180);
  }
  // Jede Seite nennt das SVG und die PNG für Browser ohne SVG (Safari).
  for (const s of [
    `${WEB}/`,
    `${WEB}/ratgeber/`,
    `${WEB}/impressum/`,
    `${WEB}/mappe/`,
    `${VERMIETER}/`,
  ]) {
    await page.goto(s);
    const links = await page
      .locator('link[rel="icon"]')
      .evaluateAll((ls) =>
        ls.map((l) => (l as HTMLLinkElement).getAttribute('href')!.replace(/^\./, '')),
      );
    expect(links, s).toEqual([
      '/icons/favicon.svg',
      '/icons/favicon-32.png',
      '/icons/favicon-16.png',
    ]);
  }
});

test('FV4: Auf dem Home-Bildschirm bleibt Hefta im Browser das App-Symbol', async ({ page }) => {
  await page.setContent('<p>Probe</p>');
  expect(await istAppSymbol(page, 'dist-web/icons/apple-touch-icon.png')).toBe(true);
  const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8')) as {
    icons: { src: string; purpose?: string }[];
  };
  // Das Symbol für „maskable“ hat einen Schutzrand fürs Zuschneiden; verglichen werden die Symbole für „any“.
  const fuerAlle = manifest.icons.filter((i) => !i.purpose?.includes('maskable'));
  expect(fuerAlle.length).toBeGreaterThan(0);
  for (const i of fuerAlle)
    expect(await istAppSymbol(page, `dist/${i.src.replace(/^\.?\//, '')}`), i.src).toBe(true);
  for (const s of [`${WEB}/`, `${WEB}/mappe/`]) {
    await page.goto(s);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      /icons\/apple-touch-icon\.png$/,
    );
  }
});

/** Zeigt der Kopf das Logo? Ein Bild mit dem Logo der Marke. */
const kopfMitLogo = (page: Page) =>
  page.evaluate(() => {
    const kopf = document.querySelector('header');
    if (!kopf) return false;
    return !!kopf.querySelector('img[src*="logo"]');
  });

const SEITEN_WEB = [
  '/',
  '/ratgeber/',
  '/ratgeber/was-darf-der-vermieter-verlangen/',
  '/impressum/',
  '/datenschutz/',
  '/rueckmeldung/',
];

test('wunsch-W35: Der Kopf jeder Website zeigt das Logo; Gegenprobe: ein Kopf ohne Logo wird rot', async ({
  page,
}) => {
  const ohne: string[] = [];
  for (const s of [...SEITEN_WEB.map((p) => `${WEB}${p}`), `${VERMIETER}/`]) {
    await page.goto(s);
    if (!(await kopfMitLogo(page))) ohne.push(s);
  }
  expect(ohne).toEqual([]);
  // „/mappe/“ zeigt das Logo oben in der App (Logo.svelte), ohne eigenes header-Element.
  await page.goto(`${WEB}/mappe/`);
  await expect(page.locator('.logo img:visible')).toHaveCount(1);
  // Gegenprobe: der frühere Kopf mit Haus-Zeichen und „hefta“ als Text.
  await page.setContent(
    '<header><a href="/"><svg width="26" height="26"><path d="M6 13.5L16 5"/></svg><span>hefta</span></a></header>',
  );
  expect(await kopfMitLogo(page)).toBe(false);
});

for (const schema of ['light', 'dark'] as const) {
  test(`LG1, LG3: Logo 30 px, kein Überlauf, mindestens 8 px Abstand, Link „Hefta, zur Startseite“, ${schema}`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Maße in Chromium');
    await page.emulateMedia({ colorScheme: schema });
    for (const [breite, zoom] of [
      [390, 1],
      [320, 1.3],
      [1280, 1],
    ] as const) {
      await page.setViewportSize({ width: breite, height: 800 });
      for (const pfad of SEITEN_WEB) {
        await page.goto(`${WEB}${pfad}`);
        await page.evaluate(() => document.fonts.ready);
        if (zoom !== 1)
          await page.evaluate(
            (z) => document.documentElement.style.setProperty('zoom', String(z)),
            zoom,
          );
        const ort = `${pfad} ${breite}${zoom !== 1 ? ' 130 %' : ''} ${schema}`;
        const m = await page.evaluate((z) => {
          const img = document.querySelector<HTMLImageElement>('header.oben .logo-kopf img')!;
          const r = img.getBoundingClientRect();
          const nav = document.querySelector('header.oben nav')!.getBoundingClientRect();
          const abstand = Math.max(nav.left - r.right, nav.top - r.bottom, r.left - nav.right);
          return {
            hoehe: getComputedStyle(img).height,
            geladen: img.complete && img.naturalWidth > 0,
            quelle: img.currentSrc.split('/').pop(),
            abstand: Math.round(abstand / z),
            ueber: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }, zoom);
        expect(m.hoehe, ort).toBe('30px');
        expect(m.geladen, ort).toBe(true);
        expect(m.quelle, ort).toBe(schema === 'dark' ? 'hefta-logo-dunkel.svg' : 'hefta-logo.svg');
        expect(m.abstand, ort).toBeGreaterThanOrEqual(8);
        expect(m.ueber, ort).toBeLessThanOrEqual(0);
        // LG3: Der Link heißt „Hefta, zur Startseite“; das Haus wird nicht extra vorgelesen.
        const link = page.getByRole('banner').getByRole('link', { name: 'Hefta, zur Startseite' });
        await expect(link, ort).toHaveCount(1);
        await expect(link.getByRole('img'), ort).toHaveAccessibleName('Hefta');
        await expect(page.locator('header.oben svg'), ort).toHaveCount(0);
      }
      // „/mappe/“ bleibt: Logo 30 px.
      await page.goto(`${WEB}/mappe/`);
      if (zoom !== 1)
        await page.evaluate(
          (z) => document.documentElement.style.setProperty('zoom', String(z)),
          zoom,
        );
      await expect(page.locator('.logo img:visible')).toHaveCSS('height', '30px');
    }
  });
}

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { beobachten, fremde, serviceWorkerBereit } from './hilfen';
import { pruefen } from './pruef-c';

// Die Ratgeberseite im Browser (design/ratgeber.md): Die Regeln RG1 bis RG6 stehen in build/ratgeber.test.ts.
// Hier: kein Skript und keine fremden Anfragen, die App schiebt sich nicht davor, C1 bis C26 und die Bögen.

const SEITEN = [
  {
    id: 'RG1-mieter',
    url: 'http://localhost:4173/was-darf-der-vermieter-verlangen/',
    titel: 'Was darf der Vermieter verlangen?',
  },
  {
    id: 'RG2-vermieter',
    url: 'http://localhost:4174/welche-unterlagen-wann/',
    titel: 'Welche Unterlagen wann: die drei Schritte',
  },
];

for (const s of SEITEN) {
  test(`${s.id}: fertiges HTML, nichts Fremdes, barrierefrei`, async ({ page, browserName }) => {
    const beobachtung = beobachten(page);
    await page.goto(s.url);
    await expect(page.getByRole('heading', { level: 1, name: s.titel })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).not.toHaveCount(0);
    await expect(page.locator('script')).toHaveCount(0);
    await expect(page.getByText(/Ein Hinweis, keine Rechtsberatung/)).toBeVisible();
    expect(fremde(beobachtung.anfragen, s.url)).toEqual([]);
    expect(beobachtung.fehler).toEqual([]);
    expect(await page.evaluate(() => document.fonts.check('800 20px Archivo'))).toBe(true);
    if (browserName === 'chromium') {
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);
    }
  });
}

test('Die App schiebt sich nicht vor den Ratgeber, auch mit Service Worker', async ({
  page,
  browserName,
}) => {
  await page.goto('http://localhost:4173/');
  test.skip(!(await serviceWorkerBereit(page)), `Kein Service Worker in ${browserName}`);
  await page.goto(SEITEN[0]!.url);
  await expect(page.getByRole('heading', { level: 1, name: SEITEN[0]!.titel })).toBeVisible();
  await expect(page.locator('script')).toHaveCount(0);
});

test('Die Vermieter-Seite führt zum Ratgeber, und der zurück', async ({ page }) => {
  await page.goto('http://localhost:4174/#/schritte');
  await page.getByRole('link', { name: 'Der ganze Ratgeber für Vermieter' }).click();
  await expect(page.getByRole('heading', { level: 1, name: SEITEN[1]!.titel })).toBeVisible();
  await page.getByRole('link', { name: 'Mappen prüfen' }).first().click();
  await expect(page.getByRole('button', { name: /Mappen? auswählen/ })).toBeVisible();
});

for (const [name, url, recht] of [
  ['App', 'http://localhost:4173/datenschutz/', /einstellungen\/rechtliches$/],
  ['Vermieter-Seite', 'http://localhost:4174/datenschutz/', /#\/rechtliches$/],
] as const) {
  test(`Datenschutzerklärung über die ${name}`, async ({ page, browserName }) => {
    const beobachtung = beobachten(page);
    await page.goto(url);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hosting bei Cloudflare' })).toBeVisible();
    await expect(page.locator('script')).toHaveCount(0);
    expect(fremde(beobachtung.anfragen, url)).toEqual([]);
    expect(beobachtung.fehler).toEqual([]);
    // Die Sprungmarken des Generators führen zum Abschnitt; eine App könnte sie abfangen.
    await page.getByRole('link', { name: 'Verantwortlicher' }).first().click();
    await expect(page).toHaveURL(/#m3$/);
    await expect(page.locator('main')).toContainText('Lleyton Boateng Sekyere');
    await expect(
      page.getByRole('link', { name: 'Impressum', exact: true }).first(),
    ).toHaveAttribute('href', recht);
    if (browserName === 'chromium') {
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);
      for (const breite of [1280, 390, 320]) {
        await page.setViewportSize({ width: breite, height: 800 });
        const r = (await page.evaluate(pruefen)) as Record<string, unknown>;
        // Der Wortlaut des Generators bleibt, wie er ist: C23 (geschütztes Leerzeichen im Datum) gilt hier
        // nicht, und eine Webadresse darf umbrechen (C2), sonst ragt sie aus der Seite.
        r.c2 = (r.c2 as string[]).filter((wort) => !wort.startsWith('http'));
        const fehler = Object.entries(r).filter(
          ([k, v]) => k !== 'hoehe' && k !== 'c23' && (Array.isArray(v) ? v.length : !!v),
        );
        expect(fehler).toEqual([]);
      }
    }
  });
}

test('Impressum aus dem Generator auf der Vermieter-Seite', async ({ page }) => {
  await page.goto('http://localhost:4174/#/rechtliches');
  const impressum = page.locator('.vs-impressum');
  await expect(impressum.getByRole('heading', { name: 'Diensteanbieter' })).toBeVisible();
  await expect(impressum).toContainText('Friedensallee 378');
  await expect(impressum.getByRole('link', { name: 'lleyton.sekyere@pm.me' })).toHaveAttribute(
    'href',
    'mailto:lleyton.sekyere@pm.me',
  );
  await expect(
    impressum.getByRole('link', { name: /Erstellt mit kostenlosem Datenschutz-Generator/ }),
  ).toBeVisible();
});

const ANSICHTEN = [
  { id: '1280', breite: 1280, hoehe: 860 },
  { id: '1024', breite: 1024, hoehe: 768 },
  { id: '1280-grau', breite: 1280, hoehe: 860, grau: true },
  { id: '390', breite: 390, hoehe: 844 },
  { id: '430', breite: 430, hoehe: 932 },
  { id: '320-text130', breite: 320, hoehe: 568, zoom: 1.3 },
  { id: '390-text130', breite: 390, hoehe: 844, zoom: 1.3 },
  { id: '390-grau', breite: 390, hoehe: 844, grau: true },
];

test.describe('Prüfkatalog Ratgeber', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Die Bögen entstehen in Chromium');

  for (const a of ANSICHTEN) {
    test(`Ratgeber ${a.id}`, async ({ page }) => {
      await page.setViewportSize({ width: a.breite, height: a.hoehe });
      const befunde: Record<string, unknown> = {};
      const bilder: { id: string; png: string }[] = [];
      for (const s of SEITEN) {
        await page.goto(s.url);
        await page.evaluate(() => document.fonts.ready);
        if (a.zoom)
          await page.evaluate(
            (z) => document.documentElement.style.setProperty('zoom', String(z)),
            a.zoom,
          );
        if (a.grau)
          await page.evaluate(() =>
            document.documentElement.style.setProperty('filter', 'grayscale(1)'),
          );
        await page.waitForTimeout(100);
        const r = (await page.evaluate(pruefen)) as Record<string, unknown>;
        const fehler = Object.fromEntries(
          Object.entries(r).filter(
            ([k, v]) => k !== 'hoehe' && (Array.isArray(v) ? v.length : !!v),
          ),
        );
        if (Object.keys(fehler).length) befunde[s.id] = fehler;
        bilder.push({
          id: s.id,
          png: (await page.screenshot({ fullPage: true })).toString('base64'),
        });
      }
      const kontext = await page.context().browser()!.newContext({ deviceScaleFactor: 1 });
      const bogen = await kontext.newPage();
      await bogen.setViewportSize({ width: 1400, height: 800 });
      const breite = a.breite > 900 ? 620 : a.breite;
      await bogen.setContent(
        `<body style="margin:0;background:#c9ccd6;display:flex;gap:24px;align-items:flex-start;padding:24px;font:13px sans-serif">` +
          bilder
            .map(
              (b) =>
                `<figure style="margin:0"><figcaption style="padding:6px 0">${b.id}</figcaption><img style="display:block;width:${breite}px" src="data:image/png;base64,${b.png}"></figure>`,
            )
            .join('') +
          '</body>',
      );
      await bogen.waitForLoadState('load');
      await bogen.screenshot({ path: `docs/screenshots/bogen-RG-${a.id}.png`, fullPage: true });
      await kontext.close();
      expect(befunde).toEqual({});
    });
  }
});

import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';

// Prüfkatalog Bewegung (design/bewegung.md, Abschnitt 4): P1 bis P9 am Stand im Heft (Verwandeln, Wechseln)
// und am Aufschlagen und Zuschlagen. Die Bewegungen werden angehalten und in 5-ms-Schritten durchgegangen.

const JETZT = new Date(2026, 10, 14, 12, 0);
const tag = (v: number, h = 12) => new Date(2026, 10, 14 + v, h, 0).toISOString();
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const HEFT = {
  id: 'h1',
  createdAt: tag(-3),
  updatedAt: tag(-3),
  haushaltId: null,
  adresse: 'Lindenallee 17, 4. OG\n20259 Hamburg',
  link: null,
  quelle: '',
  inseratText: null,
  kennung: 'k-h1',
  ereignisse: { ...leer },
  notiz: '',
  angaben: {
    titel: 'Neubau mit Aufzug',
    stadtteil: 'Eimsbüttel',
    warm: 1390,
    zimmer: 3,
    flaeche: 81,
  },
};

/** Die Prüfungen im Browser: P1 (nie Text über Text) und P2 (nie leer) für den Augenblick. */
async function augenblick(page: Page): Promise<{ ueber: string[]; leer: boolean }> {
  return page.evaluate(() => {
    const deckkraft = (el: Element | null): number => {
      let o = 1;
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.visibility === 'hidden' || s.display === 'none') return 0;
        o *= Number(s.opacity);
      }
      return o;
    };
    const buehne = document.querySelector('main') ?? document.body;
    const texte: { t: string; r: DOMRect[]; inTabs?: boolean }[] = [];
    const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = gang.nextNode(); n; n = gang.nextNode()) {
      const t = n.textContent?.trim();
      if (
        !t ||
        !n.parentElement ||
        n.parentElement.closest('[aria-hidden="true"] svg, script, style')
      )
        continue;
      if (deckkraft(n.parentElement) <= 0.1) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1);
      if (rects.length) texte.push({ t, r: rects, inTabs: !!n.parentElement.closest('nav.tabs') });
    }
    // Text unter der festen Tab-Leiste ist verdeckt, nicht „über“ ihr.
    const tabs = document.querySelector('nav.tabs')?.getBoundingClientRect();
    const verdeckt = (q: DOMRect) =>
      !!tabs &&
      q.top + q.height / 2 >= tabs.top &&
      q.top + q.height / 2 <= tabs.bottom &&
      q.left + q.width / 2 >= tabs.left &&
      q.left + q.width / 2 <= tabs.right;
    for (const x of texte) x.r = x.r.filter((q) => !verdeckt(q) || !!x.inTabs);
    const ueber: string[] = [];
    for (let i = 0; i < texte.length; i++)
      for (let j = i + 1; j < texte.length; j++)
        for (const a of texte[i]!.r)
          for (const b of texte[j]!.r) {
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 2 && h > 2)
              ueber.push(
                `${texte[i]!.t} [${Math.round(a.left)},${Math.round(a.top)}] / ${texte[j]!.t} [${Math.round(b.left)},${Math.round(b.top)}]`,
              );
          }
    // P2: Text, Fläche oder Bild der Bühne über 35 % sichtbar.
    const teile = [...buehne.querySelectorAll('h1, h2, p, img, .antw, .stand, .z')];
    const leer = !teile.some((e) => {
      const q = e.getBoundingClientRect();
      return q.width > 0 && q.height > 0 && deckkraft(e) > 0.35;
    });
    return { ueber: [...new Set(ueber)], leer };
  });
}

/** Alle laufenden Bewegungen anhalten und in 5-ms-Schritten bis `bis` durchgehen; P1 und P2 je Schritt. */
const neue = `(document.getAnimations().filter((a) => !window.__alt.has(a)))`;

async function durchgehen(page: Page, bis: number, ort: string) {
  await page.evaluate(`${neue}.forEach((a) => a.pause())`);
  const fehler: string[] = [];
  for (let t = 0; t <= bis; t += 5) {
    await page.evaluate(`${neue}.forEach((a) => (a.currentTime = ${t}))`);
    const a = await augenblick(page);
    if (a.ueber.length) fehler.push(`${ort} ${t} ms: Text über Text: ${a.ueber.join(' | ')}`);
    if (a.leer) fehler.push(`${ort} ${t} ms: leer`);
  }
  await page.evaluate(`${neue}.forEach((a) => a.finish())`);
  return fehler;
}

/** Längstes geplantes Ende der laufenden Bewegungen (P9). */
const geplant = (page: Page) =>
  page.evaluate(() =>
    Math.max(
      0,
      ...document
        .getAnimations()
        .filter((a) => !(window as unknown as { __alt?: WeakSet<Animation> }).__alt?.has(a))
        .map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0))
        .filter(Number.isFinite),
    ),
  );

async function heftOeffnen(
  page: Page,
  o: { breite?: number; zoom?: number; dunkel?: boolean } = {},
) {
  await page.setViewportSize({ width: o.breite ?? 390, height: 844 });
  if (o.dunkel) await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/heft/h1');
  await page.reload();
  if (o.zoom)
    await page.evaluate(
      (z) => document.documentElement.style.setProperty('zoom', String(z)),
      o.zoom,
    );
  await expect(page.getByRole('heading', { level: 2, name: 'Gemerkt' })).toBeVisible();
}

/** Tippt die Antwort und wartet, bis der Wechsel läuft (beide Lagen stehen auf der Bühne). */
/** Was vor dem Tipp schon lief, gehört nicht zum Wechsel. */
const merken = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __alt: WeakSet<Animation> }).__alt = new WeakSet(
      document.getAnimations(),
    );
  });

async function tippenUndWarten(page: Page, name: RegExp) {
  await merken(page);
  await page.getByRole('button', { name }).click();
  await page.waitForFunction(() => document.querySelectorAll('.buehne > .lage').length === 2);
}

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Bewegung schrittweise in Chromium');
  await page.clock.setFixedTime(JETZT);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await haushaltMitMax(page);
  await hefteAnlegen(page, [HEFT]);
});

for (const fall of [
  { name: '390 hell', breite: 390 },
  { name: '320 mit 130 % dunkel', breite: 320, zoom: 1.3, dunkel: true },
]) {
  test(`P1, P2, P9: Verwandeln und Wechseln, ${fall.name}`, async ({ page }) => {
    await heftOeffnen(page, fall);
    // Verwandeln: „Wir haben uns schon beworben“ wird „Heute beworben“.
    await tippenUndWarten(page, /schon beworben/);
    expect(await page.locator('.flug-text').count()).toBe(1);
    const lang = await geplant(page);
    const f1 = await durchgehen(page, lang, 'Verwandeln');
    // Wechseln: „‹ Doch noch nicht beworben“ (der Titel kommt nicht aus einer Antwort).
    await expect(page.getByRole('heading', { level: 2, name: 'Heute beworben' })).toBeVisible();
    await merken(page);
    await page.getByRole('button', { name: /Doch noch nicht beworben/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.buehne > .lage').length === 2);
    const f2 = await durchgehen(page, await geplant(page), 'Wechseln');
    expect([...f1, ...f2]).toEqual([]);
    // P9: kein Wechsel länger als rund 1 s bis zum letzten Teil.
    test.info().annotations.push({ type: 'P9', description: `Verwandeln ${Math.round(lang)} ms` });
    expect(lang).toBeLessThanOrEqual(1100);
    await expect(page.getByRole('heading', { level: 2, name: 'Gemerkt' })).toBeVisible();
  });
}

test('P3: Ruhige Fassung, kein Flug, nichts verschiebt sich, P1 und P2 halten', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await heftOeffnen(page);
  await tippenUndWarten(page, /schon beworben/);
  expect(await page.locator('.flug-text, .flug-flaeche').count()).toBe(0);
  const bewegt = await page.evaluate(
    () =>
      document
        .getAnimations()
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
        .filter(
          (k) =>
            (k.transform && k.transform !== 'none') ||
            (k.filter && String(k.filter).includes('blur')),
        ).length,
  );
  expect(bewegt).toBe(0);
  expect(await durchgehen(page, await geplant(page), 'ruhig')).toEqual([]);
});

for (const nach of [0, 250, 500, 800]) {
  test(`P4: Zweiter Tipp nach ${nach} ms: die Lage stimmt, P1 und P2 halten`, async ({ page }) => {
    await heftOeffnen(page);
    await tippenUndWarten(page, /schon beworben/);
    await page.waitForTimeout(nach);
    // Die neue Lage nimmt Eingaben an, sobald sie steht; ein Tipp setzt die laufende Bewegung ans Ende.
    await merken(page);
    await page
      .locator('.buehne > .lage:not(.geht)')
      .getByRole('button', { name: /Doch noch nicht beworben/ })
      .click();
    await page.waitForFunction(() => document.querySelectorAll('.buehne > .lage').length === 2);
    expect(await durchgehen(page, await geplant(page), `zweiter Tipp ${nach}`)).toEqual([]);
    await expect(page.locator('.buehne > .lage')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Gemerkt' })).toBeVisible();
  });
}

for (const nach of [100, 400, 700]) {
  test(`P5: Hintergrund nach ${nach} ms: keine Bewegung mehr, neue Lage, nichts unsichtbar`, async ({
    page,
  }) => {
    await heftOeffnen(page);
    await tippenUndWarten(page, /schon beworben/);
    await page.waitForTimeout(nach);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await page.evaluate(() => document.querySelectorAll('.buehne .flug-text').length)).toBe(
      0,
    );
    expect(
      await page.evaluate(
        () => document.querySelector('.buehne')!.getAnimations({ subtree: true }).length,
      ),
    ).toBe(0);
    await expect(page.locator('.buehne > .lage')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Heute beworben' })).toBeVisible();
    expect((await augenblick(page)).leer).toBe(false);
  });
}

test('P6: Ohne Animation: alles abgebrochen, jedes Teil der neuen Lage voll sichtbar', async ({
  page,
}) => {
  await heftOeffnen(page);
  await tippenUndWarten(page, /schon beworben/);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.cancel()));
  const lage = page.locator('.buehne > .lage').last();
  await expect(lage.getByRole('heading', { level: 2, name: 'Heute beworben' })).toBeVisible();
  const unsichtbar = await lage.evaluate(
    (el) =>
      [...el.querySelectorAll('h2, p, .antw, .zurueck')].filter((e) => {
        let o = 1;
        for (let x: Element | null = e; x; x = x.parentElement)
          o *= Number(getComputedStyle(x).opacity);
        return o < 1;
      }).length,
  );
  expect(unsichtbar).toBe(0);
});

for (const ms of [500, 700, 900]) {
  test(`P7: verwandeln = ${ms} ms, P1 bis P3`, async ({ page }) => {
    await heftOeffnen(page);
    await page.evaluate(
      (d) => document.documentElement.style.setProperty('--bw-verwandeln', `${d}ms`),
      ms,
    );
    await tippenUndWarten(page, /schon beworben/);
    expect(await durchgehen(page, await geplant(page), `verwandeln ${ms}`)).toEqual([]);
  });
}

test('P8: Aufschlagen und Zuschlagen: genau die Zielseite, keine Flugebene bleibt', async ({
  page,
}) => {
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.locator('[data-heft-karte="h1"]').click();
  await expect(page.locator('.flug-ebene')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Neubau mit Aufzug' })).toBeVisible();
  await expect(page.locator('.flug-ebene, .flug-bild, .flug-abbild')).toHaveCount(0, {
    timeout: 3000,
  });
  await expect(page).toHaveURL(/#\/heft\/h1$/);
  await page
    .getByRole('link', { name: /Wohnungen/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/wohnungen$/);
  await expect(page.locator('.flug-ebene, .flug-bild, .flug-abbild')).toHaveCount(0, {
    timeout: 3000,
  });
  await expect(page.locator('[data-heft-karte="h1"]')).toBeVisible();
  // Nichts ist unsichtbar zurückgeblieben.
  const o = await page
    .locator('[data-heft-karte="h1"] .ti')
    .evaluate((e) => getComputedStyle(e).visibility);
  expect(o).toBe('visible');
});

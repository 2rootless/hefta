import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';

// PC95 F1, PC96 (2.0.1): Hefta folgt der Textgröße von iOS. Alle Größen sind `calc(N * var(--px))`, und
// `--px` wächst mit der Schrift bis auf 2px (src/app/global.css). Bei doppelter Schrift darf in „Bewerben“ und im
// Heft nichts über den Rand ragen. Am iPhone wächst dabei auch die Wurzelschrift (`font: -apple-system-body`, bei
// doppelter Schrift 34 px), und alles in `em` oder `rem` wächst mit. Der Test setzt beides: 34 px und `--px` = 2px.

const JETZT = new Date(2026, 10, 12, 10, 0);
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const heft = {
  id: 'linden',
  createdAt: new Date(2026, 10, 9, 12).toISOString(),
  updatedAt: new Date(2026, 10, 9, 12).toISOString(),
  haushaltId: null,
  adresse: 'Lindenring 3\n20259 Hamburg',
  link: 'https://www.example.org/wohnung/3',
  quelle: '',
  inseratText: null,
  kennung: 'k-linden',
  ereignisse: { ...leer },
  notiz: '',
  einzug: '2027-01-01',
  angaben: {
    // E236: Mit Adresse hieße das Heft „Lindenring 3“; die Messung braucht einen Namen aus mehreren Wörtern.
    merkmal: 'Altbau mit Garten',
    stadtteil: 'Eimsbüttel',
    warm: 1240,
    zimmer: 3,
    flaeche: 74,
    portal: 'ImmoScout24',
    anbieter: 'Frau Hansen',
  },
};

/** Doppelte Schrift wie bei der größten Stufe von iOS. Über das CSSOM, wie die Seite selbst es erlaubt. */
const grosseSchrift = (page: Page) =>
  page.evaluate(() => {
    const s = document.styleSheets[0]!;
    s.insertRule(':root{font-size:34px !important;--px:2px !important}', s.cssRules.length);
  });

/** Was über den rechten Rand ragt: die Seite selbst und jedes sichtbare Element mit Inhalt. */
const ueberstand = (page: Page) =>
  page.evaluate(() => {
    const breite = document.documentElement.clientWidth;
    const aus: string[] = [];
    const seite = document.documentElement.scrollWidth - breite;
    if (seite > 1) aus.push(`Seite ${seite} px zu breit`);
    for (const el of document.querySelectorAll<HTMLElement>('main *, header *, nav *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      // In einem Bereich, der selbst waagerecht rollt, darf etwas über den Rand stehen.
      if (el.closest('[data-rollt], .rollt')) continue;
      if (r.right > breite + 1 || r.left < -1)
        aus.push(
          `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(r.left)} bis ${Math.round(r.right)}): ${(el.textContent ?? '').trim().slice(0, 30)}`,
        );
    }
    return aus.slice(0, 15);
  });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(JETZT);
  await page.setViewportSize({ width: 390, height: 844 });
});

for (const breite of [390, 320])
  test(`F1: Heft und „Bewerben“ bei doppelter Schrift ohne Überstand, ${breite} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: 844 });
    await haushaltMitMax(page);
    await hefteAnlegen(page, [heft]);
    await page.goto('/#/wohnungen');
    await page.reload();
    await page.evaluate(() => (window.location.hash = '#/heft/linden'));
    await expect(page.getByRole('link', { name: 'Jetzt bewerben' })).toBeVisible();
    const groesse = () =>
      page
        .locator('main h1')
        .first()
        .evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize));
    const vorher = await groesse();
    await grosseSchrift(page);
    await page.waitForTimeout(300);
    // Die Schrift ist wirklich doppelt so groß.
    expect(await groesse()).toBeCloseTo(vorher * 2, 0);
    expect(await ueberstand(page), 'Heft').toEqual([]);
    await page.getByRole('link', { name: 'Jetzt bewerben' }).click();
    await page.waitForTimeout(500);
    expect(await ueberstand(page), 'Bewerben').toEqual([]);
  });

test('F1, Gegenprobe: ein zu breites Element fällt auf', async ({ page }) => {
  await haushaltMitMax(page);
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.textContent = 'zu breit';
    d.style.width = '600px';
    document.querySelector('main')!.append(d);
  });
  expect((await ueberstand(page)).length).toBeGreaterThan(0);
});

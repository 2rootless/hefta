import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';

// Zurück auf jeder Seite (Auftraggeber 13.11., docs/zurueck-pruefung-2026-11-13.md): Reiter sind Wurzeln,
// jede andere Seite führt zur Seite darüber und nennt sie.

const stelle = (page: Page) =>
  page.evaluate(() => (history.state as { stelle?: number } | null)?.stelle ?? -1);
const reiter = (page: Page, name: 'Wohnungen' | 'Mappe') =>
  page.getByRole('navigation', { name: 'Bereiche' }).getByRole('link', { name });

test('Reiterwechsel beginnt den Verlauf neu; Einstellungen nennen den Reiter, aus dem man kam', async ({
  page,
}) => {
  await haushaltMitMax(page);

  // Mappe → Einstellungen → ‹ Mappe
  await reiter(page, 'Mappe').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
  await expect.poll(() => stelle(page)).toBe(0);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  const zurueck = page.locator('a.zurueck');
  await expect(zurueck).toHaveText('Mappe');
  await zurueck.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();

  // Wohnungen → Einstellungen → ‹ Wohnungen; auf dem Reiter selbst kein Schritt zurück.
  await reiter(page, 'Wohnungen').click();
  await expect(page).toHaveURL(/#\/wohnungen$/);
  await expect.poll(() => stelle(page)).toBe(0);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(zurueck).toHaveText('Wohnungen');
  await zurueck.click();
  await expect(page).toHaveURL(/#\/wohnungen$/);
  await expect.poll(() => stelle(page)).toBe(0);

  // Hin und her: Der Verlauf wird nicht länger.
  await reiter(page, 'Mappe').click();
  await reiter(page, 'Wohnungen').click();
  await reiter(page, 'Mappe').click();
  await expect.poll(() => stelle(page)).toBe(0);
});

test('Seite einer Person nennt „Mappe“, nicht mehr „Übersicht“', async ({ page }) => {
  await haushaltMitMax(page);
  await page.goto('/#/');
  await page.getByRole('link', { name: /^Max/ }).first().click();
  await expect(page.locator('a.zurueck')).toHaveText('Mappe');
  await page.locator('a.zurueck').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
});

test('PC29 (A2): Zurück aus der Selbstauskunft: „Mappe“ steht sofort, nie leer, nie halb durchsichtig', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await haushaltMitMax(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
  await page.locator('main a[href^="#/selbstauskunft/"]').first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Selbst.?auskunft/ })).toBeVisible();
  // Jedes Bild mitschreiben: Überschrift und die geringste Deckkraft auf dem Weg zur Überschrift.
  await page.evaluate(() => {
    const w = window as unknown as { __bilder: { h1: string; o: number }[]; __an: boolean };
    w.__bilder = [];
    w.__an = true;
    const bild = () => {
      const h = document.querySelector('main h1');
      let o = 1;
      for (let x: Element | null = h; x; x = x.parentElement)
        o = Math.min(o, Number(getComputedStyle(x).opacity));
      w.__bilder.push({ h1: h?.textContent?.trim() ?? '', o });
      if (w.__an) requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
  });
  // Zurück wie die Wischgeste: ein Schritt im Verlauf.
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
  await page.waitForTimeout(400);
  const bilder = await page.evaluate(() => {
    const w = window as unknown as { __bilder: { h1: string; o: number }[]; __an: boolean };
    w.__an = false;
    return w.__bilder;
  });
  const ab = bilder.findIndex((b) => b.h1 === 'Deine Mappe');
  expect(ab).toBeGreaterThanOrEqual(0);
  // Ab dem ersten Bild der Mappe: immer die Mappe, immer ganz sichtbar.
  for (const b of bilder.slice(ab)) {
    expect(b.h1).toBe('Deine Mappe');
    expect(b.o).toBe(1);
  }
  // Davor nie ein leerer Bildschirm.
  for (const b of bilder.slice(0, ab)) expect(b.h1).not.toBe('');
});

// PC31 (A1): wie PC29, für die Reiter-Wurzel „Wohnungen“.
const MUSTERHEFT = {
  id: 'linden',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
  haushaltId: null,
  adresse: 'Lindenring 3\n20259 Hamburg',
  link: 'https://www.example.org/wohnung/3',
  quelle: '',
  inseratText: null,
  kennung: 'k-linden',
  ereignisse: {
    beworben: null,
    gefragtAm: null,
    termin: null,
    ergebnis: null,
    loeschbitteAm: null,
    nachgefasstAm: null,
    abgelegtAm: null,
  },
  notiz: '',
  einzug: '2027-01-01',
  angaben: { titel: 'Altbau mit Garten', warm: 1240, zimmer: 3, flaeche: 74 },
};

/** Jedes Bild mitschreiben: Überschrift und die geringste Deckkraft auf dem Weg zur Überschrift. */
async function bilderAn(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __bilder: { h1: string; o: number }[]; __an: boolean };
    w.__bilder = [];
    w.__an = true;
    const bild = () => {
      const h = document.querySelector('main h1');
      let o = 1;
      for (let x: Element | null = h; x; x = x.parentElement)
        o = Math.min(o, Number(getComputedStyle(x).opacity));
      w.__bilder.push({ h1: h?.textContent?.trim() ?? '', o });
      if (w.__an) requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
  });
}

async function bilderAus(page: Page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const w = window as unknown as { __bilder: { h1: string; o: number }[]; __an: boolean };
    w.__an = false;
    return w.__bilder;
  });
}

for (const wie of ['Wischgeste', 'Knopf Zurück'] as const)
  test(`PC31 (A1): Zurück aus dem Heft per ${wie}: „Wohnungen“ steht sofort, nie leer, nie halb durchsichtig`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await haushaltMitMax(page);
    await hefteAnlegen(page, [MUSTERHEFT]);
    await page.goto('/#/wohnungen');
    await page.reload();
    // Die Überschrift der Liste ist die Begrüßung („Guten Morgen, Max“).
    const titel = page.locator('main h1').first();
    await expect(titel).toHaveText(/^(Guten|Hallo)/);
    const name = (await titel.textContent())!.trim();
    await page.locator('main a[href="#/heft/linden"]').first().click();
    await expect(
      page.getByRole('heading', { level: 1, name: /Lindenring 3|Altbau/ }),
    ).toBeVisible();
    await page.waitForTimeout(500);
    await bilderAn(page);
    if (wie === 'Wischgeste') await page.goBack();
    else await page.locator('main a[href="#/wohnungen"]').first().click();
    await expect(titel).toHaveText(name);
    const bilder = await bilderAus(page);
    const ab = bilder.findIndex((b) => b.h1 === name);
    expect(ab).toBeGreaterThanOrEqual(0);
    for (const b of bilder.slice(ab)) {
      expect(b.h1).toBe(name);
      expect(b.o).toBe(1);
    }
    for (const b of bilder.slice(0, ab)) expect(b.h1).not.toBe('');
  });

test('PC31 (A1), Gegenprobe: Vorwärts über den Reiter blendet „Wohnungen“ weiter ein', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await haushaltMitMax(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
  await bilderAn(page);
  await reiter(page, 'Wohnungen').click();
  await expect(page.locator('main h1').first()).toHaveText(/^(Guten|Hallo)/);
  const bilder = await bilderAus(page);
  expect(bilder.some((b) => /^(Guten|Hallo)/.test(b.h1) && b.o < 1)).toBe(true);
});

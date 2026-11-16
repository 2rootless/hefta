import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// PC64, Punkt 1: Nach „beworben“ (Termin anstehend oder vorbei, Zusage, Absage, nicht mehr) blieb Hefta am
// iPhone stehen, wenn man im Heft auf „‹ Wohnungen“ tippte. Jeder Stand: zurück in die Liste, und die Seite
// reagiert danach noch (ein zweites Heft lässt sich öffnen).

const JETZT = new Date(2026, 10, 16, 10, 0);
const tag = (versatz: number, stunde = 12) =>
  new Date(2026, 10, 16 + versatz, stunde, 0).toISOString();

const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

function heft(id: string, titel: string, ereignisse: Record<string, unknown>) {
  return {
    id,
    createdAt: tag(-10),
    updatedAt: tag(-10),
    haushaltId: null,
    adresse: 'Lindenring 3\n20259 Hamburg',
    link: null,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer, ...ereignisse },
    notiz: '',
    angaben: { titel, stadtteil: 'Eimsbüttel', warm: 1000, zimmer: 2, flaeche: 50 },
  };
}

const beworben = { beworben: { am: tag(-9), weg: 'mail', sicher: true }, gefragtAm: tag(-9) };
export const STAENDE: [string, Record<string, unknown>][] = [
  ['beworben', beworben],
  ['Termin anstehend', { ...beworben, termin: { am: tag(2, 17), ort: '', treffpunkt: '' } }],
  ['Termin heute', { ...beworben, termin: { am: tag(0, 17), ort: '', treffpunkt: '' } }],
  ['Termin vorbei', { ...beworben, termin: { am: tag(-2, 17), ort: '', treffpunkt: '' } }],
  [
    'Zusage',
    {
      ...beworben,
      termin: { am: tag(-3, 17), ort: '', treffpunkt: '' },
      ergebnis: { art: 'zusage', am: tag(-1) },
    },
  ],
  ['Absage', { ...beworben, ergebnis: { art: 'absage', am: tag(-1) } }],
  ['nicht mehr', { ...beworben, ergebnis: { art: 'nicht_mehr', am: tag(-1) } }],
];

async function hefteAnlegen(page: Page, hefte: unknown[]) {
  await page.evaluate(
    (liste) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('hefte', 'readwrite');
          for (const h of liste as object[]) tx.objectStore('hefte').put(h);
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    hefte,
  );
}

// Am iPhone ist die Bewegung an; die übrigen Tests laufen mit „Bewegung reduzieren“.
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

const fehler: string[] = [];
test.beforeEach(async ({ page }) => {
  fehler.length = 0;
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  await page.clock.setFixedTime(JETZT);
});

for (const [name, ereignisse] of STAENDE) {
  test(`„‹ Wohnungen“ nach ${name}: zurück in die Liste, Seite reagiert`, async ({ page }) => {
    await haushaltMitMax(page);
    await hefteAnlegen(page, [
      heft('a', 'Altbau am Kanal', ereignisse),
      heft('b', 'Dachgeschoss', {}),
    ]);
    await page.goto('/#/wohnungen');
    await page.reload();
    // Hefte mit Ergebnis liegen unter „Abgelegt“; dann diesen Abschnitt öffnen.
    await expect(page.getByRole('link', { name: /Dachgeschoss/ })).toBeVisible();
    const abgelegt = page.getByRole('button', { name: /^Abgelegt/ });
    if (await abgelegt.isVisible()) await abgelegt.click();
    await page
      .getByRole('link', { name: /Altbau am Kanal/ })
      .first()
      .click();
    await expect(page).toHaveURL(/#\/heft\/a$/);
    await expect(page.locator('header.bar').getByRole('link')).toContainText('Wohnungen');
    await page.locator('header.bar').getByRole('link').click();
    await expect(page).toHaveURL(/#\/wohnungen$/, { timeout: 5000 });
    // Das Abbild des Hefts (Flugebene) liegt nicht mehr über der Liste; sonst sieht man das Heft
    // weiter, während die Taps unsichtbar durchgehen: „reagiert nicht mehr“.
    await expect(page.locator('.flug-ebene')).toHaveCount(0, { timeout: 3000 });
    // Reagiert die Seite noch? Ein zweites Heft öffnen und wieder zurück.
    const antwort = await Promise.race([
      page.evaluate(() => 'ok'),
      new Promise((ok) => setTimeout(() => ok('haengt'), 3000)),
    ]);
    expect(antwort).toBe('ok');
    await page
      .getByRole('link', { name: /Dachgeschoss/ })
      .first()
      .click();
    await expect(page).toHaveURL(/#\/heft\/b$/, { timeout: 5000 });
    expect(fehler).toEqual([]);
  });
}

/** Wie am iPhone: den Stand im Heft setzen, dann „‹ Wohnungen“. */
async function zurueckUndWeiter(page: Page) {
  await page.locator('header.bar').getByRole('link').click();
  await expect(page).toHaveURL(/#\/wohnungen$/, { timeout: 5000 });
  await expect(page.locator('.flug-ebene')).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByRole('link', { name: /Dachgeschoss/ })).toBeVisible({ timeout: 5000 });
  await page
    .getByRole('link', { name: /Dachgeschoss/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/heft\/b$/, { timeout: 5000 });
  expect(fehler).toEqual([]);
}

async function ueberListeOeffnen(page: Page, ereignisse: Record<string, unknown>) {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('a', 'Altbau am Kanal', ereignisse),
    heft('b', 'Dachgeschoss', {}),
  ]);
  await page.goto('/#/wohnungen');
  await page.reload();
  await page
    .getByRole('link', { name: /Altbau am Kanal/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/heft\/a$/);
}

test('Termin im Heft eintragen, dann „‹ Wohnungen“', async ({ page }) => {
  await ueberListeOeffnen(page, beworben);
  await page.getByRole('link', { name: /^Einladung zur Besichtigung/ }).click();
  await page.getByRole('group', { name: 'Tag' }).getByRole('button').nth(1).click();
  await page.getByLabel('Uhrzeit').fill('17:30');
  await page.getByRole('button', { name: 'Termin speichern' }).click();
  await expect(page.getByRole('region', { name: /^Stand: Besichtigung/ })).toBeVisible();
  await zurueckUndWeiter(page);
});

for (const ergebnis of ['Zusage', 'Absage']) {
  test(`${ergebnis} im Heft setzen, dann „‹ Wohnungen“`, async ({ page }) => {
    await ueberListeOeffnen(page, {
      ...beworben,
      termin: { am: tag(-2, 17), ort: '', treffpunkt: '' },
    });
    await page.getByRole('button', { name: new RegExp(`^${ergebnis}`) }).click();
    await expect(
      page.getByRole('region', { name: new RegExp(`^Stand: Ergebnis\\. ${ergebnis}`) }),
    ).toBeVisible();
    await zurueckUndWeiter(page);
  });
}

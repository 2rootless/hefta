import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Request } from '@playwright/test';
import { cspMelden } from './hilfen';
import { HEUTE } from './szenarien';

// Rückmeldung zum Antippen (E54, E57, B19 Fassung 4 und 5): Rückfrage im Fenster, erst „Abschicken“
// sendet, und es geht nur {f, a} hinaus. Der Empfang ist hier nachgestellt; den echten prüft
// src/rueckmeldung/empfang.test.ts gegen SQLite.

// WebKit leitet Anfragen unter einem Service Worker nicht an page.route weiter; der Worker lässt POST
// ohnehin durch (src/sw/sw.js), darum hier ohne ihn.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

/** Stellt den Empfang nach und sammelt, was ankommt. `netz: false` spielt „nicht verbunden“. */
async function empfang(page: Page, netz = { an: true }) {
  const angekommen: Request[] = [];
  await page.route('**/api/rueckmeldung', async (route) => {
    if (!netz.an) return route.abort('internetdisconnected');
    angekommen.push(route.request());
    await route.fulfill({ status: 204 });
  });
  return angekommen;
}

async function einstellungen(page: Page) {
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await expect(page.getByRole('heading', { level: 2, name: 'Über Hefta' })).toBeVisible();
}

test('vier Fragen; Abbrechen sendet nichts, Abschicken nur Frage und Antwort', async ({ page }) => {
  const angekommen = await empfang(page);
  await einstellungen(page);
  for (const frage of [
    'Hat euch Hefta bei der Bewerbung geholfen?',
    'Was soll Hefta als Nächstes können?',
    'Was fehlt euch sonst?',
    'Wie habt ihr von Hefta erfahren?',
  ])
    await expect(page.getByRole('group', { name: frage })).toBeVisible();
  await expect(
    page.getByText(
      'Eine Antwort geht erst nach einer Rückfrage hinaus, anonym und ohne Daten aus Hefta.',
    ),
  ).toBeVisible();
  // „Etwas anderes …“ nur bei „Was fehlt euch sonst?“, als Mail.
  await expect(page.getByRole('link', { name: 'Etwas anderes …' })).toHaveAttribute(
    'href',
    /^mailto:/,
  );
  await expect(page.getByRole('link', { name: 'Etwas anderes …' })).toHaveCount(1);

  const geholfen = page.getByRole('group', { name: 'Hat euch Hefta bei der Bewerbung geholfen?' });
  await geholfen.getByRole('button', { name: 'Teils' }).click();
  const fenster = page.getByRole('dialog', { name: 'Anonym an hefta.de schicken?' });
  await expect(fenster).toBeVisible();
  await expect(fenster).toContainText(
    'Nur diese Antwort geht hinaus, ohne Namen und ohne Daten aus Hefta.',
  );
  await expect(fenster).toContainText('Teils');
  await expect(fenster.getByRole('button', { name: 'Abschicken' })).toBeFocused();
  if (test.info().project.name === 'chromium') {
    const befund = await new AxeBuilder({ page }).include('dialog').analyze();
    expect(befund.violations.map((v) => v.id)).toEqual([]);
  }

  // Abbrechen: nichts geht hinaus, die Wahl verschwindet wieder.
  await fenster.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(fenster).toBeHidden();
  await expect(geholfen.getByRole('button', { name: 'Teils' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(angekommen).toHaveLength(0);

  // Abschicken: genau {f, a}, ohne Cookie.
  await geholfen.getByRole('button', { name: 'Teils' }).click();
  await fenster.getByRole('button', { name: 'Abschicken' }).click();
  await expect(fenster).toBeHidden();
  expect(angekommen).toHaveLength(1);
  expect(JSON.parse(angekommen[0]!.postData()!)).toEqual({ f: 'geholfen', a: 'teils' });
  const kopf = await angekommen[0]!.allHeaders();
  expect(kopf.cookie).toBeUndefined();
  expect(kopf.referer).toBeUndefined();
  await expect(page.getByText('Eure Antwort: Teils')).toBeVisible();
  await expect(page.getByText('Danke. Angekommen.')).toBeVisible();

  // Gemerkt nur auf dem Gerät: Nach dem Neuladen steht die Antwort noch da, ohne neuen Aufruf.
  await page.reload();
  await expect(page.getByText('Eure Antwort: Teils')).toBeVisible();
  expect(angekommen).toHaveLength(1);

  // Ändern zählt eine neue Antwort, mit derselben Rückfrage.
  await page.getByRole('button', { name: 'Ändern' }).click();
  await expect(geholfen.getByRole('button', { name: 'Teils' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await geholfen.getByRole('button', { name: 'Ja' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschicken' }).click();
  await expect(page.getByText('Eure Antwort: Ja')).toBeVisible();
  expect(angekommen.map((r) => JSON.parse(r.postData()!))).toEqual([
    { f: 'geholfen', a: 'teils' },
    { f: 'geholfen', a: 'ja' },
  ]);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('ohne Netz: Hinweis, die Wahl bleibt, nichts wird nachgeschickt', async ({ page }) => {
  const netz = { an: false };
  const angekommen = await empfang(page, netz);
  await einstellungen(page);
  const naechstes = page.getByRole('group', { name: 'Was soll Hefta als Nächstes können?' });
  await naechstes.getByRole('button', { name: 'Lage auf einer Karte' }).click();
  const fenster = page.getByRole('dialog');
  await fenster.getByRole('button', { name: 'Abschicken' }).click();
  const aus = 'Gerade keine Verbindung. Versucht es später noch einmal.';
  await expect(fenster.getByText(aus)).toBeVisible();
  await fenster.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(naechstes.getByRole('button', { name: 'Lage auf einer Karte' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(aus)).toBeVisible();
  // Das Netz ist zurück: Hefta schickt trotzdem nichts von selbst.
  netz.an = true;
  await page.waitForTimeout(500);
  expect(angekommen).toHaveLength(0);
  // Erst ein neuer Tipp öffnet das Fenster wieder.
  await naechstes.getByRole('button', { name: 'Lage auf einer Karte' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Abschicken' }).click();
  await expect(page.getByText('Eure Antwort: Lage auf einer Karte')).toBeVisible();
  expect(angekommen).toHaveLength(1);
});

test('Seite hefta.de/rueckmeldung/ für Links von außen: Vorwahl, Abschicken, Danke', async ({
  page,
}) => {
  const angekommen = await empfang(page);
  await page.goto('/rueckmeldung/?f=geholfen&a=teils');
  await expect(
    page.getByRole('group', { name: 'Hat dir Hefta bei der Bewerbung geholfen?' }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Wie hast du von Hefta erfahren?' })).toBeHidden();
  await expect(page.getByRole('radio', { name: 'Teils' })).toBeChecked();
  await page.getByRole('button', { name: 'Abschicken' }).click();
  await expect(page.getByRole('heading', { name: 'Danke. Angekommen.' })).toBeVisible();
  await expect(page.getByText('Deine Antwort: Teils')).toBeVisible();
  expect(JSON.parse(angekommen[0]!.postData()!)).toEqual({ f: 'geholfen', a: 'teils' });

  // Ohne Vorwahl: alle vier Fragen, „Abschicken“ erst nach einer Wahl.
  await page.goto('/rueckmeldung/');
  await expect(page.getByRole('heading', { level: 1, name: 'Vier kurze Fragen' })).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Abschicken' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Suche im Netz' }).check();
  await expect(page.getByRole('button', { name: 'Abschicken' })).toBeEnabled();
  if (test.info().project.name === 'chromium') {
    const befund = await new AxeBuilder({ page }).analyze();
    expect(befund.violations.map((v) => v.id)).toEqual([]);
  }
});

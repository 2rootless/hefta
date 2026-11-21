import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// DP50 Punkt 9 (P2): Die Mappe ansehen. Seiten untereinander, im Kopf „Mappe …“ und der Abschnitt, der
// beim Blättern wechselt; „Deckblatt ▾“ öffnet das Verzeichnis wie „Was beiliegt“; unten der Blätterer
// „1 / n“ und rund „Teilen“. Kein „Fertig“, kein „Ganz / 2× / 3×“ (Gegenprobe zur alten Ansicht).

async function oeffnen(page: Page) {
  await szenarioLaden(page, '04-fertig', '/mappe');
  await page
    .getByText(/^\d+ Seiten$/)
    .first()
    .waitFor({ timeout: 30_000 });
  const anzahl = Number(
    (
      await page
        .getByText(/^\d+ Seiten$/)
        .first()
        .innerText()
    ).split(' ')[0],
  );
  await page.getByRole('button', { name: 'Deckblatt groß ansehen' }).click();
  await page.getByRole('button', { name: 'Ganze Mappe ansehen' }).click();
  const leser = page.getByRole('dialog', { name: /^Mappe/ });
  await expect(leser).toBeVisible();
  return { leser, anzahl };
}

test('P2: Abschnitt im Kopf, Blätterer, Verzeichnis, Teilen; kein „Fertig“ und kein „2×“', async ({
  page,
}) => {
  const { leser, anzahl } = await oeffnen(page);
  const abschnitt = leser.getByRole('button', { expanded: false }).filter({ hasText: 'Deckblatt' });
  await expect(abschnitt).toBeVisible();
  await expect(leser.getByText(`1 / ${anzahl}`)).toBeVisible();
  await expect(leser.getByRole('img', { name: 'Seite 1' })).toBeVisible();
  await expect(leser.getByRole('button', { name: 'Teilen' })).toBeVisible();
  // Gegenprobe: die Bedienung der alten Ansicht gibt es hier nicht.
  await expect(leser.getByRole('button', { name: 'Fertig' })).toHaveCount(0);
  await expect(leser.getByRole('button', { name: '2×' })).toHaveCount(0);

  // Blättern: Der Kopf nennt Person und Unterlage.
  await leser.getByRole('button', { name: 'Nächste Seite' }).click();
  await expect(leser.getByText(`2 / ${anzahl}`)).toBeVisible();
  await expect(leser.locator('.leser-abschnitt b')).toHaveText(/^Max · /);

  // Verzeichnis: wie „Was beiliegt“; ein Tipp springt hin und schließt es.
  await leser.locator('.leser-abschnitt').click();
  const verzeichnis = leser.getByRole('navigation', { name: 'Verzeichnis der Mappe' });
  await expect(verzeichnis).toBeVisible();
  await expect(verzeichnis.getByRole('button', { name: /^Deckblatt/ })).toBeVisible();
  await expect(verzeichnis.locator('.person')).toContainText(['Max', 'Lea', 'Petra']);
  const letzter = verzeichnis.getByRole('button').last();
  const ziel = Number(((await letzter.locator('.nr').innerText()).split('–')[0] ?? '').trim());
  await letzter.click();
  await expect(verzeichnis).toHaveCount(0);
  await expect(leser.getByText(`${ziel} / ${anzahl}`)).toBeVisible();
  await expect(leser.locator('.leser-abschnitt b')).toHaveText(/^Petra · /);

  // Zurück schließt den Leser.
  await leser.getByRole('button', { name: 'Zurück' }).click();
  await expect(leser).toBeHidden();
});

test('P2 bei 320 px mit 130 %: Kopf und Blätterer passen, nichts läuft über', async ({ page }) => {
  await page.setViewportSize({ width: 246, height: 437 });
  const { leser, anzahl } = await oeffnen(page);
  await expect(leser.getByText(`1 / ${anzahl}`)).toBeVisible();
  const ueber = await leser.evaluate((d) => d.scrollWidth - d.clientWidth);
  expect(ueber).toBeLessThanOrEqual(0);
  await expect(leser.getByRole('button', { name: 'Teilen' })).toBeInViewport();
});

test('P2: zwei Finger vergrößern die Seiten, Doppeltippen springt zurück (PC69)', async ({
  page,
  browserName,
}) => {
  // Echte Berührungen mit zwei Fingern lassen sich nur in Chromium auslösen.
  test.skip(browserName !== 'chromium', 'braucht das Chrome-Protokoll');
  const { leser } = await oeffnen(page);
  await expect(leser.getByRole('img', { name: 'Seite 1' })).toBeVisible();
  const breite = () =>
    leser
      .locator('.seite')
      .first()
      .evaluate((e) => e.getBoundingClientRect().width);
  const vorher = await breite();

  const cdp = await page.context().newCDPSession(page);
  const finger = (a: number[], b: number[]) => [
    { x: a[0]!, y: a[1]!, id: 0 },
    { x: b[0]!, y: b[1]!, id: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: finger([145, 400], [245, 400]),
  });
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: finger([145 - 50 * t, 400], [245 + 50 * t, 400]),
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(requestAnimationFrame));

  // Aufgezogen etwa auf das Doppelte; es rastet bei 2 ein.
  expect(Math.round((await breite()) / vorher)).toBe(2);
  // Doppeltippen springt zurück auf die ganze Breite.
  await leser.locator('.rolle').dblclick();
  await expect.poll(async () => Math.round(await breite())).toBe(Math.round(vorher));
});

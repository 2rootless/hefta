import { expect, test, type Page } from '@playwright/test';
import { registerPruefen } from './dp39-regeln';
import { szenarioLaden } from './szenario-laden';

// DP49 Punkt 2: Register als Trennblätter. Vorn das Blatt der Person, sein Reiter 44 px hoch aus der Kante;
// die anderen 8 px tiefer im leiseren Ton. Auf den Reitern nur der Name (Haken, wenn fertig), „x von y“ im
// Blatt. Eine Reihe; passt sie nicht, rollt sie, und der vordere Reiter steht ganz da.

/** Befunde zur Form aus DP49; leer heißt: passt. */
function trennblattPruefen(): string[] {
  const f: string[] = [];
  const nav = document.querySelector<HTMLElement>('.register');
  const karte = document.querySelector<HTMLElement>('.register-rahmen .karte');
  if (!nav || !karte) return ['kein Register'];
  const reiter = [...nav.querySelectorAll<HTMLElement>('.reiter')];
  const an = nav.querySelector<HTMLElement>('.reiter.an');
  if (!an) return ['kein vorderer Reiter'];
  for (const r of reiter) {
    if (/\d+\s*\/\s*\d+|\d+ von \d+/.test(r.textContent ?? '')) f.push('Zähler auf dem Reiter');
    if (r.querySelector('.zeichen-p')) f.push('Zeichen auf dem Reiter');
  }
  const oben = an.getBoundingClientRect().top;
  for (const r of reiter.filter((x) => x !== an)) {
    const d = r.getBoundingClientRect().top - oben;
    if (Math.abs(d - 8) > 1) f.push(`hinterer Reiter nicht 8 px tiefer (${d.toFixed(1)})`);
  }
  // Die Reihe nach der Lage im Fluss; die hinteren Reiter sind nur um 8 px verschoben.
  if (new Set(reiter.map((r) => r.offsetTop)).size > 1) f.push('Reiter in mehr als einer Reihe');
  if (!/\d+ von \d+/.test(karte.querySelector('.im-blatt')?.textContent ?? ''))
    f.push('„x von y“ fehlt im Blatt');
  if (getComputedStyle(karte).borderTopLeftRadius !== '0px') f.push('Karte oben links rund');
  const k = karte.getBoundingClientRect();
  const a = an.getBoundingClientRect();
  if (
    a.left < nav.getBoundingClientRect().left - 1 ||
    a.right > nav.getBoundingClientRect().right + 1
  )
    f.push('vorderer Reiter nicht ganz zu sehen');
  if (Math.abs(a.bottom - k.top) > 0.5) f.push('vorderer Reiter hängt nicht an der Kante');
  return f;
}

async function rutsch(page: Page, szenario: string) {
  await szenarioLaden(page, szenario, '/rutsch');
  await page.getByRole('button', { name: /^Los geht/ }).click();
  await expect(page.locator('.register-rahmen .karte')).toBeVisible();
}

test('Trennblätter: vorn 44 px, hinten 8 px tiefer, nur Namen, „x von y“ im Blatt; Gegenprobe', async ({
  page,
}) => {
  await rutsch(page, '03-mehrere-offen');
  expect(await page.evaluate(trennblattPruefen)).toEqual([]);
  expect(await page.evaluate(registerPruefen)).toEqual([]);
  await page.locator('.reiter').nth(1).click();
  await expect(page.locator('.reiter').nth(1)).toHaveClass(/\ban\b/);
  expect(await page.evaluate(trennblattPruefen)).toEqual([]);
  // Gegenprobe: der alte Zähler auf dem Reiter und ein Reiter in zweiter Reihe werden rot.
  await page.evaluate(() => {
    const r = document.querySelector('.reiter:not(.an)')!;
    const z = document.createElement('small');
    z.textContent = '1/3';
    r.append(z);
  });
  expect(await page.evaluate(trennblattPruefen)).toContain('Zähler auf dem Reiter');
});

test('Zu schmal für alle Reiter: eine Reihe, die rollt; der vordere Reiter ganz zu sehen', async ({
  page,
}) => {
  // Die Muster haben im Rutsch höchstens drei Personen; die passen auch bei 320 px mit 130 % in eine Reihe.
  // Ein künstlich schmales Fenster zwingt die Reihe zum Rollen.
  await page.setViewportSize({ width: 150, height: 437 });
  await rutsch(page, '06-drei-erwachsene');
  await page.locator('.reiter').last().click();
  await expect(page.locator('.reiter').last()).toHaveClass(/\ban\b/);
  await page.waitForTimeout(300);
  const f = await page.evaluate(trennblattPruefen);
  expect(f.filter((x) => !x.startsWith('hinterer Reiter'))).toEqual([]);
  await expect(page.locator('.register')).toHaveClass(/rollt/);
});

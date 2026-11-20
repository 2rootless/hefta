import { expect, test, type Page } from '@playwright/test';
import { katalogLaden, mappeBauen, type Fall } from '../stress/katalog';

// PC113, Abschnitt 3, Punkt 3: die 21 Angriffe aus DP76 als Browsertests an der echten Vermieter-Seite, in WebKit und
// Chromium. A1 bis A16 und A19 bis A21 zeigen keine Lesehilfe. A17 und A18 zeigen sie, aber nie ein `x_`-Feld und nie
// die Kennung. Dazu S13 aus PC107: Eine Mappe ohne Hauptmieter öffnet ohne Lesehilfe. Die Mappen baut derselbe
// Katalog wie der Stresstest (tests/stress/katalog.ts), mit Deckblatt in Fassung 1.

test.use({ baseURL: 'http://localhost:4174', viewport: { width: 1280, height: 860 } });

const GEZEIGT = new Set(['A17', 'A18']);
const NUMMERN = [...Array.from({ length: 21 }, (_, i) => `A${i + 1}`), 'S13'];

const zeile = (page: Page, n: number) => page.locator('.vs-row').nth(n - 1);
const haupt = (page: Page) => page.locator('.vs-detail');

let faelle: Fall[] = [];
test.beforeAll(async () => {
  const alle = await katalogLaden();
  faelle = NUMMERN.map((nr) => alle.find((f) => f.nr === nr)!);
});

test('Angriffe A1 bis A21 und S13: nur A17 und A18 zeigen die Lesehilfe, nie x_-Felder oder die Kennung', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const dateien = await Promise.all(
    faelle.map(async (f) => ({
      name: `${f.nr}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(await mappeBauen(f)),
    })),
  );
  await page.locator('input[type=file]').setInputFiles(dateien);
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator('.vs-row')).toHaveCount(faelle.length);

  const falsch: string[] = [];
  for (let i = 0; i < faelle.length; i++) {
    const f = faelle[i]!;
    await zeile(page, i + 1).click();
    await expect(haupt(page)).toContainText(`${f.nr}.pdf`);
    const zeigt = (await haupt(page).locator('.vs-was').count()) > 0;
    if (zeigt !== GEZEIGT.has(f.nr))
      falsch.push(`${f.nr}: Lesehilfe ${zeigt ? 'gezeigt' : 'nicht gezeigt'}`);
    const text = await page.locator('body').innerText();
    for (const verboten of ['x_hefta', 'Von Hefta geprüft', 'd2e0f734', '00000000-0000-4000'])
      if (text.includes(verboten)) falsch.push(`${f.nr}: zeigt „${verboten}“`);
  }
  expect(falsch).toEqual([]);
});

test('Gegenprobe: dieselbe Mappe wie A17 ohne x_-Felder zeigt die Lesehilfe, mit Namen aus dem Papier', async ({
  page,
}) => {
  const k1 = (await katalogLaden()).find((f) => f.nr === 'K1')!;
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'K1.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await mappeBauen(k1)),
  });
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
  await expect(haupt(page).locator('.vs-was')).toBeVisible();
  await expect(haupt(page)).toContainText('Lea Muster-Beispiel');
});

import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  FALSCH,
  KAPUTT,
  LANG,
  M1,
  M2,
  M3,
  M4,
  M5,
  M6,
  M7,
  NB,
  pdf,
  type Datei,
} from './vermieter-hilfe';

test.use({ baseURL: 'http://localhost:4174', viewport: { width: 1280, height: 860 } });

const auswahl = (page: Page) => page.locator('input[type=file]');
async function laden(page: Page, ...dateien: (Datei | string)[]) {
  await auswahl(page).setInputFiles(dateien as never);
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 30_000 });
}
const zeile = (page: Page, n: number) => page.locator('.vs-row').nth(n - 1);
const haupt = (page: Page) => page.locator('.vs-detail');

test('Eingang: Reihenfolge der Ankunft, Stand ohne Wertung, keine Kinder und Bürgen in der Zeile', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('auf einen Blick');
  await laden(page, await pdf(M1), await pdf(M2), await pdf(M3));
  await expect(page.locator('.vs-nr')).toHaveText(['1', '2', '3']);
  await expect(page.locator('.vs-cnt')).toHaveText('Drei Mappen');
  await expect(page.locator('.vs-lw')).toHaveText('für Hauptstraße 12');
  const eins = (await zeile(page, 1).innerText()).replaceAll('­', '');
  expect(eins).toContain('Max und Lea Mustermann');
  expect(eins).toContain('Max und Lea im Vertrag · drei Personen');
  expect(eins).toContain('Selbstauskunft von allen dabei');
  expect(eins).not.toMatch(/Kind|bürgt|Petra/);
  await expect(zeile(page, 2)).toContainText('Olena allein im Vertrag');
  await expect(zeile(page, 3)).toContainText('Ohne Lesehilfe');
  await expect(zeile(page, 3)).toContainText(`Zwölf Seiten`);
  // Es öffnet sich die erste neue Mappe, mit dem Fokus auf ihrem Titel.
  await expect(zeile(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Max und Lea Mustermann' }),
  ).toBeFocused();
});

test('Eine Mappe: nach Schritten geordnet, Herkunft, Prüfen, Bitte und Löschen', async ({
  page,
}) => {
  await page.goto('/');
  await laden(page, await pdf(M1));
  const d = haupt(page);
  const text = (await d.innerText()).replaceAll('­', '');
  expect(text).toContain('Hefta prüft sie nicht');
  expect(text).toContain('Für den Vertrag, nach Ihrer Entscheidung');
  expect(text).toContain('Nicht dabei: Bonitätsnachweis');
  expect(text).toContain('zieht nicht ein');
  expect(text).toContain('Beides steht auf dem Zertifikat');
  expect(text).not.toMatch(/Dezember 2026/);
  expect(text).toContain('Bitte der Bewerber');
  expect(text).toContain('Falls die Wohnung an jemand anderen geht');
  expect(text).toContain('keine Rechtsberatung');
  expect(text).not.toMatch(/dürfen Vermieter|können Sie nicht verlangen|löschen Sie,/);
  // Die Rollen raten kein Geschlecht: Die Lesehilfe kennt es nicht.
  expect(text).toContain('Hauptmietpartei');
  await expect(d.getByRole('link', { name: /meineSCHUFA/ }).first()).toHaveAttribute(
    'href',
    'https://www.meineschufa.de/check',
  );
  await expect(d.getByRole('link', { name: /Orientierungs.?hilfe lesen/ })).toHaveAttribute(
    'href',
    /datenschutzkonferenz-online\.de\/media\/oh\/.*V2\.pdf$/,
  );

  // Jede Zeile öffnet die Mappe an der ersten Seite der Unterlage.
  await d.getByRole('button', { name: /Bonitäts.?nachweis.*Seite.7/ }).click();
  await expect(page.getByRole('heading', { name: /Seite 7 von 18/ })).toBeVisible();
  await expect(page.locator('dialog.ansicht img')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Fertig' }).click();
  await d.getByRole('button', { name: 'Deckblatt mit Kontakt ansehen' }).click();
  await expect(page.getByRole('heading', { name: /Seite 1 von 18/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fertig' }).click();

  await d.getByRole('link', { name: 'Welche Unterlagen wann' }).click();
  await expect(haupt(page)).toContainText('Im Einzelfall kann weniger nötig sein');
  await haupt(page).getByRole('link', { name: 'Zur Mappe' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Max und Lea Mustermann' }),
  ).toBeVisible();
});

test('Nicht nötig, datensparsam, ohne Selbstauskunft, mehrere Wohnungen', async ({ page }) => {
  await page.goto('/');
  await laden(page, await pdf(M2), await pdf(M4), await pdf(M6));
  await expect(page.locator('.vs-lw')).toHaveCount(0);
  await expect(zeile(page, 3)).toContainText('für Lindenallee 3');
  await expect(zeile(page, 3)).toContainText('Selbstauskunft nicht dabei');
  await expect(haupt(page).locator('.vs-gl').last()).toHaveText('Nicht nötig');
  await expect(haupt(page)).toContainText('für unzulässig');

  await zeile(page, 2).click();
  await expect(haupt(page)).toContainText(
    'Die Bewerber haben beigelegt, was zum Mietwunsch gehört',
  );
  await expect(haupt(page).locator('.vs-dx')).toHaveCount(0);

  await zeile(page, 3).click();
  const luecke = haupt(page).locator('.vs-dx');
  await expect(luecke).toHaveCount(1);
  await expect(luecke).toContainText('ab dem Mietwunsch üblich');
});

test('Lange Namen werden nicht gekürzt, und die Lesehilfe passt zu Seite 1', async ({ page }) => {
  await page.goto('/');
  await laden(page, await pdf(LANG));
  await expect(haupt(page)).toContainText('Maximilian-Alexander Müller-Lüdenscheidt');
  await expect(haupt(page)).toContainText('Bartholomäus Wiśniewski-Kowalczyk');
});

test('Fehler stehen getrennt, die Nummern zählen nur Mappen', async ({ page }, info) => {
  const gross = info.outputPath('Scans_komplett.pdf');
  writeFileSync(gross, Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(101 * 1024 * 1024)]));
  await page.goto('/');
  await laden(
    page,
    await pdf(M1),
    FALSCH,
    KAPUTT,
    await pdf({ datei: 'Mappe_Schulz.pdf', seiten: 2, passwort: 'geheim' }),
    { ...(await pdf(M1)), name: 'Bewerbung_Mustermann (1).pdf' },
  );
  await auswahl(page).setInputFiles(gross);
  const kasten = page.getByRole('region', { name: 'Nicht aufgenommen' });
  await expect(kasten.locator('li')).toHaveCount(5, { timeout: 30_000 });
  await expect(kasten).toContainText('Keine PDF.');
  await expect(kasten).toContainText('Lässt sich nicht lesen');
  await expect(kasten).toContainText('Mit Passwort geschützt');
  await expect(kasten).toContainText('Steht schon in der Liste, als Nummer 1.');
  await expect(kasten).toContainText(`Größer als 100${NB}MB`);
  await expect(page.locator('.vs-nr')).toHaveText(['1']);
  await kasten.getByRole('button', { name: 'Ausblenden' }).click();
  await expect(kasten).toHaveCount(0);
  await page.getByRole('button', { name: 'Liste leeren' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('auf einen Blick');
});

test('Lesehilfe passt nicht: gar nicht zeigen. Neuere Fassung: zeigen, was die Seite kennt', async ({
  page,
}) => {
  await page.goto('/');
  await laden(
    page,
    await pdf(M7),
    await pdf({ ...M2, datei: 'Fremd.pdf', ersteSeite: 'Ganz andere Leute' }),
    await pdf(M5),
    await pdf(M3),
  );
  await expect(zeile(page, 1)).toContainText('Lesehilfe passt nicht zur Mappe');
  await expect(zeile(page, 1)).not.toContainText('Mustermann ');
  await expect(haupt(page)).toContainText('passt nicht zu ihren Seiten');
  await expect(haupt(page).locator('.vs-was')).toHaveCount(0);
  await expect(zeile(page, 2)).toContainText('Lesehilfe passt nicht zur Mappe');
  await zeile(page, 3).click();
  await expect(haupt(page)).toContainText('neueren Fassung');
  await expect(haupt(page).locator('.vs-was')).toBeVisible();
  await zeile(page, 4).click();
  await expect(haupt(page)).toContainText('keine Lesehilfe');
  await expect(haupt(page).locator('.vs-loesch')).toBeVisible();
});

test('Fassung der echten App: Die Mappe aus Hefta wird gelesen', async ({ page }) => {
  await page.goto('/');
  await auswahl(page).setInputFiles('docs/screenshots/muster-MP1-standard.pdf');
  await expect(haupt(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.vs-rt')).toContainText('Max und Lea Mustermann');
  await expect(haupt(page)).toContainText('Hauptstraße 12');
});

test('Hineinziehen: Die ganze Seite nimmt an und zeigt es', async ({ page }) => {
  await page.goto('/');
  const bytes = [...(await pdf(M2)).buffer];
  const dt = await page.evaluateHandle((b) => {
    const d = new DataTransfer();
    d.items.add(
      new File([new Uint8Array(b)], 'Bewerbung_Kovalenko.pdf', { type: 'application/pdf' }),
    );
    return d;
  }, bytes);
  await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
  await expect(page.locator('.vs-drop.ziehen')).toContainText('Loslassen zum Hinzufügen');
  await expect(page.locator('.vs-drop.ziehen')).toContainText('Eine Datei');
  await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
  await expect(zeile(page, 1)).toContainText('Olena Kovalenko', { timeout: 20_000 });
});

test('Schmal: Eingang und Mappe als eigene Seiten, Zurück führt zum Eingang', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await laden(page, await pdf(M1), await pdf(M2));
  await expect(page.locator('.vs-detail')).toHaveCount(0);
  await zeile(page, 2).click();
  await expect(page.locator('.vs-list')).toHaveCount(0);
  await expect(haupt(page)).toContainText('Olena Kovalenko');
  await page.getByRole('link', { name: 'Eingang' }).click();
  await expect(page.locator('.vs-row')).toHaveCount(2);
});

test('Für den Vertrag anfordern: Mail mit Zusage, Kopieren, Link ohne Empfänger (VS9)', async ({
  page,
  context,
  browserName,
}) => {
  await page.goto('/');
  await laden(page, await pdf(M1), await pdf(M2));
  await page.getByRole('link', { name: /^Für den Vertrag anfordern/ }).click();
  await expect(page.getByRole('heading', { name: 'Für den Vertrag anfordern' })).toBeVisible();
  const mail = page.locator('.vs-mt');
  await expect(mail).toContainText('Guten Tag Max Mustermann und Lea Mustermann,');
  await expect(mail).toContainText('Von Lea Mustermann: einen Bonitätsnachweis');
  await expect(page.locator('.vs-anf textarea, .vs-anf input')).toHaveCount(0);
  const link = await page.getByRole('link', { name: /Mail.?programm öffnen/ }).getAttribute('href');
  expect(link).toMatch(/^mailto:\?subject=/);
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Mail kopieren' }).click();
    await expect(page.getByText('Die Mail ist kopiert.')).toBeVisible();
    const inhalt = await page.evaluate(() => navigator.clipboard.readText());
    expect(inhalt.replaceAll('\r\n', '\n')).toBe(await mail.evaluate((e) => e.textContent));
  }
  await page.getByRole('link', { name: 'Zur Mappe' }).click();
  await expect(page.locator('.vs-anf')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mappe öffnen' })).toBeVisible();
});

test('Nichts verlässt die Seite: strenge Regel, nichts gespeichert, kein Service Worker', async ({
  page,
}) => {
  const anfragen: string[] = [];
  const antwort = await page.goto('/');
  const csp = antwort!.headers()['content-security-policy']!;
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  const verstoesse: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') verstoesse.push(m.text());
  });
  await page.waitForLoadState('networkidle');
  page.on('request', (r) => {
    if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) anfragen.push(r.url());
  });
  await laden(page, await pdf(M1));
  await haupt(page).getByRole('button', { name: 'Mappe öffnen' }).click();
  await expect(page.locator('dialog.ansicht img')).toBeVisible({ timeout: 20_000 });

  expect(anfragen).toEqual([]);
  expect(verstoesse).toEqual([]);
  const zustand = await page.evaluate(async () => ({
    ablage: localStorage.length + sessionStorage.length,
    datenbanken: (await indexedDB.databases()).length,
    worker: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
    cookies: document.cookie,
  }));
  expect(zustand).toEqual({ ablage: 0, datenbanken: 0, worker: 0, cookies: '' });
  // Auch der Worker von PDF.js kann nicht senden: Seine Datei trägt dieselbe Regel.
  const worker = await page.request.get('/pdfjs/huelle.mjs');
  expect(worker.headers()['content-security-policy']).toContain("connect-src 'none'");
});

async function dunkelAnteil(page: Page) {
  const bild = page.locator('dialog.ansicht img');
  await expect(bild).toBeVisible({ timeout: 30_000 });
  return bild.evaluate(async (i: HTMLImageElement) => {
    await i.decode();
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 400;
    const x = c.getContext('2d')!;
    x.drawImage(i, 0, 0, 300, 400);
    const d = x.getImageData(0, 0, 300, 400).data;
    let n = 0;
    for (let k = 0; k < d.length; k += 4) if (d[k]! < 128) n++;
    return n / (300 * 400);
  });
}

test('Die Probe aus dem Text stimmt: Seite laden, Netz aus, auch Scans werden gezeigt', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  for (const name of ['jbig2.pdf', 'jpx.pdf', 'schrift.pdf']) {
    await auswahl(page).setInputFiles({
      name,
      mimeType: 'application/pdf',
      buffer: readFileSync(`tests/fixtures/vermieter/${name}`),
    });
  }
  await expect(page.locator('.vs-row')).toHaveCount(3, { timeout: 30_000 });
  for (const n of [1, 2, 3]) {
    await zeile(page, n).click();
    await haupt(page).getByRole('button', { name: 'Mappe öffnen' }).click();
    // Bleibt ein Scan stumm weiß, ist dieser Anteil null.
    expect(await dunkelAnteil(page)).toBeGreaterThan(0.03);
    await page.getByRole('button', { name: 'Fertig' }).click();
  }
  await context.setOffline(false);
});

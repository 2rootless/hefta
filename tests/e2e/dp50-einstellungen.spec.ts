import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// DP50 Punkt 10: Einstellungen mit Register „Hefte“, „Mappe“, „App“ (W13, W18) und die Unterseite „Fragen
// für die Besichtigung“. Prüfkatalog E1 bis E6, jeweils mit Gegenprobe, wo es eine gibt.

const JETZT = new Date(2026, 10, 8, 20, 0);

function tag(versatz: number, stunde = 12): string {
  return new Date(2026, 10, 8 + versatz, stunde, 0).toISOString();
}

/** Ein Heft mit Termin in zwei Tagen: Dann stehen die Fragen für die Besichtigung darin. */
function heftMitTermin(id: string) {
  return {
    id,
    createdAt: tag(-10),
    updatedAt: tag(-10),
    haushaltId: null,
    adresse: 'Beispielstraße 1\n20000 Hamburg',
    link: null,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: {
      beworben: null,
      gefragtAm: null,
      termin: { am: tag(2, 17), ort: '', treffpunkt: '' },
      ergebnis: null,
      loeschbitteAm: null,
      nachgefasstAm: null,
      abgelegtAm: null,
    },
    notiz: '',
    angaben: { titel: 'Zwei Zimmer am Park', stadtteil: 'Altona', zimmer: 2, flaeche: 50 },
  };
}

async function heftAnlegen(page: Page, heft: unknown) {
  await page.evaluate(
    (h) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('hefte', 'readwrite');
          tx.objectStore('hefte').put(h);
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
      }),
    heft,
  );
}

async function einstellungen(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __heftaErinnerungenTest: boolean }).__heftaErinnerungenTest = true;
  });
  await szenarioLaden(page, '01-standard', '/einstellungen');
  await expect(page.getByRole('tablist', { name: 'Bereiche der Einstellungen' })).toBeVisible();
}

const reiter = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(JETZT);
});

test('Register: drei Reiter, Kopf bleibt stehen, jeder zeigt seinen Teil (E1, E4)', async ({
  page,
  browserName,
}) => {
  await einstellungen(page);
  await expect(page.getByRole('tab')).toHaveText(['Hefte', 'Mappe', 'App']);
  await expect(reiter(page, 'Hefte')).toHaveAttribute('aria-selected', 'true');
  const blatt = page.getByRole('tabpanel');

  // Hefte: Wünsche, Besichtigung mit Fragen und eigenem Schalter.
  await expect(blatt.getByRole('heading', { name: 'Was ihr sucht' })).toBeVisible();
  await expect(blatt.getByText('Danach zeigt jedes Heft, was passt.')).toBeVisible();
  await expect(blatt.getByRole('link', { name: /^Warmmiete nicht festgelegt$/ })).toBeVisible();
  await expect(
    blatt.getByRole('link', { name: 'Fragen für die Besichtigung Elf von Hefta' }),
  ).toBeVisible();
  const schalterHefte = blatt.getByRole('switch', { name: /Vor einer Besichtigung/ });
  await expect(schalterHefte).toHaveAttribute('aria-checked', 'true');
  // Gegenprobe: Sicherung steht nicht hier.
  await expect(blatt.getByText('Backup erstellen')).toHaveCount(0);
  if (browserName === 'chromium')
    await page.screenshot({ path: 'test-results/dp50-einst-hefte.png', fullPage: true });

  // E1: Reiter wechseln, Titel und Register bleiben, wo sie sind.
  const vorher = {
    titel: await page.getByRole('heading', { level: 1 }).boundingBox(),
    register: await page.getByRole('tablist').boundingBox(),
  };
  await reiter(page, 'Mappe').click();
  await expect(reiter(page, 'Mappe')).toHaveAttribute('aria-selected', 'true');
  expect(await page.getByRole('heading', { level: 1 }).boundingBox()).toEqual(vorher.titel);
  expect(await page.getByRole('tablist').boundingBox()).toEqual(vorher.register);

  // Mappe: Haushalt mit Marke und Rolle, jede Zeile zur Personenseite; die Bürgin mit Umriss.
  await expect(blatt.getByRole('heading', { name: 'Haushalt' })).toBeVisible();
  for (const name of ['Max', 'Lea', 'Petra'])
    await expect(blatt.getByRole('link', { name: new RegExp(`^${name} `) })).toHaveAttribute(
      'href',
      /^#\/person\//,
    );
  await expect(blatt.locator('.marke')).toHaveCount(3);
  await expect(blatt.locator('.marke.umriss')).toHaveCount(1);
  // E4: eigener Schalter für Unterlagen; ausschalten lässt den für Hefte an.
  const schalterMappe = blatt.getByRole('switch', { name: /Neue Monate und Ablauf/ });
  await schalterMappe.click();
  await expect(schalterMappe).toHaveAttribute('aria-checked', 'false');
  // „Haushalt löschen“ erst nach dem Blatt; Abbrechen lässt alles, wie es ist.
  await blatt.getByRole('button', { name: 'Haushalt löschen' }).click();
  const frage = page.getByRole('dialog', { name: 'Haushalt löschen?' });
  await expect(frage).toBeVisible();
  await frage.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(frage).toBeHidden();
  if (browserName === 'chromium')
    await page.screenshot({ path: 'test-results/dp50-einst-mappe.png', fullPage: true });

  await reiter(page, 'Hefte').click();
  await expect(schalterHefte).toHaveAttribute('aria-checked', 'true');

  // App: Sicherung, Speicher, Aussehen und Sprache, Über Hefta, Datenschutz.
  await reiter(page, 'App').click();
  for (const h of ['Sicherung', 'Speicher', 'Aussehen und Sprache', 'Über Hefta', 'Datenschutz'])
    await expect(blatt.getByRole('heading', { name: h, exact: true })).toBeVisible();
  await expect(
    blatt.getByRole('link', { name: /^Datenschutz Was Hefta speichert und wo/ }),
  ).toHaveAttribute('href', '#/einstellungen/rechtliches');
  if (browserName === 'chromium')
    await page.screenshot({ path: 'test-results/dp50-einst-app.png', fullPage: true });

  // Tastatur wie bei jedem Register: Pfeil nach links wählt den Reiter davor.
  await reiter(page, 'App').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(reiter(page, 'Mappe')).toHaveAttribute('aria-selected', 'true');
  await expect(reiter(page, 'Mappe')).toBeFocused();
});

test('E2: Reichen die Reiter bis an den Rand, ist die Kante oben rechts gerade', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await einstellungen(page);
  const kante = () =>
    page.getByRole('tabpanel').evaluate((b) => getComputedStyle(b).borderTopRightRadius);
  // Gegenprobe: Die drei Reiter passen, die Ecke rechts bleibt rund.
  await expect.poll(kante).toBe('20px');
  // Große Schrift: Jetzt reichen sie an den Rand, die Ecke wird gerade, keine Rundung unter dem Reiter.
  await page.evaluate(() => document.documentElement.style.setProperty('--px', '1.9px'));
  await reiter(page, 'App').click();
  const rand = await page.evaluate(() => {
    const b = document.querySelector('[role=tabpanel]')!.getBoundingClientRect();
    const l = document.querySelector('[role=tab]:last-child')!.getBoundingClientRect();
    return { blatt: b.right, reiter: l.right };
  });
  expect(rand.reiter).toBeGreaterThan(rand.blatt - 20);
  await expect.poll(kante).toBe('0px');
  const fuss = await reiter(page, 'App').evaluate((r) => getComputedStyle(r, '::after').display);
  expect(fuss).toBe('none');
  // Kein seitliches Rollen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('E3: Mail antippen kopiert, „Kopiert“ in derselben Zeile, kein Fenster', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Zwischenablage nur in Chromium freigegeben');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await einstellungen(page);
  await reiter(page, 'App').click();
  const zeile = page.locator('.listenzeile.rueck');
  await zeile.getByRole('button', { name: 'Adresse kopieren' }).click();
  const kopiert = zeile.getByRole('status');
  await expect(kopiert).toHaveText('Kopiert');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const z = (await zeile.boundingBox())!;
  const k = (await kopiert.boundingBox())!;
  expect(k.y).toBeGreaterThanOrEqual(z.y);
  expect(k.y + k.height).toBeLessThanOrEqual(z.y + z.height);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('hallo@hefta.de');
  await page.screenshot({ path: 'test-results/dp50-einst-kopiert.png' });
});

test('E5: Eine Frage von Hefta ausschalten: in keinem Heft mehr; einschalten bringt sie zurück', async ({
  page,
  browserName,
}) => {
  await einstellungen(page);
  await heftAnlegen(page, heftMitTermin('e5'));
  await page.reload();
  await expect(page.getByRole('tablist')).toBeVisible();
  // Im Heft eine Antwort notieren: Diese Frage bleibt mit ihr stehen, auch ausgeschaltet.
  await page.evaluate(() => (window.location.hash = '#/heft/e5'));
  const imHeft = page.getByRole('region', { name: /Fragen für die Besichtigung/ });
  await imHeft.getByRole('button', { name: /^Alle \S+ Fragen$/ }).click();
  await expect(imHeft).toContainText('Gibt es Keller, Fahrradraum oder Waschküche?');
  await imHeft.getByRole('button', { name: 'Antwort notieren' }).first().click();
  const antwort = imHeft.getByRole('textbox', { name: /Antwort zu: Gibt es Mängel/ });
  await antwort.fill('Bad alt');
  await antwort.blur();
  await expect(imHeft.getByRole('button', { name: 'Antwort ändern: Bad alt' })).toBeVisible();

  await page.evaluate(() => (window.location.hash = '#/einstellungen'));
  await page.getByRole('link', { name: /^Fragen für die Besichtigung/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Fragen für die Besichtigung' }),
  ).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(3);
  await page.getByRole('button', { name: 'Acht weitere' }).click();
  await expect(page.getByRole('switch')).toHaveCount(11);
  await page.getByRole('switch', { name: /Gibt es Keller/ }).click();
  await page.getByRole('switch', { name: /Gibt es Mängel/ }).click();
  await expect(page.getByRole('switch', { name: /Gibt es Keller/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  // Zwei schnelle Tipps: Beide bleiben aus (der zweite überschrieb früher den ersten).
  await expect(page.getByRole('switch', { name: /Gibt es Mängel/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  // Eigene Frage dazu, ändern über „···“.
  await page.getByRole('button', { name: 'Eigene Frage' }).click();
  await page.getByRole('textbox', { name: 'Eigene Frage' }).fill('Gibt es Glasfaser im Haus?');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText('Gibt es Glasfaser im Haus?')).toBeVisible();
  await expect(page.getByText(/^Ausgeschaltete Fragen stehen in keinem Heft mehr\./)).toBeVisible();
  if (browserName === 'chromium')
    await page.screenshot({ path: 'test-results/dp50-einst-fragen.png', fullPage: true });

  // Zurück in den Einstellungen: neun von Hefta, eine eigene.
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(
    page.getByRole('link', { name: 'Fragen für die Besichtigung Neun von Hefta, eine eigene' }),
  ).toBeVisible();

  // Im Heft: Keller fehlt, Mängel bleibt wegen der Antwort.
  await page.evaluate(() => (window.location.hash = '#/heft/e5'));
  await expect(imHeft).toBeVisible();
  const alle = imHeft.getByRole('button', { name: /^Alle \S+ Fragen$/ });
  if (await alle.count()) await alle.click();
  await expect(imHeft).toContainText('Gibt es Mängel');
  await expect(imHeft).not.toContainText('Gibt es Keller');
  await expect(imHeft).toContainText('Gibt es Glasfaser im Haus?');
  // Nicht unter „ausgeblendet“: Einschalten geht in den Einstellungen.
  await expect(imHeft.getByText(/ausgeblendet$/)).toHaveCount(0);

  // Einschalten bringt sie zurück.
  await page.evaluate(() => (window.location.hash = '#/einstellungen/fragen'));
  await page.getByRole('button', { name: 'Acht weitere' }).click();
  await page.getByRole('switch', { name: /Gibt es Keller/ }).click();
  await expect(page.getByRole('switch', { name: /Gibt es Keller/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Eigene Frage löschen.
  await page
    .getByRole('button', { name: 'Ändern oder löschen: Gibt es Glasfaser im Haus?' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Gibt es Glasfaser im Haus?')).toHaveCount(0);
  await page.evaluate(() => (window.location.hash = '#/heft/e5'));
  if (await alle.count()) await alle.click();
  await expect(imHeft).toContainText('Gibt es Keller');
});

test('E6: Wünsche ändern gilt sofort, ohne „Speichern“', async ({ page }) => {
  await einstellungen(page);
  await page.getByRole('link', { name: /^Warmmiete nicht festgelegt$/ }).click();
  const warm = page.locator('#w-warm');
  await warm.fill('1400');
  await warm.dispatchEvent('change');
  await expect(page.getByRole('button', { name: /^Speichern/ })).toHaveCount(0);
  await page.goBack();
  await expect(reiter(page, 'Hefte')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('link', { name: /^Warmmiete bis 1\.400\s€$/ })).toBeVisible();
});

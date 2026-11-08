import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { eigenerServer } from './eigener-server';
import { animationenFertig, beobachten, cspMelden, fremde, serviceWorkerBereit } from './hilfen';

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
});

test('zeigt den ersten Start im Stil des Designs', async ({ page, browserName }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Eure Mappe für die Wohnungssuche.' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Hefta' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Los geht’s' })).not.toHaveAttribute(
    'aria-disabled',
  );
  await expect(page.getByRole('button', { name: 'Ich habe ein Backup' })).toBeVisible();
  // E42: Vermieter, die hefta.de eintippen, finden den Weg zur Vermieterseite.
  await expect(page.getByText(/^Du hast eine Mappe bekommen und vermietest\?/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'vermieter.hefta.de' })).toHaveAttribute(
    'href',
    'https://vermieter.hefta.de',
  );

  const stil = await page.evaluate(async () => {
    await document.fonts.ready;
    const h1 = getComputedStyle(document.querySelector('h1')!);
    return {
      hintergrund: getComputedStyle(document.body).backgroundColor,
      schrift: h1.fontFamily,
      groesse: h1.fontSize,
      gewicht: h1.fontWeight,
      archivoGeladen: document.fonts.check('800 34px Archivo'),
    };
  });
  expect(stil.hintergrund).toBe('rgb(245, 246, 250)');
  expect(stil.schrift).toContain('Archivo');
  expect(stil.groesse).toBe('34px');
  expect(stil.gewicht).toBe('800');
  expect(stil.archivoGeladen).toBe(true);

  // Bildschirmfotos nur aus Chromium: WebKit unter Windows stellt variable Schriften fehlerhaft dar.
  const fotos = browserName === 'chromium';
  if (fotos) {
    await animationenFertig(page);
    await page.screenshot({ path: 'docs/screenshots/m0-uebersicht-hell.png' });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(20, 21, 31)',
  );
  if (fotos) await page.screenshot({ path: 'docs/screenshots/m0-uebersicht-dunkel.png' });
});

test('besteht den automatischen Barrierefreiheits-Check', async ({ page }) => {
  for (const pfad of ['/', '/#/technik-test']) {
    await page.goto(pfad);
    await page.locator('h1').waitFor();
    for (const thema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: thema });
      await animationenFertig(page);
      const ergebnis = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(ergebnis.violations.map((v) => `${pfad} ${thema}: ${v.id} – ${v.help}`)).toEqual([]);
    }
  }
});

test('lädt nichts von fremden Hosts und verletzt die CSP nicht', async ({ page, baseURL }) => {
  const beobachtung = beobachten(page);
  await page.goto('/');
  await page.locator('h1').waitFor();
  await page.goto('/#/technik-test');
  await page.getByRole('button', { name: 'Mappe bauen' }).click();
  await page.locator('[data-pruefung="mappe"]').waitFor({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Beispiel mit Passwort testen' }).click();
  await page.locator('[data-pruefung="pw-raster"]').waitFor({ timeout: 60_000 });

  expect(fremde(beobachtung.anfragen, baseURL!)).toEqual([]);
  expect(await beobachtung.cspVerstoesse()).toEqual([]);
  expect(beobachtung.fehler.filter((f) => /Content.Security|CSP|Refused/i.test(f))).toEqual([]);
});

test('öffnet offline aus dem Service Worker', async ({ page, context, browserName }) => {
  await page.goto('/');
  test.skip(!(await serviceWorkerBereit(page)), `Kein Service Worker in ${browserName}`);

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Eure Mappe für die Wohnungssuche.' }),
  ).toBeVisible();
  await page.goto('/#/technik-test');
  await expect(page.getByRole('heading', { level: 1, name: 'Technik-Test' })).toBeVisible();
  // Auch PDF.js samt Worker, Schriften und WebAssembly kommt offline aus dem Cache.
  await page.getByRole('button', { name: 'Mappe bauen' }).click();
  await expect(page.locator('[data-pruefung="mappe"]')).toHaveAttribute('data-ok', 'true', {
    timeout: 90_000,
  });
  await context.setOffline(false);
});

test('Technik-Test, Version 2.0: Proben für das iPhone, die Kalenderdatei kommt aus dem Cache', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  const mitWorker = await serviceWorkerBereit(page);
  await page.goto('/#/technik-test');
  await expect(page.getByRole('link', { name: 'Dateien öffnen' })).toHaveAttribute(
    'href',
    'shareddocuments://',
  );
  await page
    .getByRole('group', { name: 'Kam zu Termin 3 eine Mitteilung?' })
    .getByRole('button', { name: 'Nein' })
    .click();
  await expect(page.locator('[data-pruefung="kalender-mitteilung"]')).toContainText('Nein');
  await expect(page.getByText('Termin 2, übermorgen')).toBeVisible();
  test.skip(!mitWorker, `Kein Service Worker in ${browserName}`);
  const antwort = await page.evaluate(async () => {
    const a = await fetch('./kalender-1.ics');
    const leer = await fetch('./gibt-es-nicht.ics');
    return {
      typ: a.headers.get('content-type'),
      text: await a.text(),
      leer: leer.status,
    };
  });
  expect(antwort.typ).toContain('text/calendar');
  expect(antwort.text).toContain('SUMMARY:Hefta-Test 1');
  expect(antwort.leer).toBe(404);
});

test('meldet eine neue Version und aktualisiert erst auf Tipp', async ({ page, browserName }) => {
  const server = await eigenerServer();
  try {
    await page.goto(server.adresse);
    test.skip(!(await serviceWorkerBereit(page)), `Kein Service Worker in ${browserName}`);
    await expect(page.getByText('Neue Version da.')).toHaveCount(0);

    server.neueVersion();
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText('Neue Version da.')).toBeVisible();
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Jetzt neu starten' }).click(),
    ]);
    await expect(page.getByText('Neue Version da.')).toHaveCount(0);
  } finally {
    await server.schliessen();
  }
});

test('neue Version startet beim Zurückkehren auf die Übersicht von selbst', async ({
  page,
  browserName,
}) => {
  const server = await eigenerServer();
  try {
    await page.goto(server.adresse);
    test.skip(!(await serviceWorkerBereit(page)), `Kein Service Worker in ${browserName}`);
    server.neueVersion();
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText('Neue Version da.')).toBeVisible();
    await Promise.all([
      page.waitForEvent('load'),
      page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))),
    ]);
    await expect(page.getByText('Neue Version da.')).toHaveCount(0);
  } finally {
    await server.schliessen();
  }
});

test('ohne Speicher: ruhiger Hinweis statt leerer Seite, „Erneut versuchen“', async ({
  page,
  browserName,
}) => {
  // IndexedDB fällt aus (z. B. privater Modus mit gesperrtem Speicher).
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get: () => ({
        open: () => {
          throw new DOMException('Speicher gesperrt', 'UnknownError');
        },
      }),
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hefta kommt gerade nicht an deine Daten.' }),
  ).toBeVisible();
  await expect(page.getByText('Hefta hat nichts gelöscht.', { exact: false })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText(/^Fehler: speicher-nicht-erreichbar · /)).toBeVisible();
  await page.getByRole('button', { name: 'Fehler kopieren' }).click();
  await expect(page.getByRole('button', { name: 'Kopiert' })).toBeVisible();
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeEnabled();
  if (browserName === 'chromium') {
    await animationenFertig(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  }
});

test('unerwarteter Fehler: Kasten mit „Noch einmal versuchen“, schließbar, schiebt den Inhalt', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('heading', { level: 1, name: 'Eure Mappe für die Wohnungssuche.' })
    .waitFor();
  const obenVorher = await page.locator('h1').evaluate((e) => e.getBoundingClientRect().top);
  await page.evaluate(() => {
    void Promise.reject(new Error('Testfehler'));
  });
  const hinweis = page.getByRole('status').filter({ hasText: 'Das hat nicht geklappt.' });
  await expect(hinweis).toBeVisible();
  await expect(hinweis.getByRole('button', { name: 'Noch einmal versuchen' })).toBeVisible();
  const obenNachher = await page.locator('h1').evaluate((e) => e.getBoundingClientRect().top);
  expect(obenNachher).toBeGreaterThan(obenVorher);
  await hinweis.getByRole('button', { name: 'Schließen' }).click();
  await expect(hinweis).toBeHidden();
});

test('erster Start: „Los geht’s“ zeigt zuerst die Homescreen-Anleitung', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Erst auf den Homescreen.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wer bist du?' })).toBeVisible();
});

test('erster Start: „Später“ fragt höchstens noch einmal, „Ich habe ein Backup“ führt zum Einspielen', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ich habe ein Backup' }).click();
  // Erst die Anleitung: In Safari eingespielt, fehlt das Backup später in der App auf dem Homescreen.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Erst auf den Homescreen.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Backup einspielen' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  // Einmal „Später“ gilt auch hier: Die Einrichtung fragt nicht gleich noch einmal.
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wer bist du?' })).toBeVisible();
  await page.getByLabel('Vorname').fill('Max');
  await page.getByLabel('Nachname').fill('Mustermann');
  await page.getByRole('radio', { name: 'Hauptmieter', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  // Einmal fragt Hefta noch, dann nie wieder.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Erst auf den Homescreen.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Jetzt die Unterlagen.' }),
  ).toBeVisible();
  await page.evaluate(() => (window.location.hash = '#/homescreen-probe'));
  const gezeigt = await page.evaluate(
    () =>
      new Promise((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const g = r.result.transaction('einstellungen').objectStore('einstellungen').get('app');
          g.onsuccess = () => ok(g.result.homescreenHinweisGezeigt);
        };
      }),
  );
  expect(gezeigt).toBe(true);
});

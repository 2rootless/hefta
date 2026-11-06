import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { PDFDocument } from '@cantoo/pdf-lib';
import { cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Lesereihenfolge der Übersicht (design/unterlage-warum-haushalt.md, Abschnitt 4, lesefolge-U01.png).
// Geprüft wird der Zugänglichkeitsbaum des Browsers; VoiceOver selbst lässt sich hier nicht starten.

async function laden(page: Page, szenario: string, pfad = '/') {
  const leer = await PDFDocument.create();
  leer.addPage([595, 842]);
  const pdf = [...(await leer.save())];
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(
    async ({ daten, pdf }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: pdf.length,
          daten: new Uint8Array(pdf).buffer,
        });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(SZENARIEN.find((s) => s.id === szenario)!), pdf },
  );
  await page.goto('about:blank');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
}

const ueberschriften = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main h1, main h2, main h3')].map(
      (h) =>
        `${h.tagName} ${h.querySelector('a')?.getAttribute('aria-label') ?? h.textContent?.trim()}`,
    ),
  );

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('Übersicht: Überschriften, Personen als Links, Band als Bild, Reihenfolge', async ({
  page,
  browserName,
}) => {
  await laden(page, '01-standard');

  // Das Logo ist Schmuck, das Band ein Bild mit einem Satz.
  await expect(page.getByRole('img', { name: /mappe/i })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /^Fortschritt: / })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Haushalt bearbeiten: / })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Einstellungen' })).toBeVisible();

  // Sechs Überschriften: Begrüßung, „Im Mietvertrag“, Max, Lea, „Bürgschaft“, Petra.
  const kopf = await ueberschriften(page);
  expect(kopf).toHaveLength(6);
  expect(kopf[0]).toMatch(/^H1 Hallo Max/);
  expect(kopf[1]).toBe('H2 Im Mietvertrag');
  expect(kopf[2]).toMatch(/^H3 Max, Hauptmieter\. /);
  expect(kopf[3]).toMatch(/^H3 Lea, Mitmieterin\. /);
  expect(kopf[4]).toBe('H2 Bürgschaft');
  expect(kopf[5]).toMatch(/^H3 Petra, Bürgin, Zusatz\. /);

  // Name, Rolle, Stand; der Stand zählt „aktuell“ wie das Band, in Worten.
  await expect(
    page.getByRole('link', {
      name: /^Max, Hauptmieter\. [A-ZÄÖÜ][a-zäöüß]+ von [a-zäöüß]+ aktuell\.$/,
    }),
  ).toBeVisible();

  // Das Eintragen-Feld ist ein eigenes Element nach der Person und tut etwas auf dieser Seite.
  await expect(page.getByRole('button', { name: /^.+ hinzufügen\. .+\.$/ }).first()).toBeVisible();

  // Was eine andere Seite öffnet, ist ein Link; die Hauptaktion kommt zuletzt.
  await expect(page.getByRole('link', { name: 'Mappe trotzdem erstellen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jetzt sichern' })).toBeVisible();
  const haupt = page.getByRole('link', { name: /^Unterlagen hinzufügen, [a-zäöüß]+ offen$/ });
  await expect(haupt).toBeVisible();

  const baum = await page.locator('body').ariaSnapshot();
  const zeilen = baum.split('\n').map((z) => z.trim());
  const stelle = (muster: RegExp) => {
    const i = zeilen.findIndex((z) => muster.test(z));
    expect(i, String(muster)).toBeGreaterThanOrEqual(0);
    return i;
  };
  const reihenfolge = [
    /link "Einstellungen"/,
    /heading "Hallo Max/,
    /link "Haushalt bearbeiten: /,
    /img "Fortschritt: /,
    /heading "Im Mietvertrag"/,
    /link "Max, Hauptmieter\. /,
    /link "Lea, Mitmieterin\. /,
    /heading "Bürgschaft"/,
    /Zusätzlich, falls der Vermieter fragt/,
    /link "Petra, Bürgin, Zusatz\. /,
    /link "Mappe trotzdem erstellen"/,
    /link "Jetzt sichern"/,
    /link "Unterlagen hinzufügen, /,
  ].map(stelle);
  expect(reihenfolge).toEqual([...reihenfolge].sort((a, b) => a - b));

  // Abschrift für das Design: was der Browser Screenreadern anbietet, von oben nach unten.
  if (browserName === 'chromium')
    writeFileSync(
      'docs/lesefolge-U01-ist.txt',
      `Zugänglichkeitsbaum aus Chromium (Szenario 01-standard). Das ist NICHT VoiceOver.\n\n${baum}\n`,
    );
});

test('Ohne Bürgen gibt es keine Abschnitte: Die Personen sind Ebene 2', async ({ page }) => {
  await laden(page, '23-ohne-datum');
  const kopf = await ueberschriften(page);
  expect(kopf[1]).toMatch(/^H2 Max, Hauptmieter\. /);
  expect(kopf.some((k) => k.includes('Im Mietvertrag'))).toBe(false);
});

test('Personenansicht und Rutsch: Band als ein Satz, Personen als Tasten', async ({ page }) => {
  await laden(page, '01-standard', '/person/p-01-standard-0');
  await expect(page.getByRole('img', { name: /^Max: \S+ von \S+ aktuell$/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Bonitäts/ })).toBeVisible();

  await laden(page, '01-standard', '/rutsch');
  await page.getByRole('button', { name: /^Max/ }).click();
  await expect(page.getByRole('img', { name: /^Schritt \S+ von \S+: .+ für Max$/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Zu Petra springen' })).toBeVisible();
  // Die Steine liest niemand einzeln vor.
  await expect(page.getByRole('button', { name: /^Schritt \d+ von/ })).toHaveCount(0);
});

test('Fokus: nach einem Seitenwechsel auf dem Titel, sichtbarer Ring, Felder behalten ihn', async ({
  page,
  browserName,
}) => {
  await laden(page, '01-standard');
  await page.getByRole('link', { name: /^Lea, / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lea' })).toBeFocused();

  await page.getByRole('link', { name: 'Ändern', exact: false }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

  // Ein Formular, das ein Feld fokussiert, behält den Fokus dort.
  await page.evaluate(() => (location.hash = '#/person-neu/mitmieter'));
  await expect(page.getByLabel('Vorname', { exact: true })).toBeFocused();

  if (browserName === 'chromium') {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const stil = getComputedStyle(document.activeElement!);
      return `${stil.outlineWidth} ${stil.outlineOffset}`;
    });
    expect(ring).toBe('3px 2px');
  }
});

test('Große Schrift: Standard ist pixelgleich, --px vergrößert nur die Schrift', async ({
  page,
}) => {
  await laden(page, '01-standard');
  const schrift = () =>
    page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.setProperty('font-size', 'calc(17 * var(--px))');
      document.body.append(probe);
      const groesse = getComputedStyle(probe).fontSize;
      probe.remove();
      return groesse;
    });
  const karte = page.locator('.band .karte').first();
  const breite = () => karte.evaluate((e) => e.getBoundingClientRect().width);
  expect(await schrift()).toBe('17px');
  const vorher = await breite();
  await page.evaluate(() => document.documentElement.style.setProperty('--px', '2px'));
  expect(await schrift()).toBe('34px');
  expect(await breite()).toBe(vorher);
});

test('Bewegung reduzieren: kurzes Überblenden, kein Schieben', async ({ page }) => {
  await laden(page, '01-standard');
  const einblenden = await page.evaluate(() => {
    const e = document.querySelector('.einblenden')!;
    return getComputedStyle(e).animationDuration;
  });
  expect(einblenden).toBe('0.15s');
});

import { mkdirSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { hefteAnlegen } from './hefte-hilfen';
import { szenarioLaden } from './szenario-laden';

// Bilder der Bürgschaftserklärung (E112) für den Vergleich mit DP41-7, DP41-8 und DP49-3. Nur mit
// E112_BILDER=1; sie landen in docs/e112-bilder/.

test.skip(!process.env.E112_BILDER, 'nur auf Wunsch (E112_BILDER=1)');
test.use({ viewport: { width: 390, height: 844 } });

const ORDNER = 'docs/e112-bilder';
const ALT = new Date(Date.now() - 2 * 3600_000).toISOString();
const PETRA = 'p-02-neustart-2';

async function laden(page: Page, pfad: string) {
  await szenarioLaden(page, '02-neustart', '/wohnungen');
  await hefteAnlegen(page, [
    {
      id: 'h8',
      createdAt: ALT,
      updatedAt: ALT,
      haushaltId: null,
      adresse: 'Lindenring 8\n20259 Hamburg',
      link: null,
      quelle: '',
      inseratText: null,
      kennung: 'k-h8',
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
      angaben: {
        titel: null,
        stadtteil: null,
        warm: null,
        anbieter: 'Hausverwaltung Beispiel GmbH',
      },
    },
  ]);
  await page.goto('/__leer');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
}

async function ganz(page: Page, name: string) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  await page.screenshot({ path: `${ORDNER}/${name}.png`, fullPage: true });
}

test('Bilder E112', async ({ page }) => {
  mkdirSync(ORDNER, { recursive: true });
  await laden(page, '/heft/h8');
  await page.locator('section.heft-mappe').scrollIntoViewIfNeeded();
  await page
    .locator('section.heft-mappe')
    .screenshot({ path: `${ORDNER}/1-heft-erklaerung-fehlt.png` });

  await page.getByRole('link', { name: 'Erklärung vorbereiten' }).click();
  await page.locator('main h1').waitFor();
  await ganz(page, '2-formular-aus-dem-heft');
  await page.getByRole('button', { name: /^PDF erstellen/ }).click();
  await ganz(page, '3-formular-fehlt');
  await page.locator('.betrag-feld input').fill('3600');
  await page.locator('.betrag-feld input').blur();
  await page.getByRole('radio', { name: /^Ausfallbürgschaft/ }).click();
  await ganz(page, '4-formular-bereit');
  await page.getByRole('button', { name: /^PDF erstellen/ }).click();
  await page.getByRole('heading', { name: 'Im PDF' }).waitFor();
  await page.locator('.miniatur img').nth(1).waitFor();
  await ganz(page, '5-pdf-erstellt');

  // Die Blätter groß, in der Seitenansicht von Hefta.
  await page.setViewportSize({ width: 900, height: 1270 });
  await page.getByRole('button', { name: /^Blatt 1: Erklärung/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${ORDNER}/6-blatt-1.png` });
  await page.getByRole('button', { name: 'Nächste Seite' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${ORDNER}/7-blatt-2.png` });

  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/person/${PETRA}`);
  await page.locator('main h1').waitFor();
  await ganz(page, '8-personenseite');
});

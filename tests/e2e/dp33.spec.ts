import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { wuenscheSetzen } from './hefte-hilfen';

// DP33 (PC34): Fehler und Funde aus der Inventur der Seiten, am Gerät-Maß 390 × 844.

/** Ganz nach unten: Der Knopf steht frei, nichts liegt darunter; Abstand zum Inhalt mindestens 16 px. */
async function knopfFrei(page: Page, knopf: string) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const m = await page.evaluate((name) => {
    const cta = [...document.querySelectorAll<HTMLElement>('.cta')].find((c) =>
      c.textContent?.includes(name),
    )!;
    const knopfOben = cta.querySelector('button')!.getBoundingClientRect().top;
    // Das letzte Stück Inhalt vor der Knopfzeile.
    const davor = cta.previousElementSibling!.getBoundingClientRect();
    return { knopfOben, inhaltUnten: davor.bottom, fenster: window.innerHeight };
  }, knopf);
  expect(m.knopfOben - m.inhaltUnten).toBeGreaterThanOrEqual(16);
  expect(m.knopfOben).toBeLessThan(m.fenster);
}

test('Fehler 3: „Fertig“ in den Wünschen deckt am Ende nichts ab', async ({ page }) => {
  await haushaltMitMax(page);
  await wuenscheSetzen(page, {
    warmBis: 1800,
    zimmerAb: 3,
    flaecheAb: 60,
    ort: null,
    einzugVon: '2026-12-01',
    einzugBis: '2027-02-28',
  });
  await page.goto('/#/wuensche');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Fertig' })).toBeVisible();
  await knopfFrei(page, 'Fertig');
});

test('Fehler 3: „Heft anlegen“ in der letzten Kontrolle deckt am Ende nichts ab', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.goto('/#/wohnung-neu/text');
  await page.reload();
  await page
    .getByRole('textbox', { name: 'Text des Inserats hier einfügen' })
    .fill(
      [
        'Helle Wohnung am Park',
        'Musterweg 7, 20359 Hamburg',
        'Kaltmiete 1.420 €',
        'Gesamtmiete 1.830 €',
        'Zimmer 2',
        'Wohnfläche ca. 59,5 m²',
      ].join('\n'),
    );
  await page.getByRole('button', { name: 'Eckdaten lesen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Letzte Kontrolle' })).toBeVisible();
  await knopfFrei(page, 'Heft anlegen');
});

// PC208 (CP121, 2): Auch für Bürgen gibt es keine Form mehr zu wählen; überall steht der Name.
test('PC208: „Person hinzufügen“ für Bürgen ohne Wahl der Form', async ({ page }) => {
  await haushaltMitMax(page);
  await page.goto('/#/person-neu/buerge');
  await page.reload();
  await page.getByLabel('Vorname', { exact: true }).fill('Олена');
  await page.getByLabel('Nachname', { exact: true }).fill('Коваленко');
  for (const form of ['Bürgin', 'Bürge', 'Neutral'])
    await expect(page.getByRole('radio', { name: form, exact: true })).toHaveCount(0);
  await expect(page.getByText('So steht es auf der Karte')).toHaveCount(0);
  // Gegenprobe: Die Felder der Person stehen weiter da.
  await expect(page.getByLabel(/Einkommen\?$/)).toBeVisible();
});

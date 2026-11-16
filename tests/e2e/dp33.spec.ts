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

test('DP35 G2: In „Person hinzufügen“ bleibt die gewählte Rolle gewählt und steht in Tinte', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.goto('/#/person-neu/mitmieter');
  await page.reload();
  await page.getByLabel('Vorname', { exact: true }).fill('Олена');
  await page.getByLabel('Nachname', { exact: true }).fill('Коваленко');
  const rolle = page.getByRole('radio', { name: 'Mitmieterin' });
  await rolle.click();
  await expect(rolle).toHaveAttribute('aria-checked', 'true');
  const farben = await rolle.evaluate((e) => {
    const s = getComputedStyle(e);
    const probe = document.createElement('span');
    probe.style.color = 'var(--action)';
    probe.style.backgroundColor = 'var(--on-action)';
    document.body.append(probe);
    const p = getComputedStyle(probe);
    const soll = { grund: p.color, schrift: p.backgroundColor };
    probe.remove();
    return { grund: s.backgroundColor, schrift: s.color, soll };
  });
  expect(farben.grund).toBe(farben.soll.grund);
  expect(farben.schrift).toBe(farben.soll.schrift);
  // Die anderen Rollen sind nicht gewählt und sehen anders aus.
  const andere = page.getByRole('radio', { name: 'Mitmieter', exact: true });
  await expect(andere).toHaveAttribute('aria-checked', 'false');
  expect(await andere.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(farben.grund);
});

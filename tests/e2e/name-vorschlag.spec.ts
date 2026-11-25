import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { hefteAnlegen } from './hefte-hilfen';

// PC126 K4 (DP82, Abschnitt 6): Seite „Name“. Überall „Name“; der Vorschlag aus dem Titel passt in 40 Zeichen und ist
// genau das, was „Einsetzen“ einsetzt; „Übernehmen“ ist danach nicht gesperrt; unter dem Feld steht immer, was
// oben steht, bis ein Name da ist. Titel mit 53 Zeichen wie bei Design, bei 390 px und bei 320 px mit 130 %.
// Nur Musterdaten nach W7 (Fassung 25).

const TITEL = 'Helle 3-Zimmer-Wohnung mit Balkon und Blick ins Grüne';
const VORSCHLAG = 'Helle 3-Zimmer-Wohnung mit Balkon';
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};
const HEFT = {
  id: 'k4-name',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
  haushaltId: null,
  adresse: 'Musterweg 7\n00100 Musterstadt',
  link: null,
  quelle: '',
  inseratText: `${TITEL}\nKaltmiete 900 €`,
  kennung: 'k-k4-name',
  ereignisse: leer,
  notiz: '',
  angaben: { titel: TITEL, stadtteil: null, warm: null, zimmer: 3, flaeche: null, merkmal: null },
};

const ANSICHTEN = [
  { id: '390', breite: 390, hoehe: 844, zoom: 1 },
  { id: '320-text130', breite: 320, hoehe: 568, zoom: 1.3 },
];

async function nameOeffnen(page: Page, zoom: number) {
  // Neu laden: Hefta liest die eben in die Datenbank gelegten Hefte beim Start.
  await page.goto(`/#/heft/${HEFT.id}/merkmal`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Name', exact: true })).toBeVisible();
  if (zoom !== 1)
    await page.evaluate((z) => document.documentElement.style.setProperty('zoom', String(z)), zoom);
}

/** Ganz im Bild und nicht unter dem Verlauf über „Übernehmen“. */
async function frei(page: Page, text: string) {
  const r = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('p, span')].find(
      (e) => e.textContent?.trim() === text,
    )!;
    const a = el.getBoundingClientRect();
    const cta = document.querySelector('.cta')!.getBoundingClientRect();
    const z = parseFloat(document.documentElement.style.zoom || '1');
    // Mit „zoom“ liefert Chromium die Maße schon vergrößert, WebKit nicht; der Vergleich mit der Leiste gilt beide Male.
    return { unten: a.bottom, oben: a.top, cta: cta.top - 14 * z, hoehe: innerHeight };
  }, text);
  expect(r.oben, text).toBeGreaterThanOrEqual(0);
  expect(r.unten, text).toBeLessThanOrEqual(r.cta);
}

for (const ansicht of ANSICHTEN) {
  test(`K4 Name ${ansicht.id}: Vorschlag passt in 40 Zeichen, „Übernehmen“ danach frei, Satz unter dem Feld`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ansicht.breite, height: ansicht.hoehe });
    await page.goto('/');
    await page.locator('h1').first().waitFor();
    await hefteAnlegen(page, [HEFT]);
    await nameOeffnen(page, ansicht.zoom);

    // (1) Überall „Name“.
    await expect(
      page.getByText('Der Name steht in der Übersicht ganz oben, die Adresse darunter im Heft.'),
    ).toBeVisible();
    await expect(page.getByText(/Merkmal/)).toHaveCount(0);
    await expect(page.getByText(/Name der Wohnung/)).toHaveCount(0);

    // (3) Ohne Haushalt „du“ (E369); der Satz steht unter dem Feld und hängt mit dem Zähler am Feld.
    const feld = page.getByRole('textbox', { name: 'Name' });
    await expect(feld).toHaveValue('');
    const satz = page.getByText('Bis du einen Namen einträgst, steht die Straße oben.');
    await expect(satz).toBeVisible();
    await expect(page.getByText(/kein Merkmal/)).toHaveCount(0);
    expect((await satz.boundingBox())!.y).toBeGreaterThan((await feld.boundingBox())!.y);
    await expect(feld).toHaveAccessibleDescription(
      '0 von 40 Bis du einen Namen einträgst, steht die Straße oben.',
    );

    // (2) Gezeigt wird genau, was eingesetzt wird; danach ist „Übernehmen“ frei.
    await expect(page.locator('.vorschlag span')).toHaveText(VORSCHLAG);
    await page.getByRole('button', { name: 'Einsetzen' }).click();
    await expect(feld).toHaveValue(VORSCHLAG);
    await expect(page.getByText(`${VORSCHLAG.length} von 40`)).toBeVisible();
    await expect(page.getByText('Etwas kürzer')).toHaveCount(0);
    await frei(page, `${VORSCHLAG.length} von 40`);
    await frei(page, 'Bis du einen Namen einträgst, steht die Straße oben.');
    const knopf = page.getByRole('button', { name: 'Übernehmen' });
    await expect(knopf).not.toHaveAttribute('aria-disabled', 'true');

    // Gegenprobe: Der ganze Titel (53 Zeichen) sperrte „Übernehmen“, so wie DP82 es gemessen hat.
    await feld.fill(TITEL);
    await expect(page.getByText('53 von 40')).toBeVisible();
    await expect(knopf).toHaveAttribute('aria-disabled', 'true');

    await page.getByRole('button', { name: 'Einsetzen' }).click();
    await knopf.click();
    // Direkt geöffnet, darum geht es zurück zur Übersicht; dort heißt das Heft so.
    const zeile = page.getByRole('link', { name: new RegExp(`^${VORSCHLAG} `) });
    await expect(zeile).toBeVisible();
    await zeile.click();
    await expect(page.getByRole('heading', { level: 1, name: VORSCHLAG })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Name ändern' })).toBeVisible();
  });
}

test('K4 Name: du-Form, wenn nur eine Person einzieht', async ({ page }) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [HEFT]);
  await nameOeffnen(page, 1);
  await expect(
    page.getByText('Bis du einen Namen einträgst, steht die Straße oben.'),
  ).toBeVisible();
});

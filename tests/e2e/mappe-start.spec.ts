import { expect, test } from '@playwright/test';
import { erstePerson, personHinzufuegen } from './einrichtung';
import { ganzesBild } from './hefte-hilfen';

// B26 (E93): Reiter „Mappe“ ohne fertigen Haushalt. Leer eine ruhige Startseite, angefangen die wachsende
// Mappe. Prüffälle aus dem Bericht B26 und Nachricht 12y.

test('Erster Start über „Mappe“: Startseite, Hinweis für Vermieter ohne Scrollen, erst der Knopf legt an', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/wohnungen');
  await page.getByRole('link', { name: 'Mappe' }).click();
  await expect(page).toHaveURL(/mappe-start$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(
    page.getByText(
      'Alles, was ein Vermieter von euch verlangen darf, in einer Datei. Hefta baut sie aus eurem Haushalt und euren Unterlagen.',
    ),
  ).toBeVisible();
  // Knopf und Hinweis für Vermieter ohne Scrollen sichtbar (667 px hoch).
  await expect(page.getByRole('link', { name: 'Haushalt anlegen' })).toBeInViewport();
  await expect(page.getByText(/^Sie vermieten\? Öffnen Sie die Mappe auf/)).toBeInViewport();
  await expect(page.getByRole('link', { name: 'vermieter.hefta.de' })).toBeVisible();
  // Anleitung mit drei Schritten, die Sätze aus Planung 12y.
  await expect(page.getByRole('heading', { name: 'So entsteht eure Mappe' })).toBeVisible();
  await expect(page.locator('.anl li')).toHaveCount(3);
  await expect(
    page.getByText('Selbstauskunft ausfüllen, Nachweise dazulegen. Hefta sagt, was fehlt.'),
  ).toBeVisible();
  await expect(page.getByText('Als eine Datei, die ihr per Mail schickt.')).toBeVisible();
  // Ohne fertigen Haushalt „ihr“, nirgends „du“.
  await expect(page.locator('main')).not.toContainText(/\b(du|dein|deine|dir)\b/);
  await page.setViewportSize({ width: 390, height: 844 });
  await ganzesBild(page, 'mappe-leer.png');

  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hefta gibt es als App.' }),
  ).toBeVisible();
});

test('Abbruch nach der ersten Person: „Mappe“ zeigt den Stand mit Max; „Niemand weiter“ beendet', async ({
  page,
}) => {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  // Abbruch: zurück zu „Wohnungen“, dann der Reiter „Mappe“.
  await page.goto('/#/wohnungen');
  await page
    .getByRole('navigation', { name: 'Bereiche' })
    .getByRole('link', { name: 'Mappe' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Weiter mit dem Haushalt' }),
  ).toBeVisible();
  // Eine Person im Vertrag: „du“ (12y).
  await expect(page.getByText('Deine Mappe entsteht')).toBeVisible();
  await expect(
    page.getByText('Max ist schon drin. Noch ein kurzer Schritt, dann ist dein Haushalt fertig.'),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: '1 von 2 Schritten erledigt' })).toBeVisible();
  const deck = page.getByRole('img', { name: 'Vorschau des Deckblatts' });
  await expect(deck.locator('g.person')).toHaveCount(1);
  await expect(page.locator('.sk.jetzt')).toHaveCount(1);
  await expect(page.locator('.sk.jetzt')).toContainText('Wer zieht noch mit ein?');
  await expect(page.getByRole('link', { name: 'Weiter anlegen' })).toBeVisible();
  await ganzesBild(page, 'mappe-eins.png');

  await page.getByRole('button', { name: 'Niemand weiter' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Weiter mit dem Haushalt' }),
  ).toHaveCount(0);
  await expect(page.locator('section.aufgaben')).toBeVisible();
});

test('Abbruch mit Max und Lea: „ihr“, zwei Personen im Deckblatt, Lea erscheint einmal neu', async ({
  page,
}) => {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await page.goto('/#/');
  await expect(page.getByText('Max ist schon drin.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Person hinzufügen' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Wer zieht mit ein\?/);
  await page.getByLabel('Vorname').fill('Lea');
  await page.getByRole('radio', { name: 'Mitmieterin', exact: true }).click();
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wer gehört noch dazu?' }),
  ).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByText('Eure Mappe entsteht')).toBeVisible();
  await expect(
    page.getByText(
      'Max und Lea sind schon drin. Noch ein kurzer Schritt, dann ist euer Haushalt fertig.',
    ),
  ).toBeVisible();
  const deck = page.getByRole('img', { name: 'Vorschau des Deckblatts' });
  await expect(deck.locator('g.person')).toHaveCount(2);
  await expect(page.locator('.chip')).toHaveText(['MMax', 'LLea']);
  await expect(deck.locator('g.person.neu')).toHaveCount(1);
  await ganzesBild(page, 'mappe-zwei.png');
  // Beim nächsten Blick bewegt sich nichts mehr.
  await page.reload();
  await expect(deck.locator('g.person.neu')).toHaveCount(0);
});

test('„Von vorn beginnen“: erst nach dem Blatt, dann wieder leer', async ({ page }) => {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Von vorn beginnen' }).click();
  const blatt = page.getByRole('dialog', { name: 'Von vorn beginnen?' });
  await expect(blatt).toContainText('Die eingetragenen Personen werden entfernt.');
  await blatt.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Max ist schon drin.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Von vorn beginnen' }).click();
  await blatt.getByRole('button', { name: 'Von vorn beginnen' }).click();
  await expect(page).toHaveURL(/mappe-start$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  // Kein Haushalt mehr: „Wohnungen“ beginnt wieder mit „Wer zieht ein?“.
  await page.getByRole('link', { name: 'Wohnungen' }).click();
  await expect(page.getByRole('button', { name: /^Wer zieht ein\?/ })).toBeVisible();
});

test('„Bewegung reduzieren“: „Weiter anlegen“ führt ohne Bewegung in den Schritt', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Weiter anlegen' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wer gehört noch dazu?' }),
  ).toBeVisible();
  // Kein laufender Übergang am Deckblatt: Die Dauern der Tokens sind 0 ms.
  const laufend = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => (a.effect?.getComputedTiming().duration as number) > 200).length,
  );
  expect(laufend).toBe(0);
});

test('Fertig angelegt (über „Wohnungen“): „Mappe“ zeigt die Mappe, nicht die Startseite', async ({
  page,
}) => {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await personHinzufuegen(page, /Mitmieter hinzufügen/, {
    vorname: 'Lea',
    bezeichnung: 'Mitmieterin',
  });
  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  await page.goto('/#/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Weiter mit dem Haushalt' }),
  ).toHaveCount(0);
});

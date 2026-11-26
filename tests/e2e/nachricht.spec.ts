import { expect, test, type Page } from '@playwright/test';
import { HEUTE } from './szenarien';
import { szenarioLaden } from './szenario-laden';

// Feinschliff (design/mappe-feinschliff.md) und Nachricht ans Inserat (design/nachricht-ans-inserat.md).

// Mit den Dateien der Unterlagen (szenarioLaden): Ohne sie hielte das Blatt aus K5 die Mappe an (PC126, PC127).
async function laden(page: Page, szenario: string, pfad: string) {
  await page.clock.setFixedTime(HEUTE);
  await szenarioLaden(page, szenario, pfad);
}

test.describe('Feinschliff', () => {
  test('Stufen nach B12c: Nur das Übliche vorausgewählt, Alles, Eigene Auswahl als Zeile (E49)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe');
    await expect(page.getByRole('radio', { name: 'Nur das Übliche' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('radio')).toHaveText(['Nur das Übliche', 'Alles']);
    await expect(
      page.getByText(
        /Reicht für die meisten Bewerbungen. Nichts, was die Datenschutzkonferenz ausschließt/,
      ),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Alles' }).click();
    await expect(
      page.getByText(/^Alles, was (ihr gesammelt habt|du gesammelt hast)\.$/),
    ).toBeVisible();
    await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
    await expect(page.getByRole('button', { name: /^Eigene Auswahl, gewählt/ })).toBeVisible();
    for (const stufe of ['Nur das Übliche', 'Alles']) {
      await expect(page.getByRole('radio', { name: stufe })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    }
  });

  test('Deckblatt groß: Vorschau, Links, ganze Mappe (ME11)', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe');
    const knopf = page.getByRole('button', { name: 'Deckblatt groß ansehen' });
    await page
      .getByText(/^\d+ Seiten$/)
      .first()
      .waitFor({ timeout: 60_000 });
    await knopf.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deckblatt');
    await expect(page.getByRole('img', { name: /^Deckblatt der Mappe/ })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('button', { name: 'Wohnung ändern' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Satz ändern' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Aussehen' })).toBeVisible();
    await page.getByRole('button', { name: 'Ganze Mappe ansehen' }).click();
    // DP50 P2: die ganze Mappe im neuen Leser.
    await expect(page.getByRole('dialog', { name: /^Mappe/ })).toBeVisible();
  });

  test('Die Schrift gilt für den Haushalt und bleibt (AM5a)', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe/anpassen');
    // Erst tippen, wenn die Vorschau dasteht (CP48: sonst traf der Tipp unter Last daneben, wie in CP44).
    await expect(page.getByText('Vorschau wird erstellt …')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole('radio', { name: 'Archivo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: 'Source Serif' }).click();
    await page.getByRole('radio', { name: /^Schlicht/ }).click();
    await page.reload();
    await page.locator('main h1').first().waitFor();
    await expect(page.getByRole('radio', { name: 'Source Serif' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('PC30: „Kompakt“ und „Fläche“ gibt es in „Mappe anpassen“ nicht mehr', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe/anpassen');
    await expect(page.getByRole('radio', { name: 'Source Serif' })).toBeVisible();
    await expect(page.getByText(/Kompakt|Fläche hinter/)).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: /Fläche/ })).toHaveCount(0);
  });

  test('Die Frage nach der Zusage ist sichtbar, keine Pflicht, und die Antwort lässt sich entfernen', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
    const teil = page.getByRole('button', { name: /^Fragen aus dem Musterbogen/ });
    await teil.click();
    await expect(page.getByRole('heading', { name: 'Nach der Zusage' })).toBeVisible();
    await expect(page.getByText(/^Die Antwort steht ab jetzt in der Mappe/)).toBeVisible();
    await page.getByRole('button', { name: 'Antworten entfernen' }).click();
    // PC65: keine Anweisung mehr, sondern was gilt, und die Wahl.
    await expect(
      page.getByText(/^Danach darf ein Vermieter erst kurz vor dem Vertrag fragen\. Freiwillig/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Antworten entfernen' })).toBeHidden();
  });

  test('Zum Übertragen: alle Angaben einzeln, ohne Aufforderung (A6)', async ({ page }) => {
    await laden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
    await page.getByRole('link', { name: 'Zum Übertragen' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zum Übertragen');
    await expect(page.getByRole('button', { name: 'Name kopieren' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alles kopieren' })).toBeVisible();
    await expect(page.getByText(/halten die Datenschutzbehörden für unzulässig/)).toBeVisible();
    await expect(page.locator('main')).not.toContainText('musst');
  });
});

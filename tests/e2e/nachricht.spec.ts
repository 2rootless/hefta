import { expect, test, type Page } from '@playwright/test';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Feinschliff (design/mappe-feinschliff.md) und Nachricht ans Inserat (design/nachricht-ans-inserat.md).

async function laden(page: Page, szenario: string, pfad: string) {
  await page.clock.setFixedTime(HEUTE);
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(
    async ({ daten }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(SZENARIEN.find((s) => s.id === szenario)!) },
  );
  await page.goto('about:blank');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').first().waitFor();
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
      page.getByText(/Reicht für die meisten Bewerbungen. Alles darin ist erlaubt/),
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
    await expect(page.getByRole('dialog', { name: /^Seite 1 von \d+$/ })).toBeVisible();
  });

  test('Schrift und Kompakt gelten für den Haushalt und bleiben (AM5a, AM5b)', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe/anpassen');
    await expect(page.getByRole('radio', { name: 'Archivo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: 'Source Serif' }).click();
    await page.getByRole('switch', { name: 'Kompakt: auf einer Seite' }).click();
    await page.getByRole('radio', { name: /^Schlicht/ }).click();
    await page.reload();
    await page.locator('main h1').first().waitFor();
    await expect(page.getByRole('radio', { name: 'Source Serif' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('switch', { name: 'Kompakt: auf einer Seite' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('Die Fläche hinter „Wer einzieht“ ist für sich wählbar und bleibt beim Wechsel der Art (AM5c)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/anpassen');
    const gruppe = page.getByRole('radiogroup', { name: 'Fläche hinter „Wer einzieht“' });
    await expect(gruppe.getByRole('radio')).toHaveText([
      'Personenfarbe',
      'Akzentfarbe',
      'Hellgrau',
      'Keine',
    ]);
    await expect(gruppe.getByRole('radio', { name: 'Personenfarbe' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await gruppe.getByRole('radio', { name: 'Keine' }).click();
    await page.getByRole('radio', { name: /^Schlicht/ }).click();
    await page.reload();
    await page.locator('main h1').first().waitFor();
    await expect(gruppe.getByRole('radio', { name: 'Keine' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('Ohne eigene Wahl folgt die Fläche der Art (AM5c)', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe/anpassen');
    const gruppe = page.getByRole('radiogroup', { name: 'Fläche hinter „Wer einzieht“' });
    await page.getByRole('radio', { name: /^Schlicht/ }).click();
    await expect(gruppe.getByRole('radio', { name: 'Hellgrau' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: /^Eine Farbe/ }).click();
    await expect(gruppe.getByRole('radio', { name: 'Akzentfarbe' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('Die Frage nach der Zusage ist sichtbar, keine Pflicht, und die Antwort lässt sich entfernen', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
    const teil = page.getByRole('button', { name: /^Fragen, die Vermieter stellen dürfen/ });
    await teil.click();
    await expect(page.getByRole('heading', { name: 'Nach der Zusage' })).toBeVisible();
    await expect(page.getByText(/^Die Antwort steht ab jetzt in der Mappe/)).toBeVisible();
    await page.getByRole('button', { name: 'Antwort entfernen' }).click();
    await expect(page.getByText(/^Erst beantworten, wenn der Vermieter/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Antwort entfernen' })).toBeHidden();
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

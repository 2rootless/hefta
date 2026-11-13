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

const feld = (page: Page) => page.getByLabel('Text des Inserats, freiwillig');
const nachricht = (page: Page) => page.locator('.nachricht');

test.describe('Nachricht ans Inserat', () => {
  test('ist fertig, bevor man etwas tut: nur Name, Kontakt, Wohnung und Satz (PN1)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe');
    await page.evaluate(() => (location.hash = '#/mappe/nachricht'));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nachricht ans Inserat');
    await expect(nachricht(page)).toContainText('Guten Tag,');
    await expect(nachricht(page)).toContainText('Freundliche Grüße');
    await expect(nachricht(page)).toContainText('sobald Sie sie brauchen');
    await expect(nachricht(page)).not.toContainText('Einkommen:');
    await expect(page.locator('.warum p')).toHaveText(
      'Name und Telefon genügen für die erste Nachricht.',
    );
  });

  test('Verlangte Angaben kommen dazu, mit Grund und „Ändern“ (PN3, PN4, PN4b)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill(
      'Bitte nennen Sie uns Name, Telefonnummer und Angaben zum Einkommen sowie die Anzahl der Personen, die einziehen.',
    );
    await expect(nachricht(page)).toContainText('Wer einzieht:');
    await expect(nachricht(page)).toContainText('Einkommen:');
    await expect(page.locator('.warum')).toContainText('weil das Inserat danach fragt');
    await expect(page.locator('.warum')).toContainText('du gibst hier mehr als nötig');
    await page.getByRole('button', { name: 'Ändern' }).click();
    await page.getByRole('switch', { name: 'Einkommen' }).click();
    await expect(nachricht(page)).not.toContainText('Einkommen:');
    await expect(nachricht(page)).toContainText('Wer einzieht:');
  });

  test('Nie Unzulässiges, und die Katze bleibt ungesagt, wenn niemand fragt (PN2, PN8)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill(
      'Keine Haustiere. Bitte senden Sie uns eine Ausweiskopie, Ihren Familienstand und Ihre Staatsangehörigkeit.',
    );
    for (const wort of ['Haustiere:', 'Ausweis', 'Familienstand']) {
      await expect(nachricht(page)).not.toContainText(wort);
    }
    const warum = page.locator('.warum');
    await expect(warum).toContainText(
      'Nicht dabei: Ausweiskopie, Familienstand und Staatsangehörigkeit.',
    );
    await expect(warum).toContainText('halten die Datenschutzbehörden für unzulässig');
    await expect(page.getByText('Ein Hinweis, keine Rechtsberatung.')).toBeVisible();
  });

  test('Fragt das Inserat nach der Anschrift, lässt sie sich eintragen und bleibt (PN3)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill('Bitte geben Sie Ihre aktuelle Anschrift an.');
    await expect(page.locator('.warum')).toContainText('Nach Adresse fragt das Inserat auch');
    const anschrift = page.getByLabel('Deine Anschrift, freiwillig');
    await anschrift.fill('Alte Straße 7, 22765 Hamburg');
    await anschrift.blur();
    await expect(nachricht(page)).toContainText('Adresse: Alte Straße 7, 22765 Hamburg');
    await expect(page.locator('.warum')).toContainText(
      'Mit Adresse, weil das Inserat danach fragt.',
    );
  });

  test('Fragt das Inserat nach dem Einzug, gibt es das Feld, und der Termin bleibt an der Bewerbung', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    const einzug = page.getByLabel('Einzug ab, freiwillig');
    await expect(einzug).toBeHidden();
    await feld(page).fill('Bitte nennen Sie uns den gewünschten Einzugstermin.');
    await expect(page.locator('.warum')).toContainText('Nach Einzugstermin fragt das Inserat auch');
    await einzug.fill('ab 1. Januar 2027');
    await einzug.blur();
    await expect(nachricht(page)).toContainText('Einzug ab: 1. Januar 2027');
    await expect(nachricht(page)).not.toContainText('ab ab');
    await expect(page.locator('.warum')).toContainText('Mit Einzugstermin, weil');
    // Die Nachricht zeigt den Termin schon beim Tippen; erst neu laden, wenn er gespeichert ist.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((ok) => {
            const r = indexedDB.open('hefta');
            r.onsuccess = () => ok(r.result);
          });
          const alle = await new Promise<{ einzug?: string }[]>((ok) => {
            const r = db.transaction('bewerbungen').objectStore('bewerbungen').getAll();
            r.onsuccess = () => ok(r.result as { einzug?: string }[]);
          });
          db.close();
          return alle.map((b) => b.einzug);
        }),
      )
      .toContain('ab 1. Januar 2027');
    await page.reload();
    await page.locator('main h1').first().waitFor();
    await expect(nachricht(page)).not.toContainText('Einzug ab');
    await feld(page).fill('Ab wann möchten Sie einziehen?');
    await expect(nachricht(page)).toContainText('Einzug ab: 1. Januar 2027');
  });

  test('Eine Auskunft des Inserats löst nichts aus, und in „Was mitgeht“ steht kein Raucher (PN4b, PN10)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill(
      'Haustiere nach Absprache. Einzug ab sofort möglich. Rauchen in der Wohnung nicht gestattet. Zur Besichtigung bitte den Personalausweis mitbringen.',
    );
    await expect(page.locator('.warum')).toContainText('Mehr verlangt das Inserat nicht.');
    await expect(page.getByLabel('Einzug ab, freiwillig')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Ändern' })).toBeHidden();
    await feld(page).fill('Bitte nennen Sie uns Ihren Beruf und Ihr Einkommen.');
    await page.getByRole('button', { name: 'Ändern' }).click();
    await expect(page.locator('.liste')).not.toContainText('Raucher');
  });

  test('„Ändern“ steht unter dem Satz, ohne Loch im Satz', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill('Bitte geben Sie Ihre aktuelle Anschrift an.');
    const satz = page.locator('.warum p');
    const knopf = page.getByRole('button', { name: 'Ändern' });
    await expect(satz.locator('button')).toHaveCount(0);
    const a = (await satz.boundingBox())!;
    const b = (await knopf.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 0.5);
    expect(b.y).toBeLessThan(a.y + a.height + 4);
    expect(b.height).toBeGreaterThanOrEqual(44);
  });

  test('Eigenes Formular und offene Besichtigung: Weg statt Nachricht, trotzdem erreichbar (PN5, PN7)', async ({
    page,
  }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill(
      'Bewerben Sie sich bitte über unser Bewerbungsformular auf unserer Webseite.',
    );
    await expect(page.getByText('Dieser Vermieter will ein eigenes Formular.')).toBeVisible();
    await expect(nachricht(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Zum Übertragen' })).toBeVisible();
    await page.getByRole('button', { name: 'Nachricht trotzdem zeigen' }).click();
    await expect(nachricht(page)).toBeVisible();
    await feld(page).fill('Offene Besichtigung am Samstag, einfach vorbeikommen.');
    await expect(nachricht(page)).toBeVisible();
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill('Offene Besichtigung am Samstag, einfach vorbeikommen.');
    await expect(page.getByText('Offene Besichtigung, keine Anfrage nötig.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Selbstauskunft als PDF' })).toBeVisible();
  });

  test('Mappe anhängen: Der Text sagt es, die Größe steht da (PN6)', async ({ page }) => {
    await laden(page, '04-fertig', '/mappe/nachricht');
    await feld(page).fill('Senden Sie Ihre Bewerbungsunterlagen bitte an vermietung@example.com.');
    await expect(page.locator('.warum')).toContainText('Das Inserat nennt eine Mailadresse');
    await page.getByRole('switch', { name: 'Mappe anhängen' }).click();
    await expect(nachricht(page)).toContainText('hängt an.');
    await expect(page.locator('.anhang')).toContainText(/\d+\s*Seiten? · /, { timeout: 60_000 });
  });

  test('Kopieren legt genau die Nachricht in die Zwischenablage', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Zwischenablage nur in Chromium im Test lesbar');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await laden(page, '04-fertig', '/mappe/nachricht');
    await page.getByRole('button', { name: 'Nachricht kopieren' }).click();
    await expect(page.locator('.meldung')).toHaveText('Nachricht kopiert.');
    // Windows liest Zeilenenden als CRLF zurück.
    const inhalt = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      '\r\n',
      '\n',
    );
    expect(inhalt).toBe(await nachricht(page).evaluate((e) => e.textContent));
    expect(inhalt).toContain('Guten Tag,\n\nich interessiere mich');
  });
});

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

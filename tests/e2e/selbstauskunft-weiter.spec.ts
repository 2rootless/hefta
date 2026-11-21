import { expect, test } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { cspMelden } from './hilfen';

// Selbstauskunft im Rutsch (design/selbstauskunft-person-serie.md, Abschnitt 1): Weiter geht es ohne
// extra Knopf, und der gedämpfte Hauptknopf führt zum ersten fehlenden Teil.

test('Akkordeon: Taste Weiter, letzte Antwort und gedämpfter Knopf führen zum nächsten Teil', async ({
  page,
}) => {
  await cspMelden(page);
  await haushaltMitMax(page);
  await page.getByRole('link', { name: /^Unterlagen hinzufügen/ }).click();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  // DP39, 4: Die Teile stehen zuerst als Liste; „Ausfüllen“ öffnet den ersten offenen.
  await page.getByRole('button', { name: 'Ausfüllen' }).click();

  // Kontakt: Enter führt von Feld zu Feld, im letzten Feld zum nächsten offenen Teil.
  await page.getByRole('textbox', { name: /^Telefon/ }).fill('0171 3920001');
  await page.getByRole('textbox', { name: /^Telefon/ }).press('Enter');
  await expect(page.getByRole('textbox', { name: /^E-Mail/ })).toBeFocused();
  await page.getByRole('textbox', { name: /^E-Mail/ }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Netto im Monat' })).toBeFocused();
  await expect(page.getByRole('button', { name: /^Kontakt .*Ändern/ })).toBeVisible();

  // Einkommen offen lassen und zu den Fragen: Der gedämpfte Knopf führt zurück zum ersten fehlenden Teil.
  await page.getByRole('button', { name: /^Drei Fragen aus dem Musterbogen/ }).click();
  await expect(page.getByRole('textbox', { name: 'Netto im Monat' })).toHaveCount(0);
  const weiter = page.getByRole('button', { name: 'Speichern und weiter' });
  await expect(weiter).toHaveAttribute('aria-disabled', 'true');
  await weiter.click({ force: true });
  await expect(page.getByRole('textbox', { name: 'Netto im Monat' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Netto im Monat' }).fill('2800');
  await page.getByRole('radio', { name: 'Mindestens' }).click();

  // Ein Ja als letzte Antwort lässt den Teil offen, die Erklärung darunter ist freiwillig (A3).
  const fragen = page.getByRole('button', { name: /^Drei Fragen aus dem Musterbogen/ });
  await fragen.click();
  const antwort = (frage: string, wert: string) =>
    page
      .getByRole('radiogroup', { name: new RegExp(frage) })
      .getByRole('radio', { name: wert })
      .click();
  await antwort('Insolvenzverfahren', 'Nein');
  await antwort('Räumungstitel', 'Ja');
  const erklaerung = page.getByLabel(/^Kurz erklären\?/);
  await expect(erklaerung).toHaveCount(1);
  await erklaerung.fill('Zwei Monate 2023, längst beglichen.');

  // Wer eine Antwort nur ändert, bleibt im Teil; jedes Ja hat seine eigene Erklärung.
  await antwort('Insolvenzverfahren', 'Ja');
  await expect(erklaerung).toHaveCount(2);
  await antwort('Insolvenzverfahren', 'Nein');
  await expect(erklaerung).toHaveCount(1);
  await expect(erklaerung).toHaveValue('Zwei Monate 2023, längst beglichen.');

  // Bleibt der Teil nur wegen der Erklärung offen, führt ein Textlink weiter (A6).
  await page.getByRole('button', { name: /^Weiter: / }).click();
  await expect(page.getByRole('radiogroup', { name: /Haustiere/ })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: /Mietrückstände/ })).toHaveCount(0);

  // Alle drei Fragen beantwortet: Erst dann geht der nächste Teil von selbst auf.
  await page.getByRole('button', { name: /^Drei Fragen aus dem Musterbogen/ }).click();
  await antwort('Räumungstitel', 'Nein');
  await expect(page.getByRole('radiogroup', { name: /Mietrückstände/ })).toBeVisible();
  await antwort('Mietrückstände', 'Nein');
  await expect(page.getByRole('radiogroup', { name: /Haustiere/ })).toBeVisible();

  // „Weiter: Einkommen“ mit dem Fokus noch im Feld: ein Tipp genügt, der Fokus steht danach in
  // „Netto im Monat“ (auf dem iPhone ging sonst erst die Tastatur zu und der Tipp verloren).
  await page.getByRole('button', { name: /^Einkommen .*Ändern/ }).click();
  await page.getByRole('textbox', { name: 'Netto im Monat' }).fill('');
  await page.getByRole('button', { name: /^Kontakt .*Ändern/ }).click();
  await page.getByRole('textbox', { name: /^E-Mail/ }).fill('max@example.org');
  await page.getByRole('textbox', { name: /^E-Mail/ }).focus();
  await page.getByRole('button', { name: 'Weiter: Einkommen' }).click();
  await expect(page.getByRole('textbox', { name: 'Netto im Monat' })).toBeFocused();

  // Angaben eines Teils löschen, nach einer Rückfrage; der Teil ist danach wieder offen.
  await page.getByRole('button', { name: /^Kontakt .*Ändern/ }).click();
  await page.getByRole('button', { name: 'Angaben löschen' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('textbox', { name: /^Telefon/ })).toHaveValue('0171 3920001');
  await page.getByRole('button', { name: 'Angaben löschen' }).click();
  await expect(page.getByText(/^Angaben in diesem Teil löschen\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Telefon/ })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Angaben löschen' })).toHaveCount(0);
  // PC130 K7 und DP50: Offen steht der Satz einmal, oben im Teil; „Eine Angabe genügt“ steht nur zugeklappt.
  await expect(page.locator('section.offen')).toContainText(
    'Eine Angabe reicht, Telefon oder E-Mail',
  );
  await expect(page.locator('section.offen')).not.toContainText('Eine Angabe genügt');
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

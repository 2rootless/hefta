import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { szenarioLaden } from './szenario-laden';

// K9 (DP96, Abschnitt 3, Weg B; PC159): Auf der Seite der Selbstauskunft heißt der Hauptknopf „Weiter“ mit dem nächsten
// offenen Teil, bis alles ausgefüllt ist. Er steht ohne Scrollen da. Ist nur noch der geöffnete Teil offen, steht ein
// blasses „Fertig“, darüber der Satz, was fehlt; antippen führt ins Feld. Der Knopf „Weiter: …“ im Teil entfällt.

const knopf = (page: Page) => page.locator('.leiste button.haupt');

/** Regel aus PC159: Fehlt das Netto, muss „Weiter“ sichtbar sein; ein dunkles „Fertig“ ist der Fehler aus K9. */
async function pruefe(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fehler: string[] = [];
    const k = document.querySelector<HTMLElement>('.leiste button.haupt');
    if (!k) return ['kein Hauptknopf'];
    const r = k.getBoundingClientRect();
    if (r.bottom > innerHeight + 1 || r.top < 0)
      fehler.push('Hauptknopf nicht ohne Scrollen sichtbar');
    // Das Feld „Netto im Monat“, gefunden über seine Beschriftung.
    const netto = [...document.querySelectorAll<HTMLInputElement>('section.teil.offen input')].find(
      (e) => /^Netto/.test(e.labels?.[0]?.textContent?.trim() ?? ''),
    );
    const nettoLeer = !!netto && !netto.value.trim();
    const sichtbar = (k.querySelector('.beschriftung')?.textContent ?? '').trim();
    if (nettoLeer && sichtbar === 'Fertig' && k.getAttribute('aria-disabled') !== 'true')
      fehler.push('dunkles „Fertig“, obwohl das Netto fehlt');
    return fehler;
  });
}

for (const breite of [390, 320])
  test(`K9 Fall 1 und 2 bei ${breite} px: „Weiter“ mit dem nächsten Teil, ohne Scrollen; „Weiter“ öffnet ihn`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: 700 });
    await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
    // Fall 1: neu, Teil 1 offen
    await page
      .getByRole('button', { name: /^1\s*Kontakt|^Kontakt/ })
      .first()
      .click();
    await expect(knopf(page)).toHaveAccessibleName('Weiter zu Einkommen');
    await expect(knopf(page).locator('small.unter')).toHaveText('Einkommen');
    // Fall 2: Einkommen offen, Netto leer (der Fall aus K9)
    await page
      .getByRole('button', { name: /Einkommen/ })
      .first()
      .click();
    await expect(knopf(page)).toHaveAccessibleName('Weiter zu Fragen aus dem Musterbogen');
    expect(await pruefe(page)).toEqual([]);
    // Es gibt keinen Knopf „Weiter: …“ mehr im Teil.
    await expect(page.locator('section.teil.offen .teil-weiter')).toHaveCount(0);
    // „Weiter“ öffnet den nächsten offenen Teil.
    await knopf(page).click();
    await expect(
      page.locator('section.teil.offen h3').filter({ hasText: 'Fragen aus dem Musterbogen' }),
    ).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('section.teil.offen')))
      .toBe(true);
  });

test('K9 Fall 5 und 6: nur noch Einkommen offen → blasses „Fertig“, Satz darüber, Tipp ins Feld; alles da → „Fertig“', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  // Fall 6
  await expect(knopf(page)).toHaveText('Fertig');
  await expect(knopf(page)).not.toHaveAttribute('aria-disabled', 'true');
  // Fall 5
  await page
    .getByRole('button', { name: /Einkommen/ })
    .first()
    .click();
  const netto = page.getByRole('textbox', { name: /^Netto/ }).first();
  await netto.fill('');
  await netto.evaluate((e) => e.blur());
  await expect(knopf(page)).toHaveAttribute('aria-disabled', 'true');
  const satz = page.locator('.leiste p.oben');
  await expect(satz).toHaveText('Es fehlt noch: Netto im Monat.');
  const s = (await satz.boundingBox())!;
  const k = (await knopf(page).boundingBox())!;
  expect(s.y + s.height, 'Satz über dem Knopf').toBeLessThanOrEqual(k.y + 1);
  expect(await pruefe(page)).toEqual([]);
  // Der blasse Knopf ist nicht gesperrt (DP96): Antippen führt ins Feld. Playwright hält aria-disabled für gesperrt.
  await knopf(page).click({ force: true });
  await expect(netto).toBeFocused();
});

test('K9 Gegenprobe: der Stand von 2.0 (dunkles „Fertig“ bei leerem Netto) wird rot', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  await page
    .getByRole('button', { name: /Einkommen/ })
    .first()
    .click();
  expect(await pruefe(page)).toEqual([]);
  // So stand es in 2.0: unten immer „Fertig“, voll dunkel.
  await page.evaluate(() => {
    const k = document.querySelector<HTMLElement>('.leiste button.haupt')!;
    k.querySelector('.beschriftung')!.textContent = 'Fertig';
    k.querySelector('small.unter')?.remove();
    k.removeAttribute('aria-disabled');
  });
  expect(await pruefe(page)).toEqual(['dunkles „Fertig“, obwohl das Netto fehlt']);
});

// DP116 (PC185): Der Satz über dem blassen Knopf nennt das Feld; reicht eine von zwei Angaben, steht „oder“; Feldnamen
// brechen nie um, auch nicht am Bindestrich. Ist ein Feld ausgefüllt, aber falsch, steht kein „fehlt“, sondern der
// Satz des Teils. Dieselbe Quelle (grundFuer) gilt im Rutsch.
const BINDESTRICH = String.fromCharCode(0x2011);

/** Regel aus DP116: Bei einem ausgefüllten, aber falschen Feld darf über dem Knopf kein „fehlt“ stehen. */
const satzPasst = (satz: string, feldFalsch: boolean) => !(feldFalsch && /fehlt/.test(satz));

test('DP116: „Es fehlt noch: Netto im Monat.“ und „Telefon oder E-Mail“ ohne Trennung', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  await page
    .getByRole('button', { name: /Einkommen/ })
    .first()
    .click();
  const netto = page.getByRole('textbox', { name: /^Netto/ }).first();
  await netto.fill('');
  await netto.evaluate((e) => e.blur());
  const satz = page.locator('.leiste p.oben');
  await expect(satz).toHaveText('Es fehlt noch: Netto im Monat.');
  // Kontakt leer: beide Angaben weg. Das Netto kommt zurück, damit nur noch der Kontakt offen ist.
  await netto.fill('2850');
  await page
    .getByRole('button', { name: /Kontakt/ })
    .first()
    .click();
  await page.getByRole('textbox', { name: /^Telefon/ }).fill('');
  await page.getByLabel('E-Mail').fill('');
  await page.getByLabel('E-Mail').evaluate((e) => e.blur());
  const text = (await satz.textContent()) ?? '';
  expect(text).toContain('Telefon oder E');
  expect(text).toContain(`E${BINDESTRICH}Mail`);
  expect(text).not.toContain('E-Mail');
});

test('DP116: Telefon „0171 39A“: über dem Knopf „Telefonnummer bitte prüfen.“, kein „fehlt“; Gegenprobe „Es fehlt noch: Kontakt.“', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/selbstauskunft/p-04-fertig-0');
  await page
    .getByRole('button', { name: /Kontakt/ })
    .first()
    .click();
  await page.getByLabel('E-Mail').fill('');
  await page.getByRole('textbox', { name: /^Telefon/ }).fill('0171 39A');
  await page.getByLabel('E-Mail').focus();
  const satz = page.locator('.leiste p.oben');
  await expect(satz).toHaveText('Telefonnummer bitte prüfen.');
  expect(satzPasst((await satz.textContent()) ?? '', true)).toBe(true);
  // Gegenprobe: so stand es vor DP116
  expect(satzPasst('Es fehlt noch: Kontakt.', true)).toBe(false);
});

test('DP116: Kurzform in der zweiten Zeile, höchstens 12 Zeichen; vorgelesen wird der lange Name', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
  await page
    .getByRole('button', { name: /Einkommen/ })
    .first()
    .click();
  await expect(knopf(page).locator('small.unter')).toHaveText('Fragen');
  await expect(knopf(page)).toHaveAccessibleName('Weiter zu Fragen aus dem Musterbogen');
  const kurz = JSON.parse(readFileSync('src/i18n/de.json', 'utf8')).selbstauskunft
    .teilKurz as Record<string, string>;
  expect(Object.keys(kurz).sort()).toEqual(['einkommen', 'fragen', 'haushalt', 'kontakt']);
  for (const k of Object.values(kurz)) expect(k.length, k).toBeLessThanOrEqual(12);
});

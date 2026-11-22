import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { cspMelden } from './hilfen';
import { szenarioLaden } from './szenario-laden';
import { SZENARIEN } from './szenarien';

// wunsch-W42 (Wunschliste Fassung 43; DP93 Variante A, DP94 Fall 7): Eine Person aus dem Mietvertrag lässt sich direkt
// herausnehmen oder in eine andere Rolle setzen, auch die hauptmietende, ohne Umweg über „zuerst Bürgschaft wählen“.
// Hefta zeigt vorher, was sich ändert, und im Mietvertrag bleibt immer mindestens eine Person.
// Ersetzt den Test zu N4 d aus 2.0.1 (der Satz über den Umweg).

const WEGE = ['Im Mietvertrag', 'Zieht nur mit ein', 'Bürgt', 'Nicht mehr dabei'];

/** Regel: Auf der Personenseite stehen alle vier Wege zur Wahl, auch für die hauptmietende Person. */
async function fehlendeWege(page: Page): Promise<string[]> {
  const da = await page.getByRole('radiogroup').first().getByRole('radio').allInnerTexts();
  return WEGE.filter((w) => !da.map((x) => x.trim()).includes(w));
}

/** Wer im Haushalt wo steht, wie die Seite „Haushalt“ es zeigt. */
async function haushalt(page: Page) {
  await page.goto('/#/haushalt');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  return page.evaluate(() => {
    const gruppe = (i: number) =>
      [...document.querySelectorAll('.hh-gruppe')[i]!.querySelectorAll('li.zeile:has(a.aendern) b')]
        .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((x) => !/hinzufügen$/.test(x));
    const zahl = [...document.querySelectorAll('.zaehler b')].map((b) => Number(b.textContent));
    return { vertrag: gruppe(0), weitere: zahl[1], buergen: gruppe(2) };
  });
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
});

test('wunsch-W42 Fall 3: der Hauptmieter ist mit einem Schritt „nicht mehr dabei“; Lea rückt nach, und es steht vorher da', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-0');
  expect(await fehlendeWege(page)).toEqual([]);
  await page.getByRole('radio', { name: 'Nicht mehr dabei' }).click();
  await expect(page.getByText('Wenn ihr speichert')).toBeVisible();
  await expect(
    page.getByText('Lea steht dann vorn im Mietvertrag und wird Hauptmieterin.'),
  ).toBeVisible();
  await expect(page.getByText('Geschickte Mappen bleiben, wie sie sind.')).toBeVisible();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page).not.toHaveURL(/person-aendern/);
  const h = await haushalt(page);
  expect(h.vertrag).toEqual(['Lea Hauptmieterin']);
  expect(h.buergen).toEqual(['Petra Bürgin']);
});

test('wunsch-W42 Fall 7: Lea zieht nur mit ein: nicht mehr im Vertrag, zählt unter „Ziehen mit ein“; zurückgeholt wieder im Vertrag', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-1');
  await page.getByRole('radio', { name: 'Zieht nur mit ein' }).click();
  await expect(
    page.getByText('Lea zählt dann unter „Ziehen mit ein“. Ihr Name steht nicht in der Mappe.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page).not.toHaveURL(/person-aendern/);
  const vorher = await haushalt(page);
  expect(vorher.vertrag).toEqual(['Max Hauptmieter']);
  expect(vorher.weitere).toBe(1);
  await expect(page.getByText('Zieht nur mit ein').first()).toBeVisible();
  await page.getByRole('button', { name: 'Zurückholen Lea' }).click();
  await expect(page.getByRole('link', { name: 'Rolle von Lea ändern' })).toBeVisible();
  const nachher = await haushalt(page);
  expect(nachher.vertrag).toEqual(['Max Hauptmieter', 'Lea Mitmieterin']);
  expect(nachher.weitere).toBe(0);
});

test('wunsch-W42 Fall 2: bleiben zwei im Vertrag, fragt Hefta, wer vorn steht; „Speichern“ erst nach der Wahl', async ({
  page,
}) => {
  // Max, Lea und Aylin im Vertrag (Szenario mit drei Erwachsenen), Max bürgt künftig.
  const s = SZENARIEN.find((x) => x.id === '03-mehrere-offen')!;
  const drei = {
    ...s,
    id: 'w42-drei',
    personen: [...s.personen, { ...s.personen[1]!, vorname: 'Aylin' }],
  };
  await szenarioLaden(page, drei, '/person-aendern/p-w42-drei-0');
  await page.getByRole('radio', { name: 'Bürgt' }).click();
  await expect(page.getByText('Wer steht dann vorn im Mietvertrag?')).toBeVisible();
  const speichern = page.getByRole('button', { name: 'Speichern', exact: true });
  await expect(speichern).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('radio', { name: /^Aylin/ }).check();
  await expect(speichern).not.toHaveAttribute('aria-disabled', 'true');
  await speichern.click();
  await expect(page).not.toHaveURL(/person-aendern/);
  const h = await haushalt(page);
  expect(h.vertrag[0]).toMatch(/^Aylin Hauptmieter/);
  expect(h.buergen).toEqual([expect.stringMatching(/^Max /)]);
});

test('wunsch-W42 Fall 4: allein im Vertrag, die Bürgin kommt an seine Stelle; der Vertrag ist nie leer', async ({
  page,
}) => {
  const s = SZENARIEN.find((x) => x.id === '04-fertig')!;
  const zwei = { ...s, id: 'w42-zwei', personen: [s.personen[0]!, s.personen[2]!] };
  await szenarioLaden(page, zwei, '/person-aendern/p-w42-zwei-0');
  await page.getByRole('radio', { name: 'Bürgt' }).click();
  await expect(page.getByText(/^Wer kommt an (seine|ihre|die) Stelle\?/)).toBeVisible();
  await page.getByRole('radio', { name: /^Petra/ }).check();
  await expect(
    page.getByText(/^Petra wird Hauptmieterin\. Ihre Bürgschafts.?erklärung bleibt gespeichert/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page).not.toHaveURL(/person-aendern/);
  const h = await haushalt(page);
  expect(h.vertrag).toEqual(['Petra Hauptmieterin']);
  expect(h.buergen).toEqual([expect.stringMatching(/^Max /)]);
});

test('wunsch-W42 Fall 5: niemand sonst im Haushalt: eine neue Person mit Vornamen kommt in den Vertrag', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.goto('/#/haushalt');
  await page.getByRole('link', { name: 'Rolle von Max ändern' }).click();
  await page.getByRole('radio', { name: 'Nicht mehr dabei' }).click();
  const speichern = page.getByRole('button', { name: 'Speichern', exact: true });
  await expect(speichern).toHaveAttribute('aria-disabled', 'true');
  // DP117: ohne Vorname „Die neue Person …“; ab dem ersten Buchstaben der Name. Gegenprobe: kein leerer Name
  // („ steht dann vorn …“) und kein Satz mit dem Namen, bevor er dasteht.
  const ohneName = page.getByText('Die neue Person steht dann vorn im Mietvertrag.');
  await expect(ohneName).toBeVisible();
  await expect(page.getByText(/^ steht dann vorn im Mietvertrag\.$/)).toHaveCount(0);
  const feld = page.locator('fieldset.nachfolge').getByLabel('Vorname');
  await feld.fill('S');
  await expect(page.getByText('S steht dann vorn im Mietvertrag.')).toBeVisible();
  await expect(ohneName).toHaveCount(0);
  // Das Feld der Nachfolge, nicht der eigene Vorname im Abschnitt „Über Max“.
  await feld.fill('Selin');
  await expect(page.getByText('Selin steht dann vorn im Mietvertrag.')).toBeVisible();
  await expect(speichern).not.toHaveAttribute('aria-disabled', 'true');
  await speichern.click();
  await expect(page).not.toHaveURL(/person-aendern/);
  const h = await haushalt(page);
  expect(h.vertrag).toHaveLength(1);
  expect(h.vertrag[0]).toMatch(/^Selin Hauptmiet/);
});

test('wunsch-W42 Gegenprobe: der Weg nur über „Bürgschaft“ (2.0) wird rot', async ({ page }) => {
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-0');
  expect(await fehlendeWege(page)).toEqual([]);
  // So stand es in 2.0.1: nur „Im Mietvertrag“ und „Bürgschaft“; herausnehmen erst nach dem Umweg.
  await page.evaluate(() => {
    const gruppe = document.querySelector('[role="radiogroup"]')!;
    for (const r of [...gruppe.querySelectorAll('[role="radio"]')]) {
      const text = r.textContent?.trim();
      if (text === 'Zieht nur mit ein' || text === 'Nicht mehr dabei') r.remove();
      if (text === 'Bürgt') r.textContent = 'Bürgschaft';
    }
  });
  expect(await fehlendeWege(page)).toEqual(['Zieht nur mit ein', 'Bürgt', 'Nicht mehr dabei']);
});

// PC190 (DP118, WR1 und W33): Bei 320 px mit 130 % ist die Seite mit dem Feld „Vorname“ der neuen Person nicht
// breiter als der Bildschirm, in Fall 4 mit neuer Person und in Fall 5. Das Feld ist beige gefüllt wie die
// anderen Felder der Seite, ohne Rand. Gegenprobe ist der Stand vor PC190.
for (const fall of ['Fall 4 mit neuer Person', 'Fall 5'] as const)
  test(`wunsch-W42 WR1: ${fall} bei 320 px mit 130 % ohne waagrechten Überlauf; Feld wie die anderen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    if (fall === 'Fall 5') {
      await haushaltMitMax(page);
      await page.goto('/#/haushalt');
      await page.getByRole('link', { name: 'Rolle von Max ändern' }).click();
      await page.getByRole('radio', { name: 'Nicht mehr dabei' }).click();
    } else {
      const s = SZENARIEN.find((x) => x.id === '04-fertig')!;
      const zwei = { ...s, id: 'w42-zwei', personen: [s.personen[0]!, s.personen[2]!] };
      await szenarioLaden(page, zwei, '/person-aendern/p-w42-zwei-0');
      await page.getByRole('radio', { name: 'Bürgt' }).click();
      await page.getByRole('radio', { name: /^Eine neue Person/ }).check();
    }
    await page.evaluate(() => document.documentElement.style.setProperty('zoom', '1.3'));
    const feld = page.locator('fieldset.nachfolge').getByLabel('Vorname', { exact: true });
    await feld.fill('Konstantin');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const [fuellung, rand, andere] = await feld.evaluate((e) => {
      const s = getComputedStyle(e);
      const vergleich = document.querySelector('label.eingabe input:not(fieldset input)');
      return [
        s.backgroundColor,
        s.borderTopWidth,
        vergleich ? getComputedStyle(vergleich).backgroundColor : '',
      ];
    });
    expect(fuellung).toBe(andere);
    expect(rand).toBe('0px');
  });

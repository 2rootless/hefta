import { expect, test, type Page } from '@playwright/test';
import { cspMelden } from './hilfen';
import { szenarioLaden } from './szenario-laden';
import type { Szenario } from './szenarien';

// wunsch-W42 (Wunschliste Fassung 43; DP93, DP94 Fall 7), mit W57/W54 neu gebaut (PC199, DP128): Jede Person im
// Mietvertrag, auch die Ansprechperson, kommt mit einem Schritt in jedes andere Fach, ohne Umweg über „Bürgt“. Das
// Ziel wirkt sofort, die Zeile danach sagt die Folgen, „Rückgängig“ holt den Stand davor. Im Mietvertrag bleibt immer
// mindestens eine Person: Sonst fragt Hefta, wer hineinkommt. Die Frage „Wer steht vorn?“ (Fall 2) gibt es nicht mehr;
// geht die Ansprechperson, wird es die Nächste im Vertrag (E366).

const FAECHER = ['Im Mietvertrag', 'Zieht mit ein', 'Bürgt', 'Nicht mehr dabei'];

/** Regel: Auf der Personenseite stehen alle vier Fächer zur Wahl (das eigene als Stand, die anderen als Ziele). */
async function fehlendeWege(page: Page): Promise<string[]> {
  const z = page.locator('.person-ziele');
  const da = [
    (await z.locator('.platz b').textContent())?.trim() ?? '',
    ...(await z.locator('.ziele button').allInnerTexts()).map((x) => x.trim()),
  ];
  return FAECHER.filter((w) => !da.includes(w));
}

/** Wer im Haushalt wo steht, wie die Seite „Haushalt“ es zeigt. */
async function haushalt(page: Page) {
  // Erst wenn die Zeile danach steht, ist gespeichert; dann im selben Dokument zum Haushalt.
  if (await page.locator('.person-ziele').count())
    await expect(page.locator('.person-ziele .folge')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/haushalt'));
  await page.locator('.faecher').waitFor();
  return page.evaluate(() => {
    const namen = (fach: string) =>
      [...document.querySelectorAll(`.faecher [data-gruppe="${fach}"] a.text b`)].map(
        (b) => b.textContent?.trim() ?? '',
      );
    return {
      vertrag: namen('vertrag'),
      nurmit: namen('nurmit'),
      buerge: namen('buerge'),
      weg: namen('weg'),
      ansprech:
        document
          .querySelector('.faecher .ap[aria-checked="true"]')
          ?.closest('[data-id]')
          ?.querySelector('a.text b')
          ?.textContent?.trim() ?? null,
    };
  });
}

const folge = (page: Page) =>
  page
    .locator('.person-ziele .folge p')
    .evaluate((e) => (e.textContent ?? '').split(String.fromCharCode(0xad)).join(''));

const ALLEIN_MIT_BUERGIN: Szenario = {
  id: 'w42-vier',
  personen: [
    {
      vorname: 'Max',
      bezeichnung: 'neutral',
      rolle: 'vertrag',
      lage: 'angestellt',
      unterlagen: {},
    },
    { vorname: 'Petra', bezeichnung: 'weiblich', rolle: 'buerge', lage: 'rente', unterlagen: {} },
  ],
};

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
});

test('wunsch-W42 Fall 3: die Ansprechperson ist mit einem Schritt „nicht mehr dabei“; Lea wird Ansprechperson', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-0');
  expect(await fehlendeWege(page)).toEqual([]);
  await page.locator('.person-ziele [data-z="weg"]').click();
  expect(await folge(page)).toBe(
    'Max ist nicht mehr dabei. Die Unterlagen bleiben gespeichert. Lea ist jetzt Ansprechperson.',
  );
  await expect(page.locator('.person-ziele .rueck')).toBeFocused();
  const h = await haushalt(page);
  expect(h).toEqual({
    vertrag: ['Lea'],
    nurmit: [],
    buerge: ['Petra'],
    weg: ['Max'],
    ansprech: 'Lea',
  });
});

test('wunsch-W42 Fall 7: Lea zieht nur mit ein: nicht mehr im Vertrag, steht unter „Zieht mit ein“; zurück wieder im Vertrag', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-1');
  await page.locator('.person-ziele [data-z="nurmit"]').click();
  expect(await folge(page)).toBe('Lea zieht jetzt nur mit ein.');
  expect((await haushalt(page)).nurmit).toEqual(['Lea']);
  await page.evaluate(() => (location.hash = '#/person-aendern/p-04-fertig-1/person'));
  await expect(page.locator('.person-ziele .platz b')).toHaveText('Zieht mit ein');
  await page.locator('.person-ziele [data-z="vertrag"]').click();
  expect(await folge(page)).toBe('Lea steht jetzt im Mietvertrag.');
  const h = await haushalt(page);
  expect(h.vertrag).toEqual(['Max', 'Lea']);
  expect(h.nurmit).toEqual([]);
});

test('wunsch-W42 Fall 4: allein im Vertrag soll Max bürgen; Petra kommt aus „Bürgt“ an seine Stelle', async ({
  page,
}) => {
  await szenarioLaden(page, ALLEIN_MIT_BUERGIN, '/person-aendern/p-w42-vier-0');
  const z = page.locator('.person-ziele');
  await z.locator('[data-z="buerge"]').click();
  await expect(z.getByText('Wer kommt in den Mietvertrag?')).toBeVisible();
  // Bis zur Antwort bleibt alles, wie es ist.
  await expect(z.locator('.platz b')).toHaveText('Im Mietvertrag');
  await z.locator('.frage .wahl button', { hasText: 'Petra' }).click();
  await expect(z.locator('.platz b')).toHaveText('Bürgt');
  const h = await haushalt(page);
  expect(h.vertrag).toEqual(['Petra']);
  expect(h.buerge).toEqual(['Max']);
  expect(h.ansprech).toBe('Petra');
});

test('wunsch-W42 Fall 5: niemand sonst im Haushalt: eine neue Person mit Vornamen kommt in den Vertrag', async ({
  page,
}) => {
  await szenarioLaden(page, '23-ohne-datum', '/person-aendern/p-23-ohne-datum-0');
  const z = page.locator('.person-ziele');
  await z.locator('[data-z="weg"]').click();
  await expect(z.getByText('Wer kommt in den Mietvertrag?')).toBeVisible();
  // Ohne Vornamen geht es nicht weiter.
  await z.getByRole('button', { name: 'Dazu' }).click();
  await expect(z.getByRole('textbox', { name: 'Vorname einer neuen Person' })).toBeFocused();
  await expect(z.locator('.platz b')).toHaveText('Im Mietvertrag');
  await z.getByRole('textbox', { name: 'Vorname einer neuen Person' }).fill('Jonas');
  await z.getByRole('button', { name: 'Dazu' }).click();
  await expect(z.locator('.platz b')).toHaveText('Nicht mehr dabei');
  const h = await haushalt(page);
  expect(h.vertrag).toEqual(['Jonas']);
  expect(h.weg).toEqual(['Max']);
});

test('wunsch-W42 Gegenprobe: fehlt ein Fach auf der Personenseite, wird die Prüfung rot', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', '/person-aendern/p-04-fertig-0');
  await page.evaluate(() => document.querySelector('.person-ziele [data-z="buerge"]')!.remove());
  expect(await fehlendeWege(page)).toEqual(['Bürgt']);
});

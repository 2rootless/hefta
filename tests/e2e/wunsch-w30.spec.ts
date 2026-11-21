import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';
import { LAGEN_JS, lageFehler, type W30Lage } from './w30-lage';

// W30-Regel (drei Arten, PC167): Jeder kurze Satz liegt nach seiner Art an der Stelle aus der Tabelle.
// Gegenprobe: Ein Satz zu einem einzelnen Feld, der oben steht, wird rot.

async function lagen(page: Page): Promise<W30Lage[]> {
  return (await page.evaluate(LAGEN_JS)) as W30Lage[];
}

async function teilOeffnen(page: Page, name: RegExp) {
  const k = page.getByRole('button', { name }).first();
  if ((await k.getAttribute('aria-expanded')) !== 'true') await k.click();
  await expect(page.locator('section.teil.offen')).toHaveCount(1);
}

for (const [breite, text] of [
  [390, 1],
  [320, 1.3],
] as const)
  test(`W30: Sätze der Selbstauskunft und der Person nach ihrer Art, ${breite} px, Text ${text * 100} %`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: 900 });
    await szenarioLaden(page, '02-neustart', '/selbstauskunft/p-02-neustart-0');
    const zoomen = async () => {
      if (text !== 1)
        await page.evaluate(
          (z) => document.documentElement.style.setProperty('zoom', String(z)),
          text,
        );
    };
    await zoomen();
    const gesehen: W30Lage[] = [];
    for (const name of [/Einkommen/, /Drei Fragen/, /Haushalt/]) {
      await teilOeffnen(page, name);
      gesehen.push(...(await lagen(page)));
    }
    await szenarioLaden(page, '01-standard', '/person-aendern/p-01-standard-2');
    await expect(page.locator('[data-w30="gruppe"]')).toBeVisible();
    await zoomen();
    gesehen.push(...(await lagen(page)));
    const arten = new Set(gesehen.map((l) => l.art));
    // Alle drei Arten kommen vor, sonst prüft der Test nichts.
    expect([...arten].sort()).toEqual(['feld', 'frage', 'gruppe']);
    expect(gesehen.flatMap(lageFehler)).toEqual([]);
  });

test('W30 Gegenprobe: ein Satz zu einem einzelnen Feld oben wird rot; eine Frage mit 22 px auch', () => {
  const feldOben: W30Lage = {
    art: 'feld',
    text: 'Viele Vermieter fragen danach.',
    satz: { top: 100, bottom: 117 },
    vorher: { top: 125, bottom: 170 },
    nachher: null,
  };
  expect(lageFehler(feldOben)).toEqual([
    'feld „Viele Vermieter fragen danach.“: steht nicht unter dem Feld',
  ]);
  const gut: W30Lage = {
    ...feldOben,
    satz: { top: 178, bottom: 195 },
    vorher: { top: 125, bottom: 170 },
  };
  expect(lageFehler(gut)).toEqual([]);
  const frageWeit: W30Lage = {
    art: 'frage',
    text: 'Haustiere',
    vorher: { top: 0, bottom: 20 },
    satz: { top: 42, bottom: 60 },
    nachher: { top: 72, bottom: 116 },
  };
  expect(lageFehler(frageWeit)).toEqual(['frage „Haustiere“: unter der Frage 22 statt 4 px']);
});

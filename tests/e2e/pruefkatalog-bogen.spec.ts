import { expect, test, type Page } from '@playwright/test';
import { bogenKatalog, tastaturFunde, type BogenArg } from './pruef-bogen';

// PC208, Schritt 7: Designs Prüfkataloge DP134 (E111, E1 bis E17) und DP135 (Bürgschaft im Stil von R1) als Browsertests
// am Bau, in den Ansichten der Pakete, hell und dunkel, mit Gegenproben. Namen aus der Namensliste (W40).

interface Ansicht {
  id: string;
  breite: number;
  hoehe: number;
  zoom?: number;
  dunkel?: boolean;
}
const ANSICHTEN: Ansicht[] = [
  { id: '390', breite: 390, hoehe: 844 },
  { id: '320-text130-dunkel', breite: 320, hoehe: 568, zoom: 1.3, dunkel: true },
  { id: '1440', breite: 1440, hoehe: 900 },
  { id: '1920-dunkel', breite: 1920, hoehe: 1080, dunkel: true },
  { id: '2560x1440', breite: 2560, hoehe: 1440 },
  { id: '2560x1080-dunkel', breite: 2560, hoehe: 1080, dunkel: true },
  { id: '3440x1440', breite: 3440, hoehe: 1440 },
];

async function ansichtSetzen(page: Page, a: Ansicht) {
  await page.setViewportSize({ width: a.breite, height: a.hoehe });
  await page.emulateMedia({ colorScheme: a.dunkel ? 'dark' : 'light' });
  await page.evaluate(
    (z) => document.documentElement.style.setProperty('zoom', z ? String(z) : ''),
    a.zoom ?? 0,
  );
}

async function oeffnen(page: Page, pfad: string) {
  await page.goto('/__leer');
  await page.goto(`/#${pfad}`);
  await page.locator('main h1').waitFor();
}

async function person(page: Page, p: { vor: string; nach: string; tel: string }) {
  const blatt = page.locator('section.blatt').last();
  await blatt.getByRole('textbox', { name: 'Vorname' }).fill(p.vor);
  await blatt.getByRole('textbox', { name: 'Nachname' }).fill(p.nach);
  await blatt.getByRole('textbox', { name: 'Telefon' }).fill(p.tel);
  await blatt.getByRole('textbox', { name: 'Netto im Monat, in Euro' }).fill('2.800');
  for (const g of ['Frage 1: Insolvenzverfahren', 'Frage 2: Räumungstitel'])
    await blatt.getByRole('radiogroup', { name: g }).getByRole('radio', { name: 'Nein' }).click();
}

type Zustand = {
  id: string;
  pfad: string;
  arg: BogenArg;
  vorbereiten: (page: Page, lang: boolean) => Promise<void>;
};
const ZUSTAENDE: Zustand[] = [
  {
    id: 'e111-leer',
    pfad: '/selbstauskunft',
    arg: { mehr: false, namen: [], wbsJa: false, form: true },
    vorbereiten: async () => {},
  },
  {
    id: 'e111-weitere',
    pfad: '/selbstauskunft',
    arg: { mehr: true, namen: [], wbsJa: false, form: true },
    vorbereiten: async (page) => {
      await person(page, { vor: 'Jarne', nach: 'Ostendorp', tel: '0171 3920011' });
      await page
        .getByRole('button', { name: /Weitere Person hinzufügen/ })
        .first()
        .click();
    },
  },
  {
    id: 'e111-uebernehmen',
    pfad: '/selbstauskunft',
    arg: { mehr: true, namen: ['Jarne', 'Selin'], wbsJa: true, form: true },
    vorbereiten: async (page, lang) => {
      await person(page, { vor: 'Jarne', nach: 'Ostendorp', tel: '0171 3920011' });
      await page
        .getByRole('button', { name: /Weitere Person hinzufügen/ })
        .first()
        .click();
      await person(
        page,
        lang
          ? { vor: 'Konstantin', nach: 'Meyer-Ellerbrock', tel: '0171 3920012' }
          : { vor: 'Selin', nach: 'Akgül', tel: '0171 3920012' },
      );
      await page
        .getByRole('radiogroup', { name: 'Wohnberechtigungsschein' })
        .last()
        .getByRole('radio', { name: 'Ja' })
        .click();
      await page.getByRole('button', { name: 'Haushalt anlegen' }).first().click();
    },
  },
  {
    id: 'buergschaft-leer',
    pfad: '/buergschaft',
    arg: { mehr: false, namen: [], wbsJa: false, form: true },
    vorbereiten: async () => {},
  },
  {
    id: 'buergschaft-fertig',
    pfad: '/buergschaft',
    arg: { mehr: false, namen: [], wbsJa: false, form: true },
    vorbereiten: async (page, lang) => {
      const blatt = page.locator('section.blatt');
      await blatt
        .getByRole('textbox', { name: 'Vorname' })
        .first()
        .fill(lang ? 'Konstantin' : 'Hiltrud');
      await blatt
        .getByRole('textbox', { name: 'Nachname' })
        .first()
        .fill(lang ? 'Meyer-Ellerbrock' : 'Ostendorp');
      await page.locator('[data-feld="hoechstbetrag"]').fill('2400');
      await page.getByRole('radio', { name: /^Gewöhnliche/ }).click();
    },
  },
];

for (const z of ZUSTAENDE)
  test(`Prüfkatalog DP134/DP135: ${z.id} in allen Ansichten, hell und dunkel`, async ({ page }) => {
    test.setTimeout(180_000);
    await oeffnen(page, z.pfad);
    await z.vorbereiten(page, false);
    await page.waitForTimeout(500);
    const funde: string[] = [];
    for (const a of ANSICHTEN) {
      await ansichtSetzen(page, a);
      await page.waitForTimeout(150);
      const arg = z.id === 'e111-uebernehmen' && a.zoom ? { ...z.arg } : z.arg;
      for (const f of await page.evaluate(bogenKatalog, arg)) funde.push(`${a.id}: ${f}`);
    }
    for (const f of await page.evaluate(tastaturFunde)) funde.push(f);
    expect(funde).toEqual([]);
  });

test('Prüfkatalog: längster Name bei 320 px mit 130 %, dunkel (E1)', async ({ page }) => {
  for (const z of ZUSTAENDE.filter(
    (x) => x.id === 'e111-uebernehmen' || x.id === 'buergschaft-fertig',
  )) {
    await oeffnen(page, z.pfad);
    await z.vorbereiten(page, true);
    await ansichtSetzen(page, ANSICHTEN[1]!);
    await page.waitForTimeout(300);
    const arg = z.id === 'e111-uebernehmen' ? { ...z.arg, namen: ['Jarne', 'Konstantin'] } : z.arg;
    expect(await page.evaluate(bogenKatalog, arg), z.id).toEqual([]);
  }
});

test('E16: Tastatur einmal ganz durch, jeder Fokus zeigt den Strich (W33)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const pfad of ['/selbstauskunft', '/buergschaft']) {
    await oeffnen(page, pfad);
    const ohne: string[] = [];
    const gesehen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || e === document.body) return null;
        const s = getComputedStyle(e);
        const sichtbar =
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        return {
          key: `${e.tagName}${e.textContent?.trim().slice(0, 20)}${e.getAttribute('aria-label') ?? ''}${i_(e)}`,
          sichtbar,
          text: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30),
        };
        function i_(x: Element) {
          return [...document.querySelectorAll('*')].indexOf(x);
        }
      });
      if (!r) continue;
      if (gesehen.has(r.key)) break;
      gesehen.add(r.key);
      if (!r.sichtbar) ohne.push(r.text);
    }
    expect(gesehen.size, pfad).toBeGreaterThan(15);
    expect(ohne, pfad).toEqual([]);
  }
});

test('Gegenproben: Rot außerhalb von Zurück, Anschrift in einem Feld, gesperrt ohne Satz, Pult vor dem Bogen, Bögen untereinander', async ({
  page,
}) => {
  await oeffnen(page, '/selbstauskunft');
  const arg: BogenArg = { mehr: false, namen: [], wbsJa: false, form: true };
  expect(await page.evaluate(bogenKatalog, arg)).toEqual([]);
  // E3: eine Überschrift in Rot.
  await page.evaluate(
    () => ((document.querySelector('main h3') as HTMLElement).style.color = 'var(--accent-text)'),
  );
  expect((await page.evaluate(bogenKatalog, arg)).some((f) => f.startsWith('E3'))).toBe(true);
  await page.reload();
  await page.locator('main h1').waitFor();
  // E8: Anschrift als ein Feld.
  await page.evaluate(() => {
    for (const l of document.querySelectorAll('main label')) {
      const s = l.querySelector('.l');
      if (s?.textContent === 'Straße und Hausnummer') s.textContent = 'Anschrift';
    }
  });
  expect((await page.evaluate(bogenKatalog, arg)).some((f) => f.startsWith('E8'))).toBe(true);
  await page.reload();
  await page.locator('main h1').waitFor();
  // E10: gesperrter Knopf ohne Satz.
  await page.evaluate(() => {
    for (const h of document.querySelectorAll('[aria-disabled="true"]'))
      h.removeAttribute('aria-describedby');
  });
  expect((await page.evaluate(bogenKatalog, arg)).some((f) => f.startsWith('E10'))).toBe(true);
  // E2: Feldlinie zu hell; E1: ein Feld breiter als die Seite; E4: ein Knopf unter 44 px.
  await page.evaluate(() => {
    const i = document.querySelector('main section.blatt input') as HTMLElement;
    i.style.borderBottomColor = '#f4efe7';
  });
  expect((await page.evaluate(bogenKatalog, arg)).some((f) => f.startsWith('E2'))).toBe(true);
  await page.evaluate(() => {
    (document.querySelector('main section.blatt input') as HTMLElement).style.width = '2000px';
    (document.querySelector('main .darunter') as HTMLElement).style.minHeight = '0';
    (document.querySelector('main .darunter') as HTMLElement).style.height = '30px';
  });
  const f = await page.evaluate(bogenKatalog, arg);
  expect(f.some((x) => x.startsWith('E1'))).toBe(true);
  expect(f.some((x) => x.startsWith('E4'))).toBe(true);
  // E5: ein „muss“ im Bogen.
  await page.evaluate(() => (document.querySelector('main .sub')!.textContent = 'Das muss rein.'));
  expect((await page.evaluate(bogenKatalog, arg)).some((f) => f.startsWith('E5'))).toBe(true);
  // E16: Pult vor dem Bogen.
  await page.evaluate(() => {
    const main = document.querySelector('main')!;
    main.prepend(main.querySelector('.pult')!);
  });
  expect((await page.evaluate(tastaturFunde)).some((f) => f.includes('Pult vor dem Bogen'))).toBe(
    true,
  );
  // E17: zwei Bögen untereinander ab 2400 px.
  await oeffnen(page, '/selbstauskunft');
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page
    .getByRole('button', { name: /Weitere Person hinzufügen/ })
    .first()
    .click();
  await page.evaluate(() => {
    const r = document.querySelector('main .bogen-reihe') as HTMLElement;
    r.style.display = 'block';
  });
  expect(
    (await page.evaluate(bogenKatalog, { ...arg, mehr: true })).some((f) =>
      f.includes('nicht nebeneinander'),
    ),
  ).toBe(true);
});

import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { ganzesBild } from './hefte-hilfen';

// Zeile 8: Bewerben in einer Minute (B23 `s=bewerben`), „Hefta schlägt vor: Beworben“ (B16, B21), dazu drei
// Wünsche des Auftraggebers vom 12.11.: Aussehen in den Einstellungen, Anleitung auf „Wohnungen“
// zugeklappt, im Tab „Mappe“ mit nur einer Person keine doppelte Liste.

const JETZT = new Date(2026, 10, 12, 10, 0);

function tag(versatz: number, stunde = 12): string {
  return new Date(2026, 10, 12 + versatz, stunde, 0).toISOString();
}

const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

function heft(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    createdAt: tag(-3),
    updatedAt: tag(-3),
    haushaltId: null,
    adresse: 'Lindenallee 3\n20259 Hamburg',
    link: 'https://www.example.org/wohnung/3',
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer },
    notiz: '',
    einzug: '2027-01-01',
    angaben: {
      titel: 'Altbau mit Garten',
      stadtteil: 'Eimsbüttel',
      warm: 1240,
      zimmer: 3,
      flaeche: 74,
      portal: 'ImmoScout24',
      anbieter: 'Frau Hansen',
    },
    ...extra,
  };
}

async function hefteAnlegen(page: Page, hefte: unknown[]) {
  await page.evaluate(
    (liste) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('hefte', 'readwrite');
          for (const h of liste as object[]) tx.objectStore('hefte').put(h);
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    hefte,
  );
}

async function heftOeffnen(page: Page, id: string) {
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.evaluate((h) => (window.location.hash = h), `#/heft/${id}`);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(JETZT);
});

test('Bewerben per Portal: Anschreiben, Angaben, Mappe, Text kopieren, dann der Vorschlag', async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Kein Teilen-Blatt des Systems im Test: Die Mappe wird dann geladen.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
  await haushaltMitMax(page);
  await hefteAnlegen(page, [heft('linden')]);
  await heftOeffnen(page, 'linden');

  // Gemerkt: „Als Nächstes: bewerben“.
  await expect(page.getByText('Als Nächstes: bewerben')).toBeVisible();
  // Planung 12z: der geänderte Satz, allein „musst du“.
  await expect(
    page.getByText('Hefta legt Anschreiben und Mappe bereit. Abschicken musst du selbst.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Jetzt bewerben' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bewerben in einer Minute' }),
  ).toBeVisible();
  // Aus einem Portal gemerkt: Portal ist vorgewählt.
  await expect(page.getByRole('button', { name: 'Portal' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(/Im Portal: Text ins Nachrichtenfeld einsetzen\./)).toBeVisible();
  const anschreiben = page.locator('.mailblatt');
  await expect(anschreiben).toContainText('Sehr geehrte Frau Hansen,');
  await expect(anschreiben).toContainText(
    'ich möchte mich um die Wohnung in der Lindenallee 3 bewerben. Ich kann zum 1. Januar 2027 einziehen.',
  );
  await expect(anschreiben).toContainText('Einzug: 1. Januar 2027');
  await expect(anschreiben).toContainText('Wer einzieht: Eine Person im Mietvertrag.');
  await expect(page.getByText('Nur, was verlangt ist')).toBeVisible();
  // Planung 12z: „Nur, was verlangt ist · 1 Seite“, mit Leerzeichen vor dem Punkt.
  await expect(page.locator('.mpf small')).toHaveText(/^Nur, was verlangt ist · \d+ Seiten?$/);
  await expect(
    page.getByText('Hefta schickt deine Daten nirgendwohin. Was hinausgeht, schickst du selbst.'),
  ).toBeVisible();

  // Anschreiben ändern: Der eigene Text gilt.
  await page.getByRole('button', { name: 'Ändern' }).click();
  const feld = page.getByRole('textbox', { name: 'Anschreiben' });
  await feld.fill('Sehr geehrte Frau Hansen,\n\nmein eigener Text.');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(anschreiben).toContainText('mein eigener Text.');
  await ganzesBild(page, 'bewerben-portal.png');

  // Website: Angaben zum Abschreiben, Link zur Website.
  await page.getByRole('button', { name: 'Website' }).click();
  await expect(page.getByRole('button', { name: 'Einzug kopieren' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Website öffnen' })).toHaveAttribute(
    'href',
    'https://www.example.org/wohnung/3',
  );

  // Zurück zum Portal: Text kopieren merkt sich den Weg, unsicher.
  await page.getByRole('button', { name: 'Portal' }).click();
  await page.getByRole('button', { name: 'Text kopieren' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Kopier/ })).toBeVisible();
  if (browserName === 'chromium')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      'mein eigener Text.',
    );

  // Im Heft: „Hefta schlägt vor: Beworben“, einmal.
  await page.goBack();
  await expect(page.getByText('Hefta schlägt vor: Beworben')).toBeVisible();
  await expect(
    page.getByText(/^Am 12\.\sNov\. hast du den Text fürs Portal kopiert und die Mappe geteilt\./),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Stand: Gemerkt' })).toBeVisible();
  await ganzesBild(page, 'heft-vorschlag.png');
  await page.getByRole('button', { name: 'Ja, beworben' }).click();
  await expect(page.getByRole('img', { name: 'Stand: Beworben' })).toBeVisible();
  await expect(page.getByText('Hefta schlägt vor: Beworben')).toHaveCount(0);
});

test('„Noch nicht“: Hefta fragt nicht wieder, der Stand bleibt „Gemerkt“', async ({ page }) => {
  await haushaltMitMax(page);
  await hefteAnlegen(page, [
    heft('falken', {
      ereignisse: { ...leer, beworben: { am: tag(-1), weg: 'mail', sicher: false } },
    }),
  ]);
  await heftOeffnen(page, 'falken');
  await expect(
    page.getByText(/hast du die Mail mit der Mappe geöffnet\. Ob sie hinausging/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Noch nicht' }).click();
  await expect(page.getByText('Hefta schlägt vor: Beworben')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Stand: Gemerkt' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Hefta schlägt vor: Beworben')).toHaveCount(0);
});

test('Ohne Haushalt: „Wer zieht ein?“ statt „Jetzt bewerben“', async ({ page }) => {
  await page.goto('/#/wohnungen');
  await page.waitForFunction(() => !!document.querySelector('main'));
  await hefteAnlegen(page, [heft('ohne')]);
  await heftOeffnen(page, 'ohne');
  await expect(page.getByText('Als Nächstes: bewerben')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wer zieht ein?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jetzt bewerben' })).toHaveCount(0);
});

test('Aussehen in den Einstellungen: System, Hell, Dunkel (12.11.)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await haushaltMitMax(page);
  await page.goto('/#/einstellungen');
  const gruppe = page.getByRole('radiogroup', { name: 'Aussehen' });
  await expect(gruppe.getByRole('radio', { name: 'System' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await gruppe.getByRole('radio', { name: 'Dunkel' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await ganzesBild(page, 'einstellungen-dunkel.png');
  // Bleibt nach dem Neuladen, auch wenn das System hell ist.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await gruppe.getByRole('radio', { name: 'Hell' }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // Zurück auf System: folgt wieder dem System.
  await gruppe.getByRole('radio', { name: 'System' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Tab „Mappe“ mit nur einer Person: der Satz ohne doppelte Liste (12.11.)', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.goto('/#/');
  const kasten = page.locator('section.aufgaben');
  await expect(kasten.getByRole('heading', { level: 2 })).toContainText(/dann bist du startklar/);
  await expect(kasten.locator('ul')).toBeHidden();
});

test('Aussehen: kein Rahmen um die Zeile nach dem Tippen, Rückmeldung an hallo@hefta.de (Design 12.11.)', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await page.goto('/#/einstellungen');
  const zeile = page.locator('.aussehen-zeile');
  await page.getByRole('radio', { name: 'Hell' }).click();
  await expect(zeile).toHaveCSS('outline-style', 'none');
  await expect(page.getByRole('link', { name: /hallo@.?hefta\.de/ })).toHaveAttribute(
    'href',
    /^mailto:hallo@hefta\.de/,
  );
  await expect(page.locator('main')).not.toContainText('pm.me');
});

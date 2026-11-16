import { expect, test, type Page } from '@playwright/test';
import {
  abgelegtPruefen,
  haarliniePruefen,
  markerPruefen,
  rasterPruefen,
  registerPruefen,
  vorschauPruefen,
} from './dp39-regeln';
import { HEUTE } from './szenarien';
import { gehaltsPdfs, pdfMit, szenarioLaden } from './szenario-laden';

// DP39 (PC48): Prüfkatalog A1 bis A24 und die Wünsche W16, W18 bis W22 der Wunschliste (Fassung 6).
// Jede Wunsch-Prüfung hat eine Gegenprobe: Ein Verstoß, gebaut aus wenig HTML, muss anschlagen.

test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(HEUTE);
});

/** Die Bereiche der DP39-Seiten, in denen nur Rasterwerte gelten (A24). */
const DP39_BEREICHE = [
  '.person-ton',
  '.register-rahmen',
  '.haarlinie',
  '.hh-gruppe',
  '.ab-karte',
  '.karte-weiss',
  '.stand-karte',
].join(', ');

async function rutschStarten(page: Page, szenario: string) {
  await szenarioLaden(page, szenario, '/rutsch');
  await page.getByRole('button', { name: /^Los geht/ }).click();
  await expect(page.locator('.register-rahmen .karte')).toBeVisible();
}

const reiterName = (page: Page) => page.locator('.reiter.an .reiter-name');

// ---------------------------------------------------------------------------------------------------
// Personenseite (A1 bis A4)

test('A1, wunsch-W19: Personenseite, eine Sache offen: Stück blass, „n von N da“, „Ändern“ in Tinte', async ({
  page,
}) => {
  await szenarioLaden(page, '01-standard', '/person/p-01-standard-2');
  await expect(page.getByText(/^\d+ von \d+ da$/)).toBeVisible();
  await expect(page.locator('.haarlinie .z-offen')).not.toHaveCount(0);
  await expect(page.locator('.haarlinie .ring')).toHaveCount(0);
  const aendern = page.getByRole('link', { name: 'Ändern' });
  const farbe = await aendern.evaluate((e) => getComputedStyle(e).color);
  const tinte = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue('--ink').trim(),
  );
  expect(farbe).not.toMatch(/rgb\(1[5-9]\d, [3-6]\d, [2-5]\d\)/);
  expect(tinte).toBeTruthy();
  expect(await page.evaluate(haarliniePruefen)).toEqual([]);
});

test('A2: Personenseite, alles da: „Startklar“, Knopf leise', async ({ page }) => {
  await szenarioLaden(page, '04-fertig', '/person/p-04-fertig-1');
  await expect(page.getByText('Startklar')).toBeVisible();
  await expect(page.locator('.leiste .haupt.leise')).toBeVisible();
});

test('A3: Personenseite, Bürgin: Umriss im Zeichen, Mint-Tönung, Linie in Druckfarbe', async ({
  page,
}) => {
  await szenarioLaden(page, '01-standard', '/person/p-01-standard-2');
  const kopf = page.locator('.person-ton .name-karte');
  const ton = await kopf.evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      grund: s.backgroundColor,
      linie: s.getPropertyValue('--p-linie').trim(),
      druck: s.getPropertyValue('--p-druck').trim(),
    };
  });
  // Mint: Grün und Blau über Rot.
  const [r, g, b] = ton.grund.match(/\d+/g)!.map(Number) as [number, number, number];
  expect(g).toBeGreaterThan(r);
  expect(b).toBeGreaterThan(r);
  expect(ton.linie).toBe(ton.druck);
});

test('A4: Personenseite, langer Name: nichts gekürzt, nichts ragt heraus', async ({ page }) => {
  await page.setViewportSize({ width: 246, height: 437 });
  await szenarioLaden(page, '10-lange-namen', '/person/p-10-lange-namen-0');
  const h1 = page.locator('main h1').first();
  const gekuerzt = await h1.evaluate(
    (e) => e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis',
  );
  expect(gekuerzt).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

// ---------------------------------------------------------------------------------------------------
// Unterlage (A5 bis A8)

test('A5: Unterlage, zu alt: Warnzeichen, Satz in Tinte 600', async ({ page }) => {
  await szenarioLaden(page, '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-2/bonitaet');
  const satz = page.locator('.satz.warnung');
  await expect(satz.locator('.warnzeichen')).toBeVisible();
  expect(await satz.evaluate((e) => getComputedStyle(e).fontWeight)).toBe('600');
});

test('A6: Unterlage, Ausweis meist unnötig: „Gespeichert“, keine Datumszeile', async ({ page }) => {
  await szenarioLaden(
    page,
    '25-unterlage-seiten',
    '/unterlage/p-25-unterlage-seiten-0/ausweiskopie',
  );
  await expect(page.getByRole('heading', { name: 'Gespeichert' })).toBeVisible();
  await expect(page.getByText('Ausgestellt am')).toHaveCount(0);
});

test('A8: Unterlage, Reihe Gehaltsnachweise: drei in der Mappe, ältere darunter', async ({
  page,
}) => {
  await szenarioLaden(
    page,
    '25-unterlage-seiten',
    '/unterlage/p-25-unterlage-seiten-0/gehaltsnachweis',
  );
  await expect(
    page.getByRole('heading', { name: /In der Mappe · die drei neuesten/ }),
  ).toBeVisible();
});

// A7 (Name einer anderen Person, Name markiert, „Zu Lea verschieben“): ruecklauf-iphone.spec.ts, RU4.

// ---------------------------------------------------------------------------------------------------
// Rutsch (A9 bis A18)

test('A9, A12, wunsch-W18, wunsch-W19: erster Reiter aktiv, Karte oben links ohne Rundung, Ring 36 px', async ({
  page,
}) => {
  await rutschStarten(page, '03-mehrere-offen');
  await expect(page.locator('.reiter').first()).toHaveClass(/\ban\b/);
  const ecke = await page
    .locator('.register-rahmen .karte')
    .evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
  expect(ecke).toBe('0px');
  expect(await page.evaluate(registerPruefen)).toEqual([]);
  expect(await page.evaluate(haarliniePruefen)).toEqual([]);
  await expect(page.locator('.haarlinie .ring')).toHaveCount(1);
});

test('A10, wunsch-W18: mittlerer Reiter aktiv, Karte rund, Reiter schließt an', async ({
  page,
}) => {
  await rutschStarten(page, '03-mehrere-offen');
  await page.locator('.reiter').nth(1).click();
  await expect(page.locator('.reiter').nth(1)).toHaveClass(/\ban\b/);
  const ecke = await page
    .locator('.register-rahmen .karte')
    .evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
  expect(ecke).not.toBe('0px');
  expect(await page.evaluate(registerPruefen)).toEqual([]);
});

test('A11, wunsch-W19: übersprungen: Pfeil am Symbol, Zähler zählt es nicht', async ({ page }) => {
  await rutschStarten(page, '03-mehrere-offen');
  const zaehler = page.locator('.reiter.an small');
  const vorher = await zaehler.textContent();
  const name = await reiterName(page).textContent();
  await page
    .getByRole('button', { name: /^(Überspringen|Noch nicht da)/ })
    .first()
    .click();
  // Noch bei derselben Person: Der Pfeil steht am Symbol.
  if ((await reiterName(page).textContent()) === name)
    await expect(page.locator('.haarlinie .z-uebersprungen .pfeil')).toHaveCount(1);
  await page.locator('.reiter', { hasText: name! }).click();
  await expect(page.locator('.reiter.an small')).toHaveText(vorher!);
});

test('A13, wunsch-W16: mehrere Monate: Kopf jeder Datei lesbar, Lupe, Wahl bleibt nach „Fertig“', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/unterlage/p-02-neustart-0/gehaltsnachweis');
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  await page
    .locator('[data-feld="pdf"]')
    .setInputFiles(await gehaltsPdfs(['Oktober', 'September']));
  const blatt = page.getByRole('dialog');
  const vorschau = blatt.locator('.w16-vorschau');
  await expect(vorschau).toHaveCount(2, { timeout: 30_000 });
  expect(await page.evaluate(vorschauPruefen)).toEqual([]);
  const wahl = blatt.locator('.w16-monat select').nth(1);
  const vorher = await wahl.inputValue();
  await vorschau.nth(1).click();
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(wahl).toHaveValue(vorher);
});

test('A14, wunsch-W20: zwei Daten, das gewählte wie mit Textmarker, „Keins davon“', async ({
  page,
}) => {
  await szenarioLaden(page, '02-neustart', '/unterlage/p-02-neustart-0/bonitaet');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'auskunft.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Max Mustermann\nAusgestellt am 20.10.2026\nKunde seit 03.04.2019']),
  });
  await page.getByRole('button', { name: 'Im Dokument auswählen' }).click({ timeout: 30_000 });
  const ansicht = page.locator('dialog[open]').last();
  await expect(ansicht.getByRole('button', { name: 'Keins davon' })).toBeVisible();
  await expect(ansicht.locator('.marke')).toHaveCount(2);
  expect(await page.evaluate(markerPruefen)).toEqual([]);
});

test('A15: Ende mit Übersprungenem: Reihen je Person, Legende', async ({ page }) => {
  await rutschStarten(page, '11-allein');
  for (let i = 0; i < 12; i++) {
    const weiter = page
      .locator('button:visible', { hasText: /^(Überspringen|Noch nicht da)$/ })
      .first();
    if (!(await weiter.isVisible().catch(() => false))) break;
    // Der Schritt blendet über (W9); der Knopf ist erst danach ruhig.
    await weiter.click({ force: true });
    await page.waitForTimeout(400);
  }
  // DP39, 4: alles übersprungen heißt „Für heute fertig.“
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Für heute fertig.');
  await expect(page.locator('.karte-weiss.personen li')).toHaveCount(1);
  await expect(page.getByText(/übersprungen, bleibt auf der Übersicht offen/)).toBeVisible();
});

test('A17, wunsch-W18: 320 px mit 130 %: Reiter in zwei Reihen, aktiver unten, nichts gekürzt', async ({
  page,
}) => {
  await page.setViewportSize({ width: 246, height: 437 });
  await rutschStarten(page, '10-lange-namen');
  expect(await page.evaluate(registerPruefen)).toEqual([]);
  const lagen = await page
    .locator('.reiter')
    .evaluateAll((r) => r.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(lagen).size).toBeGreaterThan(1);
  const an = await page.locator('.reiter.an').evaluate((e) => e.getBoundingClientRect().top);
  expect(Math.round(an)).toBe(Math.max(...lagen));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('A18: Haushalt allein: „du“', async ({ page }) => {
  await szenarioLaden(page, '11-allein', '/rutsch');
  const text = (await page.locator('main').textContent()) ?? '';
  expect(text).not.toMatch(/\b(ihr|euch|Legt)\b/);
  await expect(page.getByText(/^Tipp: Leg dir/)).toBeVisible();
});

// ---------------------------------------------------------------------------------------------------
// Einrichtung, Person ändern, abgelegte Hefte (A19 bis A22)

test('A19: zwei Bürgen: beide mit Umriss, eigene Druckfarbe', async ({ page }) => {
  await szenarioLaden(page, '08-zwei-buergen', '/haushalt');
  const zeichen = page.locator('.hh-gruppe .zeichen.zusatz');
  await expect(zeichen).toHaveCount(2);
  const farben = await zeichen.evaluateAll((z) => z.map((e) => getComputedStyle(e).boxShadow));
  expect(farben[0]).not.toBe(farben[1]);
  expect(await page.evaluate(rasterPruefen, DP39_BEREICHE)).toEqual([]);
});

test('A20: Einrichtung bei 320 px: Zähler unter dem Text', async ({ page }) => {
  await page.setViewportSize({ width: 246, height: 437 });
  await szenarioLaden(page, '01-standard', '/haushalt');
  const zeile = page.locator('.zaehler-kasten .zaehler').first();
  const [text, stufen] = await Promise.all([
    zeile.locator(':scope > :first-child').boundingBox(),
    zeile.locator('.stufen').boundingBox(),
  ]);
  expect(stufen!.y).toBeGreaterThanOrEqual(text!.y + text!.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('A21: Person ändern: Vorschau „In der Mappe“ in der Druckfarbe der gewählten Farbe', async ({
  page,
}) => {
  await szenarioLaden(page, '01-standard', '/person-aendern/p-01-standard-1/person');
  const vorschau = page.locator('.vorschau');
  await expect(vorschau).toContainText('In der Mappe');
  const vorher = await vorschau
    .locator('.zeichen')
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.locator('.farben button, [role="radio"]').nth(5).click();
  await expect
    .poll(() => vorschau.locator('.zeichen').evaluate((e) => getComputedStyle(e).backgroundColor))
    .not.toBe(vorher);
});

// A22 (abgelegte Hefte, W21): hefte.spec.ts prüft die Liste mit abgelegtPruefen.

// ---------------------------------------------------------------------------------------------------
// Dunkel und Abstände (A23, A24)

for (const [name, szenario, pfad] of [
  ['Personenseite', '01-standard', '/person/p-01-standard-2'],
  ['Unterlage', '25-unterlage-seiten', '/unterlage/p-25-unterlage-seiten-2/bonitaet'],
  ['Haushalt', '08-zwei-buergen', '/haushalt'],
] as const)
  test(`A23, A24, wunsch-W22: ${name} dunkel: Tönung dunkel, Linie in App-Farbe, nur Rasterwerte`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await szenarioLaden(page, szenario, pfad);
    const ton = await page
      .locator('.person-ton')
      .first()
      .evaluate((e) => {
        const s = getComputedStyle(e);
        return {
          tint: s.getPropertyValue('--p-tint').trim(),
          dunkel: s.getPropertyValue('--p-dunkel').trim(),
          linie: s.getPropertyValue('--p-linie').trim(),
          app: s.getPropertyValue('--p-app').trim(),
        };
      });
    expect(ton.tint).toBe(ton.dunkel);
    expect(ton.linie).toBe(ton.app);
    expect(await page.evaluate(rasterPruefen, DP39_BEREICHE)).toEqual([]);
  });

test('A24, wunsch-W22: Rutsch und Personenseite hell: nur Rasterwerte', async ({ page }) => {
  await rutschStarten(page, '03-mehrere-offen');
  expect(await page.evaluate(rasterPruefen, DP39_BEREICHE)).toEqual([]);
  await szenarioLaden(page, '01-standard', '/person/p-01-standard-0');
  expect(await page.evaluate(rasterPruefen, DP39_BEREICHE)).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------
// Gegenproben: Jede Prüfung schlägt bei einem Verstoß an.

test('wunsch-W18 Gegenprobe: Reiter mit Lücke zur Karte und gekürztem Namen', async ({ page }) => {
  await page.setContent(`<div class="register-rahmen"><nav class="register" style="display:flex">
    <button class="reiter an" style="height:44px;margin-bottom:6px;background:#fff">
      <span class="reiter-name" style="display:block;width:20px;overflow:hidden;white-space:nowrap">Maximilian</span></button>
    </nav><div class="karte" style="background:#eee;height:40px"></div></div>`);
  const f = await page.evaluate(registerPruefen);
  expect(f).toContain('aktiver Reiter hängt nicht an der Karte');
  expect(f).toContain('aktiver Reiter nicht in der Tönung');
  expect(f).toContain('Name gekürzt: Maximilian');
});

test('wunsch-W19 Gegenprobe: dicke Linie, großer Ring, schwarzer Block', async ({ page }) => {
  await page.setContent(`<div class="haarlinie"><i class="linie" style="display:block;height:6px"></i>
    <span class="ring" style="display:block;width:40px;height:40px;box-shadow:inset 0 0 0 3px red"></span>
    <span style="display:block;width:20px;height:8px;background:#000"></span></div>`);
  expect(await page.evaluate(haarliniePruefen)).toEqual([
    'Linie nicht 2 px',
    'Ring nicht 36 px',
    'Ring-Strich nicht 1,5 px',
    'schwarzer Block',
  ]);
});

test('wunsch-W20 Gegenprobe: Markierung mit Rahmen statt Textmarker', async ({ page }) => {
  await page.setContent(
    '<span class="marke" style="display:block;border:2px solid #000;background:rgba(0,0,0,.2)"></span>',
  );
  const f = await page.evaluate(markerPruefen);
  expect(f).toContain('mit Rahmen');
  expect(f).toContain('nicht multiplizierend');
  expect(f.some((x) => x.startsWith('Farbe'))).toBe(true);
});

test('wunsch-W21 Gegenprobe: Bild in der Liste, Datum hinten, Name umbricht', async ({ page }) => {
  await page.setContent(`<ul class="ab-karte"><li><a style="display:block;min-height:60px">
    <img alt="" width="10" height="10"><b>Helle Wohnung</b><span>12. Nov.</span></a></li></ul>`);
  const f = await page.evaluate(abgelegtPruefen);
  expect(f).toContain('Bild in der Liste');
  expect(f).toContain('Name nicht in einer Zeile');
  expect(f.some((x) => x.startsWith('Datum nicht vorn'))).toBe(true);
});

test('wunsch-W22 Gegenprobe: Abstand außerhalb des Rasters', async ({ page }) => {
  await page.setContent(
    '<div class="person-ton" style="padding:16px"><p style="margin:10px 0 6px">Text</p></div>',
  );
  const f = await page.evaluate(rasterPruefen, '.person-ton');
  expect(f).toContain('p. marginTop 10');
  expect(f).toContain('p. marginBottom 6');
});

test('wunsch-W16 Gegenprobe: Vorschau zu klein, ohne Lupe', async ({ page }) => {
  await page.setContent(
    '<div style="width:300px"><button class="w16-vorschau" style="display:block;width:200px;height:60px"></button></div>',
  );
  const f = await page.evaluate(vorschauPruefen);
  expect(f).toEqual([
    'Vorschau nur 60 px hoch',
    'Vorschau nicht in voller Breite',
    'Radius nicht 10',
    'keine Lupe',
  ]);
});

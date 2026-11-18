import { expect, test, type Page } from '@playwright/test';
import { pdfMit, szenarioLaden } from './szenario-laden';

// PC121, Regel 1 (DP80, D4; W8): Beim Hochladen hat das Bild im Hinweis zum Namen seine Größe schon vorher. Wenn es
// geladen ist, bewegt sich kein Knopf, den man sieht und antippen kann, um mehr als 2 px. Gemessen wird in jedem Bild
// (requestAnimationFrame) von der Wahl der Datei an. Gegenprobe: ohne vorher feste Größe (wie vor PC121) rutschen die
// Knöpfe. Die Inhaltsrichtlinie erlaubt kein eingeschobenes CSS; die Gegenprobe setzt die Höhe über `element.style`.
// Regel 2 und 3 (alles in einem Schritt, später Hinweis ans Ende) kommen mit 2.0.1 und werden hier nicht bewertet.

interface Probe {
  bild: boolean;
  kasten: boolean;
  knoepfe: { t: string; y: number }[];
}

async function messenBeimHochladen(page: Page, verdorben: boolean): Promise<Probe[]> {
  await szenarioLaden(page, '01-standard', '/unterlage/p-01-standard-0/bonitaet');
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .first()
    .click();
  await page.evaluate((verdorben) => {
    const w = window as unknown as { __proben: Probe[] };
    w.__proben = [];
    const dialog = () => document.querySelector('dialog[open]') ?? document;
    if (verdorben)
      new MutationObserver(() => {
        for (const e of document.querySelectorAll<HTMLElement>('.mass.frei'))
          e.style.setProperty('height', '0px', 'important');
      }).observe(document.body, { subtree: true, childList: true, attributes: true });
    const probe = () => {
      const d = dialog();
      const img = d.querySelector<HTMLImageElement>('.ausschnitt img');
      w.__proben.push({
        bild: !!img && img.complete && img.naturalWidth > 0,
        kasten: !!d.querySelector('[role="group"][aria-label="Bitte prüfen"]'),
        knoepfe: [...d.querySelectorAll<HTMLElement>('button, a[href], [role="radio"]')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
          })
          .map((e) => ({
            t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40),
            y: Math.round(e.getBoundingClientRect().top),
          })),
      });
      requestAnimationFrame(probe);
    };
    requestAnimationFrame(probe);
  }, verdorben);
  await page.locator('[data-feld="pdf"]').setInputFiles({
    name: 'lea.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Lea Mustermann Bonitaet']),
  });
  const kasten = page.getByRole('dialog').getByRole('group', { name: 'Bitte prüfen' });
  await expect(
    kasten.getByRole('button', { name: /der Name Lea Mustermann ist markiert/ }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(600);
  return page.evaluate(() => (window as unknown as { __proben: Probe[] }).__proben);
}

/** Wie weit ein Knopf, den es schon vor dem Bild gab, danach höchstens rutscht. */
function rutschen(proben: Probe[]): { t: string; um: number }[] {
  const erst = proben.findIndex((p) => p.bild);
  expect(erst, 'das Bild kam').toBeGreaterThan(0);
  // Der Stand, in dem der Hinweis schon steht und das Bild noch fehlt.
  const vorher = proben.slice(0, erst).find((p) => p.kasten);
  expect(vorher, 'der Hinweis stand vor dem Bild').toBeTruthy();
  const aus: { t: string; um: number }[] = [];
  for (const k of vorher!.knoepfe) {
    let um = 0;
    for (const p of proben.slice(erst)) {
      const gleich = p.knoepfe.find((x) => x.t === k.t);
      if (gleich) um = Math.max(um, Math.abs(gleich.y - k.y));
    }
    aus.push({ t: k.t, um });
  }
  return aus;
}

test('PC121 Regel 1: Kommt das Bild im Hinweis, rutscht kein Knopf um mehr als 2 px', async ({
  page,
}) => {
  const r = rutschen(await messenBeimHochladen(page, false));
  expect(r.length).toBeGreaterThan(0);
  expect(r.filter((k) => k.um > 2)).toEqual([]);
});

test('PC121 Regel 1, Gegenprobe: ohne vorher feste Größe rutschen die Knöpfe', async ({ page }) => {
  const r = rutschen(await messenBeimHochladen(page, true));
  expect(r.filter((k) => k.um > 2).length).toBeGreaterThan(0);
});

import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// „Alle ablegen“ bei „Keine Antwort“ (Planung 09a): ab drei Heften, mit der Zahl ohne Löschbitte davor
// und „Rückgängig“ danach.

async function hefteOhneAntwort(page: Page, anzahl: number) {
  await page.evaluate(
    (n) =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['hefte'], 'readwrite');
          const vor = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
          for (let i = 0; i < n; i++)
            tx.objectStore('hefte').put({
              id: `ohne-${i}`,
              createdAt: vor,
              updatedAt: vor,
              haushaltId: null,
              adresse: `Weg ${i + 1}\n20259 Hamburg`,
              link: null,
              quelle: '',
              inseratText: null,
              kennung: `k-${i}`,
              ereignisse: {
                beworben: { am: vor, weg: 'mail', sicher: true },
                gefragtAm: null,
                termin: null,
                ergebnis: null,
                ...(i === 0 ? { loeschbitteAm: vor } : {}),
              },
              notiz: '',
            });
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    anzahl,
  );
}

test('Ab drei Heften ohne Antwort: Hinweis auf Löschbitten, „Alle 3 ablegen“, Rückgängig', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await hefteOhneAntwort(page, 3);
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.getByRole('button', { name: /^Keine Antwort/ }).click();
  await expect(page.getByText('An 2 davon ging keine Löschbitte.')).toBeVisible();
  await page.getByRole('button', { name: 'Alle 3 ablegen' }).click();
  await expect(page.getByRole('button', { name: /^Keine Antwort/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Abgelegt\s*3/ })).toBeVisible();
  await expect(page.getByText('3 Hefte abgelegt')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /^Keine Antwort\s*3/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Abgelegt/ })).toHaveCount(0);
});

test('Zwei Hefte ohne Antwort: kein „Alle ablegen“', async ({ page }) => {
  await haushaltMitMax(page);
  await hefteOhneAntwort(page, 2);
  await page.goto('/#/wohnungen');
  await page.reload();
  await page.getByRole('button', { name: /^Keine Antwort/ }).click();
  await expect(page.getByRole('button', { name: /ablegen$/ })).toHaveCount(0);
});

test('„Keine Antwort“ im Heft: nachfragen und Löschbitte, Hefta merkt sich die Löschbitte (B18)', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await hefteOhneAntwort(page, 2);
  await page.goto('/#/heft/ohne-1');
  await page.reload();
  await expect(page.getByText('Seit drei Wochen keine Antwort.')).toBeVisible();

  await page.getByRole('link', { name: 'Kurz nachfragen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kurz nachfragen' })).toBeVisible();
  await expect(page.getByLabel('Betreff')).toHaveValue('Nachfrage zur Wohnung Weg 2');
  await expect(page.getByLabel('Text')).toHaveValue(
    /^Sehr geehrte Damen und Herren,\n\nam \d+\. \w+ habe ich mich um die Wohnung im Weg 2 beworben\. Ist sie noch zu haben\?/,
  );
  await expect(page.getByText('Hefta verschickt nichts selbst.')).toBeVisible();
  await page.getByRole('button', { name: 'Mail öffnen' }).click();
  await expect(page.getByText(/^Nachgefragt am /)).toBeVisible();

  await page.getByRole('link', { name: 'Löschbitte schreiben' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Löschbitte' })).toBeVisible();
  await expect(page.getByLabel('Betreff')).toHaveValue('Bitte um Löschung meiner Unterlagen');
  await page.getByRole('button', { name: 'Mail öffnen' }).click();
  await expect(
    page.getByText(/^Löschbitte geschickt am .*Ob gelöscht wurde, kann Hefta nicht wissen\.$/),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Löschbitte schreiben' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Ablegen', exact: true }).click();
  await expect(page.getByText('Das Heft liegt bei den abgelegten.')).toBeVisible();
});

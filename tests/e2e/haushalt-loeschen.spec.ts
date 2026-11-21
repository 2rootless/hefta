import { expect, test, type Page } from '@playwright/test';
import { appHinweisNochmal, erstePerson, haushaltMitMax, personHinzufuegen } from './einrichtung';

// E96 (Planung 12ze): „Haushalt löschen“ unten auf „Euer Haushalt“, Hefte bleiben; danach einmal die
// Frage nach den Heften, seit DP50 Punkt 1 als Karte mit „Hefte auch löschen“, „Behalten“ und
// „Rückgängig“. Dazu der Nachname als eigener Punkt im Kasten.

async function einHeft(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['haushalte', 'hefte'], 'readwrite');
          const hh = tx.objectStore('haushalte').getAll();
          hh.onsuccess = () => {
            const zeit = new Date().toISOString();
            tx.objectStore('hefte').put({
              id: 'linden',
              createdAt: zeit,
              updatedAt: zeit,
              haushaltId: (hh.result[0] as { id: string }).id,
              adresse: 'Lindenring 3\n20259 Hamburg',
              link: null,
              quelle: '',
              inseratText: null,
              kennung: 'k-linden',
              ereignisse: { beworben: null, gefragtAm: null, termin: null, ergebnis: null },
              notiz: '',
            });
          };
          tx.oncomplete = () => {
            db.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
  );
}

test('„Haushalt löschen“: erst nach dem Blatt, Hefte bleiben, Hinweis führt zu „Alles löschen“', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await einHeft(page);
  await page.goto('/#/haushalt');
  await page.getByRole('button', { name: 'Haushalt löschen' }).click();
  const blatt = page.getByRole('dialog', { name: 'Haushalt löschen?' });
  // Allein: „Deine Hefte“ (E74, E83).
  await expect(blatt).toContainText(
    'Alle Personen mit ihren Unterlagen und die Mappe werden gelöscht. Deine Hefte mit Wohnungen, Terminen und Notizen bleiben.',
  );
  await blatt.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(blatt).toBeHidden();
  await page.getByRole('button', { name: 'Haushalt löschen' }).click();
  await blatt.getByRole('button', { name: 'Haushalt löschen' }).click();

  await expect(page).toHaveURL(/mappe-start$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hier entsteht eure Mappe.' }),
  ).toBeVisible();
  // DP50 Punkt 1: die Frage nach den Heften als Karte; allein „Dein Heft“.
  const karte = page.getByRole('region', { name: 'Haushalt gelöscht.' });
  await expect(karte).toContainText(
    'Dein Heft ist noch da, mit seinen Notizen und Fotos. Soll es auch weg?',
  );
  // „Heft auch löschen“ in Tinte, nicht Rot (W5).
  const knopf = karte.getByRole('button', { name: 'Heft auch löschen' });
  const rot = await page.evaluate(() => {
    const p = document.createElement('p');
    p.style.color = 'var(--accent-text)';
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  });
  expect(await knopf.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(rot);
  await knopf.click();
  // „Rückgängig“ an der Stelle der Karte; es holt das Heft zurück.
  await expect(page.getByRole('status')).toContainText('Ein Heft gelöscht');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.goto('/#/wohnungen');
  await expect(page.getByText('Lindenring 3').first()).toBeVisible();
});

async function haushaltWeg(page: Page) {
  await haushaltMitMax(page);
  await einHeft(page);
  await page.goto('/#/haushalt');
  await page.getByRole('button', { name: 'Haushalt löschen' }).click();
  await page
    .getByRole('dialog', { name: 'Haushalt löschen?' })
    .getByRole('button', { name: 'Haushalt löschen' })
    .click();
  await expect(page.getByRole('region', { name: 'Haushalt gelöscht.' })).toBeVisible();
}

test('„Behalten“ schließt die Karte, das Heft bleibt', async ({ page }) => {
  await haushaltWeg(page);
  await page.getByRole('button', { name: 'Behalten' }).click();
  await expect(page.getByRole('region', { name: 'Haushalt gelöscht.' })).toHaveCount(0);
  await page.goto('/#/wohnungen');
  await expect(page.getByText('Lindenring 3').first()).toBeVisible();
});

test('„Heft auch löschen“, dann den Reiter verlassen: endgültig weg', async ({ page }) => {
  await haushaltWeg(page);
  await page.getByRole('button', { name: 'Heft auch löschen' }).click();
  await expect(page.getByRole('status')).toContainText(/gelöscht/);
  await page.goto('/#/wohnungen');
  await expect(page.getByText('Lindenring 3')).toHaveCount(0);
  // Gegenprobe: In der Datenbank steht kein Heft mehr.
  const zahl = await page.evaluate(
    () =>
      new Promise<number>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const q = r.result.transaction('hefte').objectStore('hefte').count();
          q.onsuccess = () => {
            r.result.close();
            fertig(q.result);
          };
        };
      }),
  );
  expect(zahl).toBe(0);
});

test('Nachname fehlt: eigener Punkt im Kasten, führt zum Ändern und zurück zur Mappe', async ({
  page,
}) => {
  await erstePerson(page, { vorname: 'Max', nachname: '', bezeichnung: 'Hauptmieter' });
  await personHinzufuegen(page, /Mitmieter hinzufügen/, {
    vorname: 'Lea',
    bezeichnung: 'Mitmieterin',
  });
  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  await appHinweisNochmal(page);
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  const punkt = page.getByRole('link', { name: /^Nachname von Max / });
  await expect(punkt).toBeVisible();
  await expect(page.getByRole('link', { name: /^Nachname von Lea / })).toHaveCount(0);
  await punkt.click();
  await page.getByLabel('Nachname', { exact: true }).fill('Muster');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Nachname von Max / })).toHaveCount(0);
});

test('Schwelle oben (13.11.): frisch angelegt höchstens drei Aufgaben, der Rest unten', async ({
  page,
}) => {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await personHinzufuegen(page, /Mitmieter hinzufügen/, {
    vorname: 'Lea',
    bezeichnung: 'Mitmieterin',
  });
  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  await appHinweisNochmal(page);
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eure Mappe' })).toBeVisible();
  const oben = page.locator('section.aufgaben > ul:not(.namen) > li');
  await expect(oben).toHaveCount(3);
  await expect(page.getByText(/^Dazu \d+ weitere, unten bei den Personen\.$/)).toBeVisible();
});

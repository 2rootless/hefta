import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// PC65, Abschnitt 3: Die Frage nach Mietrückständen ohne Anweisung, mit gleichrangiger Wahl „Nach der
// Zusage beantworten“. Nach einer Zusage steht sie offen im Heft, auf der Personenseite und im Reiter
// „Mappe“, nie in Rot; nach der Antwort ist sie überall weg. Gegenprobe: Vorher erschien sie nach der
// Zusage nirgends (die Zeile im Heft hing am Schalter in „Eigene Auswahl“, die anderen gab es nicht).

const PERSONEN = ['p-04-fertig-0', 'p-04-fertig-1'];

async function frageOeffnen(page: Page, person: string) {
  await page.evaluate((p) => (location.hash = `#/selbstauskunft/${p}`), person);
  const gruppe = page.getByRole('radiogroup', { name: /Mietrückstände/ });
  const zu = page.getByRole('button', {
    name: /^Drei Fragen aus dem Musterbogen/,
    expanded: false,
  });
  // Erst warten, bis die Seite steht: Ein zu früher Blick sah den Teil noch nicht und klappte ihn dann
  // zu statt auf (Wackler in WebKit, PC79).
  await expect(gruppe.or(zu).first()).toBeVisible();
  if (await zu.isVisible()) await zu.click();
  await expect(gruppe).toBeVisible();
  return gruppe;
}

async function zusageAnlegen(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((fertig, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('hefte', 'readwrite');
          tx.objectStore('hefte').put({
            id: 'zusage',
            createdAt: '2026-11-01T10:00:00.000Z',
            updatedAt: '2026-11-10T10:00:00.000Z',
            haushaltId: null,
            adresse: 'Lindenring 3\n20259 Hamburg',
            link: null,
            quelle: '',
            inseratText: null,
            kennung: 'k-zusage',
            ereignisse: {
              beworben: { am: '2026-11-02T10:00:00.000Z', weg: 'mail', sicher: true },
              gefragtAm: '2026-11-02T10:00:00.000Z',
              termin: null,
              ergebnis: { art: 'zusage', am: '2026-11-10T10:00:00.000Z' },
              loeschbitteAm: null,
              nachgefasstAm: null,
              abgelegtAm: null,
            },
            notiz: '',
            angaben: {
              titel: 'Altbau am Kanal',
              stadtteil: null,
              warm: null,
              zimmer: null,
              flaeche: null,
            },
          });
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
          tx.onerror = () => fehler(tx.error);
        };
      }),
  );
}

/** Steht die offene Frage an den drei Stellen? */
async function offenAnAllenStellen(page: Page, erwartet: boolean) {
  const anzahl = erwartet ? 1 : 0;
  await page.evaluate(() => (location.hash = '#/heft/zusage'));
  // DP50 Z2: Im Heft heißt die Zeile „Mietrückstände beantworten“.
  await expect(page.getByText('Mietrückstände beantworten')).toHaveCount(anzahl);
  await page.evaluate((p) => (location.hash = `#/person/${p}`), PERSONEN[0]!);
  await expect(page.locator('.miet-offen')).toHaveCount(anzahl);
  await page.evaluate(() => (location.hash = '#/'));
  await expect(page.locator('.aufgaben .miet-offen')).toHaveCount(anzahl);
  if (erwartet) {
    // Nicht in Rot (W5): Die Zeile hat die Farbe gewöhnlicher Aufgaben, nicht die des Zurück-Links.
    const farben = await page.evaluate(() => {
      const z = document.querySelector('.miet-offen b')!;
      const d = document.createElement('a');
      d.className = 'zurueck';
      document.body.append(d);
      const rot = getComputedStyle(document.documentElement).getPropertyValue('--accent-text');
      d.remove();
      return { zeile: getComputedStyle(z).color, rot: rot.trim() };
    });
    expect(farben.zeile).not.toBe(farben.rot);
  }
}

test('Mietrückstände: „Nach der Zusage“, nach der Zusage überall offen, nach der Antwort weg', async ({
  page,
}) => {
  await szenarioLaden(page, '04-fertig', `/selbstauskunft/${PERSONEN[0]}`);
  for (const person of PERSONEN) {
    let gruppe = await frageOeffnen(page, person);
    // Im Muster ist sie schon beantwortet: erst die Antwort entfernen, gespeichert, dann neu öffnen.
    const entfernen = page.getByRole('button', { name: 'Antwort entfernen' });
    if (await entfernen.isVisible().catch(() => false)) {
      await entfernen.click();
      await page.waitForTimeout(900);
      gruppe = await frageOeffnen(page, person);
    }
    // Drei gleichrangige Wahlen, keine vorgewählt.
    const wahlen = gruppe.getByRole('radio');
    await expect(wahlen).toHaveText(['Ja', 'Nein', 'Nach der Zusage']);
    for (const w of await wahlen.all()) await expect(w).toHaveAttribute('aria-checked', 'false');
    // Hinweis nach der Orientierungshilfe statt einer Anweisung (W32).
    await expect(
      page.getByText(
        /^Nach der Orientierungshilfe der Datenschutzkonferenz darf der Vermieter das erst kurz vor dem Vertrag fragen\./,
      ),
    ).toBeVisible();
    await expect(page.getByText(/^Gemeint ist: zwei Monate nacheinander/)).toBeVisible();
    await expect(page.getByText(/^Erst beantworten/)).toHaveCount(0);
    await gruppe.getByRole('radio', { name: 'Nach der Zusage' }).click();
    await expect(gruppe.getByRole('radio', { name: 'Nach der Zusage' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Die Seite speichert kurz nach jeder Änderung (400 ms); erst dann zur nächsten Person.
    await page.waitForTimeout(900);
  }
  // Ohne Zusage ist nichts offen.
  await page.evaluate(() => (location.hash = `#/`));
  await expect(page.locator('.miet-offen')).toHaveCount(0);

  await zusageAnlegen(page);
  await page.reload();
  await offenAnAllenStellen(page, true);

  // Nach der Antwort ist die Frage überall weg.
  for (const person of PERSONEN) {
    const gruppe = await frageOeffnen(page, person);
    await expect(gruppe.getByRole('radio', { name: 'Nach der Zusage' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Mit der Antwort ist der Teil fertig und schließt sich von selbst.
    await gruppe.getByRole('radio', { name: 'Nein' }).click();
    await page.waitForTimeout(900);
  }
  await offenAnAllenStellen(page, false);
});

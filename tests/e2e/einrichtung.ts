import { expect, type Page } from '@playwright/test';

// Einrichtung in Stil C (design/einrichtung-rutsch-navigation.md): Schritt 1 „Wer bist du?“,
// Schritt 2 „Wer gehört noch dazu?“, Personen auf eigenem Bildschirm (Entscheidung F).

export interface NeuePerson {
  vorname: string;
  nachname?: string;
  bezeichnung: string;
  /** Text der Auswahl „Woher kommt das Einkommen?“, ohne Angabe „Angestellt“. */
  einkommen?: string;
}

async function personAusfuellen(page: Page, p: NeuePerson) {
  await page.getByLabel('Vorname').fill(p.vorname);
  await page.getByLabel('Nachname').fill(p.nachname ?? 'Mustermann');
  await page.getByRole('radio', { name: p.bezeichnung, exact: true }).click();
  if (p.einkommen) await page.getByLabel(/Einkommen\?$/).selectOption({ label: p.einkommen });
}

/** Erster Start (G4) und Hinweis auf die App (E30; die Tests laufen als iPhone-Safari). */
export async function ersterStart(page: Page) {
  // Hefta 2: Der erste Bildschirm ist der Tab „Wohnungen“ ohne Haushalt (E45, B15).
  await page.getByRole('button', { name: /^Wer zieht ein\?/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hefta gibt es als App.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Weiter im Browser', exact: true }).click();
}

/**
 * E30: Nach „Weiter im Browser“ zeigt Hefta den Hinweis auf die App nach dem Anlegen des Haushalts noch
 * einmal, mit dem Satz zum Backup. Danach nie wieder.
 */
export async function appHinweisNochmal(page: Page) {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hefta gibt es als App.' }),
  ).toBeVisible();
  await expect(page.getByText('Safari und die App haben getrennte Speicher.')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter im Browser', exact: true }).click();
}

/** Schritt 1 vom leeren Zustand aus. */
export async function erstePerson(page: Page, p: NeuePerson) {
  await page.goto('/');
  await ersterStart(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Wer bist du?' })).toBeVisible();
  await personAusfuellen(page, p);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wer gehört noch dazu?' }),
  ).toBeVisible();
}

/** Auf dem Haushalt-Bildschirm ein Eintragen-Feld antippen und die Person anlegen. */
export async function personHinzufuegen(page: Page, feld: RegExp, p: NeuePerson) {
  await page.getByRole('link', { name: feld }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Wer zieht mit ein\?|Wer bürgt\?/,
  );
  // T8: Anrede passt zur Person, um die es geht (nicht „deinen“).
  await expect(page.getByText(/^Tragt? den Vornamen ein\.$/)).toBeVisible();
  await personAusfuellen(page, p);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Wer gehört noch dazu\?|Euer Haushalt/ }),
  ).toBeVisible();
}

/** Max, Lea, ein Kind, Bürgin Petra (in Rente); danach Start des Rutschs. */
export async function haushaltDesAuftraggebers(page: Page) {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await personHinzufuegen(page, /Mitmieter hinzufügen/, {
    vorname: 'Lea',
    bezeichnung: 'Mitmieterin',
  });
  await page.getByRole('button', { name: 'Mehr: Kinder' }).click();
  await personHinzufuegen(page, /Bürge hinzufügen/, {
    vorname: 'Petra',
    bezeichnung: 'Bürgin',
    einkommen: 'In Rente',
  });
  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  await appHinweisNochmal(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Jetzt die Unterlagen.' }),
  ).toBeVisible();
}

/** Nur Max, angestellt, bis zur Übersicht (Rutsch auf später). */
export async function haushaltMitMax(page: Page) {
  await erstePerson(page, { vorname: 'Max', bezeichnung: 'Hauptmieter' });
  await page.getByRole('link', { name: 'Haushalt anlegen' }).click();
  await appHinweisNochmal(page);
  await page.getByRole('button', { name: 'Später', exact: true }).click();
  // Tab „Mappe“ (B12b): allein „Deine Mappe“.
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
}

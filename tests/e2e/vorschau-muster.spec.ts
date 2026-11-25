import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { pdfMit, szenarioLaden } from './szenario-laden';

// PC80 (E163), PC177 (DP110, W40): das Musterbackup für die Vorschau und die Store-Bilder, ohne Passwort. Läuft nur
// mit VORSCHAU_MUSTER=1 (werkzeug/vorschau-2-1.sh). Haushalt A der Namensliste (Jarne, Selin, Hiltrud bürgt, ein
// Kind) und die drei Hefte aus DP110, Abschnitt 3; die Straßen sind gegen OSM geprüft (data/musterstrassen.json).

// PC187: Die Tage zählen ab dem Bau des Backups, damit der Termin auf 02 noch kommt, wenn der Auftraggeber die
// Store-Bilder am iPhone aufnimmt (fest am 17.11. lag er schon zurück).
const HEUTE = new Date();
const tag = (d: number, h = 12) =>
  new Date(HEUTE.getFullYear(), HEUTE.getMonth(), HEUTE.getDate() + d, h, 0).toISOString();
const leer = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

function heft(
  id: string,
  merkmal: string,
  adresse: string,
  stadtteil: string,
  angaben: Record<string, unknown>,
  ereignisse: Record<string, unknown>,
) {
  return {
    id,
    createdAt: tag(-10),
    updatedAt: tag(-10),
    haushaltId: null,
    adresse,
    link: null,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: { ...leer, ...ereignisse },
    notiz: '',
    angaben: { merkmal, stadtteil, ...angaben },
  };
}

// PC189: Zu „Altbau mit Garten“ (1 240 € warm, 3 Zimmer, 74 m², ohne Einzug im Inserat) eine Mischung: Zimmer und
// Fläche passen, die Warmmiete liegt darüber, der Einzug ist unbekannt.
const WUENSCHE = {
  warmBis: 1150,
  zimmerAb: 3,
  flaecheAb: 65,
  ort: null,
  einzugVon: null,
  einzugBis: `${HEUTE.getFullYear() + 1}-03-31`,
  auchBefristet: false,
};
// PC209 (E254, DP85, F1b): Das Muster-Heft „Altbau mit Garten“ zeigt Designs Grundriss auf Karton als Foto, wie
// in store-bilder.spec.ts, nicht die gezeichnete Fassade (Store-Bild 02). Nur Musterdaten.
const FOTO_ALTBAU = 'foto-muster-1';
const HEFTE: Record<string, unknown>[] = [
  // 02: Besichtigung mit Termin, Vermieterin Dörte Kaminski (Hausverwaltung)
  heft(
    'muster-1',
    'Altbau mit Garten',
    'Kranichstieg 3, Erdgeschoss\n20259 Hamburg',
    'Eimsbüttel',
    { warm: 1240, zimmer: 3, flaeche: 74, anbieter: 'Frau Kaminski' },
    {
      beworben: { am: tag(-6), weg: 'mail', sicher: true },
      termin: { am: tag(4, 17), ort: 'Kranichstieg 3, Erdgeschoss', treffpunkt: '' },
    },
  ),
  heft(
    'muster-2',
    'Dachgeschoss mit Balkon',
    'Lotsenwisch 8, 2. Obergeschoss\n22081 Hamburg',
    'Barmbek-Süd',
    { warm: 1310, zimmer: 3, flaeche: 78 },
    { beworben: { am: tag(-3), weg: 'mail', sicher: true } },
  ),
  heft(
    'muster-3',
    'Neubau am Park',
    'Rotdornbogen 21, 1. Obergeschoss\n21107 Hamburg',
    'Wilhelmsburg',
    { warm: 1180, zimmer: 2, flaeche: 61 },
    {},
  ),
];

test('Musterbackup für die Vorschau', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' || !process.env.VORSCHAU_MUSTER, 'nur für die Vorschau');
  await szenarioLaden(page, 'A-namensliste', '/');
  const grundriss = readFileSync(
    'tests/fixtures/store/heftbild-F1b-grundriss-karton-2412x1206.png',
  ).toString('base64');
  await page.evaluate(
    ({ hefte, wuensche, grundriss, fotoId }) =>
      new Promise<void>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction(['hefte', 'haushalte', 'dateien'], 'readwrite');
          const roh = Uint8Array.from(atob(grundriss), (z) => z.charCodeAt(0));
          tx.objectStore('dateien').put({
            id: fotoId,
            createdAt: new Date().toISOString(),
            typ: 'image/png',
            groesse: roh.length,
            daten: new Blob([roh], { type: 'image/png' }),
          });
          for (const h of hefte)
            tx.objectStore('hefte').put(h.id === 'muster-1' ? { ...h, foto: fotoId } : h);
          // PC189: Wünsche von Haushalt A für Store-Bild 04 (erfunden, W7, W40).
          const haushalte = tx.objectStore('haushalte');
          haushalte.getAll().onsuccess = (e) => {
            for (const h of (e.target as IDBRequest<{ wuensche?: unknown }[]>).result)
              haushalte.put({ ...h, wuensche });
          };
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
        };
      }),
    { hefte: HEFTE, wuensche: WUENSCHE, grundriss, fotoId: FOTO_ALTBAU },
  );
  await page.reload();
  await page.evaluate(() => (window.location.hash = '#/einstellungen/backup'));
  await page.getByRole('radio', { name: /^Ohne Passwort/ }).click();
  const laden = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Backup (sichern|erstellen)/ }).click();
  const datei = await laden;
  await datei.saveAs('test-results/hefta-muster.hefta');
  // W50 (DP106): Im Browser weiß Hefta nur, dass der Download begonnen hat.
  await expect(page.getByText(/^Download gestartet:/)).toBeVisible();
});

// PC187: drei erfundene Abrechnungen für Selin (Store-Bild 09, Monate zuordnen). Firma aus Haushalt A, deutlich
// gekennzeichnet; liegen in der Vorschau unter /muster/.
test('Abrechnungen für die Vorschau', async ({ browserName }) => {
  test.skip(browserName !== 'chromium' || !process.env.VORSCHAU_MUSTER, 'nur für die Vorschau');
  for (const monat of ['August', 'September', 'Oktober'])
    writeFileSync(
      `test-results/gehalt-selin-${monat.toLowerCase()}.pdf`,
      await pdfMit(
        [
          `Seilerkoppel Ingenieure GmbH
Verdienstabrechnung ${monat} 2026
Selin Akgül
Erfunden – kein echtes Dokument`,
        ],
        14,
      ),
    );
});

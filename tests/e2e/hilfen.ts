import type { Page } from '@playwright/test';

/** Sammelt jede Anfrage und jeden Fehler der Seite. */
export function beobachten(page: Page) {
  const anfragen: string[] = [];
  const fehler: string[] = [];
  page.on('request', (r) => anfragen.push(r.url()));
  page.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text());
  });
  page.on('pageerror', (e) => fehler.push(e.message));
  return {
    anfragen,
    fehler,
    async cspVerstoesse(): Promise<string[]> {
      return page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
    },
  };
}

/** Meldet CSP-Verstöße in window.__csp, bevor die Seite lädt. */
export async function cspMelden(page: Page) {
  await page.addInitScript(() => {
    const liste: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = liste;
    document.addEventListener('securitypolicyviolation', (e) => {
      liste.push(`${e.violatedDirective}: ${e.blockedURI}`);
    });
  });
}

export function fremde(anfragen: string[], basis: string): string[] {
  const eigen = new URL(basis).origin;
  return anfragen.filter((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return false;
    return new URL(url).origin !== eigen;
  });
}

/** Wartet, bis eine Prüfung im Technik-Test erscheint, und gibt ihren Zustand zurück. */
export async function pruefung(page: Page, id: string, timeout = 60_000) {
  const zeile = page.locator(`[data-pruefung="${id}"]`);
  await zeile.waitFor({ timeout });
  return { ok: await zeile.getAttribute('data-ok'), text: await zeile.innerText() };
}

/** Wartet, bis der Service Worker die Seite steuert. False, wenn der Browser keinen hat. */
export async function serviceWorkerBereit(page: Page): Promise<boolean> {
  const vorhanden = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  if (!vorhanden) return false;
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  return true;
}

/**
 * Wartet, bis das Überblenden vorbei ist: Es läuft auch mit „Bewegung reduzieren“ (150 ms), und mitten
 * darin messen Kontrast-Prüfungen und Bilder blasse Farben.
 */
export function animationenFertig(page: Page) {
  return page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}

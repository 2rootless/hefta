// Hinweise oben auf der Übersicht (design/geraet-und-stoerungen.md, Abschnitt 2, G2, G3, G5): immer
// nur einer, Reihenfolge Fehler, Speicher, neue Version. Nichts davon wird irgendwohin gemeldet.

/** Unter 50 MB frei gilt der Speicher als knapp. */
const KNAPP = 50 * 1024 * 1024;

export const hinweise = $state({
  /** Ein unerwarteter Fehler ist passiert; bleibt, bis man den Kasten schließt. */
  fehler: false,
  speicherKnapp: false,
  /** „Neue Version“ für diesen Besuch weggetippt. */
  versionWeg: false,
});

export function speicherIstKnapp(belegt: number, grenze: number): boolean {
  return grenze > 0 && grenze - belegt < KNAPP;
}

export async function speicherPruefen(): Promise<void> {
  const schaetzung = await navigator.storage?.estimate?.().catch(() => undefined);
  hinweise.speicherKnapp =
    !!schaetzung?.quota && speicherIstKnapp(schaetzung.usage ?? 0, schaetzung.quota);
}

// Harmlose Meldungen der Browser, die nichts mit Hefta zu tun haben.
const HARMLOS =
  /ResizeObserver loop|^AbortError|^NotAllowedError|RenderingCancelled|Transport destroyed|Worker was destroyed/;

/** Hört auf unerwartete Fehler; `dann` läuft zusätzlich (z. B. Verbindung zum Speicher prüfen). */
export function fehlerBeobachten(dann: () => void): () => void {
  const melden = (grund: unknown) => {
    const text = grund instanceof Error ? `${grund.name}: ${grund.message}` : String(grund);
    if (HARMLOS.test(text)) return;
    // Der Fehler kann mitten in einem Bildschirmwechsel kommen; dort darf sich kein Zustand ändern.
    queueMicrotask(() => {
      hinweise.fehler = true;
      dann();
    });
  };
  const fehler = (e: ErrorEvent) => melden(e.error ?? e.message);
  const abgelehnt = (e: PromiseRejectionEvent) => melden(e.reason);
  window.addEventListener('error', fehler);
  window.addEventListener('unhandledrejection', abgelehnt);
  return () => {
    window.removeEventListener('error', fehler);
    window.removeEventListener('unhandledrejection', abgelehnt);
  };
}

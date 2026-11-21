// PC70 (W8, CP44): In „Mappe anpassen“ steht der Platz der Vorschau frei, bevor sie fertig ist; sonst rutschen
// die Schalter darunter nach unten, sobald sie erscheint. Die Höhe kommt aus der letzten Vorschau: Hefta merkt
// sich ihr Seitenverhältnis (Höhe durch Breite), damit es auch bei anderer Breite passt. Beim ersten Mal gilt ein
// festes. Wie die Wahl von Hell und Dunkel liegt das nur im Browser-Speicher dieses Geräts; fehlt der Speicher
// (privates Surfen), gilt der Wert bis zum nächsten Start.

const SCHLUESSEL = 'hefta-vorschau-verhaeltnis';

/**
 * Beim ersten Mal: gemessen bei 390 px mit dem Musterhaushalt (Max, Lea, Petra), Aussehen „Farben der Personen“. Bei 320 px
 * ist die Vorschau verhältnismäßig etwas höher (0,7188); beim ersten Mal rückt dort darum einmal etwa 15 px.
 */
export const ERSTES_VERHAELTNIS = 0.6732;

/** Ohne Browser-Speicher: das Verhältnis bis zum nächsten Start. */
let ohneSpeicher: number | null = null;

function gueltig(v: number): boolean {
  return Number.isFinite(v) && v > 0.2 && v < 5;
}

/** Höhe durch Breite der zuletzt gezeigten Vorschau, sonst das feste vom ersten Mal. */
export function vorschauVerhaeltnis(): number {
  try {
    const v = Number(localStorage.getItem(SCHLUESSEL));
    if (gueltig(v)) return v;
  } catch {
    // privates Surfen: weiter mit dem Wert dieses Starts
  }
  return ohneSpeicher ?? ERSTES_VERHAELTNIS;
}

/** Merkt sich das Verhältnis einer fertigen Vorschau. */
export function vorschauMerken(breite: number, hoehe: number): void {
  if (!(breite > 0 && hoehe > 0)) return;
  const v = Math.round((hoehe / breite) * 10_000) / 10_000;
  if (!gueltig(v)) return;
  ohneSpeicher = v;
  try {
    localStorage.setItem(SCHLUESSEL, String(v));
  } catch {
    // privates Surfen
  }
}

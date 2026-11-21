// W49 (PC165, Vorschlag von Design): die Größe der Mappe beim Bewerben per Mail. Seit PC186 rechnet ganz Hefta
// so, aus dieser einen Funktion: App (`groesse` in i18n) und Vermieterseite (`groesseText`).
// Gerechnet wie „Dateien“ am iPhone: 1 MB = 1 000 000 Byte. So stehen in Hefta und in „Dateien“ dieselben Zahlen.
// Die übliche Grenze der Postfächer ist 20 MB für die ganze Mail; Anhänge werden um etwa ein Drittel größer
// (Base64). Darum ab 15 MB der ruhige Satz (CP90, Abschnitt 4).

/** Ab dieser Größe steht der Hinweis: 15 000 000 Byte. */
export const MAIL_GRENZE = 15_000_000;

export function mailZuGross(bytes: number): boolean {
  return bytes >= MAIL_GRENZE;
}

const eineStelle = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * „640 KB“ unter 1 MB, ohne Komma; sonst „8,2 MB“ mit einer Stelle. Abgeschnitten, nicht gerundet: So steht
 * „15,0 MB“ nur, wenn die Grenze auch erreicht ist, und nie neben einer Mappe ohne Hinweis.
 */
export function groesseWieDateien(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1_000_000) return `${Math.max(1, Math.floor(bytes / 1000))} KB`;
  if (bytes < 1_000_000_000) return `${eineStelle.format(Math.floor(bytes / 100_000) / 10)} MB`;
  return `${eineStelle.format(Math.floor(bytes / 100_000_000) / 10)} GB`;
}

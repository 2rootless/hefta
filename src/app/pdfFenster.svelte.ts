/** PDFs öffnen in der eigenen Seitenansicht, in App und Browser: kein neuer Tab, kein Download. */
export const pdfFenster = $state<{ datei: File | null }>({ datei: null });

export function pdfZeigen(datei: File): void {
  pdfFenster.datei = datei;
}

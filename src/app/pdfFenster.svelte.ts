/** In der App gibt es keinen neuen Tab für PDFs: Sie öffnen in der eigenen Seitenansicht. */
export const pdfFenster = $state<{ datei: File | null }>({ datei: null });

export function pdfZeigen(datei: File): void {
  pdfFenster.datei = datei;
}

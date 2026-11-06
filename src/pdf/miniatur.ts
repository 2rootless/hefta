import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Kleine Seitenvorschau als Bild-URL (vom Aufrufer mit URL.revokeObjectURL freizugeben). */
export async function miniatur(
  dokument: PDFDocumentProxy,
  nummer: number,
  breitePx = 220,
): Promise<string> {
  const seite = await dokument.getPage(nummer);
  const basis = seite.getViewport({ scale: 1 });
  const ansicht = seite.getViewport({ scale: breitePx / basis.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(ansicht.width);
  canvas.height = Math.floor(ansicht.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await seite.render({ canvas, canvasContext: ctx, viewport: ansicht }).promise;
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
  canvas.width = 0;
  canvas.height = 0;
  seite.cleanup();
  if (!blob) throw new Error('Vorschau fehlgeschlagen');
  return URL.createObjectURL(blob);
}

// Breite eines Texts in einer Schrift wie in den meisten PDFs, damit eine Markierung genau auf dem Wort
// sitzt (wie in NamensVorschau). Ohne Canvas bleibt jedes Zeichen gleich breit.
let messer: ((text: string) => number) | undefined;

export function textMessen(): ((text: string) => number) | undefined {
  if (messer) return messer;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return undefined;
  ctx.font = '100px Helvetica, Arial, sans-serif';
  messer = (text) => ctx.measureText(text).width;
  return messer;
}

import { bilderAlsPdf } from './zusammenfuegen';

// Fotos von Unterlagen als PDF (Version 2, D1): je Foto eine Seite. Fast-A4-Fotos (nach dem
// Geraderücken meist genau A4) füllen ein A4-Blatt, andere behalten ihr Seitenverhältnis und
// passen in A4. Läuft ohne Browser-APIs.

// Wie A4 in mappe.ts; hier eigen, damit Fotos nicht die Schriften der Mappe nachladen.
const A4 = { breite: 595.28, hoehe: 841.89 };

/** Seitengröße in pt für ein Bild mit diesen Pixelmaßen. */
export function seiteFuerFoto(
  breitePx: number,
  hoehePx: number,
): { breite: number; hoehe: number } {
  const hoch = hoehePx >= breitePx;
  const [kurz, lang] = hoch ? [A4.breite, A4.hoehe] : [A4.hoehe, A4.breite];
  const verhaeltnis = Math.max(breitePx, hoehePx) / Math.min(breitePx, hoehePx);
  if (Math.abs(verhaeltnis - Math.SQRT2) / Math.SQRT2 < 0.08) return { breite: kurz, hoehe: lang };
  const f = Math.min(kurz / breitePx, lang / hoehePx);
  return { breite: breitePx * f, hoehe: hoehePx * f };
}

export async function fotosAlsPdf(
  fotos: { jpeg: Uint8Array; breite: number; hoehe: number }[],
): Promise<Uint8Array> {
  return bilderAlsPdf(
    fotos.map((f) => {
      const s = seiteFuerFoto(f.breite, f.hoehe);
      return { jpeg: f.jpeg, breitePt: s.breite, hoehePt: s.hoehe };
    }),
  );
}

/** Lohnt „Kleiner machen“? Über 10 MB gesamt oder im Schnitt über 1 MB je Seite. */
export function verkleinernLohnt(bytes: number, seiten: number): boolean {
  return bytes > 10 * 1024 * 1024 || (seiten > 0 && bytes / seiten > 1024 * 1024);
}

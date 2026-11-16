import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

/** Eine Datei, wie Playwright sie als Inhalt an ein Dateifeld gibt. */
export interface Inhalt {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const ARTEN: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.heic': 'image/heic',
};

/**
 * Dateien als Inhalt statt als Pfad an ein Dateifeld geben. Mit einem Pfad liest WebKit die Datei selbst
 * von der Platte. Bei frisch geschriebenen Dateien (der öffentliche Ordner wird vor jedem Bau neu angelegt,
 * der Virenschutz prüft dann noch) scheiterte das zeitweise mit „Lässt sich nicht lesen“ (CP44). Node liest
 * die Datei hier selbst; das gelingt immer.
 */
export function alsInhalt(d: string | Inhalt): Inhalt;
export function alsInhalt(d: (string | Inhalt)[]): Inhalt[];
export function alsInhalt(d: string | Inhalt | (string | Inhalt)[]): Inhalt | Inhalt[] {
  if (Array.isArray(d)) return d.map((x) => alsInhalt(x));
  if (typeof d !== 'string') return d;
  return {
    name: basename(d),
    mimeType: ARTEN[extname(d).toLowerCase()] ?? 'application/octet-stream',
    buffer: readFileSync(d),
  };
}

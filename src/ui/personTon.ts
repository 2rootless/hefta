import { personenfarbe } from '../domain/personenfarben';

// DP39, Abschnitt 1.1: Jede Person hat ihre App-Farbe und den dunkleren Druckton der Mappe. Die Karte einer Person
// ist getönt: hell 30 % App-Farbe auf Weiß, dunkel 23 % App-Farbe auf #26221d. Die Werte stehen als
// CSS-Variablen an der Fläche (`--p-app`, `--p-druck`, `--p-hell`, `--p-dunkel`); `global.css` wählt je Thema
// `--p-tint` und `--p-linie` daraus.

function kanaele(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** `anteil` der Farbe auf dem Grund, als Hex. */
export function mischen(farbe: string, anteil: number, grund: string): string {
  const a = kanaele(farbe);
  const b = kanaele(grund);
  return `#${a
    .map((x, i) => Math.round(x * anteil + b[i]! * (1 - anteil)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

export interface PersonTon {
  app: string;
  druck: string;
  /** DP40: Farbe der Zeichen auf dunklem Grund. */
  nacht: string;
  hell: string;
  dunkel: string;
}

export function personTon(nummer: number): PersonTon {
  const f = personenfarbe(nummer);
  return {
    app: f.app,
    druck: f.druckton,
    nacht: f.dunkel,
    hell: mischen(f.app, 0.3, '#ffffff'),
    dunkel: mischen(f.app, 0.23, '#26221d'),
  };
}

/** Als `style`-Wert für eine Fläche mit der Klasse `person-ton`. */
export function tonStil(nummer: number): string {
  const t = personTon(nummer);
  return `--p-app:${t.app};--p-druck:${t.druck};--p-nacht:${t.nacht};--p-hell:${t.hell};--p-dunkel:${t.dunkel}`;
}

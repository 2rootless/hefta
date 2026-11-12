// Bewegung für Skripte (E58): Dauern und Kurven kommen aus den Tokens in design/tokens.css, wie in CSS.
// Bei „Bewegung reduzieren“ sind dort alle Dauern 0 ms außer dem Überblenden; Skripte fragen dieselbe
// Stelle. Keine Bibliothek: Web Animations API (`element.animate`) mit diesen Werten.

// Namen aus B21 (bewegung-tokens.md), Nachricht 11.11. a.
export type Dauer = 'knapp' | 'kurz' | 'mittel' | 'lang' | 'aufschlagen' | 'takt' | 'blende';
export type Kurve = 'ziel' | 'weich' | 'setzen' | 'gleich';

/** „Bewegung reduzieren“ ist an. Für Skripte, die nicht über die Tokens laufen (SVG-Animationen). */
export function bewegungReduziert(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function wert(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Dauer in Millisekunden aus dem Token, etwa `dauer('lang')` → 240 (bei „Bewegung reduzieren“ 0). */
export function dauer(name: Dauer): number {
  const w = wert(`--bw-${name}`);
  const zahl = parseFloat(w);
  if (Number.isNaN(zahl)) return 0;
  return w.endsWith('ms') ? zahl : zahl * 1000;
}

/** Kurve aus dem Token, für `easing` in `element.animate`. */
export function kurve(name: Kurve): string {
  return wert(`--bw-${name}`) || 'ease-out';
}

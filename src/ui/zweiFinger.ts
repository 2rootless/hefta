// Die Rechnung hinter dem Vergrößern mit zwei Fingern (SeitenAnsicht). Für sich, damit sie sich ohne
// iPhone prüfen lässt.

export interface Punkt {
  x: number;
  y: number;
}

export const GROESSTE_STUFE = 4;

export const abstand = (a: Punkt, b: Punkt) => Math.hypot(a.x - b.x, a.y - b.y);
export const mitte = (a: Punkt, b: Punkt): Punkt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** So viel größer, wie die Finger auseinandergehen; nicht kleiner als die ganze Seite. */
export function stufeNachGeste(
  start: number,
  abstandStart: number,
  abstandJetzt: number,
  kleinste: number,
): number {
  if (abstandStart <= 0) return start;
  return Math.min(GROESSTE_STUFE, Math.max(kleinste, (start * abstandJetzt) / abstandStart));
}

/** Wie groß die ganze Seite gerade wirklich ist: Passt sie nur in der Höhe, ist sie schmaler als die Fläche. */
export function ganzAnteil(
  flaecheBreite: number,
  flaecheHoehe: number,
  bildBreite: number,
  bildHoehe: number,
): number {
  if (!flaecheBreite || !flaecheHoehe || !bildBreite || !bildHoehe) return 1;
  return Math.min(1, (flaecheHoehe * bildBreite) / (flaecheBreite * bildHoehe));
}

/** Nah an einer Stufe rastet sie dort ein, damit die Knöpfe stimmen; sonst bleibt sie, wo sie ist. */
export function einrasten(stufe: number, stufen: readonly number[]): number {
  for (const s of stufen) if (Math.abs(stufe - s) < 0.12) return s;
  return Math.max(1, Math.round(stufe * 100) / 100);
}

/** Um wie viel gescrollt werden muss, damit derselbe Punkt der Seite unter den Fingern bleibt. */
export function scrollKorrektur(
  anteil: number,
  blattAnfang: number,
  blattLaenge: number,
  finger: number,
): number {
  return blattAnfang + anteil * blattLaenge - finger;
}

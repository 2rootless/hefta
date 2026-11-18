/**
 * Merkt, wo die Seite und offene Blätter stehen, bevor sich ein Vollbild öffnet. Der Aufruf des
 * Ergebnisses stellt es wieder her: Nach dem Schließen steht man, wo man war, nicht wieder ganz oben.
 */
export function scrollMerken(): () => void {
  const seite = window.scrollY;
  const innen = [...document.querySelectorAll('dialog[open], dialog[open] *')]
    .filter((e) => e.scrollTop > 0)
    .map((e) => ({ e, oben: e.scrollTop }));
  const setzen = () => {
    window.scrollTo(0, seite);
    for (const { e, oben } of innen) e.scrollTop = oben;
  };
  return () => {
    setzen();
    // iOS verschiebt noch einmal, wenn der Fokus zurückkommt.
    requestAnimationFrame(() => {
      setzen();
      requestAnimationFrame(setzen);
    });
  };
}

/** Was `stelleNachsetzen` vom Fenster braucht; im Test nachgestellt. */
export interface Fenster {
  readonly scrollY: number;
  scrollTo(x: number, y: number): void;
  requestAnimationFrame(f: () => void): unknown;
}

/**
 * Zurück an die Stelle, an der man war (PC29, A2). Die Seite baut sich erst auf; so lange setzt Hefta nach, höchstens
 * 40 Bilder. Hat inzwischen jemand anderes gescrollt, ein Finger oder ein Sprung zu einem Link, hört es auf und zieht
 * die Seite nicht zurück; sonst landete ein Tipp in diesem Moment woanders (PC111, Wackler „Backup mit Passwort“).
 */
export function stelleNachsetzen(ziel: number, w: Fenster = window): void {
  w.scrollTo(0, ziel);
  if (!ziel || Math.abs(w.scrollY - ziel) <= 1) return;
  let runden = 0;
  let zuletzt = w.scrollY;
  const nachsetzen = () => {
    if (Math.abs(w.scrollY - zuletzt) > 1) return;
    w.scrollTo(0, ziel);
    zuletzt = w.scrollY;
    if (Math.abs(zuletzt - ziel) > 1 && ++runden < 40) w.requestAnimationFrame(nachsetzen);
  };
  w.requestAnimationFrame(nachsetzen);
}

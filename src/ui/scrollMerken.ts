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

/**
 * Svelte-Aktion: Holt ein neu erscheinendes Element über die Tastatur. Mit offener Tastatur ist das
 * sichtbare Fenster kleiner als die Seite, darum zählt visualViewport (stil-c.md, „Karten mit Button“).
 */
export function ueberTastatur(element: HTMLElement) {
  requestAnimationFrame(() => {
    const fenster = window.visualViewport;
    const r = element.getBoundingClientRect();
    const unten = fenster ? fenster.offsetTop + fenster.height : window.innerHeight;
    const oben = fenster ? fenster.offsetTop : 0;
    const fehlt = Math.min(r.bottom - unten + 8, r.top - oben);
    if (r.bottom > unten - 8 && fehlt > 0) window.scrollBy(0, fehlt);
  });
}

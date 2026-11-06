// Svelte-Aktion: verkleinert die Schrift stufenweise, bis kein Wort mehr über den Rand ragt.
// Für Begrüßung (einzeilig), Titel und Namen (dürfen umbrechen, aber nie mitten im Wort).
// Passt auch die kleinste Stufe nicht (320 px mit Text 130 %): lieber umbrechen als abschneiden.

/** Stufen für große Titel, wie die Begrüßung. */
export const TITEL = ['34px/36px', '28px/30px', '24px/28px', '21px/25px'];

/** „34px“ in der Einheit der großen Schrift (design/stil-c.md). */
const schriftmass = (wert: string) => `calc(${parseFloat(wert)} * var(--px))`;

export function passend(element: HTMLElement, stufen: string[]) {
  const anpassen = () => {
    element.style.whiteSpace = '';
    element.style.overflowWrap = 'normal';
    for (const stufe of stufen) {
      const [groesse, zeile] = stufe.split('/') as [string, string];
      element.style.fontSize = schriftmass(groesse);
      element.style.lineHeight = schriftmass(zeile);
      if (element.scrollWidth <= element.clientWidth) return;
    }
    element.style.whiteSpace = 'normal';
    if (element.scrollWidth > element.clientWidth) element.style.overflowWrap = 'break-word';
  };
  const groesse = new ResizeObserver(anpassen);
  groesse.observe(element);
  // Auch wenn sich der Text ändert, neu messen.
  const text = new MutationObserver(anpassen);
  text.observe(element, { childList: true, characterData: true, subtree: true });
  void document.fonts?.ready.then(anpassen);
  anpassen();
  return {
    destroy: () => {
      groesse.disconnect();
      text.disconnect();
    },
  };
}

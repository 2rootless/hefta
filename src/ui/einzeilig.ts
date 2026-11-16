// Svelte-Aktion für Beschriftungen, die einzeilig bleiben sollen (C18), etwa im Hauptknopf: Passt der Text
// nicht in eine Zeile (320 px mit Text 130 %), wird die Schrift stufenweise kleiner, höchstens bis 80 %.
// Passt es dann noch nicht, darf er umbrechen; abgeschnitten wird nie.

const STUFEN = [1, 0.92, 0.86, 0.8];

export function einzeilig(element: HTMLElement) {
  const anpassen = () => {
    element.style.whiteSpace = 'nowrap';
    for (const stufe of STUFEN) {
      element.style.fontSize = stufe === 1 ? '' : `${stufe}em`;
      if (element.scrollWidth <= element.clientWidth + 1) return;
    }
    element.style.whiteSpace = 'normal';
  };
  const groesse = new ResizeObserver(anpassen);
  if (element.parentElement) groesse.observe(element.parentElement);
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

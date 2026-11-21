// PC153 (wackelnde Tests): Hefta lädt den Stand nach jeder Änderung neu, und manches lädt im Hintergrund. Zwei
// Ladevorgänge können sich überholen: Ein älterer, der die Daten vor der letzten Änderung gelesen hat, endet nach
// dem neueren und setzt den alten Stand zurück auf den Bildschirm. Der Tipp scheint dann verpufft, obwohl er
// gespeichert ist. Darum gilt: Übernommen wird nur das Ergebnis des zuletzt begonnenen Ladens. Ein älteres wartet
// auf das neueste, damit wer `await` sagt, danach den neuen Stand sieht.

/** Macht aus `lesen` und `uebernehmen` ein Laden, bei dem immer das zuletzt begonnene gewinnt. */
export function nurNeuestes<T>(
  lesen: () => Promise<T>,
  uebernehmen: (wert: T) => void,
): () => Promise<void> {
  let nummer = 0;
  let neuestes: Promise<void> = Promise.resolve();
  return () => {
    const nr = ++nummer;
    const lauf = (async () => {
      const wert = await lesen();
      if (nr === nummer) uebernehmen(wert);
      else await neuestes;
    })();
    neuestes = lauf;
    return lauf;
  };
}

/**
 * Lässt eine Aktion nur einmal zugleich laufen: Ein zweiter Tipp, während die erste noch
 * speichert, verfällt. Ohne das löschte ein Doppeltipp zweimal, und der zweite Lauf meldete
 * „Version nicht gefunden“ als unerwarteten Fehler.
 */
export function einmal<A extends unknown[]>(
  aktion: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  let laeuft = false;
  return async (...args: A) => {
    if (laeuft) return;
    laeuft = true;
    try {
      await aktion(...args);
    } finally {
      laeuft = false;
    }
  };
}

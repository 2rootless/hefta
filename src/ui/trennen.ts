// DP45 G5 (320 px mit 130 %): Lange Namen, die jemand selbst eingibt („Wohnungsgenossenschaft Muster eG“),
// bekommen weiche Trennstellen, aber nur an sicheren Wortfugen. Ein Wort wird nie an beliebiger Stelle
// gebrochen (Prüfkatalog C2); unbekannte lange Wörter bleiben, wie sie sind.

/** Wortteile, vor denen in langen Wörtern getrennt werden darf. */
const FUGEN = [
  'genossenschaft',
  'gesellschaft',
  'verwaltung',
  'immobilien',
  'wohnungen',
  'vermietung',
  'schaft',
];

/** Erst ab dieser Länge lohnt eine Trennstelle. */
const AB = 14;

export function weichTrennen(text: string): string {
  return text.replace(/\p{L}+/gu, (wort) => {
    if (wort.length < AB) return wort;
    const klein = wort.toLowerCase();
    const stellen = new Set<number>();
    for (const fuge of FUGEN) {
      let i = klein.indexOf(fuge, 1);
      while (i > 0) {
        // Kein Rest unter drei Buchstaben vorn oder hinten: „Ge-sellschaft“ wäre falsch.
        if (i >= 3 && wort.length - i >= 3) stellen.add(i);
        i = klein.indexOf(fuge, i + 1);
      }
    }
    if (!stellen.size) return wort;
    let aus = '';
    let von = 0;
    for (const i of [...stellen].sort((a, b) => a - b)) {
      aus += wort.slice(von, i) + '­';
      von = i;
    }
    return aus + wort.slice(von);
  });
}

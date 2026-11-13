// Lage ohne Server (E46, E50): Luftlinie zwischen den Mittelpunkten zweier Postleitzahlen, ehrlich als
// „ca.“. Die Tabelle (data/plz.de.json, GeoNames, CC BY 4.0) liegt in der App; keine Adresse geht hinaus.

/** Je Postleitzahl [Breite, Länge, Spanne in km]. */
export type PlzTabelle = Record<string, [number, number, number]>;

/** Die Postleitzahl aus einer Adresse im Format der Hefte („Lindenallee 3\n20259 Hamburg“). */
export function plzAus(text: string | null | undefined): string | null {
  const m = /(?:^|\D)(\d{5})(?=\s+\p{L})/u.exec(text ?? '');
  return m ? m[1]! : null;
}

export function luftlinieKm(a: [number, number], b: [number, number]): number {
  const r = 6371;
  const rad = Math.PI / 180;
  const dp = (b[0] - a[0]) * rad;
  const dl = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Lage der Wohnung zum eigenen Ort. Beides nach Postleitzahl, also ungefähr; die Spanne ist die der
 * Wohnung (die des Orts trägt der Wunsch selbst). Fehlt eine Postleitzahl in der Tabelle: null.
 */
export function lageAus(
  tabelle: PlzTabelle | null,
  wohnungPlz: string | null,
  ortPlz: string | null | undefined,
): { km: number; ungefaehr: true; spanne: number } | null {
  if (!tabelle || !wohnungPlz || !ortPlz) return null;
  const w = tabelle[wohnungPlz];
  const o = tabelle[ortPlz];
  if (!w || !o) return null;
  return { km: luftlinieKm([w[0], w[1]], [o[0], o[1]]), ungefaehr: true, spanne: w[2] };
}

/** Spanne des eigenen Orts, wenn er über die Postleitzahl bestimmt ist. */
export function ortSpanne(
  tabelle: PlzTabelle | null,
  plz: string | null | undefined,
): number | null {
  if (!tabelle || !plz) return null;
  return tabelle[plz]?.[2] ?? null;
}

/**
 * Setzt die Lage in Wohnung und Wunsch ein, bevor `urteile` rechnet: Luftlinie aus den Postleitzahlen von
 * Wohnung und eigenem Ort, beide ungefähr, mit ihren Spannen. Ohne Postleitzahl bleibt alles, wie es war.
 */
export function lageAnwenden<W extends { lage: unknown }>(
  w: W,
  adresse: string,
  wu: import('./urteile').Wuensche,
  tabelle: PlzTabelle | null,
): { w: W; wu: import('./urteile').Wuensche } {
  const ort = wu.ort;
  if (!ort?.plz || !tabelle) return { w, wu };
  const lage = lageAus(tabelle, plzAus(adresse), ort.plz);
  return {
    w: lage ? { ...w, lage } : w,
    wu: { ...wu, ort: { ...ort, ungefaehr: true, spanne: ortSpanne(tabelle, ort.plz) ?? 0 } },
  };
}

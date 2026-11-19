// PC126 K5 (DP83 a): Dateien, die Hefta beim Bauen der Mappe nicht öffnen konnte. Hat Hefta es einmal gemerkt, steht
// an der Unterlage „eine Datei lässt sich nicht öffnen“, und die Unterlage markiert die Datei. Gemerkt wird nur für
// diese Sitzung und nur die Kennung: Eine ausgetauschte Datei hat eine neue Kennung und gilt wieder als da.

const gemerkt = $state<{ ids: string[] }>({ ids: [] });

export function unlesbarMerken(ids: readonly (string | undefined)[]): void {
  const neu = ids.filter((id): id is string => !!id && !gemerkt.ids.includes(id));
  if (neu.length) gemerkt.ids = [...gemerkt.ids, ...neu];
}

/** Ließ sich diese Fassung (Original oder aufbereitete Datei) nicht öffnen? */
export function fassungUnlesbar(v: { original: string; aufbereitet?: string | null }): boolean {
  return (
    gemerkt.ids.includes(v.original) || (!!v.aufbereitet && gemerkt.ids.includes(v.aufbereitet))
  );
}

/** Ließ sich eine Datei der Unterlage nicht öffnen? */
export function unterlageUnlesbar(u: {
  versionen: readonly { original: string; aufbereitet?: string | null }[];
}): boolean {
  return u.versionen.some(fassungUnlesbar);
}

/** Nur für Tests. */
export function unlesbarVergessen(): void {
  gemerkt.ids = [];
}

// PC126 K5 (DP83 a, PC132): Dateien, die Hefta beim Bauen der Mappe nicht öffnen konnte. Hat Hefta es einmal gemerkt,
// steht an der Unterlage „eine Datei lässt sich nicht öffnen“, und die Unterlage markiert die Datei. Gemerkt wird nur die
// Kennung, auf dem Gerät (wie Farbschema und Marke), auch über einen Neustart: Eine ausgetauschte Datei hat eine neue
// Kennung und gilt wieder als da. Kein Inhalt, keine Angaben.

const SCHLUESSEL = 'hefta.unlesbar';

function laden(): string[] {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]') as unknown;
    return Array.isArray(roh) ? roh.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const gemerkt = $state<{ ids: string[] }>({
  ids: typeof localStorage === 'undefined' ? [] : laden(),
});

function sichern() {
  try {
    if (gemerkt.ids.length) localStorage.setItem(SCHLUESSEL, JSON.stringify(gemerkt.ids));
    else localStorage.removeItem(SCHLUESSEL);
  } catch {
    // Ohne Speicher gilt der Merker nur bis zum Neustart.
  }
}

export function unlesbarMerken(ids: readonly (string | undefined)[]): void {
  const neu = ids.filter((id): id is string => !!id && !gemerkt.ids.includes(id));
  if (!neu.length) return;
  gemerkt.ids = [...gemerkt.ids, ...neu];
  sichern();
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
  sichern();
}

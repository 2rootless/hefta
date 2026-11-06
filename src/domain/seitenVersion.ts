import type { DateiVersion } from './modell';

// Die Seiten einer Version (design/nachtraeglich-ordnen.md, Abschnitt 3). Reine Rechnung; gespeichert
// wird in speicher.ts. Nach jeder Änderung stehen `eigene` und `seiten` ausdrücklich da.

export const dateiVon = (v: Pick<DateiVersion, 'aufbereitet' | 'original'>) =>
  v.aufbereitet ?? v.original;

/**
 * Welche Seiten der Datei gehören zur Version. Ältere Versionen haben kein `eigene`: Teilen sie sich
 * die Datei mit anderen (aufgeteilt), sind es ihre ausgewählten Seiten, sonst die ganze Datei.
 */
export function eigeneSeiten(v: DateiVersion, gesamt: number, alle: DateiVersion[]): number[] {
  if (v.eigene?.length) return v.eigene;
  const geteilt = alle.some((x) => x.id !== v.id && dateiVon(x) === dateiVon(v));
  if (geteilt && v.seiten?.length) return v.seiten;
  return Array.from({ length: gesamt }, (_, i) => i);
}

export const kommtInMappe = (v: Pick<DateiVersion, 'seiten'>, seite: number) =>
  !v.seiten?.length || v.seiten.includes(seite);

/** „Nicht in die Mappe“ bzw. „In die Mappe“. Die letzte Seite in der Mappe bleibt: siehe `letzteInMappe`. */
export function seiteUmschalten(v: DateiVersion, eigene: number[], seite: number): DateiVersion {
  const drin = eigene.filter((s) => kommtInMappe(v, s));
  const seiten = drin.includes(seite)
    ? drin.filter((s) => s !== seite)
    : eigene.filter((s) => s === seite || drin.includes(s));
  return { ...v, eigene, seiten };
}

export function letzteInMappe(v: DateiVersion, eigene: number[], seite: number): boolean {
  const drin = eigene.filter((s) => kommtInMappe(v, s));
  return drin.length === 1 && drin[0] === seite;
}

/**
 * Nimmt eine Seite aus der Version. Ohne Seite gibt es die Version nicht mehr (null). War es die letzte
 * in der Mappe, kommen die übrigen hinein: Eine Version ohne Seite in der Mappe gibt es nicht.
 */
export function seiteHeraus(v: DateiVersion, eigene: number[], seite: number): DateiVersion | null {
  const rest = eigene.filter((s) => s !== seite);
  if (!rest.length) return null;
  const drin = rest.filter((s) => kommtInMappe(v, s));
  return { ...v, eigene: rest, seiten: drin.length ? drin : rest };
}

/** Nimmt eine Seite derselben Datei dazu. Die Reihenfolge bleibt wie in der Datei. */
export function seiteHinein(v: DateiVersion, eigene: number[], seite: number): DateiVersion {
  const drin = eigene.filter((s) => kommtInMappe(v, s));
  return {
    ...v,
    eigene: [...new Set([...eigene, seite])].sort((a, b) => a - b),
    seiten: [...new Set([...drin, seite])].sort((a, b) => a - b),
  };
}

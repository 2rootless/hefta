import type { DateiVersion } from './modell';
import { dateiVon } from './seitenVersion';

// Eine Datei, mehrere Monate (design/nachtraeglich-ordnen.md, Abschnitt 2): Jede Seite gehört zu
// einem Monat. Dieselbe Datei in jedem Monat hieße: alle Seiten mehrfach in der Mappe.

function ueberschneiden(a: DateiVersion, b: DateiVersion): boolean {
  if (!a.seiten?.length || !b.seiten?.length) return true;
  return a.seiten.some((s) => b.seiten!.includes(s));
}

/** Dieselbe Datei, auch wenn sie zweimal hochgeladen wurde: gleicher Inhalt, gleiche Prüfsumme. */
export const dateiSchluessel = (v: DateiVersion) => v.erkannteWerte?.hash ?? dateiVon(v);

/** Versionen, die sich dieselben Seiten derselben Datei teilen. Leer, wenn alles passt. */
export function dieselbeDatei(versionen: DateiVersion[]): DateiVersion[] {
  for (const v of versionen) {
    const gruppe = versionen.filter((x) => dateiSchluessel(x) === dateiSchluessel(v));
    if (gruppe.length > 1 && gruppe.some((x) => x !== v && ueberschneiden(x, v))) return gruppe;
  }
  return [];
}

/**
 * Monat je Seite aus dem, was auf den Seiten steht. Eine Seite ohne Datum gehört zur Seite davor
 * (Folgeseite). Steht nirgends etwas, der Reihe nach, die erste Seite als ältester Monat.
 */
export function monateVorbelegen(funde: (string | null)[], monate: string[]): string[] {
  const aufsteigend = [...monate].sort();
  if (funde.every((f) => !f)) return funde.map((_, i) => aufsteigend[i] ?? '');
  const erster = funde.find(Boolean)!;
  let zuletzt = erster;
  return funde.map((f) => (zuletzt = f ?? zuletzt));
}

/**
 * Monat je Seite beim Hochladen: was auf der Seite steht. Sonst aus dem Dateinamen, wenn er genau so viele
 * Monate nennt, wie die Datei Seiten hat. Sonst wie die Seite davor (Folgeseite) oder die Vorgabe.
 */
export function seitenVorbelegen(
  funde: (string | null)[],
  ausName: string[],
  vorgabe: string,
): string[] {
  const nachName = ausName.length === funde.length ? ausName : null;
  let zuletzt = funde.find(Boolean) ?? ausName[0] ?? vorgabe;
  return funde.map((fund, i) => {
    zuletzt = fund ?? nachName?.[i] ?? zuletzt;
    return zuletzt;
  });
}

/** Seiten je Monat; leere Zuordnung heißt „Nicht in die Mappe“. */
export function seitenJeMonat(werte: string[]): { monat: string; seiten: number[] }[] {
  const je = new Map<string, number[]>();
  werte.forEach((monat, seite) => {
    if (monat) je.set(monat, [...(je.get(monat) ?? []), seite]);
  });
  return [...je].map(([monat, seiten]) => ({ monat, seiten }));
}

/**
 * Was von einer Serie in die Mappe kommt. Monate mit denselben Seiten derselben Datei kommen einmal,
 * mit allen Monaten im Kopfband. Aufgeteilte Monate behalten je ihre eigenen Seiten.
 */
export function serienQuellen(
  versionen: DateiVersion[],
): { id: string; monate: string[]; seiten: number[] | null }[] {
  const je = new Map<string, { id: string; monate: string[]; seiten: number[] | null }>();
  for (const v of versionen) {
    const id = dateiVon(v);
    const schluessel = `${dateiSchluessel(v)}|${v.seiten?.join(',') ?? 'alle'}`;
    const eintrag = je.get(schluessel) ?? { id, monate: [], seiten: v.seiten };
    if (v.abrechnungsmonat) eintrag.monate.push(v.abrechnungsmonat);
    je.set(schluessel, eintrag);
  }
  return [...je.values()];
}

// Wo ein Name auf einer Seite steht (RU4, DP39 1.4): für die Vorschau, auf der der Name einer anderen
// Person wie mit Textmarker markiert ist. Rechnet ohne Browser-APIs, damit es testbar ist.
import { zeilenAus, type TextStueck } from './datumErkennen';

/** Lage auf der Seite, 0 bis 1, y von oben. */
export interface Stelle {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

const klein = (s: string) => s.toLowerCase();
/** Höchstens so viele Zeichen zwischen Vor- und Nachname („Lea Mustermann“, „Mustermann, Lea“). */
const ABSTAND = 3;

/**
 * Die erste Stelle, an der der Nachname steht, mit dem Vornamen direkt davor oder danach. Steht der
 * Vorname nicht daneben, ist nur der Nachname markiert. Null, wenn der Nachname nicht vorkommt.
 */
export function nameFinden(
  stuecke: TextStueck[],
  vorname: string,
  nachname: string,
  /** Breite eines Texts in beliebiger Einheit; ohne sind alle Zeichen gleich breit. */
  messen: (text: string) => number = (text) => text.length,
): Stelle | null {
  const nach = klein(nachname.trim());
  if (!nach) return null;
  const vor = klein(vorname.trim().split(/\s+/)[0] ?? '');
  for (const zeile of zeilenAus(stuecke)) {
    const text = klein(zeile.text);
    // Kleinschreibung darf die Länge nicht ändern, sonst passen die Stellen nicht mehr.
    if (text.length !== zeile.text.length) continue;
    let start = text.indexOf(nach);
    if (start < 0) continue;
    let ende = start + nach.length;
    if (vor) {
      const davor = text.lastIndexOf(vor, start - 1);
      const danach = text.indexOf(vor, ende);
      if (davor >= 0 && start - (davor + vor.length) <= ABSTAND) start = davor;
      else if (danach >= 0 && danach - ende <= ABSTAND) ende = danach + vor.length;
    }
    return stelleAus(zeile.herkunft.slice(start, ende), messen);
  }
  return null;
}

/**
 * PC64, Punkt 4: der eigene Name der Person auf ihrer Unterlage, zum Hinterlegen wie mit Textmarker. Anders
 * als bei `nameFinden` zählt nur der volle Name, Vorname direkt vor oder nach dem Nachnamen: Bei einer
 * Bürgin mit demselben Nachnamen wie der Hauptmieter darf sein Name nicht wie ihrer aussehen.
 */
export function vollerNameFinden(
  stuecke: TextStueck[],
  vorname: string,
  nachname: string,
  messen: (text: string) => number = (text) => text.length,
): Stelle | null {
  const nach = klein(nachname.trim());
  const vor = klein(vorname.trim().split(/\s+/)[0] ?? '');
  if (!nach || !vor) return null;
  for (const zeile of zeilenAus(stuecke)) {
    const text = klein(zeile.text);
    if (text.length !== zeile.text.length) continue;
    for (let start = text.indexOf(nach); start >= 0; start = text.indexOf(nach, start + 1)) {
      const ende = start + nach.length;
      const davor = text.lastIndexOf(vor, start - 1);
      const danach = text.indexOf(vor, ende);
      const wortGrenze = (i: number) => i < 0 || i >= text.length || !/\p{L}/u.test(text[i]!);
      if (davor >= 0 && start - (davor + vor.length) <= ABSTAND && wortGrenze(davor - 1))
        return stelleAus(zeile.herkunft.slice(davor, ende), messen);
      if (danach >= 0 && danach - ende <= ABSTAND && wortGrenze(danach + vor.length))
        return stelleAus(zeile.herkunft.slice(start, danach + vor.length), messen);
    }
  }
  return null;
}

/** Die Fläche der Zeichen; in einem Stück teilt sich die Breite nach der gemessenen Breite der Zeichen. */
export function stelleAus(
  zeichen: { stueck: TextStueck; stelle: number }[],
  messen: (text: string) => number,
): Stelle | null {
  if (!zeichen.length) return null;
  let links = 1;
  let rechts = 0;
  let oben = 1;
  let unten = 0;
  for (const { stueck: s, stelle } of zeichen) {
    const ganz = messen(s.text) || 1;
    const bis = (n: number) => s.x + (s.breite * messen(s.text.slice(0, n))) / ganz;
    links = Math.min(links, bis(stelle));
    rechts = Math.max(rechts, bis(stelle + 1));
    oben = Math.min(oben, s.y);
    unten = Math.max(unten, s.y + s.hoehe);
  }
  return { x: links, y: oben, breite: rechts - links, hoehe: unten - oben };
}

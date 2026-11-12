// Bewegung im Tab „Mappe“ (B21): Was hat sich seit dem letzten Blick geändert? Der Tab merkt sich, wie
// er zuletzt aussah, und vergleicht beim nächsten Zeigen. Gemerkt wird nur im Speicher der laufenden
// App, nicht auf dem Gerät: Nach einem Neustart gibt es keinen Vergleich und keine Bewegung. Nichts
// wartet auf die Bewegung, und kein Inhalt steckt nur in ihr.

/** Stand einer Zeile im Blatt der Person, wie `PersonBlatt` ihn zeigt. */
export type ZeilenArt = 'da' | 'fehlt' | 'bald' | 'pruef';

export interface Blick<P = unknown, A = unknown> {
  /** Personen in der Reihenfolge der Blätter, mit dem, was ein Blatt zum Zeichnen braucht. */
  personen: { id: string; daten: P }[];
  /** Stand je Zeile, Schlüssel „Person/Typ“. */
  zeilen: Map<string, ZeilenArt>;
  /** Aufgaben oben, Schlüssel „Person/Typ“, in ihrer Reihenfolge. */
  aufgaben: { schluessel: string; daten: A }[];
  offen: number;
  /** Alles da und kein Prüfhinweis offen: Dann gibt es den Moment „Alles da“. */
  startklar: boolean;
  /** Der Satz oben (Aufgaben oder Kasten „Alles da“). */
  satz: string;
}

export interface Wechsel<P = unknown, A = unknown> {
  /** Zählt mit, damit die Stelle weiß, wann ihre Bewegung vorbei ist. */
  nr: number;
  /** Zeilen, deren Unterlage angekommen ist (Ring oder Marke wird Haken). */
  kam: Set<string>;
  /** Zeilen mit neuem Prüfhinweis. */
  pruef: Set<string>;
  neuePersonen: Set<string>;
  /** Blätter, die gehen, mit ihrem alten Platz (Index unter den Blättern davor). */
  wegPersonen: { id: string; daten: P; platz: number }[];
  neueAufgaben: Set<string>;
  wegAufgaben: { schluessel: string; daten: A; platz: number }[];
  startklar: boolean;
  zahl: boolean;
  satz: boolean;
}

/** Höchstens so viele Zeilen bewegen sich auf einmal (B21: bei mehr nur Zahl und Satz). */
export const ZEILEN_HOECHSTENS = 3;

let laufend = 0;

export function keinWechsel<P, A>(): Wechsel<P, A> {
  return {
    nr: 0,
    kam: new Set(),
    pruef: new Set(),
    neuePersonen: new Set(),
    wegPersonen: [],
    neueAufgaben: new Set(),
    wegAufgaben: [],
    startklar: false,
    zahl: false,
    satz: false,
  };
}

export function wechselVon<P, A>(vorher: Blick<P, A> | null, jetzt: Blick<P, A>): Wechsel<P, A> {
  const w = keinWechsel<P, A>();
  if (!vorher) return w;
  const vorherIds = new Set(vorher.personen.map((p) => p.id));
  const jetztIds = new Set(jetzt.personen.map((p) => p.id));

  for (const [schluessel, art] of jetzt.zeilen) {
    const alt = vorher.zeilen.get(schluessel);
    if (!alt || !vorherIds.has(schluessel.split('/')[0]!)) continue;
    if (art === 'pruef' && alt !== 'pruef') w.pruef.add(schluessel);
    else if (art === 'da' && (alt === 'fehlt' || alt === 'bald')) w.kam.add(schluessel);
  }
  if (w.kam.size + w.pruef.size > ZEILEN_HOECHSTENS) {
    w.kam.clear();
    w.pruef.clear();
  }

  for (const id of jetztIds) if (!vorherIds.has(id)) w.neuePersonen.add(id);
  vorher.personen.forEach((p, platz) => {
    if (!jetztIds.has(p.id)) w.wegPersonen.push({ ...p, platz });
  });

  const vorherAufgaben = new Set(vorher.aufgaben.map((a) => a.schluessel));
  const jetztAufgaben = new Set(jetzt.aufgaben.map((a) => a.schluessel));
  for (const a of jetzt.aufgaben)
    if (!vorherAufgaben.has(a.schluessel)) w.neueAufgaben.add(a.schluessel);
  vorher.aufgaben.forEach((a, platz) => {
    if (!jetztAufgaben.has(a.schluessel)) w.wegAufgaben.push({ ...a, platz });
  });

  w.startklar = jetzt.startklar && !vorher.startklar;
  w.zahl = jetzt.offen !== vorher.offen;
  w.satz = jetzt.satz !== vorher.satz;
  const etwas =
    w.kam.size ||
    w.pruef.size ||
    w.neuePersonen.size ||
    w.wegPersonen.length ||
    w.neueAufgaben.size ||
    w.wegAufgaben.length ||
    w.startklar ||
    w.zahl ||
    w.satz;
  if (etwas) w.nr = ++laufend;
  return w;
}

/**
 * Fügt, was geht, an seinem alten Platz wieder ein, damit es dort ausblenden und seinen Platz schließen
 * kann. `geist: true` markiert es.
 */
export function mitGeistern<T>(
  liste: T[],
  weg: { platz: number; daten: T }[],
): { wert: T; geist: boolean }[] {
  const ergebnis = liste.map((wert) => ({ wert, geist: false }));
  for (const w of [...weg].sort((a, b) => a.platz - b.platz))
    ergebnis.splice(Math.min(w.platz, ergebnis.length), 0, { wert: w.daten, geist: true });
  return ergebnis;
}

/** Der letzte Blick auf den Tab, für die laufende App. */
let letzter: Blick | null = null;
let letzterHaushalt: string | null = null;

export function letzterBlick<P, A>(haushalt: string): Blick<P, A> | null {
  return letzterHaushalt === haushalt ? (letzter as Blick<P, A> | null) : null;
}

export function blickMerken(haushalt: string, blick: Blick): void {
  letzter = blick;
  letzterHaushalt = haushalt;
}

// Kleiner Hash-Router: wenige Bildschirme, keine Server-Routen nötig.
//
// Dazu ein eigener Verlauf über dem des Browsers. Damit weiß „Zurück“ oben links, wohin die Wischgeste
// ginge, und beide tun dasselbe. Ein Schritt, der abgeschlossen ist (gespeichert, gelöscht, eingespielt),
// verschwindet aus dem Weg zurück: Man kommt nicht in einen Bildschirm, den es so nicht mehr gibt.

function aktuell(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

const SPEICHER = 'hefta-verlauf';

interface Verlauf {
  stapel: string[];
  stelle: number;
}

function verlaufLaden(): Verlauf {
  const pfad = aktuell();
  const stelle = (history.state as { stelle?: unknown } | null)?.stelle;
  try {
    const gemerkt = JSON.parse(sessionStorage.getItem(SPEICHER) ?? 'null') as string[] | null;
    // Neu geladen an derselben Stelle: Der Verlauf gilt noch.
    if (typeof stelle === 'number' && Array.isArray(gemerkt) && gemerkt[stelle] === pfad) {
      return { stapel: gemerkt, stelle };
    }
  } catch {
    // Privates Surfen kann das verbieten; dann beginnt der Verlauf hier.
  }
  history.replaceState({ stelle: 0 }, '');
  return { stapel: [pfad], stelle: 0 };
}

const verlauf = verlaufLaden();

function verlaufMerken(): void {
  try {
    sessionStorage.setItem(SPEICHER, JSON.stringify(verlauf.stapel));
  } catch {
    // siehe oben
  }
}

export const route = $state<{
  pfad: string;
  /** Wohin „Zurück“ führt; null auf der ersten Seite. */
  vorher: string | null;
  /** Beim Zurückgehen: wo man auf der Seite war. */
  scrollZiel: number;
  /** Der Pfad vor diesem Wechsel und die Richtung, für die Bewegung beim Wechsel (Design 12.11.). */
  von: string | null;
  richtung: 'vor' | 'zurueck' | 'ersetzt' | null;
}>({
  pfad: aktuell(),
  vorher: verlauf.stapel[verlauf.stelle - 1] ?? null,
  scrollZiel: 0,
  von: null,
  richtung: null,
});

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur Buchführung, nichts zeichnet danach.
const scrollStand = new Map<number, number>();
let naechsterErsetzt = false;
/** Was nach dem Sprung im Verlauf folgt, der Reihe nach: ersetzt oder als neuer Schritt. */
const danach: { pfad: string; ersetzt: boolean }[] = [];

window.addEventListener('hashchange', () => {
  const pfad = aktuell();
  const alt = verlauf.stelle;
  const vonPfad = route.pfad;
  let richtung: 'vor' | 'zurueck' | 'ersetzt' = 'vor';
  const stelle = (history.state as { stelle?: unknown } | null)?.stelle;
  // Die Seite steht noch: Ihre Höhe gilt für die Rückkehr.
  scrollStand.set(alt, window.scrollY);
  if (naechsterErsetzt) {
    naechsterErsetzt = false;
    richtung = 'ersetzt';
    verlauf.stapel[alt] = pfad;
    history.replaceState({ stelle: alt }, '');
  } else if (typeof stelle === 'number') {
    richtung = stelle < alt ? 'zurueck' : 'vor';
    verlauf.stelle = stelle;
    verlauf.stapel[stelle] = pfad;
  } else {
    verlauf.stelle = alt + 1;
    verlauf.stapel.length = verlauf.stelle;
    verlauf.stapel.push(pfad);
    history.replaceState({ stelle: verlauf.stelle }, '');
  }
  verlaufMerken();
  // Unterwegs zum nächsten Ablauf (neuAnfangen): Die Zwischenstation zeigt sich nicht.
  const weiter = danach.shift();
  if (weiter) {
    if (weiter.ersetzt) {
      naechsterErsetzt = true;
      window.location.replace(`#${weiter.pfad}`);
    } else window.location.hash = weiter.pfad;
    return;
  }
  route.scrollZiel = verlauf.stelle < alt ? (scrollStand.get(verlauf.stelle) ?? 0) : 0;
  route.vorher = verlauf.stapel[verlauf.stelle - 1] ?? null;
  route.von = vonPfad;
  route.richtung = richtung;
  route.pfad = pfad;
});

verlaufMerken();

/** Ein Schritt vorwärts. */
export function gehe(pfad: string): void {
  window.location.hash = pfad;
}

/** Ersetzt die Seite: Sie steht danach nicht mehr im Weg zurück. */
export function ersetzen(pfad: string): void {
  if (pfad === aktuell()) return;
  naechsterErsetzt = true;
  window.location.replace(`#${pfad}`);
}

/** Wie die Wischgeste: eine Stelle zurück. Ohne Verlauf (direkt geöffnet) zur übergeordneten Seite. */
export function zurueckGehen(oben: string): void {
  if (verlauf.stelle > 0) history.back();
  else ersetzen(oben);
}

/**
 * Ein Ablauf ist fertig, der nächste beginnt (Einrichtung, dann Unterlagen): `pfad` kommt direkt hinter
 * die erste Seite. In den fertigen Ablauf führt kein Weg zurück.
 */
export function neuAnfangen(pfad: string): void {
  if (verlauf.stelle === 0) {
    gehe(pfad);
    return;
  }
  danach.push({ pfad, ersetzt: false });
  history.go(-verlauf.stelle);
}

/**
 * Nach einem abgeschlossenen Schritt: zurück zu `ziel`, und alles dazwischen ist aus dem Weg.
 * Steht `ziel` nicht im Verlauf, ersetzt es die Seite.
 */
export function abschliessen(ziel: string): void {
  if (ziel === aktuell()) return;
  const stelle = verlauf.stapel.lastIndexOf(ziel, verlauf.stelle - 1);
  if (verlauf.stelle > 0 && stelle >= 0) history.go(stelle - verlauf.stelle);
  else ersetzen(ziel);
}

/**
 * Ein Ablauf endet mit einer neuen Seite (Neues Heft → das Heft): zurück zu `ziel`, alles dazwischen ist
 * aus dem Weg, dann `pfad` dahinter. „Zurück“ im Heft führt so zu `ziel`, nicht in den Ablauf.
 */
export function abschliessenMit(ziel: string, pfad: string, ablauf?: string): void {
  const stelle = verlauf.stapel.lastIndexOf(ziel, verlauf.stelle - 1);
  if (verlauf.stelle > 0 && stelle >= 0) {
    danach.push({ pfad, ersetzt: false });
    history.go(stelle - verlauf.stelle);
    return;
  }
  // `ziel` liegt nicht im Verlauf (Ablauf von der Übersicht oder aus dem Teilen begonnen): zurück vor
  // den Ablauf, dessen Seiten mit `ablauf` beginnen. Sonst bliebe der Ablauf im Weg zurück.
  let anfang = verlauf.stelle;
  while (ablauf && anfang > 0 && verlauf.stapel[anfang - 1]!.startsWith(ablauf)) anfang--;
  if (!ablauf || anfang === verlauf.stelle) {
    ersetzen(pfad);
    return;
  }
  // Begann der Ablauf ganz vorn, tritt `ziel` an seine Stelle.
  if (anfang === 0) danach.push({ pfad: ziel, ersetzt: true });
  danach.push({ pfad, ersetzt: false });
  history.go((anfang === 0 ? 0 : anfang - 1) - verlauf.stelle);
}

/**
 * Wechsel des Reiters (Auftraggeber 13.11., Regel 1): Reiter sind Wurzeln. Der Verlauf beginnt mit dem
 * neuen Reiter, statt länger zu werden; so führen Zurück und Wischen nicht von Reiter zu Reiter und durch
 * alles, was vorher offen war.
 */
export function reiterWechseln(pfad: string): void {
  if (pfad === aktuell() && verlauf.stelle === 0) return;
  if (verlauf.stelle === 0) {
    ersetzen(pfad);
    return;
  }
  // Steht der Reiter schon am Anfang, genügt der Sprung dorthin.
  if (verlauf.stapel[0] !== pfad) danach.push({ pfad, ersetzt: true });
  history.go(-verlauf.stelle);
}

/** Der erste Eintrag im Verlauf: seit Regel 1 der Reiter, aus dem man kam. */
export function verlaufsAnfang(): string {
  return verlauf.stapel[0] ?? '/';
}

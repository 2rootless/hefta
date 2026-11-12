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
}>({
  pfad: aktuell(),
  vorher: verlauf.stapel[verlauf.stelle - 1] ?? null,
  scrollZiel: 0,
});

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur Buchführung, nichts zeichnet danach.
const scrollStand = new Map<number, number>();
let naechsterErsetzt = false;
let danach: string | null = null;

window.addEventListener('hashchange', () => {
  const pfad = aktuell();
  const alt = verlauf.stelle;
  const stelle = (history.state as { stelle?: unknown } | null)?.stelle;
  // Die Seite steht noch: Ihre Höhe gilt für die Rückkehr.
  scrollStand.set(alt, window.scrollY);
  if (naechsterErsetzt) {
    naechsterErsetzt = false;
    verlauf.stapel[alt] = pfad;
    history.replaceState({ stelle: alt }, '');
  } else if (typeof stelle === 'number') {
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
  if (danach) {
    const weiter = danach;
    danach = null;
    window.location.hash = weiter;
    return;
  }
  route.scrollZiel = verlauf.stelle < alt ? (scrollStand.get(verlauf.stelle) ?? 0) : 0;
  route.vorher = verlauf.stapel[verlauf.stelle - 1] ?? null;
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
  danach = pfad;
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
export function abschliessenMit(ziel: string, pfad: string): void {
  const stelle = verlauf.stapel.lastIndexOf(ziel, verlauf.stelle - 1);
  if (verlauf.stelle > 0 && stelle >= 0) {
    danach = pfad;
    history.go(stelle - verlauf.stelle);
  } else ersetzen(pfad);
}

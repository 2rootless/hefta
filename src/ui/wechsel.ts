// Bewegung beim Wechsel der Bildschirme von Hefta 2 (Design 12.11., Abschnitt 1; Regeln aus B18 und B21):
// höchstens 300 ms, Füllmodus `backwards`, nichts läuft von selbst; mit „Bewegung reduzieren“ nur
// `bw-blende`. Alle übrigen Bildschirme blenden wie bisher nur über (`einblenden`).

export type Wechsel =
  /** Übersicht → Neues Heft: `bw-folgen`, `aufschlagen`, `ziel` (B23 Fassung 3). */
  | 'folgen'
  /** Neues Heft → Vorschau: `bw-blende`, `kurz`, `weich`; die Platzhalter stehen sofort. */
  | 'blende-kurz'
  /** Vorschau → Kontrolle: der Kopf steht, die Gruppen folgen in der Kontrolle selbst (`werte`). */
  | 'werte'
  /** Öffnen eines Hefts: das Scharnier am Umschlag (`auf`, B21), im Heft selbst. */
  | 'heft'
  /** Zurück, „Abbrechen“, „Anderer Link“: `bw-zurueck`, `mittel`, `ziel` (wie `zu` aus B18). */
  | 'zurueck'
  /** alles andere: kurz überblenden wie bisher */
  | 'einblenden';

const HEFTA_2 = /^\/(wohnungen|wohnung-neu|heft|wuensche)(\/|$)/;

export function wechselArt(
  von: string | null,
  nach: string,
  richtung: 'vor' | 'zurueck' | 'ersetzt' | null,
): Wechsel {
  if (!von || !(HEFTA_2.test(nach) || HEFTA_2.test(von))) return 'einblenden';
  if (richtung === 'zurueck') return 'zurueck';
  if (/^\/heft\/[\w-]+$/.test(nach)) return 'heft';
  if (nach === '/wohnung-neu/kontrolle') return 'werte';
  if (nach === '/wohnung-neu/vorschau') return 'blende-kurz';
  if (nach === '/wohnung-neu' && von === '/wohnungen') return 'folgen';
  return 'einblenden';
}

/** Wie lange der Wechsel dauert, als Token: Der Knopf von iOS erscheint erst, wenn der Bildschirm steht. */
export function wechselDauerToken(w: Wechsel): string {
  return w === 'folgen' ? '--bw-aufschlagen' : w === 'zurueck' ? '--bw-mittel' : '--bw-kurz';
}

/** Längster Wechsel samt Takt, mit Luft: danach ist jede Bewegung des Wechsels vorbei. */
export const WECHSEL_HOECHSTENS_MS = 900;

/**
 * PC8 A5: Die Bewegungen des Wechsels halten den Bildschirm bis zu ihrem Start unsichtbar (`backwards`).
 * Bleibt WebKit dort stehen, etwa nach der Rückkehr aus einer anderen App, blieb der Inhalt weg. Darum
 * nimmt diese Aktion die Klasse des Wechsels nach seiner Dauer sicher ab, und sofort, wenn die Seite
 * wieder sichtbar wird.
 */
export function wechselEnde(knoten: HTMLElement): { destroy(): void } {
  const ende = () => {
    if (knoten.className) knoten.className = '';
  };
  const uhr = setTimeout(ende, WECHSEL_HOECHSTENS_MS);
  document.addEventListener('visibilitychange', ende);
  return {
    destroy() {
      clearTimeout(uhr);
      document.removeEventListener('visibilitychange', ende);
    },
  };
}

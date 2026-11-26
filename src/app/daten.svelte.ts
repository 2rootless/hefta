import type { Einstellungen, Heft } from '../domain/modell';
import { markeSetzen } from './marke';
import { nurNeuestes } from './neuestes';
import { rueckgaengigVergessen } from './rueckgaengig.svelte';
import { datenbankOeffnen, type HeftaDb } from '../storage/db';
import {
  einstellungenLaden,
  haushaltLaden,
  telefoneUmsetzen,
  hefteLaden,
  hefteAusVersion1EinordnenEinmal,
  type HaushaltAnsicht,
} from '../storage/speicher';
import { ohneHaushaltLaden } from '../storage/ohneHaushalt';

// Geladener Stand für die Oberfläche. Nach jeder Änderung `neuLaden()` aufrufen.

let verbindung: Promise<HeftaDb> | null = null;

export const daten = $state<{
  geladen: boolean;
  ansicht: HaushaltAnsicht | null;
  /** PC214 (Weg A): Personen ohne Haushalt, wie ein Haushalt geladen; null, wenn es keine gibt. Nie aktiv. */
  ohne: HaushaltAnsicht | null;
  einstellungen: Einstellungen | null;
  /** Hefte des Haushalts und die ohne Haushalt (Hefta 2). */
  hefte: Heft[];
  /** Speicher nicht erreichbar, oder ein anderer Tab mit neuerer Version braucht ihn. */
  fehler: 'speicher' | 'andererTab' | null;
}>({ geladen: false, ansicht: null, ohne: null, einstellungen: null, hefte: [], fehler: null });

function vergessen(): void {
  const alt = verbindung;
  verbindung = null;
  void alt?.then((v) => v.close()).catch(() => {});
}

export function db(): Promise<HeftaDb> {
  verbindung ??= datenbankOeffnen(undefined, undefined, {
    // Eine neuere Version in einem anderen Tab will umbauen: hier freigeben, dann neu laden lassen.
    blocking: () => {
      vergessen();
      daten.fehler = 'andererTab';
    },
    // Safari beendet Verbindungen manchmal, wenn die App im Hintergrund war: neu öffnen.
    terminated: () => {
      verbindung = null;
    },
  }).catch((e: unknown) => {
    verbindung = null;
    throw e;
  });
  return verbindung;
}

/** Fehler, nach denen eine frische Verbindung meist hilft (Verbindung im Hintergrund verloren). */
function verbindungVerloren(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'InvalidStateError' || e.name === 'UnknownError' || e.name === 'AbortError')
  );
}

let telefoneGeprueft = false;

async function lesen() {
  const verbindung = await db();
  if (!daten.einstellungen?.version1Eingeordnet) await hefteAusVersion1EinordnenEinmal(verbindung);
  // W57: Die Prüfung der hauptmietenden Person je Start (PC102) fällt weg; die Ansprechperson ergibt sich beim Laden.
  // E222 (DP77, Abschnitt 5): einmal je Start; ein eingespieltes Backup setzt `sicherungEinspielen` selbst um.
  // Nicht bei jedem Laden: Die Schreibtransaktion nach jedem Speichern verzögerte das Neuzeichnen (NN8, WebKit).
  if (!telefoneGeprueft) {
    await telefoneUmsetzen(verbindung);
    telefoneGeprueft = true;
  }
  const einstellungen = await einstellungenLaden(verbindung);
  const ansicht = await haushaltLaden(verbindung, einstellungen.aktiverHaushalt);
  const hefte = await hefteLaden(verbindung, ansicht?.haushalt.id ?? null);
  const ohne = await ohneHaushaltLaden(verbindung);
  return { einstellungen, ansicht, hefte, ohne };
}

function uebernehmen({
  einstellungen,
  ansicht,
  hefte,
  ohne,
}: Awaited<ReturnType<typeof lesen>>): void {
  daten.ansicht = ansicht;
  daten.ohne = ohne;
  daten.hefte = hefte;
  daten.einstellungen = einstellungen;
  daten.geladen = true;
  daten.fehler = null;
  markeSetzen(!!ansicht);
  // Erinnerungen folgen dem Stand (nur in der App unter iOS); ein Fehler dort stört das Laden nicht.
  void import('./erinnerungen.svelte')
    .then((m) => m.erinnerungenAbgleichen({ hefte, ansicht, einstellungen }))
    .catch(() => {});
}

// Überholen sich zwei Ladevorgänge, gewinnt das zuletzt begonnene (src/app/neuestes.ts).
const laden = nurNeuestes(lesen, uebernehmen);

export async function neuLaden(): Promise<void> {
  rueckgaengigVergessen();
  try {
    await laden();
  } catch (e) {
    if (verbindungVerloren(e)) {
      // Einmal mit frischer Verbindung versuchen, bevor es als Fehler gilt.
      vergessen();
      try {
        await laden();
        return;
      } catch {
        // weiter unten melden
      }
    }
    if (!daten.geladen) daten.fehler = 'speicher';
    throw e;
  }
}

/** Lädt neu, ohne „Rückgängig“ zu vergessen: für Arbeit im Hintergrund. */
export async function stillLaden(): Promise<void> {
  await laden();
}

/**
 * Nach der Rückkehr in die App prüfen, ob die Verbindung noch lebt (iOS beendet sie im
 * Hintergrund teils ohne Ereignis). Schlägt ein kleiner Lesezugriff fehl, wird neu verbunden.
 */
export async function verbindungPruefen(): Promise<void> {
  if (!verbindung) return;
  try {
    await (await verbindung).count('einstellungen');
  } catch {
    vergessen();
    await neuLaden().catch(() => {});
  }
}

/**
 * PC213/PC214 (Weg A): die Ansicht, in der eine Person steht: der gewählte Haushalt oder, ohne Haushalt, der
 * Sammelplatz. So nehmen Seiten wie Selbstauskunft und „Übertragen“ beide Fälle mit derselben Logik.
 */
export function ansichtVon(personId: string): HaushaltAnsicht | null {
  const hat = (a: HaushaltAnsicht | null) =>
    !!a && [...a.mitglieder, ...a.herausgenommen].some((m) => m.person.id === personId);
  return hat(daten.ansicht) ? daten.ansicht : hat(daten.ohne) ? daten.ohne : null;
}

export { gehe } from './router.svelte';

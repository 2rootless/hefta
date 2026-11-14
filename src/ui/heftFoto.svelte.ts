// Foto aus dem Inserat für Kopf und Karte eines Hefts (B28b, K1). Es liegt in `dateien` (nur auf dem
// Gerät). Zustände wie in DP21: lädt (Platzhalter, kein Ladezeichen), da (blendet ein), lädt nicht
// (Platzhalter bleibt, ohne Fehlertext; beim nächsten Öffnen neu versucht), ohne.

import { db } from '../app/daten.svelte';
import { dateiLesen } from '../storage/speicher';

export type FotoZustand = 'ohne' | 'laedt' | 'da' | 'fehlt';

const urls = $state<Record<string, string | 'fehlt' | 'laedt'>>({});

/** Zustand und Adresse des Fotos; lädt es beim ersten Fragen. */
export function foto(id: string | undefined): { zustand: FotoZustand; url: string | null } {
  if (!id) return { zustand: 'ohne', url: null };
  const w = urls[id];
  if (w === undefined || w === 'laedt') return { zustand: 'laedt', url: null };
  if (w === 'fehlt') return { zustand: 'fehlt', url: null };
  return { zustand: 'da', url: w };
}

/** Außerhalb des Zeichnens aufrufen (in `$effect`): lädt das Foto, einmal je Öffnen der App. */
export async function fotoLaden(id: string | undefined): Promise<void> {
  if (!id || urls[id] !== undefined) return;
  urls[id] = 'laedt';
  try {
    const blob = await dateiLesen(await db(), id);
    urls[id] = blob ? URL.createObjectURL(blob) : 'fehlt';
  } catch {
    urls[id] = 'fehlt';
  }
}

/** Nach einem Fehlschlag beim nächsten Öffnen neu versuchen (DP21). */
export function fotoVergessen(id: string | undefined): void {
  if (id && urls[id] === 'fehlt') delete urls[id];
}

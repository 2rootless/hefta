import { db } from '../app/daten.svelte';
import type { Boegen } from '../domain/bogen';
import { einstellungenAendern, einstellungenLaden } from '../storage/speicher';

// E111 und W63: Die Bögen im Browser liegen in den Einstellungen dieses Browsers (Feld `boegen`), ohne Haushalt. Nichts
// geht nach außen (W11).

export async function boegenLaden(): Promise<Boegen> {
  return (await einstellungenLaden(await db())).boegen ?? {};
}

/** Setzt einen Teil; `undefined` löscht ihn („Alle Angaben löschen“, nach dem Übernehmen). */
export async function boegenSetzen<K extends keyof Boegen>(teil: K, wert: Boegen[K] | undefined) {
  const verbindung = await db();
  const alt = (await einstellungenLaden(verbindung)).boegen ?? {};
  const neu: Boegen = { ...alt };
  if (wert === undefined) delete neu[teil];
  // IndexedDB klont keine Proxys: als einfaches Objekt speichern.
  else neu[teil] = JSON.parse(JSON.stringify(wert)) as Boegen[K];
  await einstellungenAendern(verbindung, { boegen: neu });
}

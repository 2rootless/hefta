import type { DateiVersion, VersionFakten } from '../domain/modell';
import { FAKTEN_STAND } from '../domain/pruefhinweise';
import { dateiVon } from '../domain/seitenVersion';
import { dateiLesen, faktenSpeichern } from '../storage/speicher';
import { daten, db, stillLaden } from './daten.svelte';

// Liest im Hintergrund, was die Prüfhinweise brauchen: einmal je Version, auch für Daten von vorher
// (design/nachtraeglich-ordnen.md, Abschnitt 2 und 6). Scheitert es, fragt Hefta dazu eben nichts.

let laeuft = false;

async function lesen(v: DateiVersion): Promise<VersionFakten> {
  const verbindung = await db();
  const { dateiPruefsumme, faktenAus } = await import('../pdf/fakten');
  const { pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
  const original = await dateiLesen(verbindung, v.original);
  const bytes = original ? new Uint8Array(await original.arrayBuffer()) : null;
  const hash = bytes ? await dateiPruefsumme(bytes) : null;
  const seitenDatei =
    dateiVon(v) === v.original ? original : await dateiLesen(verbindung, dateiVon(v));
  if (!seitenDatei) return { stand: FAKTEN_STAND, hash, seiten: [] };
  const dokument = await pdfOeffnen(new Uint8Array(await seitenDatei.arrayBuffer()));
  try {
    return await faktenAus(dokument, hash);
  } finally {
    await pdfSchliessen(dokument);
  }
}

export const fehlenFakten = (versionen: DateiVersion[]) =>
  versionen.some((v) => v.erkannteWerte?.stand !== FAKTEN_STAND);

export async function faktenNachrechnen(): Promise<void> {
  if (laeuft) return;
  laeuft = true;
  try {
    const offen = (daten.ansicht?.versionen ?? []).filter(
      (v) => v.erkannteWerte?.stand !== FAKTEN_STAND,
    );
    // Monate derselben Datei lesen sie nur einmal.
    const schon = new Map<string, VersionFakten>();
    for (const v of offen) {
      const schluessel = `${v.original}|${dateiVon(v)}`;
      let fakten = schon.get(schluessel);
      if (!fakten) {
        fakten = await lesen(v).catch((): VersionFakten => ({
          stand: FAKTEN_STAND,
          hash: null,
          seiten: [],
        }));
        schon.set(schluessel, fakten);
      }
      await faktenSpeichern(await db(), v.id, fakten);
      // Dem Gerät Luft lassen: Das hier darf nie etwas anderes aufhalten.
      await new Promise((weiter) => setTimeout(weiter, 30));
    }
    if (offen.length) await stillLaden();
  } finally {
    laeuft = false;
  }
}

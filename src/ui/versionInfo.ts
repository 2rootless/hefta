import { db } from '../app/daten.svelte';
import { monatAus } from '../domain/fristen';
import type { DateiVersion } from '../domain/modell';
import { ohneTrennstellen, listenText, type Dokumenttyp } from '../domain/regelkatalog';
import { t } from '../i18n';
import { dateiLesen } from '../storage/speicher';
import { tagKurz } from './texte';

// Angaben zu einer gespeicherten Version für die Seite der Unterlage
// (design/unterlage-warum-haushalt.md, UL1 bis UL4).

const MONAT_JAHR = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** „September 2026“. */
export function monatJahr(monat: string): string {
  const [j, m] = monat.split('-').map(Number) as [number, number];
  return MONAT_JAHR.format(new Date(j, m - 1, 1));
}

/** Kürzel für die Marke in der Serie: „SEP“. */
export function monatKuerzel(monat: string): string {
  const [j, m] = monat.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('de-DE', { month: 'long' })
    .format(new Date(j, m - 1, 1))
    .slice(0, 3)
    .toUpperCase();
}

/** Titel einer einzelnen Version: „September 2026“, „Version vom 12. Juli“, „Version ohne Datum“. */
export function versionTitel(v: DateiVersion, heute = new Date()): string {
  if (v.abrechnungsmonat) return monatJahr(v.abrechnungsmonat);
  if (v.ausstellungsdatum)
    return t('unterlage.versionVom', { datum: tagKurz(v.ausstellungsdatum, heute) });
  return t('unterlage.versionOhneDatum');
}

/** „Bis wann“ einer Version für ältere Versionen ohne eigenen Titel. */
export function versionMonat(v: DateiVersion): string {
  return v.abrechnungsmonat ?? monatAus(new Date(v.createdAt));
}

/** Dateiname, wie er beim Hochladen hieß; ältere Versionen haben keinen. */
export function originalName(v: DateiVersion, typ: Dokumenttyp): string {
  return v.dateiname ?? `${ohneTrennstellen(listenText(typ)).replace(/\s+/g, '_')}.pdf`;
}

const zahlen = new Map<string, number>();

/** Wie viele Seiten in die Mappe kommen. Ist nichts ausgewählt, steht die Zahl nur in der Datei. */
export async function seitenZahl(v: DateiVersion): Promise<number | null> {
  if (v.seiten?.length) return v.seiten.length;
  const id = v.aufbereitet ?? v.original;
  const bekannt = zahlen.get(id);
  if (bekannt) return bekannt;
  const datei = await dateiLesen(await db(), id);
  if (!datei) return null;
  const { pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
  try {
    const dokument = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
    zahlen.set(id, dokument.numPages);
    const anzahl = dokument.numPages;
    await pdfSchliessen(dokument);
    return anzahl;
  } catch {
    return null;
  }
}

/** „gehalt_09.pdf, 2 Seiten“; ohne Dateinamen nur die Seiten. */
export function dateiZeile(v: DateiVersion, anzahl: number | null | undefined): string {
  const seiten = anzahl ? t('unterlage.seitenZahl', { anzahl }) : '';
  return [v.dateiname, seiten].filter(Boolean).join(', ');
}

import type { ExportEinstellungen } from '../domain/export';
import { tagAus } from '../domain/fristen';
import type { Bewerbung, MappenAussehen } from '../domain/modell';
import type { HaushaltAnsicht } from '../storage/speicher';
import type { MappenErgebnis } from './mappeErstellen';

// Zwischenspeicher für gebaute Mappen: Wer zwischen Marktüblich und Datensparsam wechselt, verkleinert
// oder zurück zur Vorschau kommt, soll nicht warten. Es liegt nur im Speicher dieser Sitzung; Blobs
// zählen nicht zum Arbeitsspeicher der Seite. Die Dateien selbst ändern sich nie, nur ihre Zuordnung,
// deshalb reicht als Schlüssel, was sich mit jeder Änderung mitändert.

export class Zwischenspeicher<T> {
  private eintraege = new Map<string, { wert: T; groesse: number }>();

  constructor(
    private grenze: number,
    private beimEntfernen?: (wert: T) => void,
  ) {}

  holen(schluessel: string): T | undefined {
    const eintrag = this.eintraege.get(schluessel);
    if (!eintrag) return undefined;
    // Zuletzt benutzt steht hinten; vorne wird zuerst aufgeräumt.
    this.eintraege.delete(schluessel);
    this.eintraege.set(schluessel, eintrag);
    return eintrag.wert;
  }

  merken(schluessel: string, wert: T, groesse: number): void {
    this.eintraege.delete(schluessel);
    this.eintraege.set(schluessel, { wert, groesse });
    let summe = 0;
    for (const e of this.eintraege.values()) summe += e.groesse;
    // Das Neueste bleibt immer, auch wenn es allein über der Grenze liegt.
    for (const [k, e] of this.eintraege) {
      if (summe <= this.grenze || k === schluessel) break;
      summe -= e.groesse;
      this.eintraege.delete(k);
      this.beimEntfernen?.(e.wert);
    }
  }
}

/** Vorschaubilder einer gebauten Mappe; sie leben so lange wie die Mappe im Zwischenspeicher. */
export const vorschauen = new WeakMap<MappenErgebnis, string[]>();
/** Was das Verkleinern brächte; gemessen wird nur einmal je Mappe. */
export const schaetzungen = new WeakMap<MappenErgebnis, { geschaetzt: number } | null>();

export const gebauteMappen = new Zwischenspeicher<MappenErgebnis>(150 * 1024 * 1024, (erg) => {
  vorschauen.get(erg)?.forEach((url) => URL.revokeObjectURL(url));
  vorschauen.delete(erg);
});

/** Verkleinerte Dateien, je gespeicherte Datei einmal gerechnet (das dauert auf dem iPhone). */
export const kleineDateien = new Zwischenspeicher<Blob>(100 * 1024 * 1024);

/**
 * Ändert sich mit allem, was die Mappe ändert. Der Tag steht in den Selbstauskünften. Mit dem ganzen
 * Inhalt statt nur dem Änderungsdatum: Eine alte Mappe mit einem alten Namen wäre schlimmer als ein
 * längerer Schlüssel.
 */
export function bauSchluessel(
  ansicht: HaushaltAnsicht,
  bewerbung: Pick<Bewerbung, 'adresse' | 'satz' | 'bitteSatz'> | null,
  e: ExportEinstellungen,
  aussehen?: MappenAussehen,
  heute: Date = new Date(),
): string {
  return JSON.stringify([
    tagAus(heute),
    e,
    bewerbung?.adresse ?? '',
    bewerbung?.satz ?? '',
    bewerbung?.bitteSatz ?? null,
    aussehen ?? ansicht.haushalt.mappeAussehen ?? null,
    ansicht.haushalt,
    ansicht.mitglieder,
    ansicht.dokumente,
    ansicht.versionen,
  ]);
}

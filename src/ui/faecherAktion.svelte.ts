// W57/W54 (PC199, DP127, DP128): Verschieben im Haushalt mit Zeile danach, „Rückgängig“ und der Frage nach dem
// Vertrag. Eine Quelle für den Haushalt (HaushaltFaecher) und die Personenseite (PersonZiele): gleiche Ziele, gleiche
// Zeile danach (W54 gilt an beiden Stellen).

import { tick } from 'svelte';
import { daten, db, neuLaden } from '../app/daten.svelte';
import {
  frageLoesen,
  verschieben,
  zurAnsprech,
  type Eintrag,
  type Ergebnis,
  type Fach,
  type Folge,
  type Frage,
} from '../domain/faecher';
import { t } from '../i18n';
import { bewegungReduziert } from './bewegung';
import { faecherAus, faecherSpeichern } from '../storage/speicher';

export function satzAus(folgen: Folge[]): string {
  return folgen
    .map((f) =>
      f.art === 'fach'
        ? t(`faecher.folge.${f.fach}`, { name: f.name })
        : f.art === 'ansprech'
          ? t('faecher.folge.ansprech', { name: f.name })
          : t('faecher.folge.kommt', { name: f.name }),
    )
    .join(' ');
}

/** Abstand der Zeile danach zur Leiste und zum oberen Rand (DP130, B1). */
const RAND = 16;

/**
 * DP130, B1 (G11): Die Zeile danach mit „Rückgängig“ steht ganz im Bild, über der festen Leiste („Fertig“) mit
 * 16 px Luft. Liegt sie schon frei, rollt nichts. Bei „Bewegung reduzieren“ ohne weiches Rollen.
 */
export function zeileZeigen(zeile: HTMLElement) {
  const r = zeile.getBoundingClientRect();
  const leiste = document.querySelector('.leiste')?.getBoundingClientRect();
  const unten =
    Math.min(window.innerHeight, leiste && leiste.height ? leiste.top : Infinity) - RAND;
  // Ist zwischen oben und der Leiste zu wenig Platz, gilt der obere Rand: Der Satz steht dann oben frei.
  const um =
    r.bottom > unten ? Math.min(r.bottom - unten, r.top - RAND) : r.top < RAND ? r.top - RAND : 0;
  if (Math.abs(um) < 1) return;
  window.scrollBy({ top: Math.ceil(um), behavior: bewegungReduziert() ? 'instant' : 'smooth' });
}

export class FaecherAktion {
  /** Der Stand, den die Liste zeigt, bis das Neuladen ihn bestätigt (kein Rücksprung, G9). */
  gesetzt = $state<Eintrag[] | null>(null);
  folge = $state<string | null>(null);
  vorher = $state<Eintrag[] | null>(null);
  frage = $state<Frage | null>(null);

  /** Vor jeder sichtbaren Änderung (für die ruhige Umordnung); danach `tick()`. */
  constructor(
    private wurzel: () => HTMLElement | null,
    private umordnen: (f: () => void) => Promise<void> = async (f) => f(),
  ) {}

  get liste(): Eintrag[] {
    return this.gesetzt ?? (daten.ansicht ? faecherAus(daten.ansicht) : []);
  }

  private async speichern(liste: Eintrag[]) {
    const a = daten.ansicht;
    if (!a) return;
    await faecherSpeichern(await db(), a.haushalt.id, liste);
    await neuLaden();
    this.gesetzt = null;
  }

  /** Übernimmt einen Stand: zeigt ihn sofort, speichert ihn, merkt den Stand davor für „Rückgängig“. */
  async anwenden(e: Ergebnis, davor: Eintrag[] = this.liste) {
    await this.umordnen(() => {
      this.gesetzt = e.liste;
      this.frage = null;
    });
    await this.speichern(e.liste);
    // Die Zeile danach erst, wenn der Stand gespeichert ist: Sie sagt, was gilt.
    this.vorher = davor;
    this.folge = e.folgen.length ? satzAus(e.folgen) : null;
    await tick();
    const zeile = this.wurzel()?.querySelector<HTMLElement>('.folge');
    if (zeile) zeileZeigen(zeile);
    this.wurzel()?.querySelector<HTMLElement>('.rueck')?.focus({ preventScroll: true });
  }

  async rueckgaengig() {
    if (!this.vorher) return;
    const ziel = this.vorher;
    await this.umordnen(() => {
      this.gesetzt = ziel;
      this.folge = null;
      this.vorher = null;
    });
    await this.speichern(ziel);
  }

  /** Verschieben per Ziel (ohne Ziehen) oder nach dem Loslassen; würde der Vertrag leer, kommt die Frage (W42). */
  async nach(id: string, ziel: Fach | 'ansprech', stelle?: number) {
    if (ziel === 'ansprech') return this.anwenden(zurAnsprech(this.liste, id));
    const r = verschieben(this.liste, id, ziel, stelle);
    if ('frage' in r) {
      await this.umordnen(() => {
        this.frage = r.frage;
      });
      await tick();
      this.wurzel()?.querySelector<HTMLElement>('.frage .wahl button')?.focus();
      return;
    }
    if (!r.folgen.length) {
      // nur umsortiert: ohne Zeile danach
      this.gesetzt = r.liste;
      await this.speichern(r.liste);
      return;
    }
    return this.anwenden(r);
  }

  async beantworten(wer: string | { neu: string }) {
    if (!this.frage) return false;
    if (typeof wer !== 'string' && !wer.neu.trim()) {
      this.wurzel()?.querySelector<HTMLElement>('.frage input')?.focus();
      return false;
    }
    await this.anwenden(
      frageLoesen(this.liste, this.frage, typeof wer === 'string' ? wer : { neu: wer.neu.trim() }),
    );
    return true;
  }
}

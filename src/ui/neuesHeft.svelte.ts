import type { InseratGelesen } from '../app/heftaInserat';
import { linkWegDa } from '../app/plattform';
import { gehe } from '../app/router.svelte';
import type { HeftAngaben } from '../domain/modell';
import { adresseAus, angabenAus } from '../lesen/angaben';
import { anbieterLesen } from '../lesen/anbieter';
import { adresseLesen, lesen, type Gelesen } from '../lesen/leser';

// Entwurf eines neuen Hefts zwischen „Text einfügen“ und „Heft anlegen“ (B23). Er lebt nur im Speicher
// der Seite: Gespeichert wird erst mit „Heft anlegen“ (Lesesatz in B23). Schließt man die App, ist er weg.

export const entwurf = $state<{
  text: string;
  link: string;
  gelesen: Gelesen | null;
  angaben: HeftAngaben | null;
  /** So, wie Hefta es gelesen hat, zum Zurücksetzen geänderter Angaben (Auftraggeber, 12.11.). */
  gelesenAngaben: HeftAngaben | null;
  gelesenAdresse: string;
  /** Adresse wie im Heft, zwei Zeilen; leer, wenn nichts gefunden. */
  adresse: string;
  /** Erstes Foto aus der Vorschau (B23), verkleinert als Daten-Adresse; nur im Speicher der Seite. */
  bild: string | null;
  bildHoch: boolean;
  /** Aus einer Portal-App an Hefta geteilt (E81, B23 `quelle=teilen`). */
  geteilt: boolean;
}>({
  text: '',
  link: '',
  gelesen: null,
  angaben: null,
  gelesenAngaben: null,
  gelesenAdresse: '',
  adresse: '',
  bild: null,
  bildHoch: false,
  geteilt: false,
});

/**
 * Stand der Vorschau (B23 Bildschirm 2) für genau einen Link: Zurück aus der Kontrolle zeigt ihn wieder,
 * ohne neu zu laden (E72).
 */
/** Das zuletzt angelegte Heft: Seine Zeile kommt in der Übersicht einmal mit `bw-hoch` (Zeile 6). */
export const zuletzt = $state<{ heftId: string | null }>({ heftId: null });

export const vorschauStand = $state<{
  link: string;
  zustand: 'laden' | 'ok' | 'zeit' | 'netz' | 'leer' | 'liste' | 'schon';
  roh: InseratGelesen | null;
}>({ link: '', zustand: 'laden', roh: null });

/** Liest den eingefügten Text. Einmal: „Heft anlegen“ übernimmt nur, was hier gelesen ist (E72). */
export function entwurfLesen(): void {
  const link = entwurf.link.trim();
  const g = lesen({ text: entwurf.text, url: link || undefined });
  const a = adresseLesen(entwurf.text);
  entwurf.gelesen = g;
  const anbieter = anbieterLesen(entwurf.text);
  entwurf.angaben = { ...angabenAus(g, a, null, link || null), anbieter };
  entwurf.adresse = adresseAus(a);
  entwurf.gelesenAngaben = { ...angabenAus(g, a, null, link || null), anbieter };
  entwurf.gelesenAdresse = entwurf.adresse;
}

export function entwurfVergessen(): void {
  entwurf.text = '';
  entwurf.link = '';
  entwurf.gelesen = null;
  entwurf.angaben = null;
  entwurf.gelesenAngaben = null;
  entwurf.gelesenAdresse = '';
  entwurf.adresse = '';
  entwurf.bild = null;
  entwurf.bildHoch = false;
  entwurf.geteilt = false;
  vorschauStand.link = '';
  vorschauStand.roh = null;
}

/**
 * Übernimmt, was die unsichtbare Vorschau gelesen hat (E72: gelesen wird beim Einsetzen, einmal).
 * Titel nach Probe 3: die Überschrift der Seite vor `og:title`, dann der Titel des Dokuments.
 */
export function entwurfAusVorschau(g: InseratGelesen, link: string): void {
  const text = g.text ?? '';
  const url = g.url || link;
  const gelesen = lesen({ text, url });
  const a = adresseLesen(text);
  const titel = (g.h1 || g.ogTitle || g.titel || '').trim() || null;
  entwurf.text = text;
  entwurf.link = link;
  entwurf.gelesen = gelesen;
  // Anbieter aus der Seite (Zeile 4): für die Anrede und die Datenspur.
  const anbieter = anbieterLesen(text);
  entwurf.angaben = { ...angabenAus(gelesen, a, titel, link), anbieter };
  entwurf.adresse = adresseAus(a);
  entwurf.gelesenAngaben = { ...angabenAus(gelesen, a, titel, link), anbieter };
  entwurf.gelesenAdresse = entwurf.adresse;
  entwurf.bild = g.bild ?? null;
  entwurf.bildHoch = !!g.bildHoch;
}

/** Hat das Lesen etwas gefunden, das im Kopf eines Hefts steht? */
export function hatEckdaten(a: HeftAngaben | null): boolean {
  return !!a && (a.warm !== null || a.zimmer !== null || a.flaeche !== null);
}

/** Ein geteiltes Inserat: direkt in die Vorschau, wo man gerade ist (E81, E73). */
/**
 * Weiter zur Kontrolle. PC9: Solange das Heft nicht angelegt ist, führt Zurück wieder zur Vorschau (sie lädt
 * nicht neu, E72). Erst „Heft anlegen“ schließt den Ablauf ab; danach führt Zurück zu „Wohnungen“.
 */
export function zurKontrolle(): void {
  gehe('/wohnung-neu/kontrolle');
}

export function geteiltOeffnen(link: string): void {
  entwurfVergessen();
  entwurf.link = link;
  entwurf.geteilt = true;
  if (linkWegDa()) gehe('/wohnung-neu/vorschau');
  else {
    // Android: Die unsichtbare Vorschau gibt es bisher nur auf dem iPhone. Dann gleich zur Kontrolle, mit
    // Portal und Link; die Angaben trägt man ein (wie „Trotzdem anlegen“).
    entwurfAusVorschau({ zustand: 'fehler' }, link);
    gehe('/wohnung-neu/kontrolle');
  }
}

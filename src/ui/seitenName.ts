// Kurzer Name einer Seite für den Link „Zurück“ (Planung 12r, Design): Der Link nennt das Ziel, zu dem
// auch die Wischgeste führt. Hat die vorige Seite einen kurzen Namen, steht er da („‹ Mappe“,
// „‹ Neues Heft“); sonst „Zurück“. Seiten einer Person heißen nach ihrem Rufnamen, bis 14 Zeichen
// (Planung 12t); Unterlagen und Versionen bleiben bei „Zurück“.
import { daten } from '../app/daten.svelte';
import { t, type TextSchluessel } from '../i18n';

/** Längster Rufname, der noch im Link steht (Planung 12t). */
export const RUFNAME_BIS = 14;

const FEST: Record<string, TextSchluessel> = {
  '/': 'tabs.mappe',
  '/wohnungen': 'tabs.wohnungen',
  '/wohnung-neu': 'neuesHeft.linkTitel',
  '/wohnung-neu/text': 'neuesHeft.linkTitel',
  '/wuensche': 'wuensche.zurueck',
  '/mappe': 'mappe.titel',
  '/mappe/anpassen': 'mappe.anpassen',
  '/einstellungen': 'einstellungen.titel',
  '/haushalt': 'einrichtung.haushalt.titelBearbeiten',
};

const MUSTER: [RegExp, TextSchluessel][] = [
  [/^\/heft\/[\w-]+$/, 'merkmal.zurueck'],
  [/^\/selbstauskunft\/[\w-]+$/, 'selbstauskunft.titel'],
];

/** Name der Seite unter `pfad`, oder null, wenn sie keinen kurzen hat. */
export function seitenName(pfad: string): string | null {
  const fest = FEST[pfad];
  if (fest) return t(fest);
  const person = pfad.match(/^\/person\/([\w-]+)$/)?.[1];
  if (person) {
    const p = daten.ansicht?.mitglieder.find((m) => m.person.id === person)?.person;
    const ruf = (p?.rufname || p?.vorname || '').trim();
    return ruf && [...ruf].length <= RUFNAME_BIS ? ruf : null;
  }
  const treffer = MUSTER.find(([m]) => m.test(pfad));
  return treffer ? t(treffer[1]) : null;
}

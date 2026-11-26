import { t } from '../i18n';
import type { HaushaltAnsicht } from '../storage/speicher';

/**
 * W39 (PC130 K8): Der Name der Seite, zu der „Zurück“ führt, wenn es an den Einstieg geht: „Mappe“, „Max“,
 * „Mappe teilen“ … Für Seiten ohne eigenen Namen hier „Zurück“.
 */
export function einstiegText(pfad: string, ansicht: HaushaltAnsicht | null | undefined): string {
  if (pfad === '/') return t('tabs.mappe');
  if (pfad === '/mappe') return t('mappe.titel');
  if (pfad === '/wohnungen') return t('tabs.wohnungen');
  if (pfad === '/selbstauskuenfte') return t('selbstauskuenfte.titel');
  if (pfad === '/haushalt') return t('einrichtung.haushalt.titelBearbeiten');
  // DP135, U11: Aus dem Heft heißt der Weg zurück „Heft“.
  if (pfad.startsWith('/heft/')) return t('allgemein.heft');
  const id = pfad.startsWith('/person/') ? pfad.split('/')[2] : undefined;
  const person = ansicht?.mitglieder.find((m) => m.person.id === id)?.person;
  return person ? person.rufname || person.vorname : t('allgemein.zurueck');
}

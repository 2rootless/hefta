// Kurzer Name einer Seite für den Link „Zurück“ (Planung 12r, Design): Der Link nennt das Ziel, zu dem
// auch die Wischgeste führt. Hat die vorige Seite einen kurzen Namen, steht er da („‹ Mappe“,
// „‹ Neues Heft“); sonst „Zurück“.
import { t, type TextSchluessel } from '../i18n';

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
  const treffer = MUSTER.find(([m]) => m.test(pfad));
  return treffer ? t(treffer[1]) : null;
}

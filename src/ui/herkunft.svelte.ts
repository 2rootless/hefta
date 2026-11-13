// Seiten, die man aus beiden Reitern erreicht (Einstellungen, Einrichtung): Zurück nennt den Reiter, aus
// dem man kam (Auftraggeber 13.11.). Der Reiterwechsel beginnt den Verlauf neu; sein Anfang ist der Reiter.
import { daten } from '../app/daten.svelte';
import { route, verlaufsAnfang } from '../app/router.svelte';
import { t } from '../i18n';

export function herkunftsReiter(): { href: string; text: string } {
  void route.pfad; // neu rechnen, wenn sich die Seite ändert
  if (verlaufsAnfang() === '/wohnungen') return { href: '#/wohnungen', text: t('tabs.wohnungen') };
  return { href: daten.ansicht ? '#/' : '#/mappe-start', text: t('tabs.mappe') };
}

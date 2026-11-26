import { istApp } from '../app/plattform';
import { t } from '../i18n';

/**
 * Wohin „Zurück“ auf den Seiten ohne Haushalt im Browser führt (DP134, DP135 U11; PC213): im Browser zum Ratgeber auf der Website, in der App
 * (dort gibt es keinen Ratgeber) zur Mappe.
 */
export function browserZurueck(): { href: string; text: string } {
  return istApp()
    ? { href: '#/', text: t('allgemein.zurueck') }
    : { href: '/ratgeber/', text: t('ohneHaushalt.ratgeber') };
}

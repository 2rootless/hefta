// Der Name des Dienstes steht nur hier. Texte schreiben {app}, index.html, Manifest und 404-Seite
// %APP_NAME%; die ersetzt der Build. Die Mappe bleibt, was man erstellt: „Mappe erstellen“ ist kein Name.

export const APP_NAME = 'Hefta';
export const APP_DOMAIN = 'hefta.de';
export const APP_ADRESSE = `https://${APP_DOMAIN}`;
/** Die Vermieter-Seite hat eine eigene Adresse: Sie öffnet fremde PDFs und teilt nichts mit der App. */
export const VERMIETER_DOMAIN = `vermieter.${APP_DOMAIN}`;
export const VERMIETER_ADRESSE = `https://${VERMIETER_DOMAIN}`;
/** Hefta im App Store (seit 10.11.2026). Der deutsche Store, denn Hefta gibt es nur in Deutschland. */
export const APP_STORE_ADRESSE = 'https://apps.apple.com/de/app/hefta/id6831939371';
export const APP_STORE_ID = /id(\d+)$/.exec(APP_STORE_ADRESSE)![1]!;
/**
 * Hefta bei Google Play. Noch keine Freigabe (E66, Planung 13e): null. Mit der Adresse erscheint auf der
 * Landingpage das Abzeichen für Android; sonst ändert sich nichts.
 */
export const PLAY_ADRESSE: string | null = null;
/** Der Ratgeber für Vermieter auf derselben Adresse wie die Vermieter-Seite. */
export const VERMIETER_RATGEBER = '/welche-unterlagen-wann/';
/** Öffentliches Repository. Erst setzen, wenn es das saubere Repository wirklich gibt. */
export const QUELLCODE_ADRESSE: string | null = 'https://github.com/2rootless/hefta';

/** Backups. Einspielen nimmt jede Datei: Geprüft wird der Inhalt, nicht die Endung. */
export const BACKUP_ENDUNG = 'hefta';
export const BACKUP_DATEIANFANG = 'hefta-backup';

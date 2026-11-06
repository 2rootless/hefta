// Der Name des Dienstes steht nur hier. Texte schreiben {app}, index.html, Manifest und 404-Seite
// %APP_NAME%; die ersetzt der Build. Die Mappe bleibt, was man erstellt: „Mappe erstellen“ ist kein Name.

export const APP_NAME = 'Hefta';
export const APP_DOMAIN = 'hefta.de';
export const APP_ADRESSE = `https://${APP_DOMAIN}`;
/** Die Vermieter-Seite hat eine eigene Adresse: Sie öffnet fremde PDFs und teilt nichts mit der App. */
export const VERMIETER_DOMAIN = `vermieter.${APP_DOMAIN}`;
export const VERMIETER_ADRESSE = `https://${VERMIETER_DOMAIN}`;
/** Der Ratgeber für Vermieter auf derselben Adresse wie die Vermieter-Seite. */
export const VERMIETER_RATGEBER = '/welche-unterlagen-wann/';
/** Öffentliches Repository. Erst setzen, wenn es das saubere Repository wirklich gibt. */
export const QUELLCODE_ADRESSE: string | null = null;

/** Backups. Einspielen nimmt jede Datei: Geprüft wird der Inhalt, nicht die Endung. */
export const BACKUP_ENDUNG = 'hefta';
export const BACKUP_DATEIANFANG = 'hefta-backup';

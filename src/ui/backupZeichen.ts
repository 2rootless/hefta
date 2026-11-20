import ohne from '../assets/hefta-backup.svg';
import mit from '../assets/hefta-backup-mit-passwort.svg';

// DP88 (E259, PC140): Backup-Zeichen „Zweitblatt“, zwei Blätter in Karton, vorn das Hefta-Zeichen. Mit Passwort
// hängt ein kleiner Schlüssel daran. Ohne Passwort nie ein Schlüssel (W10).

/** Die Dateien in `src/assets/`, für den Test wunsch-W38. */
export const BACKUP_ZEICHEN = {
  ohne: 'hefta-backup.svg',
  mit: 'hefta-backup-mit-passwort.svg',
} as const;

/** Das Zeichen für die Seiten zum Backup. */
export function backupZeichen(mitPasswort: boolean): string {
  return mitPasswort ? mit : ohne;
}

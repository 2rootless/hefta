import type { Einstellungen } from '../domain/modell';

/**
 * DP106: Nach einem reinen Download im Browser heißt es überall „Letzter Download“ statt „Letztes Backup“
 * (Einstellungen, Übersicht, „Alles löschen?“, Person löschen). Hefta weiß dort nur vom Download (W10).
 * Die Sätze bleiben sonst gleich, darum wird nur das Wort getauscht.
 */
export function backupWort(
  text: string,
  e: Pick<Einstellungen, 'letztesBackupWeg'> | null | undefined,
): string {
  return e?.letztesBackupWeg === 'download'
    ? text
        .replace(/Letztes Backup/g, 'Letzter Download')
        // In den Einstellungen steht das Wort allein unter „Backup erstellen“: „Letztes heute“.
        .replace(/^Letztes (?=heute|vor )/, 'Letzter Download ')
    : text;
}

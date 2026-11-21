import { backupArt } from '../storage/backup';

/**
 * Backup von außen: Wohin eine Datei geht, die eine andere App an Hefta gibt (Dateien, Mail, Teilen).
 * Entscheidend ist der Anfang der Datei, nicht ihr Name: „HEFTABAK“ (verschlüsselt) oder „PK“ (offen)
 * ist ein Backup und geht zu „Backup einspielen“. Alles andere geht wie bisher in den Eingang.
 * Nur eine einzelne Datei kann ein Backup sein; mehrere Dateien sind immer Unterlagen.
 */
export async function eingangZiel(dateien: File[]): Promise<'backup' | 'eingang'> {
  const [erste] = dateien;
  if (dateien.length !== 1 || !erste) return 'eingang';
  return (await backupArt(erste)) === 'unbekannt' ? 'eingang' : 'backup';
}

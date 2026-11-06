// Zustand zwischen den Einstellungs-Seiten: die gewählte Backup-Datei (Einstellungen → Einspielen)
// und eine kurze Bestätigung, die die Einstellungen nach dem Zurückkommen zeigen.
import type { Bestand } from '../storage/sicherung';
import { t } from '../i18n';

export const einstellungenZustand = $state<{ datei: File | null; meldung: string }>({
  datei: null,
  meldung: '',
});

/** „3 Personen, 1 Kind“ und „14 Unterlagen“ als zwei Zeilen. */
export function bestandZeilen(b: Bestand): [string, string] {
  const wer = [t('zahlen.personen', { anzahl: b.personen })];
  if (b.weitere) wer.push(t('zahlen.weitere', { anzahl: b.weitere }));
  if (b.kinder) wer.push(t('zahlen.kinder', { anzahl: b.kinder }));
  return [wer.join(', '), t('zahlen.unterlagen', { anzahl: b.unterlagen })];
}

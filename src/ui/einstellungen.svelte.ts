// Zustand zwischen den Einstellungs-Seiten: die gewählte Backup-Datei (Einstellungen → Einspielen)
// und eine kurze Bestätigung, die die Einstellungen nach dem Zurückkommen zeigen.
import type { Bestand } from '../storage/sicherung';
import { werIstDabeiKurz } from '../domain/mappeWoerter';

/** DP50 Punkt 10: die drei Reiter der Einstellungen. */
export type EinstellungenReiter = 'hefte' | 'mappe' | 'app';

export const einstellungenZustand = $state<{
  datei: File | null;
  meldung: string;
  /** Der gewählte Reiter; bleibt, wenn man von einer Unterseite zurückkommt. */
  reiter: EinstellungenReiter;
  /** Backup von außen: Die Datei kam aus „Dateien“ oder einer anderen App, nicht aus den Einstellungen. */
  vonAussen: boolean;
}>({
  datei: null,
  meldung: '',
  vonAussen: false,
  reiter: 'hefte',
});

/** Kurzform nach E25: „Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.“ Nie eine Summe. */
export function bestandKurz(b: Bestand): string {
  return werIstDabeiKurz({
    vertrag: b.vertragNamen.length,
    kinder: b.kinder,
    weitere: b.weitere,
    buergen: b.buergenNamen.length,
  });
}

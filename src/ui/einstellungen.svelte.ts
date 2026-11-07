// Zustand zwischen den Einstellungs-Seiten: die gewählte Backup-Datei (Einstellungen → Einspielen)
// und eine kurze Bestätigung, die die Einstellungen nach dem Zurückkommen zeigen.
import type { Bestand } from '../storage/sicherung';
import { werIstDabeiKurz } from '../domain/mappeWoerter';

export const einstellungenZustand = $state<{ datei: File | null; meldung: string }>({
  datei: null,
  meldung: '',
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

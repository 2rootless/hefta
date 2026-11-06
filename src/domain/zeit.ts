// Rechnen mit Kalendertagen in der Ortszeit des Geräts.

/** Ganze Kalendertage zwischen zwei Zeitpunkten (gestern 23 Uhr bis heute 1 Uhr = 1 Tag). */
export function tageSeit(von: string | Date, heute: Date = new Date()): number {
  const a = new Date(von);
  const tagA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const tagB = Date.UTC(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return Math.round((tagB - tagA) / 86_400_000);
}

/** Lokaler Kalendertag als „JJJJ-MM-TT“ (für Dateinamen; nicht UTC, sonst kurz nach Mitternacht falsch). */
export function heuteTag(heute: Date = new Date()): string {
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${heute.getFullYear()}-${zwei(heute.getMonth() + 1)}-${zwei(heute.getDate())}`;
}

/**
 * Unterlagen, die seit dem letzten Backup dazugekommen oder geändert sind. Drei neue Monate einer
 * Gehaltsabrechnung sind eine Unterlage, sonst stünde dort mehr, als es überhaupt gibt.
 */
export function neueUnterlagen(
  versionen: { dokumentId: string; createdAt: string }[],
  letztesBackup: string | null,
): number {
  const neu = letztesBackup ? versionen.filter((v) => v.createdAt > letztesBackup) : versionen;
  return new Set(neu.map((v) => v.dokumentId)).size;
}

/** Mindestens drei Kalendermonate her (E3d: Frage nach dem Löschen bei Herausgenommenen). */
export function dreiMonateHer(von: string | Date, heute: Date = new Date()): boolean {
  const a = new Date(von);
  const grenze = new Date(a.getFullYear(), a.getMonth() + 3, a.getDate());
  return heute >= grenze;
}

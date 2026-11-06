import type { Bewerbung, Haushalt, Person, Zeitpunkt } from './modell';

// Version 2, Bewerbungs-Tracker (docs/10-version-2.md, B4, B5): Stand je Wohnung mit Verlauf und
// die Rechenhilfe Mietanteil. Nur Rechnen, keine Bewertung: Hefta sagt nicht, was „zu teuer“ ist.

export const STATUS = ['entwurf', 'gesendet', 'besichtigung', 'zusage', 'absage'] as const;
export type BewerbungsStatus = (typeof STATUS)[number];

/** Neuer Stand mit Zeitpunkt; derselbe Stand zweimal hintereinander ändert nichts. */
export function statusSetzen(
  b: Pick<Bewerbung, 'status' | 'verlauf'>,
  status: BewerbungsStatus,
  am: Zeitpunkt,
): Pick<Bewerbung, 'status' | 'verlauf'> {
  if (b.status === status) return { status: b.status, verlauf: b.verlauf ?? [] };
  return { status, verlauf: [...(b.verlauf ?? []), { status, am }] };
}

/** Noch nicht entschieden (weder Zusage noch Absage). */
export function laeuft(b: Pick<Bewerbung, 'status'>): boolean {
  return b.status !== 'zusage' && b.status !== 'absage';
}

/** Laufende zuerst, darin die zuletzt geänderte oben; dann die entschiedenen. */
export function sortieren<T extends Pick<Bewerbung, 'status' | 'updatedAt'>>(liste: T[]): T[] {
  return [...liste].sort(
    (a, b) => Number(laeuft(b)) - Number(laeuft(a)) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

export interface HaushaltsNetto {
  betrag: number;
  /** Mindestens-Angabe dabei oder jemand ohne Angabe: der Betrag ist eine Untergrenze. */
  mindestens: boolean;
  quelle: 'eingetragen' | 'selbstauskunft';
}

/**
 * Nettoeinkommen des Haushalts: selbst eingetragen, sonst die Summe der Vertragsparteien aus
 * ihren Selbstauskünften. Bürgen zählen nicht (sie zahlen nur im Notfall).
 */
export function haushaltsNetto(
  haushalt: Pick<Haushalt, 'netto'>,
  vertragsparteien: Pick<Person, 'nettoeinkommen' | 'selbstauskunft'>[],
): HaushaltsNetto | null {
  if (haushalt.netto && haushalt.netto > 0)
    return { betrag: haushalt.netto, mindestens: false, quelle: 'eingetragen' };
  const mit = vertragsparteien.filter((p) => p.nettoeinkommen && p.nettoeinkommen > 0);
  if (!mit.length) return null;
  return {
    betrag: mit.reduce((s, p) => s + p.nettoeinkommen!, 0),
    mindestens:
      mit.length < vertragsparteien.length ||
      mit.some((p) => p.selbstauskunft?.einkommenArt === 'mindestens'),
    quelle: 'selbstauskunft',
  };
}

/** Anteil der Miete am Netto in Prozent, eine Nachkommastelle. */
export function mietanteil(netto: number, miete: number): number | null {
  if (!(netto > 0) || !(miete >= 0)) return null;
  return Math.round((miete / netto) * 1000) / 10;
}

/** Wie viel Miete ein Anteil des Netto wäre, auf ganze Euro. */
export function mieteBeiAnteil(netto: number, prozent: number): number {
  return Math.round((netto * prozent) / 100);
}

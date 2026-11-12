import { wohnungsSchluessel } from './adresse';
import { KEINE_EREIGNISSE, neueId, type Bewerbung, type Heft, type HeftEreignisse } from './modell';

// Umstellung auf Hefta 2 (Schema 2, docs/32-bauplan-hefta-2-schritt-1.md): Jede Bewerbung mit Adresse
// wird zu einem Heft. Dieselbe Regel gilt beim Öffnen der Datenbank und beim Einspielen alter Backups.
// Die Bewerbung bleibt unverändert; nichts wird gelöscht.

/**
 * Stand eines Hefts aus Version 1 (Nachricht 10.11. l). Version 1 hat nie gespeichert, ob eine Mappe
 * geteilt wurde. Sie legt aber die Kennung der Lesehilfe an, sobald für die Adresse eine echte Mappe
 * entsteht. Gibt es sie: „Beworben, unsicher“, mit der letzten Änderung der Bewerbung als Tag; dann
 * fragt das Heft einmal „Stimmt der Stand?“. Sonst bleibt es „Gemerkt“.
 */
export function ereignisseAusVersion1(
  b: Pick<Bewerbung, 'kennungen' | 'updatedAt'>,
  adresse: string,
): HeftEreignisse {
  const kennung = b.kennungen?.[wohnungsSchluessel(adresse)];
  return kennung
    ? { ...KEINE_EREIGNISSE, beworben: { am: b.updatedAt, weg: 'sonst', sicher: false } }
    : { ...KEINE_EREIGNISSE };
}

/** Noch nichts geschehen, auch keine Frage gestellt. */
export function ohneEreignisse(e: HeftEreignisse): boolean {
  return (Object.keys(KEINE_EREIGNISSE) as (keyof HeftEreignisse)[]).every((k) => !e[k]);
}

/**
 * Einmal beim ersten Start von Hefta 2: Hefte aus Version 1 ohne eigene Ereignisse bekommen ihren Stand.
 * Für Geräte, auf denen die Umstellung schon vorher lief. Gibt nur die Hefte zurück, die sich ändern;
 * gelöscht wird nichts.
 */
export function hefteAusVersion1Einordnen(hefte: Heft[], bewerbungen: Bewerbung[]): Heft[] {
  const geaendert: Heft[] = [];
  for (const h of hefte) {
    if (!h.ausVersion1 || !ohneEreignisse(h.ereignisse)) continue;
    const b = bewerbungen.find(
      (x) =>
        x.haushaltId === h.haushaltId &&
        wohnungsSchluessel(x.adresse ?? '') === wohnungsSchluessel(h.adresse),
    );
    if (!b) continue;
    const ereignisse = ereignisseAusVersion1(b, h.adresse);
    if (!ohneEreignisse(ereignisse)) geaendert.push({ ...h, ereignisse });
  }
  return geaendert;
}

/** Ein Heft aus einer Bewerbung von Version 1, oder null, wenn sie keine Adresse hat. */
export function heftAusBewerbung(b: Bewerbung, id: () => string = neueId): Heft | null {
  const adresse = (b.adresse ?? '').trim();
  if (!adresse) return null;
  const heft: Heft = {
    id: id(),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    haushaltId: b.haushaltId,
    adresse,
    link: null,
    quelle: b.quelle ?? '',
    inseratText: b.inseratText ?? null,
    // Dieselbe Kennung wie in der Bewerbung: Eine Mappe für diese Wohnung trägt weiter dieselbe.
    kennung: b.kennungen?.[wohnungsSchluessel(adresse)] ?? id(),
    ereignisse: ereignisseAusVersion1(b, adresse),
    notiz: '',
    ausVersion1: true,
  };
  if (b.satz !== undefined) heft.satz = b.satz;
  if (b.bitteSatz !== undefined) heft.bitteSatz = b.bitteSatz;
  if (b.einzug !== undefined) heft.einzug = b.einzug;
  if (b.export !== undefined) heft.export = b.export;
  return heft;
}

/** Alle Hefte aus den Bewerbungen, in deren Reihenfolge. */
export function hefteAusBewerbungen(bewerbungen: Bewerbung[], id: () => string = neueId): Heft[] {
  return bewerbungen.map((b) => heftAusBewerbung(b, id)).filter((h): h is Heft => h !== null);
}

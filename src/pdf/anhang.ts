import type { Mitziehend } from '../domain/mappeWoerter';
import type { Rolle, Tag } from '../domain/modell';
import { adresseTeile, wohnungTeile, type WohnungTeile } from '../domain/adresse';
import type { ExportModus } from '../domain/export';
import type { Schritt } from '../domain/selbstauskunft';

// Die Lesehilfe für Vermieter: eine kleine JSON-Datei als Anhang in der Mappe (docs/format-hefta-json.md,
// Etappe 1 des Masterplans). Regel 1: Nur, was auf dem Deckblatt oder im Inhalt ohnehin lesbar steht.
// Regel 2: Ein Bonus, nie eine Voraussetzung; eine Mappe ohne Anhang ist dieselbe Mappe.
// Läuft ohne Browser-APIs, damit es unter Node getestet werden kann.

export const ANHANG_NAME = 'hefta.json';
/**
 * Fassung 2 seit dem 6.11.2026 (E6): Kennung der Bewerbung, Adresse in Teilen. Fassung 3 (E17, Aufgabe 51):
 * Telefon und Mail der Kontaktperson, wie auf dem Deckblatt. Bis zur ersten fremden Mappe ohne Rücksicht auf
 * ältere Fassungen (E21).
 */
export const ANHANG_FASSUNG = 3;
export interface AnhangPerson {
  name: string;
  rolle: Rolle;
  /** Diese Person steht als Kontakt auf dem Deckblatt. */
  kontakt?: true;
}

export interface AnhangKontakt {
  telefon?: string;
  email?: string;
}

export interface AnhangUnterlage {
  /** Index in `haushalt.personen`. */
  person: number;
  /** Kennung des Unterlagentyps aus dem Regelkatalog. */
  typ: string;
  /** Erste und letzte Seite in der Mappe. */
  seiten: [number, number];
  /** Bei Serien: die Monate, wie im Inhalt genannt. */
  monate?: string[];
  /** Ausstellungstag, wie im Inhalt genannt. */
  vom?: Tag;
  /** Wie ein Vermieter die Echtheit prüfen kann; aus dem Regelkatalog. */
  pruefweg?: 'pruefcode';
}

export interface HeftaAnhang {
  hefta: number;
  erstellt: Tag;
  bewerbung: {
    /** Seit Fassung 2: zufällige Kennung, gleich in jeder Fassung dieser Bewerbung um diese Wohnung. */
    kennung?: string;
    wohnung: { strasse: string; rest: string; teile?: WohnungTeile } | null;
  };
  haushalt: {
    personen: AnhangPerson[];
    /** Kinder und weitere Personen ohne Vertrag, wie auf dem Deckblatt. */
    mitziehende: Mitziehend[];
    /** Seit Fassung 3: Telefon und Mail der Person mit `kontakt`, genau wie auf dem Deckblatt. */
    kontakt?: AnhangKontakt;
  };
  unterlagen: AnhangUnterlage[];
  /** Gesamtzahl der Seiten: So fällt auf, wenn jemand Seiten entfernt hat. */
  seitenzahl?: number;
  modus?: ExportModus;
  schritt?: Schritt;
  loeschwunsch?: string;
}

/** Was der Anhang aus dem Auftrag und den fertigen Seitenzahlen braucht. */
export interface AnhangQuelle {
  datum: Date;
  /** Kennung der Bewerbung (E6). */
  kennung?: string;
  adresse: string[];
  personen: { name: string; rolle?: Rolle; buerge?: boolean }[];
  kontakt: boolean;
  /** Telefon und Mail, wie sie auf dem Deckblatt stehen (Fassung 3). */
  kontaktwege?: AnhangKontakt;
  mitziehende: Mitziehend[];
  unterlagen: {
    person: number;
    typ?: string;
    von: number;
    bis: number;
    monate?: string[];
    vom?: Tag;
    pruefweg?: 'pruefcode';
  }[];
  seitenzahl?: number;
  modus?: ExportModus;
  schritt?: Schritt;
  loeschwunsch?: string;
}

const tagAus = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function anhangBauen(q: AnhangQuelle): HeftaAnhang {
  const personen: AnhangPerson[] = q.personen.map((p, i) => ({
    name: p.name,
    rolle: p.rolle ?? (p.buerge ? 'buerge' : i === 0 ? 'hauptmieter' : 'mitmieter'),
    ...(q.kontakt && i === 0 ? { kontakt: true as const } : {}),
  }));
  // Im Format gewöhnliche Leerzeichen; das geschützte ist nur für den Umbruch auf dem Papier.
  const teile = q.adresse.length ? adresseTeile(q.adresse) : null;
  const getrennt = q.adresse.length ? wohnungTeile(q.adresse.join('\n')) : null;
  const wohnung = teile && {
    ...teile,
    rest: teile.rest.replace(/\u00a0/g, ' '),
    ...(getrennt ? { teile: getrennt } : {}),
  };
  const telefon = q.kontakt ? q.kontaktwege?.telefon?.trim() : undefined;
  const email = q.kontakt ? q.kontaktwege?.email?.trim() : undefined;
  const kontakt: AnhangKontakt | null =
    telefon || email ? { ...(telefon ? { telefon } : {}), ...(email ? { email } : {}) } : null;
  return {
    hefta: ANHANG_FASSUNG,
    erstellt: tagAus(q.datum),
    bewerbung: { ...(q.kennung ? { kennung: q.kennung } : {}), wohnung },
    haushalt: { personen, mitziehende: q.mitziehende, ...(kontakt ? { kontakt } : {}) },
    unterlagen: q.unterlagen
      .filter((u) => u.typ)
      .map((u) => ({
        person: u.person,
        typ: u.typ!,
        seiten: [u.von, u.bis] as [number, number],
        ...(u.monate?.length ? { monate: u.monate } : {}),
        ...(u.vom ? { vom: u.vom } : {}),
        ...(u.pruefweg ? { pruefweg: u.pruefweg } : {}),
      })),
    ...(q.seitenzahl ? { seitenzahl: q.seitenzahl } : {}),
    ...(q.modus ? { modus: q.modus } : {}),
    ...(q.modus === 'datensparsam' && q.schritt ? { schritt: q.schritt } : {}),
    ...(q.loeschwunsch?.trim() ? { loeschwunsch: q.loeschwunsch.trim() } : {}),
  };
}

export function anhangBytes(anhang: HeftaAnhang): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(anhang, null, 1));
}

/**
 * Liest einen Anhang. Neuere Fassungen werden angenommen, soweit die bekannten Felder stimmen; was
 * nicht nach einem Anhang aussieht, ergibt null. Nie eine Ausnahme: Ein PDF ohne Anhang ist normal.
 */
export function anhangLesen(bytes: Uint8Array): HeftaAnhang | null {
  try {
    const roh: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!roh || typeof roh !== 'object') return null;
    const a = roh as Record<string, unknown>;
    if (typeof a.hefta !== 'number' || a.hefta < 1) return null;
    const haushalt = a.haushalt as Record<string, unknown> | undefined;
    if (!Array.isArray(haushalt?.personen) || !Array.isArray(a.unterlagen)) return null;
    return a as unknown as HeftaAnhang;
  } catch {
    return null;
  }
}

/** Alle Texte des Anhangs, für die Prüfung „nur, was sichtbar ist“. */
export function anhangTexte(anhang: HeftaAnhang): string[] {
  const texte: string[] = [];
  const w = anhang.bewerbung.wohnung;
  if (w) texte.push(w.strasse, w.rest);
  if (w?.teile) texte.push(...Object.values(w.teile));
  for (const p of anhang.haushalt.personen) texte.push(p.name);
  for (const m of anhang.haushalt.mitziehende) texte.push(m.text);
  if (anhang.haushalt.kontakt?.telefon) texte.push(anhang.haushalt.kontakt.telefon);
  if (anhang.haushalt.kontakt?.email) texte.push(anhang.haushalt.kontakt.email);
  if (anhang.loeschwunsch) texte.push(anhang.loeschwunsch);
  return texte.filter(Boolean);
}

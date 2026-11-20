import {
  ANHANG_NAME,
  FASSUNG,
  lesen,
  telefonPasst,
  type Lesehilfe,
  type Person,
  type Unterlage,
} from '../../pakete/hefta-json/src/index';
import type { Mitziehend } from '../domain/mappeWoerter';
import type { Rolle, Tag } from '../domain/modell';
import { adresseTeile, wohnungTeile } from '../domain/adresse';
import type { ExportModus } from '../domain/export';
import type { Schritt } from '../domain/selbstauskunft';

// Die Lesehilfe für Vermieter: eine kleine JSON-Datei als Anhang in der Mappe. Fassung 1 (E218; PC98 bis PC116,
// E205 bis E227); Beschreibung, Typen, Lesen und Prüfen stehen im Paket `pakete/hefta-json/` (Apache-2.0).
// Regel 1: Nur, was auf dem Deckblatt, im Verzeichnis oder in den Eigenschaften der PDF ohnehin steht.
// Regel 2: Ein Bonus, nie eine Voraussetzung; eine Mappe ohne Anhang ist dieselbe Mappe.
// Regel 3: Kein Echtheitsnachweis. Läuft ohne Browser-APIs, damit es unter Node getestet werden kann.

export { ANHANG_NAME };
export const ANHANG_FASSUNG = FASSUNG;
export type HeftaAnhang = Lesehilfe;
export type AnhangPerson = Person;
export type AnhangUnterlage = Unterlage;
export const anhangLesen = lesen;

/** Was der Anhang aus dem Auftrag und den fertigen Seitenzahlen braucht. */
export interface AnhangQuelle {
  /** Zeitpunkt der Mappe; derselbe steht als Erstelldatum in den Eigenschaften der PDF. */
  datum: Date;
  /** Kennung der Bewerbung (E6). */
  kennung: string;
  /** Nummer der Fassung, wie auf dem Deckblatt („Fassung 2 vom …“). */
  fassung?: number;
  adresse: string[];
  /** Das Portal aus „Zu Ihrem Inserat auf …“ auf dem Deckblatt. */
  portal?: string;
  /** Frühester Einzug aus „Einzug möglich ab …“, `JJJJ-MM-TT`. */
  einzug?: Tag;
  personen: {
    name: string;
    /** Vor- und Nachname wie auf dem Deckblatt (nameImPdf); fehlen sie, steht der Name ganz im Vornamen. */
    vorname?: string;
    nachname?: string;
    rolle?: Rolle;
    buerge?: boolean;
  }[];
  /** Die erste Person steht als Kontakt auf dem Deckblatt. */
  kontakt: boolean;
  /** Telefon und Mail, wie sie auf dem Deckblatt stehen. */
  /** E222: `telefon` in fester Form, dazu die internationale Nummer aus der Eingabe (DP77). */
  kontaktwege?: { telefon?: string; telefonE164?: string; email?: string };
  mitziehende: Mitziehend[];
  unterlagen: {
    /** Stelle der Person in `personen`. */
    person: number;
    typ?: string;
    von: number;
    bis: number;
    monate?: string[];
    vom?: Tag;
    pruefweg?: 'pruefcode';
  }[];
  seitenzahl: number;
  modus?: ExportModus;
  schritt?: Schritt;
  loeschwunsch?: string;
}

const zwei = (n: number) => String(n).padStart(2, '0');

/** „2026-11-18T19:02:55+01:00“: der Zeitpunkt in der Zeit des Geräts, mit Zeitzone, auf die Sekunde. */
export function zeitpunktAus(d: Date): string {
  const versatz = -d.getTimezoneOffset();
  const vz = versatz >= 0 ? '+' : '-';
  const a = Math.abs(versatz);
  return (
    `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}` +
    `T${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}` +
    `${vz}${zwei(Math.floor(a / 60))}:${zwei(a % 60)}`
  );
}

export function anhangBauen(q: AnhangQuelle): HeftaAnhang {
  // Im Format gewöhnliche Leerzeichen; das geschützte ist nur für den Umbruch auf dem Papier.
  const nb = (s: string) => s.replace(/\u00a0/g, ' ');
  const teile = q.adresse.length ? adresseTeile(q.adresse) : null;
  const getrennt = q.adresse.length ? wohnungTeile(q.adresse.join('\n')) : null;
  const wohnung = teile && {
    strasse: teile.strasse,
    rest: nb(teile.rest),
    ...(getrennt ? { teile: { ...getrennt, land: 'DE' } } : {}),
  };
  const telefon = q.kontakt ? q.kontaktwege?.telefon?.trim() : undefined;
  const email = q.kontakt ? q.kontaktwege?.email?.trim() : undefined;
  // E222: Die Lesehilfe trägt die Nummer nur zusammen mit `telefon_e164` und nur in fester Form. Beide kommen aus
  // der Eingabe mit Land (DP77); passen sie nicht nach der Regel für Leser, bleibt die Nummer aus der Lesehilfe.
  const e164 = q.kontakt ? q.kontaktwege?.telefonE164?.trim() : undefined;
  const mitTelefon = !!telefon && !!e164 && telefonPasst(telefon, e164);
  const personen: Person[] = q.personen.map((p, i) => {
    const vorname = (p.vorname ?? p.name).trim();
    const nachname = p.vorname === undefined ? '' : (p.nachname ?? '').trim();
    return {
      name: `${vorname} ${nachname}`.trim(),
      vorname,
      nachname,
      rolle: p.rolle ?? (p.buerge ? 'buerge' : i === 0 ? 'hauptmieter' : 'mitmieter'),
      ...(q.kontakt && i === 0
        ? {
            kontakt: true as const,
            ...(mitTelefon ? { telefon, telefon_e164: e164 } : {}),
            ...(email ? { email } : {}),
          }
        : {}),
      unterlagen: [],
    };
  });
  for (const u of q.unterlagen) {
    const p = personen[u.person];
    if (!p || !u.typ) continue;
    p.unterlagen.push({
      typ: u.typ,
      seiten_mappe: { von: u.von, bis: u.bis },
      ...(u.monate?.length ? { monate: u.monate } : {}),
      ...(u.vom ? { vom: u.vom } : {}),
      ...(u.pruefweg ? { pruefweg: u.pruefweg } : {}),
    });
  }
  const portal = q.portal?.trim();
  return {
    hefta: ANHANG_FASSUNG,
    erstellt: zeitpunktAus(q.datum),
    fassung: q.fassung ?? 1,
    seitenzahl: q.seitenzahl,
    bewerbung: {
      kennung: q.kennung,
      wohnung,
      ...(portal ? { inserat: { portal } } : {}),
      ...(q.einzug ? { einzug: q.einzug } : {}),
    },
    haushalt: { personen, mitziehende: q.mitziehende },
    // V23: `modus` gehört nicht zu Fassung 1. E227: 2.0 schreibt keinen `schritt`.
    ...(q.loeschwunsch?.trim() ? { loeschwunsch: q.loeschwunsch.trim() } : {}),
  };
}

export function anhangBytes(anhang: HeftaAnhang): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(anhang, null, 1));
}

/** Alle Texte des Anhangs, für die Prüfung „nur, was sichtbar ist“ (Regel 1). */
export function anhangTexte(anhang: HeftaAnhang): string[] {
  const texte: string[] = [];
  const w = anhang.bewerbung.wohnung;
  if (w) texte.push(w.strasse, w.rest);
  if (w?.teile) {
    const { land: _land, ...sichtbar } = w.teile;
    void _land;
    texte.push(...Object.values(sichtbar));
  }
  if (anhang.bewerbung.inserat) texte.push(anhang.bewerbung.inserat.portal);
  for (const p of anhang.haushalt.personen) {
    texte.push(p.name, p.vorname ?? '', p.nachname ?? '');
    if (p.telefon) texte.push(p.telefon);
    if (p.email) texte.push(p.email);
  }
  for (const m of anhang.haushalt.mitziehende) texte.push(m.text);
  if (anhang.loeschwunsch) texte.push(anhang.loeschwunsch);
  return texte.filter(Boolean);
}

// Liest eine Lesehilfe `hefta.json`. Fassung 4 und neuere kommen, wie sie sind; Fassung 1 bis 3 werden in dasselbe
// Bild übertragen (Abschnitt 13 der Beschreibung). Was nicht nach einer Lesehilfe aussieht, ergibt null.
// Wirft nie: Ein PDF ohne oder mit kaputtem Anhang ist normal. Ob die Lesehilfe zur Mappe passt, prüft `passt()`.
import type { Lesehilfe, Person, Unterlage } from './typen.js';

type Roh = Record<string, unknown>;
const objekt = (v: unknown): v is Roh => !!v && typeof v === 'object' && !Array.isArray(v);

export function lesen(eingabe: string | Uint8Array): Lesehilfe | null {
  try {
    // U10: Eine BOM wird überlesen. TextDecoder entfernt sie bei Bytes von selbst.
    let text = typeof eingabe === 'string' ? eingabe : new TextDecoder().decode(eingabe);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const roh: unknown = JSON.parse(text);
    if (!objekt(roh)) return null;
    const hefta = roh.hefta;
    if (typeof hefta !== 'number' || !Number.isInteger(hefta) || hefta < 1) return null;
    if (!objekt(roh.haushalt) || !Array.isArray(roh.haushalt.personen)) return null;
    if (!objekt(roh.bewerbung)) return null;
    return hefta >= 4 ? ab4(roh) : bis3(roh);
  } catch {
    return null;
  }
}

function ab4(roh: Roh): Lesehilfe | null {
  const personen = (roh.haushalt as Roh).personen as unknown[];
  if (!personen.every((p) => objekt(p) && Array.isArray(p.unterlagen))) return null;
  return roh as unknown as Lesehilfe;
}

/** Fassung 1 bis 3: Unterlagen mit Nummer der Person, `seiten` als Paar, Kontaktdaten im Haushalt. */
function bis3(roh: Roh): Lesehilfe | null {
  const haushalt = roh.haushalt as Roh;
  const alte = haushalt.personen as unknown[];
  if (!Array.isArray(roh.unterlagen) || !alte.every(objekt)) return null;
  const personen: Person[] = (alte as Roh[]).map((p) => ({
    ...(p as unknown as Person),
    unterlagen: [],
  }));
  for (const u of roh.unterlagen as unknown[]) {
    if (!objekt(u) || !Number.isInteger(u.person)) return null;
    const p = personen[u.person as number];
    if (!p) return null;
    const { person: _nr, seiten, ...rest } = u;
    void _nr;
    const [von, bis] =
      Array.isArray(seiten) && seiten.length === 2 ? seiten : [Number.NaN, Number.NaN];
    p.unterlagen.push({ ...(rest as unknown as Unterlage), seiten_mappe: { von, bis } });
  }
  // Fassung 3: Telefon und Mail standen im Haushalt; sie gehören zur Person mit `kontakt`.
  const { kontakt, ...ohneKontakt } = haushalt;
  if (kontakt !== undefined) {
    const k = objekt(kontakt) ? kontakt : null;
    const person = personen.find((p) => p.kontakt);
    if (!k || !person || (k.telefon === undefined && k.email === undefined)) return null;
    if (k.telefon !== undefined) person.telefon = k.telefon as string;
    if (k.email !== undefined) person.email = k.email as string;
  }
  const { unterlagen: _alt, ...oben } = roh;
  void _alt;
  return {
    ...(oben as unknown as Lesehilfe),
    haushalt: { ...(ohneKontakt as unknown as Lesehilfe['haushalt']), personen },
  };
}

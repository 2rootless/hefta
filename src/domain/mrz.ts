// Zeilen unten auf Ausweis und Pass (maschinenlesbare Zone) nach der öffentlichen Norm ICAO 9303,
// Teil 3 (Prüfziffern), Teil 4 (TD3, zwei Zeilen zu 44), Teil 5 (TD1, drei Zeilen zu 30) und
// Teil 6 (TD2, zwei Zeilen zu 36). Nichts sonst fließt hier ein (PC58, Abschnitt 4).
//
// Diese Datei hat keine Importe, damit der Probelauf sie auch direkt mit Node laden kann.

export type MrzForm = 'TD1' | 'TD2' | 'TD3';

/** Ein Feld der Zeilen unten: Zeile (ab 0) und Zeichen von (einschließlich) bis (ausschließlich). */
export interface MrzStelle {
  zeile: number;
  von: number;
  bis: number;
}

export type MrzFeldName =
  | 'dokumentart'
  | 'aussteller'
  | 'name'
  | 'nummer'
  | 'nummerPruef'
  | 'geburt'
  | 'geburtPruef'
  | 'geschlecht'
  | 'ablauf'
  | 'ablaufPruef'
  | 'staat'
  | 'zusatz1'
  | 'zusatz2'
  | 'zusatzPruef'
  | 'gesamtPruef';

export interface MrzFeld extends MrzStelle {
  name: MrzFeldName;
  wert: string;
}

export type MrzGrund = 'form' | 'zeichen' | 'pruefziffer';

export type MrzErgebnis =
  | {
      ok: true;
      form: MrzForm;
      zeilen: string[];
      felder: MrzFeld[];
      /** Ausweisnummer ohne Füllzeichen. */
      nummer: string;
    }
  | { ok: false; grund: MrzGrund; form: MrzForm | null; zeilen: string[] };

const FORMEN: Record<MrzForm, { zeilen: number; laenge: number }> = {
  TD1: { zeilen: 3, laenge: 30 },
  TD2: { zeilen: 2, laenge: 36 },
  TD3: { zeilen: 2, laenge: 44 },
};

const ERLAUBT = /^[A-Z0-9<]+$/;

/** Wert eines Zeichens nach ICAO 9303 Teil 3: Ziffern 0–9, A–Z 10–35, Füllzeichen 0. */
function zeichenWert(c: string): number {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  return c.charCodeAt(0) - 55;
}

/** Prüfziffer nach ICAO 9303 Teil 3: Gewichte 7, 3, 1, Summe modulo 10. */
export function pruefziffer(text: string): string {
  const gewichte = [7, 3, 1];
  let summe = 0;
  for (let i = 0; i < text.length; i++)
    summe += zeichenWert(text.charAt(i)) * (gewichte[i % 3] ?? 0);
  return String(summe % 10);
}

function passt(text: string, ziffer: string, fuellErlaubt = false): boolean {
  // Ein Füllzeichen als Prüfziffer gibt es nur bei der leeren persönlichen Nummer im TD3 (Teil 4); dort steht es
  // für 0. Überall sonst ist ein Füllzeichen an der Stelle einer Prüfziffer falsch, auch wenn die Summe 0 wäre.
  if (ziffer === '<') return fuellErlaubt && /^<*$/.test(text);
  return pruefziffer(text) === ziffer;
}

/** Erkennt die Form an Zahl und Länge der Zeilen. */
export function mrzForm(zeilen: string[]): MrzForm | null {
  for (const [form, f] of Object.entries(FORMEN) as [
    MrzForm,
    { zeilen: number; laenge: number },
  ][]) {
    if (zeilen.length === f.zeilen && zeilen.every((z) => z.length === f.laenge)) return form;
  }
  return null;
}

function feld(
  name: MrzFeldName,
  zeilen: string[],
  zeile: number,
  von: number,
  bis: number,
): MrzFeld {
  return { name, zeile, von, bis, wert: (zeilen[zeile] ?? '').slice(von, bis) };
}

/**
 * Liest die Zeilen unten. Passt die Form nicht (Zahl oder Länge der Zeilen), fehlt ein Zeichen
 * oder stimmt eine Prüfziffer nicht, ist das Ergebnis nicht ok (Rückfall, E124 a und DP47b K4).
 */
export function mrzLesen(roh: string[]): MrzErgebnis {
  const zeilen = roh.map((z) => z.trim());
  const form = mrzForm(zeilen);
  if (!form) return { ok: false, grund: 'form', form: null, zeilen };
  if (!zeilen.every((z) => ERLAUBT.test(z))) return { ok: false, grund: 'zeichen', form, zeilen };

  const felder: MrzFeld[] = [];
  const pruefungen: [string, string, boolean?][] = [];
  let nummer: MrzFeld;

  if (form === 'TD1') {
    const a = zeilen[0] ?? '';
    const b = zeilen[1] ?? '';
    felder.push(feld('dokumentart', zeilen, 0, 0, 2), feld('aussteller', zeilen, 0, 2, 5));
    if (a.charAt(14) === '<' && a.slice(15).replace(/<+$/, '').length > 1) {
      // Lange Nummer (Teil 5, Anmerkung j): Die Nummer geht im Zusatzfeld weiter, ihre Prüfziffer
      // ist das letzte Zeichen davor.
      const rest = a.slice(15).replace(/<+$/, '');
      const ende = 15 + rest.length;
      nummer = feld('nummer', zeilen, 0, 5, ende - 1);
      const wert = a.slice(5, 14) + a.slice(15, ende - 1);
      nummer = { ...nummer, wert };
      felder.push(nummer, feld('nummerPruef', zeilen, 0, ende - 1, ende));
      pruefungen.push([wert, a.charAt(ende - 1)]);
      if (ende < 30) felder.push(feld('zusatz1', zeilen, 0, ende, 30));
    } else {
      nummer = feld('nummer', zeilen, 0, 5, 14);
      felder.push(
        nummer,
        feld('nummerPruef', zeilen, 0, 14, 15),
        feld('zusatz1', zeilen, 0, 15, 30),
      );
      pruefungen.push([a.slice(5, 14), a.charAt(14)]);
    }
    felder.push(
      feld('geburt', zeilen, 1, 0, 6),
      feld('geburtPruef', zeilen, 1, 6, 7),
      feld('geschlecht', zeilen, 1, 7, 8),
      feld('ablauf', zeilen, 1, 8, 14),
      feld('ablaufPruef', zeilen, 1, 14, 15),
      feld('staat', zeilen, 1, 15, 18),
      feld('zusatz2', zeilen, 1, 18, 29),
      feld('gesamtPruef', zeilen, 1, 29, 30),
      feld('name', zeilen, 2, 0, 30),
    );
    pruefungen.push(
      [b.slice(0, 6), b.charAt(6)],
      [b.slice(8, 14), b.charAt(14)],
      [a.slice(5, 30) + b.slice(0, 7) + b.slice(8, 15) + b.slice(18, 29), b.charAt(29)],
    );
  } else {
    const b = zeilen[1] ?? '';
    const td3 = form === 'TD3';
    const ende = td3 ? 44 : 36;
    felder.push(
      feld('dokumentart', zeilen, 0, 0, 2),
      feld('aussteller', zeilen, 0, 2, 5),
      feld('name', zeilen, 0, 5, ende),
    );
    nummer = feld('nummer', zeilen, 1, 0, 9);
    felder.push(
      nummer,
      feld('nummerPruef', zeilen, 1, 9, 10),
      feld('staat', zeilen, 1, 10, 13),
      feld('geburt', zeilen, 1, 13, 19),
      feld('geburtPruef', zeilen, 1, 19, 20),
      feld('geschlecht', zeilen, 1, 20, 21),
      feld('ablauf', zeilen, 1, 21, 27),
      feld('ablaufPruef', zeilen, 1, 27, 28),
    );
    pruefungen.push(
      [b.slice(0, 9), b.charAt(9)],
      [b.slice(13, 19), b.charAt(19)],
      [b.slice(21, 27), b.charAt(27)],
    );
    if (td3) {
      // Persönliche Nummer mit eigener Prüfziffer (Teil 4).
      felder.push(feld('zusatz2', zeilen, 1, 28, 42), feld('zusatzPruef', zeilen, 1, 42, 43));
      pruefungen.push([b.slice(28, 42), b.charAt(42), true]);
      felder.push(feld('gesamtPruef', zeilen, 1, 43, 44));
      pruefungen.push([b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43), b.charAt(43)]);
    } else {
      felder.push(feld('zusatz2', zeilen, 1, 28, 35), feld('gesamtPruef', zeilen, 1, 35, 36));
      pruefungen.push([b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 35), b.charAt(35)]);
    }
  }

  if (!pruefungen.every(([text, ziffer, fuell]) => passt(text, ziffer, fuell))) {
    return { ok: false, grund: 'pruefziffer', form, zeilen };
  }
  return { ok: true, form, zeilen, felder, nummer: nummer.wert.replace(/<+$/, '') };
}

/** Baut Zeilen im TD1 mit gerechneten Prüfziffern, für Musterpapiere und Tests (nur erfundene Daten). */
export function td1Bauen(d: {
  art: string;
  aussteller: string;
  nummer: string;
  geburt: string;
  geschlecht: string;
  ablauf: string;
  staat: string;
  name: string;
  zusatz1?: string;
  zusatz2?: string;
}): string[] {
  const fuellen = (t: string, n: number) => t.padEnd(n, '<').slice(0, n);
  const a =
    fuellen(d.art, 2) +
    fuellen(d.aussteller, 3) +
    fuellen(d.nummer, 9) +
    pruefziffer(fuellen(d.nummer, 9)) +
    fuellen(d.zusatz1 ?? '', 15);
  const b0 =
    d.geburt +
    pruefziffer(d.geburt) +
    fuellen(d.geschlecht, 1) +
    d.ablauf +
    pruefziffer(d.ablauf) +
    fuellen(d.staat, 3) +
    fuellen(d.zusatz2 ?? '', 11);
  const b = b0 + pruefziffer(a.slice(5, 30) + b0.slice(0, 7) + b0.slice(8, 15) + b0.slice(18, 29));
  return [a, b, fuellen(d.name, 30)];
}

/** Baut Zeilen im TD3 mit gerechneten Prüfziffern, für Musterpapiere und Tests (nur erfundene Daten). */
export function td3Bauen(d: {
  art: string;
  aussteller: string;
  name: string;
  nummer: string;
  staat: string;
  geburt: string;
  geschlecht: string;
  ablauf: string;
  persoenlich?: string;
}): string[] {
  const fuellen = (t: string, n: number) => t.padEnd(n, '<').slice(0, n);
  const a = fuellen(d.art, 2) + fuellen(d.aussteller, 3) + fuellen(d.name, 39);
  const nr = fuellen(d.nummer, 9);
  const pn = fuellen(d.persoenlich ?? '', 14);
  const b0 =
    nr +
    pruefziffer(nr) +
    fuellen(d.staat, 3) +
    d.geburt +
    pruefziffer(d.geburt) +
    fuellen(d.geschlecht, 1) +
    d.ablauf +
    pruefziffer(d.ablauf) +
    pn +
    pruefziffer(pn);
  const b = b0 + pruefziffer(b0.slice(0, 10) + b0.slice(13, 20) + b0.slice(21, 43));
  return [a, b];
}

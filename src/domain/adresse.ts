// Wie die eingegebene Adresse auf dem Deckblatt und in „Mappe erstellen“ steht (design/mappe-pdf.md,
// „Deckblatt neu“): Straße und Hausnummer groß, Lage im Haus und Ort klein darunter.

export function adresseZeilen(adresse: string): string[] {
  return adresse
    .split(/\n/)
    .map((zeile) => zeile.trim())
    .filter(Boolean);
}

/** Postleitzahl und Ort, „3. OG“: Das bricht nicht auseinander (ME9). */
function zusammenhalten(text: string): string {
  return text
    .replace(/(?<!\d)(\d{5}) (?=\p{L})/gu, '$1\u00a0')
    .replace(/(\d+\.) (?=(?:OG|UG|EG|DG|Stock|Etage|Obergeschoss)\b)/g, '$1\u00a0');
}

/** Erste Zeile bis zum ersten Komma groß, der Rest der ersten Zeile und alle weiteren Zeilen klein. */
export function adresseTeile(zeilen: string[]): { strasse: string; rest: string } {
  const [erste = '', ...weitere] = zeilen;
  const komma = erste.indexOf(',');
  const strasse = (komma < 0 ? erste : erste.slice(0, komma)).trim();
  const lage = komma < 0 ? '' : erste.slice(komma + 1).trim();
  return { strasse, rest: zusammenhalten([lage, ...weitere].filter(Boolean).join(' · ')) };
}

/** Die Adresse in getrennten Teilen, aus dem freien Feld gelesen (E6). Das freie Feld bleibt maßgeblich. */
export interface WohnungTeile {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  /** Alles Weitere: Lage im Haus, Hinterhaus, Wohnungsnummer. */
  lage: string;
}

/**
 * „Hauptstraße 12, 3. OG links / 22767 Hamburg“ → Straße, Nummer, Lage, Postleitzahl, Ort. Erste Angabe
 * Straße mit Nummer, eine Angabe mit fünfstelliger Postleitzahl ist der Ort, alles andere die Lage.
 * Ohne erkennbare Hausnummer null: Dann gibt es nur das freie Feld.
 */
export function wohnungTeile(adresse: string): WohnungTeile | null {
  const stuecke = adresse
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const erste = /^(.*\S)\s+(\d+(?:\s*[a-zA-Z])?(?:\s*[-–/]\s*\d+(?:\s*[a-zA-Z])?)?)$/.exec(
    stuecke[0] ?? '',
  );
  if (!erste) return null;
  let plz = '';
  let ort = '';
  const lage: string[] = [];
  for (const stueck of stuecke.slice(1)) {
    const ortTreffer = /^(?:D-)?(\d{5})\s+(.+)$/.exec(stueck);
    if (ortTreffer && !plz) {
      plz = ortTreffer[1]!;
      ort = ortTreffer[2]!.trim();
    } else lage.push(stueck);
  }
  return {
    strasse: erste[1]!,
    hausnummer: erste[2]!.replace(/\s+/g, ''),
    plz,
    ort,
    lage: lage.join(', '),
  };
}

const glatt = (text: string) =>
  text
    .toLowerCase()
    .replace(/straße|strasse|str\./g, 'str')
    .replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Schlüssel einer Wohnung, für die Kennung der Bewerbung: gleich bei anderer Schreibweise von Straße,
 * Leerzeichen und Satzzeichen, verschieden bei anderer Nummer, Lage oder Postleitzahl.
 */
export function wohnungsSchluessel(adresse: string): string {
  const t = wohnungTeile(adresse);
  if (!t) return glatt(adresse);
  return [t.strasse, t.hausnummer, t.plz, t.lage].map(glatt).join('|');
}

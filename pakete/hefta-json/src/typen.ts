// Das Bild einer Lesehilfe `hefta.json` nach Fassung 1 (E218; Beschreibung: FORMAT.md und README.md).

export type Rolle = 'hauptmieter' | 'mitmieter' | 'buerge';
export type MitziehendArt = 'kind' | 'erwachsen';
export type Schritt = 'besichtigung' | 'will_wohnung' | 'zusage';

/** Wie eine Unterlage in die Mappe übernommen wurde (DP64). Seiten zählen im Original. */
export interface Vermerk {
  art: string;
  seiten_original?: number[];
  /** Bei Unterlagen aus mehreren Dateien: welche, ab 1, in der Reihenfolge der Mappe. */
  datei?: number;
  /** Bei Serien: der Monat dieser Datei, `JJJJ-MM`. */
  monat?: string;
}

export interface Unterlage {
  /** Art der Unterlage; feste Liste in `TYPEN`. */
  typ: string;
  /** Erste und letzte Seite in der Mappe. */
  seiten_mappe: { von: number; bis: number };
  monate?: string[];
  vom?: string;
  pruefweg?: string;
  vermerke?: Vermerk[];
}

export interface Person {
  /** Der volle Name wie auf dem Deckblatt; gleich `vorname`, Leerzeichen, `nachname`. */
  name: string;
  /** Pflicht in Fassung 1. */
  vorname?: string;
  /** Pflicht in Fassung 1; darf leer sein. */
  nachname?: string;
  rolle: Rolle;
  /** Diese Person steht als Kontakt auf dem Deckblatt; höchstens eine. */
  kontakt?: true;
  telefon?: string;
  /** Dasselbe Telefon international; steht genau dann, wenn `telefon` steht (E222, L78-2). */
  telefon_e164?: string;
  email?: string;
  unterlagen: Unterlage[];
}

export interface Mitziehend {
  text: string;
  anzahl: number;
  art: MitziehendArt;
}

export interface WohnungTeile {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  lage: string;
  /** ISO 3166-1, zwei Buchstaben; Hefta schreibt `DE`. */
  land?: string;
}

export interface Wohnung {
  strasse: string;
  rest: string;
  teile?: WohnungTeile;
}

export interface Lesehilfe {
  /** Fassung des Formats. */
  hefta: number;
  /** Zeitpunkt mit Zeitzone, gleich dem Erstelldatum der PDF (V11). */
  erstellt: string;
  /** Nummer der Fassung der Mappe, wie auf dem Deckblatt (V7). */
  fassung: number;
  seitenzahl: number;
  bewerbung: {
    kennung: string;
    wohnung: Wohnung | null;
    inserat?: { portal: string };
    einzug?: string;
  };
  haushalt: {
    personen: Person[];
    mitziehende: Mitziehend[];
  };
  /** E227: nur mit dem festen Satz auf dem Deckblatt; 2.0 schreibt es nicht. */
  schritt?: Schritt;
  loeschwunsch?: string;
}

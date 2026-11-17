// Das Bild einer Lesehilfe `hefta.json` nach Fassung 4 (Beschreibung: README.md und docs/format-hefta-json.md).
// Fassung 1 bis 3 liest `lesen()` in dasselbe Bild; dann fehlen `vorname`, `nachname` und `fassung`.

export type Rolle = 'hauptmieter' | 'mitmieter' | 'buerge';
export type MitziehendArt = 'kind' | 'erwachsen';
export type Modus = 'alles' | 'marktueblich' | 'datensparsam' | 'eigene_auswahl';
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
  /** Ab Fassung 4. */
  vorname?: string;
  /** Ab Fassung 4; darf leer sein. */
  nachname?: string;
  rolle: Rolle;
  /** Diese Person steht als Kontakt auf dem Deckblatt; höchstens eine. */
  kontakt?: true;
  telefon?: string;
  /** Dasselbe Telefon international, nur wenn eindeutig (Fassung 4). */
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
  /** Ab Fassung 4: ISO 3166-1, zwei Buchstaben; Hefta schreibt `DE`. */
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
  /** Ab Fassung 4 Zeitpunkt mit Zeitzone, davor nur der Tag. */
  erstellt: string;
  /** Ab Fassung 4: Nummer der Fassung, wie auf dem Deckblatt. */
  fassung?: number;
  seitenzahl?: number;
  bewerbung: {
    kennung?: string;
    wohnung: Wohnung | null;
    inserat?: { portal: string };
    einzug?: string;
  };
  haushalt: {
    personen: Person[];
    mitziehende: Mitziehend[];
  };
  modus?: Modus;
  schritt?: Schritt;
  loeschwunsch?: string;
}

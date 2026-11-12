// Datenmodell nach docs/03-datenmodell.md. Bindend sind die Beziehungen:
// Personen und Dokumente pflegt man einmal; Haushalte und Bewerbungen verweisen darauf.
// Alles, was „später“ ist, hat hier schon Felder, aber noch keine Oberfläche.

export type Id = string;
/** Zeitpunkt als ISO-Text (UTC), z. B. „2026-10-31T09:00:00.000Z“. */
export type Zeitpunkt = string;
/** Kalendertag als „JJJJ-MM-TT“. */
export type Tag = string;
/** Monat als „JJJJ-MM“. */
export type Monat = string;

export interface Basis {
  id: Id;
  createdAt: Zeitpunkt;
  updatedAt: Zeitpunkt;
}

export type Lebenssituation =
  'angestellt' | 'selbststaendig' | 'studierend_azubi' | 'rente' | 'leistungsbezug' | 'sonstiges';

/** Gewünschte Form der Rollenbezeichnung (Entscheidung F). Kein Geschlecht. */
export type Bezeichnung = 'maennlich' | 'weiblich' | 'neutral';

export type Rolle = 'hauptmieter' | 'mitmieter' | 'buerge';

export type AusbildungArt = 'studium' | 'ausbildung';

export interface Person extends Basis {
  vorname: string;
  nachname: string;
  /** Wie Hefta die Person anspricht, z. B. „Maximilian“ für „Maximilian-Alexander“ (Begrüßung). */
  rufname: string;
  /** Name in lateinischen Buchstaben, wie im Pass, wenn das PDF den eingetragenen nicht schreiben kann (K8). */
  nameMappe?: { vorname: string; nachname: string } | null;
  /** `anschrift`: freiwillig, nur für die Nachricht ans Inserat, wenn es danach fragt. */
  kontakt: { telefon: string; email: string; anschrift?: string };
  lebenssituation: Lebenssituation | null;
  /** Bei „studierend_azubi“: was es genau ist; fehlt bei älteren Daten. */
  ausbildungArt?: AusbildungArt | null;
  beruf: string;
  arbeitgeber: string;
  nettoeinkommen: number | null;
  abrechnungMeist: 'anfang' | 'mitte' | 'ende' | null;
  /** Antworten der Selbstauskunft (M4); fehlt bei älteren Daten und wird dann leer gelesen. */
  selbstauskunft?: import('./selbstauskunft').Selbstauskunft;
}

export type MappenAkzent = 'tanne' | 'schiefer' | 'bordeaux' | 'graphit';
export type MappenSchrift = 'archivo' | 'source_serif' | 'plex_sans';

/** Die helle Fläche hinter „Wer einzieht“ (design/mappe-feinschliff.md, § 4b). */
export type MappenFlaeche = 'personen' | 'akzent' | 'grau' | 'keine';

/** Aussehen der PDF-Mappe (design/mappe-pdf.md, „Schlicht statt Kopfband“). */
export interface MappenAussehen {
  art: 'schlicht' | 'einefarbe' | 'personen';
  /** Bei „Eine Farbe“; bleibt beim Wechsel der Art, die Fläche kann sie weiter nutzen. */
  akzent?: MappenAkzent;
  /** Schrift der eigenen Seiten; fehlt sie, gilt Archivo (mappe-feinschliff.md, § 3). */
  schrift?: MappenSchrift;
  /** Deckblatt bis 0,85 kleiner, wenn es so auf eine Seite passt (§ 4). */
  kompakt?: boolean;
  /** Fehlt sie, folgt die Fläche der Art (`flaecheVon`). */
  flaeche?: MappenFlaeche;
}

export interface Haushalt extends Basis {
  name: string;
  notiz: string;
  kinder: number;
  /** Erwachsene ohne Mietvertrag, nur gezählt (Entscheidung E). */
  weitereErwachsene: number;
  /** Selbstauskunft, für den ganzen Haushalt einmal (design: Akkordeon, Teil 4). */
  haustiere?: import('./selbstauskunft').JaNein;
  haustiereText?: string;
  /** Ort für „Ort, Datum“ in jedem Bogen. */
  ort?: string;
  /**
   * B26 (E93): Der Haushalt ist angefangen, aber nicht fertig angelegt. Gesetzt mit der ersten Person,
   * gelöscht mit „Haushalt anlegen“ oder „Niemand weiter“. Fehlt das Feld, gilt er als fertig (ältere Daten).
   */
  einrichtungOffen?: boolean;
  /** Gilt für alle Bewerbungen des Haushalts; fehlt es, gilt `AUSSEHEN_STANDARD`. */
  mappeAussehen?: MappenAussehen;
  /** Wer die Haushaltsangaben zuletzt eingetragen hat (Person-ID), für „Von Max: …“. */
  angabenVon?: string;
  /** Version 2: Nettoeinkommen des Haushalts, selbst eingetragen; fehlt es, gilt die Summe aus den Selbstauskünften. */
  netto?: number | null;
  /** Hefta 2: eigene Grenze für die Miete in Prozent des Nettos (E36); fehlt sie, gibt es nur den Anteil. */
  mietgrenze?: number | null;
  /** Hefta 2: Wünsche an die Wohnung, je Haushalt (E53); fehlen sie, gibt es keine Urteile. */
  wuensche?: import('./urteile').Wuensche | null;
}

export interface Zugehoerigkeit extends Basis {
  haushaltId: Id;
  personId: Id;
  rolle: Rolle;
  /** Wie es auf der Karte steht („Hauptmieterin“, „Mitmietpartei“); gilt nur in diesem Haushalt. */
  bezeichnung: Bezeichnung;
  /** Personenfarbe 1 bis 4 in diesem Haushalt (design/person-und-haushalt.md, Abschnitt 1). */
  farbe: number;
  reihenfolge: number;
  /** Aus dem Haushalt genommen (Tag als ISO-Zeit); Person und Unterlagen bleiben erhalten. */
  herausgenommenAm?: string | null;
  /** E3d: Die Frage „Seit drei Monaten herausgenommen …“ wurde mit „Behalten“ beantwortet; nie wieder. */
  behalten?: boolean;
}

export interface Dokument extends Basis {
  personId: Id;
  /**
   * Nur bei Typen mit `jeHaushalt` (Bürgschaftserklärung, E53): die Zugehörigkeit, für die sie gilt.
   * Leer, solange die Person nur in einem Haushalt ist; kommt sie in einen zweiten, bekommt die
   * Erklärung die Zugehörigkeit des ersten (`personAufnehmen`).
   */
  zugehoerigkeitId?: Id | null;
  /** ID des Dokumenttyps aus dem Regelkatalog. */
  typ: string;
  notiz: string;
  serie: number | null;
  stummBis: Tag | null;
  /** Für „höchstens zweimal pro Monat fragen“: in welchem Monat zuletzt „Noch nicht“, wie oft. */
  stummMonat?: Monat | null;
  stummAnzahl?: number;
}

export interface Schwaerzung {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/** Was auf einer Seite der Datei steht, nur für die Prüfhinweise. */
export interface SeitenFakten {
  /** Abrechnungsmonat im Text, falls eindeutig. */
  monat: Monat | null;
  /** „Seite 1 von 2“. */
  von: [number, number] | null;
  /** Kein Text und fast weiß, etwa die Rückseite im Scan. */
  leer: boolean;
  /** Prüfsumme des Texts, um dieselbe Seite wiederzufinden; null bei wenig Text. */
  textHash: string | null;
  /** Wörter der Seite ohne Reihenfolge, um Namen und falsche Unterlagen zu erkennen. */
  woerter: string[];
}

export interface VersionFakten {
  stand: number;
  /** SHA-256 der hochgeladenen Datei. */
  hash: string | null;
  seiten: SeitenFakten[];
}

export interface DateiVersion extends Basis {
  dokumentId: Id;
  /** Name der hochgeladenen Datei; fehlt bei älteren Versionen. */
  dateiname?: string | null;
  ausstellungsdatum: Tag | null;
  abrechnungsmonat: Monat | null;
  /** Bei Typen mit Alternative, z. B. 'gehaltsabrechnung' | 'kontoauszug'. */
  variante: string | null;
  original: Id;
  aufbereitet: Id | null;
  /** Seiten, die in die Mappe kommen; null: alle Seiten der Version. */
  seiten: number[] | null;
  /**
   * Seiten der Datei, die zu dieser Version gehören (Nummern wie bei `seiten`). Fehlt: alle. Mehrere
   * Versionen können sich eine Datei teilen und je eigene Seiten haben (design/nachtraeglich-ordnen.md).
   */
  eigene?: number[] | null;
  schwaerzungen: Record<number, Schwaerzung[]>;
  gerastert: boolean;
  /** Was Hefta in der Datei gesehen hat; null: noch nicht nachgesehen (design/nachtraeglich-ordnen.md). */
  erkannteWerte: VersionFakten | null;
  /** Prüfungen, zu denen „Passt so“ gesagt wurde: gilt für immer. */
  vomNutzerBestaetigt: string[] | null;
}

export type ExportModus = 'alles' | 'marktueblich' | 'datensparsam' | 'eigene_auswahl';
export type Schritt = 'besichtigung' | 'will_wohnung' | 'zusage';

export interface Exportprofil extends Basis {
  modus: ExportModus;
  schritt: Schritt | null;
  auswahl: Record<string, boolean>;
}

export interface Bewerbung extends Basis {
  haushaltId: Id;
  adresse: string;
  quelle: string;
  inseratText: string | null;
  anrede: string;
  ansprechpartner: string;
  /** IDs der Zugehörigkeiten, die mitgehen. */
  personen: Id[];
  exportprofilId: Id | null;
  verwendeteVersionen: Id[];
  bestandteile: {
    deckblatt: boolean;
    inhaltsverzeichnis: boolean;
    anschreiben: boolean;
    fusszeile: boolean;
  };
  dateiname: string | null;
  kontakt: { name: string; telefon: string; email: string } | null;
  /** Version 2 (Bewerbungs-Tracker): aktueller Stand; null bei Bewerbungen aus Version 1. */
  status: import('./bewerbungen').BewerbungsStatus | null;
  /** Version 2: jeder Statuswechsel mit Zeitpunkt, ältester zuerst. */
  verlauf?: { status: import('./bewerbungen').BewerbungsStatus; am: Zeitpunkt }[];
  /** Version 2: Anschreiben zu dieser Wohnung (Text mit Platzhaltern). */
  anschreiben: import('./anschreiben').Anschreiben | null;
  /** Version 2: Miete der Wohnung in Euro, für die Rechenhilfe Mietanteil. */
  miete?: { kalt: number | null; warm: number | null };
  /** Ein Satz fürs Deckblatt (freiwillig). */
  satz?: string;
  /** Eigener Satz für die Bitte zum Löschen; fehlt er, gilt der Vorschlag. Ob sie an ist, steht in `export`. */
  bitteSatz?: string;
  /** „Einzug ab“, freiwillig und frei formuliert. Steht nur in der Nachricht ans Inserat, wenn es fragt. */
  einzug?: string;
  /**
   * Lesehilfe (E6): zufällige Kennung je Wohnung, damit ein Vermieter nachgeschickte Mappen derselben
   * Bewerbung zuordnen kann. Schlüssel ist `wohnungsSchluessel` der Adresse; verrät nichts über Personen.
   */
  kennungen?: Record<string, string>;
  /** Mappe erstellen: Modus, Schritt, Auswahl, Ausgabe (gilt nur für diese Bewerbung). */
  export?: import('./export').ExportEinstellungen;
}

/**
 * Hefta 2 (Schema 2): eine Wohnung als Heft (Bericht 61, docs/32-bauplan-hefta-2-schritt-1.md). Der Stand
 * steht hier nicht; er rechnet sich aus den Ereignissen (E43). Ein Heft geht auch ohne Haushalt (E45).
 */
export interface Heft extends Basis {
  haushaltId: Id | null;
  /** Wie die Adresse in Version 1: erste Zeile Straße und Lage, zweite Postleitzahl und Ort. */
  adresse: string;
  /** Link zum Inserat; Hefta lädt ihn nie selbst. */
  link: string | null;
  quelle: string;
  inseratText: string | null;
  /** Lesehilfe (E6): Kennung dieser Wohnung, gleich in jeder Fassung der Mappe. */
  kennung: string;
  ereignisse: HeftEreignisse;
  notiz: string;
  /** Ein Satz fürs Deckblatt, die Bitte zum Löschen und „Einzug ab“, wie bisher an der Bewerbung. */
  satz?: string;
  bitteSatz?: string;
  einzug?: string;
  /** Die Mappe für diese Wohnung; fehlt sie, gelten die Einstellungen des Haushalts. */
  export?: import('./export').ExportEinstellungen;
  /** Bei der Umstellung auf Hefta 2 aus einer Bewerbung von Version 1 entstanden. */
  ausVersion1?: true;
  /**
   * Angaben aus dem Inserat, bestätigt in der letzten Kontrolle (B23). Fehlt das Feld, gibt es nur die
   * Adresse, etwa bei Heften aus Version 1. IndexedDB braucht dafür kein neues Schema.
   */
  angaben?: HeftAngaben;
  /** Fragen für die Besichtigung (E52): Häkchen, Antworten und eigene Fragen dieses Hefts. */
  fragen?: import('./besichtigungsFragen').HeftFragen;
}

/** Was Hefta aus einem Inserat übernimmt; jeder Wert ist bestätigt oder selbst eingetragen. */
export interface HeftAngaben {
  /** Überschrift des Inserats. */
  titel: string | null;
  /** Kurzer Name des Hefts, etwa „Altbau mit Garten“ (Merkmal, B16); fehlt er, gilt der Titel. */
  merkmal?: string | null;
  stadtteil: string | null;
  warm: number | null;
  /** Warmmiete nur geschätzt (Portal oder gerechnet): „ca.“ davor. */
  warmCa?: boolean;
  kalt?: number | null;
  nebenkosten?: number | null;
  heizkosten?: number | null;
  kaution?: number | null;
  /**
   * Staffel- oder Indexmiete laut Inserat: nur ein Hinweis, kein Urteil (B23). „fest“ nur, wenn jemand es
   * in der Kontrolle gewählt hat (Planung 12d); null: das Inserat sagt nichts dazu.
   */
  mietart?: 'staffel' | 'index' | 'fest' | null;
  zimmer: number | null;
  flaeche: number | null;
  flaecheCa?: boolean;
  /** „JJJJ-MM-TT“ */
  einzug?: string | null;
  tiere?: 'erlaubt' | 'anfrage' | 'nicht' | null;
  /** „unbefristet“, „2 Jahre“ */
  befristung?: string | null;
  anbieter?: string | null;
  /** Portal, auf dem das Inserat stand, etwa „ImmoScout24“. */
  portal?: string | null;
}

/** Was mit einem Heft geschah, jeweils mit Zeitpunkt; null: noch nicht. */
export interface HeftEreignisse {
  /** Eine Mappe ging hinaus. `sicher`: Das System hat das Senden gemeldet (Mailfenster unter iOS). */
  beworben: { am: Zeitpunkt; weg: 'mail' | 'portal' | 'website' | 'sonst'; sicher: boolean } | null;
  /** Die einmalige Frage „Stimmt der Stand?“ wurde gestellt (B16). */
  gefragtAm: Zeitpunkt | null;
  termin: {
    am: Zeitpunkt;
    ort: string;
    treffpunkt: string;
    /** „In den Kalender“ wurde für diesen Termin benutzt (E91 Nachtrag); bleibt beim Ändern. */
    imKalender?: true;
  } | null;
  ergebnis: { art: 'zusage' | 'absage' | 'nicht_mehr'; am: Zeitpunkt } | null;
  loeschbitteAm: Zeitpunkt | null;
  nachgefasstAm: Zeitpunkt | null;
  abgelegtAm: Zeitpunkt | null;
}

export const KEINE_EREIGNISSE: HeftEreignisse = {
  beworben: null,
  gefragtAm: null,
  termin: null,
  ergebnis: null,
  loeschbitteAm: null,
  nachgefasstAm: null,
  abgelegtAm: null,
};

export interface Einstellungen {
  id: 'app';
  updatedAt: Zeitpunkt;
  letztesBackup: Zeitpunkt | null;
  speicherAngefragt: boolean;
  homescreenHinweisGezeigt: boolean;
  /** G4b: „Später“ gesagt; Hefta fragt höchstens noch einmal, wenn der Haushalt angelegt ist. */
  homescreenSpaeter?: boolean;
  ohnePasswortHinweisGezeigt: boolean;
  sprache: 'de';
  fristen: Record<string, { hinweisTage?: number; warnungTage?: number }>;
  /** Laufender oder pausierter Rutsch („Weitermachen · 2 von 5“); null, wenn keiner läuft. */
  rutsch?: import('./rutsch').RutschStand | null;
  /** Version 2: gewählter Haushalt, wenn es mehrere gibt; fehlt er, gilt der älteste. */
  aktiverHaushalt?: Id | null;
  /** Hefta 2: Hefte aus Version 1 sind eingeordnet (Nachricht 10.11. l), einmal beim ersten Start. */
  version1Eingeordnet?: Zeitpunkt;
  /** Rückmeldung (E54): abgeschickte Antworten je Frage, nur auf dem Gerät, damit Hefta „Deine Antwort“ zeigt. */
  rueckmeldung?: Partial<Record<import('../rueckmeldung/fragen').Frage, string>>;
  /** Moment im Heft (B19): einmal gezeigt, abgeschickt oder „Nicht mehr fragen“. */
  rueckmeldungMomentFertig?: boolean;
  /** Eigene Fragen für die Besichtigung (E52): gehören zum Gerät, nicht zum Haushalt (Planung 10i). */
  eigeneFragen?: string[];
  /**
   * Ausgeblendete Fragen von Hefta (E92, vorbereitet, noch ohne Oberfläche): fehlen in allen Heften, außer
   * dort schon beantwortet.
   */
  ausgeblendeteFragen?: import('./besichtigungsFragen').AusgeblendeteFrage[];
}

/** Eine gespeicherte Datei. `daten` ist ein Blob oder, wo Blobs nicht gehen, ein ArrayBuffer. */
export interface DateiEintrag {
  id: Id;
  createdAt: Zeitpunkt;
  typ: string;
  groesse: number;
  daten: Blob | ArrayBuffer;
}

/** Vorbelegung des Rufnamens: Vorname bis zum ersten Leerzeichen oder Bindestrich. */
/** Solange niemand etwas gewählt hat: die Balken in den Farben der Personen (Rückmeldung vom 4.11.). */
export const AUSSEHEN_STANDARD: MappenAussehen = { art: 'personen' };

export function rufnameAus(vorname: string): string {
  return vorname.trim().split(/[\s-]/)[0] ?? '';
}

/** Rufname nach einer Änderung des Vornamens: Er folgt, außer er wurde eigens gewählt. */
export function rufnameFolgt(alterVorname: string, neuerVorname: string, rufname: string): string {
  const eigens = rufname.trim() && rufname.trim() !== rufnameAus(alterVorname);
  return eigens ? rufname.trim() : rufnameAus(neuerVorname);
}

export function jetzt(): Zeitpunkt {
  return new Date().toISOString();
}

export function neueId(): Id {
  return crypto.randomUUID();
}

import type { Anschrift } from '../formblatt/anschrift';
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

/**
 * W57 (PC198, E363, Schema 4): Im Mietvertrag oder Bürge. „Hauptmieter“ und „Mitmieter“ gibt es nicht mehr; wer
 * Kontakt hält und unterschreibt, ist die Ansprechperson des Haushalts (`Haushalt.ansprechpersonId`).
 */
export type Rolle = 'vertrag' | 'buerge';

/** Rollen bis Schema 3 (2.0 bis 2.1); nur zum Lesen alter Daten und Mappen. */
export type RolleAlt = 'hauptmieter' | 'mitmieter' | 'buerge';

export type AusbildungArt = 'studium' | 'ausbildung';

/** DP47 G5: eine weitere Lebenslage einer Person, mit ihren Angaben für die Selbstauskunft. */
export interface Lebenslage {
  id: Id;
  situation: Lebenssituation;
  ausbildungArt?: AusbildungArt | null;
  beruf?: string;
  arbeitgeber?: string;
  nettoeinkommen?: number | null;
}

export interface Person extends Basis {
  /**
   * PC213/PC214 (E385): Bürgschaft ohne Heft, an der Person, die bürgt. Sie erscheint im Heft, sobald die Person in einem
   * Haushalt mit Heft steht und dort noch keine eigene hat.
   */
  buergschaftOhneHeft?: import('./buergschaftEingabe').BuergschaftEntwurf;
  vorname: string;
  nachname: string;
  /** Wie Hefta die Person anspricht, z. B. „Maximilian“ für „Maximilian-Alexander“ (Begrüßung). */
  rufname: string;
  /** Name in lateinischen Buchstaben, wie im Pass, wenn das PDF den eingetragenen nicht schreiben kann (K8). */
  nameMappe?: { vorname: string; nachname: string } | null;
  /**
   * `anschrift`: freiwillig, für die Nachricht ans Inserat, wenn es danach fragt. Seit W60 (2.3) wird sie in drei
   * Feldern eingegeben (`anschriftTeile`); `anschrift` ist dann der Text daraus, für alles, was eine Zeile braucht.
   * E222 (DP77): `telefon` steht in fester Form, dazu sein Land (ISO 3166-1) und die internationale Nummer. Fehlt
   * `telefonE164`, ließ sich die Nummer nicht umsetzen; dann steht sie nicht in der Mappe (DP77, Abschnitt 5).
   */
  kontakt: {
    telefon: string;
    email: string;
    anschrift?: string;
    anschriftTeile?: Anschrift;
    telefonLand?: string;
    telefonE164?: string;
  };
  lebenssituation: Lebenssituation | null;
  /** Bei „studierend_azubi“: was es genau ist; fehlt bei älteren Daten. */
  ausbildungArt?: AusbildungArt | null;
  beruf: string;
  arbeitgeber: string;
  nettoeinkommen: number | null;
  abrechnungMeist: 'anfang' | 'mitte' | 'ende' | null;
  /**
   * DP45 G3: „Seit Kurzem“ im Job, mit dem Tag des Anfangs (eigene Angabe der Person). Gehaltsabrechnungen
   * zählen dann erst ab diesem Monat; dazu kommt der Arbeitsvertrag. Fehlt es: „Länger als drei Monate“.
   */
  neuImJob?: { seit: Tag | null } | null;
  /**
   * DP47 G5: weitere Lebenslagen (Einkommensquellen) nach der ersten, in Reihenfolge. Die erste steht wie
   * bisher in `lebenssituation`, `beruf`, `arbeitgeber` und `nettoeinkommen`. „Angestellt“ darf mehrfach
   * vorkommen (zwei Arbeitgeber).
   */
  weitereLagen?: Lebenslage[];
  /**
   * DP47b K1: „Einkommen trotzdem angeben“ bei „Leistungen vom Amt“. Aus (Standard) gilt Version 1: Das
   * Amt übernimmt die Miete, Einkommen und Nachweise der anderen Lagen stehen nicht im Bogen.
   */
  einkommenTrotzdem?: boolean;
  /** Antworten der Selbstauskunft (M4); fehlt bei älteren Daten und wird dann leer gelesen. */
  selbstauskunft?: import('./selbstauskunft').Selbstauskunft;
  /**
   * DP74 C3 (PC109): Die Person hat keinen Nachnamen; dann ist `nachname` leer, und Hefta fragt nicht mehr danach.
   * Fehlt bei älteren Daten. In der Lesehilfe ändert sich nichts (FORMAT, Regel 1).
   */
  ohneNachname?: boolean;
}

export type MappenAkzent = 'tanne' | 'schiefer' | 'bordeaux' | 'graphit';
export type MappenSchrift = 'archivo' | 'source_serif' | 'plex_sans';

/** Die helle Fläche hinter „Wer einzieht“; entfällt (PC30), ältere Werte werden still ignoriert. */
export type MappenFlaeche = 'personen' | 'akzent' | 'grau' | 'keine';

/** Aussehen der PDF-Mappe (design/mappe-pdf.md, „Schlicht statt Kopfband“). */
export interface MappenAussehen {
  art: 'schlicht' | 'einefarbe' | 'personen';
  /** Bei „Eine Farbe“; bleibt beim Wechsel der Art. */
  akzent?: MappenAkzent;
  /** Schrift der eigenen Seiten; fehlt sie, gilt Archivo (mappe-feinschliff.md, § 3). */
  schrift?: MappenSchrift;
  /** Veraltet (PC30): Den Schalter „Kompakt“ gibt es nicht mehr; ein gespeicherter Wert wirkt nicht. */
  kompakt?: boolean;
  /** Veraltet (PC30): Die Wahl der Fläche gibt es nicht mehr; ein gespeicherter Wert wirkt nicht. */
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
   * W28, E376 (PC208, Schritt 5): Hat der Haushalt einen Wohnberechtigungsschein? Freiwillig, Ja oder Nein. Ein Ja zeigt
   * unter „Mappe“, „Für den ganzen Haushalt“: „Ihr habt einen. Noch nicht abgelegt.“, solange der Schein fehlt.
   */
  wbsAngabe?: import('./selbstauskunft').JaNein;
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
  /**
   * W57 (E363, E366): die Person (Person-ID), die Kontakt hält, zuerst steht und das Anschreiben unterschreibt. Sie
   * steht im Mietvertrag. Fehlt sie oder ist sie nicht mehr im Vertrag, gilt die erste im Vertrag nach der
   * Reihenfolge (`ansprechperson`).
   */
  ansprechpersonId?: Id | null;
  /**
   * PC213/PC214 (E385, Weg A): der verborgene Sammelplatz für Personen ohne Haushalt (Selbstauskunft und Bürgschaft im
   * Browser). Höchstens einer. Er ist kein Haushalt: nie aktiv, nie in einer Mappe, Lesehilfe, Zählung oder einem
   * Backup je Haushalt. Leer gibt es ihn nicht sichtbar; „Übernehmen“ verschiebt seine Plätze und löscht ihn.
   */
  ohneHaushalt?: boolean;
}

export interface Zugehoerigkeit extends Basis {
  haushaltId: Id;
  personId: Id;
  rolle: Rolle;
  /** Form des Rollenworts für Bürgen („Bürgin“, „Bürge“); gilt nur in diesem Haushalt. */
  bezeichnung: Bezeichnung;
  /** Personenfarbe 1 bis 4 in diesem Haushalt (design/person-und-haushalt.md, Abschnitt 1). */
  farbe: number;
  reihenfolge: number;
  /** Aus dem Haushalt genommen (Tag als ISO-Zeit); Person und Unterlagen bleiben erhalten. */
  herausgenommenAm?: string | null;
  /** E3d: Die Frage „Seit drei Monaten herausgenommen …“ wurde mit „Behalten“ beantwortet; nie wieder. */
  behalten?: boolean;
  /**
   * W42 Fall 7 (DP93, DP94): „Zieht nur mit ein“. Die Person ist herausgenommen (nicht in der Mappe), zählt aber unter
   * „Weitere Erwachsene“ des Haushalts mit; der Haushalt trägt sie in `weitereErwachsene`. Holt man sie zurück, zählt
   * sie dort nicht mehr. Keine eigene Rolle: So kennt jede Version die Daten (CP88, W42 F1).
   */
  ziehtMitEin?: boolean;
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
  /** DP45 G2: Mitgliedschaft in einer Genossenschaft (Typ `mitgliedschaft`, beim Haushalt). */
  genossenschaft?: { name: string; nummer: string };
  /**
   * DP45 G4 (K1): „Wie ist es bei dir?“ beim Bonitätsnachweis. Bei „keiner“ steht die Angabe wörtlich in der
   * Mappe; der Grund ist freiwillig, ohne Grund heißt es nur „noch keiner möglich“.
   */
  bonitaet?: BonitaetAngabe;
}

export interface BonitaetAngabe {
  art: 'habe' | 'bestelle' | 'keiner';
  grund: 'keine_vertraege' | 'eigener' | null;
  /** Bei „Eigener Grund“: in den Worten der Person. */
  text?: string;
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
  /**
   * Nur bei Typen mit `jeWohnung` (Bürgschaftserklärung, DP49 Punkt 5): das Heft, für das diese Fassung gilt.
   * Fehlt es, gilt sie für keine bestimmte Wohnung (hochgeladen vor DP49 oder ohne Heft); dann kommt sie in
   * eine Mappe, solange es für deren Wohnung keine eigene gibt.
   */
  heftId?: Id | null;
  /** Name der hochgeladenen Datei; fehlt bei älteren Versionen. */
  dateiname?: string | null;
  ausstellungsdatum: Tag | null;
  abrechnungsmonat: Monat | null;
  /**
   * Nur beim Wohnberechtigungsschein (DP45 G1): was darauf steht. „Gültig bis“ wörtlich vom Schein oder
   * selbst eingetragen (W10); Personen und Räume oder Wohnfläche, wie sie die Orientierungshilfe für
   * Stufe 1 nennt. Fehlt bei allen anderen Unterlagen.
   */
  wbs?: { gueltigBis: Tag | null; personen: number | null; raeume: string | null };
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
/**
 * Datenspur (E31, Zeilen 8 und 9, B21 „Was hinausging“): Was mit euren Daten hinausging und an wen, so wie
 * Hefta es weiß. Nur auf dem Gerät; Hefta schickt nichts selbst.
 */
export interface SpurEintrag {
  am: Zeitpunkt;
  art: 'mappe' | 'loeschbitte' | 'nachfrage';
  weg: 'mail' | 'portal' | 'website' | 'sonst';
  /** „Herrn Kraus“, eine Mail-Adresse oder das Portal; leer, wenn Hefta es nicht weiß. */
  an: string;
  /** Nur bei der Mappe: die wievielte Sendung an diese Wohnung, wie viele Unterlagen und Seiten. */
  fassung?: number;
  unterlagen?: number;
  seiten?: number;
  /** Wessen Angaben darin standen (Rufnamen). */
  personen?: string[];
  /** Über welche App geteilt, wenn das Teilen-Blatt es nennt („WhatsApp“, „Mail“); Zeile 8. */
  ueber?: string;
}

export interface Heft extends Basis {
  haushaltId: Id | null;
  /** Datenspur; fehlt sie, ging (soweit Hefta weiß) nichts hinaus. */
  spur?: SpurEintrag[];
  /** Fotos der Besichtigung (Zeile 9, B21): Kennungen im Speicherort `dateien`, nur auf dem Gerät. */
  fotos?: Id[];
  /**
   * Foto aus dem Inserat für den Kopf des Hefts (B28b, K1): Kennung im Speicherort `dateien`. Es kommt aus
   * der Vorschau (E72, genau ein Laden) und wird nie nachgeladen. Fehlt es, zeigt das Heft das gezeichnete
   * Feld.
   */
  foto?: Id;
  /**
   * PC12: Die Rückmeldung bei den Ergebnissen fragt je Heft höchstens einmal. Gesetzt nach einer Antwort
   * oder „Nein danke“; dann steht sie in diesem Heft nicht mehr.
   */
  rueckmeldungFertig?: true;
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
  /**
   * W63 (U11): Angaben der Bürgschaftserklärung für dieses Heft, je Person, die bürgt (Kennung der Person). Sofort
   * gespeichert, wie die Selbstauskunft. Fehlt das Feld, gibt es noch keine; IndexedDB braucht dafür kein neues Schema.
   */
  buergschaften?: Record<Id, import('./buergschaftEingabe').BuergschaftEntwurf>;
  /**
   * DP45 G1 (W28): Sozialwohnung, also Wohnberechtigungsschein nötig. Dann kommt der Schein des Haushalts
   * in die Mappe dieses Hefts; das Heft wählt ihn nur aus, hochgeladen wird er beim Haushalt.
   */
  sozialwohnung?: boolean;
  /** K3 (PC56): Ein abgelaufener Schein geht nur mit, wenn man es hier anschaltet. */
  wbsAbgelaufenMit?: boolean;
  /**
   * DP45 G2: Diese Wohnung ist von einer Genossenschaft, in der der Haushalt Mitglied ist: Kennung des
   * Dokuments der Mitgliedschaft. Dann kommt sie in die Mappe dieses Hefts; das Heft wählt nur aus.
   */
  genossenschaft?: Id | null;
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
  /**
   * E100: Die Mail wurde geöffnet, aber nicht sicher abgeschickt (kein „gesendet“ aus dem Mailfenster).
   * Hefta fragt dann einmal im Heft; erst „Ja“ setzt das Datum und die Datenspur.
   */
  loeschbitteOffen?: Zeitpunkt | null;
  nachfrageOffen?: Zeitpunkt | null;
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
  /**
   * DP106: Nach einem reinen Download im Browser weiß Hefta nur, dass er begonnen hat. Dann heißt es überall
   * „Letzter Download“ statt „Letztes Backup“. Es zählt der letzte Vorgang; fehlt das Feld, war es ein Backup.
   */
  letztesBackupWeg?: 'download' | null;
  speicherAngefragt: boolean;
  homescreenHinweisGezeigt: boolean;
  /** G4b: „Später“ gesagt; Hefta fragt höchstens noch einmal, wenn der Haushalt angelegt ist. */
  homescreenSpaeter?: boolean;
  ohnePasswortHinweisGezeigt: boolean;
  /** PC207, 1: einmal gesagt, dass Ausweiskopie und Datenkopie nicht mehr in die Mappe kommen. */
  nieInMappeGezeigt?: boolean;
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
  /** DP29: wann zuletzt eine Antwort abgeschickt wurde („Danke, beantwortet am …“). */
  rueckmeldungAm?: Zeitpunkt;
  /** Moment im Heft (B19): einmal gezeigt, abgeschickt oder „Nein danke“. */
  rueckmeldungMomentFertig?: boolean;
  /** PC12: Antworten auf die Rückmeldung im Heft, über alle Hefte; ab drei fragt Hefta nicht mehr. */
  rueckmeldungAntworten?: number;
  /** Eigene Fragen für die Besichtigung (E52): gehören zum Gerät, nicht zum Haushalt (Planung 10i). */
  eigeneFragen?: string[];
  /**
   * Bis PC213 die Bögen im Browser (E111, W63). Seit E385 (PC214) ungelesen: Sie waren nur in Vorschauen und im internen
   * Testbau erreichbar; das Feld bleibt stehen, es wird nichts gelöscht.
   */
  boegen?: unknown;
  /**
   * Ausgeblendete Fragen von Hefta (E92, vorbereitet, noch ohne Oberfläche): fehlen in allen Heften, außer
   * dort schon beantwortet.
   */
  ausgeblendeteFragen?: import('./besichtigungsFragen').AusgeblendeteFrage[];
  /** DP50 Punkt 10: Fragen von Hefta, in den Einstellungen ausgeschaltet; fehlen in jedem Heft (E5). */
  fragenAus?: import('./besichtigungsFragen').Thema[];
  /** Erinnerungen (Zeile 9, B21): „Besichtigungen und Nachfassen“; fehlt der Wert, sind sie an. */
  erinnerungBesichtigungen?: boolean;
  /** Erinnerungen: „Neue Monate und Ablauf von Unterlagen“ (PC62, auch der WBS); fehlt der Wert, an. */
  erinnerungGehalt?: boolean;
  /** W48: dritter Schalter „Unterlagen, bevor sie zu alt werden“; fehlt er, ist er an. */
  erinnerungZuAlt?: boolean;
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
  // E257 (PC138): Titel am Anfang („Dr.“, „Prof.“, „Dipl.-Ing.“) zählen nicht. Ein Titel ist ein Wort,
  // das mit einem Punkt endet, oder (PC148) „Dr“, „Prof“, „Dipl-Ing“ ohne Punkt. Titel zählen nur, wenn
  // danach noch ein Wort folgt; besteht der Vorname nur aus Titeln, gilt die alte Regel.
  return rufnameOhneTitel(vorname, istTitel);
}

/** PC148: Titel ohne Punkt. Nur ganze Wörter, also nie „Drago“ oder „Professor“. */
const TITEL_OHNE_PUNKT = new Set(['dr', 'prof', 'dipl-ing']);

function istTitel(wort: string): boolean {
  return wort.endsWith('.') || TITEL_OHNE_PUNKT.has(wort.toLowerCase());
}

function rufnameOhneTitel(vorname: string, titel: (wort: string) => boolean): string {
  const woerter = vorname.trim().split(/\s+/);
  const ab = woerter.findIndex((w) => !titel(w));
  if (ab < 0) return rufnameNachAlterRegel(vorname);
  return rufnameNachAlterRegel(woerter.slice(ab).join(' '));
}

/** Die Regel in 2.0.1: nur Titel mit Punkt wurden übersprungen. */
function rufnameNach201(vorname: string): string {
  return rufnameOhneTitel(vorname, (w) => w.endsWith('.'));
}

/** Die Regel bis 2.0: Vorname bis zum ersten Leerzeichen oder Bindestrich, auch wenn das ein Titel ist. */
function rufnameNachAlterRegel(vorname: string): string {
  return vorname.trim().split(/[\s-]/)[0] ?? '';
}

/** Selbst gebildet: der Rufname, den Hefta aus diesem Vornamen bildet oder bis 2.0.1 gebildet hat. */
function rufnameSelbstGebildet(vorname: string, rufname: string): boolean {
  const r = rufname.trim();
  return (
    r === rufnameAus(vorname) ||
    r === rufnameNachAlterRegel(vorname) ||
    r === rufnameNach201(vorname)
  );
}

/** Rufname nach einer Änderung des Vornamens: Er folgt, außer er wurde eigens gewählt. */
export function rufnameFolgt(alterVorname: string, neuerVorname: string, rufname: string): string {
  const eigens = rufname.trim() && !rufnameSelbstGebildet(alterVorname, rufname);
  return eigens ? rufname.trim() : rufnameAus(neuerVorname);
}

/**
 * E257: Ein gespeicherter Rufname, den Hefta bis 2.0.1 selbst aus einem Titel gebildet hat („Dr.“, „Dr“),
 * wird beim Lesen neu gebildet. Ein eigens gewählter Rufname bleibt. Gespeichert wird dabei nichts.
 */
export function rufnameGelesen<P extends { vorname: string; rufname: string }>(person: P): P {
  const r = person.rufname.trim();
  const neu = rufnameAus(person.vorname);
  const alt = r === rufnameNachAlterRegel(person.vorname) || r === rufnameNach201(person.vorname);
  if (r && r !== neu && alt && istTitel(r)) {
    return { ...person, rufname: neu };
  }
  return person;
}

export function jetzt(): Zeitpunkt {
  return new Date().toISOString();
}

export function neueId(): Id {
  return crypto.randomUUID();
}

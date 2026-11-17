// Die festen Listen von hefta.json (Abschnitt 6 der Beschreibung). Eine Kennung behält ihre Bedeutung; neue
// Kennungen kommen ohne neue Fassung dazu. Unbekanntes zeigt ein Leser neutral.

export const ANHANG_NAME = 'hefta.json';

/** Die Fassung, die dieses Paket schreibt und vollständig kennt. */
export const FASSUNG = 4;

export const ROLLEN = {
  hauptmieter: 'steht im Mietvertrag, als erste Person des Haushalts',
  mitmieter: 'steht ebenfalls im Mietvertrag',
  buerge: 'bürgt für den Haushalt, steht nicht im Mietvertrag',
} as const;

export const MITZIEHENDE = {
  kind: 'Kind',
  erwachsen: 'weitere erwachsene Person ohne Vertrag',
} as const;

export const TYPEN: Readonly<Record<string, string>> = {
  selbstauskunft: 'Selbstauskunft',
  gehaltsnachweis: 'Gehaltsnachweise',
  einkommen_selbststaendig: 'Einkommensnachweis bei Selbstständigkeit',
  einkommen_ausbildung: 'BAföG-Bescheid oder Ausbildungsvertrag',
  rentenbescheid: 'Rentenbescheid',
  mietuebernahme_amt: 'Nachweis der Mietübernahme',
  einkommen_sonstig: 'Sonstiger Einkommensnachweis',
  bonitaet: 'Bonitätsnachweis',
  mietzahlung: 'Mietschuldenfreiheit oder Mietzahlungsnachweis',
  buergschaftserklaerung: 'Bürgschaftserklärung',
  anschreiben: 'Anschreiben',
  empfehlung_vorvermieter: 'Empfehlung des Vorvermieters',
  wbs: 'Wohnberechtigungsschein',
  ausweiskopie: 'Ausweiskopie',
  schufa_datenkopie: 'SCHUFA-Datenkopie',
};

/**
 * Der Wortlaut im Verzeichnis „Was beiliegt“ der Mappe (U5, W6). Er enthält weder „|“ noch „;“, damit er in der
 * CSV ohne Anführungszeichen trennbar bleibt.
 */
export const VERZEICHNIS: Readonly<Record<string, string>> = {
  selbstauskunft: 'Selbstauskunft',
  gehaltsnachweis: 'Gehaltsnachweise',
  einkommen_selbststaendig: 'Einkommensnachweis',
  einkommen_ausbildung: 'BAföG-Bescheid oder Ausbildungsvertrag',
  rentenbescheid: 'Rentenbescheid',
  mietuebernahme_amt: 'Nachweis der Mietübernahme',
  einkommen_sonstig: 'Sonstiger Einkommensnachweis',
  bonitaet: 'Bonitätsnachweis',
  mietzahlung: 'Mietzahlungen',
  buergschaftserklaerung: 'Bürgschaftserklärung',
  anschreiben: 'Anschreiben',
  empfehlung_vorvermieter: 'Empfehlung des Vorvermieters',
  wbs: 'Wohnberechtigungsschein',
  ausweiskopie: 'Ausweiskopie',
  schufa_datenkopie: 'SCHUFA-Datenkopie',
};

/** Wie ein Leser Unbekanntes zeigt (U1): Rolle als „Person“, Art der Mitziehenden als „weitere Person“. */
export const UNBEKANNT = {
  typ: 'Unterlage',
  rolle: 'Person',
  mitziehend: 'weitere Person',
  vermerk: 'angepasst',
} as const;

export const PRUEFWEGE: Readonly<Record<string, string>> = {
  pruefcode: 'Die Unterlage trägt einen Code, mit dem man sie beim Aussteller prüfen kann',
};

export const MODI = {
  alles: 'alles Übliche und alles, was helfen kann',
  marktueblich: 'was der Markt üblicherweise verlangt',
  datensparsam: 'nur, was der Schritt in `schritt` braucht',
  eigene_auswahl: 'Unterlage für Unterlage selbst gewählt',
} as const;

export const SCHRITTE = {
  besichtigung: 'Anfrage oder Besichtigung',
  will_wohnung: '„Ich will die Wohnung“',
  zusage: 'nach der Zusage, vor dem Vertrag',
} as const;

export const VERMERKE: Readonly<Record<string, string>> = {
  seiten_weggelassen: 'Seiten des Originals fehlen in der Mappe',
  verkleinert: 'Das Original war größer als A4 und steht kleiner da',
  als_bild: 'Eine Seite aus einem PDF kam nur als Bild in die Mappe',
  formularfelder_fest: 'Ausfüllbare Felder des Originals stehen fest auf der Seite',
};

/** Eine Art von Unterlage im Wortlaut des Verzeichnisses; Unbekanntes neutral als „Unterlage“. */
export function typText(typ: string): string {
  return VERZEICHNIS[typ] ?? UNBEKANNT.typ;
}

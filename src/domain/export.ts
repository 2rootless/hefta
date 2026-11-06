import { namensteil } from './dateiname';
import type { Rolle } from './modell';
import type { PersonStand, UnterlagenStand } from './regelkatalog';
import type { Schritt } from './selbstauskunft';

// Was in die Mappe kommt (docs/06-export.md, design/mappe-erstellen-einstellungen.md, X1–X9).
// Rein rechnend: aus dem Stand der Personen und den Einstellungen der Bewerbung entsteht die Liste
// der Teile je Person, in fester Reihenfolge, dazu die Hinweise und die Dateinamen.

export type ExportModus = 'alles' | 'marktueblich' | 'datensparsam' | 'eigene_auswahl';
export type Ausgabe = 'eine' | 'einzeln';

export interface ExportEinstellungen {
  modus: ExportModus;
  schritt: Schritt;
  /** Personen (IDs), die bei dieser Bewerbung nicht mitgehen; nur Bürgen sind abwählbar. */
  ohne: string[];
  /** Eigene Auswahl: „personId:typ“ → an/aus. Fehlt ein Eintrag, gilt „Marktüblich“. */
  auswahl: Record<string, boolean>;
  ausgabe: Ausgabe;
  deckblatt: boolean;
  inhaltsverzeichnis: boolean;
  fusszeile: boolean;
  /** X8b: Unterschriftszeile in den Selbstauskünften, für Ausdrucke. */
  unterschrift?: boolean;
  /** X6c: Scans und große Bilder verkleinern (Schrift auf Seiten mit Text bleibt, wie sie ist). */
  kleiner?: boolean;
  /** „Erstellt mit …“ klein auf dem Deckblatt; fehlt der Wert, ist er an. */
  hinweis?: boolean;
  /** Bitte zum Löschen auf dem Deckblatt (design/bitte-zum-loeschen.md); freiwillig, darum aus. */
  bitte?: boolean;
  /** Leer: aus Nachnamen und Adresse gebildet. */
  dateiname: string;
}

export function standardEinstellungen(): ExportEinstellungen {
  return {
    modus: 'marktueblich',
    schritt: 'will_wohnung',
    ohne: [],
    auswahl: {},
    ausgabe: 'eine',
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    hinweis: true,
    bitte: false,
    dateiname: '',
  };
}

/**
 * Was gespeichert ist, dazu was schon getippt wurde, während es geladen wurde: Der Bildschirm steht früher da
 * als die Daten, auf einem langsamen Gerät spürbar, und dieser Tipp darf nicht verloren gehen.
 */
export function einstellungenNachLaden(
  gespeichert: Partial<ExportEinstellungen> | undefined,
  jetzt: ExportEinstellungen,
): ExportEinstellungen {
  const start = standardEinstellungen();
  const getippt = Object.fromEntries(
    Object.entries(jetzt).filter(
      ([k, wert]) => JSON.stringify(wert) !== JSON.stringify(start[k as keyof ExportEinstellungen]),
    ),
  );
  return { ...start, ...gespeichert, ...getippt };
}

/** Der Vermieter liest den Satz, darum gesiezt (T9). Gemeint sind die, die die Wohnung nicht bekommen. */
export const BITTE_VORSCHLAG =
  'Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank.';
/** Das sind auf dem Deckblatt höchstens zwei Zeilen. */
export const BITTE_MAX = 120;

/** Der Satz, der gilt: der eigene, sonst der Vorschlag. Beim Einschalten steht also immer etwas da. */
export function bitteSatzAus(bewerbung: { bitteSatz?: string } | null | undefined): string {
  return bewerbung?.bitteSatz?.trim() || BITTE_VORSCHLAG;
}

const SCHRITTE: Schritt[] = ['besichtigung', 'will_wohnung', 'zusage'];

export function schluessel(personId: string, typ: string): string {
  return `${personId}:${typ}`;
}

/**
 * Die Stufen laufen über die Etiketten des Regelkatalogs (design/mappe-feinschliff.md, § 6, X13):
 * `ueblich` ist der Kern, „Alles“ nimmt `kann_helfen` dazu. `meist_unnoetig` geht nur über „Eigene
 * Auswahl“. Das Anschreiben ist keine Unterlage der Mappe.
 */
function ueblich(u: UnterlagenStand): boolean {
  return u.typ.etikett === 'ueblich' && u.typ.id !== 'anschreiben';
}

/**
 * „Marktüblich“: der Kern und, was der Regelkatalog dazu nennt, sobald es hochgeladen ist (Entscheidung Z:
 * die Mietschuldenfreiheit). Das Etikett bleibt „Kann helfen“, darum gilt sie nie als fehlend.
 */
function marktueblich(u: UnterlagenStand): boolean {
  return ueblich(u) || (u.typ.marktueblichWennHochgeladen === true && u.versionen.length > 0);
}

function allesAusser(u: UnterlagenStand): boolean {
  if (u.typ.id === 'anschreiben') return false;
  return ueblich(u) || (u.typ.etikett === 'kann_helfen' && u.versionen.length > 0);
}

/** Gehört die Unterlage im Modus „Datensparsam“ zum gewählten Schritt? */
function zumSchritt(u: UnterlagenStand, schritt: Schritt): boolean {
  if (!u.typ.schritt || u.typ.etikett === 'meist_unnoetig') return false;
  return SCHRITTE.indexOf(u.typ.schritt as Schritt) <= SCHRITTE.indexOf(schritt);
}

export function gewaehlt(u: UnterlagenStand, personId: string, e: ExportEinstellungen): boolean {
  // „Datensparsam“ bleibt beim Kern: Verlangen kann die Mietschuldenfreiheit kein Vermieter.
  if (e.modus === 'datensparsam') return zumSchritt(u, e.schritt) && ueblich(u);
  if (e.modus === 'alles') return allesAusser(u);
  const standard = marktueblich(u);
  if (e.modus === 'eigene_auswahl') return e.auswahl[schluessel(personId, u.typ.id)] ?? standard;
  return standard;
}

/** Ist die Unterlage vorhanden (hochgeladen bzw. Selbstauskunft fertig)? */
export function vorhanden(u: UnterlagenStand): boolean {
  if (u.typ.inAppErstellt) return u.status === 'da';
  return u.versionen.length > 0;
}

export interface Teil {
  personId: string;
  rolle: Rolle;
  stand: UnterlagenStand;
}

export interface Block {
  person: PersonStand;
  teile: Teil[];
}

/**
 * Reihenfolge (06-export.md): je Vertragspartei in Haushaltsreihenfolge ein Block, dann die Bürgen;
 * im Block des Bürgen zuerst die Bürgschaftserklärung, dann Selbstauskunft, Einkommen, Bonität, Rest.
 */
export function bloecke(staende: PersonStand[], e: ExportEinstellungen): Block[] {
  const reihenfolge = [
    ...staende.filter((s) => s.rolle !== 'buerge'),
    ...staende.filter((s) => s.rolle === 'buerge' && !e.ohne.includes(s.person.id)),
  ];
  return reihenfolge.map((s) => ({
    person: s,
    teile: [...s.unterlagen]
      .filter((u) => gewaehlt(u, s.person.id, e) && vorhanden(u))
      .sort((a, b) => rang(a, s.rolle) - rang(b, s.rolle))
      .map((u) => ({ personId: s.person.id, rolle: s.rolle, stand: u })),
  }));
}

function rang(u: UnterlagenStand, rolle: Rolle): number {
  if (rolle === 'buerge' && u.typ.id === 'buergschaftserklaerung') return -1;
  return u.typ.reihenfolge;
}

export type Hinweis = { art: 'ohneBonitaet' } | { art: 'zusageOffen'; namen: string[] };

/** Was in der Mappe fehlt: nie hochgeladen oder unvollständig (Serie). Zu Altes ist ein eigener Hinweis. */
export function fehlendeUnterlagen(
  staende: PersonStand[],
  e: ExportEinstellungen,
): { person: PersonStand; unterlage: UnterlagenStand }[] {
  return staende
    .filter((s) => s.rolle !== 'buerge' || !e.ohne.includes(s.person.id))
    .flatMap((person) =>
      person.unterlagen
        .filter(
          (u) =>
            gewaehlt(u, person.person.id, e) &&
            u.status === 'fehlt' &&
            !u.veraltet &&
            u.typ.etikett === 'ueblich',
        )
        .map((unterlage) => ({ person, unterlage })),
    );
}

/** Was zu alt ist und trotzdem in die Mappe käme. */
export function zuAlteUnterlagen(
  staende: PersonStand[],
  e: ExportEinstellungen,
): { person: PersonStand; unterlage: UnterlagenStand }[] {
  return staende
    .filter((s) => s.rolle !== 'buerge' || !e.ohne.includes(s.person.id))
    .flatMap((person) =>
      person.unterlagen
        .filter(
          (u) =>
            gewaehlt(u, person.person.id, e) && vorhanden(u) && u.veraltet && u.status === 'fehlt',
        )
        .map((unterlage) => ({ person, unterlage })),
    );
}

/** Hinweise unter „Was soll rein?“ (X2, X5, Z5); die Größe (X6) kommt nach dem Bauen dazu. */
export function hinweise(staende: PersonStand[], e: ExportEinstellungen): Hinweis[] {
  const liste: Hinweis[] = [];
  if (e.modus === 'datensparsam' && e.schritt !== 'zusage') liste.push({ art: 'ohneBonitaet' });
  // Für den Vertrag zusammengestellt: Dann erwartet der Vermieter auch diese Antwort in der Selbstauskunft.
  if (e.modus === 'datensparsam' && e.schritt === 'zusage') {
    const namen = staende
      .filter((s) => s.rolle !== 'buerge' || !e.ohne.includes(s.person.id))
      .filter((s) => (s.person.selbstauskunft?.mietrueckstaende ?? null) === null)
      .map((s) => s.person.rufname || s.person.vorname);
    if (namen.length) liste.push({ art: 'zusageOffen', namen });
  }
  return liste;
}

/** Straße und Nummer für den Dateinamen: „Hauptstraße 12, 3. OG“ → „Hauptstr12“. */
export function strassenteil(adresse: string): string {
  const erste = adresse.split(/[,\n]/)[0] ?? '';
  return namensteil(erste.replace(/stra(ß|ss)e\b/gi, 'str').replace(/\s+/g, '')).replace(/-/g, '');
}

/** „Bewerbung_Mustermann_Hauptstr12.pdf“, bei zwei Nachnamen beide mit Bindestrich. */
export function mappenDateiname(nachnamen: string[], adresse: string): string {
  const namen = [...new Set(nachnamen.map((n) => namensteil(n)).filter(Boolean))].join('-');
  return `${['Bewerbung', namen, strassenteil(adresse)].filter(Boolean).join('_')}.pdf`;
}

/** Einzeldatei: „02_Gehaltsnachweise_Max_Mustermann.pdf“. */
export function einzelDateiname(
  nummer: number,
  unterlage: string,
  vorname: string,
  nachname: string,
): string {
  const teile = [
    String(nummer).padStart(2, '0'),
    namensteil(unterlage),
    namensteil(vorname),
    namensteil(nachname),
  ];
  return `${teile.filter(Boolean).join('_').replace(/-/g, '')}.pdf`;
}

/** Selbstauskunft für welchen Schritt? „Datensparsam“ nach Wahl, sonst „Ich will die Wohnung“. */
/** Nur „Datensparsam“ hält eine Antwort zurück, bis der gewählte Schritt erreicht ist. */
export function auskunftAntwortenImmer(e: Pick<ExportEinstellungen, 'modus'>): boolean {
  return e.modus !== 'datensparsam';
}

export function auskunftsSchritt(e: ExportEinstellungen): Schritt {
  return e.modus === 'datensparsam' ? e.schritt : 'will_wohnung';
}

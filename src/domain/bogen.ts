import {
  anschriftText,
  anschriftVollstaendig,
  leereAnschrift,
  type Anschrift,
} from '../formblatt/anschrift';
import type { BuergschaftsArt } from './buergschaft';
import {
  einziehendText,
  selbstauskunftBloecke,
  type FormBlock,
  type FormZeile,
  type JaNein,
  ZUSAGE_KATALOG,
} from './selbstauskunft';
import type { Person } from './modell';
import { VERGABE } from './personenfarben';
import { DEUTSCHLAND, telefonFuerMappe, telefonSpeichern } from './telefon';

// E111 „Der Bogen selbst“ (DP134; PC205, Abschnitt 2; PC208, Schritt 4) und die leere Vorlage der Bürgschaft im selben
// Stil (W63, DP135, Abschnitt 4): Formulare im Browser, ohne Haushalt. Was man einträgt, bleibt in diesem Browser
// (Einstellungen, Feld `boegen`), bis man es löscht oder in einen Haushalt übernimmt (E366). Läuft ohne Browser-APIs.

// ---------- Selbstauskunft im Browser ----------

export interface BogenPerson {
  id: string;
  /** Farbe des Zeichens, 1 bis 6, wie im Haushalt. */
  farbe: number;
  vorname: string;
  nachname: string;
  anschrift: Anschrift;
  telefon: string;
  email: string;
  beruf: string;
  arbeitgeber: string;
  /** Wie eingetippt: „2.800“ oder „mindestens 2.000“. */
  netto: string;
  insolvenz: JaNein;
  raeumungstitel: JaNein;
}

/** HAUSHALT: in allen Bögen gleich (DP134, Abschnitt 1). */
export interface BogenHaushalt {
  erwachsene: number;
  kinder: number;
  haustiere: JaNein;
  /** W28: freiwillig, Ja oder Nein; ohne Antwort keine Zeile im PDF. */
  wbs: JaNein;
  ort: string;
}

export interface SelbstauskunftBoegen {
  personen: BogenPerson[];
  hh: BogenHaushalt;
  /** „Alle in einer PDF“ oder „Je Person eine PDF“ (DP134, Abschnitt 4). */
  pdf: 'eine' | 'je';
}

export interface BuergschaftBogenDaten {
  vorname: string;
  nachname: string;
  anschrift: Anschrift;
  mieter: { vorname: string; nachname: string }[];
  vermieterName: string;
  vermieterAnschrift: Anschrift;
  wohnung: Anschrift;
  lage: string;
  vertrag: 'unterschrieben' | 'nochNicht';
  vertragTag: string;
  hoechstbetrag: number | null;
  art: BuergschaftsArt | null;
}

/** Was in den Einstellungen liegt. Fehlt ein Teil, ist dieser Bogen leer. */
export interface Boegen {
  selbstauskunft?: SelbstauskunftBoegen;
  buergschaft?: BuergschaftBogenDaten;
}

/**
 * DP145, B5: Die Farbe hängt an der Person. Der Bogen vergibt sie in der Reihenfolge der App (B14, Fassung 3), und
 * „Übernehmen“ gibt sie mit; so bleibt sie vor und nach dem Übernehmen dieselbe.
 */
export function bogenFarbe(eigene: readonly number[]): number {
  return VERGABE.find((f) => !eigene.includes(f)) ?? VERGABE[eigene.length % VERGABE.length]!;
}

export function leerePerson(id: string, farbe = VERGABE[0]!): BogenPerson {
  return {
    id,
    farbe,
    vorname: '',
    nachname: '',
    anschrift: leereAnschrift(),
    telefon: '',
    email: '',
    beruf: '',
    arbeitgeber: '',
    netto: '',
    insolvenz: null,
    raeumungstitel: null,
  };
}

export function leereSelbstauskuenfte(id: string): SelbstauskunftBoegen {
  return {
    personen: [leerePerson(id)],
    hh: { erwachsene: 1, kinder: 0, haustiere: null, wbs: null, ort: '' },
    pdf: 'eine',
  };
}

export function leereBuergschaft(): BuergschaftBogenDaten {
  return {
    vorname: '',
    nachname: '',
    anschrift: leereAnschrift(),
    mieter: [{ vorname: '', nachname: '' }],
    vermieterName: '',
    vermieterAnschrift: leereAnschrift(),
    wohnung: leereAnschrift(),
    lage: '',
    vertrag: 'nochNicht',
    vertragTag: '',
    hoechstbetrag: null,
    art: null,
  };
}

const da = (s: string) => s.trim() !== '';

/** „2.800“, „2800 €“, „mindestens 2.000“: Betrag und ob er eine Grenze ist. */
export function nettoAus(text: string): { betrag: number | null; mindestens: boolean } {
  const mindestens = /mind/i.test(text);
  const ziffern = text.replace(/,\d{1,2}\b/, '').replace(/\D/g, '');
  return { betrag: ziffern ? Number(ziffern) : null, mindestens };
}

/**
 * Was in einem Bogen noch fehlt, mit den Namen aus DP134: „Vorname, Nachname, Kontakt, Netto, 2 Fragen“. Für den
 * Kontakt reicht eine Angabe (Anschrift, Telefon oder E-Mail).
 */
export function fehltImBogen(p: BogenPerson): string[] {
  const f: string[] = [];
  if (!da(p.vorname)) f.push('Vorname');
  if (!da(p.nachname)) f.push('Nachname');
  if (!(anschriftVollstaendig(p.anschrift) || da(p.telefon) || da(p.email))) f.push('Kontakt');
  if (!nettoAus(p.netto).betrag) f.push('Netto');
  const fragen = [p.insolvenz, p.raeumungstitel].filter((x) => x === null).length;
  if (fragen) f.push(fragen === 2 ? '2 Fragen' : '1 Frage');
  return f;
}

/** „Es fehlt noch: …“ (bei mehreren Bögen „Es fehlt noch bei Selin: …“), sonst null. */
export function fehltSatz(b: SelbstauskunftBoegen): string | null {
  const p = b.personen.find((x) => fehltImBogen(x).length);
  if (!p) return null;
  const bei = b.personen.length > 1 ? ` bei ${p.vorname.trim() || 'der neuen Person'}` : '';
  return `Es fehlt noch${bei}: ${fehltImBogen(p).join(', ')}`;
}

export function nameVon(p: { vorname: string; nachname: string }): string {
  return [p.vorname.trim(), p.nachname.trim()].filter(Boolean).join(' ');
}

/** „Jarne Ostendorp und Selin Akgül“, „A, B und C“. */
function namenListe(namen: string[]): string {
  return namen.length < 2
    ? (namen[0] ?? '')
    : `${namen.slice(0, -1).join(', ')} und ${namen.at(-1)}`;
}

/** Dateinamen nach DP134, Abschnitt 4. */
export function bogenDateinamen(b: SelbstauskunftBoegen): string[] {
  const namen = b.personen.map(nameVon);
  if (b.personen.length > 1 && b.pdf === 'eine')
    return [`Selbstauskünfte ${namenListe(namen)}.pdf`];
  return namen.map((n) => `Selbstauskunft ${n}.pdf`);
}

/** Die Person, wie das PDF der App sie kennt (ohne Lebenslage; DP134: der lose Bogen fragt nicht danach). */
export function personAusBogen(p: BogenPerson, hh: BogenHaushalt, jetzt: string): Person {
  const netto = nettoAus(p.netto);
  return {
    id: p.id,
    createdAt: jetzt,
    updatedAt: jetzt,
    vorname: p.vorname.trim(),
    nachname: p.nachname.trim(),
    rufname: p.vorname.trim(),
    // DP145, B1/B2: die Nummer wie bei der Eingabe in der App in die geprüfte Form (DP77); eine eindeutig deutsche
    // Nummer kommt so still an. Was sich nicht umsetzen lässt, bleibt, wie es ist, und die App fragt danach.
    kontakt: {
      ...telefonSpeichern(p.telefon, DEUTSCHLAND),
      email: p.email.trim(),
      anschrift: anschriftText(p.anschrift),
      anschriftTeile: { ...p.anschrift },
    },
    lebenssituation: null,
    beruf: p.beruf.trim(),
    arbeitgeber: p.arbeitgeber.trim(),
    nettoeinkommen: netto.betrag,
    abrechnungMeist: null,
    selbstauskunft: {
      einkommenArt: netto.mindestens ? 'mindestens' : 'betrag',
      haustiere: hh.haustiere,
      haustiereText: '',
      insolvenz: p.insolvenz,
      raeumungstitel: p.raeumungstitel,
      mietrueckstaende: null,
      stellungnahme: '',
      ort: hh.ort.trim(),
    },
  };
}

/**
 * Die Blöcke des PDFs: der Bogen der App mit drei Unterschieden (DP134, Abschnitt 4): ohne Rolle, ohne Lebenslage,
 * ohne Frage 3 (C.4 bis C.7 bleiben bis vor dem Vertrag frei). Dazu der Wohnberechtigungsschein unter HAUSHALT, nur
 * mit Antwort (W28, W10).
 */
export function bogenBloecke(p: BogenPerson, hh: BogenHaushalt, jetzt: string): FormBlock[] {
  const person = personAusBogen(p, hh, jetzt);
  const bloecke = selbstauskunftBloecke(
    person,
    'vertrag',
    { erwachsene: hh.erwachsene, kinder: hh.kinder },
    { haustiere: hh.haustiere, haustiereText: '', ort: hh.ort },
    'will_wohnung',
    {},
  );
  const ohneC = new Set<string>([...Object.values(ZUSAGE_KATALOG), 'gruende']);
  // DP145, B1 (W10): Der lose Bogen nimmt alle Angaben mit. Eine Nummer, die sich nicht prüfen lässt, steht hier so
  // da, wie sie eingetragen ist; der Bogen kennt kein „prüfen“.
  const roh = p.telefon.trim();
  const kontaktWert = [telefonFuerMappe(person.kontakt)?.anzeige ?? roh, p.email.trim()]
    .filter(Boolean)
    .join(' · ');
  return bloecke.map((b) => {
    if (b.id === 'person')
      return {
        ...b,
        zeilen: b.zeilen.map((z) => (z.id === 'kontakt' ? { ...z, wert: kontaktWert } : z)),
      };
    if (b.id === 'fragen') return { ...b, zeilen: b.zeilen.filter((z) => !ohneC.has(z.id)) };
    if (b.id !== 'haushalt') return b;
    const zeilen: FormZeile[] = [
      {
        id: 'personenzahl',
        etikett: 'Personen, die einziehen',
        art: 'text',
        wert: einziehendText(hh),
      },
    ];
    if (hh.wbs)
      zeilen.push({
        id: 'wbs',
        etikett: 'Wohnberechtigungsschein',
        art: 'text',
        wert: hh.wbs === 'ja' ? 'Ja' : 'Nein',
      });
    return { ...b, zeilen };
  });
}

// ---------- Bürgschaft im Browser ----------

/** Was „PDF erstellen“ aufhält: nur Höchstbetrag und Art (E112); der Rest bleibt für die Hand. */
export function buergschaftFehlt(b: BuergschaftBogenDaten): string[] {
  const f: string[] = [];
  if (!b.hoechstbetrag || b.hoechstbetrag <= 0) f.push('Höchstbetrag');
  if (!b.art) f.push('Art der Bürgschaft');
  return f;
}

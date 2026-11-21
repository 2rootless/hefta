import { DEUTSCHLAND, telefonPruefen, telefonSpeichern, type Land } from '../domain/telefon';
import {
  ERKLAERUNG,
  fehlendeAngaben,
  haushaltsAngaben,
  selbstauskunftVon,
  teile as teileDerAuskunft,
} from '../domain/selbstauskunft';
import type { HaushaltsAngaben, Selbstauskunft } from '../domain/selbstauskunft';
import type { AusbildungArt, Haushalt, Lebenssituation, Person, Rolle } from '../domain/modell';
import { t } from '../i18n';
import type { HaushaltAnsicht } from '../storage/speicher';

// Formularwerte der Selbstauskunft und der Weg zurück an Person und Haushalt
// (für den Rutsch, die eigene Seite und den Bereich „Selbstauskünfte“).

export interface SelbstauskunftEingabe {
  telefon: string;
  /** E222: Land der Nummer, ISO 3166-1; vorgewählt ist Deutschland. */
  telefonLand: string;
  email: string;
  /** Wird hier nicht bearbeitet, bleibt aber erhalten. */
  anschrift?: string;
  beruf: string;
  arbeitgeber: string;
  /** Als Text, damit ein leeres Feld leer bleibt. */
  netto: string;
  /** DP47 G5: weitere Lebenslagen mit Beruf, Arbeitgeber und Netto, in Reihenfolge. */
  lagen: LageEingabe[];
  /** DP47b K1: „Einkommen trotzdem angeben“ bei „Leistungen vom Amt“. */
  einkommenTrotzdem: boolean;
  sa: Selbstauskunft;
  /** Haustiere und Ort: gehören dem Haushalt, gelten in jedem Bogen. */
  hh: HaushaltsAngaben;
}

/** Eine weitere Lebenslage im Formular; Beträge als Text wie beim ersten Netto. */
export interface LageEingabe {
  id: string;
  situation: Lebenssituation;
  ausbildungArt: AusbildungArt | null;
  beruf: string;
  arbeitgeber: string;
  netto: string;
}

/** Haushaltsangaben aus dem geladenen Stand (mit Rückfall auf ältere Daten an Personen). */
/**
 * PC126 K1 (DP82 T1, DP77): Im Telefon steht eine Eingabe mit Fehler. Solange das so ist, ist „Kontakt“ nicht fertig:
 * kein Haken, kein „Weiter“, kein „Fertig, 1 Seite“. TL22 (Nummer passt nicht zum gewählten Land) bleibt, wie es ist.
 * Eine gespeicherte alte Nummer, die sich nicht umsetzen lässt, zählt hier nicht (DP77, Abschnitt 5).
 */
export function telefonEingabeFehler(e: { telefon: string; telefonLand: string }): boolean {
  if (!e.telefon.trim()) return false;
  const r = telefonPruefen(e.telefon, (e.telefonLand || DEUTSCHLAND) as Land);
  return r.art === 'fehler' && r.fehler !== 'land';
}

export function haushaltsAngabenAus(ansicht: HaushaltAnsicht | null): HaushaltsAngaben {
  if (!ansicht) return haushaltsAngaben(null);
  return haushaltsAngaben(
    ansicht.haushalt,
    ansicht.mitglieder.map((m) => m.person),
  );
}

export function eingabeAus(person: Person, hh: HaushaltsAngaben): SelbstauskunftEingabe {
  return {
    telefon: person.kontakt.telefon,
    telefonLand: person.kontakt.telefonLand ?? DEUTSCHLAND,
    email: person.kontakt.email,
    ...(person.kontakt.anschrift ? { anschrift: person.kontakt.anschrift } : {}),
    beruf: person.beruf,
    arbeitgeber: person.arbeitgeber,
    netto: person.nettoeinkommen ? String(person.nettoeinkommen) : '',
    lagen: (person.weitereLagen ?? []).map((l) => ({
      id: l.id,
      situation: l.situation,
      ausbildungArt: l.ausbildungArt ?? null,
      beruf: l.beruf ?? '',
      arbeitgeber: l.arbeitgeber ?? '',
      netto: l.nettoeinkommen ? String(l.nettoeinkommen) : '',
    })),
    einkommenTrotzdem: !!person.einkommenTrotzdem,
    sa: selbstauskunftVon(person),
    hh: { ...hh },
  };
}

function betrag(text: string): number | null {
  const zahl = Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(zahl) && zahl > 0 ? Math.round(zahl) : null;
}

/** Felder für personAendern, als einfache Objekte (keine Proxys, IndexedDB kann sie klonen). */
export function angabenAus(e: SelbstauskunftEingabe): Partial<Person> {
  const erklaerung = (f: keyof typeof ERKLAERUNG) =>
    e.sa[f] === 'ja' ? (e.sa[ERKLAERUNG[f]] ?? '').trim() : '';
  return {
    kontakt: {
      ...telefonSpeichern(e.telefon, e.telefonLand as Land),
      email: e.email.trim(),
      ...(e.anschrift ? { anschrift: e.anschrift } : {}),
    },
    beruf: e.beruf.trim(),
    arbeitgeber: e.arbeitgeber.trim(),
    nettoeinkommen: betrag(e.netto),
    weitereLagen: e.lagen.map((l) => ({
      id: l.id,
      situation: l.situation,
      ausbildungArt: l.ausbildungArt,
      beruf: l.beruf.trim(),
      arbeitgeber: l.arbeitgeber.trim(),
      nettoeinkommen: betrag(l.netto),
    })),
    einkommenTrotzdem: e.einkommenTrotzdem,
    selbstauskunft: {
      einkommenArt: e.sa.einkommenArt,
      haustiere: null,
      haustiereText: '',
      insolvenz: e.sa.insolvenz,
      raeumungstitel: e.sa.raeumungstitel,
      mietrueckstaende: e.sa.mietrueckstaende,
      mietrueckstaendeSpaeter: e.sa.mietrueckstaende === null && !!e.sa.mietrueckstaendeSpaeter,
      stellungnahme: erklaerung('mietrueckstaende'),
      erklaerungInsolvenz: erklaerung('insolvenz'),
      erklaerungRaeumungstitel: erklaerung('raeumungstitel'),
      ort: '',
    },
  };
}

/** Felder für haushaltAendern; nur, wenn sich etwas geändert hat (sonst null). */
export function haushaltAus(
  e: SelbstauskunftEingabe,
  vorher: HaushaltsAngaben,
  personId: string,
): Partial<Haushalt> | null {
  const neu = {
    haustiere: e.hh.haustiere,
    haustiereText: e.hh.haustiere === 'ja' ? e.hh.haustiereText.trim() : '',
    ort: e.hh.ort.trim(),
  };
  const gleich =
    neu.haustiere === vorher.haustiere &&
    neu.haustiereText === vorher.haustiereText.trim() &&
    neu.ort === vorher.ort.trim();
  return gleich ? null : { ...neu, angabenVon: personId };
}

/**
 * DP116: Ein Feldname im Satz bricht nie um, auch nicht am Bindestrich („E-“ am Zeilenende, „Mail.“ darunter).
 * Leerzeichen werden geschützt (U+00A0), der Bindestrich wird der geschützte (U+2011).
 */
const GESCHUETZT = String.fromCharCode(0xa0);
const BINDESTRICH = String.fromCharCode(0x2011);
export function einheit(name: string): string {
  return name.replace(/ /g, GESCHUETZT).replace(/-/g, BINDESTRICH);
}

/** Was noch fehlt, als Satz über dem Knopf, oder undefined. */
export function grundFuer(
  person: Person,
  rolle: Rolle,
  e: SelbstauskunftEingabe,
): string | undefined {
  // DP116, Frage 3: Ein ausgefülltes, aber falsches Feld fehlt nicht. Dann steht der Satz des Teils, ohne „fehlt“.
  // Das Telefon ist das erste Feld des ersten Teils; ein Fehler dort geht darum allem anderen vor.
  if (telefonEingabeFehler(e)) return `${t('selbstauskunft.pruefenTelefon')}.`;
  const mitEingabe = { ...person, ...angabenAus(e) };
  const fehlt = fehlendeAngaben(mitEingabe, rolle, e.hh);
  if (!fehlt.length) return undefined;
  const fragen = fehlt.filter((f) => ['insolvenz', 'raeumungstitel'].includes(f));
  // Reihenfolge wie im Akkordeon: Kontakt, Einkommen, Fragen, Haustiere, Ort.
  const teile: string[] = [];
  // DP116, Frage 2: Der Satz nennt das Feld, nicht den Teil; reicht eine von zwei Angaben, heißt es „oder“.
  if (fehlt.includes('kontakt'))
    teile.push(
      t('selbstauskunft.fehlt.kontakt', {
        telefon: einheit(t('selbstauskunft.fehlt.telefon')),
        email: einheit(t('selbstauskunft.fehlt.email')),
      }),
    );
  if (fehlt.includes('nettoeinkommen'))
    teile.push(einheit(t('selbstauskunft.fehlt.nettoeinkommen')));
  if (fragen.length) teile.push(t('selbstauskunft.fehltFragen', { anzahl: fragen.length }));
  if (fehlt.includes('haustiere')) teile.push(t('selbstauskunft.fehlt.haustiere'));
  if (fehlt.includes('ort')) teile.push(t('selbstauskunft.fehlt.ort'));
  // Ab drei Angaben nur die Zahl: Die Teile stehen als Schritte darüber, und der Satz wurde bei großer
  // Schrift dreizeilig (selbstauskunft-person-serie.md, 4.11.). PC81 B1 (QA2): Die Zahl zählt Teile wie der
  // Kopf (Kontakt, Einkommen, Fragen, Haushalt), nicht die Angaben; Haustiere und Ort sind ein Teil.
  if (teile.length >= 3) {
    const offen = teileDerAuskunft(mitEingabe, rolle, e.hh).filter((x) => !x.fertig).length;
    return t('selbstauskunft.grundZahl', { anzahl: offen });
  }
  return t('selbstauskunft.grund', { liste: teile.join(', ') });
}

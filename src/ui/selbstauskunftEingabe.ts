import {
  ERKLAERUNG,
  fehlendeAngaben,
  haushaltsAngaben,
  selbstauskunftVon,
} from '../domain/selbstauskunft';
import type { HaushaltsAngaben, Selbstauskunft } from '../domain/selbstauskunft';
import type { Haushalt, Person, Rolle } from '../domain/modell';
import { t } from '../i18n';
import type { HaushaltAnsicht } from '../storage/speicher';

// Formularwerte der Selbstauskunft und der Weg zurück an Person und Haushalt
// (für den Rutsch, die eigene Seite und den Bereich „Selbstauskünfte“).

export interface SelbstauskunftEingabe {
  telefon: string;
  email: string;
  /** Wird hier nicht bearbeitet, bleibt aber erhalten. */
  anschrift?: string;
  beruf: string;
  arbeitgeber: string;
  /** Als Text, damit ein leeres Feld leer bleibt. */
  netto: string;
  sa: Selbstauskunft;
  /** Haustiere und Ort: gehören dem Haushalt, gelten in jedem Bogen. */
  hh: HaushaltsAngaben;
}

/** Haushaltsangaben aus dem geladenen Stand (mit Rückfall auf ältere Daten an Personen). */
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
    email: person.kontakt.email,
    ...(person.kontakt.anschrift ? { anschrift: person.kontakt.anschrift } : {}),
    beruf: person.beruf,
    arbeitgeber: person.arbeitgeber,
    netto: person.nettoeinkommen ? String(person.nettoeinkommen) : '',
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
      telefon: e.telefon.trim(),
      email: e.email.trim(),
      ...(e.anschrift ? { anschrift: e.anschrift } : {}),
    },
    beruf: e.beruf.trim(),
    arbeitgeber: e.arbeitgeber.trim(),
    nettoeinkommen: betrag(e.netto),
    selbstauskunft: {
      einkommenArt: e.sa.einkommenArt,
      haustiere: null,
      haustiereText: '',
      insolvenz: e.sa.insolvenz,
      raeumungstitel: e.sa.raeumungstitel,
      mietrueckstaende: e.sa.mietrueckstaende,
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

/** Was noch fehlt, als Satz unter dem Knopf, oder undefined. */
export function grundFuer(
  person: Person,
  rolle: Rolle,
  e: SelbstauskunftEingabe,
): string | undefined {
  const fehlt = fehlendeAngaben({ ...person, ...angabenAus(e) }, rolle, e.hh);
  if (!fehlt.length) return undefined;
  const fragen = fehlt.filter((f) => ['insolvenz', 'raeumungstitel'].includes(f));
  // Reihenfolge wie im Akkordeon: Kontakt, Einkommen, Fragen, Haustiere, Ort.
  const teile: string[] = [];
  if (fehlt.includes('kontakt')) teile.push(t('selbstauskunft.fehlt.kontakt'));
  if (fehlt.includes('nettoeinkommen')) teile.push(t('selbstauskunft.fehlt.nettoeinkommen'));
  if (fragen.length) teile.push(t('selbstauskunft.fehltFragen', { anzahl: fragen.length }));
  if (fehlt.includes('haustiere')) teile.push(t('selbstauskunft.fehlt.haustiere'));
  if (fehlt.includes('ort')) teile.push(t('selbstauskunft.fehlt.ort'));
  // Ab drei Teilen nur die Zahl: Die Teile stehen als Schritte darüber, und der Satz wurde bei großer
  // Schrift dreizeilig (selbstauskunft-person-serie.md, 4.11.).
  if (teile.length >= 3) return t('selbstauskunft.grundZahl', { anzahl: teile.length });
  return t('selbstauskunft.grund', { liste: teile.join(', ') });
}

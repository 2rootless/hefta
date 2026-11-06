import { APP_NAME } from '../app/name';
import de from './de.json';

// Texte der Oberfläche. Startsprache Deutsch; weitere Sprachen bekommen eine eigene JSON-Datei
// mit denselben Schlüsseln. Die erzeugten PDFs haben einen eigenen, festen deutschen Katalog.

type Katalog = typeof de;
type Mehrzahl = { one: string; other: string };

/** Alle Punkt-Pfade im Katalog, z. B. 'uebersicht.leer.titel'. Mehrzahl-Objekte zählen als Blatt. */
type Pfade<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Mehrzahl
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Pfade<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TextSchluessel = Pfade<Katalog>;
type Werte = Record<string, string | number>;

const sprache = 'de';
const katalog: Katalog = de;
const mehrzahlRegeln = new Intl.PluralRules(sprache);
const zahlen = new Intl.NumberFormat(sprache);

function nachschlagen(schluessel: string): unknown {
  return schluessel.split('.').reduce<unknown>((knoten, teil) => {
    return knoten && typeof knoten === 'object'
      ? (knoten as Record<string, unknown>)[teil]
      : undefined;
  }, katalog);
}

function einsetzen(text: string, werte: Werte): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (name === 'app') return APP_NAME;
    // Zahlen im Satz bis zwölf als Wort (Prüfkatalog T6): {wort} „drei“, {Wort} am Satzanfang „Drei“.
    if (name === 'wort' || name === 'Wort') {
      const wort = zahlwort(Number(werte.anzahl ?? 0));
      return name === 'Wort' ? wort.charAt(0).toUpperCase() + wort.slice(1) : wort;
    }
    const wert = werte[name];
    if (wert === undefined) return `{${name}}`;
    return typeof wert === 'number' ? zahlen.format(wert) : wert;
  });
}

/**
 * Text zum Schlüssel. Mehrzahl über den Wert `anzahl`:
 * t('export.seiten', { anzahl: 3 }) → „3 Seiten“.
 */
export function t(schluessel: TextSchluessel, werte: Werte = {}): string {
  const eintrag = nachschlagen(schluessel);
  if (typeof eintrag === 'string') return einsetzen(eintrag, werte);
  if (eintrag && typeof eintrag === 'object' && 'other' in eintrag) {
    const formen = eintrag as Mehrzahl;
    const anzahl = Number(werte.anzahl ?? 0);
    const form = mehrzahlRegeln.select(anzahl) === 'one' ? formen.one : formen.other;
    return einsetzen(form, werte);
  }
  throw new Error(`Text fehlt: ${schluessel}`);
}

const datumLang = new Intl.DateTimeFormat(sprache, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Tag und Monat stehen zusammen: geschütztes Leerzeichen statt „12. / Juli“ (C23). */
export function tagZusammen(text: string): string {
  return text.replace(/(\d{1,2}\.) /, '$1\u00a0');
}

/** Datum in der App: „28. Oktober 2026“. */
export function datum(wert: Date): string {
  return tagZusammen(datumLang.format(wert));
}

const zahl1 = new Intl.NumberFormat(sprache, { maximumFractionDigits: 1 });

/** Dateigröße: „850 KB“, „12,4 MB“, „10 GB“. */
export function groesse(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${zahl1.format(bytes / 1024 / 1024)} MB`;
  return `${zahl1.format(bytes / 1024 ** 3)} GB`;
}

const monatLang = new Intl.DateTimeFormat(sprache, { month: 'long' });

/** „Oktober“, mit Jahr nur, wenn es nicht das laufende ist: „Dezember 2025“. */
export function monatName(monat: string, heute: Date = new Date()): string {
  const [j, m] = monat.split('-').map(Number) as [number, number];
  const name = monatLang.format(new Date(j, m - 1, 1));
  return j === heute.getFullYear() ? name : `${name} ${j}`;
}

/** Kalendertag „JJJJ-MM-TT“ als „28. Oktober 2026“. */
export function tagText(tag: string): string {
  const [j, m, d] = tag.split('-').map(Number) as [number, number, number];
  return datum(new Date(j, m - 1, d));
}

/** Zahlen im Satz bis zwölf ausgeschrieben („zwei Dinge“), darüber als Ziffern (Prüfkatalog T6). */
export function zahlwort(n: number): string {
  return katalog.zahlwoerter[n] ?? zahlen.format(n);
}

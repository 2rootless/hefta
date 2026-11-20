// Telefon mit Land (E222, DP77, E224): Hefta setzt jede Eingabe mit ihrem Land in die feste Form und in die
// internationale Nummer (E.164) um. Was sich nicht eindeutig umsetzen lässt, nimmt Hefta nicht an (Fehler statt
// Nachfrage, DP77 Abschnitt 3). Die Daten über die Rufnummernpläne kommen aus `libphonenumber-js` mit dem vollen
// Datenumfang („max“), denn nur der kennt die Art einer Nummer (TL26, Sonderrufnummern). Läuft ohne Netz.
import { telefonPasst } from '../../pakete/hefta-json/src/index';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberWithError,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/max';

export type Land = CountryCode;
export const DEUTSCHLAND: Land = 'DE';

export type TelefonFehler =
  'buchstaben' | 'durchwahl' | 'vorwahl' | 'kurz' | 'lang' | 'land' | 'unbekannt';

export type TelefonErgebnis =
  | { art: 'leer' }
  | { art: 'fehler'; fehler: TelefonFehler; vorwahl?: string }
  | {
      art: 'gut';
      /** Die feste Form, wie sie überall steht: deutsch national, sonst international (DP77, Abschnitt 4). */
      anzeige: string;
      e164: string;
      /** International mit Gruppen, für den Satz „Wird zu +49 171 3920001.“ unter dem Feld (DP77, Abschnitt 2). */
      international: string;
      /** Die Ländervorwahl, „+44“, für den Hinweis zur Umstellung. */
      vorwahl: string;
      land: Land;
      /** Das Land kam aus dem „+“ oder „00“ der Eingabe und ist ein anderes als das gewählte (TL14, TL21). */
      umgestellt: boolean;
      /** Gültig, aber eine Sonderrufnummer (0900, 0180 …): Nachfrage nach W33 (TL26). */
      ungewoehnlich: boolean;
    };

const SONDER = new Set(['PREMIUM_RATE', 'SHARED_COST', 'UAN', 'PAGER', 'VOICEMAIL']);

/** Die feste Form einer gültigen Nummer: Deutschland national nach DIN 5008, alle anderen international (E.123). */
export function anzeigeAus(p: PhoneNumber): string {
  return p.country === DEUTSCHLAND ? p.formatNational() : p.formatInternational();
}

function lesen(text: string, land: Land): PhoneNumber | null {
  try {
    return parsePhoneNumberWithError(text, land);
  } catch {
    return null;
  }
}

const ziffern = (s: string) => s.replace(/\D/g, '');

/** Prüft eine Eingabe mit ihrem Land. Wirft nie. */
export function telefonPruefen(eingabe: string, land: Land = DEUTSCHLAND): TelefonErgebnis {
  const text = eingabe.trim();
  if (!text) return { art: 'leer' };
  // TL4 bis TL6: Buchstaben, auch „mobil“ oder „ext.“.
  if (/\p{L}/u.test(text)) return { art: 'fehler', fehler: 'buchstaben' };
  if (!/^[\d\s+()/.\-–]+$/.test(text) || (text.match(/\+/g) ?? []).length > 1)
    return { art: 'fehler', fehler: 'buchstaben' };
  // TL3: Eine Durchwahl hinter einem Bindestrich („0171 3920001-12“): Der Teil davor ist schon eine Nummer.
  const durchwahl = /^(.*\d)\s*[-–]\s*(\d{1,5})$/.exec(text);
  if (durchwahl && lesen(durchwahl[1]!, land)?.isValid())
    return { art: 'fehler', fehler: 'durchwahl' };
  const international = text.startsWith('+') || ziffern(text).startsWith('00');
  // TL7: In Deutschland beginnt die Vorwahl mit 0; „3920001“ wäre sonst eine falsche Ortsnummer.
  if (land === DEUTSCHLAND && !international && !ziffern(text).startsWith('0'))
    return { art: 'fehler', fehler: 'vorwahl' };
  if (validatePhoneNumberLength(text, land) === 'INVALID_COUNTRY' && international) {
    const vorwahl = ziffern(text).replace(/^00/, '').slice(0, 3);
    return { art: 'fehler', fehler: 'unbekannt', vorwahl: `+${vorwahl}` };
  }
  const p = lesen(text, land);
  if (!p) return { art: 'fehler', fehler: international ? 'unbekannt' : 'kurz' };
  if (!p.isValid())
    return {
      art: 'fehler',
      fehler: warumUngueltig(text, land, p),
      vorwahl: `+${p.countryCallingCode}`,
    };
  const gefunden = (p.country ?? land) as Land;
  return {
    art: 'gut',
    anzeige: anzeigeAus(p),
    e164: p.number,
    international: p.formatInternational(),
    vorwahl: `+${p.countryCallingCode}`,
    land: gefunden,
    umgestellt: gefunden !== land,
    ungewoehnlich: SONDER.has(p.getType() ?? ''),
  };
}

/** Zu kurz, zu lang oder nicht zum Land passend (TL8, TL9, TL22). */
function warumUngueltig(text: string, land: Land, p: PhoneNumber): TelefonFehler {
  const laenge = validatePhoneNumberLength(text, land);
  if (laenge === 'TOO_SHORT') return 'kurz';
  if (laenge === 'TOO_LONG') return 'lang';
  const national = p.nationalNumber;
  const praefix = text.trim().startsWith('+') ? `+${p.countryCallingCode}` : '';
  const gueltig = (n: string) =>
    lesen(praefix ? `${praefix}${n}` : `0${n}`, land)?.isValid() ?? false;
  // TL22: Mit Deutschland wäre es eine gültige Nummer: Stimmt das Land? (Deutschland ist vorgewählt; wer ein
  // anderes Land wählt und eine deutsche Nummer tippt, hat sich meist im Land vertan.)
  if (!praefix && land !== DEUTSCHLAND && lesen(text, DEUTSCHLAND)?.isValid()) return 'land';
  // Zu kurz oder zu lang: Wird die Nummer mit bis zu drei Ziffern mehr gültig, fehlt eine; mit bis zu sechs weniger,
  // steht eine zu viel da. Ein Fehler, nie eine Vermutung über die richtige Nummer.
  for (let n = 1; n <= 6; n++) {
    if (national.length > n + 2 && gueltig(national.slice(0, -n))) return 'lang';
    if (n <= 3) for (const z of ['0', '1', '5']) if (gueltig(national + z.repeat(n))) return 'kurz';
  }
  return 'land';
}

/** „Oft gewählt“ im Blatt (DP77, Abschnitt 2). */
export const OFT: Land[] = ['DE', 'AT', 'CH'];

/** Weitere gängige Namen für die Suche im Blatt (DP77, Abschnitt 2). */
const ANDERE_NAMEN: Partial<Record<Land, string[]>> = {
  GB: ['England', 'Großbritannien', 'UK', 'Schottland', 'Wales'],
  NL: ['Holland'],
  US: ['USA', 'Amerika'],
  CZ: ['Tschechei'],
  CI: ['Elfenbeinküste'],
};

export interface LandEintrag {
  land: Land;
  name: string;
  vorwahl: string;
}

let namen: Intl.DisplayNames | null = null;
/** Deutscher Name eines Landes aus dem Browser (CLDR, `Intl.DisplayNames`); ohne Namen das Kürzel. */
export function landName(land: Land): string {
  try {
    namen ??= new Intl.DisplayNames(['de'], { type: 'region' });
    return namen.of(land) ?? land;
  } catch {
    return land;
  }
}

/** Alle Länder mit eigener Vorwahl, von A bis Z nach deutschem Namen. */
export function alleLaender(): LandEintrag[] {
  const sortieren = new Intl.Collator('de');
  return getCountries()
    .map((land) => ({ land, name: landName(land), vorwahl: `+${getCountryCallingCode(land)}` }))
    .sort((a, b) => sortieren.compare(a.name, b.name));
}

/** Ohne Umlaute und Akzente, klein: „osterreich“ findet Österreich. */
export function ohneAkzent(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ß', 'ss').toLowerCase();
}

/** Suche im Blatt: Wortanfang im Namen und in anderen Namen, Kürzel, Vorwahl („43“, „+43“, „0043“). */
export function laenderSuchen(frage: string, liste: LandEintrag[] = alleLaender()): LandEintrag[] {
  const q = ohneAkzent(frage.trim());
  if (!q) return liste;
  const zahl = /^(\+|00)?\d+$/.test(q) ? q.replace(/^(\+|00)/, '') : null;
  return liste.filter((e) => {
    if (zahl !== null) return e.vorwahl.slice(1) === zahl;
    if (ohneAkzent(e.land) === q) return true;
    const woerter = [e.name, ...(ANDERE_NAMEN[e.land] ?? [])].flatMap((n) =>
      ohneAkzent(n).split(/[\s\-–()]+/),
    );
    const ganz = [e.name, ...(ANDERE_NAMEN[e.land] ?? [])].map(ohneAkzent);
    return woerter.some((w) => w.startsWith(q)) || ganz.some((n) => n.startsWith(q));
  });
}

/**
 * Eine gespeicherte Nummer aus der Zeit vor E222 (DP77, Abschnitt 5): mit Deutschland umgesetzt, wenn das eindeutig
 * geht, sonst null. Eindeutig heißt: gültig und ohne Nachfrage.
 */
export function alteNummerUmsetzen(
  alt: string,
): { anzeige: string; e164: string; land: Land } | null {
  const r = telefonPruefen(alt, DEUTSCHLAND);
  if (r.art !== 'gut') return null;
  return { anzeige: r.anzeige, e164: r.e164, land: r.land };
}

/** Gespeicherte Angaben zum Telefon einer Person (Person.kontakt). */
export interface TelefonAngaben {
  telefon: string;
  telefonLand?: string;
  telefonE164?: string;
}

/**
 * Was von einer gespeicherten Nummer in Mappe, Anschreiben und „Zum Übertragen“ steht: die feste Form und die
 * internationale Nummer, oder null, wenn sie fehlt oder sich nicht umsetzen ließ. Hefta druckt nichts, was es nicht
 * umsetzen kann (DP77, Abschnitt 5).
 */
export function telefonFuerMappe(k: TelefonAngaben): { anzeige: string; e164: string } | null {
  const anzeige = (k.telefon ?? '').trim();
  if (!anzeige || !k.telefonE164 || !telefonPasst(anzeige, k.telefonE164)) return null;
  return { anzeige, e164: k.telefonE164 };
}

/** Eine Nummer ist eingetragen, lässt sich aber nicht umsetzen: offener Punkt „Telefonnummer von … prüfen“. */
export function telefonOffen(k: TelefonAngaben): boolean {
  return !!(k.telefon ?? '').trim() && !telefonFuerMappe(k);
}

/** Was Hefta aus einer Eingabe speichert: bei einem Fehler die Eingabe, wie sie ist, ohne internationale Nummer. */
export function telefonSpeichern(eingabe: string, land: Land): TelefonAngaben {
  const r = telefonPruefen(eingabe, land);
  if (r.art === 'gut') return { telefon: r.anzeige, telefonLand: r.land, telefonE164: r.e164 };
  return { telefon: eingabe.trim(), ...(r.art === 'fehler' ? { telefonLand: land } : {}) };
}

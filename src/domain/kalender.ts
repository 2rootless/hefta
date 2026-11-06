import { APP_NAME } from '../app/name';
import { faelligAb, monatAus, monatPlus, tagAus } from './fristen';
import { ohneTrennstellen, type PersonStand } from './regelkatalog';

// Version 2, Erinnerung als Kalendereintrag (design/abgleich-produkt.md, W1b, W2b): Push bräuchte
// einen Server, eine .ics-Datei nicht. iOS ersetzt Termine nicht von selbst (Probe auf dem iPhone,
// 2.11.), darum ein einziger fester Termin im Monat statt eines je Unterlage: Er bleibt richtig,
// egal was dazukommt, und ein Monat fällt immer zwischen „bald zu alt“ und „zu alt“.

export interface Termin {
  uid: string;
  /** Erster Kalendertag „JJJJ-MM-TT“. */
  tag: string;
  /** Uhrzeit „HHMM“ in Ortszeit, sonst 18 Uhr (Entwurf W2b). */
  uhrzeit?: string;
  titel: string;
  text: string;
  /** Jeden Monat am selben Tag statt einmal. */
  monatlich?: boolean;
}

/**
 * Der eine Monatstermin: am Abrechnungstag der ersten Person mit Gehaltsabrechnungen (5., 15. oder
 * 28.), ohne Gehaltsabrechnungen im Haushalt am 1. Beginnt nie in der Vergangenheit.
 */
export function monatsTermin(
  haushaltId: string,
  staende: PersonStand[],
  heute: Date = new Date(),
): Termin {
  const heuteTag = tagAus(heute);
  const mitGehalt = staende.find((s) => s.unterlagen.some((u) => u.typ.serie));
  let monat = monatAus(heute);
  const tagIn = (m: string) =>
    mitGehalt ? tagAus(faelligAb(monatPlus(m, -1), mitGehalt.person.abrechnungMeist)) : `${m}-01`;
  while (tagIn(monat) < heuteTag) monat = monatPlus(monat, 1);
  return {
    uid: `monatstermin-${haushaltId}@mappe`,
    tag: tagIn(monat),
    monatlich: true,
    titel: `${APP_NAME}: Unterlagen ansehen`,
    text: `Neue Gehaltsabrechnung da? Wird etwas bald zu alt? ${APP_NAME} zeigt es dir.`,
  };
}

/** Text für iCalendar: Backslash, Semikolon, Komma und Zeilenumbrüche maskieren (RFC 5545, 3.3.11). */
function maskieren(text: string): string {
  return ohneTrennstellen(text)
    .replace(/[\\;,]/g, (z) => `\\${z}`)
    .replace(/\r?\n/g, '\\n');
}

/** Zeilen über 75 Byte falten (RFC 5545, 3.1), ohne UTF-8-Zeichen zu zerteilen. */
function falten(zeile: string): string {
  const teile: string[] = [];
  let aktuell = '';
  let bytes = 0;
  for (const zeichen of zeile) {
    const laenge = new TextEncoder().encode(zeichen).length;
    if (bytes + laenge > (teile.length ? 74 : 75)) {
      teile.push(aktuell);
      aktuell = '';
      bytes = 0;
    }
    aktuell += zeichen;
    bytes += laenge;
  }
  teile.push(aktuell);
  return teile.join('\r\n ');
}

export function icsErzeugen(termine: Termin[], jetzt: Date = new Date()): string {
  const stempel = jetzt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const ohneStriche = (tag: string) => tag.replaceAll('-', '');
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${APP_NAME}//Erinnerungen//DE`,
    'CALSCALE:GREGORIAN',
  ];
  // Ohne Zeitzone: 18 Uhr dort, wo das Telefon gerade ist. Die Erinnerung kommt zum Termin.
  for (const t of termine)
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:${t.uid}`,
      `DTSTAMP:${stempel}`,
      `DTSTART:${ohneStriche(t.tag)}T${t.uhrzeit ?? '1800'}00`,
      'DURATION:PT15M',
      ...(t.monatlich ? [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${Number(t.tag.slice(8))}`] : []),
      `SUMMARY:${maskieren(t.titel)}`,
      `DESCRIPTION:${maskieren(t.text)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0M',
      `DESCRIPTION:${maskieren(t.titel)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  zeilen.push('END:VCALENDAR');
  return zeilen.map(falten).join('\r\n') + '\r\n';
}

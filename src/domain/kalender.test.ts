import { describe, expect, it } from 'vitest';
import type { DateiVersion, Dokument, Person } from './modell';
import { icsErzeugen, monatsTermin } from './kalender';
import { personStand } from './regelkatalog';

const HEUTE = new Date(2026, 10, 6);

const max: Person = {
  id: 'p1',
  createdAt: '',
  updatedAt: '',
  vorname: 'Max',
  nachname: 'Mustermann',
  rufname: 'Max',
  kontakt: { telefon: '', email: '' },
  lebenssituation: 'angestellt',
  beruf: '',
  arbeitgeber: '',
  nettoeinkommen: null,
  abrechnungMeist: 'ende',
};

const dok = (typ: string): Dokument => ({
  id: `d-${typ}`,
  createdAt: '',
  updatedAt: '',
  personId: 'p1',
  typ,
  notiz: '',
  serie: null,
  stummBis: null,
});

const version = (typ: string, teil: Partial<DateiVersion>): DateiVersion => ({
  id: `v-${typ}-${teil.abrechnungsmonat ?? teil.ausstellungsdatum}`,
  createdAt: '',
  updatedAt: '',
  dokumentId: `d-${typ}`,
  ausstellungsdatum: null,
  abrechnungsmonat: null,
  variante: null,
  original: 'f',
  aufbereitet: null,
  seiten: null,
  schwaerzungen: {},
  gerastert: false,
  erkannteWerte: null,
  vomNutzerBestaetigt: null,
  ...teil,
});

describe('Erinnerungen als Kalendereintrag (Version 2)', () => {
  const stand = personStand(
    max,
    'hauptmieter',
    [dok('gehaltsnachweis'), dok('bonitaet')],
    [
      ...['2026-07', '2026-08', '2026-09'].map((m) =>
        version('gehaltsnachweis', { abrechnungsmonat: m }),
      ),
      version('bonitaet', { ausstellungsdatum: '2026-10-20' }),
    ],
    HEUTE,
  );

  it('ist ein einziger Monatstermin am Abrechnungstag, nie in der Vergangenheit', () => {
    const t = monatsTermin('h1', [stand], HEUTE);
    expect(t).toMatchObject({
      uid: 'monatstermin-h1@mappe',
      tag: '2026-11-28',
      monatlich: true,
      titel: 'Hefta: Unterlagen ansehen',
    });
    expect(monatsTermin('h1', [stand], new Date(2026, 10, 29)).tag).toBe('2026-12-28');
    expect(icsErzeugen([t])).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=28\r\n');
  });

  it('nimmt den Tag aus „Anfang“ und „Mitte“, ohne Gehalt den Ersten', () => {
    const mitte = personStand({ ...max, abrechnungMeist: 'mitte' }, 'hauptmieter', [], [], HEUTE);
    expect(monatsTermin('h1', [mitte], HEUTE).tag).toBe('2026-11-15');
    const anfang = personStand({ ...max, abrechnungMeist: 'anfang' }, 'hauptmieter', [], [], HEUTE);
    expect(monatsTermin('h1', [anfang], HEUTE).tag).toBe('2026-12-05');
    const rente = personStand({ ...max, lebenssituation: 'rente' }, 'hauptmieter', [], [], HEUTE);
    expect(monatsTermin('h1', [rente], HEUTE).tag).toBe('2026-12-01');
  });

  it('schreibt gültiges iCalendar mit CRLF, um 18 Uhr mit Erinnerung, maskiert und gefaltet', () => {
    const ics = icsErzeugen(
      [
        {
          uid: 'a@mappe',
          tag: '2026-11-28',
          titel: 'Gehalt, Max; neu',
          text: `Zeile eins\nZeile zwei ${'ä'.repeat(60)}`,
        },
      ],
      new Date(Date.UTC(2026, 10, 6, 9, 30)),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261128T180000\r\nDURATION:PT15M\r\n');
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0M\r\n');
    expect(ics).not.toContain('RRULE');
    expect(ics).toContain('DTSTAMP:20261106T093000Z');
    expect(ics).toContain('SUMMARY:Gehalt\\, Max\\; neu');
    expect(ics).toContain('Zeile eins\\nZeile zwei');
    for (const zeile of ics.split('\r\n'))
      expect(new TextEncoder().encode(zeile).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

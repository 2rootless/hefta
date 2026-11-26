import { describe, expect, it } from 'vitest';
import { angabenMischen, ausgefuellt } from './angabenMischen';
import type { Person } from './modell';

// DP150 C1 (PC215): Leeres ersetzt nie etwas; ausgefüllt und verschieden gilt das von hier, und der Kasten nennt es.
// Namen aus der Namensliste (W40), Nummern wie im Muster.

const ZEIT = '2026-11-26T10:00:00.000Z';
const leer = (id: string): Person => ({
  id,
  createdAt: ZEIT,
  updatedAt: ZEIT,
  vorname: 'Jarne',
  nachname: 'Ostendorp',
  rufname: 'Jarne',
  kontakt: { telefon: '', email: '' },
  lebenssituation: 'angestellt',
  beruf: '',
  arbeitgeber: '',
  nettoeinkommen: null,
  abrechnungMeist: null,
});
const FERTIG: Person = {
  ...leer('dort'),
  kontakt: {
    telefon: '0171 3920011',
    telefonLand: 'DE',
    telefonE164: '+491713920011',
    email: 'jarne.ostendorp@example.com',
  },
  beruf: 'Logistikplaner',
  arbeitgeber: 'Tidenwerk Logistik',
  nettoeinkommen: 2800,
  selbstauskunft: {
    einkommenArt: 'betrag',
    haustiere: null,
    haustiereText: '',
    insolvenz: 'nein',
    raeumungstitel: 'nein',
    mietrueckstaende: null,
    stellungnahme: '',
    ort: '',
  },
} as Person;

describe('DP150 C1: Angaben mischen', () => {
  it('Nur der Name hier: Im Haushalt bleibt alles, nichts ändert sich', () => {
    const { person, aendert } = angabenMischen(FERTIG, leer('hier'));
    expect(person.kontakt.telefon).toBe('0171 3920011');
    expect(person.kontakt.email).toBe('jarne.ostendorp@example.com');
    expect(person.beruf).toBe('Logistikplaner');
    expect(person.nettoeinkommen).toBe(2800);
    expect(person.selbstauskunft?.insolvenz).toBe('nein');
    expect(person.id).toBe('dort');
    expect(aendert).toEqual([]);
  });

  it('Gegenprobe: Das bisherige Überschreiben (alles von hier) hätte die Angaben geleert', () => {
    const alt = { ...FERTIG, ...leer('hier'), id: FERTIG.id };
    expect(alt.kontakt.telefon).toBe('');
    expect(alt.beruf).toBe('');
  });

  it('Ausgefüllt und verschieden: das von hier gilt, der Kasten nennt Telefon und Beruf', () => {
    const hier: Person = {
      ...leer('hier'),
      kontakt: {
        telefon: '0171 3920099',
        telefonLand: 'DE',
        telefonE164: '+491713920099',
        email: '',
      },
      beruf: 'Disponent',
    };
    const { person, aendert } = angabenMischen(FERTIG, hier);
    expect(person.kontakt.telefon).toBe('0171 3920099');
    expect(person.kontakt.telefonE164).toBe('+491713920099');
    expect(person.kontakt.email).toBe('jarne.ostendorp@example.com');
    expect(person.beruf).toBe('Disponent');
    expect(person.arbeitgeber).toBe('Tidenwerk Logistik');
    expect(aendert).toEqual(['Telefon', 'Beruf']);
  });

  it('Hier ausgefüllt, dort leer: geht hinüber, ohne Satz', () => {
    const { person, aendert } = angabenMischen(leer('dort'), {
      ...leer('hier'),
      beruf: 'Disponent',
    });
    expect(person.beruf).toBe('Disponent');
    expect(aendert).toEqual([]);
  });

  it('ausgefuellt: leere Texte, null, leere Listen, false und leere Objekte zählen nicht', () => {
    for (const v of ['', '  ', null, undefined, [], false, { telefon: '', email: '' }])
      expect(ausgefuellt(v), JSON.stringify(v)).toBe(false);
    for (const v of ['x', 0, 2800, ['a'], true, { telefon: '0171' }])
      expect(ausgefuellt(v), JSON.stringify(v)).toBe(true);
  });
});

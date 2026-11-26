import { describe, expect, it } from 'vitest';
import {
  aufzaehlung,
  fehlendeFelder,
  formularFertig,
  gefragteFelder,
  teilStand,
  type Formular,
} from './formblatt';

// Formblatt (DP135, Abschnitt 3): aus einer Feldliste die Teile, ihr Stand und was fehlt.
type W = { name: string; tiere: boolean; tierText: string; ort: string; mitHaushalt: boolean };
const FORM: Formular<W> = {
  id: 'probe',
  teile: ['person', 'haushalt'],
  felder: [
    { id: 'name', teil: 'person', art: 'name', noetig: true, gefuellt: (w) => !!w.name },
    { id: 'beruf', teil: 'person', art: 'text', noetig: false, gefuellt: () => false },
    {
      id: 'tiere',
      teil: 'haushalt',
      art: 'text',
      gefragt: (w) => w.mitHaushalt,
      noetig: (w) => w.tiere,
      gefuellt: (w) => !!w.tierText,
    },
    {
      id: 'ort',
      teil: 'haushalt',
      art: 'text',
      gefragt: (w) => w.mitHaushalt,
      noetig: true,
      gefuellt: (w) => !!w.ort,
    },
  ],
};
const leer: W = { name: '', tiere: false, tierText: '', ort: '', mitHaushalt: true };

describe('Formblatt', () => {
  it('freiwillige Felder fehlen nie, nötige in der Reihenfolge der Liste', () => {
    expect(fehlendeFelder(FORM, leer).map((f) => f.id)).toEqual(['name', 'ort']);
    expect(fehlendeFelder(FORM, { ...leer, tiere: true }).map((f) => f.id)).toEqual([
      'name',
      'tiere',
      'ort',
    ]);
    expect(formularFertig(FORM, { ...leer, name: 'Jarne', ort: 'Hamburg' })).toBe(true);
  });

  it('Teile mit Stand; ohne gefragtes Feld entfällt ein Teil', () => {
    expect(teilStand(FORM, leer)).toEqual([
      { id: 'person', fertig: false, offen: 1, voll: false },
      { id: 'haushalt', fertig: false, offen: 1, voll: false },
    ]);
    // Fertig heißt: nichts Nötiges fehlt. Voll erst, wenn auch das Freiwillige da ist (W63).
    expect(teilStand(FORM, { ...leer, mitHaushalt: false, name: 'Hiltrud' })).toEqual([
      { id: 'person', fertig: true, offen: 0, voll: false },
    ]);
    const mitZusatz: Formular<W> = {
      ...FORM,
      felder: FORM.felder.map((f) => (f.id === 'beruf' ? { ...f, zusatz: true } : f)),
    };
    expect(teilStand(mitZusatz, { ...leer, mitHaushalt: false, name: 'Hiltrud' })).toEqual([
      { id: 'person', fertig: true, offen: 0, voll: true },
    ]);
    expect(gefragteFelder(FORM, { ...leer, mitHaushalt: false }).map((f) => f.id)).toEqual([
      'name',
      'beruf',
    ]);
  });

  it('dasselbe Feld unter zwei Bedingungen zählt einmal', () => {
    const doppelt: Formular<W> = { ...FORM, felder: [...FORM.felder, FORM.felder[0]!] };
    expect(fehlendeFelder(doppelt, leer).map((f) => f.id)).toEqual(['name', 'ort']);
  });

  it('Aufzählung für „Es fehlt noch“', () => {
    expect(aufzaehlung([])).toBe('');
    expect(aufzaehlung(['Höchstbetrag'])).toBe('Höchstbetrag');
    expect(aufzaehlung(['Name', 'Anschrift', 'Art'])).toBe('Name, Anschrift und Art');
    // Gegenprobe: kein Komma vor „und“.
    expect(aufzaehlung(['A', 'B'])).not.toContain(',');
  });
});

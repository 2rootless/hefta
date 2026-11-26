import { describe, expect, it } from 'vitest';
import type { Person } from '../domain/modell';
import {
  fehlendeAngaben,
  haushaltsAngaben,
  leereSelbstauskunft,
  selbstauskunftBloecke,
  selbstauskunftFormular,
  teile,
} from '../domain/selbstauskunft';
import { angabenAus, eingabeAus } from '../ui/selbstauskunftEingabe';
import { gefragteFelder } from './formblatt';

// PC208, Schritt 1: die Selbstauskunft auf dem Formblatt, mit freiwilliger Anschrift in drei Feldern (W60, DP135 U6).
const ZEIT = '2026-11-25T10:00:00.000Z';
function selin(teil: Partial<Person> = {}): Person {
  return {
    id: 'p-selin',
    createdAt: ZEIT,
    updatedAt: ZEIT,
    vorname: 'Selin',
    nachname: 'Akgül',
    rufname: 'Selin',
    kontakt: { telefon: '', email: 'selin.akguel@example.com' },
    lebenssituation: 'angestellt',
    beruf: 'Bauingenieurin',
    arbeitgeber: '',
    nettoeinkommen: 3100,
    abrechnungMeist: null,
    selbstauskunft: {
      ...leereSelbstauskunft(),
      insolvenz: 'nein',
      raeumungstitel: 'nein',
    },
    ...teil,
  };
}
const HH = { haustiere: 'nein' as const, haustiereText: '', ort: 'Hamburg' };
const WER = { erwachsene: 2, kinder: 1 };

describe('Selbstauskunft auf dem Formblatt', () => {
  it('Felder aus dem Regelkatalog, dazu Anschrift und Ort; Teile in fester Reihenfolge', () => {
    const form = selbstauskunftFormular('vertrag', selin());
    const w = { person: selin(), rolle: 'vertrag' as const, hh: HH };
    expect(gefragteFelder(form, w).map((f) => f.id)).toEqual([
      'kontakt',
      'anschrift',
      'personenzahl',
      'beruf',
      'arbeitgeber',
      'nettoeinkommen',
      'haustiere',
      'insolvenz',
      'raeumungstitel',
      'rueckstand_monate',
      'rueckstand_mieten',
      'kuendigung',
      'ort',
    ]);
    expect(teile(selin(), 'vertrag', HH).map((x) => x.id)).toEqual([
      'kontakt',
      'einkommen',
      'fragen',
      'haushalt',
    ]);
  });

  it('wer bürgt, hat keinen Teil „Haushalt“', () => {
    expect(teile(selin(), 'buerge', HH).map((x) => x.id)).toEqual([
      'kontakt',
      'einkommen',
      'fragen',
    ]);
  });

  it('die Anschrift ist freiwillig und zählt nicht als Kontakt', () => {
    expect(fehlendeAngaben(selin(), 'vertrag', HH)).toEqual([]);
    const ohneMail = selin({
      kontakt: {
        telefon: '',
        email: '',
        anschrift: 'Lindenring 3, 20259 Hamburg',
        anschriftTeile: { strasse: 'Lindenring 3', plz: '20259', ort: 'Hamburg' },
      },
    });
    // Gegenprobe: Mit Anschrift, aber ohne Telefon und E-Mail fehlt der Kontakt weiter.
    expect(fehlendeAngaben(ohneMail, 'vertrag', HH)).toEqual(['kontakt']);
  });

  it('im PDF steht die Anschrift nach dem Namen, sonst „keine Angabe“ an ihrem Platz', () => {
    const zeilen = (p: Person) =>
      selbstauskunftBloecke(p, 'vertrag', WER, HH, 'zusage', {})[0]!.zeilen.map((z) => [
        z.id,
        'wert' in z ? z.wert : '',
      ]);
    expect(zeilen(selin()).slice(0, 3)).toEqual([
      ['name', 'Selin Akgül'],
      ['anschrift', ''],
      ['kontakt', 'selin.akguel@example.com'],
    ]);
    const mit = selin({
      kontakt: {
        telefon: '',
        email: 'selin.akguel@example.com',
        anschriftTeile: { strasse: 'Lindenring 3', plz: '20259', ort: 'Hamburg' },
      },
    });
    expect(zeilen(mit)[1]).toEqual(['anschrift', 'Lindenring 3, 20259 Hamburg']);
    // Ältere Daten mit der Anschrift als Zeile.
    const alt = selin({
      kontakt: { telefon: '', email: '', anschrift: 'Lindenring 8, 22081 Hamburg' },
    });
    expect(zeilen(alt)[1]).toEqual(['anschrift', 'Lindenring 8, 22081 Hamburg']);
  });

  it('Eingabe: ältere Zeile wird aufgeteilt; gespeichert werden Teile und Text, leer nichts', () => {
    const alt = selin({
      kontakt: { telefon: '', email: 'x@example.com', anschrift: 'Lindenring 8\n22081 Hamburg' },
    });
    const e = eingabeAus(alt, haushaltsAngaben(null));
    expect(e.anschrift).toEqual({ strasse: 'Lindenring 8', plz: '22081', ort: 'Hamburg' });
    expect(angabenAus(e).kontakt).toMatchObject({
      anschrift: 'Lindenring 8, 22081 Hamburg',
      anschriftTeile: { strasse: 'Lindenring 8', plz: '22081', ort: 'Hamburg' },
    });
    const leer = eingabeAus(selin(), haushaltsAngaben(null));
    expect(leer.anschrift).toEqual({ strasse: '', plz: '', ort: '' });
    const k = angabenAus(leer).kontakt!;
    expect('anschrift' in k || 'anschriftTeile' in k).toBe(false);
  });
});

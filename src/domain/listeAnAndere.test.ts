import { describe, expect, it } from 'vitest';
import { fehlendFuerListe, listeAlsText, listenEmpfaenger } from './listeAnAndere';
import type { Dokument, DateiVersion, Person } from './modell';
import { personStand } from './regelkatalog';

const HEUTE = new Date(2026, 10, 2);

const person = (id: string, vorname: string, teil: Partial<Person> = {}): Person => ({
  id,
  createdAt: '',
  updatedAt: '',
  vorname,
  nachname: 'Mustermann',
  rufname: vorname,
  kontakt: { telefon: '', email: '' },
  lebenssituation: 'angestellt',
  beruf: '',
  arbeitgeber: '',
  nettoeinkommen: null,
  abrechnungMeist: null,
  ...teil,
});

const dok = (personId: string, typ: string): Dokument => ({
  id: `d-${personId}-${typ}`,
  createdAt: '',
  updatedAt: '',
  personId,
  typ,
  notiz: '',
  serie: null,
  stummBis: null,
});

const version = (personId: string, typ: string, datum: string): DateiVersion => ({
  id: `v-${personId}-${typ}`,
  createdAt: '',
  updatedAt: '',
  dokumentId: `d-${personId}-${typ}`,
  ausstellungsdatum: datum,
  abrechnungsmonat: null,
  variante: null,
  original: 'f',
  aufbereitet: null,
  seiten: null,
  schwaerzungen: {},
  gerastert: false,
  erkannteWerte: null,
  vomNutzerBestaetigt: null,
});

const petra = personStand(
  person('p2', 'Petra', { lebenssituation: 'rente' }),
  'buerge',
  [],
  [],
  HEUTE,
);
const max = personStand(person('p1', 'Max'), 'hauptmieter', [], [], HEUTE);

describe('Liste an andere schicken (Version 2.0)', () => {
  it('schreibt die Nachricht wie im Entwurf L2', () => {
    expect(listeAlsText(petra, { von: 'Max' })).toBe(
      [
        'Hallo Petra, für unsere Wohnungsbewerbung brauchen wir noch von dir:',
        '',
        '• Bürgschaftserklärung: unterschrieben auf Papier, für die Mappe reicht ein Scan.',
        '• Rentenbescheid: der aktuelle Bescheid der Rentenversicherung.',
        '• Bonitätsnachweis: die Auskunft für Vermieter (SCHUFA-BonitätsCheck), nicht die kostenlose Datenkopie. Meist nicht älter als drei Monate.',
        '• Selbstauskunft: die füllen wir zusammen aus, ich frage dich kurz nach deiner Rente und drei Ja-Nein-Fragen.',
        '',
        'Am liebsten als PDF. Papier machst du am iPhone in der App Dateien über „Dokumente scannen“ zum PDF. Danke! Max',
      ].join('\n'),
    );
  });

  it('lässt die Selbstauskunft auf Wunsch weg und sagt „ich“, wer allein sucht', () => {
    const text = listeAlsText(petra, { von: 'Max', allein: true, selbstauskunft: false });
    expect(text).toContain('für meine Wohnungsbewerbung brauche ich noch von dir');
    expect(text).not.toContain('Selbstauskunft');
  });

  it('nennt nur, was fehlt, und nur andere als die erste Person', () => {
    const fertig = personStand(
      person('p3', 'Lea', { lebenssituation: 'rente' }),
      'mitmieter',
      [dok('p3', 'bonitaet'), dok('p3', 'rentenbescheid')],
      [version('p3', 'bonitaet', '2026-10-20'), version('p3', 'rentenbescheid', '2026-10-01')],
      HEUTE,
    );
    expect(fehlendFuerListe(fertig).map((u) => u.typ.id)).toEqual(['selbstauskunft']);
    expect(listenEmpfaenger([max, fertig, petra]).map((s) => s.person.vorname)).toEqual([
      'Lea',
      'Petra',
    ]);
  });
});

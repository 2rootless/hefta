import { describe, expect, it } from 'vitest';
import beispiele from '../../data/nachricht-faelle.de.json';
import {
  ANGABEN,
  angabenWerte,
  erkennen,
  erklaerung,
  mailLink,
  nachrichtText,
  type AngabeId,
} from './nachricht';

const text = (name: string) => beispiele.faelle.find((f) => f.name === name)!.text;

const AUFTRAG = {
  name: 'Max Mustermann',
  telefon: '0151 23456789',
  mail: 'max.mustermann@example.com',
  wohnung: 'Hauptstraße 12, 3. OG links',
  satz: 'Wir sind ein ruhiges Paar.',
  angaben: {},
  mappe: false,
};

describe('PN4: Erkennen im Inseratstext', () => {
  // Jeder Fall mit Text und Erwartung steht in data/nachricht-faelle.de.json: Neuer Fall, neue Zeile.
  it.each(beispiele.faelle.map((f) => [f.name, f] as const))('%s', (_, f) => {
    const e = erkennen(f.text);
    expect(e.angaben).toEqual(f.angaben);
    expect(e.unzulaessig).toEqual(f.unzulaessig);
    expect(e.wege).toEqual(f.wege);
  });

  it('Jeder Fall hat einen eigenen Namen und sagt, warum er dasteht', () => {
    const namen = beispiele.faelle.map((f) => f.name);
    expect(new Set(namen).size).toBe(namen.length);
    expect(beispiele.faelle.filter((f) => !f.warum.trim())).toEqual([]);
  });

  it('Raucher ist keine Angabe mehr', () => {
    expect(ANGABEN.map((a) => a.text)).not.toContain('Raucher');
  });

  it('nennt die Mailadresse aus dem Text', () => {
    expect(erkennen(text('mail')).mail).toBe('vermietung@beispiel-hausverwaltung.de');
    expect(erkennen(text('kontakt')).mail).toBeNull();
  });
});

describe('Die Nachricht', () => {
  it('PN1: ohne Inseratstext nur Name, Kontakt, Wohnung und Satz', () => {
    expect(nachrichtText(AUFTRAG)).toBe(
      [
        'Guten Tag,',
        '',
        'ich interessiere mich für die Wohnung Hauptstraße 12, 3. OG links.',
        'Wir sind ein ruhiges Paar.',
        '',
        'Eine vollständige Bewerbungsmappe schicke ich gern, sobald Sie sie brauchen.',
        'Über einen Besichtigungstermin freue ich mich.',
        '',
        'Freundliche Grüße',
        'Max Mustermann',
        '0151 23456789 · max.mustermann@example.com',
      ].join('\n'),
    );
  });

  it('ohne Wohnung, ohne Satz, mit Mappe', () => {
    const t = nachrichtText({ ...AUFTRAG, wohnung: '', satz: '', mappe: true });
    expect(t).toContain('für die angebotene Wohnung.');
    expect(t).toContain('Meine Bewerbungsmappe mit Selbstauskunft und Nachweisen hängt an.');
    expect(t).not.toContain('sobald Sie sie brauchen');
  });

  it('Ergänzungen stehen als kurze Zeilen, in fester Reihenfolge', () => {
    const t = nachrichtText({
      ...AUFTRAG,
      angaben: { einkommen: '2.643 € netto im Monat', adresse: 'Alte Straße 7, 22765 Hamburg' },
    });
    expect(t).toContain('Adresse: Alte Straße 7, 22765 Hamburg\nEinkommen: 2.643 € netto im Monat');
  });

  it('PN2: Unzulässiges steht nie in der Nachricht', () => {
    const { angaben } = erkennen(text('unzulaessig'));
    const t = nachrichtText({
      ...AUFTRAG,
      angaben: Object.fromEntries(angaben.map((a) => [a, 'x'])),
    });
    for (const wort of ['Ausweis', 'Familienstand', 'Staatsangehörigkeit'])
      expect(t).not.toContain(wort);
    expect(ANGABEN.map((a) => a.text).join()).not.toMatch(/Ausweis|Familienstand|Religion/);
  });
});

describe('Der Satz darunter', () => {
  const satz = (teil: Partial<Parameters<typeof erklaerung>[0]>) =>
    erklaerung({
      mitText: true,
      gefragt: [],
      dabei: [],
      unzulaessig: [],
      mailImInserat: false,
      unterlagenGefragt: false,
      ...teil,
    });

  it('sagt ohne Inseratstext nichts über das Inserat', () => {
    expect(satz({ mitText: false })).toBe('Name und Telefon genügen für die erste Nachricht.');
    expect(satz({})).toContain('Mehr verlangt das Inserat nicht.');
  });

  it('PN3: Jede Ergänzung ist begründet, ab dem Mietwunsch mit „mehr als nötig“', () => {
    const nur: AngabeId[] = ['adresse'];
    expect(satz({ gefragt: nur, dabei: nur })).toBe('Mit Adresse, weil das Inserat danach fragt.');
    const t = satz({ gefragt: ['adresse', 'einkommen'], dabei: ['adresse', 'einkommen'] });
    expect(t).toContain('Mit Adresse und Einkommen, weil das Inserat danach fragt.');
    expect(t).toContain('du gibst hier mehr als nötig');
  });

  it('sagt, wonach gefragt wird, das nicht in der Nachricht steht', () => {
    expect(satz({ gefragt: ['haustiere', 'einkommen'], dabei: ['einkommen'] })).toContain(
      'Nach Haustieren fragt das Inserat auch',
    );
  });

  it('Steckt in einem Punkt schon ein „und“, verbindet „sowie“: nie zwei „und“ hintereinander', () => {
    const zwei: AngabeId[] = ['einzug', 'beruf'];
    expect(satz({ gefragt: zwei })).toContain(
      'Nach Einzugstermin sowie Beruf und Arbeitgeber fragt das Inserat auch',
    );
    const drei: AngabeId[] = ['einzug', 'beruf', 'einkommen'];
    expect(satz({ gefragt: drei, dabei: drei })).toContain(
      'Mit Einzugstermin, Beruf und Arbeitgeber sowie Einkommen, weil',
    );
    expect(satz({ gefragt: ['beruf'], dabei: ['beruf'] })).toContain(
      'Mit Beruf und Arbeitgeber, weil',
    );
    const ohne: AngabeId[] = ['adresse', 'einzug', 'einkommen'];
    expect(satz({ gefragt: ohne, dabei: ohne })).toContain(
      'Mit Adresse, Einzugstermin und Einkommen, weil',
    );
  });

  it('Im Satz stehen die Angaben so, wie man sie sagt, nicht wie die Zeile heißt', () => {
    const beide: AngabeId[] = ['einzug', 'personen'];
    expect(satz({ gefragt: beide, dabei: beide })).toContain(
      'Mit Einzugstermin und Personenzahl, weil das Inserat danach fragt.',
    );
  });

  it('Unzulässiges als Einschätzung der Behörden, nie als „darf nicht“', () => {
    const t = satz({ unzulaessig: ['Ausweiskopie', 'Religion'] });
    expect(t).toContain('Nicht dabei: Ausweiskopie und Religion.');
    expect(t).toContain('halten die Datenschutzbehörden für unzulässig');
    expect(t).not.toMatch(/dürfen|darf/);
  });

  it('Mailadresse und Unterlagen', () => {
    expect(satz({ mailImInserat: true })).toContain('Das Inserat nennt eine Mailadresse');
    expect(satz({ unterlagenGefragt: true })).toContain('fragt nach Unterlagen');
  });
});

describe('Werte aus den Angaben', () => {
  const person = {
    kontakt: { telefon: '', email: '' },
    beruf: 'Elektroniker',
    arbeitgeber: 'Musterfirma GmbH',
    nettoeinkommen: 2643,
    lebenssituation: 'angestellt' as const,
  };
  const hh = { haustiere: 'ja' as const, haustiereText: 'eine Katze', ort: '' };

  it('kommt aus der Selbstauskunft und dem Haushalt', () => {
    expect(angabenWerte(person, { erwachsene: 2, kinder: 1 }, hh)).toEqual({
      personen: '2 Erwachsene, 1 Kind',
      beruf: 'Elektroniker bei Musterfirma GmbH',
      einkommen: '2.643 € netto im Monat',
      haustiere: 'eine Katze',
    });
  });

  it('Was fehlt, wird nicht erfunden; Miete vom Amt nennt keinen Betrag', () => {
    const w = angabenWerte(
      { ...person, beruf: '', arbeitgeber: '', lebenssituation: 'leistungsbezug' },
      { erwachsene: 1, kinder: 0 },
      { haustiere: null, haustiereText: '', ort: '' },
    );
    expect(w).toEqual({ personen: '1 Erwachsener' });
  });

  it('Einzug kommt von der Bewerbung, ohne doppeltes „ab“', () => {
    const wer = { erwachsene: 1, kinder: 0 };
    expect(angabenWerte(person, wer, hh, ' ab 1. Januar 2027 ').einzug).toBe('1. Januar 2027');
    expect(angabenWerte(person, wer, hh, 'Ab sofort').einzug).toBe('sofort');
    expect(angabenWerte(person, wer, hh, '  ').einzug).toBeUndefined();
    expect(angabenWerte(person, wer, hh).einzug).toBeUndefined();
    expect(nachrichtText({ ...AUFTRAG, angaben: { einzug: '1. Januar 2027' } })).toContain(
      'Einzug ab: 1. Januar 2027',
    );
  });

  it('Anschrift nur, wenn sie eingetragen ist', () => {
    const w = angabenWerte(
      { ...person, kontakt: { telefon: '', email: '', anschrift: ' Alte Straße 7 ' } },
      { erwachsene: 1, kinder: 0 },
      hh,
    );
    expect(w.adresse).toBe('Alte Straße 7');
  });
});

describe('Mail', () => {
  it('Empfänger aus dem Inserat, Text sicher kodiert', () => {
    const l = mailLink('a@b.de', 'Wohnung & mehr', 'Zeile 1\nZeile 2');
    expect(l).toBe('mailto:a@b.de?subject=Wohnung%20%26%20mehr&body=Zeile%201%0AZeile%202');
    expect(mailLink(null, 'x', 'y')).toBe('mailto:?subject=x&body=y');
  });
});

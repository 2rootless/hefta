import { describe, expect, it } from 'vitest';
import beispiele from '../../data/nachricht-faelle.de.json';
import { ANGABEN, angabenWerte, blankeUmbrueche, erkennen, mailLink } from './nachricht';

const text = (name: string) => beispiele.faelle.find((f) => f.name === name)!.text;

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
    expect(erkennen(text('mail')).mail).toBe('vermietung@hausverwaltung.example.com');
    expect(erkennen(text('kontakt')).mail).toBeNull();
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
  });

  it('Anschrift nur, wenn sie eingetragen ist', () => {
    const w = angabenWerte(
      { ...person, kontakt: { telefon: '', email: '', anschrift: ' Musterweg 7 ' } },
      { erwachsene: 1, kinder: 0 },
      hh,
    );
    expect(w.adresse).toBe('Musterweg 7');
  });
});

describe('Mail', () => {
  it('Empfänger aus dem Inserat, Text sicher kodiert', () => {
    const l = mailLink('a@example.com', 'Wohnung & mehr', 'Zeile 1\nZeile 2');
    expect(l).toBe(
      'mailto:a@example.com?subject=Wohnung%20%26%20mehr&body=Zeile%201%0D%0AZeile%202',
    );
    expect(mailLink(null, 'x', 'y')).toBe('mailto:?subject=x&body=y');
  });
});

// W14 (PC64, Punkt 2): Absätze bleiben in der Mail aus Hefta erhalten, auch in Gmail.
describe('wunsch-W14: Absätze in der Mail', () => {
  const brief = 'Sehr geehrte Damen und Herren,\n\nich bewerbe mich.\nViele Grüße\n\nMax';

  it('Mail-Link: jeder Umbruch als %0D%0A, Absätze als zwei', () => {
    const l = mailLink(null, 'Bewerbung', brief);
    expect(blankeUmbrueche(l)).toBe(0);
    expect(l).toContain('Herren%2C%0D%0A%0D%0Aich');
    expect(decodeURIComponent(l.split('&body=')[1]!)).toBe(brief.replace(/\n/g, '\r\n'));
    // Auch was schon CRLF oder nur CR hat, wird nicht doppelt.
    expect(blankeUmbrueche(mailLink(null, 'x', 'a\r\nb\rc'))).toBe(0);
    expect(mailLink(null, 'x', 'a\r\nb')).toContain('a%0D%0Ab');
  });

  it('Gegenprobe: ein Link mit blankem %0A wird erkannt', () => {
    const falsch = `mailto:?subject=x&body=${encodeURIComponent(brief)}`;
    expect(blankeUmbrueche(falsch)).toBe(5);
  });
});

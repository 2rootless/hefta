import { describe, expect, it } from 'vitest';
import {
  anrede,
  anschreibenText,
  bewerbungsText,
  einzugText,
  inDerStrasse,
  loeschbitteText,
  nachfassText,
  wegVorschlag,
  werZiehtEin,
} from './bewerben';

const HEUTE = new Date(2026, 10, 12);

describe('Bewerben in einer Minute (Zeile 8, B23)', () => {
  it('schlägt den Weg aus dem Inserat vor', () => {
    expect(
      wegVorschlag({ inseratText: 'Bewerbung an hansen@example.org', angaben: undefined }),
    ).toBe('mail');
    expect(wegVorschlag({ inseratText: '', angaben: { portal: 'ImmoScout24' } })).toBe('portal');
    expect(wegVorschlag({ inseratText: null, angaben: undefined })).toBe('mail');
  });

  it('PC8 A8: wählt die Website nie vor, auch wenn das Inserat auf ein Formular verweist', () => {
    const text = 'Bitte bewerben Sie sich über das Kontaktformular auf unserer Website.';
    expect(wegVorschlag({ inseratText: text, angaben: { portal: 'ImmoScout24' } })).toBe('portal');
    expect(wegVorschlag({ inseratText: text, angaben: undefined })).toBe('mail');
  });

  it('nimmt die Anrede aus dem Namen, sonst neutral', () => {
    expect(anrede('Frau Hansen')).toBe('Sehr geehrte Frau Hansen,');
    expect(anrede('Herr Dr. Okafor')).toBe('Sehr geehrter Herr Dr. Okafor,');
    expect(anrede('Hausverwaltung Nord GmbH')).toBe('Sehr geehrte Damen und Herren,');
    expect(anrede(null)).toBe('Sehr geehrte Damen und Herren,');
  });

  it('setzt die Präposition nach dem Straßennamen, im Zweifel keine', () => {
    expect(inDerStrasse('Lindenallee 3')).toBe('in der Lindenallee 3');
    expect(inDerStrasse('Eppendorfer Weg 211')).toBe('im Eppendorfer Weg 211');
    expect(inDerStrasse('Methfesselstraße 12')).toBe('in der Methfesselstraße 12');
    expect(inDerStrasse('Am Markt 4')).toBe('Am Markt 4');
    expect(inDerStrasse('Grindelhof 12a')).toBe('im Grindelhof 12a');
    expect(inDerStrasse('Lange Reihe 5')).toBe('');
    expect(inDerStrasse('Große Bergstraße 2')).toBe('');
    expect(inDerStrasse('Hoheluftchaussee 2')).toBe('in der Hoheluftchaussee 2');
    expect(inDerStrasse('Jungfernstieg 1')).toBe('im Jungfernstieg 1');
    expect(inDerStrasse('Planten un Blomen 1')).toBe('');
  });

  it('schreibt das Anschreiben wie B23, allein und zu mehreren', () => {
    expect(
      anschreibenText({
        wir: false,
        anbieter: 'Frau Hansen',
        strasse: 'Lindenallee 3',
        einzug: '2027-01-01',
        heute: HEUTE,
      }),
    ).toEqual({
      anrede: 'Sehr geehrte Frau Hansen,',
      text: 'ich möchte mich um die Wohnung in der Lindenallee 3 bewerben. Ich kann zum 1. Januar 2027 einziehen. Meine Mappe mit allen Unterlagen, die Sie verlangen, liegt bei.',
    });
    const wir = anschreibenText({
      wir: true,
      anbieter: null,
      strasse: 'Planten un Blomen 1',
      einzug: '',
      heute: HEUTE,
    });
    expect(wir.text).toBe(
      'wir möchten uns um die Wohnung Planten un Blomen 1 bewerben. Unsere Mappe mit allen Unterlagen, die Sie verlangen, liegt bei.',
    );
    expect(einzugText('2026-12-01', HEUTE)).toBe('1. Dezember');
  });

  it('sagt kurz, wer einzieht (E25)', () => {
    expect(werZiehtEin({ vertrag: 1, kinder: 0, weitere: 0, buergen: 0 })).toBe(
      'Eine Person im Mietvertrag.',
    );
    expect(werZiehtEin({ vertrag: 2, kinder: 1, weitere: 0, buergen: 1 })).toBe(
      'Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.',
    );
    expect(werZiehtEin({ vertrag: 2, kinder: 2, weitere: 1, buergen: 2 })).toBe(
      'Zwei im Mietvertrag, eine weitere Person zieht mit ein, zwei Kinder ziehen mit ein. Zwei Personen bürgen.',
    );
  });

  it('setzt den ganzen Text zusammen', () => {
    expect(
      bewerbungsText({
        anrede: 'Sehr geehrte Frau Hansen,',
        text: 'ich möchte mich bewerben.',
        angaben: [{ label: 'Einzug', wert: '1. Januar 2027' }],
        name: 'Lea Berg',
        telefon: '040 123',
        mail: '',
      }),
    ).toBe(
      'Sehr geehrte Frau Hansen,\n\nich möchte mich bewerben.\n\nEinzug: 1. Januar 2027\n\nMit freundlichen Grüßen\nLea Berg\n040 123',
    );
  });
});

describe('Löschbitte und Nachfassen (B18)', () => {
  const auftrag = {
    wir: true,
    anbieter: 'Herr Kraus',
    strasse: 'Bismarckstraße 56',
    beworbenAm: '2026-10-15T09:00:00.000Z',
    namen: ['Max Mustermann', 'Lea Mustermann'],
    heute: HEUTE,
  };

  it('Löschbitte mit „wir“, Datum, Straße und Gruß', () => {
    expect(loeschbitteText(auftrag)).toEqual({
      betreff: 'Bitte um Löschung unserer Unterlagen',
      text:
        'Sehr geehrter Herr Kraus,\n\nwir haben uns am 15. Oktober um die Wohnung in der Bismarckstraße 56 beworben. ' +
        'Da wir sie nicht mehr suchen, bitten wir Sie, unsere Unterlagen zu löschen, auch Ausdrucke und Anhänge.' +
        '\n\nFreundliche Grüße\nMax Mustermann und Lea Mustermann',
    });
  });

  it('Löschbitte allein, ohne Datum, ohne Anbieter, ohne Namen', () => {
    const { betreff, text } = loeschbitteText({
      ...auftrag,
      wir: false,
      anbieter: null,
      beworbenAm: null,
      namen: [],
    });
    expect(betreff).toBe('Bitte um Löschung meiner Unterlagen');
    expect(text).toBe(
      'Sehr geehrte Damen und Herren,\n\nich habe mich um die Wohnung in der Bismarckstraße 56 beworben. ' +
        'Da ich sie nicht mehr suche, bitte ich Sie, meine Unterlagen zu löschen, auch Ausdrucke und Anhänge.' +
        '\n\nFreundliche Grüße',
    );
  });

  it('Nachfassen beginnt nach der Anrede klein', () => {
    expect(nachfassText(auftrag)).toEqual({
      betreff: 'Nachfrage zur Wohnung Bismarckstraße 56',
      text:
        'Sehr geehrter Herr Kraus,\n\nam 15. Oktober haben wir uns um die Wohnung in der Bismarckstraße 56 beworben. ' +
        'Ist sie noch zu haben? Wir würden sie uns gern ansehen.\n\nFreundliche Grüße\nMax Mustermann und Lea Mustermann',
    });
    expect(nachfassText({ ...auftrag, wir: false, beworbenAm: null, strasse: '' }).text).toContain(
      'ich habe mich um Ihre Wohnung beworben. Ist sie noch zu haben? Ich würde sie mir gern ansehen.',
    );
  });
});

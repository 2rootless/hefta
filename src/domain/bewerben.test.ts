import { describe, expect, it } from 'vitest';
import {
  anrede,
  anschreibenText,
  bewerbungsText,
  einzugText,
  fuerDieStrasse,
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

  it('DP50 Z2: „für den Lindenring 3“, „für die Beispielstraße 1“, im Zweifel „für die Wohnung …“', () => {
    expect(fuerDieStrasse('Lindenring 3')).toBe('für den Lindenring 3');
    expect(fuerDieStrasse('Beispielstraße 1')).toBe('für die Beispielstraße 1');
    expect(fuerDieStrasse('Lange Reihe 5')).toBe('für die Wohnung Lange Reihe 5');
    expect(fuerDieStrasse('Am Markt 4')).toBe('für die Wohnung Am Markt 4');
    expect(fuerDieStrasse('')).toBe('');
  });

  it('setzt die Präposition nach dem Straßennamen, im Zweifel keine', () => {
    expect(inDerStrasse('Lindenring 3')).toBe('im Lindenring 3');
    expect(inDerStrasse('Lindenring 8')).toBe('im Lindenring 8');
    expect(inDerStrasse('Beispielstr. 1')).toBe('in der Beispielstr. 1');
    expect(inDerStrasse('Am Markt 4')).toBe('Am Markt 4');
    expect(inDerStrasse('Grindelhof 12a')).toBe('im Grindelhof 12a');
    expect(inDerStrasse('Lange Reihe 5')).toBe('');
    expect(inDerStrasse('Große Beispielstraße 1')).toBe('');
    expect(inDerStrasse('Beispielstraße 1')).toBe('in der Beispielstraße 1');
    expect(inDerStrasse('Musterweg 7')).toBe('im Musterweg 7');
    expect(inDerStrasse('Planten un Blomen 1')).toBe('');
  });

  it('PC120 (§8, 5): „am“ an Platz, Markt, Kai, Ufer, Hang, Damm und Verwandten; „im“ bleibt bei Weg und Ring', () => {
    expect(inDerStrasse('Musterplatz 1')).toBe('am Musterplatz 1');
    expect(inDerStrasse('Am Musterplatz 1')).toBe('Am Musterplatz 1');
    expect(inDerStrasse('Mustermarkt 2, 00100 Musterstadt')).toBe(
      'am Mustermarkt 2, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterkai 3, 00100 Musterstadt')).toBe(
      'am Musterkai 3, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterufer 4, 00100 Musterstadt')).toBe(
      'am Musterufer 4, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterhang 5, 00100 Musterstadt')).toBe(
      'am Musterhang 5, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterdamm 6, 00100 Musterstadt')).toBe(
      'am Musterdamm 6, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterwall 7, 00100 Musterstadt')).toBe(
      'am Musterwall 7, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterdeich 8, 00100 Musterstadt')).toBe(
      'am Musterdeich 8, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterberg 9, 00100 Musterstadt')).toBe(
      'am Musterberg 9, 00100 Musterstadt',
    );
    expect(inDerStrasse('Mustergraben 10, 00100 Musterstadt')).toBe(
      'am Mustergraben 10, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterstieg 11, 00100 Musterstadt')).toBe(
      'am Musterstieg 11, 00100 Musterstadt',
    );
    expect(inDerStrasse('Mustersteig 12, 00100 Musterstadt')).toBe(
      'am Mustersteig 12, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterbrücke 13, 00100 Musterstadt')).toBe(
      'an der Musterbrücke 13, 00100 Musterstadt',
    );
    expect(inDerStrasse('Musterweg 7–9')).toBe('im Musterweg 7–9');
    expect(inDerStrasse('Lindenring 3')).toBe('im Lindenring 3');
    expect(inDerStrasse('Musterhof 2, 00100 Musterstadt')).toBe(
      'im Musterhof 2, 00100 Musterstadt',
    );
    // Erfundene Straßen mit Postleitzahl 00100 (W7, Fassung 25).
    // Zwei Wörter: das Grundwort entscheidet, ein Adjektiv auf „-er“ beugt sich nicht.
    expect(inDerStrasse('Musterstädter Ufer 4, 00100 Musterstadt')).toBe(
      'am Musterstädter Ufer 4, 00100 Musterstadt',
    );
    // Gegenprobe: das alte „im“ vor einem Platz wäre falsch.
    expect(inDerStrasse('Musterplatz 1')).not.toBe('im Musterplatz 1');
  });

  it('schreibt das Anschreiben wie B23, allein und zu mehreren', () => {
    expect(
      anschreibenText({
        wir: false,
        anbieter: 'Frau Hansen',
        strasse: 'Lindenring 3',
        einzug: '2027-01-01',
        heute: HEUTE,
        weg: 'mail',
      }),
    ).toEqual({
      anrede: 'Sehr geehrte Frau Hansen,',
      text: 'ich möchte mich um die Wohnung im Lindenring 3 bewerben. Ich kann zum 1. Januar 2027 einziehen. Meine Mappe mit den üblichen Unterlagen liegt bei.',
      // W37: Ohne Kennung des Hefts die Fassung von Release 2.0: kein Schluss, „Mit freundlichen Grüßen“.
      schluss: '',
      gruss: 'Mit freundlichen Grüßen',
    });
    const wir = anschreibenText({
      wir: true,
      anbieter: null,
      strasse: 'Planten un Blomen 1',
      einzug: '',
      heute: HEUTE,
      weg: 'mail',
    });
    expect(wir.text).toBe(
      'wir möchten uns um die Wohnung Planten un Blomen 1 bewerben. Unsere Mappe mit den üblichen Unterlagen liegt bei.',
    );
    expect(einzugText('2026-12-01', HEUTE)).toBe('1. Dezember');
  });

  it('PC81 A1 (QA1): Über Portal und Website liegt nichts bei; nur per Mail „liegt bei“', () => {
    const basis = { anbieter: null, strasse: 'Lindenring 3', einzug: '', heute: HEUTE };
    for (const weg of ['portal', 'website'] as const) {
      const wir = anschreibenText({ ...basis, wir: true, weg });
      expect(wir.text).toContain(
        'Unsere Mappe mit den üblichen Unterlagen schicken wir Ihnen gern, sobald Sie uns eine Mailadresse nennen.',
      );
      // Gegenprobe: kein „liegt bei“, kein „die Sie verlangen“.
      expect(wir.text).not.toMatch(/liegt bei|die Sie verlangen/);
      const ich = anschreibenText({ ...basis, wir: false, weg });
      expect(ich.text).toContain('schicke ich Ihnen gern, sobald Sie mir eine Mailadresse nennen.');
    }
    const mail = anschreibenText({ ...basis, wir: true, weg: 'mail' });
    expect(mail.text).toContain('Unsere Mappe mit den üblichen Unterlagen liegt bei.');
    expect(mail.text).not.toContain('die Sie verlangen');
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
      'Sehr geehrte Frau Hansen,\n\nich möchte mich bewerben.\n\nEinzug: 1. Januar 2027.\n\nMit freundlichen Grüßen\nLea Berg\n040 123',
    );
  });
});

describe('PC92 K3: Angabe-Zeilen enden mit Punkt (DP66, E192)', () => {
  const angaben = [
    { label: 'Einzug ab', wert: '1. Januar 2027' },
    { label: 'Personen', wert: '2 Erwachsene, 1 Kind' },
    { label: 'Einkommen', wert: '3.200 € netto im Monat' },
    { label: 'Haustiere', wert: 'keine' },
    { label: 'Haustiere', wert: 'Eine Katze.' },
  ];
  /** Die Zeilen mit „Bezeichnung: Wert“ zwischen Anschreiben und Gruß. */
  const zeilen = (text: string) => text.split('\n').filter((z) => /^[A-ZÄÖÜ][a-zäöüß ]+: /.test(z));
  const mitPunkt = (z: string) => /[^.][.]$/.test(z);

  it('jede Zeile endet mit genau einem Punkt', () => {
    const text = bewerbungsText({
      anrede: 'Hallo,',
      text: 'Text.',
      angaben,
      name: 'Lea',
      telefon: '',
      mail: '',
    });
    expect(zeilen(text)).toEqual([
      'Einzug ab: 1. Januar 2027.',
      'Personen: 2 Erwachsene, 1 Kind.',
      'Einkommen: 3.200 € netto im Monat.',
      'Haustiere: keine.',
      'Haustiere: Eine Katze.',
    ]);
    expect(zeilen(text).every(mitPunkt)).toBe(true);
  });

  it('Gegenprobe: die Fassung ohne Punkt fällt auf', () => {
    const alt = angaben.map((a) => `${a.label}: ${a.wert}`).join('\n');
    expect(zeilen(alt).every(mitPunkt)).toBe(false);
  });
});

describe('Löschbitte und Nachfassen (B18)', () => {
  const auftrag = {
    wir: true,
    anbieter: 'Herr Kraus',
    strasse: 'Beispielstraße 1',
    beworbenAm: '2026-10-15T09:00:00.000Z',
    namen: ['Max Mustermann', 'Lea Mustermann'],
    heute: HEUTE,
  };

  it('Löschbitte mit „wir“, Datum, Straße und Gruß', () => {
    expect(loeschbitteText(auftrag)).toEqual({
      betreff: 'Bitte um Löschung unserer Unterlagen',
      text:
        'Sehr geehrter Herr Kraus,\n\nwir haben uns am 15. Oktober um die Wohnung in der Beispielstraße 1 beworben. ' +
        'Unsere Bewerbung ist erledigt. Bitte löschen Sie unsere Unterlagen, auch Ausdrucke und Anhänge.' +
        '\n\nFreundliche Grüße\nMax Mustermann und Lea Mustermann',
    });
  });

  it('PC92 K4, Gegenprobe: Der alte Grund „nicht mehr suchen“ steht nicht mehr da', () => {
    for (const wir of [true, false]) {
      const { text } = loeschbitteText({ ...auftrag, wir });
      expect(text).not.toMatch(/nicht mehr such|Da (wir|ich) sie/);
      expect(text).toMatch(/beworben\. (Unsere|Meine) Bewerbung ist erledigt\. Bitte löschen Sie/);
    }
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
      'Sehr geehrte Damen und Herren,\n\nich habe mich um die Wohnung in der Beispielstraße 1 beworben. ' +
        'Meine Bewerbung ist erledigt. Bitte löschen Sie meine Unterlagen, auch Ausdrucke und Anhänge.' +
        '\n\nFreundliche Grüße',
    );
  });

  it('Nachfassen beginnt nach der Anrede klein', () => {
    expect(nachfassText(auftrag)).toEqual({
      betreff: 'Nachfrage zur Wohnung Beispielstraße 1',
      text:
        'Sehr geehrter Herr Kraus,\n\nam 15. Oktober haben wir uns um die Wohnung in der Beispielstraße 1 beworben. ' +
        'Ist sie noch zu haben? Wir würden sie uns gern ansehen.\n\nFreundliche Grüße\nMax Mustermann und Lea Mustermann',
    });
    expect(nachfassText({ ...auftrag, wir: false, beworbenAm: null, strasse: '' }).text).toContain(
      'ich habe mich um Ihre Wohnung beworben. Ist sie noch zu haben? Ich würde sie mir gern ansehen.',
    );
  });
});

describe('PC126 K5: Satz zur Mappe folgt der Auswahl (DP83 a, W10)', () => {
  const auftrag = {
    wir: false,
    anbieter: 'Frau Hansen',
    strasse: 'Musterweg 7',
    einzug: '',
    heute: new Date(2026, 10, 19),
  };
  it('mit eigener Auswahl ohne „mit den üblichen Unterlagen“, per Mail und über ein Portal', () => {
    const mail = anschreibenText({ ...auftrag, weg: 'mail', eigeneAuswahl: true }).text;
    expect(mail).toContain('Meine Mappe liegt bei.');
    expect(mail).not.toContain('üblichen Unterlagen');
    const portal = anschreibenText({
      ...auftrag,
      wir: true,
      weg: 'portal',
      eigeneAuswahl: true,
    }).text;
    expect(portal).toContain(
      'Unsere Mappe schicken wir Ihnen gern, sobald Sie uns eine Mailadresse nennen.',
    );
    // Gegenprobe: ohne eigene Auswahl bleibt der Satz.
    expect(anschreibenText({ ...auftrag, weg: 'mail' }).text).toContain(
      'Meine Mappe mit den üblichen Unterlagen liegt bei.',
    );
  });
});

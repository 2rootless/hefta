import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { seitenVorbelegen } from './aufteilen';
import { monateAusDateiname } from './dateiname';
import { monatFinden, type TextStueck } from './datumErkennen';
import { bewerten, serienFenster, type BewertungsTyp } from './fristen';
import { rufnameFolgt, type DateiVersion } from './modell';
import { seitenVorauswahl, varianteErkennen, woerterAus } from './pruefhinweise';
import { emailSiehtGutAus, telefonSiehtGutAus } from './selbstauskunft';

// Rückmeldungen aus dem ersten Test am iPhone (4. November 2026).

describe('Rufname', () => {
  it('folgt dem Vornamen, solange er nicht eigens gewählt wurde', () => {
    expect(rufnameFolgt('Max', 'Jonas', 'Max')).toBe('Jonas');
    expect(rufnameFolgt('Max', 'Jonas', '')).toBe('Jonas');
    expect(rufnameFolgt('Anna Maria', 'Eva Maria', 'Anna')).toBe('Eva');
  });

  it('bleibt, wenn er eigens gewählt wurde', () => {
    expect(rufnameFolgt('Maximilian', 'Maximilian Karl', 'Maxi')).toBe('Maxi');
  });
});

describe('Serie: welcher Monat dran ist', () => {
  const typ: BewertungsTyp = {
    etikett: 'ueblich',
    serie: { anzahl: 3 },
    fristen: { hinweis: 'naechster_monat_faellig', warnungTage: 90 },
  };
  const monate = (...liste: string[]) =>
    liste.map(
      (abrechnungsmonat) =>
        ({ abrechnungsmonat, createdAt: '2026-10-01T10:00:00.000Z' }) as unknown as DateiVersion,
    );
  const k = (tag: string) => ({
    heute: new Date(`${tag}T10:00:00`),
    abrechnungMeist: null,
    stummBis: null,
  });

  it('am 4. November fehlt der August, nicht der November', () => {
    const b = bewerten(typ, monate('2026-10', '2026-09'), k('2026-11-04'));
    expect(b.status).toBe('fehlt');
    expect(b.naechsterMonat).toBe('2026-08');
    expect(b.fehlend).toEqual(['2026-08']);
  });

  it('eine Lücke in der Mitte zählt: der neueste fehlende zuerst', () => {
    const b = bewerten(typ, monate('2026-10', '2026-08'), k('2026-11-04'));
    expect(b.fehlend).toEqual(['2026-09']);
    expect(b.naechsterMonat).toBe('2026-09');
  });

  it('ist nur ein alter Monat da, ist der neueste erwartete dran', () => {
    // Am 4. November ist die Oktober-Abrechnung meist noch nicht da (Standard: Ende des Folgemonats).
    const b = bewerten(typ, monate('2026-08'), k('2026-11-04'));
    expect(b.fehlend).toEqual(['2026-09', '2026-07']);
    expect(b.naechsterMonat).toBe('2026-09');
  });

  it('alles da: Der neue Monat kommt erst, wenn er fällig ist', () => {
    expect(bewerten(typ, monate('2026-10', '2026-09', '2026-08'), k('2026-11-04')).status).toBe(
      'da',
    );
    const spaeter = bewerten(typ, monate('2026-10', '2026-09', '2026-08'), k('2026-12-29'));
    expect(spaeter.status).toBe('bald');
    expect(spaeter.naechsterMonat).toBe('2026-11');
  });

  it('das Fenster reicht bis zum erwarteten Monat, oder weiter, wenn schon ein neuerer da ist', () => {
    expect(serienFenster('2026-10', 3, new Date(2026, 10, 4), null)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(serienFenster('2026-11', 3, new Date(2026, 10, 4), null)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
  });
});

describe('Format von Kontaktdaten: nur ein Hinweis', () => {
  it('E-Mail', () => {
    for (const gut of ['max@beispiel.de', ' lea.m+test@sub.beispiel.org ']) {
      expect(emailSiehtGutAus(gut)).toBe(true);
    }
    for (const schlecht of ['max', 'max@', 'max@beispiel', '@beispiel.de', 'ma x@beispiel.de']) {
      expect(emailSiehtGutAus(schlecht)).toBe(false);
    }
  });

  it('Telefon', () => {
    for (const gut of ['040 123456', '+49 (0)40 / 123-456', '0171.1234567']) {
      expect(telefonSiehtGutAus(gut)).toBe(true);
    }
    for (const schlecht of ['abc', '12345', '040 12x456', '1234567890123456']) {
      expect(telefonSiehtGutAus(schlecht)).toBe(false);
    }
  });
});

describe('Was Hefta aus der Datei vorwählt', () => {
  const seite = (text: string) => ({ woerter: woerterAus(text) });
  const WOERTER = ['zertifikat', 'bonitätszertifikat', 'prüfcode'];

  it('nur die Seite mit dem Zertifikat', () => {
    expect(
      seitenVorauswahl(
        [seite('SCHUFA Zertifikat Prüfcode'), seite('Ihre Daten im Einzelnen')],
        WOERTER,
      ),
    ).toEqual([0]);
  });

  it('steht ein Wort auf allen Seiten, entscheidet das nächste', () => {
    expect(
      seitenVorauswahl(
        [seite('Zertifikat Prüfcode'), seite('zum Zertifikat: Erläuterung')],
        WOERTER,
      ),
    ).toEqual([0]);
  });

  it('lässt sich nichts unterscheiden, bleiben alle Seiten', () => {
    expect(seitenVorauswahl([seite('Zertifikat'), seite('Zertifikat')], WOERTER)).toBeNull();
    expect(seitenVorauswahl([seite('nichts'), seite('auch nichts')], WOERTER)).toBeNull();
    expect(seitenVorauswahl([seite('Zertifikat')], WOERTER)).toBeNull();
  });

  const REGEL = {
    beide: 'beides',
    wenn: { bafoeg: ['bafög', 'ausbildungsförderung'], unterhalt: ['unterhaltsnachweis'] },
  };

  it('Variante: eine, beide oder keine', () => {
    expect(varianteErkennen([seite('BAföG Bescheid')], REGEL)).toBe('bafoeg');
    expect(varianteErkennen([seite('Unterhaltsnachweis der Eltern')], REGEL)).toBe('unterhalt');
    expect(varianteErkennen([seite('BAföG'), seite('Unterhaltsnachweis')], REGEL)).toBe('beides');
    expect(varianteErkennen([seite('Stipendium')], REGEL)).toBeNull();
    expect(varianteErkennen([seite('BAföG')], undefined)).toBeNull();
  });
});

describe('Abrechnungsmonat finden', () => {
  const HEUTE = new Date(2026, 10, 4);
  const seite = (...zeilen: string[]): TextStueck[] =>
    zeilen.map((text, i) => ({ text, x: 0.1, y: 0.1 + i * 0.05, breite: 0.5, hoehe: 0.02 }));

  it('abgekürzt und mit Zusatz: „Aug“ wird wie „August“ gefunden', () => {
    for (const zeile of [
      'Aug 26',
      'Aug. 26',
      'Aug-26',
      'Aug/26',
      'Aug.26',
      'Aug 2026',
      'Aug-2026',
      'Aug/2026',
      'Aug.2026',
      "Aug '26",
    ])
      expect(monatFinden(seite('Max Mustermann', zeile), HEUTE), zeile).toBe('2026-08');
    expect(monatFinden(seite('Aug 25'), HEUTE)).toBe('2025-08');
    expect(monatFinden(seite('Gehalt Aug + Urlaubsgeld'), HEUTE)).toBe('2026-08');
    expect(monatFinden(seite('Gehalt Aug 25'), HEUTE)).toBe('2025-08');
    // Allein auf der Seite, ohne jedes passende Wort.
    expect(monatFinden(seite('Max Mustermann', 'Aug (Nachzahlung)'), HEUTE)).toBe('2026-08');
    expect(monatFinden(seite('Aug Zusatz'), HEUTE)).toBe('2026-08');
    expect(monatFinden(seite('Musterfirma GmbH', 'Sept.', 'Netto 2.400,00'), HEUTE)).toBe(
      '2026-09',
    );
    // Liegt der Monat noch vor uns, ist er aus dem letzten Jahr.
    expect(monatFinden(seite('Dez (Nachzahlung)'), HEUTE)).toBe('2025-12');
  });

  it('ein Monat allein: nicht bei Namen, Tagen, zwei Monaten oder neben „Auszahlung“', () => {
    expect(monatFinden(seite('Herr Jan Meier'), HEUTE)).toBeNull();
    expect(monatFinden(seite('JAN MEIER'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Anna Mai, Musterweg 3'), HEUTE)).toBeNull();
    expect(monatFinden(seite('August Müller'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Haug 26'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Martin Maier, Musterstraße 12'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Hamburg, den 3. September'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Aug', 'Sep'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Auszahlung Aug'), HEUTE)).toBeNull();
    // „Mai 12“ ist nicht das Jahr 2012. Ohne passendes Wort bleibt der Monat allein stehen.
    expect(monatFinden(seite('Mai 12'), HEUTE)).toBe('2026-05');
    expect(monatFinden(seite('Gehalt Mai 12 Tage'), HEUTE)).toBe('2026-05');
  });

  it('für den Prüfhinweis reicht ein Monat allein nicht', () => {
    expect(monatFinden(seite('Aug (Nachzahlung)'), HEUTE, false)).toBeNull();
    expect(monatFinden(seite('Aug 26'), HEUTE, false)).toBe('2026-08');
    expect(monatFinden(seite('Gehalt Aug'), HEUTE, false)).toBe('2026-08');
  });

  it('Ziffern auch mit Bindestrich, ein volles Datum ist kein Monat', () => {
    expect(monatFinden(seite('08-2026'), HEUTE)).toBe('2026-08');
    expect(monatFinden(seite('Erstellt 01-08-2026'), HEUTE)).toBeNull();
    expect(monatFinden(seite('Kunde 01-08-2026'), HEUTE)).toBeNull();
  });

  it('der Monat neben „Auszahlung“ zählt nicht: Das Gehalt für August kommt im September', () => {
    expect(
      monatFinden(
        seite('Gehaltsabrechnung August 2026', 'Auszahlung am 01.09.2026', 'Überweisung 09/2026'),
        HEUTE,
      ),
    ).toBe('2026-08');
  });

  it('versteht Zeiträume, auch ohne Monatsnamen', () => {
    expect(monatFinden(seite('Abrechnungszeitraum 01.08.2026 - 31.08.2026'), HEUTE)).toBe(
      '2026-08',
    );
    expect(monatFinden(seite('Zeitraum 01.08. - 31.08.2026'), HEUTE)).toBe('2026-08');
    expect(monatFinden(seite('01.09.2026 bis 30.09.2026'), HEUTE)).toBe('2026-09');
    // Über mehrere Monate ist es kein Abrechnungsmonat.
    expect(monatFinden(seite('01.01.2026 - 31.08.2026'), HEUTE)).toBeNull();
  });

  it('neben einem passenden Wort reicht der Monat ohne Jahr und die kurze Schreibweise', () => {
    expect(monatFinden(seite('Abrechnungsmonat: August'), HEUTE)).toBe('2026-08');
    expect(monatFinden(seite('Abrechnungsmonat: Dezember'), HEUTE)).toBe('2025-12');
    expect(monatFinden(seite('Lohnabrechnung 08/26'), HEUTE)).toBe('2026-08');
  });

  it('ein starkes Wort schlägt ein schwaches', () => {
    expect(
      monatFinden(seite('Abrechnungsmonat 08/2026', 'Monat der Einstellung März 2026'), HEUTE),
    ).toBe('2026-08');
  });

  it('rät nicht, wenn es unentschieden bleibt', () => {
    expect(monatFinden(seite('Gehalt August 2026', 'Gehalt September 2026'), HEUTE)).toBeNull();
    expect(
      monatFinden(seite('Der August 2026 war schön', 'Der September 2026 auch'), HEUTE),
    ).toBeNull();
    expect(monatFinden(seite('Martin Maier, Musterstraße 12'), HEUTE)).toBeNull();
  });
});

describe('Monat je Seite vorbelegen', () => {
  const HEUTE = new Date(2026, 10, 4);

  it('liest Monate aus dem Dateinamen, in der Reihenfolge, auch zusammengeschrieben', () => {
    expect(monateAusDateiname('septemberaugust.pdf', HEUTE)).toEqual(['2026-09', '2026-08']);
    expect(monateAusDateiname('Gehalt August September 2025.pdf', HEUTE)).toEqual([
      '2025-08',
      '2025-09',
    ]);
    expect(monateAusDateiname('Abrechnung_Okt.pdf', HEUTE)).toEqual(['2026-10']);
    expect(monateAusDateiname('Abrechnung_Dezember.pdf', HEUTE)).toEqual(['2025-12']);
    expect(monateAusDateiname('Maier Martin.pdf', HEUTE)).toEqual([]);
  });

  it('die Seite geht vor, dann der Name, dann die Seite davor, dann die Vorgabe', () => {
    expect(seitenVorbelegen(['2026-08', '2026-09'], ['2026-09', '2026-08'], 'x')).toEqual([
      '2026-08',
      '2026-09',
    ]);
    expect(seitenVorbelegen(['2026-09', null], ['2026-09', '2026-08'], 'x')).toEqual([
      '2026-09',
      '2026-08',
    ]);
    expect(seitenVorbelegen([null, null], ['2026-09', '2026-08'], 'x')).toEqual([
      '2026-09',
      '2026-08',
    ]);
    expect(seitenVorbelegen([null, null], ['2026-09'], 'x')).toEqual(['2026-09', '2026-09']);
    expect(seitenVorbelegen(['2026-09', null], [], 'x')).toEqual(['2026-09', '2026-09']);
    expect(seitenVorbelegen([null, null], [], 'x')).toEqual(['x', 'x']);
  });
});

describe('Textgröße des iPhones', () => {
  it('die Regel mit der Systemschrift sitzt an :root, sonst schlägt sie das --px: 1px von :root nie', () => {
    const css = readFileSync('src/app/global.css', 'utf-8');
    const block = /([^{}\n]+)\{[^{}]*--px:\s*clamp/.exec(css);
    expect(block?.[1]?.trim()).toBe(':root');
  });
});

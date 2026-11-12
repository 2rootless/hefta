import { describe, expect, it } from 'vitest';
import de from '../i18n/de.json';
import type { Person } from './modell';
import {
  NIE_ABFRAGEN,
  SELBSTAUSKUNFT_FELDER,
  fehlendeAngaben,
  felderFuer,
  leereSelbstauskunft,
  einziehend,
  einziehendText,
  haushaltsAngaben,
  ortUndDatum,
  teile,
  nachZusageSatz,
  selbstauskunftBloecke,
  type FormZeile,
  vollstaendig,
  type Schritt,
  type Selbstauskunft,
} from './selbstauskunft';

const ZEIT = '2026-11-06T10:00:00.000Z';

function person(teil: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    createdAt: ZEIT,
    updatedAt: ZEIT,
    vorname: 'Max',
    nachname: 'Mustermann',
    rufname: 'Max',
    kontakt: { telefon: '', email: '' },
    lebenssituation: 'angestellt',
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: null,
    abrechnungMeist: null,
    ...teil,
  };
}

const ALLES_NEIN: Selbstauskunft = {
  ...leereSelbstauskunft(),
  haustiere: 'nein',
  insolvenz: 'nein',
  raeumungstitel: 'nein',
  mietrueckstaende: 'nein',
  ort: 'Hamburg',
};

const AUSGEFUELLT = person({
  kontakt: { telefon: '', email: 'max@example.org' },
  beruf: 'Elektriker',
  arbeitgeber: 'Stadtwerke Hamburg',
  nettoeinkommen: 2800,
  selbstauskunft: ALLES_NEIN,
});

describe('Felder der Selbstauskunft (Abnahme M4)', () => {
  it('entsprechen dem Regelkatalog; nie zulässige Felder gibt es nicht', () => {
    const ids = felderFuer('hauptmieter', 'angestellt').map((f) => f.id);
    expect(ids).toEqual([
      'name',
      'kontakt',
      'personenzahl',
      'beruf',
      'arbeitgeber',
      'nettoeinkommen',
      'haustiere',
      'insolvenz',
      'raeumungstitel',
      'mietrueckstaende',
    ]);
    for (const id of NIE_ABFRAGEN) {
      expect(SELBSTAUSKUNFT_FELDER.map((f) => f.id)).not.toContain(id);
      expect(Object.keys(leereSelbstauskunft())).not.toContain(id);
    }
  });

  it('das Formular fragt nichts aus „nieAbfragen“ (keine Texte dafür)', () => {
    const texte = JSON.stringify(de.selbstauskunft).toLowerCase();
    for (const wort of [
      'familienstand',
      'staatsangeh',
      'religion',
      'vorstraf',
      'geburtsdatum',
      'ausweis',
    ])
      expect(texte).not.toContain(wort);
  });

  it('Bürgen ziehen nicht ein: keine Personenzahl, keine Haustiere', () => {
    const ids = felderFuer('buerge', 'rente').map((f) => f.id);
    expect(ids).not.toContain('personenzahl');
    expect(ids).not.toContain('haustiere');
    expect(ids).toContain('nettoeinkommen');
  });

  it('Nettoeinkommen entfällt, wenn eine öffentliche Stelle die Miete zahlt', () => {
    expect(felderFuer('hauptmieter', 'leistungsbezug').map((f) => f.id)).not.toContain(
      'nettoeinkommen',
    );
  });

  it('WBS hängt an der Wohnung und ist hier nicht dabei', () => {
    expect(felderFuer('hauptmieter', 'angestellt').map((f) => f.id)).not.toContain('wbs_vorhanden');
  });
});

describe('Vollständigkeit', () => {
  it('leer fehlt alles Nötige, Beruf und Arbeitgeber sind freiwillig', () => {
    expect(fehlendeAngaben(person(), 'hauptmieter')).toEqual([
      'kontakt',
      'nettoeinkommen',
      'haustiere',
      'insolvenz',
      'raeumungstitel',
      'ort',
    ]);
  });

  it('Die Frage nach der Zusage fehlt nie: Sie kommt erst, wenn der Vermieter sich entschieden hat', () => {
    const ohne: Person = {
      ...AUSGEFUELLT,
      selbstauskunft: { ...AUSGEFUELLT.selbstauskunft!, mietrueckstaende: null },
    };
    expect(vollstaendig(ohne, 'hauptmieter')).toBe(true);
  });

  it('ausgefüllt ist vollständig, auch ohne Telefon (eine Kontaktangabe genügt)', () => {
    expect(vollstaendig(AUSGEFUELLT, 'hauptmieter')).toBe(true);
    const ohneArbeit: Person = { ...AUSGEFUELLT, beruf: '', arbeitgeber: '' };
    expect(vollstaendig(ohneArbeit, 'hauptmieter')).toBe(true);
  });

  it('Bürgin ohne Haustier-Antwort ist vollständig', () => {
    const petra = { ...AUSGEFUELLT, selbstauskunft: { ...ALLES_NEIN, haustiere: null } };
    expect(vollstaendig(petra, 'buerge')).toBe(true);
    expect(vollstaendig(petra, 'mitmieter')).toBe(false);
  });
});

describe('Haushalt: Haustiere und Ort einmal für alle', () => {
  it('stehen am Haushalt; ältere Daten an der Person werden gelesen', () => {
    expect(haushaltsAngaben({ haustiere: 'ja', haustiereText: 'eine Katze', ort: 'Kiel' })).toEqual(
      {
        haustiere: 'ja',
        haustiereText: 'eine Katze',
        ort: 'Kiel',
      },
    );
    expect(haushaltsAngaben({}, [AUSGEFUELLT])).toEqual({
      haustiere: 'nein',
      haustiereText: '',
      ort: 'Hamburg',
    });
    expect(haushaltsAngaben(null, [])).toEqual({ haustiere: null, haustiereText: '', ort: '' });
  });

  it('vier Teile, Bürgen ohne Haushaltsteil; offene Fragen werden gezählt', () => {
    const hh = haushaltsAngaben({ haustiere: null, ort: '' });
    const max = { ...AUSGEFUELLT, selbstauskunft: { ...ALLES_NEIN, insolvenz: null } };
    expect(teile(max, 'hauptmieter', hh)).toEqual([
      { id: 'kontakt', fertig: true, offen: 0 },
      { id: 'einkommen', fertig: true, offen: 0 },
      { id: 'fragen', fertig: false, offen: 1 },
      { id: 'haushalt', fertig: false, offen: 0 },
    ]);
    expect(teile(max, 'buerge', hh).map((t) => t.id)).toEqual(['kontakt', 'einkommen', 'fragen']);
  });

  it('Bürgen brauchen weder Haustiere noch Ort', () => {
    const hh = haushaltsAngaben({ haustiere: null, ort: '' });
    expect(vollstaendig(AUSGEFUELLT, 'buerge', hh)).toBe(true);
    expect(vollstaendig(AUSGEFUELLT, 'mitmieter', hh)).toBe(false);
  });
});

describe('Festes Formular fürs PDF', () => {
  const HH = haushaltsAngaben({ haustiere: 'ja', haustiereText: 'eine Katze', ort: 'Hamburg' });
  const WER = einziehend(2, { kinder: 1, weitereErwachsene: 0 });
  const zeilen = (p: typeof AUSGEFUELLT, schritt: 'will_wohnung' | 'zusage' | 'besichtigung') =>
    selbstauskunftBloecke(p, 'hauptmieter', WER, HH, schritt, { rolleText: 'Hauptmieter' }).flatMap(
      (b) => b.zeilen,
    );
  const zeile = (l: FormZeile[], id: string) =>
    l.find((z) => z.id === id && z.etikett !== 'Lebenslage');

  it('immer dieselben Blöcke und Zeilen, in jedem Schritt', () => {
    const ids = (s: 'will_wohnung' | 'zusage' | 'besichtigung') =>
      zeilen(AUSGEFUELLT, s).map((z) => z.id);
    expect(ids('zusage')).toEqual(ids('besichtigung'));
    expect(ids('zusage')).toEqual(ids('will_wohnung'));
    expect(
      selbstauskunftBloecke(AUSGEFUELLT, 'hauptmieter', WER, HH, 'zusage', { rolleText: 'X' }).map(
        (b) => b.id,
      ),
    ).toEqual(['person', 'haushalt', 'einkommen', 'fragen']);
  });

  it('„Ich will die Wohnung“: Mietrückstände noch nicht, sonst alles', () => {
    const l = zeilen(AUSGEFUELLT, 'will_wohnung');
    expect(zeile(l, 'mietrueckstaende')).toMatchObject({
      art: 'hinweis',
      wert: 'Wird erst bei der Zusage gefragt und dann ergänzt',
    });
    expect(zeile(l, 'personenzahl')).toMatchObject({
      art: 'text',
      wert: '3 (2 Erwachsene, 1 Kind)',
    });
    expect(zeile(l, 'nettoeinkommen')).toMatchObject({ wert: '2.800 €' });
    expect(zeile(l, 'haustiere')).toMatchObject({ wert: 'Eine Katze' });
  });

  it('„Besichtigung“: nur Name und Kontakt, der Rest sagt, wann er kommt (Musterbogen A)', () => {
    const l = zeilen(AUSGEFUELLT, 'besichtigung');
    expect(zeile(l, 'kontakt')).toMatchObject({ art: 'text' });
    for (const id of ['beruf', 'arbeitgeber', 'personenzahl', 'haustiere', 'insolvenz']) {
      expect(zeile(l, id), id).toMatchObject({
        art: 'hinweis',
        wert: 'Wird erst ab dem Mietwunsch gefragt und dann ergänzt',
      });
    }
  });

  it('Jedes Ja kann seine Erklärung haben; ohne Ja bleibt sie weg (Entwurf A3)', () => {
    const p = {
      ...AUSGEFUELLT,
      selbstauskunft: {
        ...ALLES_NEIN,
        insolvenz: 'ja' as const,
        erklaerungInsolvenz: 'Abgeschlossen im März.',
        raeumungstitel: 'ja' as const,
        erklaerungRaeumungstitel: '  ',
        stellungnahme: 'Bleibt ungesagt.',
      },
    };
    const l = zeilen(p, 'zusage');
    expect(zeile(l, 'insolvenz')).toMatchObject({
      antwort: 'ja',
      erklaerung: 'Abgeschlossen im März.',
    });
    expect(zeile(l, 'raeumungstitel')).toMatchObject({ antwort: 'ja', erklaerung: '' });
    expect(zeile(l, 'mietrueckstaende')).toMatchObject({ antwort: 'nein', erklaerung: '' });
  });

  describe('Antworten nach der Zusage (mappe-feinschliff.md, § 1)', () => {
    const zeileVon = (p: Person, schritt: Schritt, antwortenImmer?: boolean) =>
      selbstauskunftBloecke(p, 'hauptmieter', WER, HH, schritt, { rolleText: 'X', antwortenImmer })
        .flatMap((b) => b.zeilen)
        .find((z) => z.id === 'mietrueckstaende');
    const ohne: Person = {
      ...AUSGEFUELLT,
      selbstauskunft: { ...AUSGEFUELLT.selbstauskunft!, mietrueckstaende: null },
    };
    const SATZ = 'Wird erst bei der Zusage gefragt und dann ergänzt';

    it('Marktüblich und Alles drucken die Antwort, ohne Stufenwechsel', () => {
      expect(zeileVon(AUSGEFUELLT, 'will_wohnung', true)).toMatchObject({
        art: 'janein',
        antwort: 'nein',
      });
    });

    it('Ohne Antwort steht der Satz, wann sie kommt', () => {
      expect(zeileVon(ohne, 'will_wohnung', true)).toMatchObject({ art: 'hinweis', wert: SATZ });
    });

    it('„Datensparsam“ hält eine Antwort zurück, bis der gewählte Schritt erreicht ist', () => {
      expect(zeileVon(AUSGEFUELLT, 'will_wohnung')).toMatchObject({ art: 'hinweis', wert: SATZ });
      expect(zeileVon(AUSGEFUELLT, 'zusage')).toMatchObject({ art: 'janein', antwort: 'nein' });
    });
  });

  it('Mindestbetrag statt genauer Zahl', () => {
    const p = {
      ...AUSGEFUELLT,
      selbstauskunft: { ...ALLES_NEIN, einkommenArt: 'mindestens' as const },
    };
    expect(zeile(zeilen(p, 'zusage'), 'nettoeinkommen')).toMatchObject({
      wert: 'mindestens 2.800 €',
    });
  });

  it('leere Angaben bleiben als leere Zeile stehen, statt zu verschwinden (P27)', () => {
    expect(
      zeile(zeilen({ ...AUSGEFUELLT, arbeitgeber: '' }, 'zusage'), 'arbeitgeber'),
    ).toMatchObject({
      art: 'text',
      wert: '',
    });
  });

  it('Miete vom Amt: statt Betrag der Satz; Rente mit eigenem Etikett', () => {
    const amt = zeilen({ ...AUSGEFUELLT, lebenssituation: 'leistungsbezug' }, 'zusage');
    expect(zeile(amt, 'nettoeinkommen')).toMatchObject({ art: 'hinweis' });
    const rente = zeilen({ ...AUSGEFUELLT, lebenssituation: 'rente' }, 'zusage');
    expect(zeile(rente, 'nettoeinkommen')).toMatchObject({ etikett: 'Rente im Monat, netto' });
  });
});

describe('P19: Selbstauskunft von Bürgen', () => {
  const HH = haushaltsAngaben({ haustiere: 'ja', haustiereText: 'eine Katze', ort: 'Hamburg' });
  const WER = einziehend(2, { kinder: 1, weitereErwachsene: 0 });

  it('nur eigene Angaben: keine Personen, die einziehen, keine Haustiere, kein Ort', () => {
    const bloecke = selbstauskunftBloecke(AUSGEFUELLT, 'buerge', WER, HH, 'zusage', {
      rolleText: 'Bürgin',
      buergschaftDabei: true,
    });
    const ids = bloecke.flatMap((b) => b.zeilen.map((z) => z.id));
    expect(bloecke.map((b) => b.id)).toEqual(['person', 'buergschaft', 'einkommen', 'fragen']);
    expect(ids).not.toContain('personenzahl');
    expect(ids).not.toContain('haustiere');
    expect(ids).toContain('nettoeinkommen');
    expect(bloecke[1]!.zeilen[1]).toMatchObject({
      wert: expect.stringContaining('liegt der Mappe bei'),
    });
    expect(ortUndDatum('buerge', 'Hamburg', '2. November 2026')).toEqual({
      ortDatum: '2. November 2026',
      ortLabel: 'Datum',
    });
    expect(ortUndDatum('mitmieter', 'Hamburg', '2. November 2026')).toEqual({
      ortDatum: 'Hamburg, 2. November 2026',
      ortLabel: 'Ort, Datum',
    });
  });
});

describe('Personen, die einziehen', () => {
  it('ohne Kinder nur die Zahl, sonst mit Erwachsenen und Kindern', () => {
    expect(einziehendText(einziehend(2, { kinder: 0, weitereErwachsene: 1 }))).toBe('3');
    expect(einziehendText(einziehend(1, { kinder: 2, weitereErwachsene: 0 }))).toBe(
      '3 (1 Erwachsener, 2 Kinder)',
    );
  });
});

describe('E49: Mietrückstände erst nach der Zusage', () => {
  const HH = haushaltsAngaben({ haustiere: 'nein', haustiereText: '', ort: 'Hamburg' });
  const WER = einziehend(2, { kinder: 0, weitereErwachsene: 0 });
  const zeile = (zusageText?: string) =>
    selbstauskunftBloecke(AUSGEFUELLT, 'hauptmieter', WER, HH, 'will_wohnung', {
      rolleText: 'Hauptmieter',
      zusageText,
    })
      .flatMap((b) => b.zeilen)
      .find((z) => z.id === 'mietrueckstaende');

  it('mit dem Schalter steht der Satz aus B17a statt der Antwort', () => {
    expect(zeile(nachZusageSatz(false))).toMatchObject({
      art: 'hinweis',
      wert: 'Beantworten wir nach der Zusage',
    });
    expect(zeile(nachZusageSatz(true))).toMatchObject({ wert: 'Beantworte ich nach der Zusage' });
  });

  it('ohne den Schalter bleibt der bisherige Satz', () => {
    expect(zeile()).toMatchObject({
      art: 'hinweis',
      wert: 'Wird erst bei der Zusage gefragt und dann ergänzt',
    });
  });
});

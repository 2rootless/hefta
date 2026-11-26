import { describe, expect, it } from 'vitest';
import {
  bloecke,
  einzelDateiname,
  fehlendeUnterlagen,
  hinweise,
  zuAlteUnterlagen,
  mappenDateiname,
  auskunftAntwortenImmer,
  datensparsamUmstellen,
  einstellungenNachLaden,
  standardEinstellungen,
  strassenteil,
  ohneUnterlagen,
  type ExportEinstellungen,
  BITTE_MAX,
  BITTE_VORSCHLAG,
} from './export';
import type { DateiVersion, Dokument, Person } from './modell';
import { personStand } from './regelkatalog';
import { leereSelbstauskunft } from './selbstauskunft';

const HEUTE = new Date(2026, 10, 6);
const ZEIT = '2026-11-06T10:00:00.000Z';

function person(id: string, teil: Partial<Person> = {}): Person {
  return {
    id,
    createdAt: ZEIT,
    updatedAt: ZEIT,
    vorname: id,
    nachname: 'Mustermann',
    rufname: id,
    kontakt: {
      telefon: '0171 3920001',
      telefonLand: 'DE',
      telefonE164: '+491713920001',
      email: '',
    },
    lebenssituation: 'angestellt',
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: 2800,
    abrechnungMeist: null,
    selbstauskunft: {
      ...leereSelbstauskunft(),
      insolvenz: 'nein',
      raeumungstitel: 'nein',
      mietrueckstaende: 'nein',
      rueckstandMonate: 'nein',
      rueckstandMieten: 'nein',
      kuendigung: 'nein',
      haustiere: 'nein',
      ort: 'Hamburg',
    },
    ...teil,
  };
}

let n = 0;
function mit(personId: string, typ: string, datum: Partial<DateiVersion>[]) {
  const d: Dokument = {
    id: `d${++n}`,
    createdAt: ZEIT,
    updatedAt: ZEIT,
    personId,
    typ,
    notiz: '',
    serie: typ === 'gehaltsnachweis' ? 3 : null,
    stummBis: null,
  };
  const v = datum.map(
    (x, i) =>
      ({
        id: `${d.id}-${i}`,
        createdAt: ZEIT,
        updatedAt: ZEIT,
        dokumentId: d.id,
        ausstellungsdatum: null,
        abrechnungsmonat: null,
        variante: null,
        original: `f-${d.id}-${i}`,
        aufbereitet: null,
        seiten: null,
        schwaerzungen: {},
        gerastert: false,
        erkannteWerte: null,
        vomNutzerBestaetigt: null,
        ...x,
      }) as DateiVersion,
  );
  return { d, v };
}

function haushalt() {
  const teile = [
    mit('Max', 'gehaltsnachweis', [
      { abrechnungsmonat: '2026-07' },
      { abrechnungsmonat: '2026-08' },
      { abrechnungsmonat: '2026-09' },
    ]),
    mit('Max', 'bonitaet', [{ ausstellungsdatum: '2026-10-20' }]),
    mit('Max', 'mietzahlung', [{ ausstellungsdatum: '2026-10-01' }]),
    mit('Lea', 'gehaltsnachweis', [{ abrechnungsmonat: '2026-09' }]),
    mit('Petra', 'buergschaftserklaerung', [{ ausstellungsdatum: '2026-10-01' }]),
    mit('Petra', 'gehaltsnachweis', [
      { abrechnungsmonat: '2026-07' },
      { abrechnungsmonat: '2026-08' },
      { abrechnungsmonat: '2026-09' },
    ]),
    mit('Petra', 'bonitaet', [{ ausstellungsdatum: '2026-07-01' }]),
  ];
  const dokumente = teile.map((x) => x.d);
  const versionen = teile.flatMap((x) => x.v);
  const stand = (p: Person, rolle: 'vertrag' | 'buerge', farbe: number) =>
    personStand(p, { rolle, farbe, bezeichnung: 'neutral' }, dokumente, versionen, HEUTE);
  return [
    stand(person('Max'), 'vertrag', 1),
    stand(person('Lea'), 'vertrag', 2),
    stand(person('Petra'), 'buerge', 3),
  ];
}

const E = (teil: Partial<ExportEinstellungen> = {}) => ({ ...standardEinstellungen(), ...teil });
const ids = (e: ExportEinstellungen) =>
  bloecke(haushalt(), e).map((b) => [b.person.person.id, b.teile.map((t) => t.stand.typ.id)]);

describe('Antworten in der Selbstauskunft', () => {
  it('Nur „Datensparsam“ hält sie zurück', () => {
    expect(auskunftAntwortenImmer({ modus: 'marktueblich' })).toBe(true);
    expect(auskunftAntwortenImmer({ modus: 'alles' })).toBe(true);
    expect(auskunftAntwortenImmer({ modus: 'eigene_auswahl' })).toBe(true);
    expect(auskunftAntwortenImmer({ modus: 'datensparsam' })).toBe(false);
  });
});

describe('Einstellungen nach dem Laden', () => {
  it('Gespeichertes gilt, und was schon getippt wurde, geht vor', () => {
    const start = standardEinstellungen();
    expect(einstellungenNachLaden({ ausgabe: 'einzeln' }, start)).toEqual({
      ...start,
      ausgabe: 'einzeln',
    });
    const getippt = { ...start, bitte: true };
    expect(einstellungenNachLaden({ ausgabe: 'einzeln', bitte: false }, getippt)).toEqual({
      ...start,
      ausgabe: 'einzeln',
      bitte: true,
    });
    expect(einstellungenNachLaden(undefined, getippt).bitte).toBe(true);
  });

  it('Leere Listen zählen nicht als getippt: Sonst löschte das Laden die gespeicherte Auswahl', () => {
    const auswahl = { 'p:gehalt': true };
    expect(einstellungenNachLaden({ auswahl, ohne: ['a'] }, standardEinstellungen())).toMatchObject(
      { auswahl, ohne: ['a'] },
    );
  });
});

describe('Was in die Mappe kommt', () => {
  it('Marktüblich: Übliches und hochgeladene Mietzahlungen (Entscheidung Z), Bürgschaft im Block der Bürgin zuerst', () => {
    expect(ids(E())).toEqual([
      ['Max', ['selbstauskunft', 'gehaltsnachweis', 'bonitaet', 'mietzahlung']],
      ['Lea', ['selbstauskunft', 'gehaltsnachweis']],
      ['Petra', ['buergschaftserklaerung', 'selbstauskunft', 'gehaltsnachweis', 'bonitaet']],
    ]);
  });

  it('Fehlende Mietzahlungen gelten nie als fehlend, auch nicht bei Marktüblich', () => {
    const ohne = haushalt().map((s) => ({
      ...s,
      unterlagen: s.unterlagen.map((u) =>
        u.typ.id === 'mietzahlung' ? { ...u, versionen: [], status: 'fehlt' as const } : u,
      ),
    }));
    expect(fehlendeUnterlagen(ohne, E()).map((f) => f.unterlage.typ.id)).not.toContain(
      'mietzahlung',
    );
    expect(bloecke(ohne, E()).flatMap((b) => b.teile.map((t) => t.stand.typ.id))).not.toContain(
      'mietzahlung',
    );
  });

  it('Datensparsam bleibt beim Kern, auch nach der Zusage und mit hochgeladenen Mietzahlungen', () => {
    const teile = ids(E({ modus: 'datensparsam', schritt: 'zusage' })).flatMap(([, t]) => t);
    expect(teile).not.toContain('mietzahlung');
  });

  it('Alles: nimmt vorhandene „Kann helfen“ dazu, nie „Meist unnötig“', () => {
    expect(ids(E({ modus: 'alles' }))).toEqual([
      ['Max', ['selbstauskunft', 'gehaltsnachweis', 'bonitaet', 'mietzahlung']],
      ['Lea', ['selbstauskunft', 'gehaltsnachweis']],
      ['Petra', ['buergschaftserklaerung', 'selbstauskunft', 'gehaltsnachweis', 'bonitaet']],
    ]);
  });

  it('Datensparsam „Ich will die Wohnung“: nur die Selbstauskünfte', () => {
    expect(ids(E({ modus: 'datensparsam', schritt: 'will_wohnung' }))).toEqual([
      ['Max', ['selbstauskunft']],
      ['Lea', ['selbstauskunft']],
      ['Petra', ['selbstauskunft']],
    ]);
  });

  it('Datensparsam „Besichtigung“: nichts außer dem Deckblatt', () => {
    expect(
      ids(E({ modus: 'datensparsam', schritt: 'besichtigung' })).flatMap(([, t]) => t),
    ).toEqual([]);
  });

  it('Bürgin für diese Bewerbung abgewählt (X4)', () => {
    expect(ids(E({ ohne: ['Petra'] })).map(([id]) => id)).toEqual(['Max', 'Lea']);
  });

  it('Eigene Auswahl startet aus Marktüblich und schaltet einzeln', () => {
    expect(
      ids(
        E({
          modus: 'eigene_auswahl',
          auswahl: { 'Max:mietzahlung': false, 'Max:bonitaet': false },
        }),
      )[0],
    ).toEqual(['Max', ['selbstauskunft', 'gehaltsnachweis']]);
  });
});

describe('Hinweise', () => {
  it('fehlende Unterlagen (X5) und zu alte (Z5)', () => {
    expect(fehlendeUnterlagen(haushalt(), E())).toHaveLength(2);
    expect(zuAlteUnterlagen(haushalt(), E()).map((x) => x.person.person.vorname)).toEqual([
      'Petra',
    ]);
  });

  it('Datensparsam vor der Zusage: Bonitätsnachweis ist nicht dabei (X2), bei Zusage nicht (X3)', () => {
    expect(hinweise(haushalt(), E({ modus: 'datensparsam' })).map((x) => x.art)).toContain(
      'ohneBonitaet',
    );
    expect(
      hinweise(haushalt(), E({ modus: 'datensparsam', schritt: 'zusage' })).map((x) => x.art),
    ).not.toContain('ohneBonitaet');
  });

  it('Für den Vertrag zusammengestellt: nennt, wer die Frage nach der Zusage offen hat', () => {
    const staende = haushalt().map((s, i) =>
      i === 0
        ? {
            ...s,
            person: {
              ...s.person,
              selbstauskunft: { ...s.person.selbstauskunft!, kuendigung: null },
            },
          }
        : s,
    );
    const offen = (e: Parameters<typeof E>[0]) =>
      hinweise(staende, E(e)).find((h) => h.art === 'zusageOffen');
    expect(offen({ modus: 'datensparsam', schritt: 'will_wohnung' })).toBeUndefined();
    expect(offen({ modus: 'marktueblich', schritt: 'zusage' })).toBeUndefined();
    expect(offen({ modus: 'datensparsam', schritt: 'zusage' })).toEqual({
      art: 'zusageOffen',
      namen: [staende[0]!.person.rufname || staende[0]!.person.vorname],
    });
    expect(hinweise(haushalt(), E({ modus: 'datensparsam', schritt: 'zusage' }))).toEqual([]);
  });
});

describe('Dateinamen (06-export.md)', () => {
  it('Mappe mit Nachname und Straße, „straße“ → „str“', () => {
    expect(mappenDateiname(['Mustermann', 'Mustermann'], 'Beispielstraße 1, 3. OG links')).toBe(
      'Bewerbung_Mustermann_Beispielstr1.pdf',
    );
    expect(strassenteil('Große Beispielstraße 1a')).toBe('GrosseBeispielstr1a');
  });

  it('PC120 (§8, 5): eine Spanne von Hausnummern behält ihren Strich', () => {
    expect(mappenDateiname(['Mustermann'], 'Musterweg 7–9\n00100 Musterstadt')).toBe(
      'Bewerbung_Mustermann_Musterweg7-9.pdf',
    );
    expect(strassenteil('Musterweg 7-9')).toBe('Musterweg7-9');
    expect(strassenteil('Musterweg 7 – 9a, 2. OG')).toBe('Musterweg7-9a');
    expect(strassenteil('Musterweg 7/9')).toBe('Musterweg7-9');
    expect(strassenteil('Muster-Beispiel-Straße 1')).toBe('MusterBeispielstr1');
    expect(strassenteil('Musterweg 7')).toBe('Musterweg7');
    expect(strassenteil('')).toBe('');
    // Gegenprobe: die alte Fassung machte aus 7–9 die Zahl 79.
    expect(strassenteil('Musterweg 7–9')).not.toBe('Musterweg79');
  });

  it('ohne Wohnung, zwei Nachnamen, Umlaute', () => {
    expect(mappenDateiname(['Müller', 'Öztürk'], '')).toBe('Bewerbung_Mueller-Oeztuerk.pdf');
  });

  it('Einzeldateien mit Nummer, Unterlage, Vor- und Nachname', () => {
    expect(einzelDateiname(2, 'Gehalts­nachweise', 'Max', 'Mustermann')).toBe(
      '02_Gehaltsnachweise_Max_Mustermann.pdf',
    );
    expect(einzelDateiname(5, 'Bürgschaftserklärung', 'Anna-Katharina', 'von Hohenstein')).toBe(
      '05_Buergschaftserklaerung_AnnaKatharina_vonHohenstein.pdf',
    );
  });
});

describe('E49: „Datensparsam“ wird „Eigene Auswahl“ mit gleichem Inhalt', () => {
  const typen = [
    { id: 'selbstauskunft', etikett: 'ueblich', schritt: 'will_wohnung' },
    { id: 'gehaltsnachweis', etikett: 'ueblich', schritt: 'zusage' },
    { id: 'bonitaet', etikett: 'ueblich', schritt: 'zusage' },
    { id: 'mietzahlung', etikett: 'kann_helfen', schritt: 'zusage' },
    { id: 'wbs', etikett: 'ueblich', schritt: 'will_wohnung' },
    { id: 'ausweiskopie', etikett: 'meist_unnoetig', schritt: null },
    { id: 'anschreiben', etikett: 'kann_helfen', schritt: null },
  ];
  const mit = (schritt: ExportEinstellungen['schritt']): ExportEinstellungen => ({
    ...standardEinstellungen(),
    modus: 'datensparsam',
    schritt,
  });

  it('„Ich will die Wohnung“: Selbstauskunft und WBS an, Nachweise für den Vertrag aus', () => {
    const e = datensparsamUmstellen(mit('will_wohnung'), ['max', 'lea'], typen);
    expect(e.modus).toBe('eigene_auswahl');
    // PC65: Den Schalter gibt es nicht mehr; die Wahl steht an der Frage.
    expect(e.mietrueckstaendeNachZusage).toBeUndefined();
    for (const p of ['max', 'lea']) {
      expect(e.auswahl[`${p}:selbstauskunft`]).toBe(true);
      expect(e.auswahl[`${p}:wbs`]).toBe(true);
      expect(e.auswahl[`${p}:gehaltsnachweis`]).toBe(false);
      expect(e.auswahl[`${p}:bonitaet`]).toBe(false);
      expect(e.auswahl[`${p}:mietzahlung`]).toBe(false);
      expect(e.auswahl[`${p}:ausweiskopie`]).toBe(false);
    }
    // PC65: Eine gegebene Antwort steht in der Mappe; wer sie nicht geben will, wählt an der Frage
    // „Nach der Zusage beantworten“ (dann „Beantworte ich nach der Zusage“).
    expect(auskunftAntwortenImmer(e)).toBe(true);
  });

  it('„Zur Besichtigung“: nichts aus dem Mietwunsch', () => {
    const e = datensparsamUmstellen(mit('besichtigung'), ['max'], typen);
    expect(e.auswahl['max:selbstauskunft']).toBe(false);
    expect(e.auswahl['max:bonitaet']).toBe(false);
    // PC65: Den Schalter gibt es nicht mehr; die Wahl steht an der Frage.
    expect(e.mietrueckstaendeNachZusage).toBeUndefined();
  });

  it('„Nach der Zusage“: alle üblichen an, Antworten immer', () => {
    const e = datensparsamUmstellen(mit('zusage'), ['max'], typen);
    expect(e.auswahl['max:gehaltsnachweis']).toBe(true);
    expect(e.auswahl['max:bonitaet']).toBe(true);
    // „Kann helfen“ ging auch bei „Datensparsam“ nie mit.
    expect(e.auswahl['max:mietzahlung']).toBe(false);
    expect(e.mietrueckstaendeNachZusage).toBeUndefined();
    expect(auskunftAntwortenImmer(e)).toBe(true);
  });

  it('lässt andere Stufen unverändert', () => {
    const e = { ...standardEinstellungen(), modus: 'alles' as const };
    expect(datensparsamUmstellen(e, ['max'], typen)).toBe(e);
  });

  it('PC65: Nur „Datensparsam“ hält eine gegebene Antwort zurück, kein Schalter mehr', () => {
    const e = { ...standardEinstellungen(), modus: 'eigene_auswahl' as const };
    expect(auskunftAntwortenImmer(e)).toBe(true);
    // Auch ein alter, gespeicherter Schalter hält nichts mehr zurück.
    expect(auskunftAntwortenImmer({ ...e, mietrueckstaendeNachZusage: true } as typeof e)).toBe(
      true,
    );
    expect(auskunftAntwortenImmer({ ...e, modus: 'datensparsam' })).toBe(false);
  });
});

describe('PC126 K5: „Diesmal weglassen“ (DP83 a)', () => {
  it('macht „Eigene Auswahl“ ohne die ganze Unterlage; alles andere bleibt, wie es gewählt war', () => {
    const vorher = E();
    const nachher = ohneUnterlagen(vorher, haushalt(), [
      { personId: 'Max', typ: 'gehaltsnachweis' },
    ]);
    expect(nachher.modus).toBe('eigene_auswahl');
    const v = Object.fromEntries(ids(vorher));
    const n = Object.fromEntries(ids(nachher));
    expect(v['Max']).toContain('gehaltsnachweis');
    expect(n['Max']).toEqual(v['Max'].filter((typ: string) => typ !== 'gehaltsnachweis'));
    expect(n['Lea']).toEqual(v['Lea']);
    expect(n['Petra']).toEqual(v['Petra']);
    // Gegenprobe: ohne etwas wegzulassen bleibt die Auswahl unverändert.
    expect(ohneUnterlagen(vorher, haushalt(), [])).toBe(vorher);
  });
});

// PC207, Abschnitt 3: Die Löschbitte nennt die Regel (Art. 17 Abs. 1 DSGVO, Orientierungshilfe D), bleibt freundlich und
// passt in zwei Zeilen auf dem Deckblatt.
describe('PC207: Löschbitte mit Art. 17', () => {
  it('Vorschlag mit Regel, ohne geschützte Leerzeichen (Regel 1), höchstens BITTE_MAX Zeichen', () => {
    expect(BITTE_VORSCHLAG).toContain('sobald Sie sie nicht mehr brauchen (Art. 17 Abs. 1 DSGVO)');
    expect(BITTE_VORSCHLAG).not.toContain(String.fromCharCode(0xa0));
    expect(BITTE_VORSCHLAG).toMatch(/^Bitte löschen Sie/);
    expect(BITTE_VORSCHLAG.length).toBeLessThanOrEqual(BITTE_MAX);
  });
  it('Gegenprobe: der alte Vorschlag hätte die Regel nicht', () => {
    expect(
      'Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank.',
    ).not.toMatch(/Art\.\s17/);
  });
});

describe('PC207, 1: Ausweiskopie und Datenkopie nie in der Mappe', () => {
  it('auch nicht abgelegt und in „Eigene Auswahl“ ausdrücklich gewählt', () => {
    const teile = [
      mit('Max', 'ausweiskopie', [{ ausstellungsdatum: '2026-10-01' }]),
      mit('Max', 'schufa_datenkopie', [{ ausstellungsdatum: '2026-10-01' }]),
      mit('Max', 'bonitaet', [{ ausstellungsdatum: '2026-10-20' }]),
    ];
    const stand = personStand(
      person('Max'),
      { rolle: 'vertrag', farbe: 1, bezeichnung: 'neutral' },
      teile.map((x) => x.d),
      teile.flatMap((x) => x.v),
      HEUTE,
    );
    for (const modus of ['marktueblich', 'alles', 'eigene_auswahl'] as const) {
      const e = E({
        modus,
        auswahl: { 'Max:ausweiskopie': true, 'Max:schufa_datenkopie': true, 'Max:bonitaet': true },
      });
      const typen = bloecke([stand], e).flatMap((b) => b.teile.map((t) => t.stand.typ.id));
      expect(typen, modus).not.toContain('ausweiskopie');
      expect(typen, modus).not.toContain('schufa_datenkopie');
      // Gegenprobe: Die Bonitätsauskunft kommt mit.
      expect(typen, modus).toContain('bonitaet');
    }
  });
});

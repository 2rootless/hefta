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
  type ExportEinstellungen,
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
    kontakt: { telefon: '0170', email: '' },
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
  const stand = (p: Person, rolle: 'hauptmieter' | 'mitmieter' | 'buerge', farbe: number) =>
    personStand(p, { rolle, farbe, bezeichnung: 'neutral' }, dokumente, versionen, HEUTE);
  return [
    stand(person('Max'), 'hauptmieter', 1),
    stand(person('Lea'), 'mitmieter', 2),
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
              selbstauskunft: { ...s.person.selbstauskunft!, mietrueckstaende: null },
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
    expect(mappenDateiname(['Mustermann', 'Mustermann'], 'Hauptstraße 12, 3. OG links')).toBe(
      'Bewerbung_Mustermann_Hauptstr12.pdf',
    );
    expect(strassenteil('Große Bergstraße 7a')).toBe('GrosseBergstr7a');
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

  it('„Ich will die Wohnung“: Selbstauskunft und WBS an, Nachweise für den Vertrag aus, Schalter an', () => {
    const e = datensparsamUmstellen(mit('will_wohnung'), ['max', 'lea'], typen);
    expect(e.modus).toBe('eigene_auswahl');
    expect(e.mietrueckstaendeNachZusage).toBe(true);
    for (const p of ['max', 'lea']) {
      expect(e.auswahl[`${p}:selbstauskunft`]).toBe(true);
      expect(e.auswahl[`${p}:wbs`]).toBe(true);
      expect(e.auswahl[`${p}:gehaltsnachweis`]).toBe(false);
      expect(e.auswahl[`${p}:bonitaet`]).toBe(false);
      expect(e.auswahl[`${p}:mietzahlung`]).toBe(false);
      expect(e.auswahl[`${p}:ausweiskopie`]).toBe(false);
    }
    // Die Antwort zu Mietrückständen bleibt draußen, wie vorher.
    expect(auskunftAntwortenImmer(e)).toBe(false);
  });

  it('„Zur Besichtigung“: nichts aus dem Mietwunsch, Schalter an', () => {
    const e = datensparsamUmstellen(mit('besichtigung'), ['max'], typen);
    expect(e.auswahl['max:selbstauskunft']).toBe(false);
    expect(e.auswahl['max:bonitaet']).toBe(false);
    expect(e.mietrueckstaendeNachZusage).toBe(true);
  });

  it('„Nach der Zusage“: alle üblichen an, Schalter aus, Antworten immer', () => {
    const e = datensparsamUmstellen(mit('zusage'), ['max'], typen);
    expect(e.auswahl['max:gehaltsnachweis']).toBe(true);
    expect(e.auswahl['max:bonitaet']).toBe(true);
    // „Kann helfen“ ging auch bei „Datensparsam“ nie mit.
    expect(e.auswahl['max:mietzahlung']).toBe(false);
    expect(e.mietrueckstaendeNachZusage).toBe(false);
    expect(auskunftAntwortenImmer(e)).toBe(true);
  });

  it('lässt andere Stufen unverändert', () => {
    const e = { ...standardEinstellungen(), modus: 'alles' as const };
    expect(datensparsamUmstellen(e, ['max'], typen)).toBe(e);
  });

  it('der Schalter allein hält die Antwort zurück, auch in „Eigene Auswahl“', () => {
    const e = { ...standardEinstellungen(), modus: 'eigene_auswahl' as const };
    expect(auskunftAntwortenImmer(e)).toBe(true);
    expect(auskunftAntwortenImmer({ ...e, mietrueckstaendeNachZusage: true })).toBe(false);
  });
});

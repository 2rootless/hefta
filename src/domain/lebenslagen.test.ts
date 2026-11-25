import { describe, expect, it } from 'vitest';
import { bloecke, standardEinstellungen } from './export';
import type { Person } from './modell';
import {
  basisId,
  deckTaetigkeit,
  dokumenttyp,
  lagenVon,
  personStand,
  unterlagenFuerPerson,
  wirksameLagen,
} from './regelkatalog';

// DP47 G5 mit DP47b K1, Prüffälle L2, L3, L5, L6, L13, L15 (Liste), L8 (Reihenfolge).

const HEUTE = new Date(2026, 10, 16);

function person(teil: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
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

const ids = (liste: { typ: { id: string } }[]) => liste.map((x) => x.typ.id);

describe('Mehrere Lebenslagen (DP47 G5)', () => {
  it('L2: angestellt, dazu selbstständig: fünf Unterlagen, keine doppelt, Einkommen in Reihenfolge', () => {
    const max = person({ weitereLagen: [{ id: 'l2', situation: 'selbststaendig' }] });
    const s = personStand(max, 'vertrag', [], [], HEUTE);
    expect(s.pfad.map((u) => u.typ.id)).toEqual([
      'selbstauskunft',
      'gehaltsnachweis',
      'einkommen_selbststaendig',
      'bonitaet',
    ]);
    // Die Lage steht vorn, weil es mehr als eine gibt.
    expect(s.unterlagen.find((u) => u.typ.id === 'einkommen_selbststaendig')?.lage?.situation).toBe(
      'selbststaendig',
    );
    expect(s.unterlagen.find((u) => u.typ.id === 'selbstauskunft')?.lage).toBeUndefined();
  });

  it('L1: eine Lage: keine Lage vorn, Liste wie bisher', () => {
    const s = personStand(person(), 'vertrag', [], [], HEUTE);
    expect(s.unterlagen.every((u) => !u.lage)).toBe(true);
  });

  it('L3: Bürgin in Rente, dazu angestellt: Bürgschaft vorn, Rentenbescheid vor Gehaltsnachweisen', () => {
    const petra = person({
      lebenssituation: 'rente',
      weitereLagen: [{ id: 'l2', situation: 'angestellt' }],
    });
    expect(ids(unterlagenFuerPerson('buerge', petra)).slice(0, 4)).toEqual([
      'buergschaftserklaerung',
      'selbstauskunft',
      'rentenbescheid',
      'gehaltsnachweis',
    ]);
  });

  it('L8: Reihenfolge der Lagen bestimmt die Reihenfolge der Nachweise', () => {
    const umgekehrt = person({
      lebenssituation: 'selbststaendig',
      weitereLagen: [{ id: 'l2', situation: 'angestellt' }],
    });
    const liste = ids(unterlagenFuerPerson('vertrag', umgekehrt));
    expect(liste.indexOf('einkommen_selbststaendig')).toBeLessThan(
      liste.indexOf('gehaltsnachweis'),
    );
  });

  it('L5: Studium, dazu angestellt: Nachweis zum Studium und Gehaltsnachweise', () => {
    const lea = person({
      lebenssituation: 'studierend_azubi',
      ausbildungArt: 'studium',
      weitereLagen: [{ id: 'l2', situation: 'angestellt' }],
    });
    expect(ids(unterlagenFuerPerson('vertrag', lea))).toEqual(
      expect.arrayContaining(['einkommen_ausbildung', 'gehaltsnachweis']),
    );
  });

  it('L6 (DP47b K1): Leistungen vom Amt, dazu Minijob, Schalter aus: keine Gehaltsnachweise', () => {
    const amt = person({
      lebenssituation: 'leistungsbezug',
      weitereLagen: [{ id: 'l2', situation: 'angestellt' }],
    });
    expect(wirksameLagen(amt).map((l) => l.situation)).toEqual(['leistungsbezug']);
    expect(ids(unterlagenFuerPerson('vertrag', amt))).not.toContain('gehaltsnachweis');
    expect(lagenVon(amt)).toHaveLength(2);
  });

  it('L13, L15: Schalter an: Gehaltsnachweise dazu; wieder aus: bleiben gespeichert, nicht mehr nötig', () => {
    const an = person({
      lebenssituation: 'leistungsbezug',
      weitereLagen: [{ id: 'l2', situation: 'angestellt' }],
      einkommenTrotzdem: true,
    });
    expect(ids(unterlagenFuerPerson('vertrag', an))).toContain('gehaltsnachweis');
    const dok = {
      id: 'd',
      createdAt: '',
      updatedAt: '',
      personId: 'p1',
      typ: 'gehaltsnachweis',
      notiz: '',
      serie: 3,
      stummBis: null,
    };
    const v = {
      id: 'v',
      createdAt: '',
      updatedAt: '',
      dokumentId: 'd',
      ausstellungsdatum: null,
      abrechnungsmonat: '2026-10',
      variante: null,
      original: 'f',
      aufbereitet: null,
      seiten: null,
      schwaerzungen: {},
      gerastert: false,
      erkannteWerte: null,
      vomNutzerBestaetigt: null,
    };
    const aus = personStand({ ...an, einkommenTrotzdem: false }, 'vertrag', [dok], [v], HEUTE);
    expect(aus.nichtMehrNoetig.map((u) => u.typ.id)).toContain('gehaltsnachweis');
  });

  it('L4: zweimal angestellt: zwei Reihen Gehaltsnachweise mit eigenen Dokumenten, Grundtyp für den Vermieter', () => {
    const max = person({
      arbeitgeber: 'Musterwerk GmbH',
      weitereLagen: [{ id: 'l2', situation: 'angestellt', arbeitgeber: 'Café Beispiel' }],
    });
    const liste = unterlagenFuerPerson('vertrag', max);
    expect(ids(liste).filter((id) => id.startsWith('gehaltsnachweis'))).toEqual([
      'gehaltsnachweis',
      'gehaltsnachweis2',
    ]);
    const zweite = liste.find((x) => x.typ.id === 'gehaltsnachweis2')!;
    expect(zweite.typ.basis).toBe('gehaltsnachweis');
    expect(basisId(zweite.typ)).toBe('gehaltsnachweis');
    expect(zweite.typ.serie?.anzahl).toBe(3);
    expect(zweite.lage).toMatchObject({ arbeitgeber: 'Café Beispiel', mitArbeitgeber: true });
    expect(dokumenttyp('gehaltsnachweis2')?.basis).toBe('gehaltsnachweis');
    // Nur Einkommensnachweise haben eine zweite Reihe.
    expect(dokumenttyp('bonitaet2')).toBeUndefined();

    const dok = (typ: string) => ({
      id: `d-${typ}`,
      createdAt: '',
      updatedAt: '',
      personId: 'p1',
      typ,
      notiz: '',
      serie: 3,
      stummBis: null,
    });
    const v = (dokumentId: string) => ({
      id: `v-${dokumentId}`,
      createdAt: '',
      updatedAt: '',
      dokumentId,
      ausstellungsdatum: null,
      abrechnungsmonat: '2026-10',
      variante: null,
      original: 'f',
      aufbereitet: null,
      seiten: null,
      schwaerzungen: {},
      gerastert: false,
      erkannteWerte: null,
      vomNutzerBestaetigt: null,
    });
    const s = personStand(
      max,
      'vertrag',
      [dok('gehaltsnachweis2')],
      [v('d-gehaltsnachweis2')],
      HEUTE,
    );
    expect(s.unterlagen.find((u) => u.typ.id === 'gehaltsnachweis')?.versionen).toEqual([]);
    expect(s.unterlagen.find((u) => u.typ.id === 'gehaltsnachweis2')?.versionen).toHaveLength(1);
    expect(s.pfad.filter((u) => basisId(u.typ) === 'gehaltsnachweis')).toHaveLength(2);
  });

  it('L4: ohne zweite angestellte Lage ist die zweite Reihe „nicht mehr nötig“, aber gespeichert', () => {
    const dok = {
      id: 'd2',
      createdAt: '',
      updatedAt: '',
      personId: 'p1',
      typ: 'gehaltsnachweis2',
      notiz: '',
      serie: 3,
      stummBis: null,
    };
    const v = {
      id: 'v2',
      createdAt: '',
      updatedAt: '',
      dokumentId: 'd2',
      ausstellungsdatum: null,
      abrechnungsmonat: '2026-10',
      variante: null,
      original: 'f',
      aufbereitet: null,
      seiten: null,
      schwaerzungen: {},
      gerastert: false,
      erkannteWerte: null,
      vomNutzerBestaetigt: null,
    };
    const s = personStand(person(), 'vertrag', [dok], [v], HEUTE);
    expect(s.nichtMehrNoetig.map((u) => u.typ.id)).toEqual(['gehaltsnachweis2']);
  });

  it('Deckblatt: „Elektroniker, auch selbstständig …“; L5 Beruf statt „Im Studium“; K5 ohne zweite Lage', () => {
    expect(
      deckTaetigkeit(
        person({
          beruf: 'Elektroniker',
          weitereLagen: [{ id: 'l2', situation: 'selbststaendig' }],
        }),
      ),
    ).toBe('Elektroniker, auch selbstständig oder freiberuflich');
    expect(deckTaetigkeit(person({ beruf: 'Elektroniker' }))).toBe('Elektroniker');
    expect(
      deckTaetigkeit(
        person({
          lebenssituation: 'studierend_azubi',
          ausbildungArt: 'studium',
          beruf: '',
          weitereLagen: [{ id: 'l2', situation: 'angestellt', beruf: 'Kellnerin' }],
        }),
      ),
    ).toBe('Kellnerin, auch im Studium');
    expect(
      deckTaetigkeit(
        person({
          lebenssituation: 'leistungsbezug',
          beruf: '',
          weitereLagen: [{ id: 'l2', situation: 'angestellt', beruf: 'Aushilfe' }],
        }),
      ),
    ).toBe('');
  });

  it('PC62 K1: „auch“ nennt die Lage, aus der der Beruf nicht stammt; Gegenprobe', () => {
    const lea = person({
      lebenssituation: 'studierend_azubi',
      ausbildungArt: 'studium',
      beruf: '',
      weitereLagen: [{ id: 'l2', situation: 'angestellt', beruf: 'Kellnerin' }],
    });
    const zeile = deckTaetigkeit(lea);
    expect(zeile).not.toMatch(/Kellnerin, auch angestellt/);
    expect(zeile).toBe('Kellnerin, auch im Studium');
    // Beruf aus der ersten Lage: die weiteren hinter „auch“, die erste nicht.
    expect(
      deckTaetigkeit(
        person({
          beruf: 'Elektroniker',
          weitereLagen: [
            { id: 'l2', situation: 'selbststaendig', beruf: 'Elektroarbeiten' },
            { id: 'l3', situation: 'rente' },
          ],
        }),
      ),
    ).toBe('Elektroniker, auch selbstständig oder freiberuflich und in Rente');
  });

  it('L11: ohne Link die ganze Mappe mit den Nachweisen beider Lagen', () => {
    const max = person({ weitereLagen: [{ id: 'l2', situation: 'selbststaendig' }] });
    const dok = (typ: string) => ({
      id: `d-${typ}`,
      createdAt: '',
      updatedAt: '',
      personId: 'p1',
      typ,
      notiz: '',
      serie: typ === 'gehaltsnachweis' ? 3 : null,
      stummBis: null,
    });
    const v = (typ: string, monat: string | null) => ({
      id: `v-${typ}`,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '',
      dokumentId: `d-${typ}`,
      ausstellungsdatum: monat ? null : '2026-06-01',
      abrechnungsmonat: monat,
      variante: null,
      original: 'f',
      aufbereitet: null,
      seiten: null,
      schwaerzungen: {},
      gerastert: false,
      erkannteWerte: null,
      vomNutzerBestaetigt: null,
    });
    const s = personStand(
      max,
      'vertrag',
      [dok('gehaltsnachweis'), dok('einkommen_selbststaendig')],
      [v('gehaltsnachweis', '2026-10'), v('einkommen_selbststaendig', null)],
      HEUTE,
    );
    const teile = bloecke([s], standardEinstellungen())[0]!.teile.map((x) => x.stand.typ.id);
    expect(teile.indexOf('gehaltsnachweis')).toBeLessThan(
      teile.indexOf('einkommen_selbststaendig'),
    );
    expect(teile).toEqual(expect.arrayContaining(['gehaltsnachweis', 'einkommen_selbststaendig']));
  });
});

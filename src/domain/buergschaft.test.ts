import { describe, expect, it } from 'vitest';
import {
  ansichtFuerHeft,
  betragAus,
  betragText,
  erklaerungFuer,
  leereAngaben,
  offenZahl,
  pflichtFehlt,
  versionenFuerHeft,
} from './buergschaft';
import type { DateiVersion, Dokument, Person } from './modell';
import { dokumenttyp, hilfeFuer, personStand } from './regelkatalog';
import { rutschListe } from './rutsch';

// E112 (DP41) und DP49 Punkt 5: Die Bürgschaftserklärung gilt je Wohnung, ist freiwillig und zählt nirgends.

const HEUTE = new Date(2026, 10, 17);

function person(id: string): Person {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    vorname: id,
    nachname: 'Mustermann',
    rufname: id,
    kontakt: { telefon: '', email: '' },
    lebenssituation: 'rente',
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: null,
    abrechnungMeist: null,
  };
}

const dok = (id: string, personId: string, typ: string): Dokument => ({
  id,
  createdAt: '',
  updatedAt: '',
  personId,
  typ,
  notiz: '',
  serie: null,
  stummBis: null,
});

const version = (id: string, dokumentId: string, am: string, heftId?: string): DateiVersion => ({
  id,
  createdAt: `${am}T10:00:00.000Z`,
  updatedAt: '',
  dokumentId,
  ausstellungsdatum: am,
  abrechnungsmonat: null,
  variante: null,
  original: `d-${id}`,
  aufbereitet: null,
  seiten: null,
  schwaerzungen: {},
  gerastert: false,
  erkannteWerte: null,
  vomNutzerBestaetigt: null,
  ...(heftId ? { heftId } : {}),
});

describe('Formular (DP41, Prüfkatalog E1 bis E4)', () => {
  it('E1: leer sind sechs Teile offen; E3: Höchstbetrag und Art fehlen', () => {
    const a = leereAngaben();
    expect(offenZahl(a)).toBe(6);
    expect(pflichtFehlt(a)).toEqual({ betrag: true, art: true });
    // Keine Art ist vorgewählt (DP41 Schnellmodus).
    expect(a.art).toBeNull();
  });

  it('E2: aus dem Heft zwei offen; E4: alles da, nichts offen', () => {
    const a = {
      ...leereAngaben(),
      buerge: { name: 'Petra Mustermann', anschrift: 'Musterweg 7, 12345 Musterstadt' },
      mieter: ['Max Mustermann', 'Lea Mustermann'],
      vermieter: { name: 'Hausverwaltung Beispiel GmbH', anschrift: 'Beispielstraße 1' },
      wohnung: 'Lindenring 3, Erdgeschoss, 20259 Hamburg',
      vertragTag: '2027-01-01',
    };
    expect(offenZahl(a)).toBe(2);
    const fertig = { ...a, hoechstbetrag: 3600, art: 'ausfall' as const };
    expect(offenZahl(fertig)).toBe(0);
    expect(pflichtFehlt(fertig)).toEqual({ betrag: false, art: false });
    // Gegenprobe: Null Euro zählt nicht als Höchstbetrag.
    expect(pflichtFehlt({ ...fertig, hoechstbetrag: 0 }).betrag).toBe(true);
  });

  it('Betrag: nur Ziffern, ganze Euro, mit Punkt geschrieben', () => {
    expect(betragAus('3.600 €')).toBe(3600);
    expect(betragAus('')).toBeNull();
    expect(betragText(12600)).toBe('12.600');
  });
});

describe('Je Wohnung (DP49 Punkt 5)', () => {
  const dokumente = [
    dok('b', 'petra', 'buergschaftserklaerung'),
    dok('r', 'petra', 'rentenbescheid'),
  ];
  const alt = version('v0', 'b', '2026-09-01');
  const linden3 = version('v3', 'b', '2026-10-20', 'h3');
  const rente = version('vr', 'r', '2026-07-01');

  it('die Mappe eines Hefts nimmt die Erklärung dieses Hefts; andere Unterlagen bleiben', () => {
    const v = versionenFuerHeft(dokumente, [alt, linden3, rente], 'h3');
    expect(v.map((x) => x.id).sort()).toEqual(['v3', 'vr']);
    // Gegenprobe: Die Erklärung für Lindenring 3 kommt nie in die Mappe von Lindenring 8.
    const acht = versionenFuerHeft(dokumente, [alt, linden3, rente], 'h8');
    expect(acht.map((x) => x.id)).not.toContain('v3');
    // Ohne eigene gilt die ohne bestimmte Wohnung, damit nichts still aus der Mappe fällt.
    expect(acht.map((x) => x.id).sort()).toEqual(['v0', 'vr']);
  });

  it('die Mappe ohne Heft nimmt nur die Erklärung ohne bestimmte Wohnung', () => {
    expect(versionenFuerHeft(dokumente, [linden3, rente], null).map((x) => x.id)).toEqual(['vr']);
    const ansicht = { dokumente, versionen: [rente] };
    expect(ansichtFuerHeft(ansicht, null)).toBe(ansicht);
  });

  it('Stand im Heft: eigene, sonst eine ohne Wohnung, sonst keine', () => {
    expect(erklaerungFuer('petra', dokumente, [alt, linden3], 'h3').eigene?.id).toBe('v3');
    const acht = erklaerungFuer('petra', dokumente, [alt, linden3], 'h8');
    expect(acht.eigene).toBeNull();
    expect(acht.ohneWohnung?.id).toBe('v0');
    expect(erklaerungFuer('petra', dokumente, [linden3], 'h8')).toEqual({
      eigene: null,
      ohneWohnung: null,
    });
  });

  it('B2: kein Schritt im Rutsch, nicht auf der Haarlinie, fehlt nie', () => {
    const petra = personStand(person('petra'), 'buerge', [], [], HEUTE);
    const erkl = petra.unterlagen.find((u) => u.typ.id === 'buergschaftserklaerung')!;
    expect(erkl.status).toBe('optional');
    expect(petra.pfad.map((u) => u.typ.id)).not.toContain('buergschaftserklaerung');
    expect(petra.naechster?.typ.id).not.toBe('buergschaftserklaerung');
    expect(rutschListe([petra], true).map((p) => p.typ)).not.toContain('buergschaftserklaerung');
    // Hochgeladen ist sie da, bleibt aber trotzdem aus „x von y“.
    const mit = personStand(person('petra'), 'buerge', dokumente, [linden3], HEUTE);
    expect(mit.unterlagen.find((u) => u.typ.id === 'buergschaftserklaerung')!.status).toBe('da');
    expect(mit.pfad.map((u) => u.typ.id)).not.toContain('buergschaftserklaerung');
  });
});

describe('Bonität bei Bürgen (DP49 Punkt 6, B3)', () => {
  it('der Satz im Kopf nennt den Wert der Bürgschaft, nach der Karte', () => {
    const typ = dokumenttyp('bonitaet')!;
    // PC205 (E363): immer mit Namen, für jede gewählte Form.
    expect(hilfeFuer(typ, 'buerge', 'weiblich', 'Petra')).toBe(
      'Die Auskunft für Vermieter. Bei Bürgen fragen viele Vermieter danach, denn eine Bürgschaft ist so viel wert, wie Petra zahlen kann.',
    );
    expect(hilfeFuer(typ, 'buerge', 'maennlich', 'Jonas')).toContain('wie Jonas zahlen kann.');
    expect(hilfeFuer(typ, 'buerge', 'neutral', 'Kim')).toContain('wie Kim zahlen kann.');
    expect(hilfeFuer(typ, 'buerge', 'weiblich', 'Petra')).not.toMatch(/Bürgin|der Bürge/);
    // Gegenprobe: Wer im Mietvertrag steht, bekommt den üblichen Satz.
    expect(hilfeFuer(typ, 'vertrag', 'weiblich', 'Lea')).toBe(typ.hilfe);
  });
});

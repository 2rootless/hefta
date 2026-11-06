import { describe, expect, it } from 'vitest';
import type { Person, Rolle } from './modell';
import { personStand } from './regelkatalog';
import { fertig, neuDazu, neuerRutsch, rutschListe, weiter, zaehlen } from './rutsch';

const HEUTE = new Date(2026, 10, 6);

function person(id: string, lebenssituation: Person['lebenssituation'] = 'angestellt'): Person {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    vorname: id,
    nachname: '',
    rufname: id,
    kontakt: { telefon: '', email: '' },
    lebenssituation,
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: null,
    abrechnungMeist: null,
  };
}

function stand(id: string, rolle: Rolle, lage: Person['lebenssituation'] = 'angestellt') {
  return personStand(person(id, lage), rolle, [], [], HEUTE);
}

describe('Rutsch', () => {
  it('Person für Person: Hauptmieter, Mitmieter, dann Bürgen; je Person in Katalog-Reihenfolge', () => {
    // Bürgin bewusst zuerst übergeben: Reihenfolge kommt aus der Rolle
    const liste = rutschListe(
      [stand('petra', 'buerge', 'rente'), stand('max', 'hauptmieter'), stand('lea', 'mitmieter')],
      true,
    );
    expect(liste.map((p) => `${p.personId}:${p.typ}`)).toEqual([
      'max:selbstauskunft',
      'max:gehaltsnachweis',
      'max:bonitaet',
      'lea:selbstauskunft',
      'lea:gehaltsnachweis',
      'lea:bonitaet',
      'petra:buergschaftserklaerung',
      'petra:selbstauskunft',
      'petra:rentenbescheid',
      'petra:bonitaet',
    ]);
  });

  it('lässt Formulare (Selbstauskunft) weg, solange sie nicht gebaut sind', () => {
    const liste = rutschListe([stand('max', 'hauptmieter')], false);
    expect(liste.map((p) => p.typ)).toEqual(['gehaltsnachweis', 'bonitaet']);
  });

  it('zählt hochgeladene und übersprungene Unterlagen und endet nach dem letzten Posten', () => {
    let r = neuerRutsch([stand('max', 'hauptmieter')], false);
    expect(fertig(r)).toBe(false);
    r = weiter(r, 'hochgeladen');
    r = weiter(r, 'uebersprungen');
    expect(fertig(r)).toBe(true);
    expect(zaehlen(r)).toEqual({ hochgeladen: 1, uebersprungen: 1 });
    expect(weiter(r, 'hochgeladen')).toBe(r);
  });
});

describe('neuDazu (Z4)', () => {
  it('nennt nur, was seit dem Start fällig wurde und nicht in der Liste steht', () => {
    const a = personStand(person('a'), 'hauptmieter', [], [], HEUTE);
    const stand = { liste: rutschListe([a], true).slice(0, 1), index: 1, ergebnisse: {} };
    const neu = neuDazu(stand, [a]);
    expect(neu.length).toBe(rutschListe([a], true).length - 1);
    expect(neu.map((p) => p.typ)).not.toContain(stand.liste[0]!.typ);
    expect(neuDazu(neuerRutsch([a], true), [a])).toEqual([]);
  });
});

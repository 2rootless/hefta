import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import de from '../i18n/de.json';
import { pdfSchriften, textJeSeite } from '../test/hilfen';
import { bogenPdfBauen } from '../pdf/bogenPdf';
import { bogenBloecke, bogenFarbe, leerePerson, personAusBogen, type BogenPerson } from './bogen';
import { VERGABE } from './personenfarben';
import { selbstauskunftBloecke } from './selbstauskunft';
import { telefonOffen } from './telefon';
import type { Person } from './modell';

// DP145 (PC212, Abschnitt 1): Befunde von Design am Bau, je mit Gegenprobe. Namen aus der Namensliste (W40).

const JETZT = '2026-11-26T10:00:00.000Z';
const JARNE: BogenPerson = {
  ...leerePerson('j'),
  vorname: 'Jarne',
  nachname: 'Ostendorp',
  telefon: '0171 3920011',
  beruf: 'Logistikplaner',
  arbeitgeber: 'Tidenwerk Logistik',
  netto: '2.800',
  insolvenz: 'nein',
  raeumungstitel: 'nein',
};
const HH = { erwachsene: 1, kinder: 0, haustiere: 'nein' as const, wbs: null, ort: 'Lüneburg' };
const zeile = (p: BogenPerson, id: string) =>
  bogenBloecke(p, HH, JETZT)
    .flatMap((b) => b.zeilen)
    .find((z) => z.id === id);
const wert = (p: BogenPerson, id: string) => {
  const z = zeile(p, id);
  return z && 'wert' in z ? z.wert : undefined;
};

describe('DP145', () => {
  it('B1 (W10): ein gefüllter Bogen ergibt im PDF Telefon, Beruf und Arbeitgeber, in beiden Wahlen', async () => {
    expect(wert(JARNE, 'kontakt')).toBe('0171 3920011');
    expect(wert(JARNE, 'beruf')).toBe('Logistikplaner');
    expect(wert(JARNE, 'arbeitgeber')).toBe('Tidenwerk Logistik');
    const zwei = { personen: [JARNE, { ...JARNE, id: 's', vorname: 'Selin' }], hh: HH };
    for (const pdf of ['eine', 'je'] as const) {
      const dateien = await bogenPdfBauen({ ...zwei, pdf }, pdfSchriften(), new Date(2026, 10, 26));
      const text = (await textJeSeite(dateien[0]!.bytes)).join(' ').replace(/\s+/g, ' ');
      for (const s of ['0171 3920011', 'Logistikplaner', 'Tidenwerk Logistik'])
        expect(text).toContain(s);
      // Nur die Anschrift ist leer; sie allein darf „keine Angabe“ sein.
      expect(text.match(/keine Angabe/g) ?? []).toHaveLength(dateien.length === 1 ? 2 : 1);
    }
  });

  it('Gegenprobe B1: Eine Nummer, die sich nicht prüfen lässt, steht im Bogen, wie sie eingetragen ist', () => {
    expect(wert({ ...JARNE, telefon: '12' }, 'kontakt')).toBe('12');
    // In der App bleibt sie ohne Prüfung draußen (DP77); das gilt weiter.
    const p = personAusBogen({ ...JARNE, telefon: '12' }, HH, JETZT);
    expect(
      selbstauskunftBloecke(
        p,
        'vertrag',
        { erwachsene: 1, kinder: 0 },
        { haustiere: 'nein', haustiereText: '', ort: '' },
        'will_wohnung',
        {},
      )
        .flatMap((b) => b.zeilen)
        .find((z) => z.id === 'kontakt'),
    ).toMatchObject({ wert: '' });
  });

  it('Gegenprobe B1: Mit Lebenslage gilt weiter K1, Beruf einer ersten Lage folgt dem Schalter', () => {
    const p: Person = {
      ...personAusBogen(JARNE, HH, JETZT),
      lebenssituation: 'angestellt',
      weitereLagen: [{ id: 'l2', situation: 'leistungsbezug' }],
      einkommenTrotzdem: false,
    } as Person;
    const zeilen = selbstauskunftBloecke(
      p,
      'vertrag',
      { erwachsene: 1, kinder: 0 },
      { haustiere: 'nein', haustiereText: '', ort: '' },
      'will_wohnung',
      {},
    ).flatMap((b) => b.zeilen);
    expect(zeilen.find((z) => z.id === 'beruf')).toMatchObject({ wert: '' });
  });

  it('B2: Übernehmen bringt eine eindeutig deutsche Nummer in die geprüfte Form; Gegenprobe: eine kaputte bleibt offen', () => {
    const k = personAusBogen(JARNE, HH, JETZT).kontakt;
    expect(k.telefonE164).toBe('+491713920011');
    expect(telefonOffen(k)).toBe(false);
    expect(telefonOffen(personAusBogen({ ...JARNE, telefon: '12' }, HH, JETZT).kontakt)).toBe(true);
  });

  it('B5: Der Bogen vergibt die Farben in der Reihenfolge der App; Gegenprobe: nicht die Nummern 1, 2, 3', () => {
    const farben: number[] = [];
    for (let i = 0; i < 3; i++) farben.push(i === 0 ? leerePerson('x').farbe : bogenFarbe(farben));
    expect(farben).toEqual(VERGABE.slice(0, 3));
    expect(farben).not.toEqual([1, 2, 3]);
    // Eine entfernte Person macht ihre Farbe wieder frei.
    expect(bogenFarbe([VERGABE[0]!, VERGABE[2]!])).toBe(VERGABE[1]);
  });

  it('B6: ein Satz je Angabe in beiden Hüllen; Gegenprobe: der Bogen hat keine eigenen Sätze mehr', () => {
    expect(de.angabeSatz.einziehen).toBe(
      'Alle, die einziehen, auch Kinder. Nach dem Familienstand fragt der Bogen nicht.',
    );
    expect(de.angabeSatz.haustiere).toBe(
      'Nur Tiere, für die es eine Erlaubnis braucht. Kleintiere wie Hamster oder Zierfische zählen nicht.',
    );
    const bogen = readFileSync('src/screens/SelbstauskunftBogen.svelte', 'utf8');
    const app = readFileSync('src/ui/SelbstauskunftAkkordeon.svelte', 'utf8');
    for (const k of ['einziehen', 'haustiere']) {
      expect(bogen, k).toContain(`t('angabeSatz.${k}')`);
      expect(app, k).toContain(`t('angabeSatz.${k}')`);
    }
    expect(Object.keys(de.bogen).filter((k) => /^satz(Einziehen|Haustiere)$/.test(k))).toEqual([]);
  });

  it('B4 (E379): kein „Ausweiskopie“ in der Oberfläche außer an alten Unterlagen und im Hinweis dazu', () => {
    const funde = (o: unknown, pfad = ''): string[] =>
      typeof o === 'string'
        ? /Ausweiskopie/.test(o)
          ? [pfad]
          : []
        : o && typeof o === 'object'
          ? Object.entries(o).flatMap(([k, v]) => funde(v, pfad ? `${pfad}.${k}` : k))
          : [];
    // Erlaubt: der einmalige Hinweis (DP145, F6), das Versprechen „Nie Ausweiskopie“ bei „Alles“ und der Satz, dass
    // Formulare danach nicht fragen dürfen (Übertragen). Keine dieser Stellen bietet sie an.
    const erlaubt = ['stoerung.nieInMappeTitel', 'mappe.modus.alles.text', 'uebertragen.hinweis'];
    expect(funde(de).filter((p) => !erlaubt.includes(p))).toEqual([]);
    // Gegenprobe: der alte Satz unter „Eigene Auswahl“ würde gefunden.
    const alt = structuredClone(de);
    alt.mappe.eigeneZeileUnter = 'Unterlage für Unterlage, auch Ausweiskopie';
    expect(funde(alt).filter((p) => !erlaubt.includes(p))).toEqual(['mappe.eigeneZeileUnter']);
  });

  it('F1, F6, DP143: Wortlaut', () => {
    expect(de.selbstauskunft.gruende).toBe('Gründe, warum das nicht wieder vorkommt (freiwillig)');
    expect(de.selbstauskunft.gruendeBeispiel).toBe('Etwa ein höheres Nettoeinkommen.');
    expect(de.stoerung.nieInMappeText.du).toBe(
      'Sie kommen in keine Mappe mehr. Was du abgelegt hast, bleibt gespeichert; an der Unterlage steht, warum.',
    );
    expect(JSON.stringify(de.angabeSatz.mietrueckstaende)).not.toContain('Orientierungshilfe');
  });
});

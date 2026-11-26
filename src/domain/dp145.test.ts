import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import de from '../i18n/de.json';
import { selbstauskunftBloecke } from './selbstauskunft';
import type { Person } from './modell';

// DP145 (PC212, Abschnitt 1): Befunde von Design, die nach E385 (PC214) in der App weiter gelten, je mit Gegenprobe.
// Namen aus der Namensliste (W40).

const JETZT = '2026-11-26T10:00:00.000Z';
const JARNE: Person = {
  id: 'j',
  createdAt: JETZT,
  updatedAt: JETZT,
  vorname: 'Jarne',
  nachname: 'Ostendorp',
  rufname: 'Jarne',
  kontakt: { telefon: '', email: '' },
  lebenssituation: null,
  beruf: 'Logistikplaner',
  arbeitgeber: 'Tidenwerk Logistik',
  nettoeinkommen: 2800,
  abrechnungMeist: null,
};

describe('DP145', () => {
  it('Ohne Lebenslage gilt, was in Beruf steht; mit Lebenslage weiter K1 (Gegenprobe)', () => {
    const ohneLage = selbstauskunftBloecke(
      JARNE,
      'vertrag',
      { erwachsene: 1, kinder: 0 },
      { haustiere: 'nein', haustiereText: '', ort: '' },
      'will_wohnung',
      {},
    ).flatMap((b) => b.zeilen);
    expect(ohneLage.find((z) => z.id === 'beruf')).toMatchObject({ wert: 'Logistikplaner' });
    const p: Person = {
      ...JARNE,
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

  it('B6: ein Satz je Angabe, aus der Feldliste der App (seit E385 gibt es keinen zweiten Bogen mehr)', () => {
    expect(de.angabeSatz.einziehen).toBe(
      'Alle, die einziehen, auch Kinder. Nach dem Familienstand fragt der Bogen nicht.',
    );
    expect(de.angabeSatz.haustiere).toBe(
      'Nur Tiere, für die es eine Erlaubnis braucht. Kleintiere wie Hamster oder Zierfische zählen nicht.',
    );
    const app = readFileSync('src/ui/SelbstauskunftAkkordeon.svelte', 'utf8');
    for (const k of ['einziehen', 'haustiere']) expect(app, k).toContain(`t('angabeSatz.${k}')`);
    // Gegenprobe: Die eigenen Sätze des Bogens gibt es nicht mehr.
    expect('bogen' in de).toBe(false);
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

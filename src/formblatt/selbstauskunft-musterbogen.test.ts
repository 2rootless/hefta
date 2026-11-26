import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Person } from '../domain/modell';
import {
  MUSTERBOGEN_REIHENFOLGE,
  einziehend,
  leereSelbstauskunft,
  selbstauskunftBloecke,
} from '../domain/selbstauskunft';

// PC207, 2: Der Satz „Fragen und Reihenfolge folgen dem Musterbogen“ steht nur, wenn er stimmt. Geprüft wird gegen den
// Musterbogen selbst (Anlage der Orientierungshilfe, Januar 2026, als Text in design/quellen/).
const QUELLE = 'design/quellen/dsk-musterbogen-v2.txt';

/** Woran jede Angabe im Musterbogen zu erkennen ist, in dessen Wortlaut. */
const IM_MUSTERBOGEN: Record<(typeof MUSTERBOGEN_REIHENFOLGE)[number], string> = {
  name: 'Name, Vorname:',
  anschrift: 'aktuelle postalische Anschrift',
  kontakt: 'Telefonnummer (Festnetz / mobil)',
  personenzahl: 'Wie viele Personen sollen in die Wohnung einziehen?',
  arbeitgeber: 'Derzeitige:r Arbeitgeber:in',
  beruf: 'Derzeit ausgeübter Beruf',
  nettoeinkommen: 'monatlichen Nettoeinkommens',
  haustiere: 'Sollen in der Wohnung Haustiere gehalten werden?',
  insolvenz: 'Insolvenzverfahren eröffnet',
  raeumungstitel: 'ein Räumungstitel hinsichtlich Ihres Wohnraums',
  rueckstand_monate:
    'für zwei aufeinanderfolgende Monate in der Höhe von mehr als einer Monatsmiete',
  rueckstand_mieten:
    'innerhalb eines Zeitraums von mehr als zwei Monaten in Höhe von mindestens zwei Monatsmieten',
  kuendigung: 'Wurde das letzte Mietverhältnis wegen einer tatsächlich vorliegenden, erheblichen',
  gruende: 'Gründe dafür vorzutragen',
};

/** Zeilen, die kein Feld des Musterbogens sind, aber dazugehören (Rolle bei Bürgen, die Bürgschaft, Teilbeträge). */
const DAZU = /^(rolle|einzug|erklaerung|quelle-\d+)$/;

const ZEIT = '2026-11-25T10:00:00.000Z';
const SELIN: Person = {
  id: 'p-selin',
  createdAt: ZEIT,
  updatedAt: ZEIT,
  vorname: 'Selin',
  nachname: 'Akgül',
  rufname: 'Selin',
  kontakt: {
    telefon: '',
    email: 'selin.akguel@example.com',
    anschrift: 'Lindenring 3, 20259 Hamburg',
  },
  lebenssituation: 'angestellt',
  beruf: 'Bauingenieurin',
  arbeitgeber: 'Seilerkoppel Ingenieure GmbH',
  nettoeinkommen: 3100,
  abrechnungMeist: null,
  weitereLagen: [
    { id: 'l2', situation: 'selbststaendig', beruf: 'Gutachten', nettoeinkommen: 300 },
  ],
  selbstauskunft: {
    ...leereSelbstauskunft(),
    insolvenz: 'nein',
    raeumungstitel: 'nein',
    rueckstandMonate: 'nein',
    rueckstandMieten: 'nein',
    kuendigung: 'ja',
    kuendigungWelche: 'Untervermietung ohne Erlaubnis',
    stellungnahme: 'Kommt nicht wieder vor.',
  },
};
const HH = { haustiere: 'ja' as const, haustiereText: 'eine Katze', ort: 'Hamburg' };

const reihenfolge = (rolle: 'vertrag' | 'buerge') =>
  selbstauskunftBloecke(
    SELIN,
    rolle,
    einziehend(2, { kinder: 1, weitereErwachsene: 0 }),
    HH,
    'zusage',
    {},
  )
    .flatMap((b) => b.zeilen)
    .map((z) => z.id);

/** Stehen die Felder in der Reihenfolge der Liste? Andere Zeilen nur, wenn sie dazugehören. */
function folgt(ids: string[], liste: readonly string[]): boolean {
  const imBogen = ids.filter((id) => !DAZU.test(id));
  if (imBogen.some((id) => !liste.includes(id))) return false;
  const stellen = imBogen.map((id) => liste.indexOf(id));
  return stellen.every((s, i) => i === 0 || s >= stellen[i - 1]!);
}

describe('PC207, 2: Selbstauskunft nach dem Musterbogen', () => {
  it.skipIf(!existsSync(QUELLE))('die Liste folgt dem Wortlaut des Musterbogens', () => {
    const text = readFileSync(QUELLE, 'utf-8').replace(/\s+/g, ' ');
    const stellen = MUSTERBOGEN_REIHENFOLGE.map((id) => {
      const stelle = text.indexOf(IM_MUSTERBOGEN[id]);
      expect(stelle, id).toBeGreaterThan(-1);
      return stelle;
    });
    expect(stellen).toEqual([...stellen].sort((a, b) => a - b));
  });

  it('der Bogen folgt der Liste, im Mietvertrag und bei Bürgen; keine Lebenslage', () => {
    const vertrag = reihenfolge('vertrag');
    expect(folgt(vertrag, MUSTERBOGEN_REIHENFOLGE)).toBe(true);
    expect(vertrag).toEqual(expect.arrayContaining([...MUSTERBOGEN_REIHENFOLGE]));
    expect(folgt(reihenfolge('buerge'), MUSTERBOGEN_REIHENFOLGE)).toBe(true);
    const texte = JSON.stringify(
      selbstauskunftBloecke(
        SELIN,
        'vertrag',
        einziehend(2, { kinder: 1, weitereErwachsene: 0 }),
        HH,
        'zusage',
        {},
      ),
    );
    expect(texte).not.toMatch(/Lebenslage/);
  });

  it('Gegenprobe: vertauschte Zeilen oder ein fremdes Feld fallen auf', () => {
    expect(folgt(['name', 'beruf', 'arbeitgeber'], MUSTERBOGEN_REIHENFOLGE)).toBe(false);
    expect(folgt(['name', 'familienstand'], MUSTERBOGEN_REIHENFOLGE)).toBe(false);
    expect(folgt(['name', 'rolle', 'anschrift'], MUSTERBOGEN_REIHENFOLGE)).toBe(true);
  });
});

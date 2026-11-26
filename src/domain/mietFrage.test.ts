import { describe, expect, it } from 'vitest';
import de from '../i18n/de.json';
import nachforderung from '../../data/nachforderung.de.json';
import { mietFrageOffen, zusageDa } from './mietFrage';
import { SELBSTAUSKUNFT_FELDER } from './selbstauskunft';

// PC65: Texte zu Mietrückständen (W32) und die Frage „später beantworten“.

function alleTexte(o: unknown, pfad = ''): [string, string][] {
  if (typeof o === 'string') return [[pfad, o]];
  if (o && typeof o === 'object')
    return Object.entries(o).flatMap(([k, v]) => alleTexte(v, pfad ? `${pfad}.${k}` : k));
  return [];
}

describe('Texte zu Mietrückständen (PC207, 2: drei Fragen wie im Musterbogen C.4 bis C.6)', () => {
  const pdf = (id: string) => SELBSTAUSKUNFT_FELDER.find((f) => f.id === id)!.pdfText;

  it('drei Felder im Regelkatalog, die frühere eine Frage gibt es nicht mehr', () => {
    expect(SELBSTAUSKUNFT_FELDER.map((f) => f.id)).toEqual(
      expect.arrayContaining(['rueckstand_monate', 'rueckstand_mieten', 'kuendigung']),
    );
    expect(SELBSTAUSKUNFT_FELDER.some((f) => f.id === 'mietrueckstaende')).toBe(false);
  });

  it('App, PDF und Vermieterseite meinen dasselbe, Frage für Frage', () => {
    const [v1, v2, v3] = nachforderung.fragen;
    // C.4: zwei Monate nacheinander, mehr als eine Monatsmiete
    for (const text of [de.selbstauskunft.rueckstandMonateDu, pdf('rueckstand_monate'), v1!]) {
      expect(text).toMatch(/zwei (Monate nacheinander|aufeinanderfolgende Monate)/);
      expect(text).toMatch(/mehr als einer? Monatsmiete/);
    }
    // C.5: über mehr als zwei Monate mindestens zwei Monatsmieten
    for (const text of [de.selbstauskunft.rueckstandMietenDu, pdf('rueckstand_mieten'), v2!]) {
      expect(text).toMatch(/(über|innerhalb von) mehr als zwei Monate/);
      expect(text).toMatch(/mindestens zwei Monatsmieten/);
    }
    // C.6: das letzte Mietverhältnis, erhebliche Verletzung des Mietvertrags
    for (const text of [de.selbstauskunft.kuendigungDu, pdf('kuendigung'), v3!]) {
      expect(text).toMatch(/letzte[ns]? Mietverhältnis/i);
      expect(text).toMatch(/erheblichen Verletzung des Mietvertrags/);
    }
    // Gegenprobe: C.4 und C.5 sind verschieden.
    expect(pdf('rueckstand_monate')).not.toMatch(/mindestens zwei Monatsmieten/);
  });

  it('Wortlaut: kein Satz an der Frage beginnt mit „Erst beantworten“, kein „Pflicht“ als Kennzeichen', () => {
    const texte = alleTexte(de);
    expect(texte.filter(([, s]) => /^Erst beantworten/.test(s)).map(([p]) => p)).toEqual([]);
    expect(de.selbstauskunft.teil.einkommenOffen).toBe(
      'Gehört zu fast jeder Bewerbung, netto im Monat',
    );
    // DP145, F1: ein Satz zur Gruppe, ohne Hinweis auf die Orientierungshilfe.
    expect(de.angabeSatz.mietrueckstaende).toEqual({
      ihr: 'Danach darf ein Vermieter erst kurz vor dem Vertrag fragen. Freiwillig könnt ihr es schon jetzt beantworten.',
      du: 'Danach darf ein Vermieter erst kurz vor dem Vertrag fragen. Freiwillig kannst du es schon jetzt beantworten.',
    });
    expect(Object.keys(de.selbstauskunft).filter((k) => k.startsWith('zusageHinweis'))).toEqual([]);
  });
});

describe('Frage offen nach der Zusage', () => {
  const zusage = [{ ereignisse: { ergebnis: { art: 'zusage' as const, am: '2026-11-16' } } }];
  const ohne = [{ ereignisse: { ergebnis: null } }];
  const drei = (w: 'ja' | 'nein' | null) =>
    ({
      selbstauskunft: { rueckstandMonate: w, rueckstandMieten: w, kuendigung: w },
    }) as never;
  const alt = (w: 'ja' | 'nein' | null) => ({ selbstauskunft: { mietrueckstaende: w } }) as never;

  it('erst nach einer Zusage, nur für Personen im Mietvertrag, solange eine der drei fehlt', () => {
    expect(zusageDa(zusage as never)).toBe(true);
    expect(mietFrageOffen(drei(null), 'vertrag', zusage as never)).toBe(true);
    expect(mietFrageOffen(drei(null), 'vertrag', ohne as never)).toBe(false);
    expect(mietFrageOffen(drei(null), 'buerge', zusage as never)).toBe(false);
    expect(mietFrageOffen(drei('nein'), 'vertrag', zusage as never)).toBe(false);
    expect(mietFrageOffen({}, 'vertrag', zusage as never)).toBe(true);
    const eineFehlt = {
      selbstauskunft: { rueckstandMonate: 'nein', rueckstandMieten: 'nein', kuendigung: null },
    } as never;
    expect(mietFrageOffen(eineFehlt, 'vertrag', zusage as never)).toBe(true);
  });

  it('Daten bis 2.2: ein Nein gilt für alle drei, ein Ja wird neu gefragt', () => {
    expect(mietFrageOffen(alt('nein'), 'vertrag', zusage as never)).toBe(false);
    expect(mietFrageOffen(alt('ja'), 'vertrag', zusage as never)).toBe(true);
    expect(mietFrageOffen(alt(null), 'vertrag', zusage as never)).toBe(true);
  });
});

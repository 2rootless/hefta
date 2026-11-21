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

describe('Texte zu Mietrückständen', () => {
  const pdf = SELBSTAUSKUNFT_FELDER.find((f) => f.id === 'mietrueckstaende')!.pdfText;

  it('PDF-Text: auch „über mehr als zwei Monate“ (die alte Fassung fehlte das)', () => {
    expect(pdf).toContain('über mehr als zwei Monate');
    // Gegenprobe: die alte Fassung wird rot.
    const alt =
      'Mietrückstände von mehr als einer Monatsmiete in zwei Monaten nacheinander oder von zwei Monatsmieten, oder Kündigung wegen Pflichtverletzung';
    expect(alt).not.toContain('über mehr als zwei Monate');
  });

  it('App, PDF und Vermieterseite meinen dasselbe: zwei Fälle mit denselben Grenzen', () => {
    const app = de.selbstauskunft.mietGemeint;
    const vermieter = nachforderung.fragen.slice(0, 2).join(' ');
    for (const text of [app, pdf, vermieter]) {
      // Fall 1: zwei Monate nacheinander, mehr als eine Monatsmiete
      expect(text).toMatch(/zwei (Monate nacheinander|aufeinanderfolgenden?( Monaten| Monate))/);
      expect(text).toMatch(/mehr als einer? Monatsmiete/);
      // Fall 2: über mehr als zwei Monate zusammen zwei Monatsmieten
      expect(text).toMatch(/(über|innerhalb von) mehr als zwei Monate/);
      expect(text).toMatch(/zwei Monatsmieten/);
    }
  });

  it('Wortlaut: kein Satz an der Frage beginnt mit „Erst beantworten“, kein „Pflicht“ als Kennzeichen', () => {
    const texte = alleTexte(de);
    expect(texte.filter(([, s]) => /^Erst beantworten/.test(s)).map(([p]) => p)).toEqual([]);
    expect(de.selbstauskunft.teil.einkommenOffen).toBe(
      'Gehört zu fast jeder Bewerbung, netto im Monat',
    );
    expect(de.selbstauskunft.zusageHinweisDu).toMatch(/^Nach der Orientierungshilfe/);
    expect(de.selbstauskunft.zusageHinweisDu).toMatch(
      /Freiwillig kannst du es schon jetzt beantworten\.$/,
    );
    expect(de.selbstauskunft.zusageHinweisIhr).toMatch(
      /Freiwillig könnt ihr es schon jetzt beantworten\.$/,
    );
  });
});

describe('Frage offen nach der Zusage', () => {
  const zusage = [{ ereignisse: { ergebnis: { art: 'zusage' as const, am: '2026-11-16' } } }];
  const ohne = [{ ereignisse: { ergebnis: null } }];
  const person = (antwort: 'ja' | 'nein' | null) => ({
    selbstauskunft: { mietrueckstaende: antwort },
  });

  it('erst nach einer Zusage, nur für Personen im Mietvertrag, nur ohne Antwort', () => {
    expect(zusageDa(zusage as never)).toBe(true);
    expect(mietFrageOffen(person(null), 'hauptmieter', zusage as never)).toBe(true);
    expect(mietFrageOffen(person(null), 'hauptmieter', ohne as never)).toBe(false);
    expect(mietFrageOffen(person(null), 'buerge', zusage as never)).toBe(false);
    expect(mietFrageOffen(person('nein'), 'mitmieter', zusage as never)).toBe(false);
    expect(mietFrageOffen({}, 'mitmieter', zusage as never)).toBe(true);
  });
});

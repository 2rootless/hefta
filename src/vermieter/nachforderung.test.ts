import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANG, M1, M2, M4, M4z, M6, type Probe } from '../../tests/e2e/vermieter-hilfe';
import type { HeftaAnhang } from '../pdf/anhang';
import { MAIL_LINK_GRENZE, mailLink, nachforderung } from './nachforderung';

const anhang = (p: Probe) => p.anhang as unknown as HeftaAnhang;

// Die Mails aus den Testdaten des Designs: design/bildschirme/vermieter/nachforderung-mails.md.
const VORBILD = readFileSync(
  'design/bildschirme/vermieter/nachforderung-mails.md',
  'utf8',
).replaceAll('\r', '');
function vorbild(ueberschrift: string): { betreff: string; text: string } {
  const teil = VORBILD.split('\n## ').find((t) => t.startsWith(ueberschrift));
  if (!teil) throw new Error(`Kein Vorbild: ${ueberschrift}`);
  return {
    betreff: /Betreff: (.*)\n/.exec(teil)![1]!,
    text: /```\n([\s\S]*?)\n```/.exec(teil)![1]!,
  };
}

describe('Nachforderung: wie im Entwurf', () => {
  it.each([
    ['M1', M1],
    ['M2', M2],
    ['M4', M4],
    ['M4z', M4z],
    ['LANG', LANG],
    ['M6', M6],
  ] as const)('%s', (name, probe) => {
    const m = nachforderung(anhang(probe));
    const v = vorbild(name);
    expect(m.text).toBe(v.text);
    expect(m.betreff).toBe(v.betreff);
  });
});

describe('VS15', () => {
  const alle = [M1, M2, M4, M4z, M6, LANG].map((p) => nachforderung(anhang(p)));

  it('Die Zusage steht vor dem, was noch fehlt', () => {
    for (const m of alle) {
      const zusage = m.text.indexOf('entschieden');
      expect(zusage).toBeGreaterThan(0);
      const fehlt = m.text.indexOf('brauchen wir noch');
      if (fehlt >= 0) expect(zusage).toBeLessThan(fehlt);
    }
  });

  it('Ausweiskopie, Datenkopie und Mietschuldenfreiheit nur als „nicht nötig“', () => {
    for (const m of alle) {
      const ohne = m.text
        .replace(/Nicht nötig sind[^\n]*/, '')
        .replace('nicht die Datenkopie nach Art. 15 DSGVO', '');
      expect(ohne).not.toMatch(/Ausweis|Datenkopie|Mietschuldenfreiheit/);
    }
  });

  it('So viele „Von …“-Namen wie Posten fehlen', () => {
    for (const m of alle) {
      const namen = [...m.text.matchAll(/^– Von (.*?): /gm)].flatMap(([, n]) =>
        n!.split(/, | und /),
      );
      expect(namen.length).toBe(m.posten);
    }
  });

  it('Die drei Fragen stehen, außer die Mappe ist für den Vertrag zusammengestellt', () => {
    for (const m of alle) {
      expect(m.text.includes('drei Fragen des Musterbogens')).toBe(m.ziel !== 'zusage');
      if (m.ziel !== 'zusage') {
        expect(m.text).toContain('tatsächlich vorliegenden, erheblichen Verletzung');
        expect(m.text).toContain('rechtskräftig festgestellt');
      }
    }
    expect(nachforderung(anhang(M4z)).ziel).toBe('zusage');
  });

  it('Der Absender steht am Ende, und nichts anderes bleibt als Platzhalter', () => {
    for (const m of alle) {
      expect(m.text.endsWith('[Ihr Name]')).toBe(true);
      expect(`${m.betreff}\n${m.text}`).not.toMatch(/\{\w+\}/);
    }
  });

  it('Einkommensnachweis verlangt: mit dem Hinweis zum Schwärzen', () => {
    const m = nachforderung(anhang(M4));
    expect(m.text).toContain('Auf Einkommensnachweisen dürfen nicht erforderliche Angaben');
    expect(nachforderung(anhang(M2)).text).not.toContain('Schwärz');
  });
});

describe('Mail-Link', () => {
  it('ohne Empfänger und sicher kodiert', () => {
    const l = mailLink('Wohnung & mehr', 'Zeile 1\nZeile 2');
    expect(l).toEqual({
      href: 'mailto:?subject=Wohnung%20%26%20mehr&body=Zeile%201%0AZeile%202',
      nurBetreff: false,
    });
  });

  it('Wird er zu lang, öffnet er nur den Betreff', () => {
    const lang = mailLink('Betreff', 'x'.repeat(MAIL_LINK_GRENZE));
    expect(lang.nurBetreff).toBe(true);
    expect(lang.href).toBe('mailto:?subject=Betreff');
  });
});

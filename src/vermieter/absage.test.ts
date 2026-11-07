import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANG, M1, M2, M4, M6, type Probe } from '../../tests/e2e/vermieter-hilfe';
import type { HeftaAnhang } from '../pdf/anhang';
import { absage, absageBefunde } from './absage';

const anhang = (p: Probe) => p.anhang as unknown as HeftaAnhang;

// Die Mails aus den Testdaten des Designs: design/bildschirme/vermieter/absage-mails.md.
const VORBILD = readFileSync('design/bildschirme/vermieter/absage-mails.md', 'utf8').replaceAll(
  '\r',
  '',
);
function vorbild(ueberschrift: string): { betreff: string; text: string } {
  const teil = VORBILD.split('\n## ').find((t) => t.startsWith(ueberschrift));
  if (!teil) throw new Error(`Kein Vorbild: ${ueberschrift}`);
  return {
    betreff: /Betreff: (.*)\n/.exec(teil)![1]!,
    text: /```\n([\s\S]*?)\n```/.exec(teil)![1]!,
  };
}

describe('Absage: wie im Entwurf (VS10)', () => {
  it.each([
    ['M1 Mustermann, schon gelöscht', M1, true],
    ['M2 Kovalenko, lösche ich später', M2, false],
    ['LANG Müller-Lüdenscheidt', LANG, true],
  ] as const)('%s', (name, probe, geloescht) => {
    const m = absage(anhang(probe), geloescht);
    const v = vorbild(name);
    expect(m.text).toBe(v.text);
    expect(m.betreff).toBe(v.betreff);
  });

  it('„wie Sie es sich gewünscht haben“ nur, wenn die Mappe eine Bitte trägt', () => {
    expect(anhang(M2).loeschwunsch).toBeUndefined();
    expect(absage(anhang(M2), true).text).toContain('Wir haben Ihre Unterlagen gelöscht. Haben');
    expect(absage(anhang(M1), true).text).toContain('wie Sie es sich gewünscht haben');
    expect(absage(anhang(M1), false).text).not.toContain('gewünscht');
  });

  it('Anrede nur an die Personen im Vertrag, nicht an Bürgen', () => {
    const text = absage(anhang(M1), true).text;
    expect(text.split('\n')[0]).toBe('Guten Tag Max Mustermann und Lea Mustermann,');
    expect(text).not.toContain('Petra');
  });

  it('Ohne Wohnung in der Lesehilfe: kein doppeltes „die Wohnung“', () => {
    const a = anhang(M1);
    const ohne: HeftaAnhang = { ...a, bewerbung: { ...a.bewerbung, wohnung: null } };
    const m = absage(ohne, true);
    expect(m.text).toContain('\ndie Wohnung ist vergeben.');
    expect(m.betreff).toBe('Ihre Bewerbung um die Wohnung: Absage');
  });
});

describe('VS16', () => {
  const alle = [M1, M2, M4, M6, LANG].flatMap((p) => [
    absage(anhang(p), true),
    absage(anhang(p), false),
  ]);

  it('Jede Absage besteht: vergeben, was mit den Unterlagen geschieht, kein Grund, Absender', () => {
    for (const m of alle) expect(absageBefunde(m.text)).toEqual([]);
  });

  it('Die Prüfung schlägt bei ihrem Fehler an', () => {
    const gut = absage(anhang(M1), true).text;
    expect(absageBefunde(gut.replace('vergeben', 'weg'))).toContain('VS16-kern');
    expect(
      absageBefunde(gut.replace('Vielen Dank', 'Ihr Einkommen reichte nicht. Vielen Dank')),
    ).toContain('VS16-grund:Einkommen');
    expect(absageBefunde(gut.replace('ist vergeben', 'ist vergeben, weil'))).toContain(
      'VS16-grund:weil',
    );
    expect(absageBefunde(gut.replace('ist vergeben', 'ist an andere Bewerber vergeben'))).toContain(
      'VS16-grund:andere Bewerber',
    );
    expect(absageBefunde(gut.replace('[Ihr Name]', ''))).toContain('VS16-absender');
    // „Bewerbung“ enthält kein „Grund“-Wort: Die Prüfung sucht ganze Wörter.
    expect(absageBefunde(gut)).toEqual([]);
  });
});

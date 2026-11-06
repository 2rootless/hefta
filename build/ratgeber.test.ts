import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RATGEBER, type Stimme } from '../src/domain/ratgeber';
import {
  quelleNormal,
  RATGEBER_ORDNER,
  RATGEBER_PFAD,
  ratgeberBefunde,
  ratgeberHtml,
} from './ratgeber';

// RG1 bis RG6 (design/ratgeber.md) als Prüfung im Produkt: Seit Entscheidung W trägt diese Regel das Risiko.
// Darum stehen die Quellen als Text im Repository, und jede Prüfung ist auch gegen ihren Fehler getestet.

// Im öffentlichen Repository liegen die Texte der Quellen nicht bei: Dann entfällt nur die Prüfung der Zitate.
const QUELLEN_DA = existsSync('design/quellen');
const quellen = QUELLEN_DA
  ? RATGEBER.quellen
      .map((q) => quelleNormal(readFileSync(`design/quellen/${q.datei}`, 'utf8')))
      .join(' ')
  : null;
const STIMMEN: Stimme[] = ['m', 'v'];

describe.each(STIMMEN)('Ratgeber, Fassung %s', (stimme) => {
  const html = ratgeberHtml(stimme);

  it('besteht alle Prüfungen', () => {
    expect(ratgeberBefunde(html, stimme, quellen)).toEqual([]);
  });

  it('hat keinen Rest eines Platzhalters', () => {
    expect(html).not.toContain('{app}');
  });

  it('ist noch nicht für Suchmaschinen freigegeben', () => {
    expect(html).toContain('noindex');
  });
});

describe('Die Prüfungen schlagen an', () => {
  const html = ratgeberHtml('m');
  const mit = (alt: string, neu: string) => {
    expect(html).toContain(alt);
    return ratgeberBefunde(html.replace(alt, neu), 'm', quellen);
  };

  it('RG1: Aussage ohne Quelle', () => {
    expect(
      ratgeberBefunde(
        html.replace('<h1', '<p>Vermieter dürfen das nicht fragen.</p><h1'),
        'm',
        quellen,
      ).join(),
    ).toContain('RG1-ohne-quelle');
  });

  it('RG2: die falsche Anrede', () => {
    expect(mit('Du kannst das Feld', 'Wenn Sie wollen, das Feld').join()).toContain('RG2');
    expect(
      ratgeberBefunde(
        ratgeberHtml('v').replace('Wann löschen', 'Wann du löschst'),
        'v',
        quellen,
      ).join(),
    ).toContain('RG2');
  });

  it('RG3: ein Schritt oder ein Eintrag fehlt', () => {
    expect(mit('class="rg-step sec" aria-label="Schritt 3"', 'class="x"').join()).toContain(
      'RG3-schritte',
    );
    expect(mit('<li><div><b>Ausweiskopie', '<div><b>Ausweiskopie').join()).toContain('RG3-liste');
  });

  it('RG4: ein Betrag', () => {
    expect(mit('Kostenlos, ohne Konto', 'Für 30 Euro, ohne Konto').join()).toContain('RG4');
  });

  it('RG5: eine Fundstelle führt woandershin', () => {
    expect(
      ratgeberBefunde(
        html.replace('datenschutzkonferenz-online.de', 'example.org'),
        'm',
        quellen,
      ).join(),
    ).toContain('RG5');
  });

  it.skipIf(!QUELLEN_DA)('RG6: ein Zitat, das nicht in den Quellen steht', () => {
    expect(mit('„nicht das richtige Mittel“', '„ein völlig falsches Mittel“').join()).toContain(
      'RG6',
    );
  });

  it('Der Satz „keine Rechtsberatung“ und „kein Skript“', () => {
    expect(mit('Ein Hinweis, keine Rechtsberatung', 'Ein Hinweis').join()).toContain('RG-hinweis');
    expect(mit('<main', '<script></script><main').join()).toContain('RG-statisch');
  });
});

describe('Einbindung', () => {
  it('Der Service Worker der App lässt die Seite in Ruhe', () => {
    const sw = readFileSync('src/sw/sw.js', 'utf8');
    expect(sw).toContain(`/${RATGEBER_PFAD.m}`);
    expect(sw).toContain(`/${RATGEBER_ORDNER}/`);
  });

  it.skipIf(!QUELLEN_DA)('Die Quellen liegen vollständig vor', () => {
    const da = readdirSync('design/quellen');
    for (const q of RATGEBER.quellen) expect(da).toContain(q.datei);
  });

  it('Jede Fundstelle nennt einen Abschnitt, den es gibt', () => {
    const alle = [
      ...RATGEBER.schritte.flatMap((s) => [
        ...s.vor.map((v) => v.fund),
        ...(s.nochNicht ? [s.nochNicht.fund] : []),
      ]),
      ...RATGEBER.nie.map((n) => n.fund),
    ];
    for (const f of alle)
      expect(f).toMatch(/^(Musterbogen( [A-C]|, Hinweis)?|Einleitung(, [A-D]\.\d)?|[A-D](\.\d)?)$/);
  });
});

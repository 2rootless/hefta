import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { M1, M2, M4, type Probe } from '../../tests/e2e/vermieter-hilfe';
import { anhangLesen, type HeftaAnhang } from '../pdf/anhang';
import { absage } from '../vermieter/absage';
import { mailLink as vermieterMailLink, nachforderung } from '../vermieter/nachforderung';
import { anschreibenText, loeschbitteText, nachfassText } from './bewerben';
import { mailLink } from './nachricht';

// wunsch-W14 (Fassung 20, PC87): Im Text einer Mail aus Hefta steht kein HTML. Zeilenumbrüche gehen nur als Text
// hinaus: im Mail-Link als %0D%0A (RFC 6068), beim Kopieren und Teilen als echter Umbruch; ein Absatz ist eine
// Leerzeile. Das gilt für jede Mail, die Hefta baut: in der App (Anschreiben, Löschbitte, Nachfrage) und auf der
// Vermieterseite (Absagen, Unterlagen anfordern).

/** Stellen im Mail-Link, an denen ein Umbruch nicht als CRLF kodiert ist (wie in der App, hier eigen). */
function blankeUmbrueche(link: string): number {
  const body = link.split('&body=')[1] ?? '';
  return (body.match(/(?<!%0D)%0A/gi) ?? []).length + (body.match(/%0D(?!%0A)/gi) ?? []).length;
}

/** Was im Text einer Mail nach HTML aussieht: Tags wie <br> oder <p>, Entitäten wie &nbsp; oder &#160;. */
export function htmlImMailtext(text: string): string[] {
  return text.match(/<\/?[a-z][a-z0-9]*\b[^<>]*>|&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi) ?? [];
}

const heute = new Date(2026, 10, 17);
const auftrag = {
  wir: true,
  anbieter: 'Frau Hansen',
  strasse: 'Lindenring 3',
  beworbenAm: '2026-11-02',
  namen: ['Max Mustermann', 'Lea Mustermann'],
  heute,
};
// Die Testdaten stehen in Fassung 1 (tests/e2e/vermieter-hilfe.ts) und gehen über lesen(), wie auf der Vermieterseite.
const anhang = (p: Probe) => anhangLesen(JSON.stringify(p.anhang)) as HeftaAnhang;

/** Alle Mails, die Hefta baut, mit Musterdaten; je Name Betreff und Text. */
function alleMails(): [string, { betreff: string; text: string }][] {
  const anschreiben = (weg: string) => {
    const a = anschreibenText({
      wir: true,
      anbieter: 'Frau Hansen',
      strasse: 'Lindenring 3',
      einzug: '2027-01-01',
      heute,
      weg,
    } as unknown as Parameters<typeof anschreibenText>[0]);
    return { betreff: 'Bewerbung', text: `${a.anrede}\n\n${a.text}` };
  };
  return [
    ['Anschreiben, Mail', anschreiben('mail')],
    ['Anschreiben, Portal', anschreiben('portal')],
    ['Löschbitte', loeschbitteText(auftrag)],
    ['Nachfrage', nachfassText(auftrag)],
    ['Absage, schon gelöscht', absage(anhang(M1), true)],
    ['Absage, später', absage(anhang(M2), false)],
    ['Unterlagen anfordern', nachforderung(anhang(M4))],
  ];
}

describe('wunsch-W14: kein HTML im Text einer Mail, Absätze als Leerzeile', () => {
  it('jede Mail aus App und Vermieterseite ist reiner Text mit Absätzen', () => {
    for (const [name, mail] of alleMails()) {
      expect(htmlImMailtext(mail.text), name).toEqual([]);
      expect(htmlImMailtext(mail.betreff), name).toEqual([]);
      expect(mail.text, name).toMatch(/\n\n/);
    }
  });

  it('Mail-Links von App und Vermieterseite: Umbrüche nur als %0D%0A, kein HTML', () => {
    for (const [name, mail] of alleMails()) {
      for (const link of [
        mailLink(null, mail.betreff, mail.text),
        vermieterMailLink(mail.betreff, mail.text).href,
      ]) {
        expect(blankeUmbrueche(link), name).toBe(0);
        // Eine sehr lange Mail trägt im Link nur den Betreff (MAIL_LINK_GRENZE); dann gibt es keine Absätze.
        if (link.includes('&body=')) expect(link, name).toContain('%0D%0A%0D%0A');
        expect(htmlImMailtext(decodeURIComponent(link)), name).toEqual([]);
      }
    }
  });

  it('Teilen in der App: Gmail bekommt denselben reinen Text wie jede App (PC87)', () => {
    // Die HTML-Fassung für Gmail (PC64, Punkt 2) zeigte Gmail am iPhone als „<br>“.
    const senden = readFileSync('src/ui/bewerbenSenden.ts', 'utf8');
    expect(senden).not.toMatch(/\bhtml\s*:/);
    expect(senden).not.toMatch(/gmailHtml/);
    const swift = readFileSync('ios/App/App/HeftaNativPlugin.swift', 'utf8');
    expect(swift).not.toMatch(/return html\b/);
    expect(swift).not.toMatch(/\bhtml\b/);
  });

  it('Gegenprobe: <br>, <p>, &nbsp; und &#160; im Text einer Mail werden erkannt', () => {
    expect(htmlImMailtext('Guten Tag,<br>wir')).toEqual(['<br>']);
    expect(htmlImMailtext('<p>Absatz</p>')).toEqual(['<p>', '</p>']);
    expect(htmlImMailtext('Lindenring&nbsp;3 und 3&#160;OG')).toEqual(['&nbsp;', '&#160;']);
    // Kein Fehlalarm bei Text, der nur so aussieht: „Miete < 1.000 €“ oder „Max & Lea“.
    expect(htmlImMailtext('Miete < 1.000 € & Nebenkosten > 200 €')).toEqual([]);
    // Und der Mail-Link mit blankem %0A fällt auf.
    expect(blankeUmbrueche(`mailto:?subject=x&body=${encodeURIComponent('a\n\nb')}`)).toBe(2);
  });
});

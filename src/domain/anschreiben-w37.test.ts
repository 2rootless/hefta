import { describe, expect, it } from 'vitest';
import pools from '../../data/satzpools.de.json';
import {
  anschreibenText,
  angabeZeile,
  betreffWohnung,
  bewerbungsText,
  nachfassText,
  type AnschreibenAuftrag,
  type BewerbungsWeg,
} from './bewerben';

// wunsch-W37 (E190, E193; DP68 Teil C, Endfassung PC94): Das Anschreiben wechselt seinen Rahmen je Heft, der Kern
// bleibt wörtlich. Geprüft wird jede Verbindung der Bausteine für vier Datensätze wie in DP68 (D1 bis D4), über
// alle drei Wege, mit und ohne Inserat. Adressen nur aus den Musteradressen (W7).

const HEUTE = new Date(2026, 10, 18);

interface Datensatz {
  wir: boolean;
  anbieter: string | null;
  strasse: string;
  ort: string;
  einzug: string;
  angaben: { label: string; wert: string }[];
  name: string;
  telefon: string;
  mail: string;
}

const D: Record<string, Datensatz> = {
  'D1 Musterhaushalt': {
    wir: true,
    anbieter: null,
    strasse: '',
    ort: '',
    einzug: '',
    angaben: [
      {
        label: 'Wer einzieht',
        wert: 'Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.',
      },
      { label: 'Haustiere', wert: 'keine' },
    ],
    name: 'Max Mustermann',
    telefon: '0171 3920001',
    mail: 'max.mustermann@example.com',
  },
  'D2 eine Person': {
    wir: false,
    anbieter: 'Frau Beispiel',
    strasse: 'Musterweg 7',
    ort: '',
    einzug: '2027-02-01',
    angaben: [{ label: 'Wer einzieht', wert: 'Eine Person im Mietvertrag.' }],
    name: 'Jonas Muster',
    telefon: '0171 3920002',
    mail: 'jonas.muster@example.com',
  },
  'D3 Familie': {
    wir: true,
    anbieter: 'Herr Beispiel',
    strasse: 'Beispielstraße 1',
    ort: '',
    einzug: '2027-03-01',
    angaben: [
      { label: 'Wer einzieht', wert: 'Zwei im Mietvertrag, zwei Kinder ziehen mit ein.' },
      { label: 'Haustiere', wert: 'eine Katze' },
    ],
    name: 'Erika Musterfrau',
    telefon: '0171 3920003',
    mail: 'erika.musterfrau@example.com',
  },
  'D4 Paar, nur Ort': {
    wir: true,
    anbieter: null,
    strasse: '',
    ort: 'Musterstadt-Nord',
    einzug: '',
    angaben: [{ label: 'Wer einzieht', wert: 'Zwei im Mietvertrag.' }],
    name: 'Paul Beispiel',
    telefon: '0171 3920004',
    mail: 'paul.beispiel@example.com',
  },
};

const WEGE: BewerbungsWeg[] = ['mail', 'portal', 'website'];
const B = pools.anschreiben.bausteine;
const KERN = pools.anschreiben.kern;

function auftrag(d: Datensatz, weg: BewerbungsWeg, extra: Partial<AnschreibenAuftrag> = {}) {
  return {
    wir: d.wir,
    anbieter: d.anbieter,
    strasse: d.strasse,
    einzug: d.einzug,
    heute: HEUTE,
    weg,
    ...extra,
  };
}

function brief(d: Datensatz, weg: BewerbungsWeg, extra: Partial<AnschreibenAuftrag> = {}): string {
  const a = anschreibenText(auftrag(d, weg, extra));
  return bewerbungsText({
    ...a,
    angaben: d.angaben,
    name: d.name,
    telefon: d.telefon,
    mail: d.mail,
  });
}

/** Verstöße eines ganzen Anschreibens gegen DP68 (Kern, Lücken, Gruß zur Anrede, Weg) und W14. */
function verstoesse(text: string, d: Datensatz, weg: BewerbungsWeg, inserat: boolean): string[] {
  const f: string[] = [];
  const form = (x: { wir: string; ich: string }) => (d.wir ? x.wir : x.ich);
  const mappe = form(weg === 'mail' ? KERN.mappe.mail : KERN.mappe.portal_und_website);
  if (text.split(mappe).length !== 2) f.push('Satz zur Mappe nicht genau einmal wörtlich');
  for (const a of d.angaben)
    if (!text.includes(`\n${angabeZeile(a)}\n`)) f.push(`Angabe fehlt: ${a.label}`);
  // 2.1.1 (PC191): Telefon und Mail je in einer eigenen Zeile.
  if (!text.endsWith(`\n${d.name}\n${d.telefon}\n${d.mail}`))
    f.push('Name und Kontakt nicht am Ende');
  if (/[{}]/.test(text)) f.push('Platzhalter offen');
  if (/ {2}| [,.]|\.\.|\n /.test(text)) f.push('Lücke');
  if (weg !== 'mail' && text.includes('liegt bei')) f.push('„liegt bei“ ohne Anhang');
  if ((text.match(/\bgern\b/g) ?? []).length > 1) f.push('„gern“ zweimal');
  if (!inserat && text.includes('Inserat gesehen')) f.push('Inserat ohne Inserat');
  const anrede = text.split('\n')[0]!;
  const zeilen = text.split('\n');
  const gruss = zeilen[zeilen.lastIndexOf(d.name) - 1]!;
  const passend =
    pools.anschreiben.gruss_zur_anrede[
      anrede.startsWith('Sehr geehrte') ? 'Sehr geehrte …' : 'Guten Tag …'
    ];
  if (!passend.includes(gruss)) f.push(`Gruß „${gruss}“ passt nicht zu „${anrede}“`);
  // W14: reiner Text, Absätze als Leerzeile.
  if (/<\/?[a-z][a-z0-9]*\b[^<>]*>|&(?:[a-z]+|#\d+);/i.test(text)) f.push('HTML im Text');
  if (!text.includes('\n\n')) f.push('keine Absätze');
  return f;
}

describe('wunsch-W37: Anschreiben aus Bausteinen', () => {
  it('ohne Kennung des Hefts die Fassung von Release 2.0, Zeichen für Zeichen', () => {
    expect(brief(D['D3 Familie']!, 'mail')).toBe(
      [
        'Sehr geehrter Herr Beispiel,',
        '',
        'wir möchten uns um die Wohnung in der Beispielstraße 1 bewerben. Wir können zum 1. März 2027 einziehen. Unsere Mappe mit den üblichen Unterlagen liegt bei.',
        '',
        'Wer einzieht: Zwei im Mietvertrag, zwei Kinder ziehen mit ein.',
        'Haustiere: eine Katze.',
        '',
        'Mit freundlichen Grüßen',
        'Erika Musterfrau',
        // 2.1.1 (PC191): Telefon und Mail je in einer eigenen Zeile.
        '0171 3920003',
        'erika.musterfrau@example.com',
      ].join('\n'),
    );
  });

  it('jede Verbindung je Datensatz, Weg und Inserat: Kern wörtlich, keine Lücke, Gruß passt, W14, Länge', () => {
    let geprueft = 0;
    for (const [name, d] of Object.entries(D))
      for (const weg of WEGE) {
        const heute = brief(d, weg).length;
        for (const inserat of [true, false]) {
          const einstiege = B.einstieg.filter((e) => inserat || !('nur_wenn' in e)).length;
          for (let anrede = 0; anrede < 2; anrede++)
            for (let einstieg = 0; einstieg < einstiege; einstieg++)
              for (let einzug = 0; einzug < (d.einzug ? B.einzug.length : 1); einzug++)
                for (let schluss = 0; schluss < B.schluss.length; schluss++)
                  for (let gruss = 0; gruss < 3; gruss++) {
                    const nummern = { anrede, einstieg, einzug, schluss, gruss };
                    const text = brief(d, weg, { inserat, nummern });
                    const f = verstoesse(text, d, weg, inserat);
                    if (f.length)
                      expect(f, `${name}, ${weg}, ${JSON.stringify(nummern)}\n${text}`).toEqual([]);
                    // Länge im Portal: höchstens ein Fünftel länger als heute (DP68, Teil C, Abschnitt 4).
                    if (weg !== 'mail')
                      expect(text.length / heute, `${name} ${weg}`).toBeLessThanOrEqual(1.2);
                    geprueft++;
                  }
        }
      }
    expect(geprueft).toBeGreaterThan(10_000);
  });

  it('Kennung des Hefts: gleich bleibt gleich; „Andere Fassung“ zählt jeden Baustein weiter', () => {
    const d = D['D3 Familie']!;
    const a = (versatz: number, heftId = 'heft-1') =>
      anschreibenText(auftrag(d, 'mail', { heftId, versatz, inserat: true }));
    expect(a(0)).toEqual(a(0));
    const vorher = a(0);
    const nachher = a(1);
    expect(nachher.anrede).not.toBe(vorher.anrede);
    expect(nachher.text).not.toBe(vorher.text);
    expect(nachher.schluss).not.toBe(vorher.schluss);
    // Der Kern bleibt in jeder Fassung.
    for (let v = 0; v < 12; v++) expect(a(v).text).toContain(KERN.mappe.mail.wir);
    // Verschiedene Hefte bekommen nicht alle dieselbe Fassung.
    const fassungen = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => JSON.stringify(a(0, id))));
    expect(fassungen.size).toBeGreaterThan(1);
  });

  it('Betreff (PD101 U2): Straße wie im Heft, sonst „in“ und der Ort, sonst nichts', () => {
    expect(betreffWohnung('Beispielstraße 1', 'Musterstadt-Nord')).toBe('Beispielstraße 1');
    expect(betreffWohnung('', 'Musterstadt-Nord')).toBe('in Musterstadt-Nord');
    expect(betreffWohnung('12345 Musterstadt-Nord', '')).toBe('in Musterstadt-Nord');
    expect(betreffWohnung('', '')).toBe('');
    const nachfrage = (strasse: string, ort: string) =>
      nachfassText({
        wir: true,
        anbieter: null,
        strasse,
        ort,
        beworbenAm: null,
        namen: [],
        heute: HEUTE,
      }).betreff;
    expect(nachfrage('Beispielstraße 1', '')).toBe('Nachfrage zur Wohnung Beispielstraße 1');
    expect(nachfrage('', 'Musterstadt-Nord')).toBe('Nachfrage zur Wohnung in Musterstadt-Nord');
    expect(nachfrage('', '')).toBe('Nachfrage zur Wohnung');
    // Im Brief selbst bleibt der Ort weg (DP68): Eine Zeile nur mit Postleitzahl und Ort ist keine Straße.
    const nurOrt = anschreibenText(
      auftrag({ ...D['D4 Paar, nur Ort']!, strasse: '12345 Musterstadt' }, 'mail'),
    );
    expect(nurOrt.text).toContain('um die Wohnung bewerben');
    expect(nurOrt.text).not.toContain('Musterstadt');
  });

  it('Gegenproben: geänderter Kern, „liegt bei“ im Portal, Lücke, Angabe ohne Punkt, falscher Gruß, „gern“ zweimal', () => {
    const d = D['D3 Familie']!;
    const gut = brief(d, 'portal', { inserat: true });
    expect(verstoesse(gut, d, 'portal', true)).toEqual([]);
    const kern = KERN.mappe.portal_und_website.wir;
    expect(
      verstoesse(gut.replace(kern, kern.replace('üblichen', 'wichtigen')), d, 'portal', true),
    ).toContain('Satz zur Mappe nicht genau einmal wörtlich');
    expect(
      verstoesse(`${gut.replace(kern, `${kern} Sie liegt bei.`)}`, d, 'portal', true),
    ).toContain('„liegt bei“ ohne Anhang');
    expect(
      verstoesse(gut.replace('um die Wohnung', 'um die  Wohnung'), d, 'portal', true),
    ).toContain('Lücke');
    expect(
      verstoesse(gut.replace('Haustiere: eine Katze.', 'Haustiere: eine Katze'), d, 'portal', true),
    ).toContain('Angabe fehlt: Haustiere');
    expect(
      verstoesse(gut.replace('Mit freundlichen Grüßen', 'Viele Grüße'), d, 'portal', true),
    ).toContain('Gruß „Viele Grüße“ passt nicht zu „Sehr geehrter Herr Beispiel,“');
    expect(verstoesse(gut.replace('Erika', 'gern Erika'), d, 'portal', true)).toContain(
      '„gern“ zweimal',
    );
    const ohneInserat = brief(d, 'mail', { inserat: true, nummern: { einstieg: 1 } });
    expect(ohneInserat).toContain('Inserat gesehen');
    expect(verstoesse(ohneInserat, d, 'mail', false)).toContain('Inserat ohne Inserat');
  });
});

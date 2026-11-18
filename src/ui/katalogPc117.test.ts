import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// PC117, Abschnitt 2: Was heute für Name, Betreff, Anschreiben und Deckblatt herauskommt, für 42 erfundene Inserate
// (tests/fixtures/inserate/katalog-pc117.json, nur W7-Adressen). Keine neue Regel: Der Test hält nur fest, was der
// Weg „Link einsetzen → Vorschau → Heft“ (entwurfAusVorschau) heute liefert. Mit KATALOG_TABELLE=Pfad schreibt er
// die Tabelle für die CP.

vi.mock('../app/router.svelte', () => ({ gehe: () => {} }));
vi.mock('../app/plattform', () => ({ linkWegDa: () => true }));

const { entwurf, entwurfAusVorschau, entwurfVergessen } = await import('./neuesHeft.svelte');
const { heftTitel } = await import('../domain/heftKarte');
const { anschreibenText } = await import('../domain/bewerben');
const { adresseZeilen } = await import('../domain/adresse');
const { mappenDateiname } = await import('../domain/export');
const { wohnungKurz } = await import('./mappeErstellen');

interface Fall {
  nr: string;
  art: string;
  portal: string;
  url: string;
  h1: string;
  text: string;
  geteilt?: string;
}

const faelle: Fall[] = JSON.parse(
  readFileSync('tests/fixtures/inserate/katalog-pc117.json', 'utf-8'),
).faelle;

function ergebnis(f: Fall) {
  entwurfVergessen();
  if (f.geteilt) entwurf.geteilterText = f.geteilt;
  entwurfAusVorschau({ zustand: 'fertig', text: f.text, url: f.url, h1: f.h1 } as never, f.url);
  const adresse = entwurf.adresse;
  const name = heftTitel({
    adresse,
    angaben: entwurf.angaben!,
    createdAt: '2026-11-18T10:00:00Z',
  }).text;
  const strasse = (adresseZeilen(adresse)[0] ?? '').replace(/\u00a0/g, ' ').trim();
  const betreff = strasse ? `Bewerbung um die Wohnung ${strasse}` : 'Bewerbung um die Wohnung';
  const satz = anschreibenText({
    wir: false,
    anbieter: entwurf.angaben?.anbieter,
    strasse,
    einzug: '',
    heute: new Date('2026-11-18'),
    weg: 'mail',
  }).text.split('. ')[0]!;
  const deck = adresseZeilen(adresse);
  const kurz = wohnungKurz(adresse);
  return {
    name,
    betreff,
    satz,
    deck: deck.join(' / ') || '(keine Adresse)',
    pdfTitel: kurz ? `Bewerbung ${kurz} – Mustermann` : 'Bewerbung – Mustermann',
    datei: mappenDateiname(['Mustermann'], adresse),
  };
}

describe('PC117 Katalog', () => {
  it('liefert für jedes Inserat Name, Betreff, Anschreiben und Deckblatt', () => {
    expect(faelle.length).toBeGreaterThanOrEqual(40);
    const zeilen = faelle.map((f) => ({ f, e: ergebnis(f) }));
    for (const { e } of zeilen) expect(e.name.trim()).not.toBe('');
    const ziel = process.env.KATALOG_TABELLE;
    if (ziel) {
      const z = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const kopf =
        '| Nr. | Art | Portal | Überschrift der Seite | Name des Hefts | Betreff | Anschreiben, erster Satz | Deckblatt (Adresse) | Dateiname |\n|---|---|---|---|---|---|---|---|---|\n';
      const rumpf = zeilen
        .map(
          ({ f, e }) =>
            `| ${f.nr} | ${z(f.art)} | ${f.portal}${f.geteilt ? ' (geteilt)' : ''} | ${z(f.h1)} | ${z(e.name)} | ${z(e.betreff)} | ${z(e.satz)}. | ${z(e.deck)} | ${z(e.datei)} |`,
        )
        .join('\n');
      writeFileSync(ziel, kopf + rumpf + '\n', 'utf-8');
    }
  });
});

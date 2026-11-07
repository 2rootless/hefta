import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { impressumHtml } from '../src/app/impressum';
import { DATENSCHUTZ_PFAD, datenschutzHtml, datenschutzText } from './ratgeber';

// Der Text kommt aus dem Datenschutz-Generator (Gratisfassung, erzeugt am 5.11.2026, am 6.11.2026 neu erzeugt ohne den
// Bereich „Zugriffsdaten und Logfiles“, Aufgabe 50) und bleibt, wie er ist.
// Ändert er sich, ist das eine neue Fassung aus dem Generator, kein Tippfehler: Dann ändert sich auch die Summe.
const SUMME = '79d3b3602fdf219e6c0821e70a2b20fc962f89ef2526e03e1596c62dab922936';

describe('Datenschutzerklärung', () => {
  const text = datenschutzText();

  it('Der Text ist der aus dem Generator, Zeichen für Zeichen', () => {
    expect(createHash('sha256').update(text).digest('hex')).toBe(SUMME);
  });

  it('Keine Frist für Logfiles: Hefta speichert keine, für Cloudflare ist keine belegt (Aufgabe 50)', () => {
    expect(text).not.toMatch(/30 Tagen|Server-Logfiles|Erhebung von Zugriffsdaten/);
  });

  it.each(['m', 'v'] as const)(
    'Fassung %s: Cloudflare lässt die Mailadresse stehen (email_off)',
    (stimme) => {
      const html = datenschutzHtml(stimme);
      const an = html.indexOf('<!--email_off-->');
      const aus = html.indexOf('<!--/email_off-->');
      const mail = html.indexOf('lleyton.sekyere@pm.me');
      expect(an).toBeGreaterThan(0);
      expect(mail).toBeGreaterThan(an);
      expect(aus).toBeGreaterThan(mail);
    },
  );

  it('Der Hinweis auf den Generator bleibt: Bedingung der Gratisfassung', () => {
    expect(text).toContain('Erstellt mit kostenlosem Datenschutz-Generator.de');
  });

  it('Jede Sprungmarke hat ihr Ziel', () => {
    const ziele = new Set([...text.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    const marken = [...text.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(marken.length).toBeGreaterThan(0);
    for (const m of marken) expect(ziele.has(m)).toBe(true);
  });

  describe.each(['m', 'v'] as const)('Seite, Fassung %s', (stimme) => {
    const html = datenschutzHtml(stimme);

    it('trägt den Text vollständig und die Ergänzung davor', () => {
      const ende = text.indexOf('</h1>') + '</h1>'.length;
      expect(html).toContain(text.slice(0, ende));
      expect(html).toContain(text.slice(ende));
      expect(html.indexOf('Cloudflare')).toBeLessThan(html.indexOf('Präambel'));
      // Vom Auftraggeber am 6.11.2026 freigegeben: kein Vermerk „Entwurf“ mehr.
      expect(html).not.toContain('Entwurf');
    });

    it('ist statisch und seit der Veröffentlichung für Suchmaschinen freigegeben', () => {
      expect(html).not.toMatch(/<script|\son\w+=|\sstyle=/i);
      expect(html).not.toContain('{app}');
      expect(html).not.toContain('noindex');
    });
  });

  it('Der Service Worker der App lässt die Seite in Ruhe', () => {
    expect(readFileSync('src/sw/sw.js', 'utf8')).toContain(`/${DATENSCHUTZ_PFAD}/`);
  });
});

describe('Impressum', () => {
  const text = readFileSync('data/impressum.de.html', 'utf8').replaceAll('\r\n', '\n');
  const nurText = (html: string) =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  it('Der Text ist der aus dem Generator, Zeichen für Zeichen', () => {
    expect(createHash('sha256').update(text).digest('hex')).toBe(
      'a20275f7244c93c0198ee3cc181604f5f5992407186fa23ea4f2633d56ca69dc',
    );
  });

  it('Der Hinweis auf den Generator bleibt: Bedingung der Gratisfassung', () => {
    expect(text).toContain('Erstellt mit kostenlosem Datenschutz-Generator.de');
  });

  it.each([3, 4] as const)('Auf der Seite ändert sich der Wortlaut nicht (Ebene %i)', (ebene) => {
    const html = impressumHtml(ebene);
    expect(nurText(html)).toBe(nurText(text).replace(/^Impressum /, ''));
    expect(html).not.toMatch(/<h[12]\b/);
    expect(html.match(new RegExp(`<h${ebene} `, 'g'))).toHaveLength(3);
    expect(html).not.toMatch(/<script|\son\w+=|\sstyle=/i);
  });

  it('Name und Anschrift stimmen mit der Datenschutzerklärung überein', () => {
    const dse = datenschutzText();
    for (const angabe of [
      'Lleyton Boateng Sekyere',
      'Friedensallee 378',
      '22761 Hamburg, Deutschland',
      'lleyton.sekyere@pm.me',
    ]) {
      expect(text).toContain(angabe);
      expect(dse).toContain(angabe);
    }
  });
});

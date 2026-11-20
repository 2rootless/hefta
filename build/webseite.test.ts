import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  impressumSeiteHtml,
  landingpageHtml,
  ratgeberUebersichtHtml,
  webHeaders,
  webHeadersFuer,
  webRedirects,
} from './webseite.ts';
import { datenschutzHtml, ratgeberHtml } from './ratgeber.ts';
import { rueckmeldungHtml } from './rueckmeldungSeite.ts';

// Die Website (build/webseite.ts): beide Stände der Landingpage ohne Platzhalter, die Weiterleitungen und
// Kopfzeilen. Was im Browser geschieht, prüft tests/e2e/webseite.spec.ts.

describe('Landingpage', () => {
  for (const stand of ['hefta2', 'v1'] as const) {
    it(`${stand}: fertig eingesetzt, ohne Skript im HTML, ohne fremde Quellen`, () => {
      const html = landingpageHtml(stand);
      expect(html).not.toMatch(/%[A-Z_]+%|data-platzhalter|0000000000/);
      expect(html).toContain('content="app-id=6831939371"');
      expect(html).toContain('href="https://apps.apple.com/de/app/hefta/id6831939371"');
      expect(html).toContain(`data-stand="${stand}"`);
      expect(html).toContain('<img src="/app-store.svg" alt="Laden im App Store"');
      // Skripte nur als eigene Dateien (CSP ohne Inline-Skript), keine Stile im Element.
      expect(html.match(/<script[^>]*>/g)).toEqual([
        '<script src="/weiter.js">',
        '<script src="/hefta.js" defer>',
      ]);
      expect(html).not.toMatch(/<script>|\sstyle=|\son[a-z]+=/);
      // Nur eigene Quellen; fremde Adressen nur als Links, die man antippt.
      for (const [, url] of html.matchAll(/(?:src|href)="(https?:[^"]+)"/g))
        // Seit dem 15.11. steht der Beitrag auf „/“: dazu seine Quellen (Datenschutzkonferenz, Sachsen-Anhalt).
        expect([
          'https://apps.apple.com',
          'https://vermieter.hefta.de',
          'https://www.datenschutzkonferenz-online.de',
          'https://datenschutz.sachsen-anhalt.de',
        ]).toContain(new URL(url!).origin);
      // Ohne Freigabe kein Google Play (E66).
      expect(html).not.toContain('abz-play');
      // Kein Hinweis auf eine Lizenz im Fuß (E66).
      expect(html.split('<footer')[1]).not.toMatch(/Lizenz|MIT/);
    });
  }
});

describe('Vorschau auf pages.dev (Planung 13g)', () => {
  it('sperrt Suchmaschinen nur in der Vorschau', () => {
    expect(webHeadersFuer(true)).toMatch(/^\/\*\n {2}X-Robots-Tag: noindex, nofollow\n/);
    expect(webHeadersFuer(false)).not.toContain('X-Robots-Tag');
    expect(webHeadersFuer(false)).toBe(webHeaders);
  });
});

describe('Seiten und Kopfzeilen', () => {
  it('Ratgeber: Übersicht verlinkt den Beitrag an seiner neuen Adresse', () => {
    expect(ratgeberUebersichtHtml()).toContain(
      'href="/ratgeber/was-darf-der-vermieter-verlangen/"',
    );
  });

  it('Impressum trägt den Text des Generators', () => {
    expect(impressumSeiteHtml()).toContain('Erstellt mit kostenlosem Datenschutz-Generator.de');
  });

  it('Alte Adresse des Ratgebers leitet dauerhaft weiter', () => {
    expect(webRedirects).toContain(
      '/was-darf-der-vermieter-verlangen/ /ratgeber/was-darf-der-vermieter-verlangen/ 301',
    );
  });

  it('Mappe unter /mappe/: Start und Worker ohne Zwischenspeicher, Dateien ein Jahr', () => {
    for (const pfad of ['/', '/sw.js', '/mappe/', '/mappe/sw.js'])
      expect(webHeaders).toContain(`\n${pfad}\n  Cache-Control: no-cache`);
    expect(webHeaders).toContain('/mappe/assets/*\n  Cache-Control: public, max-age=31536000');
  });
});

describe('Farbe nach B28a (Nachricht 13f)', () => {
  const css = readFileSync('web/seite.css', 'utf8') + readFileSync('build/ratgeber.css', 'utf8');
  it('Akzent mit den Werten des Berichts, keine alten Werte', () => {
    expect(css).toContain('--akzent:#d9402b;--akzent-hell:#f2e8e6;--akzent-text:#b8331c;');
    expect(css).toContain('--akzent:#f2552e;--akzent-hell:#33170f;--akzent-text:#f2552e;');
    expect(css).not.toMatch(/#(ff8466|e2603f|a8401f|ffb39d|ffe5db|4a2a20)(?![0-9a-f])/i);
  });
  it('Text in Akzentfarbe nimmt --akzent-text, nie --akzent', () => {
    expect(css).not.toMatch(/(?<![-\w])color\s*:\s*var\(--akzent\)/);
  });
});

describe('Schrift der Landingpage (PC36)', () => {
  it('jedes Zeichen der Seite steht in der gekürzten Schrift; sonst scripts/schrift-kuerzen.py laufen lassen', () => {
    const drin = new Set(readFileSync('web/archivo-zeichen.txt', 'utf8'));
    // DP36: Der Ratgeber trägt seither dieselbe Schrift.
    for (const [datei, html] of [
      ['web/hefta2.html', readFileSync('web/hefta2.html', 'utf8')],
      ['web/version1.html', readFileSync('web/version1.html', 'utf8')],
      ['Ratgeber', ratgeberHtml('m')],
      ['Übersicht des Ratgebers', ratgeberUebersichtHtml()],
      // PC40: Datenschutz, Impressum und Rückmeldung ebenso.
      ['Datenschutz', datenschutzHtml('m')],
      ['Impressum', impressumSeiteHtml()],
      ['Rückmeldung', rueckmeldungHtml()],
    ] as const) {
      const text = html
        .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ')
        .replaceAll('&shy;', '­')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replace(/<[^>]+>/g, ' ');
      // Das breitenlose Leerzeichen (U+200B) braucht keine Form.
      const fehlt = [...new Set(text)].filter(
        (z) => !/[\n\r\t]/.test(z) && z !== String.fromCharCode(0x200b) && !drin.has(z),
      );
      expect(fehlt, datei).toEqual([]);
    }
  });

  it('ist höchstens 64 KB groß (vorher 90 KB)', () => {
    expect(readFileSync('web/archivo.woff2').length).toBeLessThan(64_000);
  });
});

describe('Auftraggeber 15.11.', () => {
  it('Jede Seite auf hefta.de trägt das App-Banner von Safari', () => {
    for (const [name, html] of [
      ['Landingpage', landingpageHtml('hefta2')],
      ['Beitrag', ratgeberHtml('m')],
      ['Übersicht', ratgeberUebersichtHtml()],
      ['Datenschutz', datenschutzHtml('m')],
      ['Impressum', impressumSeiteHtml()],
      ['Rückmeldung', rueckmeldungHtml()],
    ] as const)
      expect(html, name).toContain('<meta name="apple-itunes-app" content="app-id=6831939371"');
  });

  it('Der Ratgeber liegt als Blatt auf „/“, der Beitrag auch, und verweist nicht auf eigene Seiten', () => {
    const html = landingpageHtml('hefta2');
    expect(html).toContain('<div id="ratgeber" class="blatt-rat">');
    expect(html).toContain('<div id="was-darf-der-vermieter-verlangen" class="blatt-artikel">');
    // Keine Links auf die eigenen Seiten des Ratgebers (das Stylesheet zählt nicht).
    expect(html).not.toMatch(/href="\/ratgeber\/[^"]*\/"/);
  });
});

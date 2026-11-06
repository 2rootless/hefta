import { APP_NAME } from '../src/app/name.ts';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { cspMeta, headersFile } from './csp.ts';
import { DATENSCHUTZ_PFAD, RATGEBER_ORDNER, RATGEBER_PFAD, ratgeberSchreiben } from './ratgeber.ts';

const wurzel = join(import.meta.dirname, '..');
const pdfjs = join(wurzel, 'node_modules', 'pdfjs-dist');

const posix = (pfad: string) => pfad.split(sep).join('/');

/** Alle Dateien eines Ordners, rekursiv, als Pfade relativ zu `basis`. */
function dateienIn(ordner: string, basis = ordner): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    return statSync(pfad).isDirectory() ? dateienIn(pfad, basis) : [relative(basis, pfad)];
  });
}

/** Was PDF.js zur Laufzeit lokal braucht; quickjs (Skripte in PDFs) bewusst nicht. */
function pdfjsDateien(): { quelle: string; ziel: string }[] {
  const liste: { quelle: string; ziel: string }[] = [];
  for (const ordner of ['cmaps', 'standard_fonts', 'iccs']) {
    for (const datei of dateienIn(join(pdfjs, ordner))) {
      liste.push({ quelle: join(pdfjs, ordner, datei), ziel: `pdfjs/${ordner}/${posix(datei)}` });
    }
  }
  for (const datei of readdirSync(join(pdfjs, 'wasm'))) {
    if (datei.startsWith('quickjs')) continue;
    liste.push({ quelle: join(pdfjs, 'wasm', datei), ziel: `pdfjs/wasm/${datei}` });
  }
  return liste;
}

/** Alle Lizenztexte in einer Datei: die App, die Schrift und jede Bibliothek, die mitgeliefert wird. */
export function lizenzenText(): string {
  const paket = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const gesehen = new Set<string>();
  const offen = Object.keys(paket.dependencies);
  const bibliotheken = new Map<string, string>();
  while (offen.length) {
    const name = offen.pop()!;
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const ordner = join(wurzel, 'node_modules', name);
    if (!existsSync(join(ordner, 'package.json'))) continue;
    const info = JSON.parse(readFileSync(join(ordner, 'package.json'), 'utf8')) as {
      version: string;
      license?: string;
      dependencies?: Record<string, string>;
    };
    offen.push(...Object.keys(info.dependencies ?? {}));
    const datei = readdirSync(ordner).find((d) => /^(licen[cs]e|copying)/i.test(d));
    bibliotheken.set(
      name,
      `${name} ${info.version} (${info.license ?? 'siehe Paket'})\n\n` +
        (datei
          ? readFileSync(join(ordner, datei), 'utf8')
          : 'Das Paket bringt keine eigene Lizenzdatei mit.'),
    );
  }
  return [
    `${APP_NAME}\n\n${readFileSync(join(wurzel, 'LICENSE'), 'utf8')}`,
    `Schrift Archivo\n\n${readFileSync(join(wurzel, 'src', 'pdf', 'fonts', 'OFL.txt'), 'utf8')}`,
    `Schrift Source Serif 4\n\n${readFileSync(join(wurzel, 'src', 'pdf', 'fonts', 'LICENSE-SourceSerif4.txt'), 'utf8')}`,
    `Schrift IBM Plex Sans\n\n${readFileSync(join(wurzel, 'src', 'pdf', 'fonts', 'LICENSE-IBMPlexSans.txt'), 'utf8')}`,
    ...[...bibliotheken.keys()].sort().map((n) => bibliotheken.get(n)!),
  ].join(`\n\n${'='.repeat(72)}\n\n`);
}

/**
 * Build-Schritte von Hefta: CSP ins HTML, PDF.js-Ressourcen lokal ausliefern,
 * `_headers` fürs Hosting und den Service Worker mit der Liste aller Dateien erzeugen.
 */
export function heftaBau(): Plugin {
  return {
    name: 'hefta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // Die Schrift für lateinische Zeichen gleich mitladen: sonst wartet sie auf die CSS-Datei,
        // und der erste Text springt beim Austausch der Ersatzschrift.
        const schrift = Object.keys(ctx.bundle ?? {}).find((name) =>
          /archivo-latin-wdth-normal-[\w-]+\.woff2$/.test(name),
        );
        return {
          html: html
            .replaceAll('%APP_NAME%', APP_NAME)
            .replace(
              '<!--csp-->',
              `<meta http-equiv="Content-Security-Policy" content="${cspMeta}" />`,
            ),
          tags: schrift
            ? [
                {
                  tag: 'link',
                  attrs: {
                    rel: 'preload',
                    href: `./${schrift}`,
                    as: 'font',
                    type: 'font/woff2',
                    crossorigin: '',
                  },
                  injectTo: 'head',
                },
              ]
            : [],
        };
      },
    },
    generateBundle() {
      for (const { quelle, ziel } of pdfjsDateien()) {
        this.emitFile({ type: 'asset', fileName: ziel, source: readFileSync(quelle) });
      }
      this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile });
    },
    // Erst wenn alles in dist/ liegt, kennt der Service Worker die vollständige Dateiliste.
    closeBundle() {
      const ziel = join(wurzel, 'dist');
      // Der Name steht nur an einer Stelle (src/app/name.ts); diese Dateien kommen unverändert aus public/.
      for (const datei of ['manifest.webmanifest', '404.html']) {
        const pfad = join(ziel, datei);
        writeFileSync(pfad, readFileSync(pfad, 'utf8').replaceAll('%APP_NAME%', APP_NAME));
      }
      // index.html steckt schon in './'; Cloudflare leitet /index.html ohnehin auf / um.
      writeFileSync(join(ziel, 'lizenzen.txt'), lizenzenText());
      ratgeberSchreiben(ziel, 'm');
      const ausgenommen = new Set([
        '_headers',
        'robots.txt',
        'sw.js',
        '404.html',
        'index.html',
        'lizenzen.txt',
      ]);
      const dateien = dateienIn(ziel)
        .map(posix)
        .filter((d) => !ausgenommen.has(d) && !d.endsWith('.map'))
        // Der Ratgeber ist eine Seite im Netz, kein Teil der App: nicht in den Zwischenspeicher.
        .filter(
          (d) =>
            !d.startsWith(`${RATGEBER_ORDNER}/`) &&
            !d.startsWith(`${RATGEBER_PFAD.m}/`) &&
            !d.startsWith(`${DATENSCHUTZ_PFAD}/`),
        )
        .sort();
      const version = createHash('sha256');
      for (const d of dateien) version.update(d).update(readFileSync(join(ziel, d)));
      const vorlage = readFileSync(join(wurzel, 'src', 'sw', 'sw.js'), 'utf8');
      for (const platzhalter of ["'__VERSION__'", "'__DATEIEN__'"]) {
        if (!vorlage.includes(platzhalter))
          throw new Error(`sw.js: Platzhalter ${platzhalter} fehlt`);
      }
      const sw = vorlage
        .replace("'__VERSION__'", JSON.stringify(version.digest('hex').slice(0, 12)))
        .replace("'__DATEIEN__'", JSON.stringify(['./', ...dateien]));
      writeFileSync(join(ziel, 'sw.js'), sw);
    },
  };
}

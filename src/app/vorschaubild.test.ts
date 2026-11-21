// W45 (DP102): Die Erweiterung für Vorschaubilder zeichnet genau die Vorlagen von Design. Swift lässt sich hier
// nicht ausführen; der Test vergleicht darum jede Zahl im Swift-Code mit den SVG-Vorlagen in design/dp102/svg.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SWIFT = 'ios/App/HeftaVorschau/ThumbnailProvider.swift';
const svg = (name: string) => readFileSync(`design/dp102/svg/${name}.svg`, 'utf-8');

interface Vorlage {
  blatt: number[];
  plakette: number[] | null;
  schloss: number[] | null;
}

/** Liest Lage von Blatt, Plakette und Schloss aus einer Vorlage (im Quadrat 100). */
function vorlage(name: string): Vorlage {
  const t = svg(name);
  const g = [
    ...t.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">\s*<path/g),
  ].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const c = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/.exec(t);
  return {
    blatt: g[0]!,
    plakette: c ? [Number(c[1]), Number(c[2]), Number(c[3])] : null,
    schloss: g[1] ?? null,
  };
}

/** Liest die drei Lagen aus `lage(mitPasswort:gross:)` im Swift-Code, in der Reihenfolge ohne, mit groß, mit klein. */
function swiftLagen(quelle: string): Vorlage[] {
  const block = quelle.slice(
    quelle.indexOf('static func lage('),
    quelle.indexOf('static let grossAb'),
  );
  return [...block.matchAll(/return Lage\(([\s\S]*?)\)\n/g)].map((m) => {
    const zahlen = (art: string) => {
      const r = new RegExp(`${art}: \\(x: ([\\d.]+), y: ([\\d.]+), [sr]: ([\\d.]+)\\)`).exec(m[1]!);
      return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : null;
    };
    return { blatt: zahlen('blatt')!, plakette: zahlen('plakette'), schloss: zahlen('schloss') };
  });
}

/** SVG-Pfad in absolute Punkte (Endpunkte und Kontrollpunkte), für die Befehle dieser beiden Zeichen. */
function punkte(d: string): number[][] {
  const teile = d.match(/[MVLHvlhcsaV]|-?\d*\.?\d+/g)!;
  const aus: number[][] = [];
  let x = 0;
  let y = 0;
  let c2: number[] = [0, 0];
  let i = 0;
  let befehl = '';
  const zahl = () => Number(teile[i++]);
  while (i < teile.length) {
    if (/[A-Za-z]/.test(teile[i]!)) befehl = teile[i++]!;
    switch (befehl) {
      case 'M':
      case 'L':
        x = zahl();
        y = zahl();
        aus.push([x, y]);
        break;
      case 'l':
        x += zahl();
        y += zahl();
        aus.push([x, y]);
        break;
      case 'V':
        y = zahl();
        aus.push([x, y]);
        break;
      case 'v':
        y += zahl();
        aus.push([x, y]);
        break;
      case 'H':
        x = zahl();
        aus.push([x, y]);
        break;
      case 'h':
        x += zahl();
        aus.push([x, y]);
        break;
      case 'c': {
        const [a, b, cc, dd, e, f] = [zahl(), zahl(), zahl(), zahl(), zahl(), zahl()];
        aus.push([x + a, y + b], [x + cc, y + dd], [x + e, y + f]);
        c2 = [x + cc, y + dd];
        x += e;
        y += f;
        break;
      }
      case 's': {
        const [cc, dd, e, f] = [zahl(), zahl(), zahl(), zahl()];
        aus.push([2 * x - c2[0]!, 2 * y - c2[1]!], [x + cc, y + dd], [x + e, y + f]);
        c2 = [x + cc, y + dd];
        x += e;
        y += f;
        break;
      }
      case 'a': {
        // Halbkreis: Radius, Drehung, Bögen; Mitte und Endpunkt reichen für den Vergleich.
        const r = zahl();
        i += 4;
        const dx = zahl();
        const dy = zahl();
        aus.push([x + dx / 2, y + dy / 2, r], [x + dx, y + dy]);
        x += dx;
        y += dy;
        break;
      }
      default:
        throw new Error(`Befehl ${befehl}`);
    }
  }
  return aus.map((p) => p.map((n) => Math.round(n * 100) / 100));
}

/** Die Punkte aus einer Swift-Funktion in Reihenfolge: move, addLine, addCurve (Ziel, k1, k2), addArc. */
function swiftPunkte(quelle: string, funktion: string): number[][] {
  const start = quelle.indexOf(`static func ${funktion}()`);
  const block = quelle.slice(start, quelle.indexOf('return p', start));
  const aus: number[][] = [];
  for (const m of block.matchAll(
    /(move|addLine)\(to: CGPoint\(x: ([\d.]+), y: ([\d.]+)\)\)|addCurve\(\s*to: CGPoint\(x: ([\d.]+), y: ([\d.]+)\), controlPoint1: CGPoint\(x: ([\d.]+), y: ([\d.]+)\),\s*controlPoint2: CGPoint\(x: ([\d.]+), y: ([\d.]+)\)\)|withCenter: CGPoint\(x: ([\d.]+), y: ([\d.]+)\), radius: ([\d.]+)/g,
  )) {
    const n = (k: number) => Number(m[k]);
    if (m[1]) aus.push([n(2), n(3)]);
    else if (m[4]) aus.push([n(6), n(7)], [n(8), n(9)], [n(4), n(5)]);
    else {
      aus.push([n(10), n(11), n(12)]);
      // Endpunkt des Halbkreises nach links: Mitte minus Radius.
      aus.push([Math.round((n(10) - n(12)) * 100) / 100, n(11)]);
    }
  }
  return aus;
}

const quelle = readFileSync(SWIFT, 'utf-8');

describe('W45: Vorschaubild nach DP102', () => {
  it('die Lagen im Swift-Code sind die der Vorlagen (ohne, mit groß, mit klein, Teilen)', () => {
    const [ohne, mitGross, mitKlein] = swiftLagen(quelle);
    expect(ohne).toEqual(vorlage('w45-ohne-klein'));
    expect(ohne).toEqual(vorlage('w45-ohne-gross'));
    expect(mitGross).toEqual(vorlage('w45-mit-gross'));
    expect(mitKlein).toEqual(vorlage('w45-mit-klein'));
    // Teilen: dieselbe Lage wie „klein“ im Quadrat aus der Mitte (BQ11).
    expect(svg('w45-mit-teilen')).toContain('translate(0.0 150.0) scale(3.0)');
    expect(mitKlein).toEqual(vorlage('w45-mit-teilen'));
    expect(ohne).toEqual(vorlage('w45-ohne-teilen'));
  });

  it('Blatt und Schloss Punkt für Punkt wie in den Vorlagen (BQ4)', () => {
    const d = (name: string, nr: number) =>
      [...svg(name).matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!)[nr]!;
    expect(swiftPunkte(quelle, 'blatt')).toEqual(punkte(d('w45-mit-klein', 0)));
    expect(swiftPunkte(quelle, 'schloss')).toEqual(punkte(d('w45-mit-klein', 1)));
    // Der Bügel geht oben herum: im y-unten-System von UIKit gegen den Uhrzeiger, wie „sweep 0“ im SVG.
    expect(quelle).toContain('startAngle: 0, endAngle: .pi, clockwise: false');
  });

  it('Kachel, Farben und Striche wie in den Vorlagen', () => {
    const v = svg('w45-mit-klein');
    expect(v).toContain(
      '<rect x="6" y="6" width="88" height="88" rx="18" fill="#efe3cf" stroke="#7a7166" stroke-width="2"/>',
    );
    expect(quelle).toContain('CGRect(x: 6, y: 6, width: 88, height: 88), cornerRadius: 18');
    expect(quelle).toContain('kachel.lineWidth = 2');
    expect(v).toContain('stroke-width="2.5"');
    expect(quelle).toContain('kreis.lineWidth = 2.5');
    expect(quelle).toContain('p.lineWidth = 3.2');
    for (const [farbe, hex] of [
      ['tinte', '26221e'],
      ['karton', 'efe3cf'],
      ['rand', '7a7166'],
    ] as const) {
      const [r, g, b] = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4)];
      expect(quelle).toContain(
        `static let ${farbe} = UIColor(red: 0x${r} / 255.0, green: 0x${g} / 255.0, blue: 0x${b} / 255.0, alpha: 1)`,
      );
    }
  });

  it('nur die ersten 8 Bytes; ohne Passwort weder Plakette noch Schloss (BK5, BQ5, W10)', () => {
    expect(quelle.match(/\.read\(/g)).toHaveLength(1);
    expect(quelle).toContain('datei.read(upToCount: 8)');
    expect(quelle).not.toMatch(/readToEnd|readDataToEndOfFile|contentsOf/);
    expect(quelle).toContain('plakette: nil, schloss: nil');
    // Kein Text im Bild: keine Zahl, kein Name aus dem Backup.
    expect(quelle).not.toMatch(/NSAttributedString|\.draw\(with|UIFont/);
  });

  it('Gegenprobe: eine um 3 versetzte Plakette oder ein verschobener Punkt wird rot', () => {
    const versetzt = quelle.replace(
      'plakette: (x: 73, y: 73, r: 19)',
      'plakette: (x: 76, y: 73, r: 19)',
    );
    expect(swiftLagen(versetzt)[2]).not.toEqual(vorlage('w45-mit-klein'));
    const schief = quelle.replace(
      'p.move(to: CGPoint(x: 20.6, y: 22.2))',
      'p.move(to: CGPoint(x: 20.6, y: 23.2))',
    );
    const d = [...svg('w45-mit-klein').matchAll(/<path d="([^"]+)"/g)][0]![1]!;
    expect(swiftPunkte(schief, 'blatt')).not.toEqual(punkte(d));
    // Ohne Passwort mit Schloss (Designs Gegenprobe zu BQ5).
    expect(vorlage('../werkzeug/gegenproben/gegen-schloss-ohne-klein').plakette).not.toBeNull();
  });

  it('die Erweiterung ist im Projekt, wird eingebettet und gilt für Hefta-Backups', () => {
    const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf-8');
    expect(pbx).toContain(
      'E1C2D3E4F500000000000013 /* HeftaVorschau.appex in Embed Foundation Extensions */,',
    );
    expect(pbx).toContain('E1C2D3E4F500000000000051 /* PBXTargetDependency */,');
    expect(pbx).toContain('PRODUCT_BUNDLE_IDENTIFIER = de.hefta.app.vorschaubild;');
    expect(pbx).not.toContain('HeftaVorschauProbe');
    const plist = readFileSync('ios/App/HeftaVorschau/Info.plist', 'utf-8');
    expect(plist).toMatch(
      /QLSupportedContentTypes<\/key>\s*<array>\s*<string>de\.hefta\.backup<\/string>/,
    );
    expect(plist).toContain('<string>com.apple.quicklook.thumbnail</string>');
  });
});

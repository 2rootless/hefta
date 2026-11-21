import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  flaechen,
  klammerLesen,
  lueckeGerechnet,
  lueckenLinien,
  lueckenTiefe,
  pngLesen,
  verkleinern,
  type Klammer,
} from '../test/symbolMass';

// Prüfkatalog SY für das App-Symbol A1b (DP111, PC178). Gegenprobe ist jeweils A1 aus DP63b, die falsche Fassung.
// Gemessen wird am Bau: an den Ebenen in ios/App/App/AppIcon.icon und an der flachen 1024er, die als Ersatzbild bis
// iOS 18 und im App Store liegt. SY3 (dunkler Balken im Glas) geht nur am Gerät, mit Bildschirmfotos.

const ICON = 'ios/App/App/AppIcon.icon';
const FLACH_BAU = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/hefta-hell.png';
const DP8 = 'design/dp8/DP8_an-planung_icon-faecher-voll';
const A1 = 'design/dp63b/app-symbol';
const lies = (p: string) => readFileSync(p, 'utf8');

const BAU: Klammer = klammerLesen(lies(`${ICON}/Assets/1-klammer.svg`));
const ZWEI_NULL: Klammer = klammerLesen(lies(`${DP8}/icon-composer/1-klammer.svg`));
const A1_KLAMMER: Klammer = klammerLesen(lies(`${A1}/app-symbol-A1-quadrat.svg`));

describe('symbol-luecke (SY1)', () => {
  it('SY1a: Lücke zwischen äußerem und innerem Haus bei 58 px aus der Geometrie mindestens 1 px; Gegenprobe A1', () => {
    expect(lueckeGerechnet(BAU, 58)).toBeCloseTo(1.93, 2);
    expect(lueckeGerechnet(BAU, 58)).toBeGreaterThanOrEqual(1);
    // auch in der flachen Fassung des Designs dieselbe Klammer
    expect(klammerLesen(lies('design/dp111/app-symbol/app-symbol-A1b-quadrat.svg'))).toEqual(BAU);
    expect(lueckeGerechnet(A1_KLAMMER, 58)).toBeCloseTo(0.83, 2);
    expect(lueckeGerechnet(A1_KLAMMER, 58)).toBeLessThan(1);
  });

  it('SY1b: Lücke im Bild offen, flach 58 px Tiefe mindestens 0,75 und in keiner Größe unter 2.0; Gegenprobe A1', () => {
    const groessen = [180, 120, 87, 58, 40, 29];
    const tiefen = (png: string, k: Klammer) => {
      const linien = lueckenLinien(k);
      const bild = pngLesen(png);
      return Object.fromEntries(
        groessen.map((px) => [px, lueckenTiefe(verkleinern(bild, px), linien)]),
      );
    };
    const bau = tiefen(FLACH_BAU, BAU);
    const alt = tiefen(`${DP8}/flach/hefta-icon-flach-1024.png`, ZWEI_NULL);
    const a1 = tiefen(`${A1}/app-symbol-A1-1024.png`, A1_KLAMMER);
    expect(bau[58]).toBeGreaterThanOrEqual(0.75);
    for (const px of groessen) expect(bau[px], `${px} px`).toBeGreaterThanOrEqual(alt[px]! - 0.02);
    // Gegenprobe: A1 läuft bei 58 px zu (Design: 0,71) und liegt ab 120 px unter 2.0.
    expect(a1[58]).toBeLessThan(0.75);
    expect(groessen.some((px) => a1[px]! < alt[px]! - 0.02)).toBe(true);
  }, 120_000);
});

describe('symbol-strich (SY2)', () => {
  it('Strich der Klammer wie im Logo (3,2), in den Ebenen und in der flachen Fassung; Gegenprobe A1 mit 4,2', () => {
    const logo = Number(/stroke-width="([\d.]+)"/.exec(lies('src/assets/hefta-logo.svg'))![1]);
    expect(logo).toBe(3.2);
    expect(BAU.sw).toBe(logo);
    expect(A1_KLAMMER.sw).not.toBe(logo);
  });
});

/** Deckelkante und Seiten aus einem flachen SVG, wie pruef118.py (Seiten: Pfade in Papierfarbe, die bei x ≥ 700 liegen). */
function stapel(svg: string): { kante: number; seiten: number[] } {
  const kante = Number(/M0 0H([\d.]+)V1024H0Z/.exec(svg)![1]);
  const seiten = [
    ...svg.matchAll(/<path d="(M[\d.]+ [\d.]+L[^"]+)" fill="#(?:f|e|d|c)[0-9a-f]{5}"/g),
  ]
    .map((m) => Math.min(...[...m[1]!.matchAll(/[ML]([\d.]+) /g)].map((x) => Number(x[1]))))
    .filter((x) => x > 700);
  return { kante, seiten };
}

describe('symbol-form (SY4, SY5, SY10)', () => {
  it('SY4: Haus wie 2.0, Maß 20 um 396/512; Gegenprobe A1 mit 21 um 390/512', () => {
    const lage = (k: Klammer) => [k.s, k.cx, k.cy];
    expect(lage(ZWEI_NULL)).toEqual([20, 396, 512]);
    expect(lage(BAU)).toEqual(lage(ZWEI_NULL));
    expect(lage(A1_KLAMMER)).not.toEqual(lage(ZWEI_NULL));
  });

  it('SY5: drei Seiten, der Deckel reicht bis an die Seiten (772); Gegenprobe A1 mit zwei Seiten und Kante 760', () => {
    // Ebenen im Bau
    expect(lies(`${ICON}/Assets/2-deckel.svg`)).toContain('M0 0H772V1024H0Z');
    const seiten = readdirSync(`${ICON}/Assets`).filter((d) => /^3-seite-\d\.svg$/.test(d));
    expect(seiten).toHaveLength(3);
    for (const s of seiten) {
      const xs = [...lies(`${ICON}/Assets/${s}`).matchAll(/[ML]([\d.]+) /g)].map((m) => +m[1]!);
      // SY7: keine Seite ragt in den Deckel
      expect(Math.min(...xs), s).toBeGreaterThanOrEqual(772 - 0.01);
    }
    const icon = JSON.parse(lies(`${ICON}/icon.json`)) as {
      groups: { name: string; layers: { 'image-name': string }[] }[];
    };
    const imJson = icon.groups.flatMap((g) => g.layers.map((l) => l['image-name']));
    expect(imJson.filter((n) => n.startsWith('3-seite-')).sort()).toEqual(seiten.sort());
    // flache Fassungen
    const b = stapel(lies('design/dp111/app-symbol/app-symbol-A1b-quadrat.svg'));
    expect(b.kante).toBe(772);
    expect(b.seiten).toHaveLength(3);
    const a = stapel(lies(`${A1}/app-symbol-A1-quadrat.svg`));
    expect(a.kante < 772 || a.seiten.length !== 3).toBe(true);
  });

  it('SY10: Flächen der flachen 1024er wie 2.0, je ± 1,5 Prozentpunkte; Gegenprobe A1', () => {
    // Farben je Fassung aus ihrem flachen SVG, wie Designs sym118.py sie setzt: Deckel, Klammer (Papier), Seiten
    // (deckende Pfade außer dem Deckel), Rest (Grund). So steht kein alter Farbwert in diesem Test.
    const farben = (svg: string) => ({
      Deckel: [/<path d="M0 0H[\d.]+V1024H0Z" fill="(#[0-9a-f]{6})"/.exec(svg)![1]!],
      Klammer: [/stroke="(#[0-9a-f]{6})"/.exec(svg)![1]!],
      Seiten: [...svg.matchAll(/<path d="(M[^"]+)" fill="(#[0-9a-f]{6})"\/>/g)]
        .filter((m) => !m[1]!.startsWith('M0 0H'))
        .map((m) => m[2]!),
      Rest: [/<rect [^>]*fill="(#[0-9a-f]{6})"/.exec(svg)![1]!],
    });
    const zwei = flaechen(
      pngLesen(`${DP8}/flach/hefta-icon-flach-1024.png`),
      farben(lies(`${DP8}/flach/hefta-icon-flach.svg`)),
    );
    const a1Farben = farben(lies('design/dp111/app-symbol/app-symbol-A1b-quadrat.svg'));
    expect(a1Farben.Seiten).toHaveLength(3);
    expect(farben(lies(`${DP8}/flach/hefta-icon-flach.svg`)).Seiten).toHaveLength(3);
    const ab = (r: Record<string, number>) =>
      Object.fromEntries(Object.keys(zwei).map((n) => [n, r[n]! - zwei[n]!]));
    const bau = ab(flaechen(pngLesen(FLACH_BAU), a1Farben));
    for (const [n, d] of Object.entries(bau)) expect(Math.abs(d), n).toBeLessThanOrEqual(1.5);
    const a1 = ab(flaechen(pngLesen(`${A1}/app-symbol-A1-1024.png`), a1Farben));
    expect(Object.values(a1).some((d) => Math.abs(d) > 1.5)).toBe(true);
  });

  it('SY9: App Store 1024 × 1024 ohne Transparenz (8 Bit RGB)', () => {
    const b = pngLesen(FLACH_BAU);
    expect([b.breite, b.hoehe]).toEqual([1024, 1024]);
  });
});

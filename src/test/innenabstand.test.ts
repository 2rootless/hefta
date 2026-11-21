import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PC170 (W22, CP91): Der Innenabstand der Kästen ist 16 px, nicht 14 px. An allen 21 Stellen, auch oben bei den
// Kästen, die seitlich schon 16 px hatten. Geprüft wird der Stil im Quelltext: je Datei der Block des Selektors und
// darin `padding`. Die Zeilen und Knöpfe bei 320 px mit 130 % sind einmalig gemessen (CP94): kein neuer Umbruch.

/** Datei, Selektor, erwarteter Wert von `padding`. */
const STELLEN: [string, string, string][] = [
  ['src/screens/BuergschaftSeite.svelte', '.kasten', '16px'],
  ['src/screens/BuergschaftSeite.svelte', '.baut', '16px'],
  ['src/screens/MappeErstellen.svelte', '.karte', '16px'],
  ['src/screens/MappeStart.svelte', '.sk', '16px'],
  ['src/screens/PersonLoeschen.svelte', '.info', '16px'],
  ['src/screens/PersonSeite.svelte', '.kasten', '16px'],
  ['src/screens/PersonSeite.svelte', '.info', '16px'],
  ['src/screens/Uebersicht.svelte', '.aufgaben', '16px'],
  ['src/screens/Wohnungen.svelte', '.weg', '16px'],
  ['src/ui/BonitaetErkennen.svelte', '.erkennen', '16px'],
  ['src/ui/HeftStand.svelte', '.karte', '16px'],
  ['src/ui/HeftStand.svelte', '.rueck', '16px'],
  ['src/screens/Einstellungen.svelte', '.speicher', '16px'],
  ['src/screens/HeftVorschau.svelte', '.t', '16px 16px 4px'],
  ['src/screens/SelbstauskunftSeite.svelte', '.bogen', '16px'],
  ['src/screens/VersionSeite.svelte', '.karte-weiss', '16px'],
  ['src/screens/WuenscheSeite.svelte', '.feld', '16px'],
  ['src/ui/UploadFormular.svelte', '.gesperrt-text', '16px'],
  ['src/ui/Rueckmeldung.svelte', '.rueckmeldung', '16px'],
  ['src/ui/RueckmeldungMail.svelte', '.mail', '16px'],
  ['src/ui/TerminKarte.svelte', '.tc', '16px 16px 12px 15px'],
];

/** Alle Werte von `padding` in Blöcken, deren Selektorzeile `selektor` enthält (leer: alle Blöcke). */
function abstaende(quelltext: string, selektor: string): string[] {
  const stil = quelltext.slice(quelltext.indexOf('<style'));
  const werte: string[] = [];
  for (const block of stil.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const kopf = block[1]!.trim().split('\n').pop()!.trim();
    if (selektor && !kopf.split(',').some((s) => s.trim() === selektor)) continue;
    const p = /(?:^|[\s;])padding:\s*([^;]+);/.exec(block[2]!);
    if (p) werte.push(p[1]!.trim());
  }
  return werte;
}

/** Falsche Stellen: Der erwartete Wert fehlt, oder ein Block der Stelle beginnt oben mit 14 px. */
function falsch(lesen: (datei: string) => string): string[] {
  const aus: string[] = [];
  for (const [datei, selektor, soll] of STELLEN) {
    const werte = abstaende(lesen(datei), selektor);
    if (!werte.includes(soll)) aus.push(`${datei} ${selektor || '(Datei)'}: ${werte.join(' | ')}`);
    if (selektor && werte.some((w) => w.startsWith('14px')))
      aus.push(`${datei} ${selektor}: oben 14 px`);
  }
  return aus;
}

const echt = (datei: string) => readFileSync(datei, 'utf8');

describe('PC170: Innenabstand der Kästen 16 px (W22)', () => {
  it('alle 21 Stellen haben 16 px, oben eingeschlossen', () => {
    expect(STELLEN).toHaveLength(21);
    expect(falsch(echt)).toEqual([]);
  });

  it('Gegenprobe: 14 px oben an einer Stelle wird rot', () => {
    const mit14 = (datei: string) =>
      datei.endsWith('PersonSeite.svelte')
        ? echt(datei).replace(/(\.kasten \{[^}]*?)padding: 16px;/, '$1padding: 14px 16px 16px;')
        : echt(datei);
    expect(falsch(mit14)).toContain('src/screens/PersonSeite.svelte .kasten: oben 14 px');
  });

  it('Gegenprobe: der alte gemischte Wert 14 px 16 px wird rot', () => {
    const alt = (datei: string) =>
      datei.endsWith('WuenscheSeite.svelte')
        ? echt(datei).replace(/(\.feld \{[^}]*?)padding: 16px;/, '$1padding: 14px 16px;')
        : echt(datei);
    expect(falsch(alt).some((f) => f.startsWith('src/screens/WuenscheSeite.svelte .feld'))).toBe(
      true,
    );
  });
});

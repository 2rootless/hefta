import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// PC91, Punkt 1: Schnittstellen „mit Pflicht zur Begründung“ (Apple, ITMS-91053) stehen im Manifest des App-Ziels.
// Die Probe sucht im eigenen Swift-Code danach. Plugins mit eigenem Code (Capacitor-Filesystem und
// ion-ios-filesystem lesen Zeitstempel von Dateien) sind fest eingetragen, denn ihr Code liegt nicht hier.

const KATEGORIEN: [string, RegExp][] = [
  ['NSPrivacyAccessedAPICategoryUserDefaults', /\bUserDefaults\b|NSUserDefaults/],
  [
    'NSPrivacyAccessedAPICategoryFileTimestamp',
    /\b(creationDate|modificationDate|contentModificationDateKey|creationDateKey|attributesOfItem|getattrlist|fstat|lstat)\b/,
  ],
  ['NSPrivacyAccessedAPICategorySystemBootTime', /\b(systemUptime|mach_absolute_time)\b/],
  [
    'NSPrivacyAccessedAPICategoryDiskSpace',
    /\b(volumeAvailableCapacity\w*|volumeTotalCapacity\w*|systemFreeSize|systemSize|statfs|statvfs)\b/,
  ],
  ['NSPrivacyAccessedAPICategoryActiveKeyboards', /\bactiveInputModes\b/],
];

/** Von Plugins genutzt, Code nicht in diesem Repo (geprüft am 17.11.2026, PC91). */
const AUS_PLUGINS = ['NSPrivacyAccessedAPICategoryFileTimestamp'];

function swiftDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) return n === 'build' || n === 'Pods' ? [] : swiftDateien(p);
    return /\.(swift|m)$/.test(n) ? [p] : [];
  });
}

/** Kategorien, die der Code nutzt. */
function genutzt(texte: string[]): string[] {
  return KATEGORIEN.filter(([, muster]) => texte.some((t) => muster.test(t))).map(([k]) => k);
}

/** Kategorien im Manifest, jede mit mindestens einem Grund. */
function erklaert(manifest: string): string[] {
  return [
    ...manifest.matchAll(
      /<string>(NSPrivacyAccessedAPICategory\w+)<\/string>\s*<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>\s*<string>[A-Z0-9]{4}\.\d<\/string>/g,
    ),
  ].map((m) => m[1]!);
}

describe('Datenschutz-Manifest des App-Ziels (PC91)', () => {
  const manifest = readFileSync('ios/App/App/PrivacyInfo.xcprivacy', 'utf8');
  const code = swiftDateien('ios/App').map((p) => readFileSync(p, 'utf8'));

  it('nennt jede Schnittstelle mit Begründungspflicht, die Hefta und die Plugins nutzen', () => {
    const fehlt = [...new Set([...genutzt(code), ...AUS_PLUGINS])].filter(
      (k) => !erklaert(manifest).includes(k),
    );
    expect(fehlt).toEqual([]);
  });

  it('kein Tracking, keine Tracking-Domains', () => {
    expect(manifest).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(manifest).toMatch(/<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
  });

  it('Gegenprobe: Code mit `systemUptime` oder ein Manifest ohne UserDefaults fallen auf', () => {
    expect(genutzt(['let t = ProcessInfo.processInfo.systemUptime'])).toEqual([
      'NSPrivacyAccessedAPICategorySystemBootTime',
    ]);
    const ohne = manifest.replace('NSPrivacyAccessedAPICategoryUserDefaults', 'GESTRICHEN');
    expect(erklaert(ohne)).not.toContain('NSPrivacyAccessedAPICategoryUserDefaults');
    expect(genutzt(code)).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
  });
});

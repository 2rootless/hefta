import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import paket from '../../package.json';
import { versionKurz } from './version';

describe('PC81 U5: Version in den Einstellungen', () => {
  it('der Stand von 2.0.1 zeigt „2.0.1“ (PC134)', () => {
    expect(paket.version).toBe('2.0.1');
    expect(versionKurz(paket.version)).toBe('2.0.1');
  });

  it('PC134: Der Lauf für TestFlight nimmt die Version aus package.json, nicht fest „2.0.0“', () => {
    const lauf = readFileSync('.github/workflows/app.yml', 'utf8');
    expect(lauf).toContain(`MARKETING_VERSION="$(node -p "require('./package.json').version")"`);
    // Gegenprobe: eine feste Nummer für app/hefta-2 gibt es nicht mehr.
    expect(lauf).not.toMatch(/MARKETING_VERSION=2\.0\.0/);
  });

  it('nur eine Null am Ende fällt weg', () => {
    expect(versionKurz('2.0.1')).toBe('2.0.1');
    expect(versionKurz('2.1.0')).toBe('2.1');
    expect(versionKurz('10.0.0')).toBe('10.0');
  });

  it('Gegenprobe: der Stand der Vorschau zeigte „0.0.1“', () => {
    expect(versionKurz('0.0.1')).toBe('0.0.1');
    expect(versionKurz('0.0.1')).not.toBe('2.0');
  });
});

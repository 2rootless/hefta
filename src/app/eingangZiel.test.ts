// Backup von außen: Der Anfang der Datei entscheidet, nicht der Name.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eingangZiel } from './eingangZiel';

const datei = (anfang: string | number[], name: string) =>
  new File(
    [typeof anfang === 'string' ? new TextEncoder().encode(anfang) : new Uint8Array(anfang)],
    name,
  );

describe('Backup von außen', () => {
  it('verschlüsselt, offen (PK) und unter fremdem Namen: Backup', async () => {
    expect(await eingangZiel([datei('HEFTABAK\x01\x01rest', 'Hefta-Backup.hefta')])).toBe('backup');
    expect(await eingangZiel([datei([0x50, 0x4b, 0x03, 0x04, 0, 0], 'Backup.zip')])).toBe('backup');
    expect(await eingangZiel([datei('HEFTABAK\x01\x01', 'anhang.bin')])).toBe('backup');
  });

  it('Gegenprobe: ein PDF, auch mit Endung .hefta, geht wie bisher in den Eingang', async () => {
    expect(await eingangZiel([datei('%PDF-1.7\n', 'Gehalt.pdf')])).toBe('eingang');
    expect(await eingangZiel([datei('%PDF-1.7\n', 'falsch.hefta')])).toBe('eingang');
  });

  it('mehrere Dateien sind immer Unterlagen', async () => {
    const b = datei('HEFTABAK\x01\x01', 'a.hefta');
    expect(await eingangZiel([b, b])).toBe('eingang');
    expect(await eingangZiel([])).toBe('eingang');
  });

  it('die App leitet den Eingang darüber, und das Einspielen führt dann zur Übersicht (W39)', () => {
    const start = readFileSync('src/app/appStart.ts', 'utf-8');
    expect(start).toContain("(await eingangZiel(gelesen)) === 'backup'");
    expect(start).toContain("gehe('/einstellungen/einspielen')");
    const seite = readFileSync('src/screens/BackupEinspielen.svelte', 'utf-8');
    expect(seite).toContain('const vomStart = !daten.ansicht || vonAussen;');
    // DP103, Abschnitt 3: Der Link oben heißt wie das Ziel, also „Mappe“.
    expect(seite).toContain("? t('tabs.mappe')");
  });
});

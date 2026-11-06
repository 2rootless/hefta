import { describe, expect, it } from 'vitest';
import {
  BackupFehler,
  backupArt,
  backupErstellen,
  backupLesen,
  type BackupEintrag,
} from './backup';

// Weniger Runden nur hier, damit die Tests schnell bleiben; das Format speichert die Rundenzahl.
const RUNDEN_TEST = 1000;

function zufall(laenge: number, saat: number): Uint8Array<ArrayBuffer> {
  const daten = new Uint8Array(laenge);
  let x = saat;
  for (let i = 0; i < laenge; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    daten[i] = x >>> 24;
  }
  return daten;
}

function beispiel(): { pfad: string; bytes: Uint8Array<ArrayBuffer> }[] {
  return [
    {
      pfad: 'manifest.json',
      bytes: new TextEncoder().encode('{"format":"hefta-backup","version":1}'),
    },
    { pfad: 'dateien/leer', bytes: new Uint8Array(0) },
    { pfad: 'dateien/gross.jpg', bytes: zufall(9 * 1024 * 1024 + 123, 7) },
    { pfad: 'dateien/klein.pdf', bytes: zufall(5000, 3) },
  ];
}

function eintraege(): BackupEintrag[] {
  return beispiel().map(({ pfad, bytes }) => ({ pfad, daten: new Blob([bytes]) }));
}

/** Schneller Byte-Vergleich; toEqual ist bei Megabytes zu langsam. */
function gleich(a: Uint8Array | undefined, b: Uint8Array): boolean {
  return !!a && Buffer.compare(a, b) === 0;
}

async function einlesen(datei: Blob, passwort?: string) {
  const ergebnis = new Map<string, Uint8Array>();
  await backupLesen(datei, passwort, async ({ pfad, daten }) => {
    ergebnis.set(pfad, new Uint8Array(await daten.arrayBuffer()));
  });
  return ergebnis;
}

async function fehlerGrund(versprechen: Promise<unknown>) {
  try {
    await versprechen;
  } catch (e) {
    if (e instanceof BackupFehler) return e.grund;
    throw e;
  }
  return 'kein Fehler';
}

describe('Backup', () => {
  it('ohne Passwort ist ein offenes ZIP und kommt identisch zurück', async () => {
    const datei = await backupErstellen(eintraege());
    expect(await backupArt(datei)).toBe('offen');
    const zurueck = await einlesen(datei);
    for (const { pfad, bytes } of beispiel()) expect(gleich(zurueck.get(pfad), bytes)).toBe(true);
  });

  it('mit Passwort ist verschlüsselt und kommt identisch zurück', async () => {
    const datei = await backupErstellen(eintraege(), 'Sommer in Hamburg', RUNDEN_TEST);
    expect(await backupArt(datei)).toBe('verschluesselt');
    const roh = new Uint8Array(await datei.arrayBuffer());
    expect(new TextDecoder('latin1').decode(roh)).not.toContain('manifest.json');
    const zurueck = await einlesen(datei, 'Sommer in Hamburg');
    expect([...zurueck.keys()]).toEqual(beispiel().map((e) => e.pfad));
    for (const { pfad, bytes } of beispiel()) expect(gleich(zurueck.get(pfad), bytes)).toBe(true);
  });

  it('meldet falsches oder fehlendes Passwort klar', async () => {
    const datei = await backupErstellen(eintraege(), 'richtig', RUNDEN_TEST);
    expect(await fehlerGrund(einlesen(datei, 'falsch'))).toBe('passwort_falsch');
    expect(await fehlerGrund(einlesen(datei))).toBe('passwort_noetig');
  });

  it('erkennt veränderte und abgeschnittene Dateien', async () => {
    const datei = await backupErstellen(eintraege(), 'richtig', RUNDEN_TEST);
    const roh = new Uint8Array(await datei.arrayBuffer());

    const veraendert = roh.slice();
    veraendert[5 * 1024 * 1024] = (veraendert[5 * 1024 * 1024] ?? 0) ^ 0xff;
    expect(await fehlerGrund(einlesen(new Blob([veraendert]), 'richtig'))).toBe('beschaedigt');

    // Genau an einer Blockgrenze abgeschnitten: der letzte vorhandene Block war nicht der letzte.
    const ersterBlock = 42 + 16 + 4 + new DataView(roh.buffer).getUint32(42 + 16);
    const abgeschnitten = roh.slice(0, ersterBlock);
    expect(await fehlerGrund(einlesen(new Blob([abgeschnitten]), 'richtig'))).toBe('beschaedigt');
  });

  it('erkennt fremde Dateien und neuere Formate', async () => {
    expect(await fehlerGrund(einlesen(new Blob(['Hallo'])))).toBe('kein_backup');
    const datei = await backupErstellen(eintraege(), 'richtig', RUNDEN_TEST);
    const roh = new Uint8Array(await datei.arrayBuffer());
    roh[8] = 2;
    expect(await fehlerGrund(einlesen(new Blob([roh]), 'richtig'))).toBe('version_neu');
  });
});

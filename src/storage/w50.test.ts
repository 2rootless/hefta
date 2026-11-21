// W50 (DP103, DP106): die Zahl der Hefte im Backup. BK1 bis BK4, BK7 und BK8 mit Gegenproben.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEINE_EREIGNISSE, neueId } from '../domain/modell';
import { t } from '../i18n';
import { backupWort } from '../ui/backupWort';
import { datenbankOeffnen, type HeftaDb } from './db';
import { bestandAusDb, bestandZaehlen, sicherungErstellen, sicherungVorschau } from './sicherung';
import { heftAendern, heftAnlegen } from './speicher';

const RUNDEN_TEST = 1000;

const entwurf = (n: number) => ({
  haushaltId: null,
  adresse: `Möwenschlag ${n}\n20259 Hamburg`,
  link: null,
  quelle: 'Inserat',
  inseratText: null,
  angaben: undefined,
});

/** Musterzustand für BK1: 3 gemerkte und 1 abgelegtes Heft. */
async function vierHefte(): Promise<HeftaDb> {
  const db = await datenbankOeffnen(`test-${neueId()}`);
  for (let n = 1; n <= 3; n++) await heftAnlegen(db, entwurf(n));
  const abgelegt = await heftAnlegen(db, entwurf(4));
  await heftAendern(db, abgelegt.id, {
    ereignisse: { ...KEINE_EREIGNISSE, abgelegtAm: new Date().toISOString() },
  });
  return db;
}

const satz = (hefte: number, unterlagen: number) => ({
  hefte: t('zahlen.hefte', { anzahl: hefte }),
  unterlagen: t('zahlen.unterlagen', { anzahl: unterlagen }),
});

describe('W50: Hefte im Backup', () => {
  it('BK1: abgelegte zählen mit, „4 Hefte“ in der App und im Backup ohne Passwort', async () => {
    const db = await vierHefte();
    expect((await bestandAusDb(db)).hefte).toBe(4);
    const vorschau = await sicherungVorschau(await sicherungErstellen(db, undefined, '2.1'));
    expect(vorschau.bestand.hefte).toBe(4);
    expect(t('zahlen.hefte', { anzahl: vorschau.bestand.hefte })).toBe('4 Hefte');
  });

  it('Gegenprobe BK1: nur gemerkte Hefte zu zählen ergäbe 3', async () => {
    const db = await vierHefte();
    const hefte = await db.getAll('hefte');
    expect(hefte.filter((h) => !h.ereignisse.abgelegtAm).length).toBe(3);
    expect((await bestandAusDb(db)).hefte).not.toBe(3);
  });

  it('BK2: mit Passwort erst nach dem richtigen Passwort, nach falschem keine Zahl', async () => {
    const db = await vierHefte();
    const datei = await sicherungErstellen(db, 'geheimnis', '2.1', RUNDEN_TEST);
    await expect(sicherungVorschau(datei, 'falsch')).rejects.toMatchObject({
      grund: 'passwort_falsch',
    });
    expect((await sicherungVorschau(datei, 'geheimnis')).bestand.hefte).toBe(4);
    // Vor dem Passwort steht in „Im Backup“ nur der Satz, keine Zahl (Seite: {:else} mit nachPasswort).
    const seite = readFileSync('src/screens/BackupEinspielen.svelte', 'utf-8');
    const block = seite.slice(seite.indexOf("t('einspielenSeite.imBackup')"));
    expect(block.indexOf('zahlen.hefte')).toBeLessThan(block.indexOf('nachPasswort'));
    expect(t('einspielenSeite.nachPasswort')).not.toMatch(/\d/);
  });

  it('BK3: 0 Hefte ist „0 Hefte“, 1 Heft „1 Heft“; Gegenprobe: leer ist nie 1', () => {
    expect(bestandZaehlen({}).hefte).toBe(0);
    expect(t('zahlen.hefte', { anzahl: 0 })).toBe('0 Hefte');
    expect(t('zahlen.hefte', { anzahl: 1 })).toBe('1 Heft');
    expect(bestandZaehlen({ hefte: [] }).hefte).not.toBe(1);
  });

  it('BK4: „Gesichert: …“ mit den Zahlen der Datei, die man danach einspielt', async () => {
    const db = await vierHefte();
    const b = await bestandAusDb(db);
    const vorschau = await sicherungVorschau(await sicherungErstellen(db, undefined, '2.1'));
    expect(vorschau.bestand.hefte).toBe(b.hefte);
    expect(vorschau.bestand.unterlagen).toBe(b.unterlagen);
    expect(t('einstellungen.gesichert', satz(4, 0))).toBe(
      'Gesichert: 4 Hefte und 0 Unterlagen. Letztes Backup: gerade eben.',
    );
    expect(t('einstellungen.gesichert', satz(1, 1))).toBe(
      'Gesichert: 1 Heft und 1 Unterlage. Letztes Backup: gerade eben.',
    );
    expect(t('backupSeite.fertigZahlen', satz(4, 4))).toBe(
      'Backup ist fertig: 4 Hefte und 4 Unterlagen.',
    );
  });

  it('BK7: reiner Download sagt „Download gestartet“, ihr und du; Gegenprobe: nie „Gesichert“', async () => {
    const { anrede } = await import('../i18n/anrede.svelte');
    const vorher = anrede.wert;
    anrede.wert = 'ihr';
    const ihr = t('einstellungen.downloadGestartet', satz(4, 4));
    anrede.wert = 'du';
    const du = t('einstellungen.downloadGestartet', satz(4, 4));
    anrede.wert = vorher;
    expect(ihr).toBe(
      'Download gestartet: 4 Hefte und 4 Unterlagen. Schaut dort nach, wo euer Browser Downloads ablegt, ob das Backup da ist.',
    );
    expect(du).toBe(
      'Download gestartet: 4 Hefte und 4 Unterlagen. Schau dort nach, wo dein Browser Downloads ablegt, ob das Backup da ist.',
    );
    for (const s of [ihr, du]) expect(s).not.toContain('Gesichert');
    // Der Download-Link der Seite meldet den Download, nicht ein Backup.
    const seite = readFileSync('src/screens/BackupErstellen.svelte', 'utf-8');
    expect(seite).toContain("onclick={() => void gesichert('download')}");
  });

  it('BK8: nach reinem Download „Letzter Download“; nach Teilen oder in der App „Letztes Backup“', () => {
    const texte = [
      t('backupZeile.heute'),
      t('uebersicht.backupAlt', { anzahl: 3 }),
      t('loeschenSeite.backupVor', { anzahl: 3 }),
    ];
    for (const s of texte) {
      expect(backupWort(s, { letztesBackupWeg: 'download' })).toContain('Letzter Download');
      expect(backupWort(s, { letztesBackupWeg: 'download' })).not.toContain('Letztes Backup');
      // Gegenprobe: ohne Download bleibt „Letztes Backup“.
      expect(backupWort(s, { letztesBackupWeg: null })).toContain('Letztes Backup');
    }
    expect(
      backupWort(t('loeschenSeite.backupVor', { anzahl: 3 }), { letztesBackupWeg: 'download' }),
    ).toBe('Letzter Download vor 3 Tagen.');
    // Alle drei Stellen aus DP106 und „Person löschen“ nehmen das Wort.
    for (const p of [
      'src/ui/BackupZeile.svelte',
      'src/screens/Uebersicht.svelte',
      'src/screens/AllesLoeschen.svelte',
      'src/screens/PersonLoeschen.svelte',
    ])
      expect(readFileSync(p, 'utf-8')).toContain('backupWort(');
  });

  it('„Alles löschen?“ zählt Hefte, nicht Bewerbungen', () => {
    expect(t('loeschenSeite.hefte', { anzahl: 4 })).toBe('4 Hefte mit Fotos und Notizen');
    expect(t('loeschenSeite.hefte', { anzahl: 1 })).toBe('1 Heft mit Fotos und Notizen');
    expect(readFileSync('src/screens/AllesLoeschen.svelte', 'utf-8')).not.toContain(
      'loeschenSeite.bewerbungen',
    );
  });
});

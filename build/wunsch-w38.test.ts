import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKUP_ZEICHEN, backupZeichen } from '../src/ui/backupZeichen';

// wunsch-W38 (Fassung 26, PC130 K12): Das App-Symbol erscheint nur dort, wo das Betriebssystem die App zeigt. Ein
// Hefta-Backup (.hefta) bekam in „Dateien“ und im Teilen-Blatt das App-Symbol, weil sein Dateityp kein eigenes Bild
// hatte. Jetzt trägt der Typ „Hefta-Backup“ ein eigenes Dokumentbild, seit PC140 Designs Zweitblatt
// (design/backup-zeichen/, DP88). Gegenproben: das App-Symbol selbst wird als App-Symbol erkannt, und eine Info.plist ohne
// Dokumentbild wird rot.

const PLIST = 'ios/App/App/Info.plist';
const PROJEKT = 'ios/App/App.xcodeproj/project.pbxproj';
const ORDNER = 'ios/App/App/Dokumentbild';
const APP_SYMBOL = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';

const hash = (pfad: string) => createHash('sha256').update(readFileSync(pfad)).digest('hex');
const appSymbole = new Set(
  readdirSync(APP_SYMBOL)
    .filter((f) => f.endsWith('.png'))
    .map((f) => hash(`${APP_SYMBOL}/${f}`)),
);
const istAppSymbol = (pfad: string) => appSymbole.has(hash(pfad));

/** Die Dateien, die der Typ „Hefta-Backup“ als Dokumentbild nennt. */
function dokumentBilder(plist: string): string[] {
  const typ = /<string>Hefta-Backup<\/string>([\s\S]*?)<\/dict>/.exec(plist)?.[1] ?? '';
  const liste =
    /<key>CFBundleTypeIconFiles<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(typ)?.[1] ?? '';
  return [...liste.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]!);
}

const BILDER = [
  'HeftaBackup-22x29.png',
  'HeftaBackup-44x58.png',
  'HeftaBackup-66x87.png',
  'HeftaBackup-64.png',
  'HeftaBackup-320.png',
];

/** P6: Was der Typ „Hefta-Backup“ fürs iPhone noch nicht nennt (Dokumenttyp und exportierter Typ). */
function fehltFuerIphone(plist: string): string[] {
  const fehlt: string[] = [];
  const doku = dokumentBilder(plist);
  for (const b of BILDER.slice(0, 3))
    if (!doku.includes(b)) fehlt.push(`CFBundleTypeIconFiles: ${b}`);
  const export_ = /<string>de\.hefta\.backup<\/string>([\s\S]*?)<\/dict>\s*<\/array>/.exec(
    plist.slice(plist.indexOf('<key>UTExportedTypeDeclarations</key>')),
  )?.[1];
  const liste =
    export_ && /<key>UTTypeIconFiles<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(export_)?.[1];
  if (!liste) fehlt.push('UTTypeIconFiles fehlt');
  else
    for (const b of BILDER)
      if (!liste.includes(`<string>${b}</string>`)) fehlt.push(`UTTypeIconFiles: ${b}`);
  return fehlt;
}

function groesse(pfad: string): [number, number] {
  const d = readFileSync(pfad);
  return [d.readUInt32BE(16), d.readUInt32BE(20)];
}

describe('wunsch-W38: App-Symbol nur als App-Symbol', () => {
  const plist = readFileSync(PLIST, 'utf8');
  const projekt = readFileSync(PROJEKT, 'utf8');

  it('der Typ „Hefta-Backup“ trägt ein eigenes Dokumentbild, 64 und 320 Punkt, je @1x bis @3x', () => {
    expect(dokumentBilder(plist)).toEqual(BILDER);
    for (const [basis, pt] of [
      ['HeftaBackup-64', 64],
      ['HeftaBackup-320', 320],
    ] as const)
      for (const [zusatz, faktor] of [
        ['', 1],
        ['@2x', 2],
        ['@3x', 3],
      ] as const) {
        const datei = `${basis}${zusatz}.png`;
        const pfad = `${ORDNER}/${datei}`;
        expect(existsSync(pfad), datei).toBe(true);
        expect(groesse(pfad), datei).toEqual([pt * faktor, pt * faktor]);
        // Im Bündel der App, also in den Ressourcen des Projekts.
        expect(projekt, datei).toContain(`/* ${datei} in Resources */,`);
      }
  });

  // PC149/PC150 (P6): 2.0.1 zeigte in „Dateien“ am iPhone weiter das App-Symbol auf einem Blatt, auch nach einem
  // Neustart. Die Liste nannte nur die Größen fürs iPad, und der exportierte Typ trug kein Bild.
  it('P6: Größen fürs iPhone (22 × 29, 44 × 58, 66 × 87 px), auch am exportierten Typ', () => {
    expect(fehltFuerIphone(plist)).toEqual([]);
    for (const [w, h] of [
      [22, 29],
      [44, 58],
      [66, 87],
    ] as const) {
      const datei = `HeftaBackup-${w}x${h}.png`;
      expect(groesse(`${ORDNER}/${datei}`), datei).toEqual([w, h]);
      expect(projekt, datei).toContain(`/* ${datei} in Resources */,`);
    }
  });

  it('Gegenprobe P6: die Info.plist von 2.0.1 wird rot', () => {
    const alt = plist
      .replace(/<key>UTTypeIconFiles<\/key>\s*<array>[\s\S]*?<\/array>/, '')
      .replace(
        /(<key>CFBundleTypeIconFiles<\/key>\s*<array>)[\s\S]*?(<\/array>)/,
        '$1<string>HeftaBackup-64.png</string><string>HeftaBackup-320.png</string>$2',
      );
    expect(fehltFuerIphone(alt)).toEqual([
      'CFBundleTypeIconFiles: HeftaBackup-22x29.png',
      'CFBundleTypeIconFiles: HeftaBackup-44x58.png',
      'CFBundleTypeIconFiles: HeftaBackup-66x87.png',
      'UTTypeIconFiles fehlt',
    ]);
  });

  it('kein Dokumentbild ist das App-Symbol', () => {
    for (const f of readdirSync(ORDNER)) expect(istAppSymbol(`${ORDNER}/${f}`), f).toBe(false);
  });

  // PC140 (DP88, E259): Zweitblatt. Das Dokumentbild gilt für jedes Backup, mit und ohne Passwort (ein Dateityp,
  // eine Endung). Darum trägt es keinen Schlüssel (W10). Der Schlüssel ist in Designs Zeichen der einzige Kreis.
  const traegtSchluessel = (svg: string) => svg.includes('<circle');
  const QUELLE = 'design/backup-zeichen';

  it('Dokumentbild ist Designs Zweitblatt ohne Schlüssel (DP88)', () => {
    for (const pt of [64, 320])
      for (const [zusatz, faktor] of [
        ['', 1],
        ['@2x', 2],
        ['@3x', 3],
      ] as const) {
        const bild = hash(`${ORDNER}/HeftaBackup-${pt}${zusatz}.png`);
        expect(bild, `${pt}${zusatz}`).toBe(hash(`${QUELLE}/hefta-backup-${pt}pt@${faktor}x.png`));
        expect(bild, `${pt}${zusatz}`).not.toBe(
          hash(`${QUELLE}/hefta-backup-mit-passwort-${pt}pt@${faktor}x.png`),
        );
      }
  });

  it('in der App: ohne Passwort das Zeichen ohne Schlüssel, mit Passwort mit Schlüssel (W10)', () => {
    const datei = (f: string) => readFileSync(`src/assets/${f}`, 'utf8');
    expect(traegtSchluessel(datei(BACKUP_ZEICHEN.ohne))).toBe(false);
    expect(traegtSchluessel(datei(BACKUP_ZEICHEN.mit))).toBe(true);
    expect(backupZeichen(false)).toContain('hefta-backup');
    expect(backupZeichen(false)).not.toContain('mit-passwort');
    expect(backupZeichen(true)).toContain('mit-passwort');
    // Die Zeichen sind Designs Fassung, unverändert.
    expect(datei(BACKUP_ZEICHEN.ohne)).toBe(readFileSync(`${QUELLE}/hefta-backup.svg`, 'utf8'));
    expect(datei(BACKUP_ZEICHEN.mit)).toBe(
      readFileSync(`${QUELLE}/hefta-backup-mit-passwort.svg`, 'utf8'),
    );
  });

  it('Gegenprobe: ein Schlüssel am Zeichen ohne Passwort wird rot', () => {
    const ohne = readFileSync(`src/assets/${BACKUP_ZEICHEN.ohne}`, 'utf8');
    const falsch = ohne.replace('</svg>', '<circle cx="45" cy="51" r="8.2"/></svg>');
    expect(traegtSchluessel(falsch)).toBe(true);
    // Auch ein vertauschtes Dokumentbild fiele auf: das Bild mit Schlüssel ist ein anderes.
    expect(hash(`${QUELLE}/hefta-backup-mit-passwort-64pt@1x.png`)).not.toBe(
      hash(`${ORDNER}/HeftaBackup-64.png`),
    );
  });

  it('Gegenprobe: das App-Symbol wird erkannt, und ohne Dokumentbild ist die Liste leer', () => {
    const eins = readdirSync(APP_SYMBOL).find((f) => f.endsWith('.png'))!;
    expect(istAppSymbol(`${APP_SYMBOL}/${eins}`)).toBe(true);
    const ohne = plist.replace(/<key>CFBundleTypeIconFiles<\/key>\s*<array>[\s\S]*?<\/array>/, '');
    expect(dokumentBilder(ohne)).toEqual([]);
  });
});

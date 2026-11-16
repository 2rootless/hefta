import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// CP47: In src/app/global.css stand vom 15.11. (PC36) bis zum 16.11. statt `\00a0` ein Null-Byte mit „a0“.
// Ein Skript hatte den Backslash geschluckt; im Browser stand darum „Zum Übertragen�a0›“. Dieser Wächter
// findet jedes Steuerzeichen in Quelltexten (außer Tab, Zeilenumbruch und Wagenrücklauf).

const ORDNER = ['src', 'data', 'tests', 'scripts', 'vermieter'];
const ENDUNGEN = /\.(ts|svelte|css|json|js|mjs|html)$/;

/** Steuerzeichen in einem Text als „Zeile:Spalte U+00XX“. */
export function steuerzeichen(inhalt: Buffer): string[] {
  const funde: string[] = [];
  let zeile = 1;
  let spalte = 1;
  for (const b of inhalt) {
    if (b === 10) {
      zeile += 1;
      spalte = 1;
      continue;
    }
    if (b < 32 && b !== 9 && b !== 13)
      funde.push(`${zeile}:${spalte} U+${b.toString(16).padStart(4, '0').toUpperCase()}`);
    spalte += 1;
  }
  return funde;
}

function dateien(ordner: string): string[] {
  let liste: string[] = [];
  let eintraege: string[];
  try {
    eintraege = readdirSync(ordner);
  } catch {
    return [];
  }
  for (const name of eintraege) {
    if (name === 'node_modules' || name === 'fonts') continue;
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) liste = liste.concat(dateien(pfad));
    else if (ENDUNGEN.test(name)) liste.push(pfad);
  }
  return liste;
}

describe('Quelltexte ohne Steuerzeichen', () => {
  it('kein Null-Byte und kein anderes Steuerzeichen in src, data, tests, scripts, vermieter', () => {
    const funde = ORDNER.flatMap(dateien).flatMap((pfad) =>
      steuerzeichen(readFileSync(pfad)).map((f) => `${pfad.replace(/\\/g, '/')} ${f}`),
    );
    expect(funde).toEqual([]);
  });

  it('Gegenprobe: das Null-Byte aus global.css und ein Backspace werden gefunden', () => {
    const css = Buffer.concat([
      Buffer.from(".textlink.weiter::after {\n  content: '"),
      Buffer.from([0]),
      Buffer.from("a0›';\n}\n"),
    ]);
    expect(steuerzeichen(css)).toEqual(['2:13 U+0000']);
    expect(steuerzeichen(Buffer.from([0x61, 0x08, 0x62]))).toEqual(['1:2 U+0008']);
    expect(steuerzeichen(Buffer.from('a\tb\r\nc'))).toEqual([]);
  });
});

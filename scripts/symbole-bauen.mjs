// Baut src/ui/symbolPfade.ts aus dem Symbolsatz des Designs (design/symbole-b11/svg/symbole.json,
// Fassung c, B11). Aufruf: node scripts/symbole-bauen.mjs. Die erzeugte Datei nie von Hand ändern.
import fs from 'node:fs';

const quelle = JSON.parse(fs.readFileSync('design/symbole-b11/svg/symbole.json', 'utf8'));
const eintraege = Object.entries(quelle.symbole).map(([name, s]) => {
  const teile = [
    `voll: ${JSON.stringify(s.voll)}`,
    ...(s.kern ? [`kern: ${JSON.stringify(s.kern)}`] : []),
    `wort: ${JSON.stringify(s.wort)}`,
    `groessen: ${JSON.stringify(s.groessen)}`,
  ];
  return `  ${JSON.stringify(name)}: { ${teile.join(', ')} },`;
});

const inhalt = `// Erzeugt von scripts/symbole-bauen.mjs aus design/symbole-b11/svg/symbole.json (Fassung ${quelle.fassung}).
// Nicht von Hand ändern.

export interface SymbolForm {
  /** Volle Form, ab 20 px. */
  voll: string[];
  /** Kernform für 12 und 16 px, nur in einem Stein oder Kreis. */
  kern?: string[];
  /** Wort für Screenreader, wenn das Symbol allein steht. */
  wort: string;
  groessen: number[];
}

/** Strich je Größe in Einheiten des 32er-Rasters. */
export const STRICH: Record<number, number> = ${JSON.stringify(
  Object.fromEntries(Object.entries(quelle.strich_je_groesse).map(([k, v]) => [k, v])),
)};

export const SYMBOLE = {
${eintraege.join('\n')}
} satisfies Record<string, SymbolForm>;

export type SymbolName = keyof typeof SYMBOLE;
`;
fs.writeFileSync('src/ui/symbolPfade.ts', inhalt);
console.log(`${Object.keys(quelle.symbole).length} Symbole geschrieben.`);

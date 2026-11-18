// V13 (E223): Doppelte Schlüssel werden abgelehnt. `JSON.parse` nimmt still den letzten Wert; darum geht dieser
// Durchlauf einmal über den Text und vergleicht die Schlüssel je Objekt. Er ersetzt das Parsen nicht: Was er
// annimmt, liest danach `JSON.parse`. Schlüssel werden mit `JSON.parse` dekodiert, so dass "a" und "a" gleich sind.

const ANF = 34; // "
const RUECK = 92; // Backslash

/**
 * Der erste doppelte Schlüssel in einem JSON-Text; null, wenn es keinen gibt; undefined, wenn der Text an einer
 * Stelle nicht wie JSON aussieht (dann lehnt `JSON.parse` ihn ohnehin ab).
 */
export function doppelterSchluessel(text: string): string | null | undefined {
  // Je offenes Objekt die Menge seiner Schlüssel; für Listen null.
  const stapel: (Set<string> | null)[] = [];
  // Erwartet das offene Objekt als Nächstes einen Schlüssel?
  let schluesselErwartet = false;
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === ANF) {
      let j = i + 1;
      while (j < text.length && text.charCodeAt(j) !== ANF)
        j += text.charCodeAt(j) === RUECK ? 2 : 1;
      if (j >= text.length) return undefined;
      if (schluesselErwartet) {
        let name: string;
        try {
          name = JSON.parse(text.slice(i, j + 1)) as string;
        } catch {
          return undefined;
        }
        const menge = stapel[stapel.length - 1];
        if (!menge) return undefined;
        if (menge.has(name)) return name;
        menge.add(name);
        schluesselErwartet = false;
      }
      i = j + 1;
      continue;
    }
    const z = text[i];
    if (z === '{') {
      stapel.push(new Set());
      schluesselErwartet = true;
    } else if (z === '[') {
      stapel.push(null);
      schluesselErwartet = false;
    } else if (z === '}' || z === ']') {
      if (!stapel.length) return undefined;
      stapel.pop();
      schluesselErwartet = false;
    } else if (z === ',') {
      schluesselErwartet = stapel[stapel.length - 1] instanceof Set;
    }
    i++;
  }
  return stapel.length ? undefined : null;
}

// W60 (DP135, Abschnitt 3; PC208, Schritt 1): Eine Anschrift steht in jedem Formular in drei Feldern, „Straße und
// Hausnummer“, „PLZ“ und „Ort“, wie im Musterbogen und in der Probe zu E111. Gespeichert wird sie getrennt; für alles,
// was eine Zeile braucht (Nachricht ans Inserat, ältere Leser), gibt es den Text daraus.

export interface Anschrift {
  strasse: string;
  plz: string;
  ort: string;
}

export function leereAnschrift(): Anschrift {
  return { strasse: '', plz: '', ort: '' };
}

/** Nichts eingetragen. */
export function anschriftLeer(a: Anschrift | null | undefined): boolean {
  return !a || (!a.strasse.trim() && !a.plz.trim() && !a.ort.trim());
}

/** Alle drei Felder eingetragen. */
export function anschriftVollstaendig(a: Anschrift | null | undefined): boolean {
  return !!a && !!a.strasse.trim() && !!a.plz.trim() && !!a.ort.trim();
}

/** Welche der drei Felder fehlen, in der Reihenfolge auf dem Bogen; leer, wenn nichts oder alles da ist. */
export function anschriftLuecken(a: Anschrift | null | undefined): (keyof Anschrift)[] {
  if (anschriftLeer(a)) return [];
  return (['strasse', 'plz', 'ort'] as const).filter((k) => !a![k].trim());
}

/**
 * Eine deutsche Postleitzahl hat fünf Ziffern. Andere Länder haben andere Formen; darum ist das nur ein Hinweis zum
 * Nachsehen (W33), nie eine Sperre.
 */
export function plzSiehtGutAus(plz: string): boolean {
  const p = plz.trim();
  return !p || /^\d{5}$/.test(p);
}

/** Die zwei Zeilen für ein Blatt: „Lindenring 3“ und „20259 Hamburg“. Leere fallen weg. */
export function anschriftZeilen(a: Anschrift | null | undefined): string[] {
  if (!a) return [];
  return [a.strasse.trim(), [a.plz.trim(), a.ort.trim()].filter(Boolean).join(' ')].filter(Boolean);
}

/** In einer Zeile, mit Komma: „Lindenring 3, 20259 Hamburg“. */
export function anschriftText(a: Anschrift | null | undefined): string {
  return anschriftZeilen(a).join(', ');
}

/**
 * Liest eine Anschrift aus einer Zeile, wie ältere Daten sie haben („Lindenring 3, 20259 Hamburg“, auch mit
 * Zeilenumbruch). Findet sich keine Postleitzahl, bleibt der ganze Text in „Straße und Hausnummer“: Nichts geht
 * verloren, und wer es sieht, kann es selbst aufteilen.
 */
export function anschriftAusText(text: string | null | undefined): Anschrift {
  const roh = (text ?? '').trim();
  if (!roh) return leereAnschrift();
  const teile = roh
    .split(/\s*[,\n]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (let i = teile.length - 1; i > 0; i--) {
    const m = /^(\d{5})\s+(.+)$/.exec(teile[i]!);
    if (m)
      return {
        strasse: teile.slice(0, i).join(', '),
        plz: m[1]!,
        ort: [m[2]!, ...teile.slice(i + 1)].join(', '),
      };
  }
  return { strasse: roh.replace(/\s*\n\s*/g, ', '), plz: '', ort: '' };
}

/** Für die Speicherung: getrimmt, als einfaches Objekt (IndexedDB klont keine Proxys). */
export function anschriftGetrimmt(a: Anschrift): Anschrift {
  return { strasse: a.strasse.trim(), plz: a.plz.trim(), ort: a.ort.trim() };
}

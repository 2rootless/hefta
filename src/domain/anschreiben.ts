// Version 2, Anschreiben-Vorlage (docs/10-version-2.md, B6; CLAUDE.md erlaubt das Anschreiben als
// erzeugtes Dokument). Text mit Platzhaltern in geschweiften Klammern, je Wohnung gefüllt.
// Unbekannte Platzhalter bleiben stehen, damit nichts still verschwindet.

export interface Anschreiben {
  betreff: string;
  text: string;
}

export const PLATZHALTER = [
  'anrede',
  'adresse',
  'namen',
  'personen',
  'einzug',
  'kontakt',
  'ort',
  'datum',
] as const;
export type Platzhalter = (typeof PLATZHALTER)[number];

/** Entwurf einer neutralen Vorlage; der Wortlaut wird vor Version 2 mit dem Design abgestimmt. */
export function standardVorlage(): Anschreiben {
  return {
    betreff: 'Bewerbung um die Wohnung {adresse}',
    text: [
      '{anrede}',
      '',
      'wir interessieren uns für die Wohnung {adresse} und bewerben uns hiermit. Einziehen würden {personen}.',
      '',
      'Unsere Unterlagen finden Sie in der beigefügten Mappe. Für eine Besichtigung richten wir uns gern nach Ihnen.',
      '',
      'Mit freundlichen Grüßen',
      '{namen}',
      '{kontakt}',
    ].join('\n'),
  };
}

/** Setzt die Werte ein. Leere Werte lassen auch die Zeile weg, wenn sie nur aus dem Platzhalter bestand. */
export function vorlageFuellen(
  vorlage: Anschreiben,
  werte: Partial<Record<Platzhalter, string>>,
): Anschreiben {
  const fuellen = (text: string) =>
    text
      .split('\n')
      .filter((zeile) => {
        const nur = zeile.trim().match(/^\{(\w+)\}$/);
        return !nur || !(nur[1]! in werte) || !!werte[nur[1] as Platzhalter]?.trim();
      })
      .join('\n')
      .replace(/\{(\w+)\}/g, (ganz, name: string) =>
        name in werte ? (werte[name as Platzhalter] ?? '') : ganz,
      );
  return { betreff: fuellen(vorlage.betreff), text: fuellen(vorlage.text) };
}

/** Platzhalter, die nach dem Füllen noch im Text stehen (Hinweis „Bitte noch ergänzen“). */
export function offenePlatzhalter(a: Anschreiben): string[] {
  return [...new Set([...`${a.betreff}\n${a.text}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
}

/** „Sehr geehrte Frau Schmidt,“ aus dem Ansprechpartner; ohne Namen neutral. */
export function anredeAus(name: string): string {
  const n = name.trim();
  if (/^frau\s/i.test(n)) return `Sehr geehrte ${n.replace(/^frau/i, 'Frau')},`;
  if (/^herr\s/i.test(n)) return `Sehr geehrter ${n.replace(/^herr/i, 'Herr')},`;
  return n ? `Guten Tag ${n},` : 'Sehr geehrte Damen und Herren,';
}

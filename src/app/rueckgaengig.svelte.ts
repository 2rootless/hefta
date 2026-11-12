// „Rückgängig“ statt Rückfrage (design/nachtraeglich-ordnen.md, OR7b): Die Zeile steht über der
// Hauptaktion, bis man die Seite verlässt oder etwas anderes tut. Ohne `dauerMs` keine Zeitgrenze; mit ihr
// verschwindet die Zeile danach von selbst (Fragen ausblenden, B25 n1: etwa 6 Sekunden, nicht weniger).

interface Eintrag {
  text: string;
  /** Auf dieser Seite bleibt sie stehen. */
  seite: string;
  ausfuehren: () => Promise<void>;
  /** Nach so vielen Millisekunden ist das Angebot vorbei. */
  dauerMs?: number;
}

export const rueck = $state<{ eintrag: Eintrag | null; leisten: number }>({
  eintrag: null,
  leisten: 0,
});

let uhr: ReturnType<typeof setTimeout> | null = null;

export function rueckgaengigAnbieten(eintrag: Eintrag): void {
  if (uhr) clearTimeout(uhr);
  uhr = null;
  rueck.eintrag = eintrag;
  if (eintrag.dauerMs)
    uhr = setTimeout(() => {
      if (rueck.eintrag?.text === eintrag.text && rueck.eintrag.seite === eintrag.seite)
        rueck.eintrag = null;
      uhr = null;
    }, eintrag.dauerMs);
}

export function rueckgaengigVergessen(): void {
  if (uhr) clearTimeout(uhr);
  uhr = null;
  rueck.eintrag = null;
}

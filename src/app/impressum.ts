import TEXT from '../../data/impressum.de.html?raw';

// Das Impressum kommt aus dem Datenschutz-Generator (Gratisfassung, 5.11.2026) und steht unverändert in
// data/impressum.de.html, ein Test prüft die Prüfsumme. Der Hinweis auf den Generator ist Bedingung der
// Gratisfassung und bleibt stehen. Ändert sich die Anschrift, kommt ein neuer Text aus dem Generator.

/**
 * Der Text für eine Seite, die schon „Impressum“ als Überschrift hat: ohne die eigene Hauptüberschrift, die
 * Abschnitte eine Ebene unter der Seite. Am Wortlaut ändert sich nichts.
 */
export function impressumHtml(ebene: 3 | 4): string {
  return TEXT.replaceAll('\r\n', '\n')
    .replace(/<h1>.*?<\/h1>\n?/, '')
    .replaceAll('<h2 ', `<h${ebene} `)
    .replaceAll('</h2>', `</h${ebene}>`);
}

/**
 * Die Mailadresse aus dem Impressum, für die Rückmeldung (E52, B17c): Hefta schickt selbst nichts, es öffnet
 * nur das Mailprogramm. Sie steht nur im Impressum; ändert es sich, folgt die Rückmeldung von selbst.
 */
export const RUECKMELDUNG_ADRESSE: string =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(TEXT)?.[0] ?? '';

/** `mailto:` mit Betreff; der Betreff „Mehrere Geräte“ zählt für die Schwelle aus E34. */
export function rueckmeldungLink(betreff: string): string {
  return `mailto:${RUECKMELDUNG_ADRESSE}?subject=${encodeURIComponent(betreff)}`;
}

// Namensabgleich beim Hinzufügen (design/person-und-haushalt.md, K1b): ohne Groß- und Kleinschreibung,
// „ae“ = „ä“, „oe“ = „ö“, „ue“ = „ü“, „ss“ = „ß“, Leerzeichen und Bindestriche gleich.

export function namensSchluessel(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[\s-]+/g, ' ');
}

export function gleicherName(
  a: { vorname: string; nachname: string },
  b: { vorname: string; nachname: string },
): boolean {
  return (
    !!a.vorname.trim() &&
    !!a.nachname.trim() &&
    namensSchluessel(a.vorname) === namensSchluessel(b.vorname) &&
    namensSchluessel(a.nachname) === namensSchluessel(b.nachname)
  );
}

// Name im PDF (design/person-und-haushalt.md, K8; design/mappe-pdf.md): Archivo schreibt Latein,
// Latein erweitert und Vietnamesisch. Alles andere ersetzt Hefta nie still, die Person trägt den
// Namen in lateinischen Buchstaben ein, wie im Pass.

export interface Name {
  vorname: string;
  nachname: string;
}

/** Buchstaben und Satzzeichen, die in allen drei PDF-Schnitten stehen (Test gegen die Schriftdateien). */
const IM_PDF =
  /^[\u0020-\u007E\u00A0-\u017F\u018F\u0192\u019D\u01A0\u01A1\u01AF\u01B0\u01C4-\u01DC\u01E6\u01E7\u01EA\u01EB\u01FA-\u021B\u022A-\u022D\u0230-\u0233\u0237\u0259\u0272\u02B9\u02BA\u02BC\u1E24\u1E25\u1E62\u1E63\u1E6C\u1E6D\u1E80-\u1E85\u1E9E\u1EA0-\u1EF9\u2010\u2011\u2013-\u2015\u2017-\u201A\u201C-\u201E\u2020-\u2022\u2026\u2030\u2032\u2033\u2039\u203A\u20AC\u2116\u2122]*$/;

export function imPdfSchreibbar(text: string): boolean {
  return IM_PDF.test(text.normalize('NFC').replace(/[\n\r\t]/g, ' '));
}

const nameSchreibbar = (n: Name) => imPdfSchreibbar(`${n.vorname} ${n.nachname}`);

/** Der Name kann so nicht ins PDF, und in lateinischen Buchstaben steht er noch nicht da. */
export function lateinFehlt(p: Name & { nameMappe?: Name | null }): boolean {
  if (nameSchreibbar(p)) return false;
  const m = p.nameMappe;
  return !m?.vorname.trim() || !m.nachname.trim() || !nameSchreibbar(m);
}

/** Was zum Speichern gehört: Ist der Name wieder schreibbar, zählt der lateinische nicht mehr. */
export function nameMappeAus(p: Name & { nameMappe?: Name | null }): Name | null {
  if (nameSchreibbar(p) || !p.nameMappe) return null;
  return { vorname: p.nameMappe.vorname.trim(), nachname: p.nameMappe.nachname.trim() };
}

/** Der Name, wie er im PDF steht. */
export function nameImPdf(p: Name & { nameMappe?: Name | null }): Name {
  const quelle = !nameSchreibbar(p) && p.nameMappe ? p.nameMappe : p;
  return {
    vorname: quelle.vorname.normalize('NFC').trim(),
    nachname: quelle.nachname.normalize('NFC').trim(),
  };
}

export const nameText = (n: Name) => `${n.vorname} ${n.nachname}`.trim();

const aufzaehlen = (teile: string[]) =>
  teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : (teile[0] ?? '');

/**
 * Der Haushalt in Fußzeile und Titel: nur wer im Vertrag steht, Nachnamen nie zusammengezogen.
 * „Max und Lea Mustermann“, „Max Mustermann und Lea Schmidt“, ab drei verschiedenen Personen mit
 * verschiedenen Nachnamen nur die Nachnamen.
 */
export function haushaltsZeile(vertrag: Name[]): string {
  const nachnamen = [...new Set(vertrag.map((p) => p.nachname.trim() || p.vorname.trim()))];
  if (nachnamen.length <= 1) {
    const vornamen = vertrag.map((p) => p.vorname.trim());
    const gemeinsam = vertrag[0]?.nachname.trim() ?? '';
    return `${aufzaehlen(vornamen)} ${gemeinsam}`.trim();
  }
  if (vertrag.length === 2) return vertrag.map(nameText).join(' und ');
  return aufzaehlen(nachnamen);
}

// Anbieter aus dem Text der Seite (Bauplan Zeile 4, „Anbieter aus der Seite“): für die Anrede im
// Anschreiben („Sehr geehrte Frau Hansen“) und als Empfänger in der Datenspur. Formen aus Probe 2:
// ImmoScout24 „Über den Anbieter“ mit der Firma darunter, Kleinanzeigen „Anbieter“ mit dem Namen darunter,
// dazu „Ansprechpartner(in): Frau …“ im Fließtext. Lieber nichts als etwas Falsches.

const KEIN_NAME =
  /^(privater nutzer|gewerblicher anbieter|anbieter kontaktieren|nachricht schreiben|kontakt|telefon|e-mail|mehr anzeigen|aktiv seit|anzeigen-id|▇+)\b/i;

function brauchbar(zeile: string | undefined): string | null {
  const z = (zeile ?? '').replace(/\s+/g, ' ').trim();
  if (z.length < 3 || z.length > 80) return null;
  if (KEIN_NAME.test(z)) return null;
  if (/▇/.test(z)) return null;
  if (!/\p{L}{2}/u.test(z)) return null;
  if (/\d{3,}/.test(z)) return null;
  return z;
}

export function anbieterLesen(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/\r/g, '');
  // „Ansprechpartnerin: Frau Hansen“, auch mit Zeilenumbruch nach dem Doppelpunkt.
  const ansprech =
    /Ansprech(?:partner(?:in)?|person)[ \t]*:?[ \t]*\n?[ \t]*((?:Frau|Herr)[ \t]+(?:Dr\.[ \t]+)?[A-ZÄÖÜ][\p{L}'-]+(?:[ \t]+[A-ZÄÖÜ][\p{L}'-]+)?)/u.exec(
      t,
    );
  if (ansprech) return ansprech[1]!.trim();
  const ueber = /Über den Anbieter\s*\n+\s*([^\n]+)/.exec(t);
  const a = brauchbar(ueber?.[1]);
  if (a) return a;
  const anbieter = /(?:^|\n)\s*Anbieter\s*\n+\s*([^\n]+)/.exec(t);
  return brauchbar(anbieter?.[1]);
}

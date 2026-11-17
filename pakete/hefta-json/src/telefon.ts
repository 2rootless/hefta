// Telefon in internationaler Form (E.164), nur wenn eindeutig (Abschnitt 8 der Beschreibung):
// „(0)“ und Trennzeichen fallen weg, „00“ wird „+“, eine einzelne führende „0“ heißt Deutschland.
// Danach müssen es „+“ und 7 bis 15 Ziffern sein, die erste nicht 0; sonst null.

export function telefonE164(telefon: string): string | null {
  let s = telefon.replace(/\(0\)/g, '').replace(/[\s/\-().]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  else if (s.startsWith('0')) s = `+49${s.slice(1)}`;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

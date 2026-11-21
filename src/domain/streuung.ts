// W37 (E190): feste Streuung für die Wahl einer Fassung. Gleicher Text, gleiche Zahl, auf jedem Gerät und in
// jeder Version; kein Zufall, nichts gespeichert. FNV-1a mit 32 Bit.

export function streuung(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

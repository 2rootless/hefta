// PC187: Die Grenze für ein PDF auf der Vermieterseite ist genau 100 000 000 Byte. Dann sagt der Satz
// „Größer als 100 MB“, was die Grenze ist (W10), gerechnet wie überall in Hefta (1 MB = 1 000 000 Byte).
export const GRENZE_BYTES = 100_000_000;

export function zuGross(bytes: number): boolean {
  return bytes > GRENZE_BYTES;
}

/**
 * PC81 U5: Die Version, wie Einstellungen sie zeigen. Eine Null am Ende fällt weg: aus „2.0.0“ wird „2.0“, aus
 * „2.0.1“ bleibt „2.0.1“. Die Nummer kommt aus package.json (der native Bau setzt 2.0.0 ebenso).
 */
export function versionKurz(version: string): string {
  return /^\d+\.\d+\.0$/.test(version) ? version.slice(0, -2) : version;
}

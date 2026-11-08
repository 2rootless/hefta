// Nimmt die Teilen-Probe („Hefta Probe“) aus dem Bau der App: Die App bettet die Erweiterung nicht mehr ein
// und hängt nicht mehr von ihr ab. Das Ziel selbst bleibt im Projekt. Läuft in GitHub vor dem Archiv für den
// Store, außer der Lauf will die Probe ausdrücklich (Eingabe „probe“). Ändert nur die Arbeitskopie des Laufs.
import { readFileSync, writeFileSync } from 'node:fs';

const DATEI = process.argv[2] ?? 'ios/App/App.xcodeproj/project.pbxproj';
const EINBETTEN = 'B1C2D3E4F500000000000013'; // HeftaProbe.appex in Embed Foundation Extensions
const ABHAENGIG = 'B1C2D3E4F500000000000051'; // App hängt von HeftaProbe ab

const vorher = readFileSync(DATEI, 'utf8');
const zeilen = vorher.split('\n');
const nachher = zeilen.filter(
  (z) => !z.includes(EINBETTEN) && !z.trim().startsWith(`${ABHAENGIG} /* PBXTargetDependency */,`),
);
const weg = zeilen.length - nachher.length;
// Erwartet: die Datei-Zeile, ihr Eintrag in der Phase „Embed“ und die Abhängigkeit im Ziel App.
if (weg !== 3) {
  console.error(`ohne-probe: ${weg} statt 3 Zeilen gefunden, das Projekt hat sich geändert`);
  process.exit(1);
}
writeFileSync(DATEI, nachher.join('\n'));
console.log('ohne-probe: Probe nicht eingebettet');

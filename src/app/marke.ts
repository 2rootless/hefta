// Marke für die Landingpage (B22, Bericht 33 Abschnitt 5): Liegt im selben Browser ein Haushalt, zeigt
// hefta.de „Eure Mappe öffnen“. Die Seite liest nur diesen einen Schlüssel, nie die Datenbank, und sendet
// nichts. Die Marke sagt nur „ja“, nichts über den Inhalt. Derselbe Schlüssel steht in web/hefta.js.

export const MARKE = 'hefta.haushalt';

export function markeSetzen(daIst: boolean): void {
  try {
    if (daIst) localStorage.setItem(MARKE, 'ja');
    else localStorage.removeItem(MARKE);
  } catch {
    // Privates Fenster oder gesperrter Speicher: Dann sieht die Seite aus wie für jeden neuen Besuch.
  }
}

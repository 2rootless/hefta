// PC137 (E255, DP86): Regel BF2b für die Muster auf Bildschirmfotos und Bildern (W7). Lindenring 3 und 8 stehen nur mit
// Eimsbüttel oder 20259 Hamburg; Musterweg 7 und Beispielstraße 1 nie mit einem Hamburger Stadtteil, nie mit „Hamburg“
// und nie mit 20259. Gesucht in der Zeile der Straße und den folgenden Zeilen (Design: drei). Die Liste der Stadtteile
// ist Designs Liste aus pruef_bf.py (amtliche Liste, dazu „Hoheluft“ ohne West/Ost, wie es Inserate schreiben).

export const MUSTERSTRASSEN = ['Lindenring 3', 'Lindenring 8', 'Musterweg 7', 'Beispielstraße 1'];

export const HAMBURGER_STADTTEILE = [
  'Hamburg-Altstadt',
  'HafenCity',
  'Neustadt',
  'St. Pauli',
  'St. Georg',
  'Hammerbrook',
  'Borgfelde',
  'Hamm',
  'Horn',
  'Billstedt',
  'Billbrook',
  'Rothenburgsort',
  'Veddel',
  'Wilhelmsburg',
  'Kleiner Grasbrook',
  'Steinwerder',
  'Waltershof',
  'Finkenwerder',
  'Neuwerk',
  'Altona-Altstadt',
  'Sternschanze',
  'Altona-Nord',
  'Ottensen',
  'Bahrenfeld',
  'Groß Flottbek',
  'Othmarschen',
  'Lurup',
  'Osdorf',
  'Nienstedten',
  'Blankenese',
  'Iserbrook',
  'Sülldorf',
  'Rissen',
  'Eimsbüttel',
  'Rotherbaum',
  'Harvestehude',
  'Hoheluft-West',
  'Hoheluft-Ost',
  'Hoheluft',
  'Lokstedt',
  'Niendorf',
  'Schnelsen',
  'Eidelstedt',
  'Stellingen',
  'Eppendorf',
  'Groß Borstel',
  'Alsterdorf',
  'Winterhude',
  'Uhlenhorst',
  'Hohenfelde',
  'Barmbek-Süd',
  'Dulsberg',
  'Barmbek-Nord',
  'Barmbek',
  'Ohlsdorf',
  'Fuhlsbüttel',
  'Langenhorn',
  'Eilbek',
  'Wandsbek',
  'Marienthal',
  'Jenfeld',
  'Tonndorf',
  'Farmsen-Berne',
  'Bramfeld',
  'Steilshoop',
  'Wellingsbüttel',
  'Sasel',
  'Poppenbüttel',
  'Hummelsbüttel',
  'Lemsahl-Mellingstedt',
  'Duvenstedt',
  'Wohldorf-Ohlstedt',
  'Bergstedt',
  'Volksdorf',
  'Rahlstedt',
  'Harburg',
  'Neuland',
  'Gut Moor',
  'Wilstorf',
  'Rönneburg',
  'Langenbek',
  'Sinstorf',
  'Marmstorf',
  'Eißendorf',
  'Heimfeld',
  'Moorburg',
  'Altenwerder',
  'Hausbruch',
  'Neugraben-Fischbek',
  'Francop',
  'Neuenfelde',
  'Cranz',
  'Bergedorf',
  'Lohbrügge',
  'Curslack',
  'Altengamme',
  'Neuengamme',
  'Kirchwerder',
  'Ochsenwerder',
  'Reitbrook',
  'Allermöhe',
  'Neuallermöhe',
  'Billwerder',
  'Moorfleet',
  'Tatenberg',
  'Spadenland',
];

const ZEILE = String.fromCharCode(10);
const RUECKLAUF = String.fromCharCode(13);
// „Zeilenumbruch“ im Quelltext einer Zeichenkette: Backslash und n.
const ZEILE_IM_TEXT = String.fromCharCode(92) + 'n';
const WORTZEICHEN = 'abcdefghijklmnopqrstuvwxyzäöüßABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789_-';

/** Steht `wort` als ganzes Wort in `text` (nicht „Hamm“ in „Hammerbrook“, nicht „Horn“ in „Hornbach“)? */
function ganzesWort(text: string, wort: string): boolean {
  for (let i = text.indexOf(wort); i >= 0; i = text.indexOf(wort, i + 1)) {
    const davor = i > 0 ? text[i - 1]! : ' ';
    const danach = text[i + wort.length] ?? ' ';
    if (!WORTZEICHEN.includes(davor) && !WORTZEICHEN.includes(danach)) return true;
  }
  return false;
}

/** Die falschen Paarungen im Text, etwa „Musterweg 7 mit Hoheluft“. */
export function bf2b(text: string, folgeZeilen = 3): string[] {
  const zeilen = text
    .split(RUECKLAUF)
    .join('')
    .split(ZEILE)
    .flatMap((z) => z.split(ZEILE_IM_TEXT));
  const falsch: string[] = [];
  zeilen.forEach((zeile, i) => {
    for (const strasse of MUSTERSTRASSEN) {
      if (!ganzesWort(zeile, strasse)) continue;
      const fenster = [
        zeile.slice(zeile.indexOf(strasse) + strasse.length),
        ...zeilen.slice(i + 1, i + 1 + folgeZeilen),
      ].join(' ');
      const orte = HAMBURGER_STADTTEILE.filter((o) => ganzesWort(fenster, o));
      if (fenster.includes('Hamburg') || fenster.includes('20259')) orte.push('Hamburg/20259');
      const erlaubt = strasse.startsWith('Lindenring') ? ['Eimsbüttel', 'Hamburg/20259'] : [];
      for (const ort of orte) if (!erlaubt.includes(ort)) falsch.push(`${strasse} mit ${ort}`);
    }
  });
  return falsch;
}

const ZIFFERN = '0123456789';

/** Alle Zahlen aus genau fünf Ziffern im Text, ohne Ziffern direkt davor oder danach. */
function postleitzahlen(text: string): string[] {
  const aus: string[] = [];
  let lauf = '';
  for (const z of text + ' ') {
    if (ZIFFERN.includes(z)) {
      lauf += z;
      continue;
    }
    if (lauf.length === 5) aus.push(lauf);
    lauf = '';
  }
  return aus;
}

/** Zeilen wie bei BF2b: echte Umbrüche und „Backslash n“ im Quelltext. */
function zeilenVon(text: string): string[] {
  return text
    .split(RUECKLAUF)
    .join('')
    .split(ZEILE)
    .flatMap((z) => z.split(ZEILE_IM_TEXT));
}

/** PC139: die Postleitzahl, die zu jeder Musterstraße gehört (W7, Fassung 10). */
export const PAARUNG: Record<string, string> = {
  'Lindenring 3': '20259',
  'Lindenring 8': '20259',
  'Musterweg 7': '12345',
  'Beispielstraße 1': '12345',
};

/**
 * BF2, Paarung (PC139): Steht hinter einer Musterstraße eine Postleitzahl (in ihrer Zeile und den
 * folgenden), ist es ihre eigene. „Musterweg 7, 2. OG, 00100 Musterstadt“ wird rot.
 */
export function bf2Paarung(text: string, folgeZeilen = 3): string[] {
  const zeilen = zeilenVon(text);
  const falsch: string[] = [];
  zeilen.forEach((zeile, i) => {
    for (const strasse of MUSTERSTRASSEN) {
      if (!ganzesWort(zeile, strasse)) continue;
      const fenster = [
        zeile.slice(zeile.indexOf(strasse) + strasse.length),
        ...zeilen.slice(i + 1, i + 1 + folgeZeilen),
      ].join(' ');
      for (const plz of postleitzahlen(fenster)) {
        if (plz !== PAARUNG[strasse]) falsch.push(`${strasse} mit ${plz}`);
      }
    }
  });
  return falsch;
}

/**
 * BF2 für Bildschirmfotos und Bilder (Designs pruef_bf.py, PC139): Jede Postleitzahl ist 20259, 12345 oder
 * eine erfundene 00xxx; dazu die Paarung der Musterstraßen.
 */
export function bf2(text: string, folgeZeilen = 3): string[] {
  const fremd = postleitzahlen(text)
    .filter((z) => z !== '20259' && z !== '12345' && !z.startsWith('00'))
    .map((z) => `Postleitzahl ${z}`);
  return [...fremd, ...bf2Paarung(text, folgeZeilen)];
}

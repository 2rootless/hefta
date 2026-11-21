// W30-Regel (PC167, Design): Der kurze Satz steht dort, wo man ihn liest, bevor man entscheidet.
// | Art | Lage | Abstand |
// | frage  (Ja/Nein oder Auswahl)          | klein unter der Frage, vor den Knöpfen | 4 px unter der Frage, 12 px zu den Knöpfen |
// | gruppe (Felder, die eine Angabe sind)   | oben in der Gruppe, vor dem ersten Feld | 12 px zum ersten Feld |
// | feld   (ein einzelnes Feld, eine Wahl) | unter dem Feld oder der Wahl           | 8 px unter dem Feld |

export type W30Art = 'frage' | 'gruppe' | 'feld';
export interface Kante {
  top: number;
  bottom: number;
}
export interface W30Lage {
  art: W30Art;
  text: string;
  satz: Kante;
  /** Das Element davor (Frage oder Feld) und danach (Knöpfe oder erstes Feld). */
  vorher: Kante | null;
  nachher: Kante | null;
}

const TOLERANZ = 1;

/** Fehler nach der Tabelle; leer, wenn der Satz an seiner Stelle liegt. */
export function lageFehler(l: W30Lage): string[] {
  const f: string[] = [];
  const name = `${l.art} „${l.text.slice(0, 30)}“`;
  const abstand = (soll: number, ist: number, wo: string) => {
    if (Math.abs(ist - soll) > TOLERANZ)
      f.push(`${name}: ${wo} ${Math.round(ist)} statt ${soll} px`);
  };
  if (l.art === 'frage') {
    if (!l.vorher || !l.nachher) return [`${name}: Frage oder Knöpfe fehlen`];
    abstand(4, l.satz.top - l.vorher.bottom, 'unter der Frage');
    abstand(12, l.nachher.top - l.satz.bottom, 'zu den Knöpfen');
  } else if (l.art === 'gruppe') {
    if (!l.nachher) return [`${name}: erstes Feld fehlt`];
    if (l.nachher.top < l.satz.bottom - TOLERANZ)
      f.push(`${name}: steht nicht vor dem ersten Feld`);
    else abstand(12, l.nachher.top - l.satz.bottom, 'zum ersten Feld');
  } else {
    if (!l.vorher) return [`${name}: Feld davor fehlt`];
    if (l.satz.top < l.vorher.bottom - TOLERANZ) f.push(`${name}: steht nicht unter dem Feld`);
    else abstand(8, l.satz.top - l.vorher.bottom, 'unter dem Feld');
  }
  return f;
}

/** Läuft in der Seite: alle sichtbaren Sätze mit `data-w30` und ihre Nachbarn. */
export const LAGEN_JS = `(() => [...document.querySelectorAll('[data-w30]')]
  .filter((e) => e.getClientRects().length)
  .map((e) => {
    // Unter Zoom (Text 130 %) sind die Maße der Seite größer; zurückgerechnet auf CSS-Pixel.
    const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const k = (x) => { if (!x) return null; const r = x.getBoundingClientRect(); return { top: r.top / z, bottom: r.bottom / z }; };
    const sichtbar = (x) => x && x.getClientRects().length;
    let vor = e.previousElementSibling;
    while (vor && !sichtbar(vor)) vor = vor.previousElementSibling;
    let nach = e.nextElementSibling;
    while (nach && !sichtbar(nach)) nach = nach.nextElementSibling;
    const art = e.getAttribute('data-w30');
    let satz = k(e);
    if (art === 'frage') {
      // Bei einer Frage zählt der Abstand zu den Knöpfen; stehen davor noch Sätze, vom letzten aus.
      let letzter = e;
      while (nach && !nach.querySelector('button')) { if (sichtbar(nach)) letzter = nach; nach = nach.nextElementSibling; }
      satz = { top: k(e).top, bottom: k(letzter).bottom };
    }
    return { art, text: e.textContent.trim(), satz, vorher: k(vor), nachher: k(nach) };
  }))()`;

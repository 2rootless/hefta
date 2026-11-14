// Muster „Heft aufschlagen / zuschlagen“ (Handbuch 3.9) über zwei Seiten hinweg: Liste „Wohnungen“ und
// Heft stehen nie gleichzeitig im DOM. Beim Tipp hält `merken()` ein Abbild der Seite, die geht, als
// Flugebene fest (fest über dem Bildschirm, ohne Eingaben). Die Seite, die kommt, ruft `landen()`; das
// Modul fliegt Bild und Namen vom Abbild in die neue Seite. Am Ende ist die Flugebene weg (P8), auch wenn
// eine Bewegung hängen bleibt (Sicherung des Laufs).

import { abschliessen, aufschlagen, lauf, type Richtung } from './bewegung';

interface Flug {
  /** Wohin es geht: ins Heft (auf) oder zurück in die Liste (zu). */
  nach: 'heft' | 'liste';
  heftId: string;
  ebene: HTMLDivElement;
  bild: HTMLElement | null;
  name: HTMLElement | null;
  teile: Element[];
  zeit: number;
}

let wartend: Flug | null = null;
/** Ein Flug, der nicht binnen dieser Zeit landet, verfällt (etwa, weil die Seite nie kam). */
const VERFALL_MS = 2000;

function ebeneWeg(f: Flug | null) {
  f?.ebene.remove();
}

/**
 * Vor dem Wechsel: das Abbild der Seite `seite` festhalten. `bild` und `name` sind Elemente in `seite`;
 * im Abbild werden ihre Gegenstücke gesucht. `teile` sind die übrigen Teile, die Platz machen.
 */
export function merken(o: {
  nach: 'heft' | 'liste';
  heftId: string;
  seite: HTMLElement;
  bild: HTMLElement | null;
  name: HTMLElement | null;
  teile: Element[];
}): void {
  abschliessen();
  ebeneWeg(wartend);
  const r = o.seite.getBoundingClientRect();
  const ebene = document.createElement('div');
  ebene.className = 'flug-ebene';
  ebene.setAttribute('aria-hidden', 'true');
  ebene.inert = true;
  Object.assign(ebene.style, {
    position: 'fixed',
    inset: '0',
    // Unter der neuen Seite: Sie liegt während des Flugs darüber (z-index 1), ihre Teile kommen im Takt.
    zIndex: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  const abbild = o.seite.cloneNode(true) as HTMLElement;
  abbild.removeAttribute('id');
  abbild.classList.add('flug-abbild');
  Object.assign(abbild.style, {
    position: 'absolute',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    margin: '0',
    minHeight: '0',
    background: 'var(--ground)',
  });
  ebene.append(abbild);
  // Gegenstücke im Abbild über den Pfad der Kinder finden.
  const gegen = (el: Element | null): HTMLElement | null => {
    if (!el) return null;
    const pfad: number[] = [];
    let k: Element | null = el;
    while (k && k !== o.seite) {
      const eltern: Element | null = k.parentElement;
      if (!eltern) return null;
      pfad.unshift([...eltern.children].indexOf(k));
      k = eltern;
    }
    let z: Element | undefined = abbild;
    for (const i of pfad) z = z?.children[i];
    return (z as HTMLElement | undefined) ?? null;
  };
  wartend = {
    nach: o.nach,
    heftId: o.heftId,
    ebene,
    bild: gegen(o.bild),
    name: gegen(o.name),
    teile: o.teile.map(gegen).filter((x): x is HTMLElement => !!x),
    zeit: Date.now(),
  };
  document.body.append(ebene);
}

/** Wartet ein Flug für diese Seite? */
export function flugFuer(nach: 'heft' | 'liste', heftId?: string): boolean {
  return (
    !!wartend &&
    wartend.nach === nach &&
    (heftId === undefined || wartend.heftId === heftId) &&
    Date.now() - wartend.zeit < VERFALL_MS
  );
}

/** Für welches Heft wartet ein Flug? (Die Liste sucht damit die Karte, auf der er landet.) */
export function wartendesHeft(): string | null {
  return wartend && Date.now() - wartend.zeit < VERFALL_MS ? wartend.heftId : null;
}

/** Die Zielseite ist da: fliegen. Gibt das Ende als Promise zurück. */
export function landen(o: {
  nach: 'heft' | 'liste';
  seite: HTMLElement;
  bild: HTMLElement | null;
  name: HTMLElement | null;
  teile: Element[];
}): Promise<void> {
  const f = wartend;
  wartend = null;
  if (!f || f.nach !== o.nach) {
    ebeneWeg(f);
    return Promise.resolve();
  }
  // Die Bewegung des Seitenwechsels darf nicht zusätzlich laufen.
  for (const a of o.seite.getAnimations()) a.cancel();
  // Die neue Seite liegt über dem Abbild; Bild und Name fliegen, der Rest kommt im Takt.
  const vorher = { position: o.seite.style.position, zIndex: o.seite.style.zIndex };
  o.seite.style.position = 'relative';
  o.seite.style.zIndex = '1';
  const r: Richtung = o.nach === 'heft' ? 1 : -1;
  const l = lauf();
  document.body.append(f.ebene);
  aufschlagen(l, {
    buehne: f.ebene,
    r,
    von: f.ebene.firstElementChild as HTMLElement,
    nach: o.seite,
    vonTeile: f.teile,
    nachTeile: o.teile,
    bildVon: f.bild,
    bildNach: o.bild,
    nameVon: f.name,
    nameNach: o.name,
  });
  l.danach(() => {
    f.ebene.remove();
    o.seite.style.position = vorher.position;
    o.seite.style.zIndex = vorher.zIndex;
  });
  l.start();
  return l.fertig;
}

/** Verfallene Flüge aufräumen (etwa, wenn die Seite nicht kam). */
export function flugVergessen(): void {
  ebeneWeg(wartend);
  wartend = null;
}

// Bewegung in Hefta (E58, E107): das Modul zum Handbuch `design/bewegung.md`. Jedes Muster dort hat hier
// eine Funktion mit demselben Namen (Referenz: `design/dp21/code/bewegung.js`). Neue Bewegungen entstehen
// nur über diese Muster. Dauern und Kurven kommen allein aus den Tokens in `design/tokens.css`; hier
// stehen nur Anteile davon. Keine Bibliothek: Web Animations API (`element.animate`).
//
// Grundsatz 6 (Lehre aus PC8 A5): Jede Animation läuft mit `fill: 'both'` nur zwischen Ausgangs- und
// Endlage, und der Lauf bricht sie nach dem Ende ab (`cancel()`). Die Endlage ist der Ruhezustand im Stil.
// Fällt eine Animation aus, steht der Inhalt einfach da.

// Namen aus B21 (bewegung-tokens.md), Nachricht 11.11. a, dazu DP21.
export type Dauer =
  | 'knapp'
  | 'kurz'
  | 'mittel'
  | 'lang'
  | 'aufschlagen'
  | 'verwandeln'
  | 'takt'
  | 'blende'
  | 'verweilen';
export type Kurve = 'ziel' | 'weich' | 'setzen' | 'gleiten' | 'gleich';

/** „Bewegung reduzieren“ ist an. */
export function bewegungReduziert(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function wert(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Dauer in Millisekunden aus dem Token, etwa `dauer('lang')` → 240 (bei „Bewegung reduzieren“ 0). */
export function dauer(name: Dauer): number {
  const w = wert(`--bw-${name}`);
  const zahl = parseFloat(w);
  if (Number.isNaN(zahl)) return 0;
  return w.endsWith('ms') ? zahl : zahl * 1000;
}

/** Kurve aus dem Token, für `easing` in `element.animate`. */
export function kurve(name: Kurve): string {
  return wert(`--bw-${name}`) || 'ease-out';
}

/**
 * Die Blende der ruhigen Fassungen. Das Handbuch nennt dafür `knapp`; unter „Bewegung reduzieren“ ist
 * `knapp` in `tokens.css` aber 0 ms. Dort bleibt nur `blende` (120 ms), darum gilt sie (CP11, DP21 F2).
 */
function ruhigeBlende(): number {
  return dauer('blende');
}

// ---------- Lauf und Unterbrechen (Handbuch, Abschnitt 5; Grundsatz 5) ----------

/** Die eine laufende Bewegung; eine neue Eingabe oder der Hintergrund setzt sie an ihr Ende. */
let laufend: (() => void) | null = null;

/** Setzt die laufende Bewegung sofort an ihr Ende (Unterbrechen, Hintergrund). Nichts bleibt halb. */
export function abschliessen(): void {
  const f = laufend;
  laufend = null;
  f?.();
}

/** Läuft gerade ein Wechsel? Für Tests und für Eingaben, die warten wollen. */
export function laeuft(): boolean {
  return laufend !== null;
}

if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') abschliessen();
  });

export interface Lauf {
  /** Eine Animation in den Lauf aufnehmen, immer mit `fill: 'both'`. */
  an(el: Element, kf: Keyframe[], o: KeyframeAnimationOptions): Animation;
  /** Aufräumen nach dem Ende, auch wenn der Lauf abgeschlossen wird. */
  danach(f: () => void): void;
  /** Starten; endet von selbst, wenn alle Animationen fertig sind. */
  start(): void;
  /** Geplantes Ende in ms ab Start (längste Verzögerung plus Dauer), für die Sicherung. */
  geplantesEnde(): number;
  /** Erfüllt, wenn der Lauf zu Ende ist, auch nach `abschliessen()`. */
  fertig: Promise<void>;
}

/** Sammelt die Animationen eines Wechsels und räumt nach dem Ende auf. */
export function lauf(): Lauf {
  const anims: Animation[] = [];
  const aufr: (() => void)[] = [];
  let vorbei = false;
  let ende = 0;
  let melden: () => void = () => {};
  const fertig = new Promise<void>((r) => (melden = r));
  const schluss = () => {
    if (vorbei) return;
    vorbei = true;
    if (laufend === schluss) laufend = null;
    for (const a of anims) a.cancel();
    for (const f of aufr) f();
    melden();
  };
  return {
    an(el, kf, o) {
      const a = el.animate(kf, { fill: 'both', ...o });
      const d = Number(o.duration ?? 0) + Number(o.delay ?? 0);
      ende = Math.max(ende, d);
      anims.push(a);
      return a;
    },
    danach(f) {
      aufr.push(f);
    },
    start() {
      laufend = schluss;
      // Sicherung (Grundsatz 6): spätestens am geplanten Ende plus `knapp` ist der Lauf vorbei, auch
      // wenn WebKit eine Animation hängen lässt.
      const sicher = setTimeout(schluss, ende + Math.max(dauer('knapp'), 120));
      void Promise.all(anims.map((a) => a.finished)).then(
        () => {
          clearTimeout(sicher);
          schluss();
        },
        () => {},
      );
      if (!anims.length) {
        clearTimeout(sicher);
        schluss();
      }
    },
    geplantesEnde: () => ende,
    fertig,
  };
}

// ---------- Muster (Handbuch, Abschnitt 3) ----------

/** Richtung: 1 vorwärts (Neues von rechts, Altes nach links), −1 zurück. */
export type Richtung = 1 | -1;

/**
 * 3.2 Weg frei: Teile gehen 26 px gegen die Richtung und blenden aus. Gibt je Teil den Zeitpunkt zurück, ab
 * dem es unter 10 % Deckkraft ist (weich: 75 % der Dauer, ruhig: 90 %).
 */
export function wegFrei(
  l: Lauf,
  teile: Element[],
  o: { r: Richtung; start?: number; takt?: number; dauer?: number },
): number[] {
  const red = bewegungReduziert();
  const st = o.takt ?? 0;
  return teile.map((c, i) => {
    const s = (o.start ?? 0) + i * st;
    const d = red ? ruhigeBlende() : (o.dauer ?? dauer('kurz'));
    l.an(
      c,
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: red ? 'none' : `translateX(${-o.r * 26}px)` },
      ],
      { delay: s, duration: d, easing: red ? 'linear' : kurve('weich') },
    );
    return s + d * (red ? 0.9 : 0.75);
  });
}

/**
 * 3.3 Nachkommen im Takt: Teile kommen 30 px aus der Richtung (oder 8 px von unten) und blenden ein, im
 * halben Takt; ab dem vierten Teil kommen alle mit dem vierten. `ab` setzt den Beginn je Teil.
 */
export function nachkommen(
  l: Lauf,
  teile: Element[],
  o: { r: Richtung; start?: number; takt?: number; ab?: number[]; vonUnten?: boolean },
): void {
  const red = bewegungReduziert();
  const halb = o.takt ?? dauer('takt') / 2;
  teile.forEach((c, j) => {
    const s = o.ab ? (o.ab[j] ?? 0) : (o.start ?? 0) + Math.min(j, 3) * halb;
    const weg = o.vonUnten ? 'translateY(8px)' : `translateX(${o.r * 30}px)`;
    l.an(
      c,
      [
        { opacity: 0, transform: red ? 'none' : weg },
        { opacity: 1, transform: 'none' },
      ],
      {
        delay: s,
        duration: red ? ruhigeBlende() : dauer('mittel'),
        easing: red ? kurve('weich') : kurve('ziel'),
      },
    );
  });
}

/** 3.5 Höhe gleitet: Wachsen sofort, Schrumpfen erst ab `schrumpfAb`. Ruhig springt die Höhe. */
export function hoeheGleitet(
  l: Lauf,
  el: HTMLElement,
  von: number,
  nach: number,
  o: { schrumpfAb?: number; dauer?: number; kurve?: string },
): void {
  const red = bewegungReduziert();
  l.an(el, [{ height: `${von}px` }, { height: `${nach}px` }], {
    delay: nach < von ? (o.schrumpfAb ?? 0) : 0,
    duration: red ? 0 : (o.dauer ?? dauer('aufschlagen')),
    easing: o.kurve ?? kurve('ziel'),
  });
}

/** Rechteck relativ zu einer Bühne. */
function relativ(buehne: Element) {
  const ar = buehne.getBoundingClientRect();
  // Rechtecke kommen in Bildschirm-Pixeln, Stile gelten in der Ebene der Bühne. Ist sie skaliert (etwa
  // `zoom` für große Schrift), wird das herausgerechnet, sonst landet ein Flug um den Faktor daneben.
  const breite = (buehne as HTMLElement).offsetWidth || ar.width;
  const z = ar.width && breite ? ar.width / breite : 1;
  return (q: DOMRect) => ({
    l: (q.left - ar.left) / z,
    t: (q.top - ar.top) / z,
    w: q.width / z,
    h: q.height / z,
    b: (q.bottom - ar.top) / z,
  });
}

/**
 * 3.4 Wechseln: Altes geht oben beginnend im halben Takt, Neues kommt an eine Stelle erst, wenn das Alte
 * dort unter 10 % ist. Gibt den Zeitpunkt zurück, ab dem alles Alte weg ist (für „Höhe gleitet“).
 */
export function wechseln(
  l: Lauf,
  buehne: Element,
  alt: Element,
  neu: Element,
  o: { r: Richtung },
): number {
  const red = bewegungReduziert();
  const rel = relativ(buehne);
  const altK = [...alt.children];
  const neuK = [...neu.children];
  const st = red ? Math.max(dauer('takt'), 40) : dauer('takt') / 2;
  const bis = wegFrei(l, altK, { r: o.r, takt: st, dauer: dauer('knapp') });
  const orte = altK.map((c, i) => ({ q: rel(c.getBoundingClientRect()), bis: bis[i] ?? 0 }));
  const ab = neuK.map((c, j) => {
    const q = rel(c.getBoundingClientRect());
    let s = j * st;
    for (const x of orte) if (q.t < x.q.b && x.q.t < q.b) s = Math.max(s, x.bis);
    return s;
  });
  nachkommen(l, neuK, { r: o.r, ab });
  return bis.length ? Math.max(...bis) : 0;
}

/** Die erste Zeile eines Texts (für Flüge, die auf der ersten Zeile landen). */
export function zeile(el: Element): DOMRect {
  const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent?.trim());
  if (!t) return el.getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(t);
  return r.getClientRects()[0] ?? el.getBoundingClientRect();
}

/**
 * 3.1 Verwandeln: Die getippte Antwort (`held`) steigt mit ihrer Fläche an den Platz des Titels und wird
 * der Titel (`titel` in `neu`). Anteile am Flug: altes Wort geht 40–49 %, neues kommt 50–60 %, die
 * Hauptfläche hellt 33–50 % auf, die Fläche löst sich ab 85 %, der Rest kommt ab 84 %.
 * Ruhig: kein Flug; dann gilt `wechseln`.
 */
export function verwandeln(
  l: Lauf,
  buehne: HTMLElement,
  alt: Element,
  neu: Element,
  held: HTMLElement,
  titel: HTMLElement,
  o: { r: Richtung },
): { schrumpfAb: number; dauer: number; kurve: string } {
  const rel = relativ(buehne);
  const sp = held.querySelector<HTMLElement>('.antw-text') ?? held;
  const la = rel(zeile(sp));
  const hz = rel(zeile(titel));
  const hr = rel(held.getBoundingClientRect());
  const sr = rel(sp.getBoundingClientRect());
  const tr = rel(titel.getBoundingClientRect());
  const haupt = held.classList.contains('haupt');
  const wort = (sp.firstChild?.textContent ?? '').trim();
  const gleich = !haupt && wort === titel.textContent?.trim();
  const F0 = dauer('knapp');
  const FD = dauer('verwandeln');
  const cs = getComputedStyle(held);
  const grund = wert('--ground');
  const k2 =
    parseFloat(getComputedStyle(titel).fontSize) / parseFloat(getComputedStyle(sp).fontSize);
  const dx = hz.l - la.l;
  const dy = hz.t + hz.h / 2 - (la.t + la.h / 2);

  // 1. Weg frei
  wegFrei(
    l,
    [...alt.children].filter((c) => c !== held && !c.contains(held)),
    { r: o.r, dauer: dauer('kurz') },
  );
  // Fläche und Wort als eigene Ebenen
  const fl = document.createElement('div');
  fl.className = `flug-flaeche${haupt ? ' haupt' : ''}`;
  fl.setAttribute('aria-hidden', 'true');
  fl.innerHTML = '<i>›</i>';
  Object.assign(fl.style, {
    left: `${hr.l}px`,
    top: `${hr.t}px`,
    width: `${hr.w}px`,
    height: `${hr.h}px`,
    background: cs.backgroundColor,
  });
  const tx = document.createElement('div');
  tx.className = `flug-text${haupt ? ' haupt' : ''}`;
  tx.setAttribute('aria-hidden', 'true');
  tx.innerHTML = sp.innerHTML;
  Object.assign(tx.style, {
    left: `${sr.l}px`,
    top: `${sr.t}px`,
    width: `${sr.w}px`,
    transformOrigin: `${la.l - sr.l}px ${la.t + la.h / 2 - sr.t}px`,
  });
  buehne.append(fl, tx);
  held.style.visibility = 'hidden';
  Object.assign(titel.style, {
    transformOrigin: `${hz.l - tr.l}px ${hz.t + hz.h / 2 - tr.t}px`,
    position: 'relative',
    zIndex: '4',
  });
  l.danach(() => {
    fl.remove();
    tx.remove();
    held.style.visibility = '';
    titel.style.transformOrigin = '';
    titel.style.position = '';
    titel.style.zIndex = '';
  });
  const klein = tx.querySelector('small');
  if (klein)
    l.an(klein, [{ opacity: 1 }, { opacity: 0 }], { duration: F0, easing: kurve('weich') });
  l.an(fl.querySelector('i')!, [{ opacity: haupt ? 0.75 : 1 }, { opacity: 0 }], {
    duration: F0,
    easing: kurve('weich'),
  });
  // 2. Fläche und Wort steigen
  l.an(
    fl,
    [
      { left: `${hr.l}px`, top: `${hr.t}px`, width: `${hr.w}px`, height: `${hr.h}px` },
      {
        left: `${hz.l - 10}px`,
        top: `${hz.t - 7}px`,
        width: `${hz.w + 24}px`,
        height: `${hz.h + 14}px`,
      },
    ],
    { delay: F0, duration: FD, easing: kurve('gleiten') },
  );
  if (haupt)
    l.an(fl, [{ backgroundColor: cs.backgroundColor }, { backgroundColor: grund }], {
      delay: F0 + FD * 0.33,
      duration: FD * 0.17,
      easing: kurve('weich'),
    });
  l.an(fl, [{ opacity: 1 }, { opacity: 0 }], {
    delay: F0 + FD * 0.85,
    duration: dauer('mittel'),
    easing: kurve('weich'),
  });
  l.an(tx, [{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${k2})` }], {
    delay: F0,
    duration: FD,
    easing: kurve('gleiten'),
  });
  l.an(
    titel,
    [{ transform: `translate(${-dx}px,${-dy}px) scale(${1 / k2})` }, { transform: 'none' }],
    { delay: F0, duration: FD, easing: kurve('gleiten') },
  );
  // 3. Wortwechsel nacheinander, knapp in der Mitte; gleiches Wort: Der Titel fliegt selbst
  if (gleich) tx.style.opacity = '0';
  else {
    l.an(
      tx,
      [
        { opacity: 1, filter: 'blur(0px)' },
        { opacity: 0, filter: 'blur(3px)' },
      ],
      { delay: F0 + FD * 0.4, duration: FD * 0.09, easing: 'linear' },
    );
    l.an(
      titel,
      [
        { opacity: 0, filter: 'blur(3px)' },
        { opacity: 1, filter: 'blur(0px)' },
      ],
      { delay: F0 + FD * 0.5, duration: FD * 0.1, easing: 'linear' },
    );
  }
  // 6. Der Rest kommt nach
  nachkommen(
    l,
    [...neu.children].filter((c) => c !== titel && !c.contains(titel)),
    { r: o.r, start: F0 + FD * 0.84 },
  );
  return { schrumpfAb: F0, dauer: FD, kurve: kurve('gleiten') };
}

/**
 * 3.6 Abschnitt erscheint / geht: Erscheinen erst Platz, dann Inhalt; Gehen umgekehrt. Ruhig: Blende, der
 * Platz springt.
 */
export function abschnitt(l: Lauf, el: HTMLElement, zeigen: boolean): void {
  const red = bewegungReduziert();
  const d = dauer('mittel');
  if (zeigen) {
    el.hidden = false;
    const h = el.offsetHeight;
    const mt = getComputedStyle(el).marginTop;
    l.an(
      el,
      red
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { height: '0px', marginTop: '0px', opacity: 0 },
            { height: `${h}px`, marginTop: mt, opacity: 0, offset: 0.5 },
            { height: `${h}px`, marginTop: mt, opacity: 1 },
          ],
      { duration: red ? ruhigeBlende() : d * 2, easing: kurve('ziel') },
    );
  } else {
    const h = el.offsetHeight;
    l.an(
      el,
      red
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { height: `${h}px`, opacity: 1 },
            { height: `${h}px`, opacity: 0, offset: 0.5 },
            { height: '0px', marginTop: '0px', opacity: 0 },
          ],
      { duration: red ? ruhigeBlende() : d * 2, easing: kurve('ziel') },
    );
    l.danach(() => (el.hidden = true));
  }
  el.style.overflow = 'hidden';
  l.danach(() => (el.style.overflow = ''));
}

/**
 * 3.9 Heft aufschlagen / zuschlagen: Das Bild der Karte wächst zum Foto im Kopf, der Name wird die
 * Überschrift (gleiches Wort, darum fliegt die Überschrift selbst), die Liste macht Platz, der Rest kommt
 * ab 60 % im halben Takt. Bild und Name kreuzen sich nicht: auf ist der Name zuerst dort (`ziel`), zu das
 * Bild. Ohne Bild auf einer Seite (Kopf weggescrollt) oder ruhig: erst geht die eine Seite, dann kommt die
 * andere.
 */
export function aufschlagen(
  l: Lauf,
  o: {
    buehne: HTMLElement;
    r: Richtung;
    von: HTMLElement;
    nach: HTMLElement;
    vonTeile: Element[];
    nachTeile: Element[];
    bildVon: HTMLElement | null;
    bildNach: HTMLElement | null;
    nameVon: HTMLElement | null;
    nameNach: HTMLElement | null;
  },
): void {
  const red = bewegungReduziert();
  const F0 = dauer('knapp');
  const FD = dauer('verwandeln');
  if (red || !o.bildVon || !o.bildNach || !o.nameVon || !o.nameNach) {
    const b = red ? ruhigeBlende() : dauer('knapp');
    l.an(o.von, [{ opacity: 1 }, { opacity: 0 }], { duration: b, easing: 'linear' });
    l.an(o.nach, [{ opacity: 0 }, { opacity: 1 }], { delay: b, duration: b, easing: 'linear' });
    return;
  }
  const rel = relativ(o.buehne);
  wegFrei(l, o.vonTeile, { r: o.r, dauer: dauer('kurz') });
  // Bild: eine eigene Ebene fliegt vom einen Rechteck ins andere
  const a = rel(o.bildVon.getBoundingClientRect());
  const z = rel(o.bildNach.getBoundingClientRect());
  const fb = document.createElement('div');
  fb.className = 'flug-bild';
  fb.setAttribute('aria-hidden', 'true');
  fb.innerHTML = o.bildVon.innerHTML;
  o.buehne.append(fb);
  const ra = getComputedStyle(o.bildVon).borderRadius;
  const rz = getComputedStyle(o.bildNach).borderRadius;
  l.an(
    fb,
    [
      {
        left: `${a.l}px`,
        top: `${a.t}px`,
        width: `${a.w}px`,
        height: `${a.h}px`,
        borderRadius: ra,
      },
      {
        left: `${z.l}px`,
        top: `${z.t}px`,
        width: `${z.w}px`,
        height: `${z.h}px`,
        borderRadius: rz,
      },
    ],
    { delay: F0, duration: FD, easing: kurve(o.r > 0 ? 'gleiten' : 'ziel') },
  );
  const bildVon = o.bildVon;
  const bildNach = o.bildNach;
  bildVon.style.visibility = 'hidden';
  bildNach.style.visibility = 'hidden';
  l.danach(() => {
    fb.remove();
    bildVon.style.visibility = '';
    bildNach.style.visibility = '';
  });
  // Name: gleiches Wort, die Überschrift des Ziels fliegt selbst
  const na = rel(zeile(o.nameVon));
  const nz = rel(zeile(o.nameNach));
  const nr = rel(o.nameNach.getBoundingClientRect());
  const k =
    parseFloat(getComputedStyle(o.nameVon).fontSize) /
    parseFloat(getComputedStyle(o.nameNach).fontSize);
  const nameVon = o.nameVon;
  const nameNach = o.nameNach;
  nameVon.style.visibility = 'hidden';
  Object.assign(nameNach.style, {
    transformOrigin: `${nz.l - nr.l}px ${nz.t - nr.t}px`,
    position: 'relative',
    zIndex: '7',
  });
  l.danach(() => {
    nameVon.style.visibility = '';
    nameNach.style.transformOrigin = '';
    nameNach.style.position = '';
    nameNach.style.zIndex = '';
  });
  l.an(
    nameNach,
    [
      { transform: `translate(${na.l - nz.l}px,${na.t - nz.t}px) scale(${k})` },
      { transform: 'none' },
    ],
    { delay: F0, duration: FD, easing: kurve(o.r > 0 ? 'ziel' : 'gleiten') },
  );
  nachkommen(l, o.nachTeile, { r: o.r, start: F0 + FD * 0.6, takt: dauer('takt') / 2 });
}

/** 3.8 Ablegen: Foto grau und blasser (45 %), Kopf auf 70 %; `lang`, `weich`. Ruhig springt es. */
export function ablegen(l: Lauf, foto: HTMLElement | null, kopf: HTMLElement | null): void {
  if (bewegungReduziert()) return;
  const o = { duration: dauer('lang'), easing: kurve('weich') };
  if (foto)
    l.an(
      foto,
      [
        { filter: 'grayscale(0)', opacity: 1 },
        { filter: 'grayscale(1)', opacity: 0.45 },
      ],
      o,
    );
  if (kopf) l.an(kopf, [{ opacity: 1 }, { opacity: 0.7 }], o);
}

/** 3.11 Blende: Etwas erscheint an Ort und Stelle, `kurz`, `weich`; mehrere im Takt. */
export function blende(l: Lauf, teile: Element[], start = 0): void {
  const red = bewegungReduziert();
  teile.forEach((c, i) =>
    l.an(c, [{ opacity: 0 }, { opacity: 1 }], {
      delay: start + i * dauer('takt'),
      duration: red ? ruhigeBlende() : dauer('kurz'),
      easing: red ? 'linear' : kurve('weich'),
    }),
  );
}

/**
 * 3.19 Farben laufen ins Haus (SMIL im Band): Dauern in Sekunden und die Kurve `ziel` als `keySplines`,
 * aus den Tokens gelesen. SMIL liest keine CSS-Variablen, darum setzt das Modul die Werte.
 */
export function insHaus(): {
  luecke: number;
  stein: number;
  schritt: number;
  haus: number;
  versatz: number;
  keySplines: string;
} {
  const s = (d: Dauer) => dauer(d) / 1000;
  return {
    luecke: s('mittel'),
    stein: s('lang'),
    schritt: s('aufschlagen'),
    haus: s('verwandeln'),
    versatz: (2 * dauer('takt')) / 1000,
    keySplines: splines(kurve('ziel')),
  };
}

/** `cubic-bezier(a, b, c, d)` → „a b c d“ für SMIL; sonst die Kurve `ziel` aus dem Handbuch. */
export function splines(k: string): string {
  const m = k.match(/cubic-bezier\(([^)]+)\)/);
  return m
    ? m[1]!
        .split(',')
        .map((x) => Number(x.trim()))
        .join(' ')
    : '0.2 0.7 0.2 1';
}

/** 3.18 Ziel erreicht: Beginn nach dem Ende von „Farben laufen ins Haus“, `verwandeln` plus drei Takte. */
export function zielBeginn(): number {
  return dauer('verwandeln') + 3 * dauer('takt');
}

/** 3.20 Aufgehen: Ein Bild wächst auf 135 %, steigt 8 % und blendet aus; `mittel`, `weich`. Ruhig: Blende. */
export function aufgehen(l: Lauf, el: HTMLElement): void {
  const red = bewegungReduziert();
  l.an(
    el,
    red
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { transform: 'none', opacity: 1 },
          { transform: 'scale(1.35) translateY(-8%)', opacity: 0 },
        ],
    { duration: red ? ruhigeBlende() : dauer('mittel'), easing: red ? 'linear' : kurve('weich') },
  );
}

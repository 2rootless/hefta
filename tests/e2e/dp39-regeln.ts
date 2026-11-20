// Prüfungen der Wunschliste (Fassung 6) für die Seiten aus DP39. Jede Funktion läuft im Browser (per
// page.evaluate) und gibt die Verstöße als Sätze zurück; leer heißt eingehalten. Sie greifen auf nichts
// außerhalb zu, weil Playwright nur ihren Quelltext in die Seite schickt.

/** W18: Register. Der aktive Reiter hängt an der Karte und trägt ihre Tönung; Namen nie gekürzt. */
export function registerPruefen(): string[] {
  const f: string[] = [];
  const nav = document.querySelector('.register');
  const karte = document.querySelector('.register-rahmen .karte');
  if (!nav || !karte) return ['kein Register'];
  const an = nav.querySelector<HTMLElement>('.reiter.an');
  if (!an) return ['kein aktiver Reiter'];
  const a = an.getBoundingClientRect();
  const k = karte.getBoundingClientRect();
  // DP70 U1 (PC95, 2.0.1): Bricht das Register um, bleibt die Reihenfolge des Haushalts. Steht der aktive
  // Reiter dann nicht in der letzten Reihe, kann er nicht an der Karte hängen; geprüft wird er nur dort.
  const letzteReihe = Math.max(
    ...[...nav.querySelectorAll<HTMLElement>('.reiter')].map((r) => r.getBoundingClientRect().top),
  );
  if (Math.abs(a.top - letzteReihe) <= 2 && Math.abs(a.bottom - k.top) > 0.5)
    f.push('aktiver Reiter hängt nicht an der Karte');
  const ton = getComputedStyle(karte).backgroundColor;
  if (getComputedStyle(an).backgroundColor !== ton) f.push('aktiver Reiter nicht in der Tönung');
  for (const r of nav.querySelectorAll<HTMLElement>('.reiter')) {
    if (r !== an && getComputedStyle(r).backgroundColor === ton) f.push('anderer Reiter getönt');
    if (r.getBoundingClientRect().height < 44) f.push('Reiter unter 44 px');
    const n = r.querySelector<HTMLElement>('.reiter-name');
    if (n && n.scrollWidth > n.clientWidth + 1) f.push(`Name gekürzt: ${n.textContent}`);
  }
  return f;
}

/** W19: Haarlinie 2 px, Symbole 20 px, Ring 36 px mit Strich 1,5, keine schwarzen Blöcke. */
export function haarliniePruefen(): string[] {
  const f: string[] = [];
  const alle = document.querySelectorAll('.haarlinie');
  if (!alle.length) return ['keine Haarlinie'];
  for (const h of alle) {
    const linie = h.querySelector('.linie');
    if (!linie || Math.round(linie.getBoundingClientRect().height) !== 2)
      f.push('Linie nicht 2 px');
    for (const s of h.querySelectorAll('.zeichen svg'))
      if (Math.round(s.getBoundingClientRect().width) !== 20) f.push('Symbol nicht 20 px');
    const ring = h.querySelector('.ring');
    if (ring) {
      if (Math.round(ring.getBoundingClientRect().width) !== 36) f.push('Ring nicht 36 px');
      if (!getComputedStyle(ring).boxShadow.includes('1.5px')) f.push('Ring-Strich nicht 1,5 px');
    }
    for (const e of h.querySelectorAll('*'))
      if (getComputedStyle(e).backgroundColor === 'rgb(0, 0, 0)') f.push('schwarzer Block');
  }
  return f;
}

/** W20: Markierungen wie mit Textmarker, gelb, multiplizierend, ohne Rahmen, Ecken unregelmäßig. */
export function markerPruefen(): string[] {
  const f: string[] = [];
  const alle = document.querySelectorAll('.marke');
  if (!alle.length) return ['keine Markierung'];
  for (const m of alle) {
    const s = getComputedStyle(m);
    if (!/^rgba\(247, 206, 70, 0\.\d+\)$/.test(s.backgroundColor))
      f.push(`Farbe ${s.backgroundColor}`);
    if (s.mixBlendMode !== 'multiply') f.push('nicht multiplizierend');
    if (parseFloat(s.borderTopWidth) || parseFloat(s.borderLeftWidth)) f.push('mit Rahmen');
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth)) f.push('mit Umrandung');
    if (s.borderRadius !== '3px 6px 4px 7px') f.push(`Ecken ${s.borderRadius}`);
  }
  return f;
}

/** W21: abgelegte Hefte als ruhige Zeilen ohne Bild, Datum vorn, Name in einer Zeile. */
export function abgelegtPruefen(): string[] {
  const f: string[] = [];
  const karte = document.querySelector('.ab-karte');
  if (!karte) return ['keine Liste abgelegter Hefte'];
  if (karte.querySelector('img, canvas, picture')) f.push('Bild in der Liste');
  for (const z of karte.querySelectorAll<HTMLElement>('a')) {
    const erstes = z.firstElementChild?.textContent?.trim() ?? '';
    if (!/^\d{1,2}\.\s\S+/.test(erstes)) f.push(`Datum nicht vorn: ${erstes}`);
    const b = z.querySelector('b');
    if (!b) f.push('kein Name');
    else {
      const s = getComputedStyle(b);
      if (s.whiteSpace !== 'nowrap' || s.textOverflow !== 'ellipsis')
        f.push('Name nicht in einer Zeile');
    }
    if (z.getBoundingClientRect().height < 44) f.push('Zeile unter 44 px');
  }
  return f;
}

/**
 * W22 (A24): Abstände nur aus dem Raster. Gemessen wie `render.js` aus DP39: Ränder, Innenabstände und
 * Lücken aller sichtbaren Elemente in den Bereichen der DP39-Seiten. Negative Werte (Ausgleich) und 2 px
 * zwischen Zeile und Zweitzeile sind erlaubt; `margin-left: auto` zählt nicht.
 */
export function rasterPruefen(bereiche: string): string[] {
  const raster = new Set([0, 2, 4, 8, 12, 16, 20, 24, 32, 48, 64]);
  const f = new Set<string>();
  const felder = [
    'marginTop',
    'marginBottom',
    'marginLeft',
    'marginRight',
    'paddingTop',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'rowGap',
    'columnGap',
  ] as const;
  for (const wurzel of document.querySelectorAll<HTMLElement>(bereiche))
    for (const e of [wurzel, ...wurzel.querySelectorAll<HTMLElement>('*')]) {
      if (!e.getClientRects().length) continue;
      const s = getComputedStyle(e);
      for (const k of felder) {
        // Platz für die feste Leiste unten ist gerechnet, kein Abstand zwischen Blöcken.
        if (k === 'paddingBottom' && e.tagName === 'MAIN') continue;
        const v = parseFloat(s[k]);
        if (isNaN(v) || v < 0) continue;
        // margin-left/right: auto ergibt beliebige Werte, das ist kein fester Abstand. Erkannt daran,
        // dass „auto“ zur Probe denselben Wert ergibt.
        if ((k === 'marginLeft' || k === 'marginRight') && v > 0) {
          const name = k === 'marginLeft' ? 'margin-left' : 'margin-right';
          const alt = e.style.getPropertyValue(name);
          e.style.setProperty(name, 'auto');
          const mitAuto = parseFloat(getComputedStyle(e)[k]);
          if (alt) e.style.setProperty(name, alt);
          else e.style.removeProperty(name);
          if (Math.abs(mitAuto - v) < 0.5) continue;
        }
        if (!raster.has(Math.round(v * 100) / 100))
          f.add(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ${k} ${v}`);
      }
    }
  return [...f];
}

/** W16 (1.5): Vorschau beim Zuordnen, Kopf der Seite in voller Breite, Radius 10, Lupe 32 px. */
export function vorschauPruefen(): string[] {
  const f: string[] = [];
  const alle = document.querySelectorAll<HTMLElement>('.w16-vorschau, .liste .bild, .ausschnitt');
  if (!alle.length) return ['keine Vorschau'];
  for (const v of alle) {
    const b = v.getBoundingClientRect();
    const eltern = v.parentElement!.getBoundingClientRect();
    if (b.height < 90) f.push(`Vorschau nur ${Math.round(b.height)} px hoch`);
    if (b.width < eltern.width - 1) f.push('Vorschau nicht in voller Breite');
    if (getComputedStyle(v).borderTopLeftRadius !== '10px') f.push('Radius nicht 10');
    const lupe = v.querySelector<HTMLElement>('.w16-lupe, .lupe');
    if (v.tagName === 'BUTTON') {
      if (!lupe) f.push('keine Lupe');
      else if (Math.round(lupe.getBoundingClientRect().width) !== 32) f.push('Lupe nicht 32 px');
    }
  }
  return f;
}

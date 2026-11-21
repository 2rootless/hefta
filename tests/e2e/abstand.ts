// DP47b K2, Prüfkatalog M1 und M2: die zwei Messungen aus design/dp47/DP47b…/werkzeug/shot.js, als ganze
// Funktion für page.evaluate.
// 1. Nachbarn in einer Zeile (Kinder eines flex- oder grid-Behälters, auch lose Textstücke) halten
//    mindestens 8 px Abstand, gemessen an Schrift und gefüllten Flächen, nicht an Kästen. Zeichen und Wort
//    in derselben Bedienung („‹ Max“) brauchen 4 px.
// 2. Schrift in einer gefüllten Fläche (Knopf, Pille, Feld) bleibt mindestens 4 px von deren Rand.
// Fließtext in einer Zeile prüft sie nicht: Er hat keine Nachbarn, nur Wortabstände.
export function abstandPruefen(): { eng: string[]; raus: string[] } {
  const wurzeln = [document.querySelector('main'), document.querySelector('dialog[open]')].filter(
    (x): x is Element => !!x,
  );
  const rg = document.createRange();
  type Kasten = { l: number; t: number; r: number; b: number };
  const tinte = (el: Element): Kasten | null => {
    let r: Kasten | null = null;
    const dazu = (q: DOMRect) => {
      if (q.width <= 0.5 || q.height <= 0.5) return;
      r = r
        ? {
            l: Math.min(r.l, q.left),
            t: Math.min(r.t, q.top),
            r: Math.max(r.r, q.right),
            b: Math.max(r.b, q.bottom),
          }
        : { l: q.left, t: q.top, r: q.right, b: q.bottom };
    };
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let x: Node | null;
    while ((x = tw.nextNode())) {
      if (!x.textContent?.trim()) continue;
      const cs = getComputedStyle(x.parentElement!);
      if (cs.visibility === 'hidden' || cs.color === 'rgba(0, 0, 0, 0)') continue;
      rg.selectNodeContents(x);
      for (const q of rg.getClientRects()) dazu(q);
    }
    for (const d of [el, ...el.querySelectorAll('*')]) {
      const cs = getComputedStyle(d);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      if (
        d.tagName === 'IMG' ||
        d.tagName.toLowerCase() === 'svg' ||
        bg ||
        (cs.boxShadow && cs.boxShadow !== 'none')
      )
        dazu(d.getBoundingClientRect());
    }
    return r;
  };
  const name = (c: { className?: unknown; tagName?: string; innerText?: string }) =>
    `${typeof c.className === 'string' && c.className ? c.className : c.tagName}:${(
      c.innerText ?? ''
    )
      .trim()
      .slice(0, 24)
      .replace(/\n/g, ' ')}`;

  const eng: string[] = [];
  const raus: string[] = [];
  for (const wurzel of wurzeln) {
    for (const e of [wurzel, ...wurzel.querySelectorAll('*')]) {
      const s = getComputedStyle(e);
      if (!/flex|grid/.test(s.display)) continue;
      const k: { c: { className?: unknown; tagName?: string; innerText?: string }; i: Kasten }[] =
        [];
      for (const c of e.children) {
        const cs = getComputedStyle(c);
        if (
          cs.display === 'none' ||
          cs.position === 'absolute' ||
          cs.position === 'fixed' ||
          cs.visibility === 'hidden'
        )
          continue;
        const i = tinte(c);
        if (i) k.push({ c: c as HTMLElement, i });
      }
      for (const x of e.childNodes) {
        if (x.nodeType !== 3 || !x.textContent?.trim()) continue;
        rg.selectNodeContents(x);
        const q = rg.getBoundingClientRect();
        if (q.width > 0.5)
          k.push({
            c: { className: 'Text', innerText: x.textContent },
            i: { l: q.left, t: q.top, r: q.right, b: q.bottom },
          });
      }
      for (const A of k)
        for (const B of k) {
          if (A === B) continue;
          const a = A.i;
          const b = B.i;
          const ueber = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (ueber < 0.5 * Math.min(a.b - a.t, b.b - b.t)) continue;
          if (b.l < a.l) continue;
          const luecke = b.l - a.r;
          const zeichen = [A.c, B.c].some((c) => c.tagName && /^(svg|IMG)$/i.test(c.tagName));
          if (luecke > -2 && luecke < (zeichen ? 4 : 8))
            eng.push(`${name(A.c)} | ${name(B.c)} = ${luecke.toFixed(1)}`);
        }
    }
    for (const e of wurzel.querySelectorAll('*')) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      if (!bg) continue;
      if (
        e.parentElement &&
        getComputedStyle(e.parentElement).backgroundColor === cs.backgroundColor
      )
        continue;
      const r = e.getBoundingClientRect();
      if (r.width >= innerWidth - 1) continue;
      const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      let x: Node | null;
      while ((x = tw.nextNode())) {
        if (!x.textContent?.trim()) continue;
        if (getComputedStyle(x.parentElement!).visibility === 'hidden') continue;
        rg.selectNodeContents(x);
        let drausen = false;
        for (const q of rg.getClientRects()) {
          if (q.width < 1) continue;
          if (q.left < r.left + 4 || q.right > r.right - 4) drausen = true;
        }
        if (drausen) {
          raus.push(`${name(e as HTMLElement)} : ${x.textContent.trim().slice(0, 24)}`);
          break;
        }
      }
    }
  }
  return { eng: [...new Set(eng)], raus: [...new Set(raus)] };
}

<script lang="ts" module>
  /** Zustand eines Steins: da, läuft bald ab, fehlt, aktuell (im Rutsch). */
  export type SteinArt = 'da' | 'bald' | 'fehlt' | 'aktuell';
  /** Kurzform für data-docs, z. B. „da:euro:p1.gehalt,fehlt:shield:p1.bonitaet“. */
  export function steineAttr(steine: { zustand: SteinArt; symbol: string; id?: string }[]): string {
    return steine.map((s) => [s.zustand, s.symbol, s.id ?? ''].join(':')).join(',');
  }

  // Was das Band zuletzt gezeigt hat, über Bildschirmwechsel hinweg (z. B. zurück aus dem Rutsch):
  // Daraus entsteht die Bewegung, wenn eine Unterlage dazugekommen oder alles da ist.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Gedächtnis, nichts zeichnet davon neu
  const gesehen = new Map<string, SteinArt>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Gedächtnis, nichts zeichnet davon neu
  const warFertig = new Map<string, boolean>();
</script>

<script lang="ts">
  import { bewegungReduziert, dauer, insHaus } from './bewegung';
  // Schwingendes Band links neben den Karten (design/stil-c.md, „Umsetzung des Bands“).
  // Zeilen setzen sich normal im Fluss; jede Zeile, die zum Band gehört, trägt data-band
  // („p“ Person, „track“ Station, „open“ Trennung) und bei Personen data-farbe, data-duenn, data-docs.
  // Nach dem Layout und bei jeder Größenänderung misst das Band die Zeilen und zeichnet ein SVG.
  import type { Snippet } from 'svelte';
  import { steineVerteilen } from './bandPlatz';
  import { SYMBOLE } from './symbolPfade';
  import Ziel from './Ziel.svelte';

  let {
    children,
    fertig = false,
    zielBeschriftung,
    merken,
    ansage,
    bild,
  }: {
    /** Das Band als ein Bild mit einem Satz; die Steine liest niemand einzeln vor. */
    bild?: string;
    children: Snippet;
    fertig?: boolean;
    zielBeschriftung?: string;
    /** Name für das Gedächtnis der Bewegung; ohne bewegt sich nichts (z. B. „Euer Haushalt“). */
    merken?: string;
    /** Wird einmal angesagt, wenn beim echten Wechsel alles da ist („Alles beisammen.“). */
    ansage?: string;
  } = $props();

  // Erst leer, dann der Text: Nur so liest VoiceOver die Zeile vor.
  let angesagt = $state('');
  $effect(() => {
    if (!feiern || !ansage) return;
    const text = ansage;
    const zeit = setTimeout(() => (angesagt = text), 100);
    return () => clearTimeout(zeit);
  });

  // Bewegung (design/README.md, „Bewegung“): Lücke schließt sich in 240 ms, Stein wird zum Punkt;
  // beim Fertigwerden laufen die Farben in 600 ms von oben ins Haus. Als SMIL im SVG, weil das Band
  // bei jeder Größenänderung neu gezeichnet wird: Die Startzeit bleibt so über Neuzeichnen erhalten.
  // Bei „Bewegung reduzieren“ nur Überblendungen.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Gedächtnis, nichts zeichnet davon neu
  const bewegt = new Map<string, { beginn: number; vorher: SteinArt }>();
  const uid = $props.id();
  let fuellenBeginn: number | null = null;
  let feiern = $state(false);
  const ruhig = bewegungReduziert;
  // Handbuch 3.19 „Farben laufen ins Haus“: Dauern und Kurve `ziel` aus den Tokens; SMIL liest keine
  // CSS-Variablen, darum setzt das Modul die Werte. Unter „Bewegung reduzieren“ sind die Dauern 0 ms; dann
  // gilt für die Blenden `blende`.
  const bw = (was: 'luecke' | 'stein' | 'schritt' | 'haus'): number => {
    const v = insHaus()[was];
    return v > 0 ? v : dauer('blende') / 1000;
  };
  const versatz = () => insHaus().versatz;
  const SANFT = () => `calcMode="spline" keyTimes="0;1" keySplines="${insHaus().keySplines}"`;

  function animation(attribut: string, werte: string, beginn: number, dauer: number): string {
    return `<animate attributeName="${attribut}" values="${werte}" begin="${beginn.toFixed(3)}s" dur="${dauer}s" fill="freeze" ${SANFT()}/>`;
  }

  let kasten: HTMLDivElement | undefined = $state();
  let svg: SVGSVGElement | undefined = $state();
  let haus: HTMLDivElement | undefined = $state();

  // Kernform 12 px aus dem Symbolsatz (B11): im Stein, Strich 4,0 im 32er-Raster.
  const pfade = (liste: readonly string[]) => liste.map((d) => `<path d="${d}"/>`).join('');
  const ICON: Record<string, string> = Object.fromEntries(
    Object.entries(SYMBOLE).map(([name, form]) => [
      name,
      pfade('kern' in form && form.kern ? form.kern : form.voll),
    ]),
  );

  // Sehr schmal (320 px mit großer Schrift): schmalere Spalte fürs Band, gut 20 px mehr für den Text.
  let eng = false;
  const X = (y: number) => (eng ? 25 + Math.sin(y / 38) * 8 : 34 + Math.sin(y / 38) * 12);

  function linie(
    a: number,
    b: number,
    klasse: string,
    breite: number,
    gepunktet = false,
    inhalt = '',
  ): string {
    let d = '';
    for (let y = a; y <= b; y += 3) d += `${d ? 'L' : 'M'}${X(y).toFixed(1)} ${y.toFixed(1)} `;
    const strich = gepunktet ? ' stroke-dasharray="2 6"' : '';
    return inhalt
      ? `<path d="${d}" class="${klasse}" stroke-width="${breite}"${strich}>${inhalt}</path>`
      : `<path d="${d}" class="${klasse}" stroke-width="${breite}"${strich}/>`;
  }

  /** Abschnitt einer Unterlage, die gerade dazugekommen ist: die volle Linie wächst über die gepunktete. */
  function lueckeSchliessen(ya: number, yb: number, farbe: string, breite: number, t0: number) {
    if (ruhig())
      return (
        linie(ya, yb, farbe, 3, true) +
        linie(ya, yb, farbe, breite, false, animation('opacity', '0;1', t0, bw('luecke')))
      );
    let d = '';
    for (let y = ya; y <= yb; y += 3) d += `${d ? 'L' : 'M'}${X(y).toFixed(1)} ${y.toFixed(1)} `;
    return (
      linie(ya, yb, farbe, 3, true) +
      `<path d="${d}" class="${farbe}" stroke-width="${breite}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1">${animation('stroke-dashoffset', '1;0', t0, bw('luecke'))}</path>`
    );
  }

  /** Der alte Stein blendet aus und schrumpft. */
  function steinVergeht(x: number, y: number, art: string, vorher: SteinArt, t0: number) {
    const klasse = vorher === 'bald' ? 'stein-bald' : 'stein-fehlt';
    const schrumpfen = ruhig() ? '' : animation('r', '12;4', t0, bw('stein'));
    return `<g opacity="1"><circle cx="${x}" cy="${y}" r="12" class="${klasse}">${schrumpfen}</circle>${symbol(art, x, y)}${animation('opacity', '1;0', t0, bw('luecke'))}</g>`;
  }

  /** Stein, der zum Punkt wird: Der Punkt bleibt. */
  function steinZuPunkt(x: number, y: number, art: string, vorher: SteinArt, t0: number) {
    return (
      steinVergeht(x, y, art, vorher, t0) +
      `<circle cx="${x}" cy="${y}" r="4.6" class="punkt" opacity="0">${animation('opacity', '0;1', t0, bw('luecke'))}</circle>`
    );
  }

  /** Alles da: ein Haken statt einer Reihe Punkte. */
  function hakenStein(x: number, y: number, t0?: number) {
    const stein =
      `<circle cx="${x}" cy="${y}" r="11.2" class="punkt alles-da"/>` +
      `<svg aria-hidden="true" x="${x - 6}" y="${y - 6}" width="12" height="12" viewBox="0 0 32 32" class="icon haken">${ICON.haken}</svg>`;
    return t0 === undefined
      ? stein
      : `<g opacity="0">${stein}${animation('opacity', '0;1', t0 + versatz(), bw('luecke'))}</g>`;
  }

  /** Mehr Offenes, als in den Abschnitt passt: ein Stein mit Zahl. */
  function mehrStein(x: number, y: number, anzahl: number) {
    return (
      `<circle cx="${x}" cy="${y}" r="12" class="stein-fehlt"/>` +
      `<text x="${x}" y="${y}" class="mehr-zahl">+${anzahl}</text>`
    );
  }

  /** Dazugekommen seit dem letzten Bild: aus „fehlt“ oder „bald“ wurde „da“. */
  function bewegungVon(zustand: SteinArt, id: string | undefined, jetzt: number) {
    const schluessel = merken && id ? `${merken}|${id}` : '';
    if (!schluessel) return undefined;
    let bewegung = bewegt.get(schluessel);
    const vorher = gesehen.get(schluessel);
    if (!bewegung && zustand === 'da' && (vorher === 'fehlt' || vorher === 'bald')) {
      bewegung = { beginn: jetzt, vorher };
      bewegt.set(schluessel, bewegung);
    }
    gesehen.set(schluessel, zustand);
    return bewegung;
  }

  function symbol(art: string, x: number, y: number, hell = false): string {
    return `<svg aria-hidden="true" x="${x - 6}" y="${y - 6}" width="12" height="12" viewBox="0 0 32 32" class="icon${hell ? ' hell' : ''}">${ICON[art] ?? ''}</svg>`;
  }

  function zeichnen() {
    if (!kasten || !svg) return;
    // Lage in Layout-Pixeln (offsetTop), nicht getBoundingClientRect: das wäre bei Zoom bzw.
    // größerer Textdarstellung skaliert, das SVG im Kasten aber nicht.
    const box = kasten;
    eng = box.clientWidth < 262;
    box.classList.toggle('eng', eng);
    function oben(e: HTMLElement): number {
      let y = 0;
      let el: HTMLElement | null = e;
      while (el && el !== box) {
        y += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      return y;
    }
    const zeilen = [...kasten.querySelectorAll<HTMLElement>('[data-band]')];
    const ziel = kasten.querySelector<HTMLElement>('[data-band-ziel]');
    const abschnitte = zeilen.map((z) => {
      const a = oben(z);
      return { a, b: a + z.offsetHeight + 12, z };
    });
    let hoehe = abschnitte.at(-1)?.b ?? 0;
    if (ziel && haus) {
      const zielOben = oben(ziel) + 2;
      haus.style.top = `${zielOben}px`;
      hoehe = zielOben + 26;
    }
    // Zeit im SVG: Bewegungen beginnen hier und laufen über ein Neuzeichnen hinweg weiter.
    const jetzt = svg.getCurrentTime?.() ?? 0;
    if (merken) {
      if (warFertig.get(merken) === false && fertig) {
        // Die Ansage gilt auch bei „Bewegung reduzieren“; nur das Leuchten fällt dann weg.
        feiern = true;
        if (fuellenBeginn === null && !ruhig()) fuellenBeginn = jetzt;
      }
      warFertig.set(merken, fertig);
    }
    let out = linie(0, hoehe, 'track', 22);
    let farbig = '';
    // Dichte (stil-c.md, 4.11.): Sind mehr als sechs Unterlagen offen, werden die fehlenden Steine zu
    // kleinen gestrichelten Punkten ohne Symbol; die Symbole stehen ohnehin in den Karten.
    const offen = abschnitte.reduce(
      (n, { z }) =>
        n + (z.dataset.docs ?? '').split(',').filter((text) => text.startsWith('fehlt:')).length,
      0,
    );
    const dicht = offen > 6;
    for (const { a, b, z } of abschnitte) {
      const art = z.dataset.band;
      if (art === 'track') continue;
      if (art === 'open') {
        out += linie(a, b, 'tinte', 2, true);
        continue;
      }
      const farbe = `f${z.dataset.farbe ?? '1'}`;
      const duenn = z.dataset.duenn === '1';
      const breite = duenn ? 8 : 12;
      const steine = (z.dataset.docs ?? '')
        .split(',')
        .filter(Boolean)
        .map((text) => {
          const [zustand, symbol, id] = text.split(':');
          const art = zustand as SteinArt;
          return { zustand: art, symbol: symbol ?? '', weg: bewegungVon(art, id, jetzt) };
        });
      if (!steine.length) {
        farbig += linie(a, b, farbe, breite);
        continue;
      }
      const unten = b - 12;
      if (steine.every((s) => s.zustand === 'da')) {
        // Die Bewegung läuft dort, wo der Stein eben noch stand; der Haken kommt in die Mitte.
        const vorher = steine.map((s) => ({ ...s, zustand: s.weg?.vorher ?? s.zustand }));
        for (const { stein, von, bis } of steineVerteilen(vorher, unten - a)) {
          const ya = a + von;
          const yb = a + bis;
          const y = (ya + yb) / 2;
          farbig +=
            stein.weg?.vorher === 'fehlt'
              ? lueckeSchliessen(ya, yb, farbe, breite, stein.weg.beginn)
              : linie(ya, yb, farbe, breite);
          if (stein.weg)
            farbig += steinVergeht(X(y), y, stein.symbol, stein.weg.vorher, stein.weg.beginn);
        }
        const beginne = steine.flatMap((s) => (s.weg ? [s.weg.beginn] : []));
        const y = (a + unten) / 2;
        farbig += hakenStein(X(y), y, beginne.length ? Math.max(...beginne) : undefined);
        continue;
      }
      for (const { stein, weitere, von, bis } of steineVerteilen(steine, unten - a)) {
        const { zustand, symbol: art, weg: bewegung } = stein;
        const ya = a + von;
        const yb = a + bis;
        const y = (ya + yb) / 2;
        const x = X(y);
        if (zustand === 'fehlt') farbig += linie(ya, yb, farbe, 3, true);
        else if (bewegung?.vorher === 'fehlt')
          farbig += lueckeSchliessen(ya, yb, farbe, breite, bewegung.beginn);
        else farbig += linie(ya, yb, farbe, breite);
        if (zustand === 'da')
          farbig += bewegung
            ? steinZuPunkt(x, y, art, bewegung.vorher, bewegung.beginn)
            : `<circle cx="${x}" cy="${y}" r="4.6" class="punkt"/>`;
        else if (weitere.length) farbig += mehrStein(x, y, weitere.length + 1);
        else if (zustand === 'bald')
          farbig +=
            `<circle cx="${x}" cy="${y}" r="12" class="stein-bald"/><circle cx="${x + 9}" cy="${y - 9}" r="4" class="marke"/>` +
            symbol(art, x, y);
        else if (zustand === 'aktuell')
          farbig +=
            `<circle cx="${x}" cy="${y}" r="13" class="aktuell"/>` + symbol(art, x, y, true);
        else if (dicht) farbig += `<circle cx="${x}" cy="${y}" r="5" class="stein-fehlt dicht"/>`;
        else
          farbig += `<circle cx="${x}" cy="${y}" r="12" class="stein-fehlt"/>` + symbol(art, x, y);
      }
    }
    if (fuellenBeginn !== null) {
      // Alles da: nach dem letzten Stein läuft ein Leuchten in den Personenfarben einmal von oben
      // nach unten ins Haus und klingt dann aus. Es liegt unter den Farben und verdeckt nichts.
      const clip = `fuellen-${uid}`;
      const t0 = fuellenBeginn + bw('stein');
      const leuchten = abschnitte
        .filter(({ z }) => z.dataset.band === 'p')
        .map(({ a, b, z }) =>
          linie(a, b, `f${z.dataset.farbe ?? '1'}`, z.dataset.duenn === '1' ? 16 : 22),
        )
        .join('');
      out +=
        `<defs><clipPath id="${clip}"><rect x="-40" y="-20" width="160" height="0">` +
        `${animation('height', `0;${Math.round(hoehe + 40)}`, t0, bw('haus'))}</rect></clipPath></defs>` +
        `<g clip-path="url(#${clip})" opacity="0.5">${leuchten}${animation('opacity', '0.5;0', t0 + bw('haus'), bw('schritt'))}</g>`;
    }
    out += farbig;
    svg.setAttribute('width', '80');
    svg.setAttribute('height', String(Math.max(hoehe, 0)));
    // Nur eigenes, festes Markup ohne Nutzereingaben; das SVG hat keine von Svelte gerenderten Kinder.
    // eslint-disable-next-line svelte/no-dom-manipulating
    svg.innerHTML = out;
    if (haus) haus.style.left = `${X(hoehe) - 26}px`;
  }

  $effect(() => {
    if (!kasten) return;
    const beobachter = new ResizeObserver(zeichnen);
    beobachter.observe(kasten);
    // Eigene Zeichnungen im SVG nicht beachten, sonst zeichnet das Band sich endlos neu.
    const aenderungen = new MutationObserver((liste) => {
      if (liste.some((m) => !svg?.contains(m.target))) zeichnen();
    });
    aenderungen.observe(kasten, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-docs', 'data-farbe'],
    });
    void document.fonts?.ready.then(zeichnen);
    zeichnen();
    return () => {
      beobachter.disconnect();
      aenderungen.disconnect();
    };
  });
</script>

<p class="visually-hidden" role="status">{angesagt}</p>
<div class="band" bind:this={kasten}>
  <svg
    class="band-svg"
    bind:this={svg}
    role={bild ? 'img' : undefined}
    aria-label={bild || undefined}
    aria-hidden={bild ? undefined : 'true'}
  ></svg>
  {@render children()}
  <div class="haus" bind:this={haus}>
    <Ziel {fertig} {feiern} groesse={52} beschriftung={zielBeschriftung} />
  </div>
</div>

<style>
  .band {
    --spalte: 64px;
    position: relative;
    margin: 20px 16px 0 10px;
  }

  :global(.band.eng) {
    --spalte: 48px;
  }

  .band-svg {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
  }

  .haus {
    position: absolute;
    left: 8px;
  }

  .band :global(path) {
    fill: none;
    stroke-linecap: round;
  }

  .band :global(.track) {
    stroke: var(--track);
  }
  .band :global(.tinte) {
    stroke: var(--ink);
  }
  .band :global(.f1) {
    stroke: var(--person-1);
  }
  .band :global(.f2) {
    stroke: var(--person-2);
  }
  .band :global(.f3) {
    stroke: var(--person-3);
  }
  .band :global(.f4) {
    stroke: var(--person-4);
  }

  .band :global(.f5) {
    stroke: var(--person-5);
  }

  .band :global(.f6) {
    stroke: var(--person-6);
  }

  .band :global(.f7) {
    stroke: var(--person-7);
  }

  .band :global(.f8) {
    stroke: var(--person-8);
  }

  .band :global(.f9) {
    stroke: var(--person-9);
  }

  .band :global(.f10) {
    stroke: var(--person-10);
  }

  .band :global(.f11) {
    stroke: var(--person-11);
  }

  .band :global(.f12) {
    stroke: var(--person-12);
  }

  /* „da“: kleiner Punkt mit dünnem Ring (B11, 3.4), damit er auf jeder Personenfarbe steht. */
  .band :global(.punkt) {
    fill: var(--stone);
    stroke: var(--on-person);
    stroke-width: 1;
  }

  .band :global(.punkt.alles-da) {
    stroke-width: 1.6;
  }

  .band :global(.stein-bald) {
    fill: var(--stone);
    stroke: var(--on-person);
    stroke-width: 2;
  }

  .band :global(.marke) {
    fill: var(--on-person);
    stroke: var(--stone);
    stroke-width: 1.5;
  }

  .band :global(.stein-fehlt) {
    fill: var(--ground);
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-dasharray: 3 3;
  }

  .band :global(.stein-fehlt.dicht) {
    stroke-width: 1.4;
    stroke-dasharray: 2 2;
  }

  .band :global(.aktuell) {
    fill: var(--ink);
  }

  .band :global(.icon) {
    fill: none;
    stroke: var(--ink);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .band :global(.stein-bald + circle + .icon) {
    stroke: var(--on-person);
  }

  .band :global(.icon.haken) {
    stroke: var(--on-person);
  }

  .band :global(.mehr-zahl) {
    fill: var(--ink);
    font-size: calc(11 * var(--px));
    font-weight: 800;
    text-anchor: middle;
    dominant-baseline: central;
  }

  .band :global(.icon.hell) {
    stroke: var(--ground);
  }
</style>

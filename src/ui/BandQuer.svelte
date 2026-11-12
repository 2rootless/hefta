<script lang="ts" module>
  /** Ein Stein im waagerechten Band: offen, aktuell, drin (hochgeladen) oder weg (übersprungen). */
  export interface QuerStein {
    farbe: number;
    art: 'offen' | 'aktuell' | 'drin' | 'weg' | 'bald';
  }
</script>

<script lang="ts">
  // Das Band waagerecht (design/einrichtung-rutsch-navigation.md, R0–R3): alle Steine der Runde,
  // der aktuelle groß, erledigte in Personenfarbe, übersprungene gestrichelt, rechts das Haus.
  // Im Rutsch lässt sich jeder Stein antippen.
  let {
    steine,
    beschriftung,
    haus = true,
    springen,
    stellen = [],
  }: {
    steine: QuerStein[];
    beschriftung: string;
    haus?: boolean;
    springen?: (i: number) => void;
    /** Beschriftung je Stein, für `springen`. */
    stellen?: string[];
  } = $props();

  const Y = (x: number) => 26 + 8 * Math.cos(((x - 53) * 2 * Math.PI) / 214);
  const pfad = Array.from({ length: 104 }, (_, i) => 14 + i * 3)
    .map((x, i) => `${i ? 'L' : 'M'}${x} ${Y(x).toFixed(1)}`)
    .join(' ');
  const punkte = $derived(
    steine.map((s, i) => {
      const breite = haus ? 280 : 300;
      const x = steine.length > 1 ? 20 + (i * breite) / (steine.length - 1) : 20;
      return { ...s, x, y: Y(x) };
    }),
  );
  // Bei vielen Steinen kleiner, damit sie sich nicht berühren.
  const klein = $derived(steine.length > 16);
  // Getippt wird der Streifen um den Stein, nicht nur der kleine Kreis.
  const streifen = $derived(steine.length > 1 ? (haus ? 280 : 300) / (steine.length - 1) : 40);

  function flaeche(element: HTMLElement, x: number) {
    const setzen = (mitte: number) => {
      const von = Math.max(0, mitte - streifen / 2);
      const bis = Math.min(haus ? 334 : 370, mitte + streifen / 2);
      element.style.left = `${(von / 370) * 100}%`;
      element.style.width = `${((bis - von) / 370) * 100}%`;
    };
    setzen(x);
    return { update: setzen };
  }
</script>

<div class="kasten">
  <svg class="quer" viewBox="0 0 370 52" role="img" aria-label={beschriftung}>
    <path class="spur" d={pfad} />
    {#each punkte as p, i (i)}
      {#if p.art === 'aktuell'}
        <circle class="farbe-{p.farbe} pf rand" cx={p.x} cy={p.y} r={klein ? 9 : 12} />
      {:else if p.art === 'drin'}
        <circle class="farbe-{p.farbe} pf" cx={p.x} cy={p.y} r={klein ? 6 : 8} />
        <circle class="loch" cx={p.x} cy={p.y} r={klein ? 2 : 3} />
      {:else if p.art === 'bald'}
        <circle class="bald" cx={p.x} cy={p.y} r={klein ? 7 : 10} />
        <circle class="punkt" cx={p.x} cy={p.y} r={klein ? 2.4 : 3.2} />
      {:else if p.art === 'weg'}
        <circle class="weg" cx={p.x} cy={p.y} r={klein ? 5 : 7} />
      {:else}
        <circle class="farbe-{p.farbe} pf blass" cx={p.x} cy={p.y} r={klein ? 4 : 6} />
      {/if}
    {/each}
    {#if haus}<svg x="338" y="12" width="28" height="28" viewBox="0 0 32 32">
        <path
          class="haus"
          d="M3 14.2 14.4 4.3a2.4 2.4 0 0 1 3.2 0L29 14.2V26.5a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 26.5Z"
        />
      </svg>{/if}
  </svg>
  {#if springen}
    {#each punkte as p, i (i)}
      <button
        tabindex="-1"
        aria-hidden="true"
        type="button"
        class="tippen"
        use:flaeche={p.x}
        aria-label={stellen[i]}
        aria-current={p.art === 'aktuell' ? 'step' : undefined}
        onclick={() => springen(i)}
      ></button>
    {/each}
  {/if}
</div>

<style>
  .kasten {
    position: relative;
    /* So hoch wie die Tippflächen der Punkte: Bei großer Schrift ragten sie sonst in die Knöpfe darunter. */
    min-height: var(--tap-target);
    margin: 6px 10px 0;
  }

  .quer {
    display: block;
    width: 100%;
    height: auto;
  }

  .tippen {
    position: absolute;
    top: 50%;
    height: max(100%, var(--tap-target));
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: none;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .tippen:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .spur {
    fill: none;
    stroke: var(--track);
    stroke-width: 18;
    stroke-linecap: round;
  }

  /* Zwölf Personenfarben (B14) über die gemeinsamen Klassen `.farbe-N` in global.css. */
  .pf {
    fill: var(--farbe);
  }

  .blass {
    opacity: 0.55;
  }

  .rand {
    stroke: var(--ink);
    stroke-width: 2.5;
  }

  .loch {
    fill: var(--surface);
  }

  .bald {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2.5;
  }

  .punkt {
    fill: var(--ink);
  }

  .weg {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-dasharray: 2 3;
  }

  .haus {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    stroke-dasharray: 3 3;
    opacity: 0.5;
  }
</style>

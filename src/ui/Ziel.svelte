<script lang="ts">
  // Das Ziel am Ende des Wegs (design/logo/README.md): Solange etwas fehlt das Zeichen blass im
  // gestrichelten Feld, wenn alles da ist die Kachel, also das App-Symbol.
  import { KLAMMER } from '../domain/logo';

  let {
    fertig = false,
    feiern = false,
    beschriftung,
    groesse = 44,
  }: { fertig?: boolean; feiern?: boolean; beschriftung?: string; groesse?: number } = $props();
  // Maße aus dem Symbolsatz B11 (svg/band/hefta-ziel-*-56.svg): Ecke 0,29, Marke halb so hoch wie
  // das Feld, in beiden Zuständen gleich; offen gestrichelt, fertig die Kachel wie das App-Symbol.
  const marke = $derived(Math.round(groesse * 0.5));
  const radius = $derived(Math.round(groesse * 0.29 * 10) / 10);
  const rand = $derived(fertig ? 0 : 1);
  const k = $derived(groesse / 56);
</script>

<svg
  class="ziel"
  class:fertig
  class:feiern
  width={groesse}
  height={groesse}
  viewBox="0 0 {groesse} {groesse}"
  role={beschriftung ? 'img' : undefined}
  aria-label={beschriftung}
  aria-hidden={beschriftung ? undefined : 'true'}
>
  <rect
    class="rahmen"
    x={rand}
    y={rand}
    width={groesse - 2 * rand}
    height={groesse - 2 * rand}
    rx={radius}
  />
  <svg
    x={(groesse - marke) / 2}
    y={(groesse - marke) / 2}
    width={marke}
    height={marke}
    viewBox="0 1.5 32 32"
  >
    <path class="klammer" d={KLAMMER} />
  </svg>
  {#if feiern}
    <g class="funken" transform="scale({k})">
      <path d="M61.1 -3.4L67 -4.4" /><path d="M57.8 -9.8L62 -14" /><path d="M51.4 -13.1L52.4 -19" />
    </g>
  {/if}
</svg>

<style>
  .ziel {
    display: block;
    overflow: visible;
  }

  /* Drei Funken oben rechts, wenn das Ziel ankommt (B11, hefta-ziel-feiern-56). */
  .funken {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.2;
    stroke-linecap: round;
    animation: funken 280ms ease-out 820ms backwards;
  }

  @keyframes funken {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .funken {
      animation: none;
    }
  }

  .fertig {
    border-radius: 12px;
    box-shadow: var(--shadow-goal);
  }

  /* Wenn das Leuchten angekommen ist (nach 840 ms), hebt sich das Ziel einmal kurz. */
  .feiern {
    animation: ankommen 280ms ease-out 820ms backwards;
  }

  @keyframes ankommen {
    50% {
      transform: scale(1.08);
    }
  }

  .rahmen {
    fill: var(--ground);
    stroke: var(--ink);
    stroke-opacity: 0.45;
    stroke-width: 1.6;
    stroke-dasharray: 4 3.4;
    stroke-linecap: round;
  }

  .fertig .rahmen {
    fill: #ff8466;
    stroke: none;
  }

  .klammer {
    fill: none;
    stroke: var(--ink);
    stroke-opacity: 0.18;
    stroke-width: 3.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .fertig .klammer {
    stroke: #ffffff;
    stroke-opacity: 1;
  }
</style>

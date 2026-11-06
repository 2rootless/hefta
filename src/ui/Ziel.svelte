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
  // Stil C: 52 px, offen mit Radius 18 (design/stil-c.md), die Kachel wie das App-Symbol.
  const marke = $derived(Math.round(groesse * (fertig ? 0.74 : 0.54)));
  const radius = $derived(Math.round(groesse * (fertig ? 0.225 : 0.35)));
  const rand = $derived(fertig ? 0 : 1);
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
    viewBox={fertig ? '0 2 32 30' : '0 1.5 32 32'}
  >
    <path class="klammer" d={KLAMMER} />
  </svg>
</svg>

<style>
  .ziel {
    display: block;
  }

  .fertig {
    border-radius: 12px;
    box-shadow: var(--shadow-goal);
  }

  /* Wenn das Leuchten angekommen ist (nach 840 ms), hebt sich das Ziel einmal kurz. */
  .feiern {
    animation: ankommen 280ms ease-out 820ms both;
  }

  @keyframes ankommen {
    50% {
      transform: scale(1.08);
    }
  }

  .rahmen {
    fill: var(--ground);
    stroke: var(--ink);
    stroke-opacity: 0.35;
    stroke-width: 2;
    stroke-dasharray: 5 4;
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

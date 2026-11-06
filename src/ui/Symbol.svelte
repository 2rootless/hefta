<script lang="ts">
  // Eigene Symbole auf 16er-Raster, 2px Linie, runde Enden (design/README.md, Ikonografie).
  import type { Symbol } from '../domain/regelkatalog';

  let {
    name,
    groesse = 12,
  }: {
    name:
      | Symbol
      | 'plus'
      | 'haken'
      | 'zurueck'
      | 'weiter'
      | 'schloss'
      | 'personen'
      | 'zahnrad'
      | 'datei'
      | 'info';
    groesse?: number;
  } = $props();
</script>

<svg
  width={groesse}
  height={groesse}
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'info'}
    <circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5h.01" />
  {:else if name === 'form'}
    <rect x="3" y="2" width="10" height="12" rx="1.5" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
  {:else if name === 'euro'}
    <path d="M11.5 4.2A4.6 4.6 0 1 0 11.5 11.8" /><path d="M3 7h6M3 9.2h6" />
  {:else if name === 'shield'}
    <path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" />
  {:else if name === 'key'}
    <circle cx="5.5" cy="8" r="2.8" /><path d="M8.3 8H14M12 8v2.4" />
  {:else if name === 'plus'}
    <path d="M8 3v10M3 8h10" />
  {:else if name === 'haken'}
    <path d="M3.3 8.3l3 3L12.7 4.7" />
  {:else if name === 'weiter'}
    <path d="M6 3l5 5-5 5" />
  {:else if name === 'personen'}
    <circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 13.5c.4-2.5 2.2-4 4.5-4s4.1 1.5 4.5 4" /><path
      d="M10.5 3.2a2.4 2.4 0 1 1 0 4.6M12 9.6c1.4.5 2.3 1.9 2.5 3.9"
    />
  {:else if name === 'zahnrad'}
    <circle cx="8" cy="8" r="2.2" /><path
      d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6 3.4 3.4"
    />
  {:else if name === 'datei'}
    <path d="M4 1.5h5l3.5 3.5v9.5H4z" /><path d="M9 1.5V5h3.5" />
  {:else if name === 'schloss'}
    <rect x="3.5" y="7" width="9" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  {:else if name === 'zurueck'}
    <path d="M10 3L5 8l5 5" />
  {/if}
</svg>

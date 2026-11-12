<script lang="ts" module>
  /** Feste Plätze für eigene Grafiken (E58). Der Name ist zugleich der Dateiname in src/grafiken/. */
  export type GrafikName =
    | 'erster-start'
    | 'wohnungen-leer'
    | 'alles-da'
    | 'zusage'
    | 'teilen-1'
    | 'teilen-2'
    | 'teilen-3'
    | 'teilen-4';
</script>

<script lang="ts">
  // Ein fester Platz für eine eigene Grafik (E58). Liegt unter src/grafiken/{name}.svg eine Grafik, steht
  // sie hier; sonst steht da, was heute gezeichnet ist (oder nichts). So kommt eine Grafik später
  // hinein, ohne die Seite umzubauen. Die Grafiken prüft scripts/check-grafiken.mjs beim Bau: nur
  // eigene, ohne Skript, ohne fremde Adressen, Farben nur aus den Tokens.
  import type { Snippet } from 'svelte';

  const GRAFIKEN = import.meta.glob('../grafiken/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  let {
    name,
    hoehe = 160,
    children,
  }: {
    name: GrafikName;
    /** Höchste Höhe der Grafik in px; die Breite folgt dem Bild. */
    hoehe?: number;
    children?: Snippet;
  } = $props();

  const svg = $derived(GRAFIKEN[`../grafiken/${name}.svg`]);
</script>

{#if svg}
  <!-- Schmuck: Was die Grafik zeigt, sagt der Text daneben. -->
  <div class="grafik-platz" data-grafik={name} aria-hidden="true" style:--hoehe="{hoehe}px">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- eigene, beim Bau geprüfte SVG-Datei -->
    {@html svg}
  </div>
{:else if children}
  <div class="grafik-platz leer" data-grafik={name}>{@render children()}</div>
{/if}

<style>
  .grafik-platz {
    display: contents;
  }

  .grafik-platz:not(.leer) {
    display: flex;
    justify-content: center;
  }

  .grafik-platz :global(svg) {
    display: block;
    max-width: 100%;
    max-height: var(--hoehe);
    height: auto;
  }
</style>

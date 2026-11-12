<script lang="ts">
  // Die vier Zeichen für Urteile aus B23 (`.zch`): passt (Haken), knapp (halb gefüllter Kreis), passt
  // nicht (gefülltes Kästchen mit Kreuz), offen (gestrichelter Kreis mit Fragezeichen). Nur Schmuck: das
  // Wort steht immer daneben.
  let { art, groesse = 14 }: { art: 'passt' | 'knapp' | 'nicht' | 'offen'; groesse?: number } =
    $props();
</script>

<svg class={`zch ${art}`} width={groesse} height={groesse} viewBox="0 0 16 16" aria-hidden="true">
  {#if art === 'passt'}
    <path
      d="M3.5 8.4l3 3 6-6.6"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {:else if art === 'knapp'}
    <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" />
  {:else if art === 'nicht'}
    <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" />
    <path
      d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2"
      stroke="var(--surface)"
      stroke-width="1.8"
      stroke-linecap="round"
    />
  {:else}
    <circle
      cx="8"
      cy="8"
      r="6.2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.3"
      stroke-dasharray="2.2 1.8"
    />
    <path
      d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.5-.7 1v.4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <circle cx="8" cy="11.4" r=".9" fill="currentColor" />
  {/if}
</svg>

<style>
  .zch {
    flex: none;
  }

  .passt {
    color: var(--passt-text);
  }

  .knapp {
    color: var(--knapp-text);
  }

  .nicht {
    color: var(--ink);
  }

  .offen {
    color: var(--ink-muted);
  }
</style>

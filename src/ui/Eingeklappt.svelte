<script lang="ts">
  // Eingeklappter Abschnitt: eigener Knopf statt <details>, das sich in Safari auf dem iPhone mit
  // gestalteter Überschrift nicht zuverlässig öffnen ließ.
  import type { Snippet } from 'svelte';
  import Symbol from './Symbol.svelte';

  let { titel, unter, children }: { titel: string; unter?: string; children: Snippet } = $props();
  let offen = $state(false);
</script>

<button type="button" class="kopf" aria-expanded={offen} onclick={() => (offen = !offen)}>
  <span
    >{titel}{#if unter}<small>{unter}</small>{/if}</span
  >
  <span class="pfeil" class:auf={offen} aria-hidden="true"
    ><Symbol name="weiter" groesse={16} /></span
  >
</button>
{#if offen}
  <div class="einblenden">{@render children()}</div>
{/if}

<style>
  .kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 0 var(--space-1);
    border: 0;
    background: none;
    color: var(--ink);
    font-size: calc(16 * var(--px));
    font-weight: 800;
    text-align: left;
    cursor: pointer;
  }

  small {
    display: block;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 400;
    color: var(--ink-muted);
  }

  .pfeil {
    display: inline-flex;
    flex-shrink: 0;
    opacity: 0.6;
    transition: transform 150ms ease-out;
  }

  .auf {
    transform: rotate(90deg);
  }
</style>

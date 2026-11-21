<script lang="ts">
  // Hinweis (DP33 A1): weiche Fläche ohne Linie, Zeichen aus B11 links. „stark“ heißt Warnung oder Fehler: dann
  // steht das Warnzeichen in Bernstein (DP63b, DP63c F2, W5). Hebt die Notiz nur hervor, bleibt das Zeichen „info“
  // in Tinte.
  import type { Snippet } from 'svelte';
  import Symbol from './Symbol.svelte';
  import Warnzeichen from './Warnzeichen.svelte';

  let {
    stark = false,
    children,
  }: {
    stark?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="notiz" class:stark>
  <span class="ic" aria-hidden="true"
    >{#if stark}<Warnzeichen />{:else}<Symbol name="info" groesse={20} />{/if}</span
  >
  <div class="inhalt">{@render children()}</div>
</div>

<style>
  .notiz {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background: var(--surface);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .inhalt {
    flex: 1;
    min-width: 0;
  }

  .inhalt :global(p) {
    margin: 0;
  }

  .inhalt :global(.textlink) {
    margin-bottom: -10px;
  }

  /* DP33 A1: ohne Linie; das Zeichen aus B11 links. Bei einer Warnung das Warnzeichen (DP63c F2). */
  .ic {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 20px;
    height: 21px;
    color: var(--ink);
  }
</style>

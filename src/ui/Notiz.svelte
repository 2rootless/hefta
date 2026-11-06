<script lang="ts">
  // Hinweis im Stil C: weiße Fläche mit Zeichen im Kreis; „stark“ mit Rahmen und „!“.
  import type { Snippet } from 'svelte';

  let {
    stark = false,
    children,
  }: {
    stark?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="notiz" class:stark>
  <span class="ic" aria-hidden="true">{stark ? '!' : 'i'}</span>
  <div class="inhalt">{@render children()}</div>
</div>

<style>
  .notiz {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 18px;
    background: var(--surface);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .stark {
    border: 2px solid var(--ink);
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

  .ic {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    font-size: calc(13 * var(--px));
    font-weight: 800;
  }
</style>

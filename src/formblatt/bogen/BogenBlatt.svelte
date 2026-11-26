<script lang="ts">
  // Ein Blatt im Bogen (DP134, DP135): weiße Seite mit „… von“, Vorname und Nachname als große Linien, darunter der Satz.
  // Mit Reitern hängt das Blatt oben links an seiner Lasche.
  import type { Snippet } from 'svelte';
  import BogenFeld from './BogenFeld.svelte';

  let {
    titel,
    vorname = $bindable(''),
    nachname = $bindable(''),
    satz,
    name,
    reiter,
    children,
  }: {
    titel: string;
    vorname?: string;
    nachname?: string;
    satz: string;
    /** Name des Blatts für den Vorleser („Bogen Jarne Ostendorp“). */
    name: string;
    reiter?: Snippet;
    children: Snippet;
  } = $props();

  const id = $props.id();
</script>

{@render reiter?.()}
<section class="blatt" class:ohne={!reiter} aria-label={name}>
  <p class="btitel" id="{id}-titel">{titel}</p>
  <div class="name" role="group" aria-labelledby="{id}-titel">
    <!-- DP140: Der Satz unter dem Namen ist an beide Felder gebunden. -->
    <div class="teil">
      <BogenFeld
        etikett="Vorname"
        bind:wert={vorname}
        breit
        feld={{ 'aria-describedby': `${id}-satz` }}
      />
    </div>
    <div class="teil">
      <BogenFeld
        etikett="Nachname"
        bind:wert={nachname}
        breit
        feld={{ 'aria-describedby': `${id}-satz` }}
      />
    </div>
  </div>
  <p class="satz w30" id="{id}-satz" data-w30="gruppe">{satz}</p>
  {@render children()}
</section>

<style>
  .blatt {
    position: relative;
    padding: 24px 16px 32px;
    border-radius: 0 6px 6px 6px;
    background: var(--surface);
    box-shadow:
      0 1px 0 var(--line-strong),
      0 8px 24px rgb(38 34 30 / 0.08);
  }

  .ohne {
    margin-top: 24px;
    border-radius: 6px;
  }

  .btitel {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
    color: var(--ink-muted);
  }

  .name {
    display: flex;
    flex-wrap: wrap;
    gap: 0 12px;
  }

  .teil {
    flex: 1 1 calc(120 * var(--px));
    min-width: 0;
  }

  .satz {
    margin: 4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
</style>

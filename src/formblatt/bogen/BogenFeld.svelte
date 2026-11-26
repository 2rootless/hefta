<script lang="ts">
  // „Der Bogen selbst“ (DP134, DP135): ein Feld als Linie wie auf Papier, Etikett klein darüber, der Satz darunter mit
  // aria-describedby gebunden (PC205, Abschnitt 2). Fokus ist der Strich (W33).
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    etikett,
    wert = $bindable(''),
    satz,
    breit = false,
    feld = {},
  }: {
    etikett: string;
    wert?: string;
    satz?: string;
    /** Name im Kopf des Blatts: groß und fett. */
    breit?: boolean;
    feld?: HTMLInputAttributes;
  } = $props();

  const id = $props.id();
</script>

<label class="bogen-feld" class:breit>
  <span class="l" class:visually-hidden={breit}>{etikett}</span>
  <input
    {...feld}
    placeholder={breit ? etikett : feld.placeholder}
    bind:value={wert}
    aria-describedby={satz ? `${id}-satz` : feld['aria-describedby']}
  />
</label>
{#if satz}<p class="bogen-satz w30" id="{id}-satz" data-w30="feld">{satz}</p>{/if}

<style>
  .bogen-feld {
    display: block;
    min-width: 0;
    margin-top: 16px;
  }

  .l {
    display: block;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
    color: var(--ink-muted);
  }

  input {
    display: block;
    width: 100%;
    min-height: 44px;
    padding: 8px 0;
    border: 0;
    border-bottom: 1px solid var(--ink-quiet);
    border-radius: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(17 * var(--px));
    line-height: calc(24 * var(--px));
  }

  input::placeholder {
    color: var(--ink-quiet);
  }

  input:focus,
  input:focus-visible {
    outline: none;
    border-bottom-color: var(--ink);
    box-shadow: 0 3px 0 0 var(--ink);
  }

  .breit {
    margin-top: 0;
  }

  .breit input {
    font-size: calc(22 * var(--px));
    line-height: calc(28 * var(--px));
    font-weight: 700;
  }

  .breit input::placeholder {
    font-weight: 400;
  }

  .bogen-satz {
    margin: 4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
</style>

<script lang="ts">
  // Hefta 2 (B17a, Nachricht 9.11. a, Punkt 3): Zeile mit Schalter, die ganze Zeile ist die Tippfläche,
  // mindestens 44 px, role="switch". Aussehen des Schalters wie Schalter.svelte.
  import Symbol from './Symbol.svelte';

  let {
    an,
    titel,
    text = '',
    gesperrt = false,
    onclick,
  }: {
    an: boolean;
    titel: string;
    text?: string;
    gesperrt?: boolean;
    onclick: () => void;
  } = $props();
</script>

<button
  type="button"
  class="zeile"
  role="switch"
  aria-checked={an}
  aria-disabled={gesperrt}
  onclick={() => {
    if (!gesperrt) onclick();
  }}
>
  <span class="tx"
    ><b>{titel}</b>{#if text}<small>{text}</small>{/if}</span
  >
  <span class="bahn" aria-hidden="true">
    <span class="knopf"
      >{#if an}<Symbol name="haken" groesse={16} />{/if}</span
    >
  </span>
</button>

<style>
  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 10px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .tx b {
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 800;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .bahn {
    position: relative;
    display: block;
    flex-shrink: 0;
    width: 51px;
    height: 31px;
    border: 2px solid var(--control-border);
    border-radius: 16px;
    transition:
      background-color var(--bw-knapp) var(--bw-weich),
      border-color var(--bw-knapp) var(--bw-weich);
  }

  .knopf {
    position: absolute;
    top: 2px;
    left: 2px;
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    border-radius: 50%;
    background: var(--control-border);
    color: var(--ink);
    transition:
      left var(--bw-knapp) var(--bw-ziel),
      background-color var(--bw-knapp) var(--bw-weich);
  }

  [aria-checked='true'] .bahn {
    border-color: var(--ink);
    background: var(--ink);
  }

  [aria-checked='true'] .knopf {
    left: 22px;
    background: var(--ground);
  }

  [aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

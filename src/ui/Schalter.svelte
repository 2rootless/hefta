<script lang="ts">
  // Schalter (abgleich-produkt.md, dritte Runde, Punkt 5): an und aus auch im dunklen Thema und in
  // Graustufen klar unterscheidbar, nicht nur über die Lage des Knopfs. An: gefüllte Bahn, Haken im
  // Knopf. Aus: nur Umriss. Sichtbar 51 × 31 px, getippt wird die ganze Höhe (mindestens 44 px).
  import Symbol from './Symbol.svelte';

  let {
    an,
    label,
    gesperrt = false,
    onclick,
  }: {
    an: boolean;
    label: string;
    gesperrt?: boolean;
    onclick: () => void;
  } = $props();
</script>

<button
  type="button"
  class="schalter"
  role="switch"
  aria-checked={an}
  aria-disabled={gesperrt}
  aria-label={label}
  onclick={() => {
    if (!gesperrt) onclick();
  }}
>
  <span class="bahn" aria-hidden="true">
    <span class="knopf"
      >{#if an}<Symbol name="haken" groesse={13} />{/if}</span
    >
  </span>
</button>

<style>
  .schalter {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 51px;
    min-height: var(--tap-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }

  .bahn {
    position: relative;
    display: block;
    width: 51px;
    height: 31px;
    border: 2px solid var(--control-border);
    border-radius: 16px;
    transition:
      background-color 150ms ease-out,
      border-color 150ms ease-out;
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
      left 150ms ease-out,
      background-color 150ms ease-out;
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

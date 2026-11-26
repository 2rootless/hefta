<script lang="ts">
  // Zähler im Bogen (DP134, „Wer einzieht“): Gruppe mit Namen, „Weniger …“ und „Mehr …“ als Knöpfe.
  let {
    etikett,
    wert = $bindable(0),
    min = 0,
  }: { etikett: string; wert?: number; min?: number } = $props();
</script>

<div class="zaehler" role="group" aria-label={etikett}>
  <span aria-hidden="true">{etikett}</span>
  <button
    type="button"
    aria-label="Weniger {etikett}"
    disabled={wert <= min}
    onclick={() => (wert = Math.max(min, wert - 1))}>−</button
  >
  <output aria-live="polite">{wert}</output>
  <button type="button" aria-label="Mehr {etikett}" onclick={() => (wert = Math.min(20, wert + 1))}
    >+</button
  >
</div>

<style>
  .zaehler {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin-bottom: 8px;
  }

  span {
    flex-basis: 100%;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  button {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--ink-quiet);
    border-radius: 999px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(20 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  button:focus-visible {
    outline: none;
    box-shadow: 0 3px 0 0 var(--ink);
  }

  output {
    min-width: 24px;
    text-align: center;
    font-weight: 700;
  }
</style>

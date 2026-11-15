<script lang="ts">
  // Hauptbutton (design/bausteine/Button.md): höchstens einer pro Bildschirm, die einzige dunkle Fläche.
  // Deaktiviert: Text in ink-muted und ein Satz, warum es noch nicht geht.
  interface Props {
    text: string;
    onclick?: () => void;
    grund?: string;
    /**
     * Deaktiviert, wobei der Grund schon an anderer Stelle steht (etwa am Zähler eines Felds, DP33 5.2):
     * die Kennung dieses Texts. Er wird nicht wiederholt.
     */
    grundBei?: string;
  }
  let { text, onclick, grund, grundBei }: Props = $props();
  const aus = $derived(!!grund || !!grundBei);
  const grundId = $props.id();
</script>

<div class="hauptbutton">
  <button
    type="button"
    class:deaktiviert={aus}
    aria-disabled={aus ? 'true' : undefined}
    aria-describedby={grund ? grundId : grundBei}
    onclick={() => {
      if (!aus) onclick?.();
    }}
  >
    {text}
  </button>
  {#if grund}
    <p id={grundId}>{grund}</p>
  {/if}
</div>

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 54px;
    padding: 0 var(--space-5);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  button {
    transition: transform var(--bw-knapp) var(--bw-weich);
  }

  button:active:not(.deaktiviert) {
    transform: scale(0.98);
    filter: brightness(0.94);
  }

  .deaktiviert {
    background: var(--track);
    color: var(--ink-muted);
    cursor: not-allowed;
  }

  p {
    margin: var(--space-2) 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    text-align: center;
  }
</style>

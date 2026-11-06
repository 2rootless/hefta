<script lang="ts">
  // Bottom Sheet als <dialog>: Fokus bleibt im Sheet, Escape schließt, Hintergrund ist inaktiv.
  import type { Snippet } from 'svelte';
  import { t } from '../i18n';

  let {
    offen = $bindable(false),
    titel,
    kopf,
    kreuz = false,
    titelFokus = false,
    children,
  }: {
    offen: boolean;
    titel: string;
    kopf?: Snippet;
    /** „×“ oben rechts, 44 px. */
    kreuz?: boolean;
    /** Beim Öffnen auf den Titel, damit Screenreader dort anfangen. */
    titelFokus?: boolean;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let ueberschrift: HTMLHeadingElement | undefined = $state();
  const titelId = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (offen && !dialog.open) {
      dialog.showModal();
      if (titelFokus && ueberschrift) {
        ueberschrift.tabIndex = -1;
        ueberschrift.focus();
      }
    }
    if (!offen && dialog.open) dialog.close();
  });

  // Am Griff nach unten wischen schließt.
  let start = 0;
  let weg = 0;
  function wischStart(e: TouchEvent) {
    start = e.touches[0]!.clientY;
    weg = 0;
  }
  function wischen(e: TouchEvent) {
    weg = Math.max(0, e.touches[0]!.clientY - start);
    if (dialog) dialog.style.transform = weg ? `translateY(${weg}px)` : '';
  }
  function wischEnde() {
    if (dialog) dialog.style.transform = '';
    if (weg > 70) offen = false;
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={titelId}
  onclose={() => (offen = false)}
  onclick={(e) => {
    // Tipp auf den abgedunkelten Hintergrund schließt.
    if (e.target === dialog) offen = false;
  }}
>
  <div class="inhalt">
    <div
      class="griff-flaeche"
      aria-hidden="true"
      ontouchstart={wischStart}
      ontouchmove={wischen}
      ontouchend={wischEnde}
    >
      <span class="griff"></span>
    </div>
    {#if kreuz}
      <button
        type="button"
        class="kreuz"
        aria-label={t('allgemein.schliessen')}
        onclick={() => (offen = false)}>×</button
      >
    {/if}
    {#if kopf}<div class="kopf">{@render kopf()}</div>{/if}
    <h2 id={titelId} class="titel" class:mit-kreuz={kreuz} bind:this={ueberschrift}>
      {titel}
    </h2>
    {#if offen}
      {@render children()}
    {/if}
  </div>
</dialog>

<style>
  dialog {
    width: 100%;
    max-width: var(--content-width);
    max-height: 92dvh;
    margin: auto auto 0;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 0;
    border: 0;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    background: var(--ground);
    color: var(--ink);
    box-shadow: var(--shadow-sheet);
  }

  dialog::backdrop {
    background: rgb(25 26 44 / 0.45);
  }

  /* Solange ein Blatt offen ist, bewegt sich die Seite dahinter nicht. */
  :global(html:has(dialog[open])),
  :global(html:has(dialog[open]) body) {
    overflow: hidden;
  }

  .inhalt {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-3) var(--space-5) calc(var(--space-5) + env(safe-area-inset-bottom));
  }

  .kopf {
    margin-bottom: calc(-1 * var(--space-3));
  }

  .griff-flaeche {
    display: grid;
    place-items: center;
    height: 24px;
    margin: -10px 0 -10px;
    touch-action: none;
  }

  .kreuz {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--ink);
    font-size: calc(24 * var(--px));
    line-height: 1;
    cursor: pointer;
  }

  .mit-kreuz {
    padding-right: 36px;
  }

  .titel:focus {
    outline: none;
  }

  .griff {
    justify-self: center;
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--line);
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog[open] {
      animation: hoch 220ms ease-out;
    }
  }

  @keyframes hoch {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }
</style>

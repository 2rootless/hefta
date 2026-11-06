<script lang="ts">
  // Nach links wischen zeigt „Löschen“, ganz durchwischen löscht (design/nachtraeglich-ordnen.md, OR7).
  // Für VoiceOver, Schalter und Tastatur ist die Fläche versteckt: Dort gibt es „Bearbeiten“ (OR7c).
  import type { Snippet } from 'svelte';
  import { t } from '../i18n';

  let {
    aktiv = true,
    beimLoeschen,
    children,
  }: { aktiv?: boolean; beimLoeschen: () => void; children: Snippet } = $props();

  const BREITE = 96;
  let zeile = $state<HTMLElement>();
  let versatz = $state(0);
  let gezogen = $state(false);

  function wischen(element: HTMLElement) {
    let startX = 0;
    let startY = 0;
    let basis = 0;
    let unten = false;
    let bewegt = false;

    const runter = (e: PointerEvent) => {
      if (!aktiv) return;
      startX = e.clientX;
      startY = e.clientY;
      basis = versatz;
      unten = true;
      bewegt = false;
    };
    const ziehen = (e: PointerEvent) => {
      if (!unten) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!bewegt) {
        // Senkrecht ist Scrollen, das bleibt beim Browser.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          unten = false;
          return;
        }
        if (Math.abs(dx) < 10) return;
        bewegt = true;
        gezogen = true;
        element.setPointerCapture(e.pointerId);
      }
      versatz = Math.min(0, basis + dx);
    };
    const los = () => {
      if (!unten) return;
      unten = false;
      gezogen = false;
      if (!bewegt) {
        if (versatz) versatz = 0;
        return;
      }
      if (-versatz > element.clientWidth * 0.6) {
        versatz = 0;
        beimLoeschen();
      } else versatz = -versatz > BREITE / 2 ? -BREITE : 0;
    };
    // Nach dem Wischen öffnet die Zeile nichts.
    const klick = (e: MouseEvent) => {
      if (!bewegt) return;
      bewegt = false;
      e.preventDefault();
      e.stopPropagation();
    };
    element.addEventListener('pointerdown', runter);
    element.addEventListener('pointermove', ziehen);
    element.addEventListener('pointerup', los);
    element.addEventListener('pointercancel', los);
    element.addEventListener('click', klick, true);
    return {
      destroy() {
        element.removeEventListener('pointerdown', runter);
        element.removeEventListener('pointermove', ziehen);
        element.removeEventListener('pointerup', los);
        element.removeEventListener('pointercancel', los);
        element.removeEventListener('click', klick, true);
      },
    };
  }

  $effect(() => {
    zeile?.style.setProperty('transform', versatz ? `translateX(${versatz}px)` : '');
  });
</script>

<div class="wisch" class:aktiv>
  {#if versatz}
    <button
      type="button"
      class="flaeche"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => {
        versatz = 0;
        beimLoeschen();
      }}>{t('allgemein.loeschen')}</button
    >
  {/if}
  <div class="inhalt" class:gezogen bind:this={zeile} use:wischen>
    {@render children()}
  </div>
</div>

<style>
  .wisch {
    position: relative;
    min-width: 0;
    flex: 1 1 9em;
    overflow: hidden;
  }

  .inhalt :global(:focus-visible) {
    outline-offset: -3px;
  }

  .aktiv .inhalt {
    touch-action: pan-y;
  }

  .flaeche {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 96px;
    border: 0;
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .inhalt {
    position: relative;
    background: var(--surface);
    transition: transform 0.15s ease-out;
  }

  .inhalt.gezogen {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .inhalt {
      transition: none;
    }
  }
</style>

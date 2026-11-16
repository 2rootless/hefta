<script lang="ts">
  // PC64, Punkt 4 (W20, DP39 1.4 und 1.5): der Kopf einer Seite in voller Breite, darauf was Hefta erkannt
  // hat (Monat, Name) wie mit Textmarker. Liegt eine Markierung unter dem sichtbaren Ausschnitt, rückt die
  // Seite so weit nach oben, dass sie zu sehen ist.
  import type { Stelle } from '../domain/nameFinden';

  let { bild, marken = [] }: { bild: string; marken?: Stelle[] } = $props();

  let blatt = $state<HTMLElement>();

  function ausrichten() {
    if (!blatt) return;
    const rahmen = blatt.parentElement?.clientHeight ?? 0;
    const h = blatt.offsetHeight;
    if (!marken.length || !rahmen || !h) {
      blatt.style.transform = '';
      return;
    }
    const oben = Math.min(...marken.map((m) => m.y)) * h;
    const unten = Math.max(...marken.map((m) => m.y + m.hoehe)) * h;
    // Steht alles im Ausschnitt, bleibt der Kopf, wie er ist; sonst so, dass die Markierungen oben stehen.
    const y = unten + 12 <= rahmen ? 0 : Math.max(0, Math.min(h - rahmen, oben - 16));
    blatt.style.transform = y ? `translateY(${-y}px)` : '';
  }

  $effect(() => {
    void marken;
    ausrichten();
  });

  /** Lage über CSSOM (keine Inline-Styles wegen der Inhaltsrichtlinie), wie in NamensVorschau. */
  function lage(element: HTMLElement, s: Stelle) {
    const setzen = (f: Stelle) => {
      element.style.left = `calc(${f.x * 100}% - 3px)`;
      element.style.top = `calc(${f.y * 100}% - 2px)`;
      element.style.width = `calc(${f.breite * 100}% + 6px)`;
      // Etwas mehr nach unten: Unterlängen (g, p) liegen sonst halb außerhalb (PC64, Punkt 5).
      element.style.height = `calc(${f.hoehe * 100}% + 6px)`;
    };
    setzen(s);
    return { update: setzen };
  }
</script>

<span class="blatt" bind:this={blatt}>
  <img src={bild} alt="" onload={ausrichten} />
  {#each marken as m, i (i)}<span class="marke" use:lage={m}></span>{/each}
</span>

<style>
  .blatt {
    position: relative;
    display: block;
  }

  .blatt img {
    display: block;
    width: 100%;
    height: auto;
  }

  /* DP39 1.4: wie mit Textmarker, ohne Rahmen, Ecken leicht unregelmäßig. */
  .marke {
    position: absolute;
    border-radius: 3px 6px 4px 7px;
    background: rgba(247, 206, 70, 0.55);
    mix-blend-mode: multiply;
    pointer-events: none;
  }
</style>

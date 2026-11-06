<script lang="ts">
  // Seiten groß ansehen, beim Hochladen und in der Vorschau der Mappe: Vollbild als <dialog>, Seite
  // für Seite, vergrößerbar. Beim Hochladen mit „Kommt in die Mappe“.
  import { flushSync, type Snippet } from 'svelte';
  import { t } from '../i18n';
  import { miniatur } from '../pdf/miniatur';
  import type { PdfDokument } from '../pdf/pdfjs';
  import { scrollMerken } from './scrollMerken';
  import Schalter from './Schalter.svelte';
  import Symbol from './Symbol.svelte';
  import {
    abstand,
    einrasten,
    ganzAnteil,
    mitte,
    scrollKorrektur,
    stufeNachGeste,
    type Punkt,
  } from './zweiFinger';

  let {
    offen = $bindable(false),
    seiten,
    index = $bindable(0),
    drin,
    umschalten,
    fuss,
  }: {
    offen: boolean;
    /** Alle Seiten aller Dateien, in Reihenfolge. */
    seiten: { dokument: PdfDokument; nummer: number; schluessel: string }[];
    index: number;
    /** Ohne: nur ansehen (Vorschau der Mappe). */
    drin?: (schluessel: string) => boolean;
    umschalten?: (schluessel: string) => void;
    /** Noch etwas zur Seite, das man nur groß entscheiden kann, z. B. ihr Monat. */
    fuss?: Snippet<[string]>;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  let flaeche = $state<HTMLDivElement>();
  let blatt = $state<HTMLDivElement>();
  let bild = $state('');
  let laedt = $state(false);
  let stufe = $state(1);
  const titelId = $props.id();
  const STUFEN = [1, 2, 3];

  const seite = $derived(seiten[index]);
  let zuruecksetzen: (() => void) | null = null;

  $effect(() => {
    if (!dialog) return;
    if (offen && !dialog.open) {
      zuruecksetzen = scrollMerken();
      dialog.showModal();
    }
    if (!offen && dialog.open) dialog.close();
    if (!offen && zuruecksetzen) {
      zuruecksetzen();
      zuruecksetzen = null;
    }
  });

  // Groß genug rendern, dass auch die dreifache Vergrößerung scharf bleibt.
  $effect(() => {
    const s = seite;
    if (!offen || !s) return;
    let abgebrochen = false;
    laedt = true;
    const breite = Math.min(2400, Math.round((flaeche?.clientWidth || 390) * 2.5));
    void miniatur(s.dokument, s.nummer, breite)
      .then((url) => {
        if (abgebrochen) return URL.revokeObjectURL(url);
        if (bild) URL.revokeObjectURL(bild);
        bild = url;
        laedt = false;
      })
      .catch(() => {
        if (!abgebrochen) laedt = false;
      });
    return () => {
      abgebrochen = true;
    };
  });

  // Breite über CSSOM (keine Inline-Styles wegen der Inhaltsrichtlinie).
  $effect(() => {
    if (blatt) blatt.style.width = `${stufe * 100}%`;
  });

  // Zwei Finger: stufenlos vergrößern, der Punkt der Seite unter den Fingern bleibt dort. Während der
  // Geste hat die Seite ihre echte Breite statt „ganz“, sonst spränge sie beim ersten Zug.
  let zieht = $state(false);
  let geste: {
    start: number;
    kleinste: number;
    abstand: number;
    anteilX: number;
    anteilY: number;
  } | null = null;
  let letzte: { abstand: number; mitte: Punkt } | null = null;
  let bildZug = 0;

  function finger(e: TouchEvent): { abstand: number; mitte: Punkt } | null {
    const [a, b] = [e.touches[0], e.touches[1]];
    if (!a || !b || e.touches.length !== 2) return null;
    const pa = { x: a.clientX, y: a.clientY };
    const pb = { x: b.clientX, y: b.clientY };
    return { abstand: abstand(pa, pb), mitte: mitte(pa, pb) };
  }

  function gesteZeigen(neu: number, wo: Punkt) {
    flushSync(() => {
      stufe = neu;
    });
    if (!blatt || !flaeche || !geste) return;
    const r = blatt.getBoundingClientRect();
    flaeche.scrollLeft += scrollKorrektur(geste.anteilX, r.left, r.width, wo.x);
    flaeche.scrollTop += scrollKorrektur(geste.anteilY, r.top, r.height, wo.y);
  }

  function gesteAnfang(e: TouchEvent) {
    const f = finger(e);
    const img = blatt?.querySelector('img');
    if (!f || !blatt || !flaeche || !img) return;
    const stil = getComputedStyle(flaeche);
    const breite =
      flaeche.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
    const kleinste = ganzAnteil(breite, flaeche.clientHeight, img.naturalWidth, img.naturalHeight);
    const start = stufe === 1 ? kleinste : stufe;
    flushSync(() => {
      zieht = true;
      stufe = start;
    });
    const r = blatt.getBoundingClientRect();
    geste = {
      start,
      kleinste,
      abstand: f.abstand,
      anteilX: (f.mitte.x - r.left) / r.width,
      anteilY: (f.mitte.y - r.top) / r.height,
    };
    letzte = f;
  }

  function gesteZug(e: TouchEvent) {
    const f = finger(e);
    if (!f || !geste) return;
    if (e.cancelable) e.preventDefault();
    letzte = f;
    if (bildZug) return;
    bildZug = requestAnimationFrame(() => {
      bildZug = 0;
      if (geste && letzte)
        gesteZeigen(
          stufeNachGeste(geste.start, geste.abstand, letzte.abstand, geste.kleinste),
          letzte.mitte,
        );
    });
  }

  function gesteEnde() {
    if (!geste) return;
    cancelAnimationFrame(bildZug);
    bildZug = 0;
    const ziel = letzte
      ? einrasten(
          stufeNachGeste(geste.start, geste.abstand, letzte.abstand, geste.kleinste),
          STUFEN,
        )
      : 1;
    if (ziel > 1 && letzte) gesteZeigen(ziel, letzte.mitte);
    flushSync(() => {
      stufe = ziel;
      zieht = false;
    });
    if (ziel === 1) flaeche?.scrollTo(0, 0);
    geste = null;
    letzte = null;
  }

  $effect(() => {
    const f = flaeche;
    if (!f) return;
    // Nicht passiv: Sonst zöge iOS bei zwei Fingern auch die Fläche mit.
    const nichtPassiv = { passive: false };
    f.addEventListener('touchstart', gesteAnfang, nichtPassiv);
    f.addEventListener('touchmove', gesteZug, nichtPassiv);
    f.addEventListener('touchend', gesteEnde);
    f.addEventListener('touchcancel', gesteEnde);
    return () => {
      f.removeEventListener('touchstart', gesteAnfang);
      f.removeEventListener('touchmove', gesteZug);
      f.removeEventListener('touchend', gesteEnde);
      f.removeEventListener('touchcancel', gesteEnde);
    };
  });

  // Safari kennt dazu eigene Ereignisse: Ohne das vergrößert es die ganze Seite mit.
  $effect(() => {
    const d = dialog;
    if (!d) return;
    const verhindern = (e: Event) => e.preventDefault();
    d.addEventListener('gesturestart', verhindern, { passive: false });
    d.addEventListener('gesturechange', verhindern, { passive: false });
    return () => {
      d.removeEventListener('gesturestart', verhindern);
      d.removeEventListener('gesturechange', verhindern);
    };
  });

  function blaettern(schritt: number) {
    const neu = Math.max(0, Math.min(seiten.length - 1, index + schritt));
    if (neu === index) return;
    index = neu;
    stufe = 1;
    flaeche?.scrollTo(0, 0);
  }

  function schliessen() {
    offen = false;
    stufe = 1;
    if (bild) URL.revokeObjectURL(bild);
    bild = '';
  }
</script>

<dialog
  bind:this={dialog}
  class="ansicht"
  aria-labelledby={titelId}
  onclose={schliessen}
  onkeydown={(e) => {
    if (e.key === 'ArrowRight') blaettern(1);
    if (e.key === 'ArrowLeft') blaettern(-1);
  }}
>
  {#if offen && seite}
    <div class="kopf">
      <h2 id={titelId}>
        {t('ansicht.seiteVon', { nummer: index + 1, gesamt: seiten.length })}
      </h2>
      <button type="button" class="fertig" onclick={schliessen}>{t('ansicht.fertig')}</button>
    </div>
    <div class="flaeche" bind:this={flaeche}>
      {#if bild}
        <div class="blatt" class:ganz={stufe === 1 && !zieht} bind:this={blatt}>
          <img
            src={bild}
            alt={t('ansicht.bildAlt', { nummer: index + 1 })}
            class:blass={drin && !drin(seite.schluessel)}
          />
        </div>
      {/if}
      {#if laedt && !bild}<p class="laedt" role="status">{t('hochladen.laedt')}</p>{/if}
    </div>
    <div class="fuss">
      <div class="reihe">
        <button
          type="button"
          class="rund"
          aria-label={t('ansicht.zurueck')}
          aria-disabled={index === 0}
          onclick={() => blaettern(-1)}
          ><span class="links"><Symbol name="weiter" groesse={18} /></span></button
        >
        <div class="zoom" role="group" aria-label={t('ansicht.groesse')}>
          {#each STUFEN as s (s)}
            <button
              type="button"
              class="chip"
              aria-pressed={stufe === s}
              onclick={() => (stufe = s)}>{s === 1 ? t('ansicht.ganz') : `${s}×`}</button
            >
          {/each}
        </div>
        <button
          type="button"
          class="rund"
          aria-label={t('ansicht.weiter')}
          aria-disabled={index === seiten.length - 1}
          onclick={() => blaettern(1)}><Symbol name="weiter" groesse={18} /></button
        >
      </div>
      {#if drin && umschalten}
        <div class="drin">
          <span>{t('ansicht.drin')}</span>
          <Schalter
            an={drin(seite.schluessel)}
            label={t('ansicht.drin')}
            onclick={() => umschalten(seite.schluessel)}
          />
        </div>
      {/if}
      {@render fuss?.(seite.schluessel)}
    </div>
  {/if}
</dialog>

<style>
  /* Am Bildschirmrand festgemacht statt 100vw: folgt so auch vergrößertem Text. */
  .ansicht {
    position: fixed;
    inset: 0;
    width: auto;
    max-width: none;
    height: auto;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--ground);
    color: var(--ink);
    overscroll-behavior: contain;
    /* Zwei Finger gehören der Seite, nicht dem Browser. Wischen bleibt. */
    touch-action: pan-x pan-y;
  }

  .ansicht[open] {
    display: flex;
    flex-direction: column;
  }

  .ansicht::backdrop {
    background: var(--ground);
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: calc(8px + env(safe-area-inset-top)) var(--space-4) 8px var(--space-5);
  }

  h2 {
    margin: 0;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .fertig {
    min-height: var(--tap-target);
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font-size: calc(15 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  .flaeche {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 var(--space-4);
    overscroll-behavior: contain;
  }

  .blatt {
    position: relative;
    width: 100%;
    margin: 0 auto;
  }

  .blatt img {
    display: block;
    width: 100%;
    max-width: none;
    height: auto;
    border-radius: 6px;
    background: #ffffff;
    box-shadow: var(--shadow-chip);
  }

  /* „Ganz“: die ganze Seite in Breite und Höhe, oben angelegt (D9b). */
  .blatt.ganz {
    height: 100%;
  }

  .blatt.ganz img {
    height: 100%;
    object-fit: contain;
    object-position: top;
    background: none;
    box-shadow: none;
  }

  .blatt img.blass {
    opacity: 0.35;
  }

  .laedt {
    margin: 40px 0;
    text-align: center;
    color: var(--ink-muted);
  }

  .fuss {
    display: grid;
    gap: 6px;
    padding: 10px var(--space-4) calc(12px + env(safe-area-inset-bottom));
  }

  /* Eine Zeile, auch bei 320 px mit großer Schrift: Pfeile außen, Stufen in der Mitte. */
  .reihe {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
  }

  .zoom {
    display: flex;
    flex: 0 1 152px;
    min-width: max-content;
    gap: 4px;
  }

  /* Solange die Ansicht offen ist, gibt es die Seite darunter nicht: kein Scrollen, keine Leiste. */
  :global(html:has(dialog.ansicht[open])),
  :global(html:has(dialog.ansicht[open]) body) {
    overflow: hidden;
    height: 100dvh;
  }

  :global(html:has(dialog.ansicht[open]) .leiste) {
    display: none;
  }

  /* 44 px; nur im engsten Fall schmaler, damit die Leiste eine Zeile bleibt (D9b). */
  .zoom .chip {
    flex: 1 1 44px;
    min-width: max-content;
    padding: 0 8px;
    font-size: calc(15 * var(--px));
  }

  .rund {
    display: grid;
    place-items: center;
    flex: 0 1 44px;
    min-width: 32px;
    height: var(--tap-target);
    border: 2px solid var(--ink);
    border-radius: 22px;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }

  /* Die Pfeile dürfen schmal aussehen; ihre Tippfläche reicht nach außen in den Rand (D9b). */
  .rund {
    position: relative;
  }

  .reihe > .rund:first-child::after,
  .reihe > .rund:last-child::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 44px;
  }

  .reihe > .rund:first-child::after {
    right: 0;
  }

  .reihe > .rund:last-child::after {
    left: 0;
  }

  .rund[aria-disabled='true'] {
    border-color: var(--track);
    color: var(--ink-muted);
    cursor: default;
  }

  .links {
    display: inline-flex;
    transform: scaleX(-1);
  }

  .drin {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 52px;
    padding: 0 6px 0 16px;
    border-radius: 16px;
    background: var(--surface);
    font-size: calc(16 * var(--px));
    font-weight: 700;
  }
</style>

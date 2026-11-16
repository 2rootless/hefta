<script lang="ts">
  // Je Seite: „Seite n“ mit Fundstelle, darunter der Kopf der Seite in voller Breite mit Lupe, dann der
  // Monat (design/nachtraeglich-ordnen.md, OR2, OR3; DP39 1.5, W16: gleiche Form wie beim Zuordnen).
  import { onDestroy } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { monatName, t } from '../i18n';
  import { miniatur, type PdfDokument } from '../pdf/pdfjs';
  import Symbol from './Symbol.svelte';
  import { monatJahr } from './versionInfo';

  let {
    zeilen,
    werte = $bindable(),
    monate,
    ansehen,
    dokument = null,
  }: {
    zeilen: { seite: number; bild?: string; fund: string | null }[];
    /** Monat je Seite, leer heißt „Nicht in die Mappe“. */
    werte: string[];
    monate: string[];
    ansehen?: (seite: number) => void;
    /** Das PDF: Damit zeigt jede Zeile den Kopf ihrer Seite lesbar groß. Ohne bleibt die Miniatur. */
    dokument?: PdfDokument | null;
  } = $props();

  /** Kopf je Seite, scharf genug für die volle Breite („Verdienstabrechnung Oktober 2026“). */
  const koepfe = new SvelteMap<number, string>();
  let gerendert: PdfDokument | null = null;
  let vorbei = false;

  $effect(() => {
    const dok = dokument;
    const seiten = zeilen.map((z) => z.seite);
    if (!dok) return;
    if (gerendert !== dok) {
      koepfe.forEach((url) => URL.revokeObjectURL(url));
      koepfe.clear();
      gerendert = dok;
    }
    void (async () => {
      for (const s of seiten) {
        if (vorbei || gerendert !== dok || koepfe.has(s)) continue;
        const url = await miniatur(dok, s + 1, 760).catch(() => null);
        if (!url) continue;
        if (vorbei || gerendert !== dok || koepfe.has(s)) URL.revokeObjectURL(url);
        else koepfe.set(s, url);
      }
    })();
  });

  onDestroy(() => {
    vorbei = true;
    koepfe.forEach((url) => URL.revokeObjectURL(url));
  });
</script>

<ul class="liste">
  {#each zeilen as z (z.seite)}
    {@const bild = koepfe.get(z.seite) ?? z.bild}
    <li>
      <div class="kopfzeile">
        <b>{t('aufteilen.seite', { nummer: z.seite + 1 })}</b>
        <small
          >{z.fund
            ? t('aufteilen.fund', { monat: monatJahr(z.fund) })
            : t('aufteilen.keinFund')}</small
        >
      </div>
      <button
        type="button"
        class="bild"
        aria-label={t('seiten.grossAnsehen', { nummer: z.seite + 1 })}
        onclick={() => ansehen?.(z.seite)}
      >
        {#if bild}<img src={bild} alt="" />{/if}
        <span class="lupe" aria-hidden="true"><Symbol name="lupe" groesse={16} /></span>
      </button>
      <label class="auswahl" class:ohne={!werte[z.seite]}>
        <span class="visually-hidden">{t('aufteilen.monatVon', { nummer: z.seite + 1 })}</span>
        <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
        <select bind:value={werte[z.seite]}>
          {#each monate as m (m)}
            <option value={m}>{monatName(m)}</option>
          {/each}
          <option value="">{t('aufteilen.nichtInMappe')}</option>
        </select>
      </label>
    </li>
  {/each}
</ul>

<style>
  .liste {
    margin: 0;
    padding: 0;
    border-radius: 16px;
    background: var(--surface);
    list-style: none;
  }

  li {
    display: grid;
    gap: 8px;
    padding: 16px;
  }

  li + li {
    border-top: 1px solid var(--track);
  }

  .kopfzeile {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0 12px;
  }

  b {
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  /* DP39 1.5: Kopf der Seite in voller Breite, Linie 1 px, Radius 10, Lupe 32 px unten rechts. */
  .bild {
    position: relative;
    display: block;
    width: 100%;
    height: 150px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 0 0 1px var(--line);
    cursor: zoom-in;
  }

  .bild img {
    display: block;
    width: 100%;
    height: auto;
  }

  .lupe {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 16px;
    background: rgba(38, 34, 30, 0.75);
    color: #fff;
  }

  .auswahl {
    position: relative;
    display: block;
  }

  /* Eigener Pfeil, Rundung und Rahmen wie .sel in Stil C. Auf dem iPhone öffnet sich trotzdem das Rad. */
  select {
    width: 100%;
    min-height: 48px;
    padding: 0 38px 0 14px;
    /* DP33 A4: weiche Fläche ohne Linie. */
    border: 0;
    border-radius: 14px;
    background: var(--track);
    color: var(--ink);
    font-size: calc(16 * var(--px));
    font-weight: 600;
    white-space: nowrap;
    appearance: none;
    -webkit-appearance: none;
  }

  /* DP33 A4: Fokus 2 px Tinte innen. */
  select:focus-visible {
    outline: 0;
    box-shadow: inset 0 0 0 2px var(--ink);
  }

  .ohne select {
    border-style: dashed;
    color: var(--ink-muted);
  }

  .pfeil {
    position: absolute;
    top: 50%;
    right: 14px;
    display: grid;
    color: var(--ink);
    pointer-events: none;
    transform: translateY(-50%) rotate(90deg);
  }
</style>

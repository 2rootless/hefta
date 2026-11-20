<script lang="ts">
  // RU4, DP39 1.4: Ausschnitt der Seite, auf der der Name einer anderen Person steht, der Name wie mit
  // Textmarker hinterlegt. Liest nur auf dem Gerät. Findet Hefta den Namen nicht (Scan, Foto), bleibt
  // die Vorschau weg; die Frage darüber steht trotzdem.
  import { db } from '../app/daten.svelte';
  import type { DateiVersion } from '../domain/modell';
  import { nameFinden, type Stelle } from '../domain/nameFinden';
  import { t } from '../i18n';
  import {
    miniatur,
    pdfOeffnen,
    pdfSchliessen,
    seitenStuecke,
    type PdfDokument,
  } from '../pdf/pdfjs';
  import { dateiLesen } from '../storage/speicher';
  import Symbol from './Symbol.svelte';

  let {
    dokument = null,
    version,
    vorname,
    nachname,
    ansehen,
  }: {
    /** Beim Hochladen: das schon geöffnete PDF. */
    dokument?: PdfDokument | null;
    /** In der Unterlage: die gespeicherte Version, deren Datei Hefta selbst öffnet. */
    version?: DateiVersion;
    vorname: string;
    nachname: string;
    /** Lupe: öffnet die Seite groß (Nummer ab 1). Ohne bleibt der Ausschnitt ein Bild. */
    ansehen?: (seite: number) => void;
  } = $props();

  /** So viele Seiten liest Hefta höchstens: Der Name steht fast immer oben auf der ersten. */
  const SEITEN_LESEN = 5;
  /** Vergrößerung im Ausschnitt, damit der Name lesbar ist. */
  const ZOOM = 1.6;

  let rahmen = $state<HTMLElement>();
  let blatt = $state<HTMLDivElement>();
  let bild = $state('');
  let stelle = $state.raw<Stelle | null>(null);
  let seite = $state(1);
  /**
   * PC121, Regel 1 (DP80, D4): Bis Hefta gesucht hat, hält ein leerer Rahmen in der Größe des Ausschnitts den Platz.
   * So rutscht nichts nach, wenn das Bild kommt. Findet Hefta den Namen nicht, fällt der Rahmen weg.
   */
  let gesucht = $state(false);

  /** Breite eines Texts in einer Schrift wie in den meisten PDFs, damit die Markierung genau sitzt. */
  function messer(): ((text: string) => number) | undefined {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return undefined;
    ctx.font = '100px Helvetica, Arial, sans-serif';
    return (text) => ctx.measureText(text).width;
  }

  $effect(() => {
    const vor = vorname;
    const nach = nachname;
    const offen = dokument;
    const v = version;
    let vorbei = false;
    let eigenes: PdfDokument | null = null;
    let url = '';
    gesucht = false;
    void (async () => {
      try {
        let dok = offen;
        let nummern: number[] | null = null;
        if (!dok && v) {
          const datei = await dateiLesen(await db(), v.aufbereitet ?? v.original);
          if (!datei || vorbei) return;
          eigenes = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
          dok = eigenes;
          nummern = v.seiten?.length ? v.seiten.map((s) => s + 1) : null;
        }
        if (!dok || vorbei) return;
        const d = dok;
        nummern ??= Array.from({ length: d.numPages }, (_, i) => i + 1);
        const messen = messer();
        for (const nummer of nummern.slice(0, SEITEN_LESEN)) {
          const gefunden = nameFinden(await seitenStuecke(d, nummer), vor, nach, messen);
          if (vorbei) return;
          if (!gefunden) continue;
          const breite = Math.min(2400, Math.round((rahmen?.clientWidth || 340) * ZOOM * 2));
          url = await miniatur(d, nummer, breite);
          if (vorbei) return URL.revokeObjectURL(url);
          stelle = gefunden;
          seite = nummer;
          bild = url;
          return;
        }
      } catch {
        // Datei nicht lesbar oder Seite verlassen: Dann bleibt es bei der Frage ohne Vorschau.
      } finally {
        if (!vorbei) gesucht = true;
      }
    })();
    return () => {
      vorbei = true;
      if (url) URL.revokeObjectURL(url);
      bild = '';
      stelle = null;
      if (eigenes) void pdfSchliessen(eigenes);
    };
  });

  /** Den Namen in die Mitte des Ausschnitts holen, am Rand der Seite nicht darüber hinaus. */
  function ausrichten() {
    if (!rahmen || !blatt || !stelle) return;
    blatt.style.width = `${ZOOM * 100}%`;
    const b = blatt.offsetWidth;
    const h = blatt.offsetHeight;
    const links = (stelle.x + stelle.breite / 2) * b - rahmen.clientWidth / 2;
    const oben = (stelle.y + stelle.hoehe / 2) * h - rahmen.clientHeight / 2;
    const x = Math.max(0, Math.min(b - rahmen.clientWidth, links));
    const y = Math.max(0, Math.min(h - rahmen.clientHeight, oben));
    blatt.style.transform = `translate(${-x}px, ${-y}px)`;
  }

  /** Lage der Markierung, über CSSOM gesetzt (keine Inline-Styles wegen der Inhaltsrichtlinie). */
  function lage(element: HTMLElement, s: Stelle) {
    const setzen = (f: Stelle) => {
      element.style.left = `calc(${f.x * 100}% - 3px)`;
      element.style.top = `calc(${f.y * 100}% - 2px)`;
      element.style.width = `calc(${f.breite * 100}% + 6px)`;
      element.style.height = `calc(${f.hoehe * 100}% + 4px)`;
    };
    setzen(s);
    return { update: setzen };
  }
</script>

{#snippet blattMitMarke(s: Stelle)}
  <div class="blatt" bind:this={blatt}>
    <img src={bild} alt="" onload={ausrichten} />
    <span class="marke" use:lage={s}></span>
  </div>
{/snippet}

{#if bild && stelle}
  {#if ansehen}
    <button
      type="button"
      class="ausschnitt knopf"
      bind:this={rahmen}
      aria-label={t('pruef.nameVorschauGross', { name: `${vorname} ${nachname}`.trim() })}
      onclick={() => ansehen(seite)}
    >
      {@render blattMitMarke(stelle)}
      <span class="lupe" aria-hidden="true"><Symbol name="lupe" groesse={16} /></span>
    </button>
  {:else}
    <div
      class="ausschnitt"
      bind:this={rahmen}
      role="img"
      aria-label={t('pruef.nameVorschau', { name: `${vorname} ${nachname}`.trim() })}
    >
      {@render blattMitMarke(stelle)}
    </div>
  {/if}
{:else}
  <!-- Platzhalter, damit die Breite zum Rendern bekannt ist; solange Hefta sucht, in der Größe des Ausschnitts. -->
  <div class="mass" class:frei={!gesucht} bind:this={rahmen} aria-hidden="true"></div>
{/if}

<style>
  /* Wie die Vorschau beim Zuordnen (1.5): Linie 1 px, Radius 10, Lupe 32 px unten rechts. */
  .ausschnitt {
    position: relative;
    display: block;
    width: 100%;
    height: 140px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 0 0 1px var(--line);
  }

  .knopf {
    cursor: zoom-in;
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

  .blatt {
    position: absolute;
    top: 0;
    left: 0;
    width: 160%;
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

  .mass {
    height: 0;
  }

  /* Gleiche Größe und Fläche wie der Ausschnitt, ohne Bewegung (W8, W9). */
  .mass.frei {
    height: 140px;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 0 0 1px var(--line);
  }
</style>

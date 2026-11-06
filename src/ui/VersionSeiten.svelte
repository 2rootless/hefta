<script lang="ts">
  // Die Seiten einer gespeicherten Version: Miniaturen, Tippen öffnet sie groß (D9b).
  import { db } from '../app/daten.svelte';
  import type { DateiVersion } from '../domain/modell';
  import { t } from '../i18n';
  import { miniatur, pdfOeffnen, pdfSchliessen, type PdfDokument } from '../pdf/pdfjs';
  import { dateiLesen } from '../storage/speicher';
  import SeitenAnsicht from './SeitenAnsicht.svelte';

  type Seite = { dokument: PdfDokument; nummer: number; schluessel: string };
  const ZEIGEN = 3;

  let {
    version,
    seiten = $bindable([]),
  }: {
    version: DateiVersion;
    /** Die Seiten, die in die Mappe kommen; auch für „Im Dokument auswählen“. */
    seiten?: Seite[];
  } = $props();

  let bilder = $state.raw<string[]>([]);
  let offen = $state(false);
  let index = $state(0);

  const dateiId = $derived(version.aufbereitet ?? version.original);
  const auswahlText = $derived(version.seiten?.join(',') ?? '');

  $effect(() => {
    const id = dateiId;
    const auswahl = auswahlText ? auswahlText.split(',').map(Number) : null;
    let vorbei = false;
    let dokument: PdfDokument | null = null;
    const urls: string[] = [];
    void (async () => {
      try {
        const datei = await dateiLesen(await db(), id);
        if (!datei || vorbei) return;
        dokument = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
        if (vorbei) return void pdfSchliessen(dokument);
        const dok = dokument;
        const nummern = auswahl?.length
          ? auswahl.map((s) => s + 1)
          : Array.from({ length: dok.numPages }, (_, n) => n + 1);
        seiten = nummern.map((nummer) => ({ dokument: dok, nummer, schluessel: String(nummer) }));
        for (const nummer of nummern.slice(0, ZEIGEN)) {
          const url = await miniatur(dok, nummer, 200);
          if (vorbei) return URL.revokeObjectURL(url);
          urls.push(url);
          bilder = [...urls];
        }
      } catch {
        // Seite verlassen, während die Vorschau noch lief, oder Datei nicht lesbar: Die Seite bleibt
        // ohne Miniaturen benutzbar. Das ist kein Fehler, der einen Hinweis oben verdient.
      }
    })();
    return () => {
      vorbei = true;
      offen = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
      if (dokument) void pdfSchliessen(dokument);
    };
  });

  function gross(i: number) {
    index = i;
    offen = true;
  }
</script>

<div class="reihe">
  {#each bilder as bild, i (i)}
    <button
      type="button"
      class="seite"
      aria-label={t('unterlage.seiteGross', { nummer: i + 1 })}
      onclick={() => gross(i)}
    >
      <img src={bild} alt="" />
    </button>
  {/each}
  {#if seiten.length > ZEIGEN}
    <button
      type="button"
      class="seite mehr"
      aria-label={t('unterlage.seitenMehr', { anzahl: seiten.length - ZEIGEN })}
      onclick={() => gross(ZEIGEN)}>+{seiten.length - ZEIGEN}</button
    >
  {/if}
</div>
<SeitenAnsicht bind:offen bind:index {seiten} />

<style>
  .reihe {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 88px;
  }

  .seite {
    width: 62px;
    height: 88px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 5px;
    background: #ffffff;
    box-shadow:
      0 1px 3px rgb(25 26 44 / 0.15),
      0 4px 10px rgb(25 26 44 / 0.08);
    cursor: pointer;
  }

  .seite img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }

  .mehr {
    background: var(--ground);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 800;
  }
</style>

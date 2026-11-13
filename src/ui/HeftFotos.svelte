<script lang="ts">
  // Fotos der Besichtigung (Zeile 9, B21 „Fotos · Aufnehmen · Auswählen“): nur auf dem Gerät, am Heft.
  // Ein Tipp zeigt das Foto groß; dort lässt es sich löschen, mit „Rückgängig“.
  import { onDestroy } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { db, stillLaden } from '../app/daten.svelte';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { route } from '../app/router.svelte';
  import type { Heft } from '../domain/modell';
  import { t } from '../i18n';
  import {
    dateiLesen,
    heftAendern,
    heftFotoEntfernen,
    heftFotosHinzufuegen,
  } from '../storage/speicher';
  import Sheet from './Sheet.svelte';

  let { heft }: { heft: Heft } = $props();

  const fotos = $derived(heft.fotos ?? []);
  const adressen = new SvelteMap<string, string>();

  $effect(() => {
    for (const id of fotos)
      if (!adressen.has(id))
        void db()
          .then((v) => dateiLesen(v, id))
          .then((b) => {
            if (b && !adressen.has(id)) adressen.set(id, URL.createObjectURL(b));
          });
  });
  onDestroy(() => {
    for (const a of adressen.values()) URL.revokeObjectURL(a);
  });

  const GRENZE = 2000;
  /** Große Fotos kleiner speichern; geht das nicht (Format), bleibt das Original. */
  async function verkleinern(datei: File): Promise<Blob> {
    try {
      const bild = await createImageBitmap(datei);
      const faktor = Math.min(1, GRENZE / Math.max(bild.width, bild.height));
      if (faktor === 1 && datei.size < 1_500_000) return datei;
      const leinwand = document.createElement('canvas');
      leinwand.width = Math.round(bild.width * faktor);
      leinwand.height = Math.round(bild.height * faktor);
      leinwand.getContext('2d')?.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
      const blob = await new Promise<Blob | null>((fertig) =>
        leinwand.toBlob(fertig, 'image/jpeg', 0.85),
      );
      return blob ?? datei;
    } catch {
      return datei;
    }
  }

  let aufnehmen: HTMLInputElement | undefined = $state();
  let auswaehlen: HTMLInputElement | undefined = $state();
  let speichert = $state(false);

  async function hinzu(e: Event) {
    const feld = e.currentTarget as HTMLInputElement;
    const dateien = [...(feld.files ?? [])].filter((d) => d.type.startsWith('image/'));
    feld.value = '';
    if (!dateien.length) return;
    speichert = true;
    try {
      const bilder = await Promise.all(dateien.map(verkleinern));
      await heftFotosHinzufuegen(await db(), heft.id, bilder);
      await stillLaden();
    } finally {
      speichert = false;
    }
  }

  let gross = $state<string | null>(null);
  let offen = $state(false);
  function zeigen(id: string) {
    gross = id;
    offen = true;
  }

  async function loeschen() {
    if (!gross) return;
    const id = gross;
    offen = false;
    const vorher = await heftFotoEntfernen(await db(), heft.id, id);
    await stillLaden();
    rueckgaengigAnbieten({
      text: t('fotos.geloescht'),
      seite: route.pfad,
      ausfuehren: async () => {
        await heftAendern(await db(), heft.id, { fotos: vorher });
        await stillLaden();
      },
    });
  }
</script>

<section class="teil fotos">
  <h2>{t('fotos.titel')}</h2>
  {#if fotos.length}
    <ul class="raster">
      {#each fotos as id, i (id)}
        <li>
          <button
            type="button"
            onclick={() => zeigen(id)}
            aria-label={t('fotos.zeigen', { nummer: i + 1 })}
          >
            {#if adressen.get(id)}<img src={adressen.get(id)} alt="" />{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="knoepfe">
    <button type="button" class="knopf" disabled={speichert} onclick={() => aufnehmen?.click()}
      >{t('fotos.aufnehmen')}</button
    >
    <button type="button" class="knopf" disabled={speichert} onclick={() => auswaehlen?.click()}
      >{t('fotos.auswaehlen')}</button
    >
  </div>
  <input
    bind:this={aufnehmen}
    class="visually-hidden"
    type="file"
    accept="image/*"
    capture="environment"
    tabindex="-1"
    aria-hidden="true"
    onchange={hinzu}
  />
  <input
    bind:this={auswaehlen}
    class="visually-hidden"
    type="file"
    accept="image/*"
    multiple
    tabindex="-1"
    aria-hidden="true"
    onchange={hinzu}
  />
</section>

<Sheet bind:offen titel={t('fotos.titel')}>
  {#if gross && adressen.get(gross)}
    <img class="gross" src={adressen.get(gross)} alt="" />
  {/if}
  <button type="button" class="knopf breit" onclick={loeschen}>{t('fotos.loeschen')}</button>
</Sheet>

<style>
  .fotos h2 {
    margin: 0 2px 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .raster {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
  }

  .raster button {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    cursor: pointer;
  }

  .raster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .knoepfe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .knopf {
    min-height: var(--tap-target);
    padding: 0 18px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .knopf.breit {
    width: 100%;
    margin-top: 12px;
  }

  .gross {
    display: block;
    width: 100%;
    max-height: 60dvh;
    object-fit: contain;
    border-radius: 12px;
  }
</style>

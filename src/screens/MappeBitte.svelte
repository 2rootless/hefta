<script lang="ts">
  // Bitte an den Vermieter (design/bitte-zum-loeschen.md, AM4c): der Satz auf eigener Seite. Der Vermieter
  // liest ihn, darum mit „Sie“. Ganz leer schaltet die Bitte aus.
  import { onMount } from 'svelte';
  import { daten, db } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import {
    BITTE_MAX,
    BITTE_VORSCHLAG,
    bitteSatzAus,
    einstellungenNachLaden,
    standardEinstellungen,
    type ExportEinstellungen,
  } from '../domain/export';
  import { t } from '../i18n';
  import { bewerbungLaden, bewerbungSpeichern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { passend, TITEL } from '../ui/passend';
  import Zurueck from '../ui/Zurueck.svelte';

  let satz = $state('');
  let e = $state<ExportEinstellungen>(standardEinstellungen());
  let geladen = $state(false);

  onMount(async () => {
    if (!daten.ansicht) return;
    const bewerbung = await bewerbungLaden(await db(), daten.ansicht.haushalt.id);
    e = einstellungenNachLaden(bewerbung?.export, $state.snapshot(e));
    satz = bitteSatzAus(bewerbung);
    geladen = true;
  });

  async function speichern() {
    if (!daten.ansicht || !geladen) return;
    const text = satz.trim();
    e.bitte = !!text;
    await bewerbungSpeichern(await db(), daten.ansicht.haushalt.id, {
      export: $state.snapshot(e),
      bitteSatz: text,
    });
  }

  /** Ein Absatz: Zeilenumbrüche, auch eingefügte, werden zu Leerzeichen. */
  function eingabe(ereignis: Event) {
    const feld = ereignis.currentTarget as HTMLTextAreaElement;
    const sauber = feld.value.replace(/\s*[\r\n]+\s*/g, ' ').slice(0, BITTE_MAX);
    if (sauber !== feld.value) feld.value = sauber;
    satz = sauber;
    void speichern();
  }
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#/mappe/anpassen" text={t('mappe.anpassen')} /></div>
  <div class="titelblock">
    <h1 class="display frage" use:passend={TITEL}>{t('mappe.bitteSeite.titel')}</h1>
    <p class="lead">{t('mappe.bitteSeite.lead')}</p>
  </div>
  <section>
    <textarea
      aria-label={t('mappe.bitteSeite.titel')}
      value={satz}
      oninput={eingabe}
      maxlength={BITTE_MAX}
      rows="4"></textarea>
    <div class="unter">
      {#if satz !== BITTE_VORSCHLAG}
        <button
          type="button"
          class="textlink"
          onclick={() => {
            satz = BITTE_VORSCHLAG;
            void speichern();
          }}>{t('mappe.bitteSeite.vorschlag')}</button
        >
      {:else}
        <span></span>
      {/if}
      <span class="zahl"
        >{t('mappe.bitteSeite.zeichen', { zahl: satz.length, max: BITTE_MAX })}</span
      >
    </div>
    <p class="hinweis">{t('mappe.bitteSeite.leer')}</p>
  </section>
</main>
<Aktionsleiste
  text={t('mappe.anpassenSeite.fertig')}
  onclick={async () => {
    await speichern();
    zurueckGehen('/mappe/anpassen');
  }}
/>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(160px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
  }

  section {
    margin: 18px var(--space-4) 0;
  }

  textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 112px;
    padding: 12px 14px;
    border: 2px solid var(--ink);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: calc(17 * var(--px));
    line-height: calc(24 * var(--px));
    resize: none;
  }

  .unter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0 12px;
    min-height: var(--tap-target);
    margin: 4px var(--space-1) 0;
  }

  .zahl,
  .hinweis {
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }

  .hinweis {
    margin: 6px var(--space-1) 0;
  }
</style>

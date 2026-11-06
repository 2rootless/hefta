<script lang="ts">
  import { gross, wort } from './regel';
  import { t } from './texte';

  let { breit, ziehend, waehlen }: { breit: boolean; ziehend: number; waehlen: () => void } =
    $props();

  const dateien = $derived(ziehend === 1 ? 'Eine Datei' : `${gross(wort(ziehend))} Dateien`);
</script>

<main class="vs-leer sec">
  <h1 class="vs-h1">{t('leer.titel')}</h1>
  <p class="vs-lead">{t(breit ? 'leer.textZiehen' : 'leer.textWaehlen')}</p>
  {#if breit}
    <div class="vs-drop gross" class:ziehen={ziehend > 0}>
      <span class="vs-dz">
        <svg class="vs-i" viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" /></svg
        >
      </span>
      <b>{t(ziehend ? 'leer.loslassen' : 'leer.ziehen')}</b>
      <span class="vs-dsub">{ziehend ? dateien : t('leer.ziehenUnter')}</span>
      <button type="button" class="vs-btn" onclick={waehlen}>{t('leer.auswaehlen')}</button>
    </div>
  {:else}
    <button type="button" class="vs-drop klein" onclick={waehlen}>
      <svg class="vs-i" viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" /></svg
      >
      <span><b>{t('leer.auswaehlen')}</b><small>{t('eingang.waehlenUnter')}</small></span>
    </button>
  {/if}
  <ul class="vs-nicht">
    <li class="sec">
      <b>{t('leer.rangTitel')}</b>
      <p>{t('leer.rangText')}</p>
    </li>
    <li class="sec">
      <b>{t('leer.kontoTitel')}</b>
      <p>{t('leer.kontoText')}</p>
    </li>
    <li class="sec">
      <b>{t('leer.geraetTitel')}</b>
      <p>{t('leer.geraetText')}</p>
    </li>
  </ul>
  <p class="vs-links"><a class="vs-lk" href="#/schritte">{t('schritte.link')}</a></p>
</main>

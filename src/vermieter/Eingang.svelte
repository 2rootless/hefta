<script lang="ts">
  import Symbol from '../ui/Symbol.svelte';
  import Dateiname from './Dateiname.svelte';
  import { csvText, dateiname, exportierbar } from './export';
  import type { Mappe } from './lesen';
  import {
    datumText,
    gross,
    groesseText,
    haushaltTitel,
    imVertrag,
    seitenzahlText,
    standText,
    werKurz,
    wort,
  } from './regel';
  import { t } from './texte';

  let {
    mappen,
    fehler,
    breit,
    lesend,
    ziehend,
    gewaehlt,
    waehlen,
    ausblenden,
    leeren,
  }: {
    mappen: Mappe[];
    fehler: { name: string; text: string }[];
    breit: boolean;
    lesend: number;
    ziehend: number;
    gewaehlt: number;
    waehlen: () => void;
    ausblenden: () => void;
    leeren: () => void;
  } = $props();

  const strassen = $derived([
    ...new Set(mappen.map((m) => m.anhang?.bewerbung.wohnung?.strasse).filter(Boolean)),
  ]);
  const zaehlung = $derived(
    mappen.length === 1 ? 'Eine Mappe' : `${gross(wort(mappen.length))} Mappen`,
  );
  const dieserTag = new Date().getFullYear();

  // Export als CSV (PC99, PC100): nur Lesehilfen, die zur Mappe passen (Fassung 1). Läuft hier im Browser.
  const exportMappen = $derived(mappen.filter((m) => exportierbar(m.anhang)));
  const nichtDabei = $derived(
    mappen.flatMap((m, i) => (exportierbar(m.anhang) ? [] : [t('export.ohne', { nummer: i + 1 })])),
  );
  function exportieren() {
    const text = csvText(exportMappen.map((m) => m.anhang!));
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = dateiname(new Date());
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
</script>

<section class="vs-list sec" aria-label={t('eingang.titel')}>
  <div class="vs-lh">
    <h2 class="vs-h2">{t('eingang.titel')}</h2>
    <span class="vs-cnt">{zaehlung}</span>
  </div>
  {#if strassen.length === 1}
    <p class="vs-lw">{t('eingang.fuer', { strasse: strassen[0]! })}</p>
  {/if}
  <p class="vs-lw2">{t('eingang.reihenfolge')}</p>

  <button type="button" class="vs-drop klein" class:ziehen={ziehend > 0} onclick={waehlen}>
    <span class="vs-i"><Symbol name="hochladen" groesse={20} /></span>
    <span>
      <b>{ziehend ? t('leer.loslassen') : breit ? t('eingang.weitere') : t('leer.auswaehlen')}</b>
      <small>{breit ? t('eingang.weitereUnter') : t('eingang.waehlenUnter')}</small>
    </span>
  </button>

  {#if lesend}<p class="vs-liest" role="status">{t('eingang.liest')}</p>{/if}

  {#if fehler.length}
    <section class="vs-err" aria-label={t('fehler.titel')}>
      <div class="vs-eh">
        <b>{t('fehler.titel')}</b>
        <button type="button" class="vs-lk" onclick={ausblenden}>{t('fehler.ausblenden')}</button>
      </div>
      <ul>
        {#each fehler as f, i (i)}
          <li><b><Dateiname name={f.name} /></b><span>{f.text}</span></li>
        {/each}
      </ul>
    </section>
  {/if}

  <nav class="vs-rows" aria-label={t('eingang.mappen')}>
    {#each mappen as m, i (m.sha)}
      {@const a = m.anhang}
      <a
        class="vs-row"
        class:on={gewaehlt === i + 1}
        href="#/mappe/{i + 1}"
        aria-current={gewaehlt === i + 1 ? 'true' : undefined}
      >
        <span class="vs-nr" aria-label={t('eingang.mappeNummer', { nummer: i + 1 })}>{i + 1}</span>
        <span class="vs-rb">
          <span class="vs-rtz">
            <b class="vs-rt">
              {#if a}{haushaltTitel(a)}{:else}<Dateiname name={m.name} />{/if}
            </b>
            {#if a}
              <span class="vs-rd"
                >{datumText(a.erstellt, !a.erstellt.startsWith(String(dieserTag)))}</span
              >
            {/if}
          </span>
          {#if a?.bewerbung.wohnung && strassen.length > 1}
            <span class="vs-rw">{t('eingang.fuer', { strasse: a.bewerbung.wohnung.strasse })}</span>
          {/if}
          <span class="vs-rm">
            {#if a}
              <span class="vs-mk" aria-hidden="true">
                {#each a.haushalt.personen.filter(imVertrag) as p, k (k + p.name)}
                  <span class="vs-m vs-m-v"></span>
                {/each}
              </span>
              {werKurz(a)}
            {:else}
              {seitenzahlText(m.seiten)}, {groesseText(m.bytes)}
            {/if}
          </span>
          {#if a}
            <span class="vs-st vs-st-info"><span>{standText(a)}</span></span>
          {:else}
            <span class="vs-st vs-st-ohne">
              <span class="vs-i"><Symbol name="datei" groesse={20} /></span>
              <span
                >{t(
                  m.passtNicht
                    ? 'stand.passtNicht'
                    : m.lesehilfeUnlesbar
                      ? 'stand.unlesbar'
                      : 'stand.ohne',
                )}</span
              >
            </span>
          {/if}
        </span>
      </a>
    {/each}
  </nav>
  {#if mappen.length}
    <section class="vs-export" aria-label={t('export.knopf')}>
      <button
        type="button"
        class="vs-btn vs-btn-leise"
        disabled={!exportMappen.length}
        onclick={exportieren}>{t('export.knopf')}</button
      >
      <p>
        {t('export.csv')}
        {exportMappen.length
          ? t('export.zahl', { anzahl: exportMappen.length, gesamt: mappen.length })
          : t('export.keine')}
      </p>
      {#if nichtDabei.length}<p>{t('export.nichtDabei', { liste: nichtDabei.join(', ') })}</p>{/if}
      <p>{t('export.loeschen')}</p>
    </section>
  {/if}
  <p class="vs-fuss">{t('eingang.fuss')}</p>
  <button type="button" class="vs-lk vs-leeren" onclick={leeren}>{t('eingang.leeren')}</button>
</section>

<script lang="ts">
  // DP45 G1 (W28): „Für den ganzen Haushalt“ im Reiter „Mappe“. Was hier liegt, gehört zum Haushalt, nicht zu
  // einem Heft; jedes Heft, in dem es zählt, wählt es nur aus. G2: je Genossenschaft eine Zeile.
  import { daten } from '../app/daten.svelte';
  import { tagAus } from '../domain/fristen';
  import {
    haushaltSchein,
    mitgliedschaften,
    wbsAbgelaufen,
    wbsLaeuftBaldAb,
  } from '../domain/haushaltUnterlagen';
  import { t, tagText } from '../i18n';
  import Symbol from './Symbol.svelte';
  import { weichTrennen } from './trennen';

  const schein = $derived(
    haushaltSchein(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? [], 'wbs')
      ?.version ?? null,
  );
  const mitglied = $derived(
    mitgliedschaften(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? []),
  );
  const stand = $derived.by(() => {
    const w = schein?.wbs;
    if (!schein || !w?.gueltigBis) return t('haushaltUnterlagen.wbsOhneDatum');
    const datum = tagText(w.gueltigBis);
    const heute = tagAus(new Date());
    // 30 Tage vorher steht es hier, einmal kommt dazu eine Mitteilung (DP45, Offene Frage 1).
    const teil = wbsAbgelaufen(schein, heute)
      ? t('haushaltUnterlagen.wbsAbgelaufen', { datum })
      : wbsLaeuftBaldAb(schein, heute)
        ? t('haushaltUnterlagen.wbsBald', { datum })
        : t('haushaltUnterlagen.wbsGueltig', { datum });
    return w.personen
      ? `${teil}, ${t('haushaltUnterlagen.wbsPersonen', { anzahl: w.personen })}`
      : teil;
  });
</script>

<section class="haushalt-unterlagen" aria-labelledby="hu-titel">
  <h2 id="hu-titel">{t('haushaltUnterlagen.titel')}</h2>
  <ul class="karte">
    <li>
      <a class="zeile" href="#/haushalt-unterlage/wbs">
        {#if schein}
          <span class="zeichen"><Symbol name="wbs" groesse={20} /></span>
          <span class="tx">
            <b>{t('haushaltUnterlagen.wbs')}</b>
            <small>{stand}</small>
            <span class="etikett">{t('haushaltUnterlagen.wbsEtikett')}</span>
          </span>
          <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
        {:else}
          <span class="zeichen"><Symbol name="plus" groesse={20} /></span>
          <span class="tx">
            <b>{t('haushaltUnterlagen.wbs')}</b>
            <small>{t('haushaltUnterlagen.wbsLeer')}</small>
          </span>
        {/if}
      </a>
    </li>
    {#each mitglied as m (m.dokument.id)}
      <li>
        <a class="zeile" href="#/haushalt-unterlage/genossenschaft/{m.dokument.id}">
          <span class="zeichen"><Symbol name="genossenschaft" groesse={20} /></span>
          <span class="tx">
            <b>{t('haushaltUnterlagen.geno')}</b>
            <small
              >{m.nummer
                ? t('haushaltUnterlagen.genoStand', {
                    name: weichTrennen(m.name),
                    nummer: m.nummer,
                  })
                : t('haushaltUnterlagen.genoStandOhneNr', { name: weichTrennen(m.name) })}</small
            >
            <span class="etikett">{t('haushaltUnterlagen.genoEtikett')}</span>
          </span>
          <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
        </a>
      </li>
    {:else}
      <li>
        <a class="zeile" href="#/haushalt-unterlage/genossenschaft/neu">
          <span class="zeichen"><Symbol name="plus" groesse={20} /></span>
          <span class="tx">
            <b>{t('haushaltUnterlagen.geno')}</b>
            <small>{t('haushaltUnterlagen.genoLeer')}</small>
          </span>
        </a>
      </li>
    {/each}
  </ul>
  <p class="satz">{t('haushaltUnterlagen.satz')}</p>
</section>

<style>
  .haushalt-unterlagen {
    margin: 24px 0 0;
  }

  h2 {
    margin: 0 4px 8px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .karte {
    margin: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  li + li {
    border-top: 1px solid var(--line);
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 12px 16px;
    color: var(--ink);
    text-decoration: none;
  }

  .zeichen,
  .pfeil {
    display: flex;
    flex: none;
  }

  .pfeil {
    margin-left: auto;
    color: var(--ink-quiet);
  }

  .tx {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 600;
  }

  .tx small {
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .etikett {
    justify-self: start;
    margin-top: 4px;
    padding: 0 8px;
    border-radius: 8px;
    background: var(--track);
    font-size: calc(12 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .satz {
    margin: 8px 4px 0;
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
</style>

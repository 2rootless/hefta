<script lang="ts">
  // DP45 G1 (W28): „Über die Wohnung“ im Heft. Der Schalter „Sozialwohnung“ wählt den Schein des Haushalts
  // für die Mappe dieses Hefts aus; hochgeladen wird er nur einmal, beim Haushalt. Aus: Der Schein bleibt in
  // der Mappe und kommt hier nicht mit. Abgelaufen geht er nur mit, wenn man es anschaltet (K3).
  // G2: „Wer vermietet“ führt zur Auswahl; ist es eine Genossenschaft aus der Mappe, kommt die
  // Mitgliedschaft mit.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { tagAus } from '../domain/fristen';
  import { haushaltSchein, mitgliedschaften, wbsAbgelaufen } from '../domain/haushaltUnterlagen';
  import type { Heft } from '../domain/modell';
  import { t, tagText, tagZusammen } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import SchalterZeile from './SchalterZeile.svelte';
  import Symbol from './Symbol.svelte';
  import { weichTrennen } from './trennen';

  let { heft }: { heft: Heft } = $props();

  const sozial = $derived(!!heft.sozialwohnung);
  const schein = $derived(
    haushaltSchein(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? [], 'wbs')
      ?.version ?? null,
  );
  const abgelaufen = $derived(!!schein && wbsAbgelaufen(schein, tagAus(new Date())));
  const stand = $derived.by(() => {
    const bis = schein?.wbs?.gueltigBis;
    if (!bis) return t('heftHaushalt.ohneDatum');
    return t(abgelaufen ? 'heftHaushalt.abgelaufen' : 'heftHaushalt.gueltig', {
      datum: tagZusammen(tagText(bis)),
    });
  });
  const mit = $derived(!!schein && (!abgelaufen || !!heft.wbsAbgelaufenMit));
  const mitglied = $derived(
    heft.genossenschaft
      ? (mitgliedschaften(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? []).find(
          (m) => m.dokument.id === heft.genossenschaft,
        ) ?? null)
      : null,
  );
  const anbieter = $derived(heft.angaben?.anbieter?.trim() ?? '');

  async function aendern(aenderung: Partial<Heft>) {
    await heftAendern(await db(), heft.id, aenderung);
    await stillLaden();
  }
</script>

<section class="block heft-haushalt" aria-labelledby="hh-titel-{heft.id}">
  <h2 id="hh-titel-{heft.id}">{t('heftHaushalt.titel')}</h2>
  <SchalterZeile
    an={sozial}
    titel={t('heftHaushalt.sozial')}
    text={t('heftHaushalt.sozialText')}
    onclick={() => void aendern({ sozialwohnung: !sozial })}
  />
  <a class="zeile" href="#/heft/{heft.id}/vermieter">
    <span class="tx">
      <b>{t('heftHaushalt.werVermietet')}</b>
      <small>{anbieter ? weichTrennen(anbieter) : t('heftHaushalt.werLeer')}</small>
    </span>
    <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
  </a>
  {#if sozial || mitglied}
    <p class="et">{t('heftHaushalt.fuerHaushalt')}</p>
  {/if}
  {#if sozial}
    <a class="zeile" href="#/haushalt-unterlage/wbs">
      <span class="zeichen"><Symbol name={schein ? 'wbs' : 'plus'} groesse={20} /></span>
      <span class="tx">
        <b>{t('heftHaushalt.wbs')}</b>
        <small>{schein ? stand : t('heftHaushalt.fehlt')}</small>
        {#if mit}<span class="etikett">{t('heftHaushalt.ausMappe')}</span>{/if}
      </span>
      <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
    </a>
    {#if abgelaufen}
      <SchalterZeile
        an={!!heft.wbsAbgelaufenMit}
        titel={t('heftHaushalt.abgelaufenMit')}
        text={t('heftHaushalt.abgelaufenMitText')}
        onclick={() => void aendern({ wbsAbgelaufenMit: !heft.wbsAbgelaufenMit })}
      />
    {/if}
  {:else if schein}
    <p class="aus">{t('heftHaushalt.aus')}</p>
  {/if}
  <!-- G2: nach dem Schein, wie im Reiter „Mappe“ und in der Mappe. -->
  {#if mitglied}
    <a class="zeile" href="#/haushalt-unterlage/genossenschaft/{mitglied.dokument.id}">
      <span class="zeichen"><Symbol name="genossenschaft" groesse={20} /></span>
      <span class="tx">
        <b>{t('heftHaushalt.mitgliedschaft')}</b>
        <small
          >{mitglied.nummer
            ? t('heftHaushalt.mitgliedStand', {
                name: weichTrennen(mitglied.name),
                nummer: mitglied.nummer,
              })
            : weichTrennen(mitglied.name)}</small
        >
        <span class="etikett">{t('heftHaushalt.ausMappe')}</span>
      </span>
      <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
    </a>
  {/if}
</section>

<style>
  .block {
    margin: 14px 0 0;
    padding: 16px;
    border-radius: 22px;
    background: var(--surface);
  }

  h2,
  .et {
    margin: 0 0 6px;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    /* DP50 Ü1: 18 px Zeilenhöhe, auch wenn „Für den ganzen Haushalt“ bei 320 px umbricht. */
    line-height: calc(18 * var(--px));
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .et {
    margin-top: 16px;
  }

  .zeile {
    display: flex;
    /* DP50 Ü2: Zeichen an der ersten Zeile, nicht mittig neben drei Zeilen; der Pfeil bleibt mittig. */
    align-items: flex-start;
    gap: 12px;
    min-height: 56px;
    padding: 8px 0;
    color: var(--ink);
    text-decoration: none;
  }

  .zeichen,
  .pfeil {
    display: flex;
    flex: none;
  }

  .zeichen {
    align-items: center;
    height: calc(22 * var(--px));
  }

  .pfeil {
    align-self: center;
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
    font-weight: 650;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .etikett {
    justify-self: start;
    margin-top: 4px;
    padding: 0 8px;
    border-radius: 8px;
    background: var(--track);
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .aus {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }
</style>

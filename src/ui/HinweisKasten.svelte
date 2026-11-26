<script lang="ts">
  import Symbol from './Symbol.svelte';
  import Warnzeichen from './Warnzeichen.svelte';
  // Kasten unter der Begrüßung (G2, G3, G5): schiebt den Inhalt nach unten, liegt nie darüber und
  // geht nicht von selbst weg. Immer nur einer: Fehler, Speicher, neue Version. Auf anderen
  // Bildschirmen zeigt die App nur den Fehler; „Neue Version“ stört dort nie (Formular, Rutsch).
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { hinweise } from '../app/hinweise.svelte';
  import { dokumenttyp } from '../domain/regelkatalog';
  import { einstellungenAendern } from '../storage/speicher';
  import { aktualisieren, update } from '../app/update.svelte';
  import { t } from '../i18n';

  let { nurFehler = false }: { nurFehler?: boolean } = $props();

  // PC207, 1: Nach dem Update sagt die Mappe einmal, dass abgelegte Ausweiskopien und Datenkopien gespeichert bleiben,
  // aber nicht mehr in eine Mappe kommen. Nur, wenn es solche gibt.
  const nieInMappe = $derived(
    !nurFehler &&
      !!daten.einstellungen &&
      !daten.einstellungen.nieInMappeGezeigt &&
      (daten.ansicht?.dokumente ?? []).some(
        (d) =>
          dokumenttyp(d.typ)?.nieInMappe &&
          (daten.ansicht?.versionen ?? []).some((v) => v.dokumentId === d.id),
      ),
  );
  const art = $derived(
    hinweise.fehler
      ? 'fehler'
      : nurFehler
        ? null
        : hinweise.speicherKnapp
          ? 'speicher'
          : update.verfuegbar && !hinweise.versionWeg
            ? 'version'
            : nieInMappe
              ? 'nieInMappe'
              : null,
  );

  async function nieInMappeGelesen() {
    await einstellungenAendern(await db(), { nieInMappeGezeigt: true });
    await neuLaden();
  }
</script>

{#if art}
  <div class="kasten" class:stark={art === 'fehler' || art === 'speicher'} role="status">
    <!-- DP63c F1: Fehler und voller Speicher mit dem Warnzeichen in Bernstein; die neue Version mit „info“. -->
    <span class="ic" aria-hidden="true"
      >{#if art === 'version' || art === 'nieInMappe'}<Symbol
          name="info"
          groesse={20}
        />{:else}<Warnzeichen />{/if}</span
    >
    <div class="tx">
      {#if art !== 'speicher'}
        <button
          type="button"
          class="zu"
          aria-label={t('stoerung.schliessen')}
          onclick={() => {
            if (art === 'fehler') hinweise.fehler = false;
            else if (art === 'nieInMappe') void nieInMappeGelesen();
            else hinweise.versionWeg = true;
          }}><Symbol name="schliessen" groesse={20} /></button
        >
      {/if}
      {#if art === 'fehler'}
        <p><b>{t('stoerung.fehlerTitel')}</b> {t('stoerung.fehlerText')}</p>
        <button type="button" class="textlink" onclick={() => window.location.reload()}
          >{t('stoerung.nochmal')}</button
        >
      {:else if art === 'nieInMappe'}
        <p><b>{t('stoerung.nieInMappeTitel')}</b> {t('stoerung.nieInMappeText')}</p>
      {:else if art === 'speicher'}
        <p><b>{t('stoerung.knappTitel')}</b> {t('stoerung.knappText')}</p>
        <a class="textlink" href="#/einstellungen">{t('stoerung.speicherAnsehen')}</a>
      {:else}
        <p><b>{t('update.titel')}</b> {t('update.text')}</p>
        <button type="button" class="textlink" onclick={aktualisieren}>{t('update.knopf')}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .kasten {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 14px var(--space-4) 0;
    padding: 16px 8px 6px 16px;
    border-radius: 18px;
    background: var(--surface);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  /* DP33 A1: ohne Linie; das Zeichen aus B11 links, bei einer Warnung in Akzent. */
  .ic {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 20px;
    height: 21px;
    color: var(--ink);
  }

  .tx {
    flex: 1;
    min-width: 0;
  }

  p {
    margin: 0;
  }

  .textlink {
    text-align: left;
  }

  b {
    font-weight: 800;
  }

  /* Fließt mit: Nur die erste Zeile weicht dem Schließen aus, der Text behält die Breite. */
  .zu {
    float: right;
    width: var(--tap-target);
    height: var(--tap-target);
    margin: -10px -6px 0 2px;
    border: 0;
    background: none;
    display: grid;
    place-items: center;
    color: var(--ink);
    cursor: pointer;
  }
</style>

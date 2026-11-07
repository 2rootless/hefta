<script lang="ts">
  import { backupKlick, istApp } from '../app/plattform';
  // Einstellungen in Gruppen (design/mappe-erstellen-einstellungen.md, Abschnitt 2, S1/S2):
  // Sicherung, Speicher, App, Daten. Backup erstellen, einspielen und alles löschen sind eigene Seiten.
  import { onMount } from 'svelte';
  import { daten, db, gehe } from '../app/daten.svelte';
  import { QUELLCODE_ADRESSE } from '../app/name';
  import { tageSeit } from '../domain/zeit';
  import { backupAccept } from '../storage/backup';
  import { KATALOG_STAND } from '../domain/regelkatalog';
  import { groesse, monatName, t } from '../i18n';
  import { speicherBelegt } from '../storage/speicher';
  import { einstellungenZustand } from '../ui/einstellungen.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { passend, TITEL } from '../ui/passend';
  import Zurueck from '../ui/Zurueck.svelte';

  const meldung = einstellungenZustand.meldung;
  einstellungenZustand.meldung = '';

  const backupText = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt) return t('einstellungen.letztesNie');
    const tage = tageSeit(zuletzt);
    if (tage === 0) return t('einstellungen.letztesHeute');
    const text = t('einstellungen.letztesTage', { anzahl: tage });
    return tage > 30 ? `${text}. ${t('einstellungen.zeitFuerNeues')}` : text;
  });

  // Speicher: belegt laut Browser (sonst die Summe der Dateien), frei bis zur Grenze des Browsers.
  let belegt = $state(0);
  let frei = $state<number | null>(null);
  let dauerhaft = $state<boolean | null>(null);
  let balken = $state<HTMLElement>();

  async function speicherMessen() {
    const eigene = await speicherBelegt(await db());
    const schaetzung = await navigator.storage?.estimate?.().catch(() => undefined);
    belegt = Math.max(eigene, schaetzung?.usage ?? 0);
    frei = schaetzung?.quota ? Math.max(0, schaetzung.quota - belegt) : null;
    dauerhaft = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  }

  // Breite über CSSOM, weil die Inhaltsrichtlinie keine Inline-Styles erlaubt.
  $effect(() => {
    if (!balken) return;
    const anteil = frei === null ? 0 : belegt / (belegt + frei || 1);
    balken.style.width = `${Math.max(2, Math.min(100, anteil * 100))}%`;
  });

  async function dauerhaftAnfragen() {
    try {
      dauerhaft = (await navigator.storage?.persist?.()) ?? false;
    } catch {
      dauerhaft = false;
    }
  }

  const homescreen =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  // Stand des Regelkatalogs als „Oktober 2026“ (mit Jahr, darum ein Bezugsdatum in einem anderen Jahr).
  const stand = monatName(KATALOG_STAND.slice(0, 7), new Date(0));

  function backupGewaehlt(datei: File | undefined) {
    if (!datei) return;
    einstellungenZustand.datei = datei;
    gehe('/einstellungen/einspielen');
  }

  onMount(() => {
    void speicherMessen();
  });
</script>

{#snippet pfeil()}
  <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={20} /></span>
{/snippet}

<main class="seite">
  <div class="kopf"><Zurueck href="#/" text={t('navigation.uebersicht')} /></div>
  <div class="titelblock">
    <h1 use:passend={TITEL} class="display">{t('einstellungen.titel')}</h1>
    {#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
  </div>

  <section class="abschnitt" aria-labelledby="g-sicherung">
    <h2 id="g-sicherung">{t('einstellungen.sicherung')}</h2>
    <ul class="zeilen">
      <li>
        <a class="listenzeile" href="#/einstellungen/backup">
          <span class="tx"
            ><b>{t('einstellungen.backupErstellen')}</b><small>{backupText}</small></span
          >
          {@render pfeil()}
        </a>
      </li>
      <li>
        <label class="listenzeile">
          <span class="tx"
            ><b>{t('einstellungen.backupEinspielen')}</b><small
              >{t('einstellungen.einspielenHinweis')}</small
            ></span
          >
          {@render pfeil()}
          <input
            type="file"
            class="visually-hidden"
            accept={backupAccept(istApp())}
            onclick={(e) => backupKlick(e, backupGewaehlt)}
            onchange={(e) => backupGewaehlt(e.currentTarget.files?.[0])}
          />
        </label>
      </li>
    </ul>
  </section>

  <section class="abschnitt" aria-labelledby="g-speicher">
    <h2 id="g-speicher">{t('einstellungen.speicher')}</h2>
    <ul class="zeilen">
      <li class="speicher">
        <b>{t('einstellungen.belegt', { groesse: groesse(belegt) })}</b>
        {#if frei !== null}
          <span class="balken" aria-hidden="true"><i bind:this={balken}></i></span>
        {/if}
        <small>
          {#if frei !== null}{t('einstellungen.frei', { groesse: groesse(frei) })}{/if}
          {#if dauerhaft === true}{t('einstellungen.dauerhaftJa')}{:else if dauerhaft === false}{t(
              'einstellungen.dauerhaftNein',
            )}{/if}
        </small>
        {#if dauerhaft === false}
          <button type="button" class="textlink" onclick={dauerhaftAnfragen}
            >{t('einstellungen.anfragen')}</button
          >
        {/if}
      </li>
      <li class:app={istApp()}>
        {#if homescreen}
          <div class="listenzeile">
            <span class="tx"
              ><b>{t('einstellungen.homescreen')}</b><small
                >{t('einstellungen.homescreenHinweis')}</small
              ></span
            >
            <span class="wert">{t('einstellungen.ja')}</span>
          </div>
        {:else}
          <a class="listenzeile" href="#/homescreen/einstellungen">
            <span class="tx"
              ><b>{t('einstellungen.homescreen')}</b><small
                >{t('einstellungen.homescreenHinweis')}</small
              ></span
            >
            <span class="wert">{t('einstellungen.nein')}</span>
            {@render pfeil()}
          </a>
        {/if}
      </li>
    </ul>
  </section>

  <section class="abschnitt" aria-labelledby="g-app">
    <h2 id="g-app">{t('einstellungen.app')}</h2>
    <ul class="zeilen">
      <li>
        <div class="listenzeile">
          <span class="tx"><b>{t('einstellungen.sprache')}</b></span>
          <span class="wert">{t('einstellungen.deutsch')}</span>
        </div>
      </li>
      <li>
        <a class="listenzeile" href="#/technik-test">
          <span class="tx"
            ><b>{t('einstellungen.technik')}</b><small>{t('einstellungen.technikHinweis')}</small
            ></span
          >
          {@render pfeil()}
        </a>
      </li>
      <li>
        <div class="listenzeile">
          <span class="tx"
            ><b>{t('einstellungen.version')}</b><small
              >{t('einstellungen.versionWert', { version: __APP_VERSION__, stand })}</small
            ></span
          >
        </div>
      </li>
      <li>
        <div class="listenzeile">
          <span class="tx"
            ><b>{t('einstellungen.lizenz')}</b><small>{t('einstellungen.lizenzWert')}</small></span
          >
        </div>
      </li>
      {#if QUELLCODE_ADRESSE}
        <li>
          <a class="listenzeile" href={QUELLCODE_ADRESSE} rel="noreferrer" target="_blank">
            <span class="tx"><b>{t('einstellungen.quellcode')}</b></span>
          </a>
        </li>
      {/if}
      <li>
        <a class="listenzeile" href="#/einstellungen/rechtliches">
          <span class="tx"><b>{t('rechtliches.titel')}</b></span>
          {@render pfeil()}
        </a>
      </li>
    </ul>
  </section>

  <section class="abschnitt" aria-labelledby="g-daten">
    <h2 id="g-daten">{t('einstellungen.daten')}</h2>
    <ul class="zeilen">
      <li>
        <a class="listenzeile" href="#/einstellungen/loeschen">
          <span class="tx"
            ><b>{t('einstellungen.allesLoeschen')}</b><small
              >{t('einstellungen.allesLoeschenHinweis')}</small
            ></span
          >
          {@render pfeil()}
        </a>
      </li>
    </ul>
  </section>
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0 calc(48px + env(safe-area-inset-bottom));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .meldung {
    margin: 10px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .speicher {
    display: grid;
    padding: 14px 16px;
  }

  .speicher b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .speicher small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .speicher .textlink {
    justify-self: start;
    font-size: calc(14 * var(--px));
  }

  .balken {
    display: block;
    height: 10px;
    margin: 10px 0 4px;
    overflow: hidden;
    border-radius: 5px;
    background: var(--track);
  }

  .balken i {
    display: block;
    width: 2%;
    height: 100%;
    border-radius: 5px;
    background: var(--ink);
  }

  /* Eine App ist schon auf dem Homescreen. */
  .app {
    display: none;
  }
</style>

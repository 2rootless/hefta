<script lang="ts">
  // Hefta 2, Tab „Wohnungen“ (B16, B17a, B15): Kopf mit Logo, Plus und Zahnrad, Gruß nach Tageszeit,
  // darunter die Hefte. Bis „Neues Heft“ gebaut ist (Schritt 4), zeigt er den leeren Zustand. Ohne
  // Haushalt ist er der erste Bildschirm überhaupt (E45, ersetzt den ersten Start aus Version 1).
  import GrafikPlatz from '../ui/GrafikPlatz.svelte';
  import { daten, gehe } from '../app/daten.svelte';
  import { VERMIETER_ADRESSE, VERMIETER_DOMAIN } from '../app/name';
  import { istApp, istIosApp } from '../app/plattform';
  import AnleitungTeilen from '../ui/AnleitungTeilen.svelte';
  import { gruss } from '../domain/gruss';
  import { t } from '../i18n';
  import HeftUebersicht from '../ui/HeftUebersicht.svelte';
  import HinweisKasten from '../ui/HinweisKasten.svelte';
  import { homescreenFragen } from '../ui/homescreen';
  import Logo from '../ui/Logo.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import TabLeiste from '../ui/TabLeiste.svelte';

  const vertrag = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge'),
  );
  const ihr = $derived(vertrag.length > 1);
  const mitHaushalt = $derived(!!daten.ansicht);
  const hefte = $derived(daten.hefte);

  // Der Gruß folgt der Uhr; er wechselt, wenn die App wieder nach vorn kommt (Bericht 61, 1.3).
  let jetzt = $state(new Date());
  // Anleitung auf „Wohnungen“ zugeklappt, mit „Anleitung ⌄“ zum Aufklappen (Auftraggeber, 12.11.).
  let anleitungOffen = $state(false);
  $effect(() => {
    const auffrischen = () => {
      if (document.visibilityState === 'visible') jetzt = new Date();
    };
    document.addEventListener('visibilitychange', auffrischen);
    return () => document.removeEventListener('visibilitychange', auffrischen);
  });
  const titel = $derived(
    gruss(
      jetzt,
      vertrag.map((m) => m.person.rufname || m.person.vorname),
    ),
  );

  // Teilen aus Safari gibt es nur in der App für iOS; im Web und vorerst unter Android fügt man ein.
  const teilen = istIosApp();

  function haushaltAnlegen() {
    gehe(homescreenFragen(daten.einstellungen) ? '/homescreen/einrichtung' : '/einrichtung');
  }
</script>

<main class="seite">
  <HinweisKasten />
  <header class="kopf">
    <!-- Das Logo ist Schmuck und wird nicht vorgelesen. -->
    <span class="logo" aria-hidden="true"><Logo /></span>
    <span class="platz"></span>
    <!-- Immer da, auch ohne Haushalt: Sonst gäbe es nach dem ersten Heft keinen Weg zum zweiten. -->
    <a class="icb" href="#/wohnung-neu" aria-label={t('wohnungen.hinzufuegen')}
      ><Symbol name="plus" groesse={24} /></a
    >
    <a class="icb" href="#/einstellungen" aria-label={t('navigation.einstellungen')}
      ><Symbol name="zahnrad" groesse={24} /></a
    >
  </header>

  <h1 class="gruss">{titel}</h1>
  {#if hefte.length}
    {#if !mitHaushalt}
      <button class="weg naechstes" type="button" onclick={haushaltAnlegen}>
        <span class="zeichen" aria-hidden="true"><Symbol name="person" groesse={24} /></span>
        <span class="text"
          ><b>{t('wohnungen.wegHaushalt')}</b><span>{t('wohnungen.wegHaushaltText')}</span></span
        >
      </button>
    {/if}
    <HeftUebersicht {hefte} {jetzt} />
  {:else if mitHaushalt}
    <p class="sub">{t(ihr ? 'wohnungen.subIhr' : 'wohnungen.subDu')}</p>
    <section class="leer" aria-labelledby="leer-titel">
      <GrafikPlatz name="wohnungen-leer" />
      <h2 id="leer-titel">{t('wohnungen.leerTitel')}</h2>
      <p>
        {t(
          teilen
            ? ihr
              ? 'wohnungen.leerAppIhr'
              : 'wohnungen.leerAppDu'
            : ihr
              ? 'wohnungen.leerWebIhr'
              : 'wohnungen.leerWebDu',
        )}
      </p>
      <a class="knopf" href="#/wohnung-neu"
        >{t(teilen ? 'wohnungen.knopfApp' : 'wohnungen.knopfWeb')}</a
      >
      <a class="link" href="#/">{t('wohnungen.mappeBereit')}</a>
    </section>
    {#if istApp()}{@render anleitung(ihr)}{/if}
  {:else}
    <p class="sub">{t('wohnungen.subOhne')}</p>
    <h2 class="h">{t('wohnungen.ohneTitel')}</h2>
    <div class="wege">
      <a class="weg" href="#/wohnung-neu">
        <span class="zeichen" aria-hidden="true"><Symbol name="wohnung" groesse={24} /></span>
        <span class="text"
          ><b>{t('wohnungen.wegWohnung')}</b><span
            >{t(teilen ? 'wohnungen.wegWohnungApp' : 'wohnungen.wegWohnungWeb')}</span
          ></span
        >
      </a>
      <button class="weg" type="button" onclick={haushaltAnlegen}>
        <span class="zeichen" aria-hidden="true"><Symbol name="person" groesse={24} /></span>
        <span class="text"
          ><b>{t('wohnungen.wegHaushalt')}</b><span>{t('wohnungen.wegHaushaltText')}</span></span
        >
      </button>
    </div>
    <GrafikPlatz name="erster-start" />
    <p class="kasten">{t(mitHaushalt && !ihr ? 'wohnungen.kastenDu' : 'wohnungen.kastenIhr')}</p>
    <!-- Ohne Haushalt „ihr“ (E74.4). -->
    {#if istApp()}{@render anleitung(true)}{/if}
    {#if !istApp()}
      <!-- E42: solange es keinen Haushalt gibt, gesiezt (B15). -->
      <p class="vermieter">
        <span class="zeile">{t('ersterStart.vermieterFrage')}</span>
        {t('ersterStart.vermieterVor')}
        <a href={VERMIETER_ADRESSE}>{VERMIETER_DOMAIN}</a>{t('ersterStart.vermieterNach')}
      </p>
    {/if}
  {/if}
</main>
<TabLeiste aktiv="wohnungen" />

{#snippet anleitung(anrede: boolean)}
  <button
    class="anleitung-kopf"
    type="button"
    aria-expanded={anleitungOffen}
    onclick={() => (anleitungOffen = !anleitungOffen)}
    ><span>{t('wohnungen.anleitung')}</span><span class="pfeil" class:auf={anleitungOffen}
      ><Symbol name="ab" groesse={16} /></span
    ></button
  >
  {#if anleitungOffen}<div class="einblenden"><AnleitungTeilen ihr={anrede} /></div>{/if}
{/snippet}

<style>
  .anleitung-kopf {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--tap-target);
    margin-top: 20px;
    padding: 0 2px;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 650;
    cursor: pointer;
  }

  .anleitung-kopf .pfeil {
    display: inline-flex;
    transition: transform var(--bw-kurz) var(--bw-weich);
  }

  .anleitung-kopf .pfeil.auf {
    transform: rotate(180deg);
  }

  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) calc(var(--tabs-hoehe, 72px) + 24px);
  }

  .kopf {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    padding: 12px 0 4px;
  }

  .platz {
    flex: 1;
  }

  .icb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--tap-target);
    height: var(--tap-target);
    border-radius: 50%;
    color: var(--ink);
  }

  /* Gruß wie in B21: 30 px, 700, Breite 108 %, kaum Laufweite (nicht der Stil `display` aus Version 1). */
  h1 {
    margin: 14px 0 6px;
    font-size: calc(30 * var(--px));
    font-weight: 700;
    font-stretch: 108%;
    line-height: 1.08;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .sub {
    margin: 0 0 16px;
    color: var(--ink-muted);
  }

  .leer {
    padding: 24px 8px;
    text-align: center;
  }

  .leer h2 {
    margin: 14px 0 6px;
    font-size: calc(20 * var(--px));
    font-weight: 700;
  }

  .leer p {
    margin: 0 0 18px;
    color: var(--ink-muted);
  }

  .knopf {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 52px;
    padding: 0 22px;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font-weight: 650;
    text-decoration: none;
  }

  .link {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tap-target);
    margin-top: 16px;
    color: var(--accent-text);
    font-weight: 600;
  }

  .h {
    margin: 22px 0 10px;
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .wege {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weg {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .zeichen {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--tap-target);
    height: var(--tap-target);
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .text span {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .naechstes {
    margin: 4px 0 6px;
  }

  .kasten {
    margin: 22px 0 0;
    padding: 22px 0 4px;
    color: var(--ink-muted);
    text-align: center;
  }

  .vermieter {
    margin: 30px 0 8px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.5;
  }

  .vermieter .zeile {
    display: block;
  }

  .vermieter a {
    display: inline-block;
    padding: 12px 0;
    margin: -12px 0;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
</style>

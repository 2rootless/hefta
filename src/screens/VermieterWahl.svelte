<script lang="ts">
  // DP45 G2: „Wer vermietet?“ im Heft. Oben die Genossenschaften aus der Mappe des Haushalts: Ist eine
  // gewählt, kommt ihre Mitgliedschaft in die Mappe dieses Hefts (nur Auswahl, W28). Darunter „Andere“ zum
  // Eintippen. Beides schreibt den Namen ins Feld „Wer vermietet“ des Hefts.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { heftTitel } from '../domain/heftKarte';
  import { mitgliedschaften } from '../domain/haushaltUnterlagen';
  import type { HeftAngaben } from '../domain/modell';
  import { t } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { einmal } from '../ui/einmal';
  import SchalterZeile from '../ui/SchalterZeile.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { weichTrennen } from '../ui/trennen';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const liste = $derived(
    mitgliedschaften(daten.ansicht?.haushaltDokumente, daten.ansicht?.versionen ?? []),
  );
  const ziel = $derived(`/heft/${id}`);

  let gewaehlt = $state<string | null>(null);
  let andere = $state('');
  let geladen = false;
  $effect(() => {
    if (heft && !geladen) {
      geladen = true;
      gewaehlt = liste.some((m) => m.dokument.id === heft.genossenschaft)
        ? (heft.genossenschaft ?? null)
        : null;
      andere = gewaehlt ? '' : (heft.angaben?.anbieter ?? '');
    }
  });

  const uebernehmen = einmal(async () => {
    if (!heft) return;
    const name = gewaehlt
      ? (liste.find((m) => m.dokument.id === gewaehlt)?.name ?? '')
      : andere.trim();
    const angaben: HeftAngaben = {
      ...(heft.angaben ?? {
        titel: null,
        stadtteil: null,
        warm: null,
        zimmer: null,
        flaeche: null,
      }),
      anbieter: name || null,
    };
    await heftAendern(await db(), heft.id, {
      genossenschaft: gewaehlt,
      angaben: JSON.parse(JSON.stringify(angaben)) as HeftAngaben,
    });
    await stillLaden();
    abschliessen(ziel);
  });
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#{ziel}" text={heft ? heftTitel(heft).text : t('allgemein.zurueck')} />
  </div>
  <div class="titelblock">
    <h1 class="display">{t('vermieterWahl.titel')}</h1>
    <p class="lead">{t('vermieterWahl.lead')}</p>
  </div>

  {#if liste.length}
    <h2 class="et">{t('vermieterWahl.ausMappe')}</h2>
    <div class="karte">
      {#each liste as m (m.dokument.id)}
        <SchalterZeile
          an={gewaehlt === m.dokument.id}
          titel={weichTrennen(m.name)}
          text={t('vermieterWahl.mitglied')}
          onclick={() => {
            gewaehlt = gewaehlt === m.dokument.id ? null : m.dokument.id;
            if (gewaehlt) andere = '';
          }}
        />
      {/each}
    </div>
  {/if}

  <h2 class="et">{t('vermieterWahl.andere')}</h2>
  <div class="karte karte-weich">
    <label class="eingabe">
      {t('vermieterWahl.feld')}
      <input
        type="text"
        bind:value={andere}
        placeholder={t('vermieterWahl.platz')}
        autocomplete="off"
        data-feld="anbieter"
        oninput={() => {
          if (andere.trim()) gewaehlt = null;
        }}
      />
    </label>
  </div>

  <Aktionsleiste text={t('vermieterWahl.knopf')} onclick={uebernehmen} />
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf,
  .titelblock {
    padding: 0 var(--space-5);
  }

  .titelblock {
    margin-top: 10px;
  }

  .et {
    margin: 24px 20px 8px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .karte {
    margin: 0 16px;
    padding: 4px 16px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .karte-weich {
    padding: 16px;
  }
</style>

<script lang="ts">
  // „Wie ist es ausgegangen?“ (B23 `s=ergebnis`, Zeile 9): Zusage, Absage oder „Wir wollen nicht mehr“.
  // Hefta legt das Heft danach ab; „Wieder hervorholen“ im Heft nimmt das zurück.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { heftTitel } from '../domain/heftKarte';
  import { ergebnisSetzen } from '../domain/heftStand';
  import type { HeftEreignisse } from '../domain/modell';
  import { t } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const ihr = $derived(
    // Ohne Haushalt „ihr“ (E74.4, Design 12.11.), sonst ab zwei Personen ohne Bürgen.
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );

  async function setzen(art: NonNullable<HeftEreignisse['ergebnis']>['art']) {
    if (!heft) return;
    await heftAendern(await db(), heft.id, {
      ereignisse: $state.snapshot(ergebnisSetzen(heft.ereignisse, art, new Date())),
    });
    await stillLaden();
    abschliessen(`/heft/${heft.id}`);
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={t('ergebnis.zurueck')} />
  </header>

  {#if !heft}
    <p class="sub">{t('heft.fehlt')}</p>
  {:else}
    <h1 class="h2">{t('ergebnis.titel')}</h1>
    <p class="sub">{heftTitel(heft).text}</p>
    <p class="klein">{t(ihr ? 'ergebnis.satzIhr' : 'ergebnis.satzDu')}</p>
    <div class="knopfreihe">
      <button class="knopf haupt" type="button" onclick={() => setzen('zusage')}
        >{t('ergebnis.zusage')}</button
      >
      <button class="knopf" type="button" onclick={() => setzen('absage')}
        >{t('ergebnis.absage')}</button
      >
      <button class="knopf" type="button" onclick={() => setzen('nicht_mehr')}
        >{t(ihr ? 'ergebnis.nichtMehrIhr' : 'ergebnis.nichtMehrDu')}</button
      >
    </div>
  {/if}
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) 24px;
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  h1 {
    margin: 6px 0 6px;
  }

  .sub {
    margin: 0 0 8px;
    color: var(--ink-muted);
  }

  .klein {
    margin: 0 0 16px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .knopfreihe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .knopf {
    flex: 1 1 auto;
    min-height: 48px;
    padding: 0 18px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .knopf.haupt {
    border-color: var(--action);
    background: var(--action);
    color: var(--on-action);
  }
</style>

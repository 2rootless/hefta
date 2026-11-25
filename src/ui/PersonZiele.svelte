<script lang="ts">
  // W54 auf der Personenseite (PC199, Punkt 9): dieselben Ziele wie im Haushalt und dieselbe Zeile danach. Ein Tipp
  // wirkt sofort, ohne „Speichern“; „Rückgängig“ stellt den Stand davor her. Würde der Vertrag leer, fragt die Seite,
  // wer hineinkommt (W42).
  import { ansprech, kandidaten, ziele } from '../domain/faecher';
  import { t } from '../i18n';
  import { FaecherAktion } from './faecherAktion.svelte';

  let { zugehoerigkeitId }: { zugehoerigkeitId: string } = $props();

  let wurzel = $state<HTMLElement | null>(null);
  const aktion = new FaecherAktion(() => wurzel);
  const liste = $derived(aktion.liste);
  const ich = $derived(liste.find((e) => e.id === zugehoerigkeitId));
  const istAn = $derived(ansprech(liste)?.id === zugehoerigkeitId);
  let neuerName = $state('');

  async function beantworten(wer: string | { neu: string }) {
    if (await aktion.beantworten(wer)) neuerName = '';
  }
</script>

{#if ich}
  <div class="person-ziele" bind:this={wurzel}>
    <p class="platz">
      <b>{t(`faecher.fach.${ich.fach}`)}</b>
      {#if istAn}<span class="marke">{t('faecher.ansprechMarke')}</span>{/if}
    </p>
    <div class="ziele" role="group" aria-label={t('faecher.zieleLabel', { name: ich.name })}>
      {#each ziele(liste, ich.id) as z (z)}
        <button
          type="button"
          data-z={z}
          class:ap-ziel={z === 'ansprech'}
          onclick={() => aktion.nach(ich.id, z)}
          >{z === 'ansprech' ? t('faecher.ansprech') : t(`faecher.fach.${z}`)}</button
        >
      {/each}
    </div>
    {#if aktion.frage}
      <div class="frage">
        <p>{t('faecher.frageNur', { name: ich.name })}</p>
        <p class="f">{t('faecher.frage')}</p>
        <div class="wahl">
          {#each kandidaten(liste) as k (k.id)}
            <button type="button" onclick={() => beantworten(k.id)}>{k.name}</button>
          {/each}
          <button type="button" onclick={() => (aktion.frage = null)}
            >{t('faecher.dochNicht')}</button
          >
        </div>
        <div class="neu">
          <input
            bind:value={neuerName}
            placeholder={t('faecher.neuePerson')}
            aria-label={t('faecher.neuePerson')}
            autocomplete="off"
            onkeydown={(e) => e.key === 'Enter' && beantworten({ neu: neuerName })}
          />
          <button type="button" class="ok" onclick={() => beantworten({ neu: neuerName })}
            >{t('faecher.dazu')}</button
          >
        </div>
      </div>
    {/if}
    {#if aktion.folge}
      <div class="folge" role="status">
        <p>{aktion.folge}</p>
        <button type="button" class="rueck" onclick={() => aktion.rueckgaengig()}
          >{t('faecher.rueckgaengig')}</button
        >
      </div>
    {/if}
  </div>
{/if}

<style>
  .platz {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
  }
  .marke {
    padding: 0 var(--space-2);
    border: 1px solid var(--ink);
    border-radius: 999px;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
    max-width: 100%;
    hyphens: manual;
  }
  .ziele,
  .frage .wahl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .ziele button,
  .frage button {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    background: var(--surface);
    color: var(--ink);
  }
  .ziele .ap-ziel {
    border-color: var(--ink);
  }
  .frage {
    margin-top: var(--space-4);
  }
  .frage p {
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }
  .frage .f {
    margin-top: var(--space-1);
    font-weight: 700;
    color: var(--ink);
  }
  .frage .neu {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .frage input {
    flex: 1;
    min-width: 0;
    /* Ohne feste Breite zieht das Feld mit seiner Grundbreite die Spalte auf (DP119, 246 px). */
    width: 0;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }
  .frage .ok {
    background: var(--ink);
    color: var(--ground);
    border-color: var(--ink);
  }
  .folge {
    margin-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: 16px;
    background: var(--ink);
    color: var(--ground);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    min-height: 52px;
  }
  .folge p {
    /* Bei großer Schrift rutscht „Rückgängig“ unter den Satz, statt ihn in eine schmale Spalte zu drücken. */
    flex: 1 1 12em;
    margin: 0;
  }
  .rueck {
    flex: none;
    min-height: 44px;
    padding: 0 var(--space-3);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
    color: var(--ground);
    background: none;
    border: 0;
  }
  :is(.ziele button, .frage button, .frage input):focus-visible {
    outline: 0;
    box-shadow: 0 3px 0 0 var(--ink);
  }
  .rueck:focus-visible {
    outline: 0;
    box-shadow: 0 3px 0 0 var(--ground);
  }
</style>

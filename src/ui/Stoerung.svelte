<script lang="ts">
  // Speicher nicht erreichbar (design/geraet-und-stoerungen.md, G1): sagen, was passiert ist, dass
  // nichts gelöscht wurde, und den nächsten Schritt. Der Fehlercode nur klein für Rückfragen.
  // Ein anderer Tab mit neuerer Version braucht den Speicher: gleicher Aufbau, „Neu laden“.
  import { daten, neuLaden } from '../app/daten.svelte';
  import { t } from '../i18n';
  import { istAndroidApp, istApp } from '../app/plattform';
  import Aktionsleiste from './Aktionsleiste.svelte';
  import Logo from './Logo.svelte';

  const andererTab = $derived(daten.fehler === 'andererTab');
  const code = $derived(
    `${andererTab ? 'neuere-version-offen' : 'speicher-nicht-erreichbar'} · ${__APP_VERSION__}`,
  );
  let kopiert = $state(false);

  async function nochmal() {
    await neuLaden().catch(() => {});
  }

  async function kopieren() {
    await navigator.clipboard?.writeText(code).catch(() => {});
    kopiert = true;
  }
</script>

<main class="stoerung">
  <div class="marke"><Logo /></div>
  <div class="titelblock">
    <h1 class="display">
      {andererTab ? t('stoerung.andererTabTitel') : t('stoerung.speicherTitel')}
    </h1>
    <p class="lead">{andererTab ? t('stoerung.andererTabText') : t('stoerung.speicherText')}</p>
  </div>
  {#if !andererTab}
    <ol class="schritte">
      <li>{t('stoerung.schritt1')}</li>
      <!-- Privates Surfen gibt es nur im Browser; der Weg zum iPhone-Speicher nicht unter Android. -->
      {#if !istApp()}<li>{t('stoerung.schritt2')}</li>{/if}
      {#if !istAndroidApp()}<li>{t('stoerung.schritt3')}</li>{/if}
    </ol>
    <p class="klein">{t('stoerung.backup')}</p>
  {/if}
  <p class="code">{t('stoerung.fehlerCode', { code })}</p>
</main>
{#if andererTab}
  <Aktionsleiste text={t('stoerung.neuLaden')} onclick={() => window.location.reload()} />
{:else}
  <Aktionsleiste
    text={t('stoerung.erneut')}
    onclick={nochmal}
    neben={{ text: kopiert ? t('stoerung.kopiert') : t('stoerung.kopieren'), onclick: kopieren }}
  />
{/if}

<style>
  .stoerung {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(150px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .marke {
    padding: 0 var(--space-5);
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .display {
    text-wrap: balance;
  }

  .schritte {
    margin: 22px var(--space-4) 0;
    padding: 0;
    list-style: none;
    counter-reset: schritt;
    border-radius: 20px;
    background: var(--surface);
  }

  .schritte li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
    counter-increment: schritt;
  }

  .schritte li + li {
    border-top: 1px solid var(--track);
  }

  .schritte li::before {
    content: counter(schritt);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    font-size: calc(13 * var(--px));
    font-weight: 800;
  }

  .klein {
    margin: 22px var(--space-5) 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .code {
    margin: 8px var(--space-5) 0;
    font-family: ui-monospace, Menlo, monospace;
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }
</style>

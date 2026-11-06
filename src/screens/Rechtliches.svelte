<script lang="ts">
  // Impressum aus dem Generator; die Angaben zum Datenschutz sind ein Entwurf aus
  // docs/entwurf-impressum-datenschutz.md, die ganze Erklärung steht auf /datenschutz/.
  import { impressumHtml } from '../app/impressum';
  import { t } from '../i18n';
  import { passend, TITEL } from '../ui/passend';
  import Zurueck from '../ui/Zurueck.svelte';
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#/einstellungen" text={t('einstellungen.titel')} /></div>
  <h1 use:passend={TITEL} class="display">{t('rechtliches.titel')}</h1>
  <p class="stand">{t('rechtliches.stand')}</p>

  <h2>{t('rechtliches.impressum')}</h2>
  <div class="impressum">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- fester Text aus dem Repository, keine Eingabe -->
    {@html impressumHtml(3)}
  </div>

  <h2>{t('rechtliches.datenschutz')}</h2>
  <p>{t('rechtliches.kurz')}</p>
  <h3>{t('rechtliches.geraetTitel')}</h3>
  <p>{t('rechtliches.geraetText')}</p>
  <h3>{t('rechtliches.backupTitel')}</h3>
  <p>{t('rechtliches.backupText')}</p>
  <h3>{t('rechtliches.teilenTitel')}</h3>
  <p>{t('rechtliches.teilenText')}</p>
  <h3>{t('rechtliches.hostingTitel')}</h3>
  <p>{t('rechtliches.hostingText')}</p>
  <h3>{t('rechtliches.cookiesTitel')}</h3>
  <p>{t('rechtliches.cookiesText')}</p>
  <h3>{t('rechtliches.rechteTitel')}</h3>
  <p>{t('rechtliches.rechteText')}</p>
  <p><a class="ganz" href="/datenschutz/">{t('rechtliches.ganzeErklaerung')}</a></p>
</main>

<style>
  .seite {
    padding: 0 var(--space-4) calc(40px + env(safe-area-inset-bottom));
  }
  .kopf {
    padding-top: calc(8px + env(safe-area-inset-top));
  }
  h1 {
    margin: 8px 0 0;
  }
  h2 {
    margin: 24px 0 4px;
    font-size: calc(20 * var(--px));
    line-height: calc(26 * var(--px));
    font-weight: 800;
  }
  h3,
  .impressum :global(h3) {
    margin: 16px 0 2px;
    font-size: calc(17 * var(--px));
    line-height: calc(24 * var(--px));
    font-weight: 700;
  }
  p,
  .impressum :global(p) {
    margin: 4px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }
  .stand {
    color: var(--ink-muted);
  }
  .impressum :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    overflow-wrap: anywhere;
  }
  .impressum :global(.seal) {
    margin-top: 8px;
    color: var(--ink-muted);
  }
  .ganz {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-weight: 700;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>

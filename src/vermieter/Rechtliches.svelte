<script lang="ts">
  import { impressumHtml } from '../app/impressum';
  import { t } from './texte';

  let { zurueck, zurueckText }: { zurueck: string; zurueckText: string } = $props();
</script>

<article class="sec vs-detail vs-wann vs-recht" aria-label={t('recht.titel')}>
  <a class="vs-back" href={zurueck}>
    <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    {zurueckText}
  </a>
  <h2 class="vs-t" data-titel tabindex="-1">{t('recht.titel')}</h2>
  <p class="vs-quelle">{t('recht.stand')}</p>

  <h3>{t('recht.impressum')}</h3>
  <div class="vs-impressum">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- fester Text aus dem Repository, keine Eingabe -->
    {@html impressumHtml(4)}
  </div>

  <h3>{t('recht.datenschutz')}</h3>
  <p>{t('recht.kurz')}</p>
  <h3>{t('recht.hosting')}</h3>
  <p>{t('recht.hostingText')}</p>
  <h3>{t('recht.cookies')}</h3>
  <p>{t('recht.cookiesText')}</p>
  <h3>{t('recht.rechte')}</h3>
  <p>{t('recht.rechteText')}</p>
  <a class="vs-lk vs-blk" href="/datenschutz/">{t('recht.ganzeErklaerung')}</a>
</article>

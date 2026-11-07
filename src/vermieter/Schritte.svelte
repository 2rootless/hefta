<script lang="ts">
  import Symbol from '../ui/Symbol.svelte';
  // „Welche Unterlagen wann“ (VS7): dieselbe Tabelle wie der Ratgeber, darum überall dieselbe Fundstelle.
  import { VERMIETER_RATGEBER } from '../app/name';
  import { fundstelle, mitName, RATGEBER } from '../domain/ratgeber';
  import { ORIENTIERUNGSHILFE } from './regel';
  import { t } from './texte';

  let { zurueck, zurueckText }: { zurueck: string; zurueckText: string } = $props();
</script>

{#snippet fund(f: string)}
  {@const stelle = fundstelle(f)}
  <a class="rg-f" href={stelle.url} rel="noreferrer" target="_blank">{stelle.text}</a>
{/snippet}

<article class="sec vs-detail vs-wann" aria-label={t('schritte.titel')}>
  <a class="vs-back" href={zurueck}>
    <span class="vs-ch"><Symbol name="zurueck" groesse={20} /></span>
    {zurueckText}
  </a>
  <h2 class="vs-t" data-titel tabindex="-1">{t('schritte.titel')}</h2>
  <p class="vs-lead">{t('schritte.lead')}</p>
  <ol class="vs-steps">
    {#each RATGEBER.schritte as s (s.nr)}
      <li>
        <span class="vs-sn">{s.nr}</span>
        <div>
          <b>{s.titel.v}</b>
          <p>{s.wann.v}</p>
          <ul class="rg-vor">
            {#each s.vor as v, i (i)}
              <li><span>{mitName(v.text)}</span> {@render fund(v.fund)}</li>
            {/each}
          </ul>
          {#if s.nochNicht}
            <p class="rg-nn">
              <b>{t('schritte.nochNicht')}</b>
              {s.nochNicht.text}
              {@render fund(s.nochNicht.fund)}
            </p>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
  <p class="vs-quelle">{t('schritte.quelle')}</p>
  <a class="vs-lk vs-blk" href={ORIENTIERUNGSHILFE} rel="noreferrer" target="_blank"
    >{t('quelle.lesen')}</a
  >
  <a class="vs-lk vs-blk" href={VERMIETER_RATGEBER}>{t('schritte.ratgeber')}</a>
</article>

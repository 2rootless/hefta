<script lang="ts">
  // PC213/PC214 (E385, E-Bürge): `#/buergschaft` im Browser öffnet die Bürgschaft der App für eine Person ohne Haushalt,
  // die bürgt. Gibt es schon eine, geht es zu ihrer Bürgschaft; sonst fragt die Seite nach dem Namen.
  import { daten, gehe } from '../app/daten.svelte';
  import { ersetzen } from '../app/router.svelte';
  import { t } from '../i18n';
  import { browserZurueck } from '../ui/browserZurueck';
  import PersonOhneAnlegen from '../ui/PersonOhneAnlegen.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const zurueck = browserZurueck();
  const buerge = $derived(
    daten.ohne?.mitglieder.find((m) => m.zugehoerigkeit.rolle === 'buerge') ?? null,
  );
  $effect(() => {
    if (buerge) ersetzen(`/buergschaft/${buerge.person.id}`);
  });
</script>

<main class="seite">
  <div class="kopf"><Zurueck href={zurueck.href} text={zurueck.text} /></div>
  {#if daten.geladen && !buerge}
    <div class="titelblock">
      <h1 class="display">{t('buergschaft.titel')}</h1>
      <p class="lead">{t('ohneHaushalt.buergeLead')}</p>
      <p class="haushalt-satz">{t('ohneHaushalt.kopf')}</p>
    </div>
    <section>
      <PersonOhneAnlegen
        rolle="buerge"
        knopf={t('ohneHaushalt.weiter')}
        fertig={(personId) => gehe(`/buergschaft/${personId}`)}
      />
    </section>
  {/if}
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) var(--space-4)
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .haushalt-satz {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
  }

  section {
    margin-top: var(--space-6);
    padding: 0 var(--space-1);
  }
</style>

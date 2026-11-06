<script lang="ts">
  // Zum Übertragen (A6): alle Angaben als Liste mit „Kopieren“, für Portale mit eigenem Formular.
  // Nur die Zwischenablage auf dem Gerät; Hefta schickt nichts von selbst.
  import { daten } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import { rollenText } from '../domain/regelkatalog';
  import { angabenZumUebertragen, einziehend } from '../domain/selbstauskunft';
  import { t } from '../i18n';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { passend, TITEL } from '../ui/passend';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Zurueck from '../ui/Zurueck.svelte';

  let { personId }: { personId: string } = $props();

  const ansicht = $derived(daten.ansicht);
  const mitglied = $derived(ansicht?.mitglieder.find((m) => m.person.id === personId));
  const zeilen = $derived.by(() => {
    if (!ansicht || !mitglied) return [];
    const vertrag = ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length;
    return angabenZumUebertragen(
      mitglied.person,
      mitglied.zugehoerigkeit.rolle,
      einziehend(vertrag, ansicht.haushalt),
      haushaltsAngabenAus(ansicht),
    );
  });
  const rolle = $derived(
    mitglied ? rollenText(mitglied.zugehoerigkeit.rolle, mitglied.zugehoerigkeit.bezeichnung) : '',
  );

  let meldung = $state('');
  async function kopieren(text: string, was: string) {
    try {
      await navigator.clipboard.writeText(text);
      meldung = t('uebertragen.kopiert', { was });
    } catch {
      meldung = t('uebertragen.nichtKopiert');
    }
  }
  const alles = $derived(zeilen.map((z) => `${z.etikett}: ${z.wert}`).join('\n'));
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#/selbstauskunft/{personId}" text={t('selbstauskunft.titel')} />
  </div>
  <div class="titelblock">
    <h1 class="display frage" use:passend={TITEL}>{t('uebertragen.titel')}</h1>
    <p class="lead">{t('uebertragen.lead')}</p>
    {#if rolle && mitglied}
      <p class="lead">{mitglied.person.rufname || mitglied.person.vorname} · {rolle}</p>
    {/if}
  </div>
  <ul class="liste">
    {#each zeilen as z (z.etikett)}
      <li>
        <span class="tx"><small>{z.etikett}</small><b>{z.wert}</b></span>
        <button
          type="button"
          class="kopieren"
          aria-label={t('uebertragen.zeileLabel', { was: z.etikett })}
          onclick={() => kopieren(z.wert, z.etikett)}>{t('uebertragen.kopieren')}</button
        >
      </li>
    {/each}
  </ul>
  <p class="hinweis">{t('uebertragen.hinweis')}</p>
  <p class="meldung" role="status">{meldung}</p>
</main>
<Aktionsleiste
  text={t('uebertragen.alles')}
  onclick={() => kopieren(alles, t('uebertragen.allesWas'))}
  neben={{
    text: t('uebertragen.fertig'),
    onclick: () => zurueckGehen(`/selbstauskunft/${personId}`),
  }}
/>

<style>
  .seite {
    padding-bottom: 140px;
  }
  .kopf,
  .titelblock {
    padding: 0 var(--space-4);
  }
  .lead {
    margin: 6px 0 0;
    color: var(--ink-muted);
  }
  .liste {
    margin: 12px var(--space-4) 0;
    padding: 4px var(--space-4);
    list-style: none;
    border-radius: 20px;
    background: var(--surface);
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
    min-height: 52px;
    padding: 8px 0;
    border-top: 1px solid var(--track);
  }
  li:first-child {
    border-top: 0;
  }
  .tx {
    flex: 1 1 180px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tx small {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
  }
  .tx b {
    display: block;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }
  .kopieren {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 12px;
    border-radius: 22px;
    border: 1.5px solid var(--ink);
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 700;
    white-space: nowrap;
  }
  .hinweis {
    margin: 12px calc(var(--space-4) + 4px) 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }
  .meldung {
    margin: 8px calc(var(--space-4) + 4px) 0;
    min-height: calc(19 * var(--px));
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }
</style>

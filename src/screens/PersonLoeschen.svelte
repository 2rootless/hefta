<script lang="ts">
  // „Petra ganz löschen?“ als eigener Schritt (design/person-und-haushalt.md, Abschnitt 4, K4b):
  // was gelöscht wird, in Zahlen, und ob es im letzten Backup steckt. „Herausnehmen“ bleibt der
  // kleine, umkehrbare Weg. In Version 1 gibt es einen Haushalt, darum ohne Hinweis auf andere (K4).
  import { daten, db, gehe, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { tageSeit } from '../domain/zeit';
  import { t } from '../i18n';
  import { personGanzLoeschen } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { personId }: { personId: string } = $props();

  const eintrag = $derived(
    [...(daten.ansicht?.mitglieder ?? []), ...(daten.ansicht?.herausgenommen ?? [])].find(
      (m) => m.person.id === personId,
    ),
  );
  const name = $derived(eintrag?.person.vorname ?? '');
  const zurueckZu = $derived(
    eintrag?.zugehoerigkeit.herausgenommenAm ? '/haushalt' : `/person-aendern/${personId}`,
  );

  const unterlagen = $derived.by(() => {
    const a = daten.ansicht;
    if (!a) return { anzahl: 0, neueste: '' };
    const docs = a.dokumente.filter((d) => d.personId === personId).map((d) => d.id);
    const versionen = a.versionen.filter((v) => docs.includes(v.dokumentId));
    const mitVersion = new Set(versionen.map((v) => v.dokumentId));
    const neueste =
      versionen
        .map((v) => v.createdAt)
        .sort()
        .at(-1) ?? '';
    return { anzahl: mitVersion.size, neueste };
  });

  const backupSatz = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt) return t('personLoeschen.backupKeins', { name });
    const tage = tageSeit(zuletzt);
    const wann =
      tage === 0 ? t('personLoeschen.heute') : t('personLoeschen.vorTagen', { anzahl: tage });
    return !unterlagen.neueste || unterlagen.neueste <= zuletzt
      ? t('personLoeschen.backupDrin', { wann, name })
      : t('personLoeschen.backupAlt', { wann, name });
  });

  let loescht = $state(false);
  async function loeschen() {
    if (loescht) return;
    loescht = true;
    await personGanzLoeschen(await db(), personId);
    await neuLaden();
    abschliessen('/haushalt');
  }
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#{zurueckZu}" text={t('allgemein.zurueck')} />
  </div>
  {#if !eintrag}
    <p>{t('personSeite.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display frage">{t('personLoeschen.titel', { name })}</h1>
      <p class="lead">{t('personLoeschen.lead')}</p>
    </div>
    <p class="info"><Symbol name="info" groesse={20} /><span>{backupSatz}</span></p>
    <h2 class="liste-titel">{t('personLoeschen.was')}</h2>
    <ul class="liste">
      <li>{eintrag.person.vorname} {eintrag.person.nachname}</li>
      {#if unterlagen.anzahl}
        <li>{t('personLoeschen.unterlagen', { anzahl: unterlagen.anzahl })}</li>
      {/if}
      {#if eintrag.person.selbstauskunft}
        <li>{t('personLoeschen.selbstauskunft')}</li>
      {/if}
    </ul>
  {/if}
</main>
{#if eintrag}
  <Aktionsleiste
    text={t('personLoeschen.knopf', { name })}
    onclick={loeschen}
    neben={{ text: t('personLoeschen.abbrechen'), onclick: () => gehe(zurueckZu) }}
  />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) var(--space-4)
      max(calc(160px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .info {
    display: flex;
    gap: 10px;
    margin: var(--space-5) 0 0;
    padding: 14px;
    border-radius: 16px;
    background: var(--surface);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .info :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .liste-titel {
    margin: var(--space-6) var(--space-1) 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .liste {
    display: grid;
    margin: 0;
    padding: 4px 14px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .liste li {
    padding: 14px 0;
    font-size: calc(16 * var(--px));
    font-weight: 700;
  }

  .liste li + li {
    border-top: 1px solid var(--track);
  }
</style>

<script lang="ts">
  // „Alles löschen?“ als eigener Bildschirm (design/mappe-erstellen-einstellungen.md, Abschnitt 5, S9):
  // was gelöscht wird, in Zahlen; ist das Backup alt oder fehlt Neues darin, ein starker Hinweis.
  import { onMount } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen, zurueckGehen } from '../app/router.svelte';
  import { tageSeit } from '../domain/zeit';
  import { t } from '../i18n';
  import { bestandAusDb, neuSeitBackup, type Bestand } from '../storage/sicherung';
  import { allesLoeschen } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let bestand = $state<Bestand | null>(null);
  let neu = $state(0);
  const zuletzt = $derived(daten.einstellungen?.letztesBackup ?? null);

  onMount(() => {
    void (async () => {
      const d = await db();
      bestand = await bestandAusDb(d);
      neu = await neuSeitBackup(d, zuletzt);
    })();
  });

  const backupHinweis = $derived.by(() => {
    if (!bestand?.unterlagen) return null;
    if (!zuletzt) return t('loeschenSeite.backupKeins');
    const tage = tageSeit(zuletzt);
    if (tage <= 30 && neu === 0) return null;
    const wann =
      tage === 0 ? t('loeschenSeite.backupHeute') : t('loeschenSeite.backupVor', { anzahl: tage });
    return neu ? `${wann} ${t('loeschenSeite.seitdem', { anzahl: neu })}` : wann;
  });

  const personenText = $derived.by(() => {
    if (!bestand) return '';
    const personen = t('zahlen.personen', { anzahl: bestand.personen });
    return bestand.kinder
      ? t('loeschenSeite.personenKinder', {
          personen,
          kinder: t('zahlen.kinder', { anzahl: bestand.kinder }),
        })
      : personen;
  });

  let loescht = $state(false);
  async function loeschen() {
    if (loescht) return;
    loescht = true;
    await allesLoeschen(await db());
    await neuLaden();
    abschliessen('/');
  }
</script>

<main class="seite">
  <div class="kopf">
    {#if !loescht}<Zurueck href="#/einstellungen" text={t('einstellungen.titel')} />{/if}
  </div>
  <div class="titelblock">
    <h1 class="display frage">{t('loeschenSeite.titel')}</h1>
    <p class="lead">{t('loeschenSeite.lead')}</p>
  </div>

  {#if bestand}
    <section class="abschnitt" aria-labelledby="was-weg">
      <h2 id="was-weg">{t('loeschenSeite.was')}</h2>
      <ul class="zeilen">
        {#if bestand.personen}<li class="eintrag">{personenText}</li>{/if}
        {#if bestand.unterlagen}<li class="eintrag">
            {t('loeschenSeite.unterlagen', { anzahl: bestand.unterlagen })}
          </li>{/if}
        {#if bestand.bewerbungen}<li class="eintrag">
            {t('loeschenSeite.bewerbungen', { anzahl: bestand.bewerbungen })}
          </li>{/if}
        <li class="eintrag">{t('loeschenSeite.einstellungen')}</li>
      </ul>
    </section>
  {/if}

  {#if backupHinweis}
    <section class="abschnitt">
      <Notiz stark>
        <p>{backupHinweis}</p>
        <a class="textlink" href="#/einstellungen/backup">{t('loeschenSeite.erstBackup')}</a>
      </Notiz>
    </section>
  {/if}
</main>
<Aktionsleiste
  text={t('loeschenSeite.knopf')}
  onclick={loeschen}
  neben={{ text: t('loeschenSeite.abbrechen'), onclick: () => zurueckGehen('/einstellungen') }}
/>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(180px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .eintrag {
    padding: 16px;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }
</style>

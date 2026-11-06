<script lang="ts">
  // Backup erstellen (design/mappe-erstellen-einstellungen.md, Abschnitt 3, S3–S5): was drin ist,
  // mit oder ohne Passwort, dann sichern. Teilen braucht einen frischen Tipp: Dauert das Erstellen
  // zu lange, heißt der Knopf danach „Backup sichern“ und ein zweiter Tipp öffnet das Blatt.
  import { BACKUP_DATEIANFANG, BACKUP_ENDUNG } from '../app/name';
  import { onMount, tick } from 'svelte';
  import { db, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { heuteTag } from '../domain/zeit';
  import { groesse, t } from '../i18n';
  import {
    bestandAusDb,
    sicherungErstellen,
    sicherungPruefen,
    type Bestand,
  } from '../storage/sicherung';
  import { einstellungenAendern, speicherBelegt } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { bestandZeilen, einstellungenZustand } from '../ui/einstellungen.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let bestand = $state<Bestand | null>(null);
  let ungefaehr = $state(0);
  let mitPasswort = $state(true);
  let passwort = $state('');
  let passwort2 = $state('');
  let zweitesVerlassen = $state(false);
  let erstes = $state<HTMLInputElement>();

  let datei = $state<File | null>(null);
  let url = $state('');
  let link = $state<HTMLAnchorElement>();
  let beschaeftigt = $state(false);
  let fehler = $state('');
  // Teilen abgelehnt, weil der Tipp zu lange her war: dann erklärt S3b, warum es zwei Tipps braucht.
  let zweiterTipp = $state(false);
  // Weggegangen, während es noch lief: Dann öffnet sich kein Teilen-Blatt auf einer anderen Seite.
  let verlassen = false;

  const ungleich = $derived(
    mitPasswort && zweitesVerlassen && passwort2.length > 0 && passwort !== passwort2,
  );
  const grund = $derived(
    mitPasswort && (passwort.length < 8 || passwort !== passwort2)
      ? t('backupSeite.grund')
      : undefined,
  );

  onMount(() => {
    void (async () => {
      const d = await db();
      bestand = await bestandAusDb(d);
      ungefaehr = await speicherBelegt(d);
    })();
    erstes?.focus();
    // Erst später freigeben: Der Download kann noch laufen, wenn die Seite schon weg ist.
    return () => {
      verlassen = true;
      const alt = url;
      if (alt) setTimeout(() => URL.revokeObjectURL(alt), 60_000);
    };
  });

  async function erstellen() {
    if (grund || beschaeftigt) return;
    beschaeftigt = true;
    fehler = '';
    try {
      const blob = await sicherungErstellen(
        await db(),
        mitPasswort ? passwort : undefined,
        __APP_VERSION__,
      );
      // Einmal ganz lesen: Ein Backup, das sich nicht einspielen ließe, soll niemand für sicher halten.
      await sicherungPruefen(blob, mitPasswort ? passwort : undefined);
      if (verlassen) return;
      datei = new File([blob], `${BACKUP_DATEIANFANG}-${heuteTag()}.${BACKUP_ENDUNG}`, {
        type: 'application/octet-stream',
      });
      url = URL.createObjectURL(datei);
    } catch {
      fehler = t('backupSeite.fehler');
      return;
    } finally {
      beschaeftigt = false;
    }
    await tick();
    sichern();
  }

  // Ohne title teilen, sonst legt iOS eine Textdatei bei. Ohne Teilen-Blatt: herunterladen.
  function sichern() {
    if (!datei) return;
    if (!navigator.canShare?.({ files: [datei] })) {
      link?.click();
      return;
    }
    navigator.share({ files: [datei] }).then(gesichert, (e: unknown) => {
      // Abgebrochen oder der Tipp war zu lange her: Jetzt steht „Backup sichern“ da (S3b).
      zweiterTipp = e instanceof DOMException && e.name === 'NotAllowedError';
    });
  }

  async function gesichert() {
    await einstellungenAendern(await db(), {
      letztesBackup: new Date().toISOString(),
      ohnePasswortHinweisGezeigt: true,
    });
    await neuLaden();
    einstellungenZustand.meldung = t('einstellungen.gesichert');
    abschliessen('/einstellungen');
  }
</script>

<main class="seite">
  <div class="kopf">
    {#if !beschaeftigt}<Zurueck href="#/einstellungen" text={t('einstellungen.titel')} />{/if}
  </div>
  {#if datei}
    <!-- S3b: fertig, nur noch sichern. -->
    <div class="titelblock">
      <h1 class="display">{t('backupSeite.fertigTitel')}</h1>
      <p class="lead">{t('backupSeite.fertigText')}</p>
    </div>
    <section class="abschnitt">
      <ul class="zeilen">
        <li>
          <div class="listenzeile">
            <span class="tx"
              ><b>{datei.name}</b><small
                >{groesse(datei.size)}{mitPasswort
                  ? `, ${t('backupSeite.verschluesselt')}`
                  : ''}</small
              ></span
            >
            <span class="haken" aria-hidden="true"><Symbol name="haken" groesse={18} /></span>
          </div>
        </li>
      </ul>
      {#if zweiterTipp}<p class="hinweis oben">{t('backupSeite.zweiterTipp')}</p>{/if}
      <a
        class="visually-hidden"
        tabindex="-1"
        aria-hidden="true"
        bind:this={link}
        href={url}
        download={datei.name}
        onclick={() => void gesichert()}>{t('backupSeite.alsDatei')}</a
      >
    </section>
  {:else}
    <div class="titelblock">
      <h1 class="display">{t('backupSeite.titel')}</h1>
      <p class="lead">{t('backupSeite.lead')}</p>
    </div>

    <section class="abschnitt">
      <div class="vergleich">
        <div>
          <b>{t('backupSeite.drin')}</b>
          {#if bestand}{@const [wer, was] = bestandZeilen(bestand)}{wer}<br />{was}{/if}
        </div>
        <div>
          <b>{t('backupSeite.groesse')}</b>{t('backupSeite.ungefaehr', {
            groesse: groesse(ungefaehr),
          })}
        </div>
      </div>
    </section>

    <section class="abschnitt">
      <div class="wahl" role="radiogroup" aria-label={t('backupSeite.titel')}>
        {#each [true, false] as mit (mit)}
          <button
            type="button"
            class="wahlkarte"
            class:an={mitPasswort === mit}
            role="radio"
            aria-checked={mitPasswort === mit}
            onclick={() => (mitPasswort = mit)}
          >
            <span class="punkt" aria-hidden="true"></span>
            <span class="tx">
              <b>{mit ? t('backupSeite.mit') : t('backupSeite.ohne')}</b>
              <small>{mit ? t('backupSeite.mitText') : t('backupSeite.ohneText')}</small>
            </span>
          </button>
        {/each}
      </div>
    </section>

    <section class="abschnitt felder">
      {#if mitPasswort}
        <label class="eingabe">
          {t('backupSeite.passwort')}
          <input
            type="password"
            autocomplete="new-password"
            bind:this={erstes}
            bind:value={passwort}
          />
        </label>
        <label class="eingabe">
          {t('backupSeite.nochmal')}
          <input
            type="password"
            autocomplete="new-password"
            bind:value={passwort2}
            aria-invalid={ungleich}
            aria-describedby={ungleich ? 'pw-ungleich' : undefined}
            onblur={() => (zweitesVerlassen = true)}
          />
        </label>
        {#if ungleich}<p id="pw-ungleich" class="fehlzeile" role="alert">
            {t('backupSeite.ungleich')}
          </p>{/if}
        <p class="hinweis">{t('backupSeite.hinweis')}</p>
      {:else}
        <Notiz stark><p>{t('backupSeite.ohneWarnung')}</p></Notiz>
      {/if}
    </section>

    {#if beschaeftigt || fehler}
      <section class="abschnitt" aria-live="polite">
        {#if beschaeftigt}
          <p class="status">{t('backupSeite.wirdErstellt')}</p>
        {:else}
          <p class="status" role="alert">{fehler}</p>
        {/if}
      </section>
    {/if}
  {/if}
</main>
{#if datei}
  <Aktionsleiste
    text={t('backupSeite.sichern')}
    onclick={sichern}
    neben={{ text: t('backupSeite.alsDatei'), onclick: () => link?.click() }}
  />
{:else}
  <Aktionsleiste
    text={beschaeftigt ? t('backupSeite.wirdErstellt') : t('backupSeite.knopf')}
    {grund}
    onclick={erstellen}
  />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(160px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .wahl {
    display: grid;
    gap: 8px;
  }

  .wahlkarte {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    border: 2px solid transparent;
    border-radius: 18px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .wahlkarte.an {
    border-color: var(--ink);
  }

  .punkt {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin-top: 1px;
    border: 2px solid var(--ink);
    border-radius: 50%;
  }

  .wahlkarte.an .punkt::after {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ink);
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .felder {
    display: grid;
    gap: var(--space-3);
  }

  .felder .fehlzeile {
    margin-top: -4px;
  }

  .hinweis {
    margin: 0 var(--space-1);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .status {
    margin: 0 var(--space-1);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .hinweis.oben {
    margin-top: 10px;
  }

  .haken {
    display: inline-flex;
    flex-shrink: 0;
  }
</style>

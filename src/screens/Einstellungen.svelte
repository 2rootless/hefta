<script lang="ts">
  import { backupKlick, istAndroidApp, istApp } from '../app/plattform';
  // Einstellungen in Gruppen (design/mappe-erstellen-einstellungen.md, Abschnitt 2, S1/S2):
  // Sicherung, Speicher, App, Daten. Backup erstellen, einspielen und alles löschen sind eigene Seiten.
  import { onMount } from 'svelte';
  import { daten, db, gehe } from '../app/daten.svelte';
  import { QUELLCODE_ADRESSE } from '../app/name';
  import { RUECKMELDUNG_ADRESSE, rueckmeldungLink } from '../app/impressum';
  import { tageSeit } from '../domain/zeit';
  import { backupAccept } from '../storage/backup';
  import { KATALOG_STAND } from '../domain/regelkatalog';
  import { groesse, monatName, t } from '../i18n';
  import { speicherBelegt } from '../storage/speicher';
  import { einstellungenZustand } from '../ui/einstellungen.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { passend, TITEL } from '../ui/passend';
  import Rueckmeldung from '../ui/Rueckmeldung.svelte';
  import RueckmeldungMail from '../ui/RueckmeldungMail.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { homescreenFragen } from '../ui/homescreen';
  import { aussehenSetzen, aussehenWahl, type Aussehen } from '../app/theme';
  import { herkunftsReiter } from '../ui/herkunft.svelte';
  import { erinnerungenMoeglich, mitteilungen } from '../app/erinnerungen.svelte';
  import { einstellungenAendern } from '../storage/speicher';
  import { stillLaden } from '../app/daten.svelte';
  import SchalterZeile from '../ui/SchalterZeile.svelte';

  const meldung = einstellungenZustand.meldung;
  einstellungenZustand.meldung = '';

  const backupText = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt) return t('einstellungen.letztesNie');
    const tage = tageSeit(zuletzt);
    if (tage === 0) return t('einstellungen.letztesHeute');
    const text = t('einstellungen.letztesTage', { anzahl: tage });
    return tage > 30 ? `${text}. ${t('einstellungen.zeitFuerNeues')}` : text;
  });

  // Speicher: belegt laut Browser (sonst die Summe der Dateien), frei bis zur Grenze des Browsers.
  let belegt = $state(0);
  let frei = $state<number | null>(null);
  let dauerhaft = $state<boolean | null>(null);
  let balken = $state<HTMLElement>();

  async function speicherMessen() {
    const eigene = await speicherBelegt(await db());
    const schaetzung = await navigator.storage?.estimate?.().catch(() => undefined);
    belegt = Math.max(eigene, schaetzung?.usage ?? 0);
    frei = schaetzung?.quota ? Math.max(0, schaetzung.quota - belegt) : null;
    // In der App liegt alles im Speicher der App; „dauerhaft speichern“ ist eine Frage des Browsers.
    dauerhaft =
      !istApp() && navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  }

  // Breite über CSSOM, weil die Inhaltsrichtlinie keine Inline-Styles erlaubt.
  $effect(() => {
    if (!balken) return;
    const anteil = frei === null ? 0 : belegt / (belegt + frei || 1);
    balken.style.width = `${Math.max(2, Math.min(100, anteil * 100))}%`;
  });

  async function dauerhaftAnfragen() {
    try {
      dauerhaft = (await navigator.storage?.persist?.()) ?? false;
    } catch {
      dauerhaft = false;
    }
  }

  const homescreen =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  // Stand des Regelkatalogs als „Oktober 2026“ (mit Jahr, darum ein Bezugsdatum in einem anderen Jahr).
  const stand = monatName(KATALOG_STAND.slice(0, 7), new Date(0));

  async function erinnerungUmschalten(
    feld: 'erinnerungBesichtigungen' | 'erinnerungGehalt',
    an: boolean,
  ) {
    await einstellungenAendern(await db(), { [feld]: an });
    await stillLaden();
  }

  // Zurück zum Reiter, aus dem man kam (Auftraggeber 13.11.).
  const herkunft = $derived(herkunftsReiter());

  // Aussehen (Auftraggeber, 12.11.): System, Hell oder Dunkel, nur auf diesem Gerät.
  let aussehen = $state<Aussehen>(aussehenWahl());
  const AUSSEHEN: { wert: Aussehen; text: string }[] = [
    { wert: 'system', text: t('einstellungen.aussehenSystem') },
    { wert: 'hell', text: t('einstellungen.aussehenHell') },
    { wert: 'dunkel', text: t('einstellungen.aussehenDunkel') },
  ];

  function backupGewaehlt(datei: File | undefined) {
    if (!datei) return;
    einstellungenZustand.datei = datei;
    gehe('/einstellungen/einspielen');
  }

  let kopiert = $state(false);
  async function adresseKopieren() {
    try {
      await navigator.clipboard.writeText(RUECKMELDUNG_ADRESSE);
      kopiert = true;
      setTimeout(() => (kopiert = false), 2000);
    } catch {
      // Ohne Erlaubnis zum Kopieren bleibt die Adresse als Text und Link stehen.
    }
  }

  onMount(() => {
    void speicherMessen();
  });
</script>

{#snippet pfeil()}
  <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={20} /></span>
{/snippet}

<main class="seite">
  <div class="kopf"><Zurueck href={herkunft.href} text={herkunft.text} /></div>
  <div class="titelblock">
    <h1 use:passend={TITEL} class="display">{t('einstellungen.titel')}</h1>
    {#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
  </div>

  <section class="abschnitt" aria-labelledby="g-sicherung">
    <h2 id="g-sicherung">{t('einstellungen.sicherung')}</h2>
    <ul class="zeilen">
      <li>
        <a class="listenzeile" href="#/einstellungen/backup">
          <span class="tx"
            ><b>{t('einstellungen.backupErstellen')}</b><small>{backupText}</small></span
          >
          {@render pfeil()}
        </a>
      </li>
      <li>
        {#if !daten.ansicht && homescreenFragen(daten.einstellungen)}
          <!-- Hefta 2: Ohne Haushalt spielt man hier ein (B15). Am iPhone in Safari erst der Hinweis auf
               die App (E30): In Safari eingespielt, fehlt das Backup später in der App. -->
          <a class="listenzeile" href="#/homescreen/einspielen">
            <span class="tx"
              ><b>{t('einstellungen.backupEinspielen')}</b><small
                >{t('einstellungen.einspielenHinweis')}</small
              ></span
            >
            {@render pfeil()}
          </a>
        {:else}
          <label class="listenzeile">
            <span class="tx"
              ><b>{t('einstellungen.backupEinspielen')}</b><small
                >{t('einstellungen.einspielenHinweis')}</small
              ></span
            >
            {@render pfeil()}
            <input
              type="file"
              class="visually-hidden"
              accept={backupAccept(istApp())}
              onclick={(e) => backupKlick(e, backupGewaehlt)}
              onchange={(e) => backupGewaehlt(e.currentTarget.files?.[0])}
            />
          </label>
        {/if}
      </li>
    </ul>
  </section>

  <section class="abschnitt" aria-labelledby="g-speicher">
    <h2 id="g-speicher">{t('einstellungen.speicher')}</h2>
    <ul class="zeilen">
      <li class="speicher">
        <b>{t('einstellungen.belegt', { groesse: groesse(belegt) })}</b>
        {#if frei !== null}
          <span class="balken" aria-hidden="true"><i bind:this={balken}></i></span>
        {/if}
        <small>
          {#if frei !== null}{t('einstellungen.frei', { groesse: groesse(frei) })}{/if}
          {#if dauerhaft === true}{t('einstellungen.dauerhaftJa')}{:else if dauerhaft === false}{t(
              'einstellungen.dauerhaftNein',
            )}{/if}
        </small>
        {#if dauerhaft === false}
          <button type="button" class="textlink" onclick={dauerhaftAnfragen}
            >{t('einstellungen.anfragen')}</button
          >
        {/if}
      </li>
      <li class:app={istApp()}>
        {#if homescreen}
          <div class="listenzeile">
            <span class="tx"
              ><b>{t('einstellungen.homescreen')}</b><small
                >{t('einstellungen.homescreenHinweis')}</small
              ></span
            >
            <span class="wert">{t('einstellungen.ja')}</span>
          </div>
        {:else}
          <a class="listenzeile" href="#/homescreen/einstellungen">
            <span class="tx"
              ><b>{t('einstellungen.homescreen')}</b><small
                >{t('einstellungen.homescreenHinweis')}</small
              ></span
            >
            <span class="wert">{t('einstellungen.nein')}</span>
            {@render pfeil()}
          </a>
        {/if}
      </li>
    </ul>
  </section>

  {#if erinnerungenMoeglich()}
    <!-- Zeile 9, B21: zwei Schalter; beide sind an, bis man sie ausschaltet. -->
    <section class="abschnitt" aria-labelledby="g-erinnerungen">
      <h2 id="g-erinnerungen">{t('einstellungen.erinnerungen')}</h2>
      <ul class="zeilen">
        <li>
          <SchalterZeile
            an={daten.einstellungen?.erinnerungBesichtigungen !== false}
            titel={t('einstellungen.erinnerungBesichtigungen')}
            onclick={() =>
              void erinnerungUmschalten(
                'erinnerungBesichtigungen',
                daten.einstellungen?.erinnerungBesichtigungen === false,
              )}
          />
        </li>
        <li>
          <SchalterZeile
            an={daten.einstellungen?.erinnerungGehalt !== false}
            titel={t('einstellungen.erinnerungGehalt')}
            onclick={() =>
              void erinnerungUmschalten(
                'erinnerungGehalt',
                daten.einstellungen?.erinnerungGehalt === false,
              )}
          />
        </li>
      </ul>
      {#if mitteilungen.erlaubt === false}
        <p class="hinweis-klein">{t('einstellungen.mitteilungenAus')}</p>
      {/if}
    </section>
  {/if}

  <section class="abschnitt" aria-labelledby="g-ueber">
    <h2 id="g-ueber">{t('rueckmeldung.titel')}</h2>
    <!-- E54 (B19 Fassung 4 und 5): Antworten zum Antippen, mit Rückfrage; längere Kommentare per Mail. -->
    <!-- Unter Android ohne Internet-Berechtigung: statt der Fragen eine Mail (Planung 13.11.). -->
    <div class="blatt-rueck">
      {#if istAndroidApp()}<RueckmeldungMail />{:else}<Rueckmeldung />{/if}
    </div>
    <ul class="zeilen">
      <li>
        <div class="listenzeile rueck">
          <span class="tx"
            ><b>{t('rueckmeldung.mehr')}</b><a
              class="adresse"
              href={rueckmeldungLink(t('einstellungen.rueckmeldungBetreff'))}
              >{RUECKMELDUNG_ADRESSE.replace('@', '@​')}</a
            ></span
          >
          <button type="button" class="kopieren" onclick={adresseKopieren}
            >{kopiert ? t('einstellungen.kopiert') : t('einstellungen.kopieren')}</button
          >
        </div>
      </li>
    </ul>
  </section>

  <section class="abschnitt" aria-labelledby="g-app">
    <h2 id="g-app">{t('einstellungen.app')}</h2>
    <ul class="zeilen">
      <li>
        <div class="listenzeile aussehen-zeile">
          <span class="tx" id="aussehen-titel"><b>{t('einstellungen.aussehen')}</b></span>
          <div class="segmente" role="radiogroup" aria-labelledby="aussehen-titel">
            {#each AUSSEHEN as a (a.wert)}
              <button
                type="button"
                role="radio"
                aria-checked={aussehen === a.wert}
                onclick={() => {
                  aussehen = a.wert;
                  aussehenSetzen(a.wert);
                }}>{a.text}</button
              >
            {/each}
          </div>
        </div>
      </li>
      <li>
        <div class="listenzeile">
          <span class="tx"><b>{t('einstellungen.sprache')}</b></span>
          <span class="wert">{t('einstellungen.deutsch')}</span>
        </div>
      </li>
      <li>
        <div class="listenzeile">
          <span class="tx"
            ><b>{t('einstellungen.version')}</b><small
              >{t('einstellungen.versionWert', { version: __APP_VERSION__, stand })}</small
            ></span
          >
        </div>
      </li>
      <li>
        <div class="listenzeile">
          <span class="tx"
            ><b>{t('einstellungen.lizenz')}</b><small>{t('einstellungen.lizenzWert')}</small></span
          >
        </div>
      </li>
      {#if QUELLCODE_ADRESSE}
        <li>
          <a class="listenzeile" href={QUELLCODE_ADRESSE} rel="noreferrer" target="_blank">
            <span class="tx"><b>{t('einstellungen.quellcode')}</b></span>
          </a>
        </li>
      {/if}
      <li>
        <a class="listenzeile" href="#/einstellungen/rechtliches">
          <span class="tx"><b>{t('rechtliches.titel')}</b></span>
          {@render pfeil()}
        </a>
      </li>
    </ul>
  </section>

  <section class="abschnitt" aria-labelledby="g-daten">
    <h2 id="g-daten">{t('einstellungen.daten')}</h2>
    <ul class="zeilen">
      <li>
        <a class="listenzeile" href="#/einstellungen/loeschen">
          <span class="tx"
            ><b>{t('einstellungen.allesLoeschen')}</b><small
              >{t('einstellungen.allesLoeschenHinweis')}</small
            ></span
          >
          {@render pfeil()}
        </a>
      </li>
    </ul>
  </section>
</main>

<style>
  /* Der Schalter unter der Beschriftung, über die volle Breite: passt auch bei 320 px mit 130 %. */
  .hinweis-klein {
    margin: 8px 4px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .aussehen-zeile {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  /* Kein Rahmen um die ganze Zeile nach dem Tippen (Design 12.11.): Der Fokusring sitzt nur bei Tastatur
     auf dem einzelnen Segment. */
  .aussehen-zeile:focus-within {
    outline: none;
  }

  .segmente button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    box-shadow: none;
  }

  /* Drei Segmente wie ein Schalter: das gewählte gefüllt. */
  /* Bei sehr großer Schrift brechen die Segmente in eine zweite Reihe statt mitten im Wort. */
  .segmente {
    display: flex;
    flex-wrap: wrap;
    padding: 3px;
    border-radius: 22px;
    background: var(--ground);
  }

  .segmente button {
    flex: 1 1 auto;
    min-height: 44px;
    white-space: nowrap;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .segmente button[aria-checked='true'] {
    background: var(--action);
    color: var(--on-action);
  }

  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0 calc(48px + env(safe-area-inset-bottom));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .meldung {
    margin: 10px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .speicher {
    display: grid;
    padding: 14px 16px;
  }

  .speicher b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .speicher small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .speicher .textlink {
    justify-self: start;
    font-size: calc(14 * var(--px));
  }

  .balken {
    display: block;
    height: 10px;
    margin: 10px 0 4px;
    overflow: hidden;
    border-radius: 5px;
    background: var(--track);
  }

  .balken i {
    display: block;
    width: 2%;
    height: 100%;
    border-radius: 5px;
    background: var(--ink);
  }

  /* Eine App ist schon auf dem Homescreen. */
  .app {
    display: none;
  }

  /* Passen Text und „Kopieren“ nicht nebeneinander (320 px, große Schrift), rutscht der Knopf
     in die nächste Zeile, statt über dem Text zu liegen (C4, C26). */
  .blatt-rueck {
    margin-bottom: 10px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .rueck {
    flex-wrap: wrap;
  }

  .rueck .tx {
    flex: 1 1 auto;
    min-width: min-content;
  }

  /* Tippfläche mindestens 44 px (C5). */
  .rueck .adresse {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: var(--accent-text);
    font-weight: 600;
    overflow-wrap: break-word;
  }

  .kopieren {
    flex: none;
    min-height: var(--tap-target);
    padding: 0 12px;
    border: 1px solid var(--control-border);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>

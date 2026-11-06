<script lang="ts">
  // Homescreen-Anleitung (design/geraet-und-stoerungen.md, G4b): vor der Einrichtung, und nach
  // „Später“ höchstens noch einmal, wenn der Haushalt angelegt ist.
  import { db, neuLaden } from '../app/daten.svelte';
  import { ersetzen } from '../app/router.svelte';
  import { t } from '../i18n';
  import { einstellungenAendern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import { passend, TITEL } from '../ui/passend';
  import Zurueck from '../ui/Zurueck.svelte';

  /** Wohin es danach geht: Einrichtung, Backup einspielen oder (beim zweiten Mal) der Rutsch. */
  let { weiter, zweitesMal = false }: { weiter: string; zweitesMal?: boolean } = $props();

  async function fertig(erledigt: boolean) {
    await einstellungenAendern(
      await db(),
      // Beim zweiten Mal gilt auch „Später“ als beantwortet: Danach fragt Hefta nicht mehr.
      erledigt || zweitesMal ? { homescreenHinweisGezeigt: true } : { homescreenSpaeter: true },
    );
    await neuLaden();
    ersetzen(weiter);
  }
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#{weiter}" text={t('homescreen.spaeter')} onclick={() => fertig(false)} />
  </div>
  <div class="titelblock">
    <h1 use:passend={TITEL} class="display">{t('homescreen.titel')}</h1>
    <p class="lead">{t('homescreen.lead')}</p>
  </div>
  <ol class="schritte">
    <li>
      <span>
        {t('homescreen.schritt1Vor')}
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11v9h12v-9" /></svg
        >
        <b>{t('homescreen.teilen')}</b>
        {t('homescreen.schritt1Nach')}
      </span>
    </li>
    <li>
      <span>
        {t('homescreen.schritt2Vor')}
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"
          ><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg
        >
        <b>{t('homescreen.zumHome')}</b>.
      </span>
    </li>
    <li>
      <span
        >{t('homescreen.schritt3Vor')} <b>{t('homescreen.hinzufuegen')}</b>{t(
          'homescreen.schritt3Nach',
        )}</span
      >
    </li>
  </ol>
  <div class="notiz"><Notiz><p>{t('homescreen.backup')}</p></Notiz></div>
</main>
<Aktionsleiste
  text={t('homescreen.erledigt')}
  onclick={() => fertig(true)}
  neben={{ text: t('homescreen.spaeter'), onclick: () => fertig(false) }}
/>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(150px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .display {
    margin-top: 10px;
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

  b {
    font-weight: 800;
  }

  .ico {
    display: inline-block;
    width: 18px;
    height: 18px;
    vertical-align: -3px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .notiz {
    margin: 22px var(--space-4) 0;
  }
</style>

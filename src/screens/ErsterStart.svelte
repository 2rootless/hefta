<script lang="ts">
  import Symbol from '../ui/Symbol.svelte';
  // Erster Start (design/geraet-und-stoerungen.md, G4): zugleich der Weg zurück, wenn Safari die
  // Daten gelöscht hat: Dann sieht Hefta wie neu aus, und hier steht „Ich habe ein Backup“.
  import { daten, gehe } from '../app/daten.svelte';
  import { t } from '../i18n';
  import { passend, TITEL } from '../ui/passend';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import HinweisKasten from '../ui/HinweisKasten.svelte';
  import LogoKachel from '../ui/LogoKachel.svelte';
  import { homescreenFragen } from '../ui/homescreen';
  import { istApp } from '../app/plattform';
  import { VERMIETER_ADRESSE, VERMIETER_DOMAIN } from '../app/name';

  function los() {
    gehe(homescreenFragen(daten.einstellungen) ? '/homescreen/einrichtung' : '/einrichtung');
  }

  // Auf dem iPhone hat Safari einen anderen Speicher als die App auf dem Homescreen. Ein Backup, das
  // in Safari eingespielt wird, fehlt später in der App.
  function backup() {
    gehe(
      homescreenFragen(daten.einstellungen)
        ? '/homescreen/einspielen'
        : '/einstellungen/einspielen',
    );
  }
</script>

<main class="start">
  <HinweisKasten />
  <div class="marke"><LogoKachel groesse={76} /></div>
  <div class="titelblock">
    <h1 use:passend={TITEL} class="display">{t('ersterStart.titel')}</h1>
    <p class="lead">{t('ersterStart.lead')}</p>
  </div>
  <ul class="punkte">
    <li>
      <span class="punkt f1" aria-hidden="true"><Symbol name="person" groesse={24} /></span>
      {t('ersterStart.punkt1')}
    </li>
    <li>
      <span class="punkt f2" aria-hidden="true"><Symbol name="schloss" groesse={24} /></span>
      {t('ersterStart.punkt2')}
    </li>
    <li>
      <span class="punkt f3" aria-hidden="true"><Symbol name="datei" groesse={24} /></span>
      {t('ersterStart.punkt3')}
    </li>
  </ul>
  <!-- E42, Aufgabe 64: Wer eine Mappe bekommen hat und hefta.de statt vermieter.hefta.de eintippt,
       landet hier. Nur im Web; die App aus dem Store bleibt, wie sie ist. Leise, ohne Rahmen. Gesiezt,
       wie auf der Vermieterseite (Wunsch des Auftraggebers, 8.11.2026). -->
  {#if !istApp()}
    <p class="vermieter">
      {t('ersterStart.vermieterVor')}
      <a href={VERMIETER_ADRESSE}>{VERMIETER_DOMAIN}</a>{t('ersterStart.vermieterNach')}
    </p>
  {/if}
</main>
<Aktionsleiste
  text={t('ersterStart.los')}
  onclick={los}
  neben={{ text: t('ersterStart.backup'), onclick: backup }}
/>

<style>
  .start {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(28px + env(safe-area-inset-top)) 0
      max(calc(150px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .marke {
    display: grid;
    place-items: center;
    margin-top: 28px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
    text-align: center;
  }

  .display {
    text-wrap: balance;
  }

  .vermieter {
    margin: 20px var(--space-5) 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  /* Tippfläche 44 px (C5), ohne die Zeile höher zu machen. */
  .vermieter a {
    display: inline-block;
    padding: 12px 0;
    margin: -12px 0;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .punkte {
    margin: 18px var(--space-4) 0;
    padding: 0;
    list-style: none;
  }

  .punkte li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px var(--space-1);
    font-size: calc(16 * var(--px));
    line-height: calc(22 * var(--px));
  }

  /* Kachel in Personenfarbe mit Symbol 24 (B11, hefta-kachel-figur-40). */
  .punkt {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 6.67px;
    color: var(--on-person);
  }

  .f1 {
    background: var(--person-1);
  }

  .f2 {
    background: var(--person-2);
  }

  .f3 {
    background: var(--person-child);
    box-shadow: inset 0 0 0 1.8px var(--on-person);
  }
</style>

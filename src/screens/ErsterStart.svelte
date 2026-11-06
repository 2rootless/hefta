<script lang="ts">
  // Erster Start (design/geraet-und-stoerungen.md, G4): zugleich der Weg zurück, wenn Safari die
  // Daten gelöscht hat: Dann sieht Hefta wie neu aus, und hier steht „Ich habe ein Backup“.
  import { daten, gehe } from '../app/daten.svelte';
  import { t } from '../i18n';
  import { passend, TITEL } from '../ui/passend';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import HinweisKasten from '../ui/HinweisKasten.svelte';
  import LogoKachel from '../ui/LogoKachel.svelte';
  import { homescreenFragen } from '../ui/homescreen';

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
      <span class="punkt f1" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="9" cy="9" r="3" /><path d="M4 19c.5-3 2.5-4.5 5-4.5s4.5 1.5 5 4.5" /><circle
            cx="17"
            cy="10"
            r="2.4"
          />
        </svg>
      </span>
      {t('ersterStart.punkt1')}
    </li>
    <li>
      <span class="punkt f2" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="6" y="11" width="12" height="9" rx="2" /><path d="M9 11V8a3 3 0 0 1 6 0v3" />
        </svg>
      </span>
      {t('ersterStart.punkt2')}
    </li>
    <li>
      <span class="punkt f3" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /></svg>
      </span>
      {t('ersterStart.punkt3')}
    </li>
  </ul>
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

  .punkt {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #191a2c;
  }

  .punkt svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
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

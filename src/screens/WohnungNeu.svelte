<script lang="ts">
  // „Anzeigentext einfügen“ (B23 `#s=einfuegen`; E75: in der App „einsetzen“, im Web „einfügen“).
  // Der Text der Anzeige, auf Wunsch der Link dazu; „Eckdaten lesen“ liest ihn auf dem Gerät und führt zur
  // letzten Kontrolle. Hefta lädt den Link nie: Er steht nur im Heft, damit man die Anzeige wiederfindet.
  // Der Weg mit dem Knopf von iOS und der Vorschau (B23 Bildschirm 1 und 2) kommt mit dem Plugin.
  import { daten, gehe } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import { istApp } from '../app/plattform';
  import { t } from '../i18n';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import { entwurf, entwurfLesen, entwurfVergessen } from '../ui/neuesHeft.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const app = istApp();
  const ihr = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const ablageGeht = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
  let ablageSatz = $state('');

  async function ausAblage() {
    ablageSatz = '';
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) entwurf.text = text;
      else ablageSatz = t('neuesHeft.ablageLeer');
    } catch {
      ablageSatz = t('neuesHeft.ablageNein');
    }
  }

  function weiter() {
    entwurfLesen();
    gehe('/wohnung-neu/kontrolle');
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck
      href="#/wohnungen"
      text={t('neuesHeft.abbrechen')}
      onclick={() => {
        entwurfVergessen();
        zurueckGehen('/wohnungen');
      }}
    />
  </header>
  <h1 class="h2">{t(app ? 'neuesHeft.titelApp' : 'neuesHeft.titelWeb')}</h1>
  <p class="sub">{t(app ? 'neuesHeft.subApp' : 'neuesHeft.subWeb')}</p>

  <label class="visually-hidden" for="anzeige"
    >{t(app ? 'neuesHeft.textLabelApp' : 'neuesHeft.textLabelWeb')}</label
  >
  <textarea
    id="anzeige"
    rows="8"
    placeholder={t(app ? 'neuesHeft.textLabelApp' : 'neuesHeft.textLabelWeb')}
    bind:value={entwurf.text}></textarea>
  {#if ablageGeht}
    <button class="zweit" type="button" onclick={ausAblage}>
      <Symbol name="kopieren" groesse={20} />{t(
        app ? 'neuesHeft.ausAblageApp' : 'neuesHeft.ausAblageWeb',
      )}
    </button>
  {/if}
  {#if ablageSatz}<p class="hinweis" role="status">{ablageSatz}</p>{/if}

  <h2 class="h3">
    <label for="link">{t('neuesHeft.link')}</label>
    <small>{t('neuesHeft.freiwillig')}</small>
  </h2>
  <input
    id="link"
    type="url"
    inputmode="url"
    autocomplete="off"
    placeholder="https://"
    bind:value={entwurf.link}
  />
  <p class="klein">{t(ihr ? 'neuesHeft.linkHinweisIhr' : 'neuesHeft.linkHinweisDu')}</p>

  <div class="cta">
    <Hauptbutton
      text={t('neuesHeft.lesen')}
      grund={entwurf.text.trim() ? undefined : t('neuesHeft.lesenGrund')}
      onclick={weiter}
    />
  </div>
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) calc(env(safe-area-inset-bottom) + 24px);
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  h1 {
    margin: 10px 0 6px;
  }

  .sub {
    margin: 0 0 16px;
    color: var(--ink-muted);
  }

  textarea,
  input {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--control-border);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  textarea {
    min-height: 180px;
    resize: vertical;
  }

  input {
    min-height: 48px;
  }

  .zweit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    margin-top: 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .hinweis {
    margin: 8px 0 0;
    color: var(--ink-muted);
  }

  .h3 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 24px 0 8px;
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .h3 small {
    color: var(--ink-muted);
    font-weight: 500;
  }

  .klein {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(13.5 * var(--px));
  }

  .cta {
    position: sticky;
    bottom: 0;
    margin-top: 24px;
    padding: 14px 0 calc(env(safe-area-inset-bottom) + 8px);
    background: linear-gradient(to bottom, transparent, var(--ground) 14px);
  }
</style>

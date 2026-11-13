<script lang="ts">
  // Unter Android statt der Fragen (Planung, 13.11.): Die App hat keine Internet-Berechtigung, darum geht
  // die Rückmeldung als Mail aus dem eigenen Mail-Programm. Das ist nicht anonym, und es steht so da.
  import { RUECKMELDUNG_ADRESSE, rueckmeldungLink } from '../app/impressum';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';
</script>

<div class="mail">
  <p class="zeile">{t('rueckmeldung.mailZeile', { adresse: RUECKMELDUNG_ADRESSE })}</p>
  <a class="knopf" href={rueckmeldungLink(t('einstellungen.rueckmeldungBetreff'))}
    ><Symbol name="mail" groesse={20} />{t('rueckmeldung.mailKnopf')}</a
  >
  <p class="hinweis">{t('rueckmeldung.mailHinweis')}</p>
</div>

<style>
  .mail {
    display: grid;
    gap: 10px;
    padding: 14px 16px 16px;
  }

  .zeile {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .knopf {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    justify-self: start;
    min-height: var(--tap-target);
    padding: 0 18px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-full);
    color: var(--ink);
    font-weight: 650;
    text-decoration: none;
  }

  .hinweis {
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }
</style>

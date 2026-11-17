<script lang="ts">
  // Kopfzeile jeder Hauptansicht (design/stil-c.md, „Navigation“): links Logo, rechts
  // Einstellungen. Zu „Euer Haushalt“ führt die Haushaltszeile. Ab dem zweiten Haushalt wird das Logo später zum Umschalter.
  import { t } from '../i18n';
  import Logo from './Logo.svelte';
  import Symbol from './Symbol.svelte';
</script>

<header class="kopfzeile">
  <!-- Das Logo ist Schmuck und wird nicht vorgelesen. -->
  <span class="breit" aria-hidden="true"><Logo /></span>
  <div class="nav">
    <a class="navb" href="#/einstellungen" aria-label={t('navigation.einstellungen')}
      ><Symbol name="zahnrad" groesse={20} /></a
    >
  </div>
</header>

<style>
  /* W36 (PC88, DP63c Abschnitt 8): Logo und Einstellungen stehen wie im Kopf von „Wohnungen“: 16 px vom Rand,
     12 px von oben, Zeile 52 px. Die Übersicht rückt ihren Inhalt 20 px ein, der Kopf hebt das um 4 px auf. */
  .kopfzeile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 52px;
    margin-inline: calc(var(--space-4) - var(--space-5));
    padding: calc(12px + env(safe-area-inset-top)) 0 4px;
  }

  /* Unter 360 px nur das Zeichen, ohne das Wort (design/stil-c.md, „Enge Bildschirme“). */

  .nav {
    display: flex;
    gap: 4px;
  }

  .navb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: var(--tap-target);
    min-height: var(--tap-target);
    padding: 0;
    border-radius: 22px;
    color: var(--ink);
    font-size: calc(14 * var(--px));
    font-weight: 700;
    text-decoration: none;
  }
</style>

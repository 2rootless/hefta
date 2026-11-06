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
  .kopfzeile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--tap-target);
    padding: calc(40px + env(safe-area-inset-top)) 12px 0 16px;
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
    padding: 0 10px;
    border-radius: 22px;
    color: var(--ink);
    font-size: calc(14 * var(--px));
    font-weight: 700;
    text-decoration: none;
  }
</style>

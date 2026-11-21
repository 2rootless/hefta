<script lang="ts">
  // Sichtbare Zeile „Letztes Backup vor X Tagen“ (docs/07-speicher-backup-sicherheit.md).
  import { daten } from '../app/daten.svelte';
  import { tageSeit } from '../domain/zeit';
  import { t } from '../i18n';
  import { backupWort } from './backupWort';

  const text = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt) return t('backupZeile.nie');
    const tage = tageSeit(zuletzt);
    return backupWort(
      tage === 0 ? t('backupZeile.heute') : t('backupZeile.tage', { anzahl: tage }),
      daten.einstellungen,
    );
  });
</script>

<span class="zeile">{text}</span>

<style>
  .zeile {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
  }
</style>

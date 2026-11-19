<script lang="ts">
  import { backupZeichen } from './backupZeichen';

  // DP88: 48 pt über dem Titel der Seiten zum Backup. Schmuck, wird nicht vorgelesen.
  let { mitPasswort }: { mitPasswort: boolean } = $props();
</script>

<img
  class="backup-zeichen"
  src={backupZeichen(mitPasswort)}
  alt=""
  aria-hidden="true"
  width="48"
  height="48"
  data-mit-passwort={mitPasswort}
/>

<style>
  .backup-zeichen {
    display: block;
    width: 48px;
    height: 48px;
    margin-bottom: var(--space-3, 12px);
  }
</style>

<script lang="ts" module>
  /** Was nach dem Übernehmen gesagt wird (DP148, Schritt 5; DP150 C2). */
  export interface Uebernommen {
    /** Neue Personen im Haushalt, als Liste („Selin und Hiltrud“). */
    neu: string;
    neuAnzahl: number;
    /** Zusammengeführt mit einer gleichnamigen Person („Ja, Angaben übernehmen“). */
    zusammen: string[];
    ansprech: string | null;
    /** Die Anrede des Haushalts danach. */
    anrede: 'ihr' | 'du';
  }
</script>

<script lang="ts">
  // Der Satz nach dem Übernehmen, für Selbstauskünfte und Bürgschaft gleich.
  import { t } from '../i18n';

  let { r }: { r: Uebernommen } = $props();
</script>

<div class="kasten erledigt" role="status">
  <p>
    {#if r.neuAnzahl}{t(
        r.anrede === 'du' ? 'ohneHaushalt.gehoertDein' : 'ohneHaushalt.gehoertEuer',
        {
          namen: r.neu,
          anzahl: r.neuAnzahl,
        },
      )}{/if}
    {#each r.zusammen as name (name)}
      {t('ohneHaushalt.zusammen', { name })}
    {/each}
    {#if r.ansprech}{t('ohneHaushalt.ansprech', { name: r.ansprech })}{/if}
  </p>
  <a class="textlink" href="#/haushalt">{t('ohneHaushalt.zumHaushalt')}</a>
</div>

<style>
  .erledigt {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    padding: 16px;
  }

  .erledigt p {
    margin: 0;
  }
</style>

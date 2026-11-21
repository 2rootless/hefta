<script lang="ts">
  // „Haushalt löschen“ (E96) als Blatt, nur nach der Frage: aus dem Haushalt und aus den Einstellungen
  // (DP50 Punkt 10, Reiter „Mappe“). Hefte bleiben und gelten wieder als ohne Haushalt; die Startseite der
  // Mappe fragt danach einmal, ob sie auch weg sollen.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { nachLoeschen } from '../app/haushaltGeloescht.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { t } from '../i18n';
  import { haushaltLoeschen } from '../storage/speicher';
  import Sheet from './Sheet.svelte';

  let {
    offen = $bindable(false),
    allein,
    vorher,
  }: {
    offen?: boolean;
    /** Nur eine Person im Vertrag: „Deine Hefte …“. */
    allein: boolean;
    /** Läuft vor dem Löschen, etwa damit der Haushalt nicht selbst zur Einrichtung springt. */
    vorher?: () => void;
  } = $props();

  async function weg() {
    const hh = daten.ansicht?.haushalt;
    if (!hh) return;
    // Vor dem Löschen festhalten: Danach gibt es den Haushalt nicht mehr, und `allein` rechnet neu.
    const du = allein;
    vorher?.();
    await haushaltLoeschen(await db(), hh.id);
    offen = false;
    await neuLaden();
    nachLoeschen.du = du;
    nachLoeschen.offen = daten.hefte.length > 0;
    abschliessen('/mappe-start');
  }
</script>

<Sheet bind:offen titel={t('einrichtung.haushalt.haushaltLoeschenFrage')}>
  <p class="blatt-satz">
    {allein
      ? t('einrichtung.haushalt.haushaltLoeschenSatzDu')
      : t('einrichtung.haushalt.haushaltLoeschenSatz')}
  </p>
  <button class="blatt-weg" type="button" onclick={weg}
    >{t('einrichtung.haushalt.haushaltLoeschen')}</button
  >
  <button class="blatt-abbrechen" type="button" onclick={() => (offen = false)}
    >{t('einrichtung.haushalt.abbrechen')}</button
  >
</Sheet>

<style>
  .blatt-satz {
    margin: 0 0 20px;
    color: var(--ink-muted);
  }

  .blatt-weg {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 54px;
    padding: 0 20px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 700;
  }

  .blatt-abbrechen {
    display: block;
    width: 100%;
    min-height: var(--tap-target);
    margin-top: 8px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
  }
</style>

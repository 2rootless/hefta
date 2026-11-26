<script lang="ts">
  // PC213/PC214: eine Person ohne Haushalt anlegen, mit demselben Formular wie im Haushalt (PersonFormular): Name,
  // Rufname, Lebenslage und weitere Lagen. Danach öffnet sich ihre Selbstauskunft (oder Bürgschaft). Die Rolle wählt
  // man erst beim Übernehmen (E-Rolle, CP129); wer über `#/buergschaft` kommt, bürgt.
  import { db, neuLaden } from '../app/daten.svelte';
  import type { Rolle } from '../domain/modell';
  import { lateinFehlt, nameMappeAus } from '../domain/namen';
  import { t } from '../i18n';
  import { ohneHaushaltAnlegen } from '../storage/ohneHaushalt';
  import { lagenAngaben } from './lagen';
  import PersonFormular, { type PersonEingabe } from './PersonFormular.svelte';

  let {
    rolle = 'vertrag',
    knopf,
    fertig,
  }: { rolle?: Rolle; knopf: string; fertig: (personId: string) => void } = $props();

  let werte = $state<PersonEingabe>({
    vorname: '',
    nachname: '',
    rufname: '',
    bezeichnung: 'neutral',
    lebenssituation: 'angestellt',
  });
  let laeuft = false;
  let fehler = $state('');
  const id = $props.id();
  // Wie beim Anlegen im Haushalt; dazu der Nachname, denn die Selbstauskunft braucht ihn (DP148).
  const grund = $derived(
    !werte.vorname.trim() || !werte.nachname.trim()
      ? t('ohneHaushalt.fehltName')
      : lateinFehlt(werte)
        ? t('personSeite.grundLatein')
        : '',
  );

  async function anlegen(e: SubmitEvent) {
    e.preventDefault();
    if (grund || laeuft) return;
    laeuft = true;
    fehler = '';
    try {
      const personId = await ohneHaushaltAnlegen(await db(), {
        vorname: werte.vorname.trim(),
        nachname: werte.nachname.trim(),
        rufname: werte.rufname.trim(),
        nameMappe: nameMappeAus(werte),
        lebenssituation: werte.lebenssituation,
        ausbildungArt: werte.ausbildungArt ?? null,
        ...lagenAngaben(werte),
        rolle,
      });
      await neuLaden();
      fertig(personId);
    } catch (e) {
      // PC213: Kein Speicher frei: nichts ist angelegt, und die Seite sagt es.
      fehler =
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? t('ohneHaushalt.fehlerPlatz')
          : t('hochladen.fehler.unbekannt');
    } finally {
      laeuft = false;
    }
  }
</script>

<form class="anlegen" onsubmit={anlegen} novalidate>
  <PersonFormular bind:werte {rolle} teil="person" fokus={false} du />
  <!-- E10: Ein gesperrter Knopf sagt immer, was fehlt. -->
  {#if grund}<p class="grund" id="{id}-grund">{grund}</p>{/if}
  {#if fehler}<p class="grund" role="alert">{fehler}</p>{/if}
  <button
    type="submit"
    class="haupt"
    aria-disabled={!!grund}
    aria-describedby={grund ? `${id}-grund` : undefined}>{knopf}</button
  >
</form>

<style>
  .anlegen {
    display: grid;
    gap: 4px;
  }

  .grund {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .haupt {
    justify-self: start;
    min-height: 44px;
    margin-top: 12px;
    padding: 0 20px;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: var(--surface);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .haupt[aria-disabled='true'] {
    opacity: 0.55;
  }
</style>

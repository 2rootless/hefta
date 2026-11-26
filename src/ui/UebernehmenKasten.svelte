<script lang="ts">
  // PC213/PC214, DP148: „In einen Haushalt übernehmen“. Alle Personen ohne Haushalt gehen zusammen (E-Auswahl), in
  // einen neuen oder bestehenden Haushalt. Je Person die Rolle ohne Vorauswahl (W54); wer bürgt, bürgt. Heißt im Haushalt
  // schon jemand so, fragt der Kasten, ob es dieselbe Person ist. Was der Haushalt schon beantwortet hat, bleibt
  // (E-Vorrang); der Kasten sagt es vorher. Verschoben wird, nicht kopiert (DP148, PC214).
  import { db, neuLaden } from '../app/daten.svelte';
  import type { Id } from '../domain/modell';
  import { t } from '../i18n';
  import {
    gleicherName,
    haushalteZurWahl,
    ohneHaushaltUebernehmen,
    vorrang,
    type HaushaltZurWahl,
    type Wahl,
  } from '../storage/ohneHaushalt';
  import { einstellungenAendern, type HaushaltAnsicht } from '../storage/speicher';

  let {
    ohne,
    fertig,
  }: {
    /** Kann nach dem Übernehmen kurz null sein, bevor die Seite neu zeichnet. */
    ohne: HaushaltAnsicht | null;
    fertig: (r: { namen: string; anzahl: number; ansprech: string | null }) => void;
  } = $props();

  const id = $props.id();
  /** Gibt es das Wechseln zwischen Haushalten? Bis dahin kein zweiter Haushalt aus dem Übernehmen. */
  const WECHSELN = false;
  const mitglieder = $derived(ohne?.mitglieder ?? []);
  const liste = (namen: string[]) =>
    new Intl.ListFormat('de', { type: 'conjunction' }).format(namen);
  const rufname = (p: { rufname: string; vorname: string }) => p.rufname || p.vorname;

  let offen = $state(false);
  let haushalte = $state<HaushaltZurWahl[]>([]);
  /** Die Wahl des Ziels: eine Haushalt-ID oder „neu“; leer, bis man wählt (keine Vorauswahl). */
  let ziel = $state<Id | 'neu' | ''>('');
  let rollen = $state<Record<Id, Wahl['fach'] | ''>>({});
  let gleich = $state<Record<Id, 'ja' | 'nein' | ''>>({});
  let laeuft = $state(false);
  let fehler = $state('');

  async function oeffnen() {
    haushalte = await haushalteZurWahl(await db());
    ziel = haushalte.length ? '' : 'neu';
    rollen = Object.fromEntries(
      mitglieder.map((m) => [m.person.id, m.zugehoerigkeit.rolle === 'buerge' ? 'buerge' : '']),
    );
    gleich = {};
    offen = true;
  }

  const zielHaushalt = $derived(haushalte.find((h) => h.id === ziel) ?? null);
  /** Je Person die gleichnamige im gewählten Haushalt. */
  const doppelt = $derived(
    Object.fromEntries(
      mitglieder.map((m) => [
        m.person.id,
        zielHaushalt ? gleicherName(m.person, zielHaushalt.personen) : null,
      ]),
    ) as Record<Id, Id | null>,
  );
  const bleibt = $derived(
    zielHaushalt && ohne ? vorrang(zielHaushalt.haushalt, ohne.haushalt) : [],
  );
  const VORRANG = { haustiere: 'vorrangHaustiere', ort: 'vorrangOrt', wbs: 'vorrangWbs' } as const;

  const grund = $derived.by(() => {
    if (!ziel) return t('ohneHaushalt.fehltHaushalt');
    for (const m of mitglieder) {
      if (doppelt[m.person.id] && !gleich[m.person.id]) return t('ohneHaushalt.fehltGleich');
      if (gleich[m.person.id] === 'ja') continue;
      if (!rollen[m.person.id]) return t('ohneHaushalt.fehltRolle', { name: rufname(m.person) });
    }
    return '';
  });

  async function uebernehmen() {
    if (grund || laeuft) return;
    laeuft = true;
    fehler = '';
    try {
      const wahl: Record<Id, Wahl> = {};
      for (const m of mitglieder) {
        const d = doppelt[m.person.id];
        wahl[m.person.id] = {
          fach: (rollen[m.person.id] || 'vertrag') as Wahl['fach'],
          ...(d && gleich[m.person.id] === 'ja' ? { dieselbe: d } : {}),
        };
      }
      const verbindung = await db();
      const namen = mitglieder.map((m) => rufname(m.person));
      const ansprechName = (personId: Id | null) =>
        mitglieder.find((m) => m.person.id === personId)?.person;
      const r = await ohneHaushaltUebernehmen(
        verbindung,
        ziel === 'neu' ? { art: 'neu' } : { art: 'bestehend', haushaltId: ziel },
        wahl,
      );
      if (!r) {
        // Schon übernommen (zweites Fenster, doppelter Tipp): nichts mehr da.
        await neuLaden();
        return;
      }
      await einstellungenAendern(verbindung, { aktiverHaushalt: r.haushaltId });
      await neuLaden();
      const a = ansprechName(r.ansprech);
      fertig({ namen: liste(namen), anzahl: namen.length, ansprech: a ? rufname(a) : null });
    } catch (e) {
      // Eine Transaktion: Schlägt sie fehl, ist nichts übernommen.
      fehler =
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? t('ohneHaushalt.fehlerPlatzUebernehmen')
          : t('hochladen.fehler.unbekannt');
    } finally {
      laeuft = false;
    }
  }
</script>

{#if !offen}
  <button type="button" class="zweit" onclick={oeffnen}>{t('ohneHaushalt.uebernehmen')}</button>
{:else}
  <div class="kasten" role="group" aria-labelledby="{id}-titel">
    <b id="{id}-titel">{t('ohneHaushalt.uebernehmen')}</b>
    {#if haushalte.length}
      <fieldset>
        <legend>{t('ohneHaushalt.welcher')}</legend>
        {#each haushalte as h (h.id)}
          <label class="wahl">
            <input type="radio" name="{id}-ziel" value={h.id} bind:group={ziel} />
            <span>{liste(h.namen)}</span>
          </label>
        {/each}
        <!-- CP130 [E-Neu]: Die App kann heute nicht zwischen Haushalten wechseln. Ein zweiter Haushalt verdeckte den
             bisherigen; darum gibt es „Neuer Haushalt“ erst, wenn Wechseln da ist (Frage an Design und Planung). -->
        {#if WECHSELN}
          <label class="wahl">
            <input type="radio" name="{id}-ziel" value="neu" bind:group={ziel} />
            <span>{t('ohneHaushalt.neuerHaushalt')}</span>
          </label>
        {/if}
      </fieldset>
    {/if}
    {#each mitglieder as m (m.person.id)}
      {@const name = rufname(m.person)}
      {#if doppelt[m.person.id]}
        <fieldset>
          <legend>{t('ohneHaushalt.gleicherName', { name })}</legend>
          <label class="wahl">
            <input
              type="radio"
              name="{id}-gleich-{m.person.id}"
              value="ja"
              bind:group={gleich[m.person.id]}
            />
            <span>{t('ohneHaushalt.dieselbe')}</span>
          </label>
          <label class="wahl">
            <input
              type="radio"
              name="{id}-gleich-{m.person.id}"
              value="nein"
              bind:group={gleich[m.person.id]}
            />
            <span>{t('ohneHaushalt.neuePerson')}</span>
          </label>
        </fieldset>
      {/if}
      {#if gleich[m.person.id] !== 'ja'}
        {#if m.zugehoerigkeit.rolle === 'buerge'}
          <p class="satz">{t('ohneHaushalt.buergt', { name })}</p>
        {:else}
          <fieldset>
            <legend>{t('ohneHaushalt.rolleFrage', { name })}</legend>
            {#each [['vertrag', 'rolleVertrag'], ['nurmit', 'rolleMit'], ['buerge', 'rolleBuergt']] as const as [wert, text] (wert)}
              <label class="wahl">
                <input
                  type="radio"
                  name="{id}-rolle-{m.person.id}"
                  value={wert}
                  bind:group={rollen[m.person.id]}
                />
                <span>{t(`ohneHaushalt.${text}`)}</span>
              </label>
            {/each}
          </fieldset>
        {/if}
      {/if}
    {/each}
    {#if bleibt.length}
      <p class="satz">
        {t('ohneHaushalt.vorrang', {
          liste: liste(bleibt.map((b) => t(`ohneHaushalt.${VORRANG[b]}`))),
        })}
      </p>
    {/if}
    {#if grund}<p class="grund" id="{id}-grund">{grund}</p>{/if}
    {#if fehler}<p class="grund" role="alert">{fehler}</p>{/if}
    <div class="knoepfe">
      <button
        type="button"
        class="haupt"
        aria-disabled={!!grund || laeuft}
        aria-describedby={grund ? `${id}-grund` : undefined}
        onclick={uebernehmen}>{t('ohneHaushalt.los')}</button
      >
      <button type="button" class="leise" onclick={() => (offen = false)}
        >{t('allgemein.abbrechen')}</button
      >
    </div>
  </div>
{/if}

<style>
  .kasten {
    display: grid;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius-card, 14px);
    background: var(--surface);
  }

  fieldset {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 4px;
    padding: 0;
    font-weight: 700;
  }

  .wahl {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    cursor: pointer;
  }

  .wahl input {
    width: 22px;
    height: 22px;
    margin: 0;
    accent-color: var(--ink);
  }

  .satz,
  .grund {
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .knoepfe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
  }

  .haupt,
  .zweit {
    min-height: 44px;
    padding: 0 20px;
    border-radius: 999px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .haupt {
    border: 0;
    background: var(--ink);
    color: var(--surface);
  }

  .haupt[aria-disabled='true'] {
    opacity: 0.55;
  }

  .zweit {
    border: 1px solid var(--ink-quiet);
    background: none;
    color: var(--ink);
  }

  .leise {
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
</style>

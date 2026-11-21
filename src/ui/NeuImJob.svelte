<script lang="ts">
  // DP45 G3: „Seit wann bist du dort?“ auf der Seite „Gehaltsnachweise“. „Seit Kurzem“ mit dem Tag des
  // Anfangs: Abrechnungen zählen erst ab diesem Monat, dazu kommt der Arbeitsvertrag (oder eine Bestätigung
  // des Arbeitgebers). Liegt der Anfang mehr als drei Monate zurück, schlägt Hefta „Länger als drei
  // Monate“ vor (G3c). Der Anfang ist eine eigene Angabe der Person, kein Datum aus einem Dokument.
  import { db, neuLaden } from '../app/daten.svelte';
  import { tagAus } from '../domain/fristen';
  import { neuImJobLange, type UnterlagenStand } from '../domain/regelkatalog';
  import type { Person } from '../domain/modell';
  import { t, tagText } from '../i18n';
  import { anrede } from '../i18n/anrede.svelte';
  import { personAendern } from '../storage/speicher';
  import Notiz from './Notiz.svelte';
  import Symbol from './Symbol.svelte';

  let { person, stand }: { person: Person; stand: UnterlagenStand } = $props();

  const name = $derived(person.rufname || person.vorname);
  const neu = $derived(!!person.neuImJob);
  const seit = $derived(person.neuImJob?.seit ?? '');
  const lange = $derived(neuImJobLange(person, new Date()));
  const vertrag = $derived(stand.zusatz ?? null);

  async function setzen(wert: Person['neuImJob']) {
    await personAendern(await db(), person.id, { neuImJob: wert });
    await neuLaden();
  }
</script>

<section class="neu-im-job">
  <h2 class="etikett">
    {anrede.wert === 'du' ? t('neuImJob.frageDu') : t('neuImJob.frageName', { name })}
  </h2>
  <div class="karte karte-weich">
    <div class="pillen">
      <button type="button" class="pille" aria-pressed={!neu} onclick={() => void setzen(null)}
        >{t('neuImJob.laenger')}</button
      >
      <button
        type="button"
        class="pille"
        aria-pressed={neu}
        onclick={() => {
          if (!neu) void setzen({ seit: null });
        }}>{t('neuImJob.kurz')}</button
      >
    </div>
    {#if neu}
      <label class="eingabe">
        {t('neuImJob.angefangen')}
        <input
          type="date"
          value={seit}
          max={tagAus(new Date())}
          data-feld="neu-seit"
          onchange={(e) => void setzen({ seit: e.currentTarget.value || null })}
        />
      </label>
      <p class="cap">{t('neuImJob.davor')}</p>
      {#if lange}
        <Notiz>
          <p>{t('neuImJob.vorschlag')}</p>
          <button type="button" class="textlink" onclick={() => void setzen(null)}
            >{t('neuImJob.umstellen')}</button
          >
        </Notiz>
      {/if}
    {/if}
  </div>

  <!-- Ohne „Neu im Job“ steht der Vertrag nur da, wenn er schon hochgeladen ist (freiwillig, G4). -->
  {#if vertrag && (neu || vertrag.versionen.length)}
    <h2 class="etikett">{t('neuImJob.inMappe')}</h2>
    <ul class="karte gruppe">
      <li>
        <a class="zeile" href="#/unterlage/{person.id}/arbeitsvertrag">
          <span class="zeichen"
            ><Symbol
              name={vertrag.versionen.length ? 'arbeitsvertrag' : 'plus'}
              groesse={20}
            /></span
          >
          <span class="tx">
            <b>{t('neuImJob.vertrag')}</b>
            <small>{t('neuImJob.vertragUnter')}</small>
            <small class="stand"
              >{vertrag.versionen.length
                ? t('neuImJob.vertragDa')
                : t('neuImJob.vertragFehlt')}</small
            >
          </span>
          <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
        </a>
      </li>
    </ul>
    {#if seit}
      <p class="cap draussen">{t('neuImJob.mappeSatz', { datum: tagText(seit) })}</p>
    {/if}
  {/if}
</section>

<style>
  .neu-im-job {
    margin: 24px 16px 0;
  }

  .etikett {
    margin: 0 4px 8px;
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  .karte + .etikett {
    margin-top: 24px;
  }

  .karte {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 16px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .gruppe {
    padding: 0 16px;
    list-style: none;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 12px 0;
    color: var(--ink);
    text-decoration: none;
  }

  .zeichen,
  .pfeil {
    display: flex;
    flex: none;
  }

  .pfeil {
    margin-left: auto;
    color: var(--ink-quiet);
  }

  .tx {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .tx b {
    font-weight: 600;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .tx .stand {
    color: var(--ink);
  }

  .cap {
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .draussen {
    margin: 8px 4px 0;
  }
  /* DP45 „pills2“: Pillen zur Auswahl, 44 px hoch, Radius 22, dürfen bei 320 px mit 130 % zweizeilig
     werden (anders als die einzeiligen Chips, C18). Gewählt in Tinte. */
  .pillen {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pille {
    min-height: var(--tap-target);
    padding: 8px 16px;
    border: 0;
    border-radius: 22px;
    background: var(--weich);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 600;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
  }

  .pille[aria-pressed='true'] {
    background: var(--action);
    color: var(--on-action);
  }
</style>

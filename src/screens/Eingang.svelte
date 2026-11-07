<script lang="ts">
  // Nur in der App: Eine andere App hat PDFs an Hefta geschickt („Teilen“, „Öffnen in“). Man wählt,
  // wofür sie sind, danach geht es weiter wie beim Hochladen.
  import { daten, gehe } from '../app/daten.svelte';
  import { eingang } from '../app/eingang.svelte';
  import type { PersonStand, UnterlagenStand } from '../domain/regelkatalog';
  import { listenText } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import UploadFormular from '../ui/UploadFormular.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { staendeAus } from '../ui/mappeDaten';
  import { standText } from '../ui/texte';

  const staende = $derived(daten.ansicht ? staendeAus(daten.ansicht) : []);
  let gewaehlt = $state<{ stand: PersonStand; unterlage: UnterlagenStand } | null>(null);
  let fehler = $state('');

  const offenZuerst = (s: PersonStand) =>
    s.unterlagen
      .filter((u) => !u.typ.inAppErstellt)
      .sort((a, b) => Number(istOffen(b)) - Number(istOffen(a)));
  const istOffen = (u: UnterlagenStand) => u.status === 'fehlt' || u.status === 'bald';

  function fertig(ziel: string) {
    eingang.dateien = [];
    gehe(ziel);
  }
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck href="#/" text={t('navigation.uebersicht')} />
  </div>
  {#if !gewaehlt}
    <div class="titelblock">
      <h1 class="display frage">{t('eingang.titel')}</h1>
      <p class="lead">
        {eingang.dateien.length === 1
          ? eingang.dateien[0]!.name
          : t('eingang.mehrere', { anzahl: eingang.dateien.length })}
      </p>
    </div>
    {#if fehler}<div class="block"><Notiz stark><p role="alert">{fehler}</p></Notiz></div>{/if}
    {#if !eingang.dateien.length}
      <p class="block lead">{t('eingang.leer')}</p>
    {:else if !staende.length}
      <p class="block lead">{t('eingang.keinHaushalt')}</p>
    {:else}
      {#each staende as s (s.person.id)}
        <section class="block">
          <h2 class="farbe-{s.farbe}">{s.person.rufname || s.person.vorname}</h2>
          <ul>
            {#each offenZuerst(s) as u (u.typ.id)}
              <li>
                <button
                  type="button"
                  onclick={() => {
                    fehler = '';
                    gewaehlt = { stand: s, unterlage: u };
                  }}
                >
                  <span class="tx"><b>{listenText(u.typ)}</b><small>{standText(u)}</small></span>
                  <Symbol name="weiter" groesse={16} />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
  {:else}
    <div class="titelblock">
      <p class="fuer">{t('rutsch.fuer', { name: gewaehlt.stand.person.vorname })}</p>
      <h1 class="unterlage">{gewaehlt.unterlage.typ.text}</h1>
    </div>
    <div class="block">
      <UploadFormular
        person={gewaehlt.stand.person}
        typ={gewaehlt.unterlage.typ}
        start={eingang.dateien}
        knopfText={t('hochladen.speichern')}
        fixiert
        onfertig={() => fertig(`/person/${gewaehlt?.stand.person.id}`)}
        onleer={(f: string) => {
          fehler = f;
          gewaehlt = null;
        }}
        abbrechen={{ text: t('allgemein.abbrechen'), onclick: () => (gewaehlt = null) }}
      />
    </div>
  {/if}
</main>
{#if !gewaehlt && !staende.length}
  <Aktionsleiste text={t('eingang.einrichten')} onclick={() => fertig('/einrichtung')} />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0 calc(160px + env(safe-area-inset-bottom));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .lead {
    overflow-wrap: anywhere;
  }

  .block {
    margin: 18px var(--space-4) 0;
  }

  h2 {
    display: inline-block;
    margin: 0 0 8px;
    padding: 4px 14px;
    border-radius: var(--radius-full);
    background: var(--farbe);
    color: var(--on-person);
    font-size: 16px;
    line-height: 22px;
    font-weight: 800;
  }

  .farbe-1 {
    --farbe: var(--person-1);
  }
  .farbe-2 {
    --farbe: var(--person-2);
  }
  .farbe-3 {
    --farbe: var(--person-3);
  }
  .farbe-4 {
    --farbe: var(--person-4);
  }

  ul {
    margin: 0;
    padding: 4px 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  li + li {
    border-top: 1px solid var(--track);
  }

  li button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 8px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: 16px;
    line-height: 22px;
  }

  .tx small {
    font-size: 13px;
    line-height: 18px;
    color: var(--ink-muted);
  }

  .fuer {
    margin: 10px 0 0;
    font-size: 14px;
    font-weight: 500;
  }

  .unterlage {
    margin: 2px 0 0;
    font-size: 26px;
    line-height: 30px;
    font-weight: 800;
    font-stretch: 112%;
    letter-spacing: -0.6px;
    hyphens: manual;
    overflow-wrap: anywhere;
  }
</style>

<script lang="ts">
  // Unterlage hinzufügen (docs/08-design.md, Bildschirm 4; docs/05-dokument-pipeline.md).
  // Erst ein kleines Menü „PDF auswählen“ (Entscheidung A), dann das Blatt wie im Entwurf.
  // Wird nur bei Bedarf geladen, weil es PDF.js braucht.
  import { db, neuLaden } from '../app/daten.svelte';
  import { nochNicht } from '../domain/fristen';
  import type { Person } from '../domain/modell';
  import { eintragenText, type UnterlagenStand } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import { dokumentAendern } from '../storage/speicher';
  import Sheet from './Sheet.svelte';
  import Notiz from './Notiz.svelte';
  import Symbol from './Symbol.svelte';
  import UploadFormular from './UploadFormular.svelte';

  let {
    offen = $bindable(false),
    person,
    farbe = 1,
    stand,
  }: { offen: boolean; person: Person; farbe?: number; stand: UnterlagenStand } = $props();

  const typ = $derived(stand.typ);
  let gewaehlt = $state<File[] | null>(null);
  let fehler = $state('');

  $effect(() => {
    if (!offen) {
      gewaehlt = null;
      fehler = '';
    }
  });

  async function spaeter() {
    const verbindung = await db();
    await dokumentAendern(
      verbindung,
      person.id,
      typ.id,
      typ.serie?.anzahl ?? null,
      nochNicht(stand.dokument ?? {}, new Date()),
    );
    await neuLaden();
    offen = false;
  }
</script>

<Sheet bind:offen titel={eintragenText(typ)}>
  {#snippet kopf()}
    <p class="fuer">
      <span class="punkt farbe-{farbe}" aria-hidden="true"></span>{t('hochladen.fuer', {
        name: person.vorname,
      })}
    </p>
  {/snippet}

  {#if !gewaehlt}
    <label class="waehlen">
      <Symbol name="plus" groesse={16} />
      {t('hochladen.menue.waehlen')}
      <input
        class="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        data-feld="pdf"
        onchange={(e) => {
          fehler = '';
          gewaehlt = [...(e.currentTarget.files ?? [])];
        }}
      />
    </label>
    <p class="hinweis">{t('hochladen.menue.hinweis')}</p>
    <p class="hinweis">{t('hochladen.menue.papier')}</p>
    {#if fehler}<Notiz stark><p role="alert">{fehler}</p></Notiz>{/if}
    {#if stand.status === 'bald'}
      <button type="button" class="textlink" onclick={spaeter}
        >{t('hochladen.menue.nochNicht')}</button
      >
    {/if}
    <button type="button" class="textlink" onclick={() => (offen = false)}
      >{t('allgemein.abbrechen')}</button
    >
  {:else}
    <UploadFormular
      {person}
      {typ}
      start={gewaehlt}
      vorbelegterMonat={typ.serie && stand.status === 'fehlt' ? stand.naechsterMonat : null}
      knopfText={t('hochladen.speichern')}
      onfertig={() => {
        offen = false;
      }}
      onleer={(f) => {
        fehler = f;
        gewaehlt = null;
      }}
      abbrechen={{ text: t('allgemein.abbrechen'), onclick: () => (offen = false) }}
    />
  {/if}
</Sheet>

<style>
  .fuer {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .punkt {
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--on-person-muted);
    border-radius: 50%;
  }

  .farbe-1 {
    background: var(--person-1);
  }
  .farbe-2 {
    background: var(--person-2);
  }
  .farbe-3 {
    background: var(--person-3);
  }
  .farbe-4 {
    background: var(--person-4);
  }

  .farbe-5 {
    background: var(--person-5);
  }

  .farbe-6 {
    background: var(--person-6);
  }

  .waehlen {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-card);
    background: var(--surface);
    font-size: calc(17 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  .waehlen:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .hinweis {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }
</style>

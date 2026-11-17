<script lang="ts">
  import { anrede } from '../i18n/anrede.svelte';
  // „Warum?“-Blatt (design/unterlage-warum-haushalt.md, WB1 bis WB3): drei feste Abschnitte, Quelle
  // und Stand unten, keine Preise. Die Texte stehen im Regelkatalog.
  import { warumInhalt, type Dokumenttyp } from '../domain/regelkatalog';
  import { t, tagText } from '../i18n';
  import Hauptbutton from './Hauptbutton.svelte';
  import Sheet from './Sheet.svelte';
  import Symbol from './Symbol.svelte';

  let {
    offen = $bindable(false),
    typ,
    zurueck = null,
  }: {
    offen: boolean;
    typ: Dokumenttyp;
    /** Hier steht der Fokus nach dem Schließen; Safari merkt sich den Knopf nicht von selbst. */
    zurueck?: HTMLElement | null;
  } = $props();

  const inhalt = $derived(warumInhalt(typ, anrede.wert));

  let warOffen = false;
  $effect(() => {
    if (warOffen && !offen) zurueck?.focus();
    warOffen = offen;
  });
</script>

{#if inhalt}
  <Sheet bind:offen titel={inhalt.titel} kreuz titelFokus>
    <span class="etikett">{inhalt.etikett}</span>
    <section>
      <h3>{t('warum.abWann')}</h3>
      <p>{inhalt.erlaubt}</p>
      {#if inhalt.schritte.length}
        <ul class="marken">
          {#each inhalt.schritte as s (s.id)}
            <li class:an={s.erlaubt}>
              {#if s.erlaubt}<Symbol name="haken" groesse={16} />{/if}{s.text}<span
                class="visually-hidden"
                >{s.erlaubt ? t('warum.schrittJa') : t('warum.schrittNein')}</span
              >
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    <section>
      <h3>{t('warum.ueblich')}</h3>
      <p>{inhalt.ueblich}</p>
    </section>
    <section>
      <h3>{t('warum.gutZuWissen')}</h3>
      {#each inhalt.gutZuWissen as satz, i (i)}
        <p>{satz}</p>
        <!-- PC81 B12: Trägt die Orientierungshilfe den Satz nicht, steht seine eigene Quelle darunter. -->
        {#if inhalt.gutZuWissenQuellen[i]}
          <p class="quelle satz-quelle">{t('warum.quelle')} {inhalt.gutZuWissenQuellen[i]}</p>
        {/if}
      {/each}
    </section>
    <p class="quelle">
      {t('warum.quelle')}
      <a href={inhalt.quelle.url} target="_blank" rel="noopener noreferrer">{inhalt.quelle.titel}</a
      ><br />{t('warum.stand', { datum: tagText(inhalt.stand) })}
    </p>
    <div class="unten">
      <Hauptbutton text={t('warum.verstanden')} onclick={() => (offen = false)} />
    </div>
  </Sheet>
{/if}

<style>
  .etikett {
    justify-self: start;
    margin-top: calc(-1 * var(--space-3));
    /* DP33 A6: 12 px grau auf weicher Fläche, ohne Linie. */
    padding: 1px 8px;
    border-radius: 10px;
    /* Die weiche Fläche steht hier in einer Karte: der Ton der Spur, auf Weiß wie auf dem Grund sichtbar. */
    background: var(--track);
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 650;
  }

  h3 {
    margin: 0 0 4px;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 800;
  }

  section p {
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  section p + p {
    margin-top: 8px;
  }

  .marken {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .marken li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding: 0 12px;
    border: 1.5px solid var(--line);
    border-radius: 16px;
    font-size: calc(13 * var(--px));
    font-weight: 600;
  }

  .marken .an {
    border-color: var(--action);
    background: var(--action);
    color: var(--on-action);
  }

  .quelle {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .satz-quelle {
    margin-top: 2px;
  }

  .quelle a {
    color: var(--ink);
    font-weight: 700;
  }

  .unten {
    position: sticky;
    bottom: 0;
    padding-top: var(--space-2);
    background: var(--ground);
  }
</style>

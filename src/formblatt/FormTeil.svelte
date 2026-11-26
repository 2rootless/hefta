<script lang="ts">
  // Formblatt (DP135, Abschnitt 3; W63): ein Teil in der App, offen als Karte mit Nummer, Titel und Stand, zugeklappt
  // als Zeile mit Zusammenfassung und Pfeil. Selbstauskunft und Bürgschaft nutzen denselben Baustein, damit beide von
  // selbst gleich aussehen (W63, Gegenprobe im Test: ein eigener Teil in nur einem der beiden wird rot).
  import type { Snippet } from 'svelte';
  import { t } from '../i18n';
  import Symbol from '../ui/Symbol.svelte';

  let {
    nummer,
    titel,
    offen,
    fertig,
    kopfId,
    stand = '',
    zusammenfassung,
    oeffnen,
    zusatz,
    children,
  }: {
    nummer: number;
    titel: string;
    offen: boolean;
    /** Zeigt den Haken: offen mit „Fertig“, zugeklappt statt der Nummer. */
    fertig: boolean;
    /** Id der Überschrift; die Karte ist mit ihr benannt. */
    kopfId: string;
    /** Unter dem Titel eines offenen Teils, solange er nicht fertig ist (etwa „2 offen“). */
    stand?: string;
    /** Unter dem Titel eines zugeklappten Teils. */
    zusammenfassung: string;
    oeffnen: () => void;
    /** Weitere Zeilen unter der Zusammenfassung, etwa eine Nachfrage zum Kontakt. */
    zusatz?: Snippet;
    children: Snippet;
  } = $props();
</script>

{#if offen}
  <section class="teil offen" aria-labelledby={kopfId}>
    <h3 id={kopfId}>
      <span class="nummer" aria-hidden="true">{nummer}</span>
      <span class="teilname" class:lang={titel.length > 30}>{titel}</span>
      <small
        >{#if fertig}<Symbol name="haken" groesse={16} />{t(
            'selbstauskunft.fertigMarke',
          )}{:else}{stand}{/if}</small
      >
    </h3>
    {@render children()}
  </section>
{:else}
  <button type="button" class="teil zu" aria-expanded="false" onclick={oeffnen}>
    <span class="nummer" class:fertig aria-hidden="true"
      >{#if fertig}<Symbol name="haken" groesse={16} />{:else}{nummer}{/if}</span
    >
    <span class="tx">
      <b>{titel}</b>
      <small>{zusammenfassung}</small>
      {@render zusatz?.()}
    </span>
    <!-- DP35 R2: kein Wort am Rand; die ganze Zeile öffnet den Schritt, mit Pfeil. -->
    {#if fertig}<span class="visually-hidden">{t('selbstauskunft.aendern')}</span>{/if}
    <span class="pfeil" class:fertig aria-hidden="true"
      ><Symbol name="weiter" groesse={fertig ? 16 : 20} /></span
    >
  </button>
{/if}

<style>
  .teil {
    /* In der weißen Karte der Ton von „Notizen“ (DP33 A4, DP35 G1). */
    --weich: var(--weich-karte);
    border-radius: 20px;
    background: var(--surface);
    container-type: inline-size;
  }

  .offen {
    display: grid;
    gap: var(--space-3);
    padding: 16px;
    /* DP33 A3: Der offene Schritt bleibt Karte, ohne Linie. */
    scroll-margin: 16px 0 120px;
  }

  /* Reicht die Breite nicht, rutscht der Stand rechtsbündig unter den Titel (stil-c.md, C21). */
  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 10px;
    margin: 0;
    font-size: calc(18 * var(--px));
    line-height: calc(23 * var(--px));
    font-weight: 800;
    font-stretch: 100%;
    letter-spacing: 0;
  }

  h3 .teilname {
    flex: 1 1 min(8.5em, calc(100% - 38px));
    min-width: 0;
  }

  /* Lange Titel brauchen mehr: Sonst stünden sie auch bei 430 px in drei Zeilen neben dem Stand. */
  h3 .teilname.lang {
    flex-basis: min(11.5em, calc(100% - 38px));
  }

  /* DP49 und DP50: Die Unterzeile (Satz nach W30 oder „Fertig“) steht unter dem Titel, bündig mit ihm, und
     bricht um. Sie ist seit DP49 ein ganzer Satz; rechtsbündig daneben lief sie bei 320 px über den Rand. */
  h3 small {
    display: inline-flex;
    flex: 1 1 calc(100% - 38px);
    align-items: center;
    gap: 4px;
    min-width: 0;
    margin-left: 38px;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 600;
    color: var(--ink-muted);
    text-align: left;
  }

  .nummer {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--surface);
    font-size: calc(14 * var(--px));
    font-weight: 800;
  }

  .nummer.fertig {
    background: var(--ink);
    color: var(--surface);
  }

  /* Ebenso „Ändern“ unter dem Text (stil-c.md, „Zeilen mit Ändern“). DP50: Nummer und Pfeil stehen an der ersten
     Zeile, nicht mittig (wie Ü2). */
  .zu {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 16px;
    border: 0;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    /* Nummer und Pfeil passen daneben; „Ändern“ rutscht im engsten Fall darunter. */
    flex: 1 1 min(10em, calc(100% - 70px));
    min-width: 0;
  }

  .tx b {
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .pfeil {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    height: 28px;
    transform: rotate(90deg);
  }

  /* DP35 R2: Der Pfeil eines fertigen Schritts ist klein und grau. */
  .pfeil.fertig {
    color: var(--ink-quiet);
  }
</style>

<script lang="ts">
  // DP49b (W33): Der Baustein „Nachfrage“. Fragt Hefta nach einer Angabe, die ungewöhnlich aussieht, steht
  // unter dem Element der Satz mit „?“ im feinen Kreis; das Element selbst trägt dann die Klasse
  // `pruefzustand` (global.css): hell, feiner Rand in Tinte. Alles blendet ruhig über, nichts blitzt, kein Gelb,
  // kein Rot. Die Zeile ist immer da, mit unsichtbarem Text in ihrer Höhe: So rückt nichts, auch nicht bei
  // 320 px mit großer Schrift, wo der Satz zwei Zeilen braucht (W8).
  // Vorgelesen wird der Satz, sobald er erscheint (Live-Bereich); das Feld bekommt ihn über `id` als
  // Beschreibung (aria-describedby).
  import { t } from '../i18n';
  import NachfrageZeichen from './NachfrageZeichen.svelte';

  let {
    aktiv,
    id,
    text = t('nachfrage.satz'),
  }: { aktiv: boolean; id: string; text?: string } = $props();
</script>

<p class="nachfrage" class:an={aktiv} role="status">
  <span class="sichtbar" aria-hidden="true">
    <span class="zeichen"><NachfrageZeichen /></span>
    <span>{text}</span>
  </span>
  {#if aktiv}<span {id} class="visually-hidden">{text}</span>{/if}
</p>

<style>
  .nachfrage {
    margin: 8px 0 0;
    color: var(--ink);
    font-size: calc(14 * var(--px));
    font-weight: 600;
    line-height: calc(20 * var(--px));
  }

  /* Immer da, damit die Zeile ihre Höhe hat; sichtbar nur im Prüfzustand. Der Satz folgt dem Rand 100 ms
     später, in 300 ms (DP49b, Liste für Code 2); zurück ohne Versatz. */
  .sichtbar {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    opacity: 0;
    transition: opacity var(--bw-nachfrage) ease-in-out;
  }

  .an .sichtbar {
    opacity: 1;
    transition-delay: var(--bw-nachfrage-versatz);
  }

  .zeichen {
    display: flex;
    flex: none;
    /* Mittig zur ersten Zeile des Satzes. */
    margin-top: calc((20 * var(--px) - 16px) / 2);
  }
</style>

<script lang="ts">
  // Rückmeldung zum Antippen (E54, B19 Fassung 4 und 5): vier feste Fragen. Ein Tipp wählt die Antwort,
  // das Fenster fragt „Anonym an hefta.de schicken?“, erst „Abschicken“ sendet. Abbrechen nimmt die Wahl
  // zurück. Ohne Netz bleibt die Wahl mit Hinweis stehen, nichts geht im Hintergrund hinaus. Gesendete
  // Antworten merkt sich Hefta nur auf dem Gerät, für „Deine Antwort: …“.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { rueckmeldungLink } from '../app/impressum';
  import { istAndroidApp } from '../app/plattform';
  import { FRAGE_REIHE, FRAGEN, type Antwort, type Frage } from '../rueckmeldung/fragen';
  import { abschicken } from '../rueckmeldung/senden';
  import { einstellungenAendern } from '../storage/speicher';
  import { t, type TextSchluessel } from '../i18n';
  import Sheet from './Sheet.svelte';

  let { fragen = FRAGE_REIHE }: { fragen?: readonly Frage[] } = $props();

  const gesendet = $derived(daten.einstellungen?.rueckmeldung ?? {});
  let aendern = $state<Partial<Record<Frage, boolean>>>({});
  let danke = $state<Partial<Record<Frage, boolean>>>({});
  /** Gewählt, aber ohne Netz nicht angekommen: bleibt mit Hinweis stehen. */
  let aus = $state<Partial<Record<Frage, string>>>({});
  let fenster = $state<{ f: Frage; a: string } | null>(null);
  let offen = $state(false);
  let sendet = $state(false);
  let fensterAus = $state(false);

  // „Android-App“ fragt die Android-App nicht (B19 Fassung 4).
  const antworten = (f: Frage) =>
    (FRAGEN[f] as readonly string[]).filter((a) => !(a === 'android' && istAndroidApp()));

  function waehlen(f: Frage, a: string) {
    fenster = { f, a };
    fensterAus = false;
    offen = true;
  }

  async function senden() {
    if (!fenster || sendet) return;
    const { f, a } = fenster;
    sendet = true;
    const ergebnis = await abschicken(f, a as Antwort);
    sendet = false;
    if (ergebnis === 'aus') {
      fensterAus = true;
      aus = { ...aus, [f]: a };
      return;
    }
    aus = Object.fromEntries(Object.entries(aus).filter(([k]) => k !== f));
    await einstellungenAendern(await db(), { rueckmeldung: { ...gesendet, [f]: a } });
    await neuLaden();
    aendern = { ...aendern, [f]: false };
    danke = { ...danke, [f]: true };
    offen = false;
  }

  /** Fenster zu: Wer abbricht, nimmt die Wahl zurück, außer sie hängt „ohne Netz“ an der Frage. */
  $effect(() => {
    if (!offen && fenster) fenster = null;
  });

  /** Wortlaut einer Antwort; die Schlüssel stehen in src/rueckmeldung/fragen.ts. */
  const antwortText = (f: Frage, a: string) =>
    t(`rueckmeldung.antworten.${f}.${a}` as TextSchluessel);

  // Beim Ändern ist die gesendete Antwort markiert (B19 Fassung 4).
  const gewaehlt = (f: Frage) => (fenster?.f === f ? fenster.a : (aus[f] ?? gesendet[f]));
</script>

<div class="rueckmeldung">
  {#each fragen as f (f)}
    {@const zeigtAntwort = !!gesendet[f] && !aendern[f] && !aus[f] && fenster?.f !== f}
    <div class="frage" data-frage={f}>
      <b class="f" id="rm-{f}">{t(`rueckmeldung.fragen.${f}`)}</b>
      {#if zeigtAntwort}
        <p class="antwort">
          <span>{t('rueckmeldung.deine')} <b>{antwortText(f, gesendet[f]!)}</b></span>
          <button
            type="button"
            class="textlink"
            onclick={() => (aendern = { ...aendern, [f]: true })}
            >{t('rueckmeldung.aendern')}</button
          >
        </p>
      {:else}
        <div class="chips" role="group" aria-labelledby="rm-{f}">
          {#each antworten(f) as a (a)}
            <button
              type="button"
              class="chip"
              aria-pressed={gewaehlt(f) === a}
              onclick={() => waehlen(f, a)}>{antwortText(f, a)}</button
            >
          {/each}
          {#if f === 'fehlt'}
            <a class="chip mail" href={rueckmeldungLink(t('rueckmeldung.betreffAnderes'))}
              >{t('rueckmeldung.etwasAnderes')}</a
            >
          {/if}
        </div>
      {/if}
      {#if aus[f] && fenster?.f !== f}
        <p class="status leise" role="status">{t('rueckmeldung.aus')}</p>
      {:else if danke[f] && zeigtAntwort}
        <p class="status" role="status">{t('rueckmeldung.danke')}</p>
      {/if}
    </div>
  {/each}
  <p class="satz">{t('rueckmeldung.satz')}</p>
</div>

<Sheet bind:offen titel={t('rueckmeldung.fensterTitel')}>
  {#if fenster}
    <p class="fenster-satz">{t('rueckmeldung.fensterSatz')}</p>
    <div class="was">
      <small>{t(`rueckmeldung.fragen.${fenster.f}`)}</small>
      <b>{antwortText(fenster.f, fenster.a)}</b>
    </div>
    {#if fensterAus}<p class="status leise" role="status">{t('rueckmeldung.aus')}</p>{/if}
    <div class="knoepfe">
      <!-- svelte-ignore a11y_autofocus -->
      <button type="button" class="haupt" autofocus disabled={sendet} onclick={senden}
        >{t('rueckmeldung.abschicken')}</button
      >
      <button type="button" class="neben" onclick={() => (offen = false)}
        >{t('rueckmeldung.abbrechen')}</button
      >
    </div>
  {/if}
</Sheet>

<style>
  .rueckmeldung {
    display: grid;
    gap: 18px;
    padding: 14px 16px 16px;
  }

  .frage {
    display: grid;
    gap: 10px;
  }

  .f {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Lange Antworten brechen auf zwei Zeilen um, darum stark gerundet statt ganz rund (B19, 22 px). */
  .chip {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-height: var(--tap-target);
    padding: 8px 14px;
    border: 1.5px solid var(--control-border);
    border-radius: 22px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color var(--bw-kurz) var(--bw-weich),
      border-color var(--bw-kurz) var(--bw-weich);
  }

  .chip[aria-pressed='true'] {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--ground);
  }

  .chip.mail {
    border-style: dashed;
  }

  .antwort {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: 0;
    font-size: calc(15 * var(--px));
  }

  .antwort .textlink {
    min-height: var(--tap-target);
  }

  .status {
    margin: 0;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    animation: einblenden var(--bw-blende) var(--bw-gleich);
  }

  .leise {
    color: var(--ink-muted);
    font-weight: 400;
  }

  .satz {
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .fenster-satz {
    margin: 0 0 14px;
    color: var(--ink-muted);
  }

  .was {
    display: grid;
    gap: 2px;
    margin: 0 0 14px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--track);
  }

  .was small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .was b {
    font-size: calc(18 * var(--px));
    line-height: calc(23 * var(--px));
  }

  .knoepfe {
    display: grid;
    gap: 8px;
    margin-top: 6px;
  }

  .haupt,
  .neben {
    min-height: 52px;
    border-radius: var(--radius-full);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .haupt {
    border: 0;
    background: var(--action);
    color: var(--on-action);
  }

  .haupt:disabled {
    opacity: 0.6;
  }

  .neben {
    border: 1.5px solid var(--control-border);
    background: transparent;
    color: var(--ink);
  }
</style>

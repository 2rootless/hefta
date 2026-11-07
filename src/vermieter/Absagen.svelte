<script lang="ts">
  // „Absagen“ (design/nachforderung.md, Abschnitt Absage, VS10; Aufgabe 38): eine fertige Mail an die
  // Bewerber, ohne Grund. Kein Textfeld (VS4): Die Wahl „Schon gelöscht“ oder „Lösche ich später“ sind
  // zwei Knöpfe als Auswahl; wer mehr ändern will, ändert in seinem Mailprogramm.
  import type { HeftaAnhang } from '../pdf/anhang';
  import { absage } from './absage';
  import { mailLink } from './nachforderung';
  import { haushaltTitel, mailEmpfaenger, ORIENTIERUNGSHILFE } from './regel';
  import { t } from './texte';

  let {
    anhang,
    nummer,
    gesamt,
  }: {
    anhang: HeftaAnhang;
    nummer: number;
    gesamt: number;
  } = $props();

  let geloescht = $state(true);
  const mail = $derived(absage(anhang, geloescht));
  const link = $derived(
    mailLink(mail.betreff, mail.text, mailEmpfaenger(anhang.haushalt.kontakt?.email)),
  );
  let meldung = $state('');
  const knoepfe: HTMLButtonElement[] = [];

  const WAHL = [
    { wert: true, text: () => t('absagen.geloescht') },
    { wert: false, text: () => t('absagen.spaeter') },
  ];

  function waehlen(wert: boolean) {
    geloescht = wert;
    meldung = '';
  }

  // Auswahl wie bei Radioknöpfen: Pfeiltasten wechseln und setzen den Fokus mit.
  function taste(e: KeyboardEvent, i: number) {
    const weiter = ['ArrowRight', 'ArrowDown'].includes(e.key);
    const zurueck = ['ArrowLeft', 'ArrowUp'].includes(e.key);
    if (!weiter && !zurueck) return;
    e.preventDefault();
    const j = (i + (weiter ? 1 : WAHL.length - 1)) % WAHL.length;
    waehlen(WAHL[j]!.wert);
    knoepfe[j]?.focus();
  }

  async function kopieren(text: string, geklappt: string) {
    try {
      await navigator.clipboard.writeText(text);
      meldung = geklappt;
    } catch {
      meldung = t('anfordern.nichtKopiert');
    }
  }
</script>

<article class="sec vs-detail vs-abs" aria-label={t('absagen.titel')}>
  <a class="vs-back" href="#/mappe/{nummer}">
    <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    {t('schritte.zurMappe')}
  </a>
  <p class="vs-kick">{t('anfordern.kopf', { nummer, gesamt, haushalt: haushaltTitel(anhang) })}</p>
  <h2 class="vs-t" data-titel tabindex="-1">{t('absagen.titel')}</h2>
  <p class="vs-lead">{t('absagen.lead')}</p>
  <p class="vs-note">
    <span class="vs-info" aria-hidden="true">i</span><span>{t('absagen.hinweis')}</span>
  </p>
  {#if anhang.loeschwunsch}
    <blockquote class="vs-bitte">
      <span>{t('loeschen.bitte')}</span>„{anhang.loeschwunsch}“
    </blockquote>
  {/if}
  <div class="vs-chips" role="radiogroup" aria-label={t('absagen.unterlagen')}>
    {#each WAHL as w, i (i)}
      <button
        type="button"
        class="vs-chip"
        class:on={geloescht === w.wert}
        role="radio"
        aria-checked={geloescht === w.wert}
        tabindex={geloescht === w.wert ? 0 : -1}
        bind:this={knoepfe[i]}
        onclick={() => waehlen(w.wert)}
        onkeydown={(e) => taste(e, i)}>{w.text()}</button
      >
    {/each}
  </div>
  <div class="vs-mail">
    <p class="vs-mb"><span>{t('anfordern.betreff')}</span>{mail.betreff}</p>
    <pre class="vs-mt">{mail.text}</pre>
  </div>
  <div class="vs-akt">
    <button type="button" class="vs-btn" onclick={() => kopieren(mail.text, t('anfordern.kopiert'))}
      >{t('anfordern.kopieren')}</button
    >
    <button
      type="button"
      class="vs-lk"
      onclick={() => kopieren(mail.betreff, t('anfordern.betreffKopiert'))}
      >{t('anfordern.betreffKopieren')}</button
    >
    <a class="vs-lk" href={link.href}>{t('anfordern.programm')}</a>
  </div>
  <p class="vs-anf-meldung" role="status">{meldung}</p>
  {#if link.nurBetreff}<p class="vs-sub">{t('anfordern.nurBetreff')}</p>{/if}
  <p class="vs-sub">{t('absagen.vorschlag')}</p>
  <p class="vs-quelle">{t('absagen.quelle')}</p>
  <a class="vs-lk vs-blk" href={ORIENTIERUNGSHILFE} rel="noreferrer" target="_blank"
    >{t('quelle.lesen')}</a
  >
</article>

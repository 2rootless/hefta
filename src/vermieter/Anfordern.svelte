<script lang="ts">
  // „Für den Vertrag anfordern“ (design/nachforderung.md, VS9): eine fertige Mail an die Bewerber. Kein
  // Textfeld (VS4): Wer ändern will, ändert in seinem Mailprogramm.
  import type { HeftaAnhang } from '../pdf/anhang';
  import { mailLink, nachforderung } from './nachforderung';
  import { haushaltTitel, MUSTERBOGEN } from './regel';
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

  const mail = $derived(nachforderung(anhang));
  const link = $derived(mailLink(mail.betreff, mail.text));
  let meldung = $state('');

  async function kopieren(text: string, geklappt: string) {
    try {
      await navigator.clipboard.writeText(text);
      meldung = geklappt;
    } catch {
      meldung = t('anfordern.nichtKopiert');
    }
  }
</script>

<article
  class="sec vs-detail vs-anf"
  aria-label={t('anfordern.titel')}
  data-posten={mail.posten}
  data-ziel={mail.ziel}
>
  <a class="vs-back" href="#/mappe/{nummer}">
    <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    {t('schritte.zurMappe')}
  </a>
  <p class="vs-kick">{t('anfordern.kopf', { nummer, gesamt, haushalt: haushaltTitel(anhang) })}</p>
  <h2 class="vs-t" data-titel tabindex="-1">{t('anfordern.titel')}</h2>
  <p class="vs-lead">{t('anfordern.lead')}</p>
  <p class="vs-note">
    <span class="vs-info" aria-hidden="true">i</span><span>{t('anfordern.zusage')}</span>
  </p>
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
  <p class="vs-sub">{t('anfordern.vorschlag')}</p>
  <p class="vs-quelle">{t('anfordern.quelle')}</p>
  <a class="vs-lk vs-blk" href={MUSTERBOGEN} rel="noreferrer" target="_blank"
    >{t('anfordern.musterbogen')}</a
  >
</article>

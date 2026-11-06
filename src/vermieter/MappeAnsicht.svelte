<script lang="ts">
  import type { AnhangUnterlage } from '../pdf/anhang';
  import Dateiname from './Dateiname.svelte';
  import type { Mappe } from './lesen';
  import {
    datumText,
    fehlendeGruppe,
    gehoertText,
    groesseText,
    GRUPPE_ENTSCHEIDUNG,
    GRUPPE_NICHT_NOETIG,
    gruppe,
    haushaltTitel,
    imVertrag,
    NB,
    ORIENTIERUNGSHILFE,
    personenGesamt,
    pruefPunkte,
    rolleText,
    seitenText,
    ueblichText,
    unterlageAngabe,
    unterlageHinweis,
    unterlageText,
    vollstaendigkeit,
  } from './regel';
  import { t } from './texte';

  let {
    mappe,
    nummer,
    gesamt,
    breit,
    oeffnen,
  }: {
    mappe: Mappe;
    nummer: number;
    gesamt: number;
    breit: boolean;
    oeffnen: (seite: number) => void;
  } = $props();

  const a = $derived(mappe.anhang);
  const stand = $derived(a ? vollstaendigkeit(a) : null);
  const pruefen = $derived(a ? pruefPunkte(a) : null);
  const vertrag = $derived(a ? a.haushalt.personen.filter(imVertrag) : []);
  const buergen = $derived(a ? a.haushalt.personen.filter((p) => !imVertrag(p)) : []);
  const anzahl = $derived(a ? personenGesamt(a) : 0);
  const liste = (teile: string[]) =>
    teile.length > 1
      ? `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
      : teile[0]!;
</script>

{#snippet zurueck()}
  {#if !breit}
    <a class="vs-back" href="#/">
      <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      {t('mappe.eingang')}
    </a>
  {/if}
{/snippet}

{#snippet aktion()}
  <div class="vs-akt">
    <button type="button" class="vs-btn" onclick={() => oeffnen(1)}>{t('mappe.oeffnen')}</button>
    <span class="vs-meta">
      <Dateiname name={mappe.name} /> · {mappe.seiten}{NB}Seiten · {groesseText(mappe.bytes)}
    </span>
  </div>
{/snippet}

{#snippet loeschen()}
  <section class="vs-sec vs-loesch">
    <h3 class="vs-h3">{t('loeschen.titel')}</h3>
    {#if a?.loeschwunsch}
      <blockquote class="vs-bitte">
        <span>{t('loeschen.bitte')}</span>„{a.loeschwunsch}“
      </blockquote>
    {/if}
    <p>{t('loeschen.text')}</p>
    <p class="vs-quelle">{t('loeschen.quelle')}</p>
    <a class="vs-lk vs-blk" href={ORIENTIERUNGSHILFE} rel="noreferrer" target="_blank"
      >{t('quelle.lesen')}</a
    >
  </section>
{/snippet}

{#snippet schritteLink()}
  <a class="vs-li" href="#/schritte">
    <span>{t('schritte.link')}</span>
    <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
  </a>
{/snippet}

{#snippet zeile(u: AnhangUnterlage)}
  {@const angabe = unterlageAngabe(u)}
  {@const hinweis = unterlageHinweis(u)}
  <button type="button" class="vs-d" onclick={() => oeffnen(u.seiten[0])}>
    <span class="vs-dl">
      <b class="vs-db">{unterlageText(u)}</b>
      {#if angabe}<small class="vs-ds">{angabe}</small>{/if}
    </span>
    <span class="vs-dp">{seitenText(u.seiten)}</span>
    <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
  </button>
  {#if hinweis}<p class="vs-dh">{hinweis}</p>{/if}
{/snippet}

{#if !a || !stand || !pruefen}
  <article class="sec vs-detail" aria-label={t('eingang.mappeNummer', { nummer })}>
    {@render zurueck()}
    <p class="vs-kick">{t('mappe.kopfOhne', { nummer, gesamt })}</p>
    <h2 class="vs-t vs-tf" data-titel tabindex="-1"><Dateiname name={mappe.name} /></h2>
    <p class="vs-lead">{t(mappe.passtNicht ? 'mappe.passtNicht' : 'mappe.ohne')}</p>
    {#if !mappe.passtNicht}<p class="vs-sub">{t('mappe.ohneWarum')}</p>{/if}
    {@render aktion()}
    {@render loeschen()}
    {@render schritteLink()}
  </article>
{:else}
  {@const wohnung = a.bewerbung.wohnung}
  <article
    class="sec vs-detail"
    aria-label={t('eingang.mappeNummer', { nummer })}
    data-ziel={stand.ziel}
  >
    {@render zurueck()}
    <p class="vs-kick">{t('mappe.kopf', { nummer, gesamt, datum: datumText(a.erstellt) })}</p>
    <h2 class="vs-t" data-titel tabindex="-1">{haushaltTitel(a)}</h2>
    <p class="vs-lead">
      {#if wohnung}
        {t('mappe.bewerbung', { wohnung: `${wohnung.strasse}, ${wohnung.rest}` })}
      {:else}
        {t('mappe.bewerbungOhne')}
      {/if}
    </p>
    {@render aktion()}
    {#if mappe.neuereFassung}
      <p class="vs-note">
        <span class="vs-info" aria-hidden="true">i</span><span>{t('mappe.neuer')}</span>
      </p>
    {/if}
    <p class="vs-her">
      <span class="vs-info" aria-hidden="true">i</span><span>{t('mappe.herkunft')}</span>
    </p>

    <div class="vs-zwei">
      <div class="vs-links-sp">
        <aside class="vs-wer sec">
          <div class="vs-wh">
            <h3 class="vs-h3">{t('mappe.wer')}</h3>
            <span>{anzahl === 1 ? t('mappe.einePerson') : t('mappe.personen', { anzahl })}</span>
          </div>
          <ul>
            {#each vertrag as p, i (i)}
              <li>
                <span class="vs-m vs-m-v" aria-hidden="true"></span>
                <span>
                  <b>{p.name}</b>
                  <small>{rolleText(p)}{p.kontakt ? t('mappe.kontakt') : ''}</small>
                </span>
              </li>
            {/each}
            {#each a.haushalt.mitziehende as m, i (i)}
              <li>
                <span class="vs-m vs-m-o" aria-hidden="true"></span>
                <span><b>{m.text}</b><small>{t('mappe.ohneVertrag')}</small></span>
              </li>
            {/each}
          </ul>
          <button type="button" class="vs-lk" onclick={() => oeffnen(1)}
            >{t('mappe.deckblatt')}</button
          >
        </aside>
        {#if buergen.length}
          <aside class="vs-wer vs-wbu sec">
            <div class="vs-wh">
              <h3 class="vs-h3">{t('mappe.buergschaft')}</h3>
              <span>{t('mappe.ziehtNicht')}</span>
            </div>
            <ul>
              {#each buergen as p, i (i)}
                <li>
                  <span class="vs-m vs-m-b" aria-hidden="true"></span>
                  <span><b>{p.name}</b><small>{rolleText(p)}</small></span>
                </li>
              {/each}
            </ul>
          </aside>
        {/if}
      </div>

      <section class="vs-was sec">
        <h3 class="vs-h3">{t('mappe.beiliegt')}</h3>
        {#if a.modus === 'datensparsam'}
          <p class="vs-note">
            <span class="vs-info" aria-hidden="true">i</span>
            <span>{t('mappe.sparsam', { gehoert: gehoertText(stand.ziel) })}</span>
          </p>
        {/if}
        {#each stand.personen as x, k (x.index)}
          {@const oben = x.da.filter((u) => gruppe(u, x.person) === 1)}
          {@const mitte = x.da.filter((u) => gruppe(u, x.person) === 2)}
          {@const unten = x.da.filter((u) => gruppe(u, x.person) === 3)}
          {@const lueckeOben = x.fehlt.filter((f) => fehlendeGruppe(f, x.person) === 1)}
          {@const lueckeMitte = x.fehlt.filter((f) => fehlendeGruppe(f, x.person) === 2)}
          {#if !imVertrag(x.person) && (k === 0 || imVertrag(stand.personen[k - 1]!.person))}
            <h4 class="vs-h4">{t('mappe.buergschaft')}</h4>
          {/if}
          <div class="vs-p" class:bu={!imVertrag(x.person)}>
            <div class="vs-ph"><b>{x.person.name}</b><small>{rolleText(x.person)}</small></div>
            {#each oben as u, i (i)}{@render zeile(u)}{/each}
            {#each lueckeOben as f, i (i)}
              <div class="vs-d vs-dx">
                <span class="vs-dl">
                  <b class="vs-db">{f.text}</b>
                  <small class="vs-ds">{t('mappe.nichtDabei', { ueblich: ueblichText(f) })}</small>
                </span>
              </div>
            {/each}
            {#if mitte.length || lueckeMitte.length || x.spaeter.length}
              <div class="vs-g">
                <p class="vs-gl">{GRUPPE_ENTSCHEIDUNG}</p>
                {#each mitte as u, i (i)}{@render zeile(u)}{/each}
                {#each lueckeMitte as f, i (i)}
                  <div class="vs-d vs-dx">
                    <span class="vs-dl">
                      <b class="vs-db">{f.text}</b>
                      <small class="vs-ds"
                        >{t('mappe.nichtDabei', { ueblich: ueblichText(f) })}</small
                      >
                    </span>
                  </div>
                {/each}
                {#if x.spaeter.length}
                  <p class="vs-nd">
                    {t('mappe.nichtDabeiListe', { liste: liste(x.spaeter.map((f) => f.text)) })}
                  </p>
                {/if}
              </div>
            {/if}
            {#if unten.length}
              <div class="vs-g">
                <p class="vs-gl">{GRUPPE_NICHT_NOETIG}</p>
                {#each unten as u, i (i)}{@render zeile(u)}{/each}
              </div>
            {/if}
          </div>
        {/each}
      </section>
    </div>

    {#if pruefen.punkte.length}
      <section class="vs-sec vs-pruef">
        <h3 class="vs-h3">{t('mappe.pruefen')}</h3>
        <ul class="vs-pl">
          {#each pruefen.punkte as p, i (i)}
            <li>
              <b>{p.titel}</b>
              <p>{p.text}</p>
              {#if p.link}
                <a class="vs-lk vs-blk" href={p.link.url} rel="noreferrer" target="_blank"
                  >{p.link.text}</a
                >
              {/if}
            </li>
          {/each}
        </ul>
        <p class="vs-quelle">{pruefen.quelle}</p>
      </section>
    {/if}
    {@render loeschen()}
    <a class="vs-li" href="#/mappe/{nummer}/anfordern">
      <span>{t('anfordern.titel')}<small class="vs-lis">{t('anfordern.zeile')}</small></span>
      <svg class="vs-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </a>
    {@render schritteLink()}
  </article>
{/if}

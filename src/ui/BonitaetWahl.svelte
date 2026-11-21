<script lang="ts">
  // DP45 G4 mit K1 (PC56): „Wie ist es bei dir?“ beim Bonitätsnachweis. „Ich bekomme noch keinen“: Der Grund
  // ist freiwillig; „Neu in Deutschland“ gibt es nicht als Vorgabe (er verriete die Herkunft). Die Angabe
  // steht wörtlich in der Mappe, Hefta legt keinen Ersatz-Nachweis an. Darunter, was man stattdessen
  // beilegen kann; ob das reicht, entscheidet der Vermieter.
  import { db, neuLaden } from '../app/daten.svelte';
  import type { BonitaetAngabe } from '../domain/modell';
  import { standFinden, type PersonStand, type UnterlagenStand } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import { anrede } from '../i18n/anrede.svelte';
  import { dokumentAendern } from '../storage/speicher';
  import Symbol from './Symbol.svelte';

  let { stand, u }: { stand: PersonStand; u: UnterlagenStand } = $props();

  const person = $derived(stand.person);
  const name = $derived(person.rufname || person.vorname);
  const du = $derived(anrede.wert === 'du');
  const angabe = $derived<BonitaetAngabe | null>(u.dokument?.bonitaet ?? null);
  const art = $derived(angabe?.art ?? (u.versionen.length ? 'habe' : null));

  let eigenerText = $state('');
  let geladen = '';
  $effect(() => {
    const schluessel = `${u.dokument?.id ?? ''}:${angabe?.grund ?? ''}`;
    if (schluessel !== geladen) {
      geladen = schluessel;
      eigenerText = angabe?.text ?? '';
    }
  });

  async function setzen(neu: BonitaetAngabe) {
    await dokumentAendern(await db(), person.id, u.typ.id, null, {
      bonitaet: JSON.parse(JSON.stringify(neu)) as BonitaetAngabe,
    });
    await neuLaden();
  }

  const ARTEN = [
    ['habe', 'bonitaetWahl.habe'],
    ['bestelle', 'bonitaetWahl.bestelle'],
    ['keiner', 'bonitaetWahl.keiner'],
  ] as const;

  const statt = $derived(
    [
      standFinden(stand, 'mietzahlung')
        ? { text: t('bonitaetWahl.stattMiete'), href: `#/unterlage/${person.id}/mietzahlung` }
        : null,
      standFinden(stand, 'arbeitsvertrag')
        ? { text: t('bonitaetWahl.stattVertrag'), href: `#/unterlage/${person.id}/arbeitsvertrag` }
        : null,
      stand.rolle !== 'buerge'
        ? { text: t('bonitaetWahl.stattBuerge'), href: '#/person-neu/buerge' }
        : null,
    ].filter((x): x is { text: string; href: string } => !!x),
  );
</script>

<section class="bonitaet-wahl">
  <p class="cap oben">{t('bonitaetWahl.lead')}</p>
  <h2 class="etikett">
    {du ? t('bonitaetWahl.frageDu') : t('bonitaetWahl.frageName', { name })}
  </h2>
  <div class="karte karte-weich">
    <div class="pillen">
      {#each ARTEN as [wert, text] (wert)}
        <button
          type="button"
          class="pille"
          aria-pressed={art === wert}
          onclick={() =>
            void setzen({
              art: wert,
              grund: wert === 'keiner' ? (angabe?.grund ?? null) : null,
              ...(wert === 'keiner' && angabe?.text ? { text: angabe.text } : {}),
            })}>{t(text)}</button
        >
      {/each}
    </div>
  </div>

  {#if art === 'keiner' && angabe}
    <h2 class="etikett">
      {du ? t('bonitaetWahl.warumDu') : t('bonitaetWahl.warumName', { name })}
    </h2>
    <div class="karte karte-weich">
      <div class="pillen">
        {#each [['keine_vertraege', 'bonitaetWahl.keineVertraege'], ['eigener', 'bonitaetWahl.eigener']] as const as [grund, text] (grund)}
          <button
            type="button"
            class="pille"
            aria-pressed={angabe.grund === grund}
            onclick={() =>
              // Noch einmal tippen nimmt den Grund wieder weg: Er ist freiwillig (K1).
              void setzen({
                art: 'keiner',
                grund: angabe.grund === grund ? null : grund,
                ...(grund === 'eigener' && eigenerText.trim() ? { text: eigenerText.trim() } : {}),
              })}>{t(text)}</button
          >
        {/each}
      </div>
      {#if angabe.grund === 'eigener'}
        <label class="eingabe">
          {t('bonitaetWahl.eigenerFeld')}
          <input
            type="text"
            bind:value={eigenerText}
            autocomplete="off"
            data-feld="eigener-grund"
            onchange={() =>
              void setzen({ art: 'keiner', grund: 'eigener', text: eigenerText.trim() })}
          />
        </label>
      {/if}
      <p class="cap">
        {du ? t('bonitaetWahl.satzDu') : t('bonitaetWahl.satzName', { name })}
      </p>
      <p class="cap">{t('bonitaetWahl.ohneGrund')}</p>
    </div>

    {#if statt.length}
      <h2 class="etikett">{t('bonitaetWahl.stattTitel')}</h2>
      <ul class="karte gruppe">
        {#each statt as s (s.href)}
          <li>
            <a class="zeile" href={s.href}>
              <span class="zeichen"><Symbol name="plus" groesse={20} /></span>
              <b>{s.text}</b>
              <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
            </a>
          </li>
        {/each}
      </ul>
      <p class="cap draussen">{t('bonitaetWahl.stattSatz')}</p>
    {/if}
  {/if}
</section>

<style>
  .bonitaet-wahl {
    margin: 24px 16px 0;
  }

  .oben {
    margin: 0 4px 16px;
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

  .karte + .etikett,
  .cap + .etikett {
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
    gap: 0;
    padding: 0 16px;
    list-style: none;
  }

  li + li {
    border-top: 1px solid var(--line);
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

  .zeile b {
    flex: 1;
    min-width: 0;
    font-weight: 600;
  }

  .zeichen,
  .pfeil {
    display: flex;
    flex: none;
  }

  .pfeil {
    color: var(--ink-quiet);
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

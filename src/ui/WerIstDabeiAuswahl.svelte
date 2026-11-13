<script lang="ts">
  // „Wer ist dabei?“ in „Mappe erstellen“ (Aufgabe 56, E25): drei Gruppen. Im Mietvertrag und wer mit
  // einzieht sind immer dabei, ohne Kästchen. Bürgen lassen sich je Zeile weglassen; die ganze Zeile
  // schaltet. Ohne Bürgen ist der Abschnitt nur zum Ansehen.
  import { mitEinSatz, werIstDabeiHinweis } from '../domain/mappeWoerter';
  import { rollenText, type PersonStand } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';

  let {
    vertrag,
    buergen,
    kinder,
    weitere,
    ohne,
    umschalten,
    allein = false,
  }: {
    vertrag: PersonStand[];
    buergen: PersonStand[];
    kinder: number;
    weitere: number;
    ohne: string[];
    umschalten: (id: string) => void;
    /** Eine Person im Mietvertrag: „kannst du“ statt „könnt ihr“ (E50). */
    allein?: boolean;
  } = $props();
  const satz = $derived(
    werIstDabeiHinweis(
      buergen.map((s) => ({
        vorname: s.person.rufname || s.person.vorname,
        bezeichnung: s.bezeichnung,
      })),
      allein,
    ),
  );

  const name = (s: PersonStand) => s.person.rufname || s.person.vorname;
  const anfang = (s: PersonStand) => [...name(s)][0]?.toUpperCase() ?? '';
</script>

<!-- B23 `s=teilen`: eine Karte mit Reitern; Kinder ohne Unterlagen; Bürgen abgesetzt und abwählbar. -->
<div class="wer">
  <ul>
    {#each vertrag as s (s.person.id)}
      <li class="zeile">
        <span class="reiter" style:--farbe="var(--person-{s.farbe})" aria-hidden="true"
          >{anfang(s)}</span
        >
        <span class="tx"><b>{name(s)}</b><small>{rollenText(s.rolle, s.bezeichnung)}</small></span>
      </li>
    {/each}
    {#if kinder + weitere}
      <li class="zeile">
        <span class="kreis" aria-hidden="true"><Symbol name="kind" groesse={20} /></span>
        <span class="tx"
          ><span class="mit">{mitEinSatz(kinder, weitere)}</span><small
            >{t('uebersicht.mitKeineUnterlagen', { anzahl: kinder + weitere })}</small
          ></span
        >
      </li>
    {/if}
  </ul>

  {#if buergen.length}
    <p class="zusatz">{t('uebersicht.zusatzZeile')}</p>
    <ul>
      {#each buergen as s (s.person.id)}
        {@const an = !ohne.includes(s.person.id)}
        <li>
          <button
            type="button"
            class="zeile wahl"
            class:aus={!an}
            role="checkbox"
            aria-checked={an}
            style:--farbe="var(--person-{s.farbe})"
            onclick={() => umschalten(s.person.id)}
          >
            <span class="reiter" aria-hidden="true">{anfang(s)}</span>
            <span class="tx"
              ><b>{name(s)}</b><small>{rollenText(s.rolle, s.bezeichnung)}</small>{#if !an}<span
                  class="nicht">{t('mappe.nichtInMappe')}</span
                >{/if}</span
            >
            <span class="kasten" aria-hidden="true"
              >{#if an}<Symbol name="haken" groesse={16} />{/if}</span
            >
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
<p class="satz">{satz}</p>

<style>
  .wer {
    padding: 4px 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 0;
    color: var(--ink);
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
    overflow-wrap: break-word;
  }

  b {
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .mit {
    font-size: calc(15 * var(--px));
  }

  small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  /* Reiter wie in der Mappe (B14): Quadrat in der Farbe der Person mit dem Anfangsbuchstaben. */
  .reiter {
    display: grid;
    flex: none;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: var(--farbe);
    color: var(--on-person);
    font-size: calc(12 * var(--px));
    font-weight: 800;
  }

  .kreis {
    display: grid;
    flex: none;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 1.5px solid var(--ink);
    border-radius: 50%;
  }

  .zusatz {
    margin: 4px 0 0;
    padding-top: 10px;
    border-top: 1px dashed var(--line-strong);
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .satz {
    margin: 8px 2px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .wahl {
    width: 100%;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .kasten {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--farbe);
    border-radius: 7px;
    background: var(--farbe);
    color: var(--on-person);
  }

  .aus .kasten {
    border-color: var(--ink-muted);
    background: var(--surface);
  }

  .aus b,
  .aus small,
  .aus .reiter {
    opacity: 0.55;
  }

  .nicht {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }
</style>

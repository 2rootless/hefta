<script lang="ts">
  // DP49 Punkt 5: „In der Mappe für diese Wohnung“ im Heft. Je Person eine Zeile mit den Unterlagen, die in
  // die Mappe dieses Hefts kommen. Die Bürgschaftserklärung gilt je Wohnung und ist freiwillig: Sie steht an
  // der Bürgin, ruhig, nicht oben bei dem, was fehlt (W32). Fehlt sie, führt „Erklärung vorbereiten“ zum
  // Blatt aus E112.
  import { daten } from '../app/daten.svelte';
  import { einzugText } from '../domain/bewerben';
  import { ansichtFuerHeft, erklaerungFuer, erklaerungTag } from '../domain/buergschaft';
  import { bloecke, standardEinstellungen, type ExportEinstellungen } from '../domain/export';
  import type { DateiVersion, Heft } from '../domain/modell';
  import { listenText, ohneTrennstellen, rollenAnzeige } from '../domain/regelkatalog';
  import { t, tagZusammen } from '../i18n';
  import { staendeAus } from './mappeDaten';
  import Symbol from './Symbol.svelte';

  let { heft }: { heft: Heft } = $props();

  const heute = new Date();
  const einstellungen = $derived<ExportEinstellungen>({
    ...standardEinstellungen(),
    ...(heft.export ?? {}),
  });
  const personen = $derived.by(() => {
    const ansicht = daten.ansicht;
    if (!ansicht) return [];
    const fuerHeft = ansichtFuerHeft(ansicht, heft.id);
    return bloecke(staendeAus(fuerHeft, heute), einstellungen)
      .filter(
        (b) =>
          !ansicht.mitglieder.find((m) => m.person.id === b.person.person.id)?.zugehoerigkeit
            .herausgenommenAm,
      )
      .map((b) => {
        const s = b.person;
        const namen = b.teile
          .filter((x) => !x.stand.typ.jeWohnung)
          .map((x) => ohneTrennstellen(listenText(x.stand.typ)));
        const buerge = s.rolle === 'buerge';
        const liste = namen.length ? namen.join(', ') : t('heftMappe.keine');
        return {
          id: s.person.id,
          name: s.person.rufname || s.person.vorname,
          farbe: s.farbe,
          buerge,
          unter: buerge ? `${rollenAnzeige(s.rolle)}. ${liste}` : liste,
          erklaerung: buerge
            ? erklaerungFuer(s.person.id, ansicht.dokumente, ansicht.versionen, heft.id)
            : null,
        };
      });
  });

  const tag = (v: DateiVersion) => tagZusammen(einzugText(erklaerungTag(v), heute));
</script>

{#if personen.length}
  <section class="block heft-mappe" aria-labelledby="hm-titel-{heft.id}">
    <h2 id="hm-titel-{heft.id}">{t('heftMappe.titel')}</h2>
    <ul class="personen">
      {#each personen as p (p.id)}
        <li class:buerge={p.buerge}>
          <a class="person" href="#/person/{p.id}">
            <span
              class="zeichen"
              class:umriss={p.buerge}
              style:--farbe="var(--person-{p.farbe})"
              aria-hidden="true"
            ></span>
            <span class="tx">
              <b>{p.name}</b>
              <small>{p.unter}</small>
            </span>
            <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
          </a>
          {#if p.erklaerung}
            <div class="erklaerung">
              {#if p.erklaerung.eigene}
                <p class="da">{t('heftMappe.da', { datum: tag(p.erklaerung.eigene) })}</p>
              {:else}
                <p>
                  {p.erklaerung.ohneWohnung
                    ? t('heftMappe.ohneWohnung', { datum: tag(p.erklaerung.ohneWohnung) })
                    : t('heftMappe.ohne')}
                </p>
                <a class="vorbereiten" href="#/buergschaft/{p.id}/{heft.id}"
                  >{t('heftMappe.vorbereiten')}<Symbol name="weiter" groesse={16} /></a
                >
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .block {
    margin: 14px 0 0;
    padding: 16px;
    border-radius: 22px;
    background: var(--surface);
  }

  h2 {
    margin: 0 0 6px;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .personen {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .personen li + li {
    box-shadow: 0 -1px 0 var(--line);
  }

  .person {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-height: var(--tap-target);
    padding: 10px 0;
    color: var(--ink);
    text-decoration: none;
  }

  .zeichen {
    flex: none;
    width: 10px;
    height: 10px;
    margin-top: calc(6 * var(--px));
    border-radius: 2px;
    background: var(--farbe);
  }

  .zeichen.umriss {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--farbe);
  }

  .tx {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .pfeil {
    display: inline-flex;
    flex: none;
    margin-top: 2px;
    color: var(--ink-muted);
  }

  .erklaerung {
    padding: 0 0 10px 22px;
  }

  .erklaerung p {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .erklaerung .da {
    font-weight: 600;
  }

  /* PC79 (C33): Neben einem Zeichen 4 px. */
  .vorbereiten {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--tap-target);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 650;
    text-decoration: none;
  }
</style>

<script lang="ts">
  // Haushaltszeile (design/stil-c.md): wer einzieht, als Kreise unter der Begrüßung, immer am selben
  // Platz; die ganze Zeile führt zu „Euer Haushalt“. Bürgen stehen nicht darin, sie ziehen nicht ein.
  import type { PersonStand } from '../domain/regelkatalog';
  import { werIstDabeiKurz } from '../domain/mappeWoerter';
  import { t } from '../i18n';
  import Symbol from './Symbol.svelte';

  let {
    vertrag,
    weitere,
    kinder,
    buergen = 0,
  }: { vertrag: PersonStand[]; weitere: number; kinder: number; buergen?: number } = $props();

  const rufname = (s: PersonStand) => s.person.rufname || s.person.vorname;
  const anfang = (s: PersonStand) => [...rufname(s)][0]?.toUpperCase() ?? '';
  const kuerzel = (s: PersonStand) =>
    vertrag.filter((x) => anfang(x) === anfang(s)).length > 1
      ? [...rufname(s)].slice(0, 2).join('')
      : anfang(s);

  // Vorgelesen wird die Kurzform aus E25, sichtbar sind nur die Kreise.
  const satz = $derived(werIstDabeiKurz({ vertrag: vertrag.length, kinder, weitere, buergen }));

  // Kreise rücken bis 8 px zusammen, damit der Hinweis daneben bleibt; reicht das nicht, steht er
  // darunter. Unter 360 px immer darunter: gleicher Platz auf demselben Gerät.
  function einpassen(zeile: HTMLElement) {
    const figuren = zeile.querySelector<HTMLElement>('.figuren')!;
    const hinweis = zeile.querySelector<HTMLElement>('.hinweis')!;
    const passen = () => {
      zeile.classList.remove('unter');
      let passt = false;
      if (window.innerWidth >= 360)
        for (let ueber = 5; ueber <= 8 && !passt; ueber++) {
          figuren.style.setProperty('--ueber', `${ueber}px`);
          passt = hinweis.offsetTop < figuren.offsetTop + figuren.offsetHeight - 4;
        }
      if (!passt) {
        figuren.style.setProperty('--ueber', '5px');
        zeile.classList.add('unter');
      }
    };
    const beobachter = new ResizeObserver(passen);
    beobachter.observe(zeile);
    return { destroy: () => beobachter.disconnect() };
  }
</script>

<a class="zeile" href="#/haushalt" use:einpassen>
  <span class="visually-hidden">{t('uebersicht.haushaltZeile', { liste: satz })}</span>
  <span class="figuren" aria-hidden="true">
    {#each vertrag as s (s.person.id)}
      <span class="kreis kachel f{s.farbe}" class:zwei={kuerzel(s).length > 1}>{kuerzel(s)}</span>
    {/each}
    {#each { length: weitere }, i (i)}
      <span class="kreis lila"><Symbol name="person" groesse={20} /></span>
    {/each}
    {#each { length: kinder }, i (i)}
      <span class="kreis lila kind"><Symbol name="kind" groesse={16} /></span>
    {/each}
  </span>
  <span class="hinweis" aria-hidden="true"
    >{t('uebersicht.haushaltBearbeiten')}<Symbol name="weiter" groesse={16} /></span
  >
</a>

<style>
  .zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 6px 12px;
    min-height: 44px;
    margin: 10px 0 2px;
    padding: 2px 0;
    color: var(--ink);
    text-decoration: none;
  }

  .figuren {
    display: flex;
    align-items: flex-end;
  }

  .kreis {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 36px;
    height: 36px;
    margin-left: calc(-1 * var(--ueber, 5px));
    border-radius: 50%;
    box-shadow: 0 0 0 2.5px var(--ground);
    color: #191a2c;
    font-size: 15px;
    font-weight: 800;
  }

  .kreis:first-child {
    margin-left: 0;
  }

  .zwei {
    font-size: 12px;
  }

  .f1 {
    background: var(--person-1);
  }

  .f2 {
    background: var(--person-2);
  }

  .f3 {
    background: var(--person-3);
  }

  .f4 {
    background: var(--person-4);
  }

  .f5 {
    background: var(--person-5);
  }

  .f6 {
    background: var(--person-6);
  }

  .lila {
    background: var(--person-child);
    box-shadow:
      0 0 0 2.5px var(--ground),
      inset 0 0 0 1.6px var(--on-person);
    color: var(--on-person);
  }

  /* Im Vertrag: Kachel statt Kreis (B11, hefta-kachel-vertrag-36), wie das Quadrat in der Mappe. */
  .kachel {
    border-radius: 6px;
    font-weight: 700;
    font-size: 16px;
  }

  .kind {
    width: 26px;
    height: 26px;
  }

  .hinweis {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 26px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 700;
    white-space: nowrap;
  }

  :global(.zeile.unter) .hinweis {
    flex-basis: 100%;
  }
</style>

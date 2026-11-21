<script lang="ts">
  // DP47 G5 mit DP47b K1: Teil „Einkommen“ der Selbstauskunft bei mehr als einer Lebenslage. Die erste
  // Quelle bleibt in den Feldern darüber; hier stehen die weiteren je als Karte, „Leistungen vom Amt“ mit
  // dem Schalter „Einkommen trotzdem angeben“ und darunter, was im Bogen steht: die Summe nur, wenn jede
  // Quelle einen Betrag hat, sonst die Teile.
  import { lagenVon, wirksameLagen, type LageAngabe } from '../domain/lagen';
  import type { Person } from '../domain/modell';
  import { situationText } from '../domain/regelkatalog';
  import { t } from '../i18n';
  import { angabenAus, type SelbstauskunftEingabe } from './selbstauskunftEingabe';
  import SchalterZeile from './SchalterZeile.svelte';

  let { eingabe = $bindable(), person }: { eingabe: SelbstauskunftEingabe; person: Person } =
    $props();

  const jetzt = $derived({ ...person, ...angabenAus(eingabe) } as Person);
  const alle = $derived(lagenVon(jetzt));
  const wirksam = $derived(wirksameLagen(jetzt));
  const amt = $derived(alle.find((l) => l.situation === 'leistungsbezug') ?? null);
  const andere = $derived(alle.filter((l) => l.situation !== 'leistungsbezug'));
  const euro = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

  const name = (l: LageAngabe) => situationText(l.situation, l.art);
  const betrag = (l: LageAngabe): number | null => {
    const text = l.lageId
      ? (eingabe.lagen.find((x) => x.id === l.lageId)?.netto ?? '')
      : eingabe.netto;
    const zahl = Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
    return Number.isFinite(zahl) && zahl > 0 ? Math.round(zahl) : null;
  };
  /** Weitere Lagen (nicht die erste, nicht das Amt), solange sie wirken. */
  const karten = $derived(
    eingabe.lagen
      .map((l, i) => ({ l, i }))
      .filter(
        ({ l }) => l.situation !== 'leistungsbezug' && wirksam.some((w) => w.lageId === l.id),
      ),
  );
  const teile = $derived(
    wirksam.map((l) => ({
      text: name(l),
      betrag: l.situation === 'leistungsbezug' ? null : betrag(l),
    })),
  );
  const summe = $derived(
    wirksam.length > 1 && teile.every((x) => x.betrag)
      ? teile.reduce((s, x) => s + (x.betrag ?? 0), 0)
      : null,
  );
</script>

{#if amt}
  <div class="karte">
    <p class="kopf">
      <b>{name(amt)}</b>
      <span>{amt.lageId === null ? t('einkommenQuellen.zuerst') : t('einkommenQuellen.dazu')}</span>
    </p>
    <!-- Beide Fassungen liegen im selben Feld, nichts springt (W8). -->
    <p class="stapel">
      <span class:weg={eingabe.einkommenTrotzdem}>{t('einkommenQuellen.amtAus')}</span>
      <span class:weg={!eingabe.einkommenTrotzdem}>{t('einkommenQuellen.amtAn')}</span>
    </p>
  </div>
  {#if andere.length}
    <div class="karte">
      <SchalterZeile
        an={eingabe.einkommenTrotzdem}
        titel={t('einkommenQuellen.schalter')}
        text={t('einkommenQuellen.schalterSatz')}
        onclick={() => (eingabe.einkommenTrotzdem = !eingabe.einkommenTrotzdem)}
      />
    </div>
    {#if !eingabe.einkommenTrotzdem}
      <p class="hinweis">
        {t('einkommenQuellen.schalterHinweis', { lage: andere.map(name).join(', ') })}
      </p>
    {/if}
  {/if}
{/if}

{#each karten as { l, i } (l.id)}
  <div class="karte">
    <p class="kopf">
      <b>{situationText(l.situation, l.ausbildungArt)}</b><span>{t('einkommenQuellen.dazu')}</span>
    </p>
    <label class="eingabe">
      {l.situation === 'angestellt'
        ? t('einkommenQuellen.beruf')
        : t('einkommenQuellen.taetigkeit')}
      <input bind:value={eingabe.lagen[i]!.beruf} autocomplete="off" data-feld="lage-beruf-{i}" />
    </label>
    {#if l.situation === 'angestellt'}
      <label class="eingabe">
        {t('einkommenQuellen.arbeitgeber')}
        <input
          bind:value={eingabe.lagen[i]!.arbeitgeber}
          autocomplete="off"
          data-feld="lage-arbeitgeber-{i}"
        />
      </label>
    {/if}
    <label class="eingabe">
      {l.situation === 'selbststaendig'
        ? t('einkommenQuellen.nettoSchnitt')
        : t('einkommenQuellen.netto')}
      <span class="euro">
        <input
          bind:value={eingabe.lagen[i]!.netto}
          inputmode="numeric"
          autocomplete="off"
          data-feld="lage-netto-{i}"
        />
        <span aria-hidden="true">€</span>
      </span>
    </label>
  </div>
{/each}

{#if wirksam.length > 1}
  <div class="karte">
    {#if summe}
      <p class="summe">
        <span>{t('einkommenQuellen.zusammen')}</span>
        <b>{t('einkommenQuellen.zusammenBetrag', { betrag: `${euro.format(summe)} €` })}</b>
      </p>
    {:else}
      <p class="kopf"><b>{t('einkommenQuellen.soStehtBogen')}</b></p>
    {/if}
    <ul class="teile">
      {#each teile as teil, n (n)}
        <li>
          <span>{teil.text}</span>
          <span
            >{teil.betrag
              ? `${euro.format(teil.betrag)} €`
              : t('einkommenQuellen.ohneBetrag')}</span
          >
        </li>
      {/each}
    </ul>
  </div>
  <p class="hinweis">
    {summe
      ? wirksam.length === 2
        ? t('einkommenQuellen.soStehtZwei')
        : t('einkommenQuellen.soStehtMehr')
      : t('einkommenQuellen.summeSatz')}
  </p>
{/if}

<style>
  .karte {
    display: grid;
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
    background: var(--weich-karte);
  }

  .kopf {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin: 0;
  }

  .kopf b {
    font-weight: 650;
  }

  .kopf span {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  /* Beide Sätze im selben Feld: Das Feld ist so hoch wie der längere, nichts springt. */
  .stapel {
    display: grid;
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .stapel > span {
    grid-area: 1 / 1;
  }

  .stapel > .weg {
    visibility: hidden;
  }

  .euro {
    position: relative;
    display: block;
  }

  .euro span {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-muted);
  }

  /* DP47b K2: In schmaler Breite steht der Betrag unter „Zusammen“. */
  .summe {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    margin: 0;
  }

  .summe b {
    font-weight: 700;
  }

  .teile {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .teile li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0 12px;
  }

  .hinweis {
    margin: -4px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }
</style>

<script lang="ts">
  // Symbole von Hefta, Fassung c (B11, E28): 32er-Raster, runde Enden, Strich je Größe. Unter 20 px
  // gilt die Kernform, wo es eine gibt (nur in Stein oder Kreis). Neben einem Wort bleibt das Symbol
  // stumm; steht es allein, trägt der Knopf das Wort (`SYMBOLE[name].wort`).
  import { STRICH, SYMBOLE, type SymbolName } from './symbolPfade';

  let {
    name,
    groesse = 20,
  }: {
    name: SymbolName;
    groesse?: 12 | 16 | 20 | 24 | 28 | 32 | 48;
  } = $props();

  const form = $derived(SYMBOLE[name]);
  const pfade = $derived(
    groesse <= 16 && 'kern' in form && form.kern ? form.kern : (form.voll as readonly string[]),
  );
</script>

<svg
  width={groesse}
  height={groesse}
  viewBox="0 0 32 32"
  fill="none"
  stroke="currentColor"
  stroke-width={STRICH[groesse]}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each pfade as d, i (i)}<path {d} />{/each}
</svg>

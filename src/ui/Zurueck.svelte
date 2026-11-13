<script lang="ts">
  // Oben links (Auftraggeber 13.11., ersetzt Planung 12r): führt immer zur Seite darüber und nennt sie.
  import { abschliessen, route, zurueckGehen } from '../app/router.svelte';
  import Symbol from './Symbol.svelte';

  let {
    href,
    text,
    onclick,
  }: {
    href: string;
    text: string;
    /** Statt einfach zu folgen, z. B. erst etwas speichern. */
    onclick?: () => void;
  } = $props();

  const oben = $derived(href.replace(/^#/, '') || '/');
  // Regel 2 (Auftraggeber 13.11.): immer zur Seite darüber, mit ihrem Namen. Kam man auf dem üblichen Weg,
  // ist das ein Schritt zurück wie die Wischgeste; sonst springt Hefta dorthin.
  const ueblich = $derived(route.vorher === oben);
</script>

<a
  class="zurueck"
  {href}
  onclick={(e) => {
    e.preventDefault();
    if (onclick) onclick();
    else if (ueblich) zurueckGehen(oben);
    else abschliessen(oben);
  }}><Symbol name="zurueck" groesse={20} />{text}</a
>

<style>
  .zurueck {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--tap-target);
    padding-right: var(--space-2);
    color: var(--on-zurueck, var(--ink));
    font-size: calc(15 * var(--px));
    font-weight: 700;
    text-decoration: none;
  }
</style>

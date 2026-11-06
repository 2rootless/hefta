<script lang="ts">
  // Oben links: tut dasselbe wie die Wischgeste, eine Seite zurück. Kam man von woanders her als von der
  // übergeordneten Seite, heißt es schlicht „Zurück“, damit der Name stimmt.
  import { route, zurueckGehen } from '../app/router.svelte';
  import { t } from '../i18n';
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
  const anderswoher = $derived(!onclick && !!route.vorher && route.vorher !== oben);
</script>

<a
  class="zurueck"
  {href}
  onclick={(e) => {
    e.preventDefault();
    if (onclick) onclick();
    else zurueckGehen(oben);
  }}><Symbol name="zurueck" groesse={18} />{anderswoher ? t('allgemein.zurueck') : text}</a
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

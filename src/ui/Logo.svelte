<script lang="ts">
  import hell from '../assets/hefta-logo.svg';
  import dunkel from '../assets/hefta-logo-dunkel.svg';
  import { t } from '../i18n';
</script>

<!-- Logo oben links in 30px Höhe (design/bausteine/Logo.md). Welche Fassung sichtbar ist,
     entscheidet das Thema am html-Element, damit ein Wechsel im laufenden Betrieb sofort greift. -->
<span class="logo">
  <img class="hell" src={hell} alt={t('logo.alt')} height="30" width="93" />
  <img class="dunkel" src={dunkel} alt={t('logo.alt')} height="30" width="93" />
</span>

<style>
  .logo {
    display: inline-block;
  }

  img {
    display: block;
    height: 30px;
    width: auto;
  }

  .dunkel,
  :global([data-theme='dark']) .hell {
    display: none;
  }

  :global([data-theme='dark']) .dunkel {
    display: block;
  }
</style>

// Hell oder Dunkel folgt der Systemeinstellung (design/README.md, Farbe).
export function themaFolgen(): void {
  const dunkel = window.matchMedia('(prefers-color-scheme: dark)');
  const setzen = () => {
    document.documentElement.dataset.theme = dunkel.matches ? 'dark' : 'light';
  };
  setzen();
  dunkel.addEventListener('change', setzen);
}

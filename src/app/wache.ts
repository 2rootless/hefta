// Beobachtet im laufenden Betrieb, ob die Content-Security-Policy etwas blockiert hat.
// Nur lokal: nichts davon wird irgendwohin gemeldet. Der Technik-Test zeigt es an.

export const cspVerstoesse: string[] = [];

export function wacheStarten(): void {
  document.addEventListener('securitypolicyviolation', (e) => {
    cspVerstoesse.push(`${e.effectiveDirective}: ${e.blockedURI || 'inline'}`);
  });
}

/** Hosts aller geladenen Ressourcen, die nicht vom eigenen Host stammen. */
export function fremdeHosts(): string[] {
  const eigen = window.location.origin;
  const hosts = performance
    .getEntriesByType('resource')
    .map((r) => r.name)
    .filter((url) => url.startsWith('http') && new URL(url).origin !== eigen)
    .map((url) => new URL(url).host);
  return [...new Set(hosts)];
}

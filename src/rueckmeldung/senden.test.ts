import { beforeEach, describe, expect, it, vi } from 'vitest';
import { abschicken } from './senden';

describe('Abschicken der Rückmeldung', () => {
  // Wie Hefta im Web: ohne Capacitor, also der Empfang vom eigenen Ursprung.
  beforeEach(() => vi.stubGlobal('window', {}));

  it('schickt nur Frage und Antwort, ohne Cookie und Referrer', async () => {
    const aufrufe: [string, RequestInit][] = [];
    const holen = (async (url: string, init: RequestInit) => {
      aufrufe.push([url, init]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    expect(await abschicken('geholfen', 'teils', holen)).toBe('ok');
    const [url, init] = aufrufe[0]!;
    expect(url).toBe('/api/rueckmeldung');
    expect(JSON.parse(init.body as string)).toEqual({ f: 'geholfen', a: 'teils' });
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });

  it('ohne Netz oder bei Fehler: „aus“, nichts wird wiederholt', async () => {
    let n = 0;
    const weg = (async () => {
      n++;
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await abschicken('woher', 'suche', weg)).toBe('aus');
    expect(n).toBe(1);
    const kaputt = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    expect(await abschicken('woher', 'suche', kaputt)).toBe('aus');
  });
});

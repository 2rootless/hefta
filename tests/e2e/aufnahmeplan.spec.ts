import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// PC188: Der Aufnahmeplan für die Store-Bilder (src/app/aufnahmen.ts) läuft im Browser so wie im Simulator.
// Nur mit AUFNAHMEPLAN=1 und einem Bau mit VITE_AUFNAHMEN=1 und den Musterdateien in dist/aufnahme.
test('Aufnahmeplan erreicht die Bildschirme 01 bis 09', async ({ page, browserName }) => {
  test.skip(
    browserName !== 'chromium' || !process.env.AUFNAHMEPLAN,
    'nur mit dem Bau für die Aufnahmen',
  );
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 440, height: 956 });
  mkdirSync('test-results/aufnahmeplan', { recursive: true });
  const meldungen: string[] = [];
  const fertig = new Promise<void>((ok) =>
    page.on('console', async (m) => {
      const text = m.text();
      if (!text.startsWith('AUFNAHME ')) return;
      meldungen.push(text);
      const bereit = /^AUFNAHME BEREIT (\d+)$/.exec(text);
      if (bereit) await page.screenshot({ path: `test-results/aufnahmeplan/${bereit[1]}.png` });
      if (/FERTIG|FEHLER/.test(text)) ok();
    }),
  );
  await page.goto('/');
  await fertig;
  console.log(meldungen.join('\n'));
  expect(meldungen.filter((m) => m.startsWith('AUFNAHME BEREIT'))).toHaveLength(9);
  expect(meldungen.at(-1)).toBe('AUFNAHME FERTIG');
});

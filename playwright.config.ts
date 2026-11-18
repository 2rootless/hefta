import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Browser-Tests gegen den fertigen Build (vite preview), im Format 390 × 844 wie im Design.
// WebKit ist die Engine von Safari und kommt dem iPhone am nächsten.

// Die Vorlagen der Website (web/) gehen nicht ins öffentliche Repository. Dort gibt es also kein dist-web/: Der
// Server der Website startet nicht, und ihre Tests fallen weg (wie build/webseite.test.ts in vite.config.ts).
const MIT_WEBSITE = existsSync('web');
const NUR_WEBSITE = [
  'pc81-website.spec.ts',
  'pc88-website.spec.ts',
  'ratgeber.spec.ts',
  'webseite.spec.ts',
  'wunsch-w34-w35.spec.ts',
];

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: MIT_WEBSITE ? [] : NUR_WEBSITE.map((d) => '**/' + d),
  timeout: 120_000,
  // Hängt ein Worker, etwa beim Start eines Browsers, greift die Grenze je Test nicht: Dann endet der Lauf
  // hier mit einem Fehler, statt still zu stehen. Ein voller Lauf dauert hier rund zehn Minuten; auf dem Linux-Rechner
  // von GitHub mit zwei Workern rund 66 (zweite Reihe am 18.11.: 1,1 Stunden), darum dort 90.
  globalTimeout: process.env.CI ? 5_400_000 : 1_200_000,
  // Dateien laufen nebeneinander, die Tests einer Datei nacheinander. Darum darf kein Test etwas ändern, das
  // andere lesen: `dist/` bleibt unberührt (neue Version: `eigener-server.ts`).
  workers: '50%',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Ohne Einblenden: Kontrast- und Lageprüfungen sollen nie mitten in eine Bewegung fallen.
    // Die Bewegung selbst prüft tests/e2e/bewegung.spec.ts.
    contextOptions: { reducedMotion: 'reduce' },
    // Sprache und Region wie auf dem iPhone: Datumsfelder und Zahlen erscheinen wie dort (B10).
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    {
      name: 'chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
    },
    {
      // Die Vermieter-Seite mit ihren echten Kopfzeilen: Die Regel für den Worker steht nur dort.
      command: 'node scripts/vorschau-vermieter.mjs',
      url: 'http://localhost:4174',
      reuseExistingServer: false,
    },
    // Die Website (dist-web/, build/webseite.ts) mit Kopfzeilen und Weiterleitungen wie bei Cloudflare.
    ...(MIT_WEBSITE
      ? [
          {
            command: 'node scripts/vorschau-web.mjs 4175',
            url: 'http://localhost:4175',
            reuseExistingServer: false,
          },
        ]
      : []),
  ],
});

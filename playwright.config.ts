import { defineConfig, devices } from '@playwright/test';

// Browser-Tests gegen den fertigen Build (vite preview), im Format 390 × 844 wie im Design.
// WebKit ist die Engine von Safari und kommt dem iPhone am nächsten.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  // Hängt ein Worker, etwa beim Start eines Browsers, greift die Grenze je Test nicht: Dann endet der Lauf
  // hier mit einem Fehler, statt still zu stehen. Ein voller Lauf dauert sonst rund sieben Minuten.
  globalTimeout: 1_200_000,
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
  ],
});

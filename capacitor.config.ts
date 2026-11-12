import type { CapacitorConfig } from '@capacitor/cli';

// Hefta als iOS- und Android-App (docs/18-plan-native-app.md). Alles liegt in der App,
// nichts wird nachgeladen.
const config: CapacitorConfig = {
  appId: 'de.hefta.app',
  appName: 'Hefta',
  webDir: 'dist',
  // Gleiches Erscheinungsbild wie die Seite, bevor sie gezeichnet ist.
  backgroundColor: '#faf6ef',
  ios: { contentInset: 'never', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
};

export default config;

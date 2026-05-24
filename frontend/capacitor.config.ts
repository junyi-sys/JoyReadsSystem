import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.junyi.reading',
  appName: '俊宜阅读',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mysteryliquidsort.app',
  appName: 'Mystery Liquid Sort',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.table.twentyone',
  appName: 'Table21',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    CapacitorCookies: {
      enabled: false,
    },
  },
};

export default config;

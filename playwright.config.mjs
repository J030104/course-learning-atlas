import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  use: {
    browserName: 'chromium',
    launchOptions: process.env.ATLAS_BROWSER ? { executablePath: process.env.ATLAS_BROWSER } : {},
  },
});

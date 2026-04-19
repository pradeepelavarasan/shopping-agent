import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    headless: false, // Browser extensions only work in non-headless mode (or special headful mode)
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'Chromium',
      use: { browserName: 'chromium' },
    },
  ],
});

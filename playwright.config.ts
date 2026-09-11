import { defineConfig, devices } from '@playwright/test';
const port = process.env.TEST_PORT ?? '3100';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: 'bun run start',
    env: { PORT: port },
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.CHROME_CHANNEL,
      },
    },
    {
      name: 'webkit',
      workers: 1,
      timeout: 90_000,
      use: {
        ...devices['Desktop Safari'],
        launchOptions: { executablePath: process.env.WEBKIT_EXECUTABLE },
      },
    },
  ],
});

const { defineConfig, devices } = require('@playwright/test');
const port = process.env.TEST_PORT || '8081';
module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  timeout: process.env.CI ? 60000 : 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: 'target/debug/table-server',
    env: { PORT: port },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'media.peerconnection.ice.loopback': process.env.LOCAL_TURN_TEST === 'true' } } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], launchOptions: { executablePath: process.env.WEBKIT_EXECUTABLE } } },
  ],
});

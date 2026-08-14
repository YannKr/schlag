import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // Timer-driven tests wait out real countdowns; CI runners are slow.
  timeout: isCI ? 90_000 : 60_000,
  expect: { timeout: isCI ? 15_000 : 10_000 },
  // CI retries surface genuine failures while tolerating timing flake;
  // Playwright still reports retried passes separately as "flaky".
  retries: isCI ? 2 : 0,
  // GitHub-hosted runners have 4 vCPU. More workers starves the timer tests.
  workers: isCI ? 2 : undefined,
  forbidOnly: isCI,
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8081',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
  // Serve the static web export instead of booting Metro. `expo start --web`
  // needs a cold bundle before the first test can run, which regularly blew
  // through the old 60s webServer timeout. Run the export first:
  //   npx expo export --platform web
  webServer: {
    command: 'node scripts/serve-web.mjs',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

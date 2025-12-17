import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing of Stream Deck plugin UI
 *
 * Tests the property inspector and plugin interaction flows
 * Includes visual regression testing with screenshot comparison
 */
export default defineConfig({
  testDir: './test/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Snapshot settings for visual regression testing */
  snapshotDir: './test/e2e/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{testName}-{projectName}{ext}',

  /* Screenshot comparison settings */
  expect: {
    toHaveScreenshot: {
      /* Allow a small percentage of pixels to differ (handles anti-aliasing) */
      maxDiffPixelRatio: 0.01,
      /* Threshold for comparing individual pixels (0-1, where 1 is maximum difference) */
      threshold: 0.2,
      /* Animation handling */
      animations: 'disabled',
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3333',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  /* Stream Deck property inspectors run in Chromium-based CEF, so we only need Chromium */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'node test/server/test-server.js',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
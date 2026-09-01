import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'production.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [['line'], ['html', { outputFolder: 'playwright-report-production', open: 'never' }]],
  use: {
    baseURL: 'https://rudwndgus.github.io/t-log/',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})

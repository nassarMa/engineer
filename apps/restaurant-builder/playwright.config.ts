import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const baseURL = `http://localhost:${PORT}`
const systemChromium = '/opt/pw-browsers/chromium'
const launchOptions = fs.existsSync(systemChromium) ? { executablePath: systemChromium, args: ['--no-sandbox'] } : {}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure', ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions },
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, AI_PROVIDER: 'mock', APP_URL: baseURL, DATA_DIR: '.data-e2e', BUILD_RATE_LIMIT: '100', PLATFORM_DOMAIN: '' },
  },
})

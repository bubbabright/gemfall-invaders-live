import { defineConfig } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

/**
 * Two form factors, two specs:
 *  - desktop: mouse/keyboard machine, solo-only UI (no co-op)
 *  - phone:   touch-primary, solo only, single thumb dock
 *
 * `npm run dev` serves on port 3000 (see package.json), so Playwright starts it
 * and waits for the URL rather than testing a stale `dist/` build.
 */
export default defineConfig({
  testDir: './tests',
  // The WebGL scene is heavy; without GPU the software rasterizer needs ~150ms
  // a frame and every Playwright action waits on it. Budget for that.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // One browser at a time: each test owns the full viewport and a WebGL canvas.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Use the host GPU via ANGLE/Vulkan when one exists (measured 17ms vs
    // 151ms a frame on AMD Renoir). Machines without Vulkan fall back to
    // SwiftShader, so the suite still runs there — just slower.
    launchOptions: {
      args: ['--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan'],
    },
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /(?:desktop|sortie-readout|depth-lane)\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      testMatch: /phone\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

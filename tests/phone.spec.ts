import { expect, test, type Page } from '@playwright/test';

const LAUNCH = /LAUNCH BATTLE WITH SOUND/i;
const NEXT_SORTIE = /LAUNCH NEXT SORTIE/i;
const STEER_PAD = 'thumb-steer';
const PAUSED = { name: 'Game paused' } as const;

/** Reads live engine state through the dev-only window hook (see App.tsx). */
async function readEngine(page: Page) {
  return page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    // Starfield z-drift advances every simulated frame and freezes while
    // paused, so it proves the loop itself stopped — not just a flag.
    // (stats.ufoTimer is never written by the engine; asserting on it would
    // pass trivially.)
    const drift = Array.from(eng.starPositions.slice(0, 9) as Float32Array).join(',');
    return {
      lives: eng.p1.lives as number,
      isAlive: eng.p1.isAlive as boolean,
      shipVisible: eng.p1Mesh.visible as boolean,
      running: eng.isRunning as boolean,
      paused: eng.isPaused as boolean,
      flow: drift,
    };
  });
}

const isPaused = (page: Page) => readEngine(page).then((state) => state.paused);

/**
 * Projects the ship to screen pixels and measures the thumb dock. The dock is
 * the one element the player physically touches, so it is the reference point
 * for "the lower HUD is covering the game".
 */
async function readLayout(page: Page) {
  return page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    const projected = eng.p1Mesh.position.clone();
    projected.y = 0.4;
    projected.project(eng.camera);
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const steer = document.querySelector('[data-testid="thumb-steer"]');
    const dock = steer?.closest('.pointer-events-auto')?.getBoundingClientRect();
    const pad = steer?.getBoundingClientRect();

    return {
      shipY: (-projected.y * 0.5 + 0.5) * canvas.height,
      canvasBottom: canvas.bottom,
      dockTop: dock ? dock.top : null,
      steerPadWidth: pad ? pad.width : null,
      viewportHeight: innerHeight,
    };
  });
}

test('phone: solo-only title and one-thumb dock', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Gemfall Invaders');
  await expect(page.getByRole('heading', { name: 'GEMFALL INVADERS' })).toBeVisible();

  // Solo-first: a touch-primary device gets no way to select a second ship.
  await expect(page.getByText(/SOLO ARCADE/)).toBeVisible();
  await expect(page.getByText('Solo Pilot • One-Thumb Glide')).toBeVisible();
  await expect(page.getByRole('button', { name: /Duo Co-op/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Pass & Play/i })).toHaveCount(0);
  // Rendered but `hidden` — assert on visibility, not DOM presence.
  await expect(page.getByText('STARLIGHT ACE')).toBeHidden();

  // The dock belongs to a running game, not the title screen.
  await expect(page.getByTestId(STEER_PAD)).toHaveCount(0);

  await page.getByRole('button', { name: LAUNCH }).click();

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId(STEER_PAD)).toBeVisible();
  await expect(page.getByRole('button', { name: /FIRE/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /AUTO/i })).toBeVisible();
  // Exactly one dock: the split two-player layout must not come back.
  await expect(page.getByTestId(STEER_PAD)).toHaveCount(1);
  await expect(page.getByRole('button', { name: /FIRE/i })).toHaveCount(1);

  // The arena is rendered above the control band, and the ship clears the dock.
  const layout = await readLayout(page);
  expect(layout.dockTop).not.toBeNull();
  expect(layout.canvasBottom).toBeLessThanOrEqual(layout.dockTop!);
  expect(layout.shipY).toBeLessThan(layout.dockTop!);
  // The steer pad must keep usable width next to FIRE / AUTO / pause.
  expect(layout.steerPadWidth).not.toBeNull();
  expect(layout.steerPadWidth!).toBeGreaterThan(120);
  // The tactical dock handle stays reachable below the thumb dock.
  await expect(page.getByRole('button', { name: /Show Tactical Controls/i })).toBeVisible();

  expect(errors).toEqual([]);
});

test('phone: thumb-dock pause freezes the swarm and resume restarts it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  // Two pause controls exist (top HUD + thumb dock); the dock's is the last.
  await page.getByRole('button', { name: 'Pause game' }).last().click();

  const dialog = page.getByRole('dialog', PAUSED);
  await expect(dialog).toBeVisible();
  await expect.poll(() => isPaused(page)).toBe(true);

  const frozen = (await readEngine(page)).flow;
  await page.waitForTimeout(400);
  expect((await readEngine(page)).flow).toBe(frozen);

  await page.getByRole('button', { name: /RESUME MISSION/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => isPaused(page)).toBe(false);
  await expect.poll(async () => (await readEngine(page)).flow, { timeout: 3000 }).not.toBe(
    frozen
  );

  expect(errors).toEqual([]);
});

test('phone: landscape keeps the ship above the thumb dock', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  const layout = await readLayout(page);
  expect(layout.dockTop).not.toBeNull();
  expect(layout.canvasBottom).toBeLessThanOrEqual(layout.dockTop!);
  expect(layout.shipY).toBeLessThan(layout.dockTop!);
});

test('phone: respawn after game over leaves a visible ship', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  // Precondition: spending the last life hides the ship (hitPlayer is private
  // in TS, but plain JS at runtime — private is erased, nothing is mangled in dev).
  await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    for (let i = 0; i < 3; i++) eng.hitPlayer();
  });

  await expect.poll(() => readEngine(page)).toMatchObject({
    lives: 0,
    isAlive: false,
    shipVisible: false,
    running: false,
  });
  await expect(page.getByRole('button', { name: NEXT_SORTIE })).toBeVisible();

  await page.getByRole('button', { name: NEXT_SORTIE }).click();

  // The regression this guards: restart() reset the profile but left the mesh
  // hidden, so the next sortie flew an invisible fighter.
  await expect.poll(() => readEngine(page)).toMatchObject({
    lives: 3,
    isAlive: true,
    shipVisible: true,
    running: true,
    paused: false,
  });
  await expect(page.getByRole('button', { name: NEXT_SORTIE })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('phone canvas buffer tracks the device pixel ratio', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );

  const buffer = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    const canvas = eng.renderer.domElement as HTMLCanvasElement;
    return {
      ratio: eng.renderer.getPixelRatio() as number,
      width: canvas.width,
      css: canvas.clientWidth,
    };
  });

  expect(buffer.ratio).toBeGreaterThan(1);
  expect(buffer.width).toBeGreaterThanOrEqual(Math.floor(buffer.css * buffer.ratio) - 1);
});

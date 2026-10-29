import { expect, test, type Page } from '@playwright/test';

const LAUNCH = /LAUNCH BATTLE WITH SOUND/i;

async function launch(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));
}

test('opening the title does not record a best wave', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));
  await expect(page.getByTestId('title-best-wave')).toHaveText('BEST WAVE 00');
  const stored = await page.evaluate(() => localStorage.getItem('gemfall_best_wave'));
  expect(stored).toBeNull();
});

test('title shows a stored best wave', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gemfall_best_wave', '7'));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));
  await expect(page.getByTestId('title-best-wave')).toHaveText('BEST WAVE 07');
  const stored = await page.evaluate(() => localStorage.getItem('gemfall_best_wave'));
  expect(stored).toBe('7');
});

test('bunkers survive the next wave and a new sortie rebuilds them', async ({ page }) => {
  await launch(page);

  const bunkers = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;
    const full = eng.bunkerBlocks.length as number;
    while (eng.bunkerBlocks.length > 10) eng.damageBunkerBlock(0, 2);
    const survivor = eng.bunkerBlocks[0];
    survivor.health = 1;
    const id = survivor.id as string;
    eng.spawnWave(3);
    const kept = eng.bunkerBlocks.find((block: { id: string }) => block.id === id);
    const keptCount = eng.bunkerBlocks.length as number;
    const keptHealth = kept ? (kept.health as number) : null;
    eng.restart();
    const blocks = eng.bunkerBlocks as { health: number }[];
    return {
      full,
      keptCount,
      keptHealth,
      rebuiltCount: blocks.length,
      allFresh: blocks.every((block) => block.health === 2),
    };
  });

  expect(bunkers.keptCount).toBe(10);
  expect(bunkers.keptHealth).toBe(1);
  expect(bunkers.rebuiltCount).toBe(bunkers.full);
  expect(bunkers.allFresh).toBe(true);
});

test('a trigger counts once, even when several bolts connect', async ({ page }) => {
  await launch(page);

  const accuracy = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;
    eng.p1.activePowerup = 'spread_shot';
    eng.firePlayerLaser();
    const spread = eng.lasers.filter((laser: { owner: string }) => laser.owner === 'p1');
    const targets = eng.invaders.slice(0, 2);
    spread[0].x = targets[0].x;
    spread[0].z = targets[0].z;
    spread[1].x = targets[1].x;
    spread[1].z = targets[1].z;
    eng.checkCollisions();

    const afterSpread = { fired: eng.p1.shotsFired as number, hit: eng.p1.shotsHit as number };

    eng.p1.activePowerup = 'laser_beam';
    eng.firePlayerLaser();
    const beam = eng.lasers.filter((laser: { isBeam?: boolean }) => laser.isBeam).at(-1);
    const left = eng.invaders.slice(0, 2);
    beam.x = left[0].x;
    beam.z = left[0].z;
    eng.checkCollisions();
    beam.x = left[1].x;
    beam.z = left[1].z;
    eng.checkCollisions();

    return {
      spreadFired: afterSpread.fired,
      spreadHit: afterSpread.hit,
      spreadBolts: spread.length,
      fired: eng.p1.shotsFired as number,
      hit: eng.p1.shotsHit as number,
    };
  });

  expect(accuracy.spreadBolts).toBe(3);
  expect(accuracy.spreadFired).toBe(1);
  expect(accuracy.spreadHit).toBe(1);
  expect(accuracy.fired).toBe(2);
  expect(accuracy.hit).toBe(2);
});

test('a kill floats the points it awarded', async ({ page }) => {
  await launch(page);

  await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;
    const dread = eng.invaders.find((inv: { type: string }) => inv.type === 'dreadnought');
    eng.stats.comboMultiplier = 4;
    eng.stats.comboTimer = 3.5;
    eng.destroyInvader(dread);
  });

  await expect(page.getByTestId('score-floater').filter({ hasText: '+160  4x' })).toBeVisible();
});

test('the debrief reports trigger accuracy and the wave reached', async ({ page }) => {
  await launch(page);

  await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;
    eng.firePlayerLaser();
    const bolt = eng.lasers.filter((laser: { owner: string }) => laser.owner === 'p1').at(-1);
    const target = eng.invaders[0];
    bolt.x = target.x;
    bolt.z = target.z;
    eng.checkCollisions();
    eng.triggerGameOver('Ship critical failure. Mission compromised!');
  });

  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByTestId('debrief-best-wave')).toHaveText('01');
  await expect(page.getByTestId('hud-best-wave')).toHaveText('BEST 01');
  const stored = await page.evaluate(() => localStorage.getItem('gemfall_best_wave'));
  expect(stored).toBe('1');
});

test('clearing the swarm releases geometries and the next wave still builds', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await launch(page);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const memory = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;
    const before = eng.renderer.info.memory.geometries as number;
    eng.clearInvaders();
    const after = eng.renderer.info.memory.geometries as number;
    eng.spawnWave(1);
    return {
      before,
      after,
      invaders: eng.invaders.length as number,
    };
  });

  expect(memory.after).toBeLessThan(memory.before);
  expect(memory.invaders).toBe(55);

  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(errors).toEqual([]);
});

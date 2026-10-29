import { expect, test, type Page } from '@playwright/test';

const LAUNCH = /LAUNCH BATTLE WITH SOUND/i;
const STEER_PAD = 'thumb-steer';
const PAUSED = { name: 'Game paused' } as const;

/** Live engine state + where the ship and the dock handle actually sit. */
async function readEngine(page: Page) {
  return page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    const v = eng.p1Mesh.position.clone();
    v.y = 0.4;
    v.project(eng.camera);
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    const handle = [...document.querySelectorAll('button')].find((button) =>
      /Show Tactical Controls|Hide Dock/.test(button.textContent || '')
    );

    // Starfield z-drift advances every simulated frame and freezes while
    // paused, so it proves the loop itself stopped — not just a flag.
    // (stats.ufoTimer is never written by the engine; asserting on it would
    // pass trivially.)
    const drift = Array.from(eng.starPositions.slice(0, 9) as Float32Array).join(',');
    return {
      paused: eng.isPaused as boolean,
      running: eng.isRunning as boolean,
      flow: drift,
      shipY: (-v.y * 0.5 + 0.5) * canvas.height,
      canvasBottom: canvas.bottom,
      dockHandleTop: handle ? handle.getBoundingClientRect().top : null,
    };
  });
}

const isPaused = (page: Page) => readEngine(page).then((state) => state.paused);

test('desktop with a touch screen keeps the thumb dock off the arena', async ({ browser }) => {
  // Touchscreen laptops report a fine pointer AND touch: the dock appears
  // (maxTouchPoints) while `(pointer: coarse)` does not match. The viewport
  // inset must follow the same flag as the dock, not the media query.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto('/');
    await page.getByRole('button', { name: LAUNCH }).click();
    await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

    // The dock is on screen even though this is a "desktop" viewport.
    await expect(page.getByTestId('thumb-steer')).toBeVisible();

    const layout = await page.evaluate(() => {
      const eng = (window as unknown as { __gemfall?: any }).__gemfall;
      const projected = eng.p1Mesh.position.clone();
      projected.y = 0.4;
      projected.project(eng.camera);
      const canvas = document.querySelector('canvas')!.getBoundingClientRect();
      const steer = document.querySelector('[data-testid="thumb-steer"]');
      const dock = steer?.closest('.pointer-events-auto')?.getBoundingClientRect();
      return {
        shipY: (-projected.y * 0.5 + 0.5) * canvas.height,
        canvasBottom: canvas.bottom,
        dockTop: dock ? dock.top : null,
      };
    });
    expect(layout.dockTop).not.toBeNull();
    expect(layout.canvasBottom).toBeLessThanOrEqual(layout.dockTop!);
    expect(layout.shipY).toBeLessThan(layout.dockTop!);

    // …and the pause overlay speaks touch, not P/Esc.
    await page.getByRole('button', { name: 'Pause game' }).last().click();
    await expect(page.getByRole('dialog', PAUSED)).toBeVisible();
    await expect(page.getByText('Tap Resume to re-engage')).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test('desktop: the game is solo-only — no co-op anywhere in the UI', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Gemfall Invaders');
  await expect(page.getByRole('heading', { name: 'GEMFALL INVADERS' })).toBeVisible();

  // Solo-first on every device: no duo selection anywhere.
  await expect(page.getByText(/SOLO ARCADE/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Duo Co-op/i })).toHaveCount(0);
  // A second pilot does not exist at all — not even rendered hidden.
  await expect(page.getByText('STARLIGHT ACE')).toHaveCount(0);
  // Keyboard device: no thumb dock, even before launching.
  await expect(page.getByTestId(STEER_PAD)).toHaveCount(0);

  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  // No second pilot in the HUD, and the touch dock still must not appear.
  await expect(page.getByText('STARLIGHT ACE')).toHaveCount(0);
  await expect(page.getByTestId(STEER_PAD)).toHaveCount(0);

  // The tactical dock starts collapsed, so the lower HUD never sits on the arena.
  const handle = page.getByRole('button', { name: /Show Tactical Controls/i });
  await expect(handle).toBeVisible();
  await expect(page.getByRole('dialog', PAUSED)).toHaveCount(0);

  const atRest = await readEngine(page);
  expect(atRest.paused).toBe(false);
  expect(atRest.dockHandleTop).not.toBeNull();
  expect(atRest.shipY).toBeLessThan(atRest.dockHandleTop!);

  // Opening it used to drop the dock over the ship; now it suspends the fight.
  await handle.click();
  const dialog = page.getByRole('dialog', PAUSED);
  await expect(dialog).toBeVisible();
  await expect.poll(() => isPaused(page)).toBe(true);

  const frozen = (await readEngine(page)).flow;
  await page.waitForTimeout(400);
  expect((await readEngine(page)).flow).toBe(frozen);

  // The dock has no Game Mode tab: only Themes and Techno Audio.
  await expect(page.getByRole('button', { name: /Game Mode/i })).toHaveCount(0);
  await expect(page.getByText('Themes')).toBeVisible();
  await expect(page.getByText('Techno Audio')).toBeVisible();

  // Collapsing the dock gives the fight back.
  await page.getByRole('button', { name: /Hide Dock/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => isPaused(page)).toBe(false);

  expect(errors).toEqual([]);
});

test('desktop: P and Escape pause the fight, and the HUD button resumes it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  const dialog = page.getByRole('dialog', PAUSED);
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();

  await page.keyboard.press('p');
  await expect(dialog).toBeVisible();
  await expect.poll(() => isPaused(page)).toBe(true);

  // The swarm must not advance while paused.
  const frozen = (await readEngine(page)).flow;
  await page.waitForTimeout(450);
  expect((await readEngine(page)).flow).toBe(frozen);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => isPaused(page)).toBe(false);
  await expect.poll(async () => (await readEngine(page)).flow, { timeout: 3000 }).not.toBe(
    frozen
  );

  // The HUD toggle pauses and the overlay's own button resumes.
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: /RESUME MISSION/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => isPaused(page)).toBe(false);

  expect(errors).toEqual([]);
});

test('alien shots are a facing diamond, not a laser cylinder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  const info = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall: any }).__gemfall;
    eng.isPaused = true;
    eng.invaderFireLaser();
    eng.firePlayerLaser();
    // Slide the drop into the open lane so the screenshot shows the glyph, not a spark in the swarm.
    for (const laser of eng.lasers) {
      if (laser.owner === 'invader') {
        laser.z = 2.2;
        const mesh = eng.laserMeshes.get(laser.id);
        if (mesh) {
          mesh.position.set(laser.x, 0.9, laser.z);
          eng.orientAlienShot(mesh);
        }
      }
    }

    const shots = [...eng.laserMeshes.values()].map((mesh: any) => {
      mesh.updateMatrixWorld(true);
      const pos = mesh.position;
      const cam = eng.camera.position;
      const toCamX = cam.x - pos.x;
      const toCamY = cam.y - pos.y;
      const toCamZ = cam.z - pos.z;
      const len = Math.hypot(toCamX, toCamY, toCamZ) || 1;
      // lookAt points the group's +Z at the camera (column 2 of matrixWorld).
      const mz = mesh.matrixWorld.elements;
      const plusZLen = Math.hypot(mz[8], mz[9], mz[10]) || 1;
      const facesCamera = (mz[8] * toCamX + mz[9] * toCamY + mz[10] * toCamZ) / (len * plusZLen);
      return {
        name: mesh.name as string,
        childTypes: mesh.children.map((c: any) => c.geometry?.type),
        rimHex: mesh.getObjectByName('alien_shot_rim')?.material?.color?.getHexString?.() ?? null,
        facesCamera,
      };
    });
    return shots;
  });

  const alien = info.find((shot) => shot.name === 'alien_shot');
  const player = info.find((shot) => shot.name === 'player_laser');
  expect(alien).toBeTruthy();
  expect(player).toBeTruthy();
  expect(alien!.childTypes).toEqual([
    'OctahedronGeometry',
    'OctahedronGeometry',
    'OctahedronGeometry',
  ]);
  expect(player!.childTypes.every((type: string) => type === 'CylinderGeometry')).toBe(true);
  expect(alien!.rimHex).toBe('ff9f1c');
  expect(alien!.facesCamera).toBeGreaterThan(0.9);

  await page.screenshot({ path: 'test-results/alien-shot-glyph.png' });
  expect(errors).toEqual([]);
});

test('player ship wings are mirrored, not spun 180', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  const info = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall: any }).__gemfall;
    eng.isPaused = true;
    eng.p1Mesh.rotation.set(0, 0, 0);
    eng.p1Mesh.updateMatrixWorld(true);

    const boxOf = (name: string) => {
      const mesh = eng.p1Mesh.getObjectByName(name);
      const pos = mesh.geometry.attributes.position;
      const e = mesh.matrixWorld.elements;
      let minx = Infinity,
        maxx = -Infinity,
        miny = Infinity,
        maxy = -Infinity,
        minz = Infinity,
        maxz = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (wx < minx) minx = wx;
        if (wx > maxx) maxx = wx;
        if (wy < miny) miny = wy;
        if (wy > maxy) maxy = wy;
        if (wz < minz) minz = wz;
        if (wz > maxz) maxz = wz;
      }
      return { minx, maxx, miny, maxy, minz, maxz };
    };

    const L = boxOf('wing_left');
    const R = boxOf('wing_right');
    return {
      L,
      R,
      xMirror: Math.abs(L.minx + R.maxx) + Math.abs(L.maxx + R.minx),
      yMatch: Math.abs(L.miny - R.miny) + Math.abs(L.maxy - R.maxy),
      zMatch: Math.abs(L.minz - R.minz) + Math.abs(L.maxz - R.maxz),
    };
  });

  expect(info.xMirror).toBeLessThan(0.08);
  expect(info.yMatch).toBeLessThan(0.08);
  expect(info.zMatch).toBeLessThan(0.08);

  await page.screenshot({ path: 'test-results/ship-wings.png' });
  expect(errors).toEqual([]);
});

test('powerups bolt a colored Mario kit onto the ship', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  const info = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall: any }).__gemfall;
    eng.isPaused = true;
    const vis = (name: string) => Boolean(eng.p1Mesh.getObjectByName(name)?.visible);
    const snap = () => ({
      rapid: vis('kit_rapid_fire'),
      spread: vis('kit_spread_shot'),
      shield: vis('kit_plasma_shield'),
      scale: eng.p1Mesh.scale.x as number,
    });
    const before = snap();
    eng.applyPowerup('rapid_fire');
    const rapid = snap();
    eng.applyPowerup('spread_shot');
    const spread = snap();
    return { before, rapid, spread };
  });

  expect(info.before.rapid).toBe(false);
  expect(info.before.spread).toBe(false);
  expect(info.rapid.rapid).toBe(true);
  expect(info.rapid.spread).toBe(false);
  expect(info.rapid.scale).toBeGreaterThan(info.before.scale);
  expect(info.spread.spread).toBe(true);
  expect(info.spread.rapid).toBe(false);

  await expect(page.getByText('SPREAD')).toBeVisible();
  await page.screenshot({ path: 'test-results/ship-spread-kit.png' });
  expect(errors).toEqual([]);
});

test('gun suits: default single shot, mutex, beam pierce, front-column fire, i-frames', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));

  const info = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall: any }).__gemfall;
    eng.isPaused = true;
    eng.keysDown = {};
    eng.touchInputP1.fire = false;
    eng.touchInputP1.autoFire = false;

    const playerBolts = () => eng.lasers.filter((l: { owner: string }) => l.owner === 'p1');
    const alienBolts = () => eng.lasers.filter((l: { owner: string }) => l.owner === 'invader');

    eng.firePlayerLaser();
    const defaultCount = playerBolts().length;
    const defaultBeam = playerBolts().every((l: { isBeam?: boolean }) => !l.isBeam);

    eng.applyPowerup('rapid_fire');
    const afterRapid = {
      kit: Boolean(eng.p1Mesh.getObjectByName('kit_rapid_fire')?.visible),
      shield: eng.p1.shieldActive as boolean,
      bolts: (() => {
        const before = playerBolts().length;
        eng.firePlayerLaser();
        return playerBolts().length - before;
      })(),
    };

    eng.applyPowerup('plasma_shield');
    const shieldSuit = {
      kit: Boolean(eng.p1Mesh.getObjectByName('kit_plasma_shield')?.visible),
      rapidKit: Boolean(eng.p1Mesh.getObjectByName('kit_rapid_fire')?.visible),
      shield: eng.p1.shieldActive as boolean,
      active: eng.p1.activePowerup as string | null,
    };

    eng.applyPowerup('rapid_fire');
    const mutex = {
      shield: eng.p1.shieldActive as boolean,
      active: eng.p1.activePowerup as string | null,
      rapidKit: Boolean(eng.p1Mesh.getObjectByName('kit_rapid_fire')?.visible),
      shieldKit: Boolean(eng.p1Mesh.getObjectByName('kit_plasma_shield')?.visible),
    };

    eng.applyPowerup('emp_nuke');
    const afterEmp = {
      active: eng.p1.activePowerup as string | null,
      remaining: eng.invaders.length as number,
    };

    eng.applyPowerup('spread_shot');
    const beforeSpread = playerBolts().length;
    eng.firePlayerLaser();
    const spreadCount = playerBolts().length - beforeSpread;

    eng.applyPowerup('laser_beam');
    const beforeBeam = playerBolts().length;
    eng.firePlayerLaser();
    const beamBolts = playerBolts().slice(beforeBeam);
    const col = 5;
    const stack = (eng.invaders as { col: number; x: number; z: number; id: string }[])
      .filter((i) => i.col === col)
      .sort((a, b) => b.z - a.z);
    const bolt = beamBolts[0];
    const beforeCount = eng.invaders.length as number;
    if (bolt && stack.length >= 2) {
      bolt.x = stack[0].x;
      bolt.z = stack[0].z;
      eng.checkCollisions();
      bolt.z = stack[1].z;
      eng.checkCollisions();
    }
    const beam = {
      count: beamBolts.length,
      isBeam: Boolean(bolt?.isBeam),
      stillFlying: Boolean(bolt && eng.lasers.some((l: { id: string }) => l.id === bolt.id)),
      killed: beforeCount - (eng.invaders.length as number),
    };

    // Leave one column, kill its front ship, the next shot must come from the new front.
    const keepCol = 3;
    for (const inv of [...eng.invaders]) {
      if (inv.col !== keepCol) eng.destroyInvader(inv);
    }
    const ranked = [...eng.invaders].sort(
      (a: { z: number }, b: { z: number }) => b.z - a.z
    );
    const frontZ = ranked[0].z as number;
    eng.destroyInvader(ranked[0]);
    const newFrontZ = Math.max(...eng.invaders.map((i: { z: number }) => i.z));
    eng.invaderFireLaser();
    const alien = alienBolts()[alienBolts().length - 1];
    const colMates = (eng.invaders as { x: number; z: number }[]).filter(
      (i) => Math.abs(i.x - alien.x) < 0.05
    );
    const frontShip = colMates.reduce((a, b) => (a.z > b.z ? a : b));

    const livesBefore = eng.p1.lives as number;
    eng.hitPlayer();
    const livesAfterHit = eng.p1.lives as number;
    eng.hitPlayer();
    const livesDuringIframes = eng.p1.lives as number;

    return {
      defaultCount,
      defaultBeam,
      afterRapid,
      shieldSuit,
      mutex,
      afterEmp,
      spreadCount,
      beam,
      frontFire: {
        oldFrontZ: frontZ,
        newFrontZ,
        shotZ: alien?.z ?? null,
        frontShipZ: frontShip?.z ?? null,
        fromFront: Boolean(
          alien && frontShip && Math.abs(alien.z - (frontShip.z + 0.6)) < 0.05
        ),
      },
      iframes: { livesBefore, livesAfterHit, livesDuringIframes },
    };
  });

  expect(info.defaultCount).toBe(1);
  expect(info.defaultBeam).toBe(true);
  expect(info.afterRapid.bolts).toBe(2);
  expect(info.afterRapid.kit).toBe(true);
  expect(info.shieldSuit.shield).toBe(true);
  expect(info.shieldSuit.rapidKit).toBe(false);
  expect(info.mutex.shield).toBe(false);
  expect(info.mutex.active).toBe('rapid_fire');
  expect(info.mutex.rapidKit).toBe(true);
  expect(info.mutex.shieldKit).toBe(false);
  expect(info.afterEmp.active).toBe('rapid_fire');
  expect(info.spreadCount).toBe(3);
  expect(info.beam.count).toBe(1);
  expect(info.beam.isBeam).toBe(true);
  expect(info.beam.stillFlying).toBe(true);
  expect(info.beam.killed).toBe(2);
  expect(info.frontFire.fromFront).toBe(true);
  expect(info.iframes.livesAfterHit).toBe(info.iframes.livesBefore - 1);
  expect(info.iframes.livesDuringIframes).toBe(info.iframes.livesAfterHit);
  expect(errors).toEqual([]);
});

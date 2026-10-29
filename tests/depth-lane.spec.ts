import { expect, test, type Page } from '@playwright/test';

const LAUNCH = /LAUNCH BATTLE WITH SOUND/i;

async function launch(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: LAUNCH }).click();
  await page.waitForFunction(() => Boolean((window as unknown as { __gemfall?: unknown }).__gemfall));
}

test('strafe and depth follow the corridor axes', async ({ page }) => {
  await launch(page);

  const motion = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;
    const homeZ = eng.p1Mesh.position.z as number;
    const homeX = eng.p1Mesh.position.x as number;

    eng.keysDown = { KeyW: true };
    eng.updatePlayers(0.5);
    const pushed = {
      z: eng.p1Mesh.position.z as number,
      pitch: eng.p1Mesh.rotation.x as number,
    };

    eng.keysDown = { KeyS: true };
    eng.updatePlayers(0.8);
    const dropped = eng.p1Mesh.position.z as number;

    eng.keysDown = { KeyD: true };
    eng.updatePlayers(0.2);
    const right = eng.p1Mesh.position.x as number;

    eng.keysDown = { KeyA: true };
    eng.updatePlayers(0.45);
    const left = eng.p1Mesh.position.x as number;

    eng.keysDown = {};
    eng.touchInputP1.moveZ = 1;
    const beforePad = eng.p1Mesh.position.z as number;
    eng.updatePlayers(0.15);
    const padForward = eng.p1Mesh.position.z as number;

    // Camera rests on +Z. Into the corridor is −Z, so the camera stays behind the fighter.
    eng.render(0.2);
    const cameraBehind = (eng.camera.position.z as number) > (eng.p1Mesh.position.z as number);

    const projected = eng.invaders.map((inv: { x: number; z: number }) => {
      const v = eng.p1Mesh.position.clone();
      v.set(inv.x, 0.45, inv.z);
      v.project(eng.camera);
      return v.x as number;
    }) as number[];

    return {
      homeZ,
      homeX,
      pushed,
      dropped,
      right,
      left,
      beforePad,
      padForward,
      cameraBehind,
      invaderNdcMin: Math.min(...projected),
      invaderNdcMax: Math.max(...projected),
    };
  });

  // W / pad-up move toward −Z (into the screen). S moves back toward the camera.
  expect(motion.pushed.z).toBeLessThan(motion.homeZ - 1);
  expect(motion.pushed.pitch).toBeLessThan(-0.1);
  expect(motion.dropped).toBeGreaterThan(motion.pushed.z + 1);
  expect(motion.right).toBeGreaterThan(motion.homeX);
  expect(motion.left).toBeLessThan(motion.homeX);
  expect(motion.padForward).toBeLessThan(motion.beforePad);
  expect(motion.cameraBehind).toBe(true);
  // The closer landscape rig still holds the whole pack on screen.
  expect(motion.invaderNdcMin).toBeGreaterThan(-1);
  expect(motion.invaderNdcMax).toBeLessThan(1);
});

test('the drawing buffer uses the device pixel ratio', async ({ page }) => {
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

  expect(buffer.ratio).toBeGreaterThan(0);
  expect(buffer.width).toBeGreaterThanOrEqual(Math.floor(buffer.css * buffer.ratio) - 1);
});

test('swarm hulls leave a gap and the fighter nose points downrange', async ({ page }) => {
  await launch(page);

  const layout = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.isPaused = true;

    const sizeOf = (root: { updateMatrixWorld: (force: boolean) => void; traverse: (fn: (obj: any) => void) => void }) => {
      root.updateMatrixWorld(true);
      let minx = Infinity;
      let maxx = -Infinity;
      let minz = Infinity;
      let maxz = -Infinity;
      root.traverse((obj) => {
        const pos = obj.geometry?.attributes?.position;
        if (!pos) return;
        const e = obj.matrixWorld.elements as number[];
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) as number;
          const y = pos.getY(i) as number;
          const z = pos.getZ(i) as number;
          const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
          const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (wx < minx) minx = wx;
          if (wx > maxx) maxx = wx;
          if (wz < minz) minz = wz;
          if (wz > maxz) maxz = wz;
        }
      });
      return { width: maxx - minx, depth: maxz - minz, minx, maxx };
    };

    const byType: Record<string, { width: number; depth: number }> = {};
    for (const inv of eng.invaders) {
      if (byType[inv.type]) continue;
      byType[inv.type] = sizeOf(eng.invaderMeshes.get(inv.id));
    }

    const scouts = eng.invaders
      .filter((inv: { row: number }) => inv.row === 0)
      .sort((a: { col: number }, b: { col: number }) => a.col - b.col);
    const a = sizeOf(eng.invaderMeshes.get(scouts[0].id));
    const b = sizeOf(eng.invaderMeshes.get(scouts[1].id));
    const gap = b.minx - a.maxx;

    const zs = eng.invaders.map((inv: { z: number }) => inv.z as number);
    eng.p1Mesh.updateMatrixWorld(true);
    const originZ = (obj: { matrixWorld: { elements: number[] } }) => obj.matrixWorld.elements[14];
    const colors = new Set<string>();
    eng.p1Mesh.traverse((obj: { material?: { color?: { getHexString: () => string } } | Array<{ color?: { getHexString: () => string } }> }) => {
      const material = obj.material;
      if (!material) return;
      const list = Array.isArray(material) ? material : [material];
      for (const entry of list) {
        if (entry.color) colors.add(entry.color.getHexString());
      }
    });

    return {
      byType,
      gap,
      front: Math.max(...zs),
      back: Math.min(...zs),
      noseZ: originZ(eng.p1Mesh.getObjectByName('nose')),
      thrustZ: originZ(eng.p1Mesh.getObjectByName('thrust_left')),
      colors: colors.size,
      hasStar: Boolean(eng.p1Mesh.getObjectByName('wing_star_l')),
    };
  });

  expect(layout.byType.scout.width).toBeLessThan(1.45);
  expect(layout.byType.cruiser.width).toBeLessThan(1.45);
  expect(layout.byType.dreadnought.width).toBeLessThan(1.45);
  expect(layout.byType.scout.depth).toBeLessThan(1.05);
  expect(layout.gap).toBeGreaterThan(0.3);
  // Front rank stays off the breach line. The pack is deeper than the old 1.4 pitch.
  expect(layout.front).toBeGreaterThan(-9);
  expect(layout.front).toBeLessThan(-7.5);
  expect(layout.back).toBeLessThan(-14.5);
  expect(layout.noseZ).toBeLessThan(layout.thrustZ - 0.5);
  expect(layout.colors).toBeGreaterThanOrEqual(4);
  expect(layout.hasStar).toBe(true);
});

test('mothership siren stops on pause and game over, and returns on resume', async ({ page }) => {
  await launch(page);

  const siren = await page.evaluate(() => {
    const eng = (window as unknown as { __gemfall?: any }).__gemfall;
    eng.spawnUfo();
    const flying = Boolean(eng.ufoSirenHandle);
    eng.setPaused(true);
    const paused = eng.ufoSirenHandle;
    const stillThere = Boolean(eng.ufoData);
    eng.setPaused(false);
    const resumed = Boolean(eng.ufoSirenHandle);
    eng.triggerGameOver('test');
    return {
      flying,
      paused,
      stillThere,
      resumed,
      over: eng.ufoSirenHandle,
      running: eng.isRunning as boolean,
    };
  });

  expect(siren.flying).toBe(true);
  expect(siren.paused).toBeNull();
  expect(siren.stillThere).toBe(true);
  expect(siren.resumed).toBe(true);
  expect(siren.over).toBeNull();
  expect(siren.running).toBe(false);
});

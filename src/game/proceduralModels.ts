import * as THREE from 'three';
import { InvaderType, POWERUP_PALETTE, PowerupType } from '../types/game';

// Shared paints are reused across every invader of a tier. Disposing one
// disposes the hulls still on screen, so callers must leave these alone.
const sharedMaterialsCache = new Map<string, THREE.Material>();
const sharedMaterials = new WeakSet<THREE.Material>();

export function isSharedMaterial(material: THREE.Material): boolean {
  return sharedMaterials.has(material);
}

function getColoredMaterial(
  colorHex: string,
  metalness = 0.8,
  roughness = 0.25,
  emissive = false,
  emissiveIntensity = 0.4,
  flatShading = false,
): THREE.MeshStandardMaterial {
  const key = `${colorHex}_${metalness}_${roughness}_${emissive}_${emissiveIntensity}_${flatShading}`;
  if (!sharedMaterialsCache.has(key)) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      metalness,
      roughness,
      emissive: emissive ? new THREE.Color(colorHex) : new THREE.Color(0x000000),
      emissiveIntensity: emissive ? emissiveIntensity : 0,
      flatShading,
    });
    sharedMaterialsCache.set(key, mat);
    sharedMaterials.add(mat);
  }
  return sharedMaterialsCache.get(key) as THREE.MeshStandardMaterial;
}

function getBasicMaterial(colorHex: string, fog = true, opacity = 1): THREE.MeshBasicMaterial {
  const key = `basic_${colorHex}_${fog}_${opacity}`;
  if (!sharedMaterialsCache.has(key)) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      fog,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    sharedMaterialsCache.set(key, mat);
    sharedMaterials.add(mat);
  }
  return sharedMaterialsCache.get(key) as THREE.MeshBasicMaterial;
}

/** Unlit core. Fog is off so a small lamp stays a point instead of a halo. */
function getGlowMaterial(colorHex: string, opacity = 0.9): THREE.MeshBasicMaterial {
  const key = `glow_${colorHex}_${opacity}`;
  if (!sharedMaterialsCache.has(key)) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    sharedMaterialsCache.set(key, mat);
    sharedMaterials.add(mat);
  }
  return sharedMaterialsCache.get(key) as THREE.MeshBasicMaterial;
}

function getRimMaterial(): THREE.MeshBasicMaterial {
  const key = 'rim_backside';
  if (!sharedMaterialsCache.has(key)) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#04060a'),
      side: THREE.BackSide,
    });
    sharedMaterialsCache.set(key, mat);
    sharedMaterials.add(mat);
  }
  return sharedMaterialsCache.get(key) as THREE.MeshBasicMaterial;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Dark shell just outside a hull so neighbors don't blend into one blob. */
function addRim(hull: THREE.Mesh, amount = 1.07) {
  const shell = new THREE.Mesh(hull.geometry, getRimMaterial());
  shell.name = 'rim';
  shell.scale.setScalar(amount);
  shell.castShadow = false;
  hull.add(shell);
}

/**
 * Gunstar homage (The Last Starfighter): silver hull, ice-blue panels, red
 * stripes, dark canopy, twin nacelles with red rings and cyan exhaust.
 * Local −Z is the nose (downrange). Local +Z is the stern the chase camera sees.
 * Theme colors stay on the canopy frame and the inner exhaust so a theme
 * still touches the ship without repainting the whole airframe.
 */
export function createPlayerShip(primaryColor: string, accentColor: string, isPartner: boolean = false): THREE.Group {
  const ship = new THREE.Group();
  ship.name = isPartner ? 'player_partner_ship' : 'player_hero_ship';

  const silver = getColoredMaterial('#e4edf4', 0.62, 0.32);
  const ice = getColoredMaterial('#6aa6cc', 0.4, 0.38, true, 0.08);
  const charcoal = getColoredMaterial('#1a222e', 0.7, 0.42);
  const red = getColoredMaterial('#d32228', 0.35, 0.4, true, 0.28);
  const frameMat = getColoredMaterial(primaryColor, 0.45, 0.32, true, 0.2);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#071627'),
    metalness: 0.05,
    roughness: 0.06,
    transmission: 0.22,
    thickness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.94,
  });

  // Faceted central hull. Nose cone tip is −Z (Cone +Y, rotateX −90°).
  const fuselage = addMesh(ship, new THREE.BoxGeometry(0.66, 0.3, 1.55), silver, 0, 0.28, 0.12, 'fuselage');
  fuselage.castShadow = true;

  const noseGeo = new THREE.ConeGeometry(0.3, 0.92, 4);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = addMesh(ship, noseGeo, silver, 0, 0.28, -1.18, 'nose');
  nose.castShadow = true;

  addMesh(ship, new THREE.BoxGeometry(0.5, 0.06, 1.2), ice, 0, 0.45, 0.18);
  // Red spine along the upper nose, chunky enough to read from the chase camera.
  addMesh(ship, new THREE.BoxGeometry(0.18, 0.05, 0.9), red, 0, 0.5, -0.95);

  const canopy = addMesh(ship, new THREE.SphereGeometry(0.3, 16, 12), canopyMat, 0, 0.5, -0.22, 'canopy');
  canopy.scale.set(0.85, 0.55, 1.35);
  addMesh(ship, new THREE.TorusGeometry(0.28, 0.035, 8, 18), frameMat, 0, 0.52, -0.22).rotation.x = Math.PI / 2;

  // Rear deck grille — a few dark slots, not a texture that would blur at this size.
  for (const z of [0.35, 0.55, 0.75]) {
    addMesh(ship, new THREE.BoxGeometry(0.42, 0.03, 0.08), charcoal, 0, 0.5, z);
  }

  // Swept wings. Shape +Y becomes +Z (aft) after rotateX(+90°).
  // spanSign +1 = starboard. A 180° yaw is not a mirror on a tapered wing.
  const wingExtrude = {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.015,
  };
  const makeSweptWing = (spanSign: 1 | -1): THREE.ExtrudeGeometry => {
    const pts: [number, number][] = [
      [0.32, -0.48],
      [1.05, -0.12],
      [2.08, 0.48],
      [1.94, 0.92],
      [0.78, 0.58],
      [0.32, 0.18],
    ];
    const contour = pts.map(([x, y]) => [spanSign * x, y] as [number, number]);
    if (spanSign === -1) contour.reverse();
    const shape = new THREE.Shape();
    shape.moveTo(contour[0][0], contour[0][1]);
    for (let i = 1; i < contour.length; i++) shape.lineTo(contour[i][0], contour[i][1]);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, wingExtrude);
  };

  const rightWing = new THREE.Mesh(makeSweptWing(1), silver);
  rightWing.name = 'wing_right';
  rightWing.position.set(0, 0.32, 0);
  rightWing.rotation.x = Math.PI / 2;
  rightWing.rotation.z = -0.08;
  rightWing.castShadow = true;
  ship.add(rightWing);

  const leftWing = new THREE.Mesh(makeSweptWing(-1), silver);
  leftWing.name = 'wing_left';
  leftWing.position.set(0, 0.32, 0);
  leftWing.rotation.x = Math.PI / 2;
  leftWing.rotation.z = 0.08;
  leftWing.castShadow = true;
  ship.add(leftWing);

  for (const span of [1, -1] as const) {
    const panel = addMesh(ship, new THREE.BoxGeometry(0.85, 0.04, 0.32), ice, span * 1.15, 0.36, 0.28);
    panel.rotation.y = span * -0.32;
    const stripe = addMesh(ship, new THREE.BoxGeometry(1.2, 0.04, 0.16), red, span * 1.1, 0.38, 0.02);
    stripe.rotation.y = span * -0.38;
    // Four-point star on a dark disc. Sits on the wing the chase camera looks down on.
    addMesh(
      ship,
      new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16),
      getColoredMaterial('#123056', 0.4, 0.45),
      span * 1.35,
      0.37,
      0.48,
      span > 0 ? 'wing_star_r' : 'wing_star_l',
    );
    const armH = addMesh(ship, new THREE.BoxGeometry(0.36, 0.04, 0.09), silver, span * 1.35, 0.4, 0.48);
    armH.rotation.y = span > 0 ? 0.4 : -0.4;
    const armV = addMesh(ship, new THREE.BoxGeometry(0.09, 0.04, 0.36), silver, span * 1.35, 0.4, 0.48);
    armV.rotation.y = span > 0 ? 0.4 : -0.4;
  }

  // Twin nacelles under the inner wing. Cylinder +Y rotated +90° lies on Z.
  const nacelleGeo = new THREE.CylinderGeometry(0.2, 0.22, 1.25, 12);
  nacelleGeo.rotateX(Math.PI / 2);
  for (const span of [1, -1] as const) {
    const nacelle = addMesh(ship, nacelleGeo, charcoal, span * 0.82, 0.2, 0.38);
    nacelle.castShadow = true;
    addMesh(ship, new THREE.TorusGeometry(0.24, 0.05, 8, 18), ice, span * 0.82, 0.2, 0.42);
    const ring = addMesh(
      ship,
      new THREE.TorusGeometry(0.26, 0.07, 8, 16),
      red,
      span * 0.82,
      0.2,
      0.9,
      span > 0 ? 'nacelle_ring_r' : 'nacelle_ring_l',
    );
    ring.rotation.y = 0;
    addMesh(ship, new THREE.CylinderGeometry(0.14, 0.16, 0.12, 12), getColoredMaterial('#0b0e14', 0.8, 0.5), span * 0.82, 0.2, 1.02).rotation.x =
      Math.PI / 2;
  }

  // Wide base of the cone faces the chase camera (+Z). rotateX(−90°) puts the
  // tip in the nacelle, so the bell reads as a cyan disc inside the red ring
  // instead of a white spike. Additive blending blows this color out to white.
  const plumeGeo = new THREE.ConeGeometry(0.18, 0.34, 14);
  plumeGeo.rotateX(-Math.PI / 2);
  const coreGeo = new THREE.ConeGeometry(0.09, 0.2, 12);
  coreGeo.rotateX(-Math.PI / 2);
  const bellMat = getBasicMaterial('#3ad4ff', false);
  const coreMat = getBasicMaterial(accentColor, false);
  for (const [span, name] of [
    [-1, 'thrust_left'],
    [1, 'thrust_right'],
  ] as const) {
    addMesh(ship, plumeGeo, bellMat, span * 0.82, 0.2, 0.98, name);
    addMesh(ship, coreGeo, coreMat, span * 0.82, 0.2, 1.02);
  }

  const navGeo = new THREE.SphereGeometry(0.09, 8, 8);
  addMesh(ship, navGeo, getGlowMaterial('#ff3b3b', 1), -2.02, 0.36, 0.7);
  addMesh(ship, navGeo, getGlowMaterial('#3ecbff', 1), 2.02, 0.36, 0.7);
  addMesh(ship, new THREE.SphereGeometry(0.05, 8, 8), getGlowMaterial('#ff3b3b', 1), 0, 0.36, -1.58);

  // Chin guns, pointing downrange.
  const gunGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.55, 8);
  gunGeo.rotateX(Math.PI / 2);
  addMesh(ship, gunGeo, charcoal, -0.18, 0.12, -0.85);
  addMesh(ship, gunGeo, charcoal, 0.18, 0.12, -0.85);

  attachPowerupKits(ship);

  // Engine applies SHIP_SCALE (0.75) again when a kit equips or expires.
  ship.scale.set(0.75, 0.75, 0.75);
  return ship;
}

function kitPaint(hex: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });
}

/**
 * Mario-style costume pieces. Hidden until a pickup; each kit is a unique
 * silhouette + the pickup's color so the hull reads the power at a glance.
 */
function attachPowerupKits(ship: THREE.Group) {
  const rapid = new THREE.Group();
  rapid.name = 'kit_rapid_fire';
  rapid.visible = false;
  const gold = kitPaint(POWERUP_PALETTE.rapid_fire);
  const goldCannonGeo = new THREE.CylinderGeometry(0.14, 0.16, 1.5, 10);
  goldCannonGeo.rotateX(Math.PI / 2);
  for (const x of [-0.82, 0.82]) {
    const barrel = new THREE.Mesh(goldCannonGeo, gold);
    barrel.position.set(x, 0.2, -0.35);
    rapid.add(barrel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 14), gold);
    ring.position.set(x, 0.2, 0.15);
    ring.name = x < 0 ? 'rapid_ring_l' : 'rapid_ring_r';
    rapid.add(ring);
  }
  const goldNose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), gold);
  goldNose.rotation.x = -Math.PI / 2;
  goldNose.position.set(0, 0.3, -1.7);
  rapid.add(goldNose);
  ship.add(rapid);

  const spread = new THREE.Group();
  spread.name = 'kit_spread_shot';
  spread.visible = false;
  const purple = kitPaint(POWERUP_PALETTE.spread_shot);
  const podGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.3, 8);
  podGeo.rotateX(Math.PI / 2);
  for (const x of [-1.7, 1.7]) {
    const pod = new THREE.Mesh(podGeo, purple);
    pod.position.set(x, 0.36, 0.15);
    spread.add(pod);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.28), purple);
    fin.position.set(x, 0.48, 0.35);
    spread.add(fin);
  }
  ship.add(spread);

  const shield = new THREE.Group();
  shield.name = 'kit_plasma_shield';
  shield.visible = false;
  const cyan = kitPaint(POWERUP_PALETTE.plasma_shield);
  for (const [x, z] of [
    [-1.45, 0.35],
    [1.45, 0.35],
    [0, -1.15],
  ] as const) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), cyan);
    crystal.position.set(x, 0.72, z);
    crystal.name = 'shield_crystal';
    shield.add(crystal);
  }
  ship.add(shield);

  const beam = new THREE.Group();
  beam.name = 'kit_laser_beam';
  beam.visible = false;
  const green = kitPaint(POWERUP_PALETTE.laser_beam);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 1.7), green);
  spine.position.set(0, 0.78, -0.15);
  beam.add(spine);
  ship.add(beam);

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  flash.name = 'pickup_flash';
  flash.visible = false;
  ship.add(flash);
}

/**
 * Swarm craft sized to the 1.7 column pitch. A hull wider than that pitch
 * overlaps its neighbor and the whole rank reads as one blur.
 * Bodies stay dark; the tier color is a dorsal plate plus a small lamp,
 * so the glow does not bridge the gap. Noses point +Z, toward the player.
 */
export function createInvaderMesh(type: InvaderType, tierColor: string): THREE.Group {
  const invader = new THREE.Group();
  const hull = getColoredMaterial('#141b26', 0.4, 0.5);
  const trim = getColoredMaterial(tierColor, 0.22, 0.4, true, 0.14);
  const lamp = getBasicMaterial(tierColor, false);
  const dark = getColoredMaterial('#070b12', 0.6, 0.45);

  if (type === 'scout') {
    const body = addMesh(invader, new THREE.BoxGeometry(0.34, 0.14, 0.48), hull, 0, 0, 0);
    body.castShadow = true;
    addRim(body);
    addMesh(invader, new THREE.BoxGeometry(0.28, 0.04, 0.4), trim, 0, 0.09, 0);
    const eyeGeo = new THREE.BoxGeometry(0.3, 0.06, 0.05);
    addMesh(invader, eyeGeo, lamp, 0, 0.04, 0.26);

    const wingGeo = new THREE.BoxGeometry(0.44, 0.035, 0.18);
    const leftWing = addMesh(invader, wingGeo, trim, -0.38, 0, 0.02, 'wing_left');
    const rightWing = addMesh(invader, wingGeo, trim, 0.38, 0, 0.02, 'wing_right');
    leftWing.castShadow = true;
    rightWing.castShadow = true;

    const noseGeo = new THREE.ConeGeometry(0.1, 0.22, 4);
    noseGeo.rotateX(Math.PI / 2);
    addMesh(invader, noseGeo, trim, 0, 0, 0.36);

  } else if (type === 'cruiser') {
    const body = addMesh(invader, new THREE.BoxGeometry(0.58, 0.18, 0.5), hull, 0, 0, 0);
    body.castShadow = true;
    addRim(body);
    addMesh(invader, new THREE.BoxGeometry(0.4, 0.045, 0.36), trim, 0, 0.12, -0.02);

    const reactor = addMesh(invader, new THREE.OctahedronGeometry(0.12, 0), lamp, 0, 0.16, 0, 'reactor_core');
    reactor.castShadow = false;

    const podGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.46, 8);
    podGeo.rotateX(Math.PI / 2);
    addMesh(invader, podGeo, dark, -0.4, -0.02, 0);
    addMesh(invader, podGeo, dark, 0.4, -0.02, 0);

    const finGeo = new THREE.BoxGeometry(0.08, 0.22, 0.22);
    addMesh(invader, finGeo, trim, -0.32, 0.1, 0, 'fin_left');
    addMesh(invader, finGeo, trim, 0.32, 0.1, 0, 'fin_right');

    addMesh(invader, new THREE.BoxGeometry(0.08, 0.05, 0.05), lamp, -0.12, 0.04, 0.27);
    addMesh(invader, new THREE.BoxGeometry(0.08, 0.05, 0.05), lamp, 0.12, 0.04, 0.27);

  } else if (type === 'dreadnought' || type === 'boss') {
    const body = addMesh(invader, new THREE.BoxGeometry(0.72, 0.22, 0.52), hull, 0, 0, 0);
    body.castShadow = true;
    addRim(body);
    addMesh(invader, new THREE.BoxGeometry(0.5, 0.05, 0.34), trim, 0, 0.14, -0.02);

    const bridgeGeo = new THREE.ConeGeometry(0.16, 0.22, 4);
    bridgeGeo.rotateY(Math.PI / 4);
    addMesh(invader, bridgeGeo, lamp, 0, 0.24, -0.04);

    const plateGeo = new THREE.BoxGeometry(0.26, 0.06, 0.28);
    addMesh(invader, plateGeo, trim, -0.48, 0.02, -0.02);
    addMesh(invader, plateGeo, trim, 0.48, 0.02, -0.02);

    const ramGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
    ramGeo.rotateX(Math.PI / 2);
    addMesh(invader, ramGeo, dark, -0.22, -0.02, 0.34);
    addMesh(invader, ramGeo, dark, 0.22, -0.02, 0.34);

    const cannonGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.28, 6);
    cannonGeo.rotateX(Math.PI / 2);
    addMesh(invader, cannonGeo, dark, -0.34, -0.06, 0.28);
    addMesh(invader, cannonGeo, dark, 0.34, -0.06, 0.28);

  } else if (type === 'ufo') {
    const disc = addMesh(invader, new THREE.CylinderGeometry(1.02, 1.08, 0.16, 24), hull, 0, 0, 0);
    disc.castShadow = true;
    addRim(disc, 1.04);
    addMesh(invader, new THREE.CylinderGeometry(0.72, 0.78, 0.06, 20), trim, 0, 0.08, 0);

    const domeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dbeafe'),
      transmission: 0.55,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.9,
    });
    const dome = addMesh(invader, new THREE.SphereGeometry(0.36, 16, 12), domeMat, 0, 0.16, 0);
    dome.scale.set(1, 0.62, 1);

    const lightRing = new THREE.Group();
    lightRing.name = 'ufo_light_ring';
    const bulbGeo = new THREE.SphereGeometry(0.07, 8, 8);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(bulbGeo, i % 2 === 0 ? getGlowMaterial('#ff3355', 1) : getGlowMaterial('#39e7ff', 1));
      bulb.position.set(Math.cos(angle) * 0.96, 0, Math.sin(angle) * 0.96);
      lightRing.add(bulb);
    }
    invader.add(lightRing);
  }

  return invader;
}

/** Reserved incoming-threat hue. Kill FX, grid, and the player laser never use this. */
export const ALIEN_SHOT_CORE = '#fff6e5';
export const ALIEN_SHOT_RIM = '#ff9f1c';

/**
 * Player laser: a thin needle along −Z (down-range). Length reads on the 2.5D camera.
 * Beam suit uses a thicker, longer bolt so the pierce reads on the 2.5D camera.
 */
export function createLaserMesh(colorHex: string, opts?: { beam?: boolean }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'player_laser';

  const length = opts?.beam ? 2.2 : 1.3;
  const radius = opts?.beam ? 0.16 : 0.09;

  const coreGeo = new THREE.CylinderGeometry(radius, radius, length, 8);
  coreGeo.rotateX(Math.PI / 2);
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  const sheathGeo = new THREE.CylinderGeometry(radius * 2.2, radius * 1.8, length * 1.1, 8);
  sheathGeo.rotateX(Math.PI / 2);
  const sheathMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const sheath = new THREE.Mesh(sheathGeo, sheathMat);
  group.add(sheath);

  return group;
}

/**
 * Alien shot: a flat XY diamond (thin local Z). The engine lookAt()s the camera so the
 * full glyph faces the lens — incoming fire no longer foreshortens into a spark.
 */
export function createAlienShotMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'alien_shot';

  // Keep this well under ship scale (~2 long, ~3.6 wings). The engine also
  // shrinks it as it nears the camera so perspective doesn't inflate it.
  const bodyGeo = new THREE.OctahedronGeometry(0.2, 0);
  const body = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshBasicMaterial({ color: new THREE.Color(ALIEN_SHOT_RIM) })
  );
  body.name = 'alien_shot_rim';
  body.scale.set(1.1, 1.4, 0.45);
  group.add(body);

  const coreGeo = new THREE.OctahedronGeometry(0.1, 0);
  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshBasicMaterial({ color: new THREE.Color(ALIEN_SHOT_CORE) })
  );
  core.name = 'alien_shot_core';
  core.scale.set(1.0, 1.2, 0.5);
  group.add(core);

  const haloGeo = new THREE.OctahedronGeometry(0.26, 0);
  const halo = new THREE.Mesh(
    haloGeo,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(ALIEN_SHOT_RIM),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  halo.name = 'alien_shot_halo';
  halo.scale.set(1.15, 1.45, 0.4);
  group.add(halo);

  return group;
}

/**
 * Creates a floating 3D Powerup capsule with rotating crystal core
 */
export function createPowerupMesh(type: PowerupType): THREE.Group {
  const group = new THREE.Group();
  group.name = `powerup_${type}`;

  const color = new THREE.Color(POWERUP_PALETTE[type]).getHex();

  // Rotating Octahedron Gem
  const gemGeo = new THREE.OctahedronGeometry(0.4, 0);
  const gemMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.1,
    emissive: color,
    emissiveIntensity: 0.6,
  });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  gem.name = 'gem';
  group.add(gem);

  // Outer protective wireframe ring
  const ringGeo = new THREE.TorusGeometry(0.55, 0.05, 8, 20);
  const ringMat = new THREE.MeshBasicMaterial({ color, wireframe: true });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.name = 'ring';
  group.add(ring);

  return group;
}

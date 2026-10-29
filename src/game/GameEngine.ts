import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BunkerBlock,
  BEST_WAVE_STORAGE_KEY,
  GameStats,
  GameTheme,
  InvaderData,
  InvaderType,
  LaserData,
  PlayerProfile,
  POWERUP_PALETTE,
  PowerupDrop,
  PowerupType,
  readBestWave,
} from '../types/game';
import { GAME_THEMES } from './themes';
import {
  ALIEN_SHOT_RIM,
  createAlienShotMesh,
  createInvaderMesh,
  createLaserMesh,
  createPlayerShip,
  createPowerupMesh,
  isSharedMaterial,
} from './proceduralModels';
import { soundSynth } from '../audio/SoundSynth';

export type ScorePopupTone = 'score' | 'combo' | 'ufo' | 'life';

export interface ScorePopup {
  /** Percent across the arena overlay, 0–100. */
  x: number;
  /** Percent down the arena overlay, 0–100. */
  y: number;
  text: string;
  tone: ScorePopupTone;
}

export interface GameEngineCallbacks {
  onScoreUpdate: (score: number) => void;
  onLivesUpdate: (lives: number) => void;
  onWaveClear: (wave: number) => void;
  onGameOver: (winner?: string) => void;
  onStatsUpdate: (stats: GameStats) => void;
  onPowerupCollect: (type: PowerupType | null) => void;
  onScorePopup: (popup: ScorePopup) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock!: THREE.Clock;
  private isDestroyed: boolean = false;
  private animFrameId: number | null = null;

  // Environment & Lights
  private ambientLight!: THREE.AmbientLight;
  private keyLight!: THREE.DirectionalLight;
  private gridMesh!: THREE.LineSegments;
  private horizonGlow!: THREE.Mesh;
  private starParticles!: THREE.Points;
  private starPositions!: Float32Array;

  // Game Settings & State
  public theme: GameTheme;
  public isRunning: boolean = false;
  public isPaused: boolean = false;

  public p1: PlayerProfile;

  // Game Entities
  private p1Mesh!: THREE.Group;
  private p1ShieldMesh!: THREE.Mesh;

  private invaders: InvaderData[] = [];
  private invaderMeshes: Map<string, THREE.Group> = new Map();
  private invaderDir: number = 1; // 1 = right, -1 = left
  private invaderStepTimer: number = 0;
  private invaderStepInterval: number = 0.7; // speeds up as invaders die
  private invaderStepCounter: number = 0;
  private invaderDropDistance: number = 0.75;
  private invaderShootTimer: number = 0;

  // Mystery UFO
  private ufoData: InvaderData | null = null;
  private ufoMesh: THREE.Group | null = null;
  private ufoSpawnTimer: number = 18;
  private ufoSirenHandle: { stop: () => void } | null = null;

  // Lasers
  private lasers: LaserData[] = [];
  private laserMeshes: Map<string, THREE.Group> = new Map();

  // Bunkers
  private bunkerBlocks: BunkerBlock[] = [];
  private bunkerBlockMeshes: Map<string, THREE.Mesh> = new Map();

  // Powerups
  private powerups: PowerupDrop[] = [];
  private powerupMeshes: Map<string, THREE.Group> = new Map();

  // Particle Explosions
  private particles: {
    mesh: THREE.Points;
    velocities: Float32Array;
    life: number;
    maxLife: number;
  }[] = [];

  // Arena Dimensions (Corridor)
  private readonly ARENA_WIDTH = 22;
  /** Home station. Reset and the camera's rest framing use this. */
  private readonly PLAYER_Z = 9.8;
  /** Forward limit, toward the swarm (−Z). Stays behind the breach line. */
  private readonly PLAYER_Z_MIN = 7.6;
  /** Back limit, toward the camera (+Z). */
  private readonly PLAYER_Z_MAX = 12.4;
  /**
   * Front rank stays put so a deeper pack does not open on the breach line.
   * Rows are pulled apart along Z; the old 1.4 pitch plus fat hulls stacked
   * the swarm into one blob from this camera.
   */
  private readonly INVADER_FRONT_Z = -8.4;
  private readonly INVADER_ROW_COUNT = 5;
  private readonly INVADER_SPACING_Z = 1.78;
  /** Light enough that the back rank stays a silhouette, not a fog smear. */
  private readonly FOG_DENSITY = 0.007;
  private readonly BUNKER_Z = 5.2;
  /** Swarm reaching this z ends the run. It sits in front of PLAYER_Z_MIN. */
  private readonly BREACH_Z = 6.5;

  // Input states
  public keysDown: Record<string, boolean> = {};
  public touchInputP1 = { moveX: 0, moveZ: 0, fire: false, autoFire: false };
  private p1ShootCooldown = 0;
  private p1Iframes = 0;
  private nextVolleyId = 1;
  /** Volleys that have already counted as one accuracy hit. */
  private volleysHit = new Set<number>();
  private nextExtraLifeAt = 5000;
  private lastHudPowerupCeil = -1;
  private readonly popupAnchor = new THREE.Vector3();
  private readonly PLAYER_IFRAMES = 1.8;
  private readonly EXTRA_LIFE_EVERY = 5000;

  // Dynamic Camera Reaction
  private cameraBaseY = 15.5;
  private cameraBaseZ = 20.5;
  private cameraLookTarget = new THREE.Vector3(0, 0, -2);
  private cameraShakeIntensity = 0;
  private resizeObserver: ResizeObserver | null = null;
  private pickupFlash = 0;
  private readonly SHIP_SCALE = 0.75;
  private readonly SHIP_SCALE_POWERED = 0.9;

  // Stats
  public stats: GameStats = {
    wave: 1,
    invadersRemaining: 55,
    totalInvaders: 55,
    invaderSpeedMultiplier: 1.0,
    ufoActive: false,
    ufoTimer: 18,
    comboCount: 0,
    comboMultiplier: 1,
    comboTimer: 0,
    bestWave: readBestWave(),
  };

  constructor(
    container: HTMLElement,
    callbacks: GameEngineCallbacks,
    initialTheme: GameTheme,
    p1Name = 'Commander Dan'
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.theme = initialTheme;

    this.p1 = {
      id: 'p1',
      name: p1Name,
      callsign: 'P1-ALPHA',
      shipColor: this.theme.p1Color,
      trailColor: this.theme.laserP1,
      score: 0,
      highScore: Number(localStorage.getItem('gemfall_hs_p1') || localStorage.getItem('cosmic_hs_p1') || 0),
      lives: 3,
      maxLives: 5,
      activePowerup: null,
      powerupTimer: 0,
      shieldActive: false,
      shotsFired: 0,
      shotsHit: 0,
      isAlive: true,
    };

    this.initScene();
    this.initArenaGrid();
    this.initStarfield();
    this.initPlayers();
    this.initBunkers();
    this.spawnWave(1);

    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // The canvas can change size without a window resize (e.g. the phone layout
    // reserving a band for the thumb controls), so track the container itself.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
      this.resizeObserver.observe(this.container);
    }

    this.startLoop();
  }

  // --- Three.js Setup ---
  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.bgSpace);
    this.scene.fog = new THREE.FogExp2(this.theme.bgSpace, this.FOG_DENSITY);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    this.camera = new THREE.PerspectiveCamera(54, aspect, 0.1, 140);
    this.updateCameraFraming(width, height);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // setPixelRatio only takes effect on the next setSize. Applying it after
    // setSize left the buffer at CSS resolution, so HiDPI screens looked soft.
    this.applyRendererSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Studio Reflection Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting
    this.ambientLight = new THREE.AmbientLight(this.theme.ambientColor, 1.2);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(this.theme.keyLightColor, 2.5);
    this.keyLight.position.set(5, 18, 12);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 40;
    this.keyLight.shadow.camera.left = -16;
    this.keyLight.shadow.camera.right = 16;
    this.keyLight.shadow.camera.top = 16;
    this.keyLight.shadow.camera.bottom = -16;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.HemisphereLight(this.theme.gridHorizon, 0x050510, 1.0);
    this.scene.add(fillLight);

    this.clock = new THREE.Clock();
  }

  // --- 2.5D Infinite Scrolling Techno Floor Grid ---
  private initArenaGrid() {
    const size = 64;
    const divisions = 64;
    const gridGeo = new THREE.BufferGeometry();
    const positions: number[] = [];

    const half = size / 2;
    const step = size / divisions;

    // Cross lines
    for (let i = -half; i <= half; i += step) {
      // Lines along Z
      positions.push(i, -0.01, -half);
      positions.push(i, -0.01, half);
      // Lines along X
      positions.push(-half, -0.01, i);
      positions.push(half, -0.01, i);
    }

    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const gridMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.theme.gridColor),
      transparent: true,
      opacity: 0.35,
    });

    this.gridMesh = new THREE.LineSegments(gridGeo, gridMat);
    this.gridMesh.position.y = -0.05;
    this.scene.add(this.gridMesh);

    // Glowing Horizon Bar at vanishing point
    const horizonGeo = new THREE.PlaneGeometry(80, 0.4);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.theme.gridHorizon),
      transparent: true,
      opacity: 0.8,
    });
    this.horizonGlow = new THREE.Mesh(horizonGeo, horizonMat);
    this.horizonGlow.position.set(0, 0.1, -28);
    this.scene.add(this.horizonGlow);
  }

  // --- Parallax 3D Starfield ---
  private initStarfield() {
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    this.starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const c1 = new THREE.Color(this.theme.p1Color);
    const c2 = new THREE.Color(this.theme.p2Color);
    const cWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      this.starPositions[idx] = (Math.random() - 0.5) * 80;
      this.starPositions[idx + 1] = Math.random() * 30 + 1;
      this.starPositions[idx + 2] = (Math.random() - 0.5) * 80 - 10;

      const pick = Math.random();
      const col = pick < 0.25 ? c1 : pick < 0.5 ? c2 : cWhite;
      starColors[idx] = col.r;
      starColors[idx + 1] = col.g;
      starColors[idx + 2] = col.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
    });

    this.starParticles = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starParticles);
  }

  // --- Player Fighter ---
  private initPlayers() {
    this.p1Mesh = createPlayerShip(this.theme.p1Color, this.theme.laserP1, false);
    this.p1Mesh.position.set(0, 0.4, this.PLAYER_Z);
    this.scene.add(this.p1Mesh);

    // Shield Bubble — Starman-obvious, not a faint wireframe.
    const shieldGeo = new THREE.SphereGeometry(1.75, 20, 16);
    const p1ShieldMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(POWERUP_PALETTE.plasma_shield),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.p1ShieldMesh = new THREE.Mesh(shieldGeo, p1ShieldMat);
    this.p1ShieldMesh.name = 'shield_bubble';
    this.p1ShieldMesh.visible = false;
    const shieldWire = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(POWERUP_PALETTE.plasma_shield),
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      })
    );
    this.p1ShieldMesh.add(shieldWire);
    this.p1Mesh.add(this.p1ShieldMesh);
    this.syncShipPowerupLook();
  }

  // --- Destructible Bunkers (Voxel Barricades) ---
  private initBunkers() {
    this.clearBunkers();

    const bunkerPositions = [-8.5, -2.8, 2.8, 8.5];
    const cols = 5;
    const rows = 4;
    const blockSize = 0.42;

    bunkerPositions.forEach((bx, bIdx) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Arch cutout: skip bottom center blocks for classic inverted-U shape
          if (r === 0 && (c === 1 || c === 2 || c === 3)) continue;
          if (r === 1 && c === 2) continue;

          const blockId = `bunker_${bIdx}_${c}_${r}`;
          const x = bx + (c - cols / 2 + 0.5) * blockSize;
          const y = 0.35 + r * (blockSize * 0.9);
          const z = this.BUNKER_Z;

          const block: BunkerBlock = {
            id: blockId,
            bunkerIndex: bIdx,
            col: c,
            row: r,
            x,
            y,
            z,
            health: 2,
            color: this.theme.bunkerColor,
          };
          this.bunkerBlocks.push(block);

          const geo = new THREE.BoxGeometry(blockSize * 0.95, blockSize * 0.9, blockSize * 0.95);
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.theme.bunkerColor),
            metalness: 0.5,
            roughness: 0.3,
            emissive: new THREE.Color(this.theme.bunkerColor),
            emissiveIntensity: 0.2,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, y, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          this.scene.add(mesh);
          this.bunkerBlockMeshes.set(blockId, mesh);
        }
      }
    });
  }

  private clearBunkers() {
    this.bunkerBlockMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.bunkerBlockMeshes.clear();
    this.bunkerBlocks = [];
  }

  // --- Invader Waves ---
  public spawnWave(waveNum: number) {
    this.clearInvaders();

    this.stats.wave = waveNum;
    this.stats.invaderSpeedMultiplier = 1.0 + (waveNum - 1) * 0.14;
    this.invaderStepInterval = Math.max(0.2, 0.75 - (waveNum - 1) * 0.08);
    this.invaderDir = 1;

    const rows = this.INVADER_ROW_COUNT;
    const cols = 11;
    const spacingX = 1.7;
    const spacingZ = this.INVADER_SPACING_Z;
    const startZ = this.INVADER_FRONT_Z - (rows - 1) * spacingZ;

    const startX = -((cols - 1) * spacingX) / 2;

    for (let r = 0; r < rows; r++) {
      let type: InvaderType = 'scout';
      let tierColor = this.theme.invaderTiers[0];
      let points = 10;
      let maxHp = 1;

      if (r === 2 || r === 3) {
        type = 'cruiser';
        tierColor = this.theme.invaderTiers[1];
        points = 20;
        maxHp = 1;
      } else if (r === 4) {
        type = 'dreadnought';
        tierColor = this.theme.invaderTiers[2];
        points = 40;
        maxHp = waveNum > 2 ? 2 : 1;
      }

      for (let c = 0; c < cols; c++) {
        const id = `inv_${waveNum}_${r}_${c}`;
        const x = startX + c * spacingX;
        const z = startZ + r * spacingZ;

        const data: InvaderData = {
          id,
          type,
          row: r,
          col: c,
          x,
          z,
          points,
          health: maxHp,
          maxHealth: maxHp,
          color: tierColor,
          scale: 1,
          animPhase: Math.random() * Math.PI,
        };
        this.invaders.push(data);

        const mesh = createInvaderMesh(type, tierColor);
        mesh.position.set(x, 0.55, z);
        this.scene.add(mesh);
        this.invaderMeshes.set(id, mesh);
      }
    }

    this.stats.totalInvaders = this.invaders.length;
    this.stats.invadersRemaining = this.invaders.length;
    this.stats.ufoActive = false;
    this.ufoSpawnTimer = 10 + Math.random() * 8;

    // Bunkers persist for the sortie. restart() is what builds a fresh set.
    // The engine is constructed before start(), so the title screen's wave 1
    // does not become a recorded best.
    if (this.isRunning) this.noteBestWave(waveNum);

    soundSynth.setTempoMultiplier(this.stats.invaderSpeedMultiplier);
    this.callbacks.onStatsUpdate(this.stats);
  }

  private clearInvaders() {
    this.invaderMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
    });
    this.invaderMeshes.clear();
    this.invaders = [];
    this.removeUfo();
  }

  /**
   * Release unique GPU buffers on a group. Shared invader paints stay,
   * because the next wave's hulls still reference them. Geometries that
   * two meshes in the same group share (scout wings) are disposed once.
   */
  private disposeObject(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const material = mesh.material;
      if (!material) return;
      if (Array.isArray(material)) {
        for (const entry of material) materials.add(entry);
      } else {
        materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if (!isSharedMaterial(material)) material.dispose();
    }
  }

  /** Record a higher wave once the sortie is actually running. */
  private noteBestWave(wave: number) {
    if (wave <= this.stats.bestWave) return;
    this.stats.bestWave = wave;
    try {
      localStorage.setItem(BEST_WAVE_STORAGE_KEY, String(wave));
    } catch {
      // Private mode still keeps the in-memory record for this page.
    }
  }

  private emitPopup(x: number, y: number, z: number, text: string, tone: ScorePopup['tone']) {
    this.popupAnchor.set(x, y, z);
    this.popupAnchor.project(this.camera);
    if (this.popupAnchor.z < -1 || this.popupAnchor.z > 1) return;
    const px = (this.popupAnchor.x * 0.5 + 0.5) * 100;
    const py = (-this.popupAnchor.y * 0.5 + 0.5) * 100;
    if (px < -5 || px > 105 || py < -5 || py > 105) return;
    this.callbacks.onScorePopup({ x: px, y: py, text, tone });
  }

  // --- Input Handlers ---
  private onKeyDown = (e: KeyboardEvent) => {
    // Never treat typing in a form field (pilot names, sliders) as flight input.
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    ) {
      return;
    }

    this.keysDown[e.code] = true;

    // Start music on first player keypress if needed
    if (!soundSynth.getMuted() && this.isRunning && !this.isPaused) {
      soundSynth.startMusic();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown[e.code] = false;
  };

  public updateCameraFraming(width: number, height: number) {
    const aspect = width / height;
    this.camera.aspect = aspect;

    if (aspect <= 0.55) {
      // 20:9 (1080x2400) or 19.5:9 Tall Android Phone Portrait
      // Arena width is 22. Pull camera back and elevate so the entire 55-invader swarm
      // fits comfortably in the upper 64% of the screen, leaving lower 36% for thumb controls!
      const targetHFOV = 62; // degrees horizontal span
      const vFovRad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(targetHFOV) / 2) / aspect);
      this.camera.fov = Math.min(88, Math.max(54, THREE.MathUtils.radToDeg(vFovRad)));
      this.cameraBaseY = 19.8;
      this.cameraBaseZ = 25.0;
      this.cameraLookTarget.set(0, 0, -4.5);
    } else if (aspect < 1.0) {
      // Standard Portrait (e.g. 9:16 or tablet portrait)
      const targetHFOV = 64;
      const vFovRad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(targetHFOV) / 2) / aspect);
      this.camera.fov = Math.min(84, Math.max(54, THREE.MathUtils.radToDeg(vFovRad)));
      this.cameraBaseY = 18.0;
      this.cameraBaseZ = 23.0;
      this.cameraLookTarget.set(0, 0, -3.5);
    } else {
      // Landscape (20:9 ultra-wide 2400x1080 or desktop).
      // Kept high enough that the fighter stays above the tactical dock.
      this.camera.fov = 52;
      this.cameraBaseY = 15.0;
      this.cameraBaseZ = 20.0;
      this.cameraLookTarget.set(0, 0, -2.0);
    }

    this.camera.position.set(0, this.cameraBaseY, this.cameraBaseZ);
    this.camera.lookAt(this.cameraLookTarget);
    this.camera.updateProjectionMatrix();
  }

  public triggerHaptic(pattern: number | number[]) {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch {
      // silent fallback
    }
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.updateCameraFraming(width, height);
    this.applyRendererSize(width, height);
  };

  /** Device pixels, capped so a 3× phone does not quadruple the fill rate. */
  private applyRendererSize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
  }

  // --- Theme Switching ---
  public setTheme(newTheme: GameTheme) {
    this.theme = newTheme;
    this.scene.background = new THREE.Color(newTheme.bgSpace);
    this.scene.fog = new THREE.FogExp2(newTheme.bgSpace, this.FOG_DENSITY);

    this.ambientLight.color.set(newTheme.ambientColor);
    this.keyLight.color.set(newTheme.keyLightColor);

    (this.gridMesh.material as THREE.LineBasicMaterial).color.set(newTheme.gridColor);
    (this.horizonGlow.material as THREE.MeshBasicMaterial).color.set(newTheme.gridHorizon);

    soundSynth.setSoundPreset(newTheme.soundPreset);

    // Update active player colors
    this.p1.shipColor = newTheme.p1Color;
    this.p1.trailColor = newTheme.laserP1;

    // Refresh meshes. The previous hull owns a unique canopy material.
    if (this.p1Mesh) {
      this.scene.remove(this.p1Mesh);
      this.disposeObject(this.p1Mesh);
    }
    this.initPlayers();
    this.syncShipPowerupLook();
  }

  // --- Main Game Loop ---
  public start() {
    this.isRunning = true;
    this.isPaused = false;
    soundSynth.startMusic();
  }

  /**
   * Idempotent pause used by the UI as the single source of truth. Held inputs
   * are dropped on every transition, otherwise a key or thumb tap that started
   * while paused fires the moment the sim resumes.
   */
  public setPaused(paused: boolean) {
    if (this.isPaused === paused) return;
    this.isPaused = paused;
    this.keysDown = {};
    this.touchInputP1.fire = false;
    this.touchInputP1.moveX = 0;
    this.touchInputP1.moveZ = 0;

    if (paused) {
      soundSynth.stopMusic();
      this.silenceUfoSiren();
    } else if (this.isRunning) {
      soundSynth.startMusic();
      if (this.ufoData) this.startUfoSiren();
    }
  }

  public togglePause() {
    this.setPaused(!this.isPaused);
    return this.isPaused;
  }

  public restart() {
    this.p1.score = 0;
    this.p1.lives = 3;
    this.p1.isAlive = true;
    this.p1.activePowerup = null;
    this.p1.powerupTimer = 0;
    this.p1.shieldActive = false;
    this.p1.shotsFired = 0;
    this.p1.shotsHit = 0;
    this.volleysHit.clear();
    this.p1Iframes = 0;
    this.nextExtraLifeAt = this.EXTRA_LIFE_EVERY;
    this.lastHudPowerupCeil = -1;

    this.stats.wave = 1;
    this.stats.comboCount = 0;
    this.stats.comboMultiplier = 1;
    this.stats.comboTimer = 0;

    this.clearLasers();
    this.clearPowerups();
    this.initBunkers();
    this.spawnWave(1);

    // The ship is hidden when the pilot dies — bring it back or the next sortie
    // starts with an invisible fighter.
    this.p1Mesh.visible = true;
    this.p1ShieldMesh.visible = false;
    this.syncShipPowerupLook();

    this.p1Mesh.position.set(0, 0.4, this.PLAYER_Z);
    this.p1Mesh.rotation.x = 0;
    this.p1Mesh.rotation.z = 0;

    this.callbacks.onScoreUpdate(this.p1.score);
    this.callbacks.onLivesUpdate(this.p1.lives);

    this.isRunning = true;
    this.isPaused = false;
    soundSynth.startMusic();
  }

  private startLoop() {
    const tick = () => {
      if (this.isDestroyed) return;
      this.animFrameId = requestAnimationFrame(tick);

      const delta = Math.min(this.clock.getDelta(), 0.1);

      if (this.isRunning && !this.isPaused) {
        this.update(delta);
      }

      this.render(delta);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  // --- Update Simulation ---
  private update(delta: number) {
    this.updateStarfield(delta);
    this.updateGrid(delta);
    this.updatePlayers(delta);
    this.updateInvaders(delta);
    this.updateUFO(delta);
    this.updateLasers(delta);
    this.updatePowerups(delta);
    this.updateParticles(delta);
    this.updateCombo(delta);
    this.checkCollisions();
  }

  // Infinite grid movement effect
  private updateGrid(delta: number) {
    const scrollSpeed = 6.0;
    this.gridMesh.position.z = (this.gridMesh.position.z + scrollSpeed * delta) % 2.0;
  }

  // Parallax Starfield
  private updateStarfield(delta: number) {
    const count = this.starPositions.length / 3;
    const speed = 12 * delta;

    for (let i = 0; i < count; i++) {
      const idx = i * 3 + 2;
      this.starPositions[idx] += speed;
      if (this.starPositions[idx] > 35) {
        this.starPositions[idx] = -45;
      }
    }
    this.starParticles.geometry.attributes.position.needsUpdate = true;
  }

  // Update Player Controls & Position
  private updatePlayers(delta: number) {
    const speed = 16.0;
    const depthSpeed = 12.0;
    const minX = -this.ARENA_WIDTH / 2 + 1.2;
    const maxX = this.ARENA_WIDTH / 2 - 1.2;

    // Camera sits on +Z looking toward −Z, so screen-right is +X and
    // "into the corridor" (up the screen, W, pad-up) is −Z.
    if (this.p1.isAlive) {
      let strafe = 0;
      let depth = 0;
      if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft']) strafe -= 1;
      if (this.keysDown['KeyD'] || this.keysDown['ArrowRight']) strafe += 1;
      if (this.keysDown['KeyW'] || this.keysDown['ArrowUp']) depth += 1;
      if (this.keysDown['KeyS'] || this.keysDown['ArrowDown']) depth -= 1;

      if (Math.abs(this.touchInputP1.moveX) > 0.05) strafe = this.touchInputP1.moveX;
      if (Math.abs(this.touchInputP1.moveZ) > 0.05) depth = this.touchInputP1.moveZ;

      this.p1Mesh.position.x += strafe * speed * delta;
      this.p1Mesh.position.x = Math.max(minX, Math.min(maxX, this.p1Mesh.position.x));
      this.p1Mesh.position.z += -depth * depthSpeed * delta;
      this.p1Mesh.position.z = Math.max(this.PLAYER_Z_MIN, Math.min(this.PLAYER_Z_MAX, this.p1Mesh.position.z));

      const targetRoll = -strafe * 0.45;
      this.p1Mesh.rotation.z = THREE.MathUtils.damp(this.p1Mesh.rotation.z, targetRoll, 10, delta);
      // +depth is −Z. Positive rotation.x pitches the nose up, so forward noses down.
      const targetPitch = -depth * 0.22;
      this.p1Mesh.rotation.x = THREE.MathUtils.damp(this.p1Mesh.rotation.x, targetPitch, 8, delta);

      // Shooting
      this.p1ShootCooldown -= delta;
      const isFirePressed =
        this.keysDown['Space'] ||
        this.keysDown['KeyZ'] ||
        this.touchInputP1.fire ||
        this.touchInputP1.autoFire;

      const fireRate =
        this.p1.activePowerup === 'rapid_fire'
          ? 0.14
          : this.p1.activePowerup === 'laser_beam'
            ? 0.24
            : 0.28;
      if (isFirePressed && this.p1ShootCooldown <= 0) {
        this.firePlayerLaser();
        this.p1ShootCooldown = fireRate;
      }

      if (this.p1Iframes > 0) {
        this.p1Iframes -= delta;
        this.p1Mesh.visible = Math.floor(this.p1Iframes * 10) % 2 === 0;
        if (this.p1Iframes <= 0) this.p1Mesh.visible = true;
      }

      // Powerup Timers
      if (this.p1.powerupTimer > 0) {
        this.p1.powerupTimer -= delta;
        if (this.p1.powerupTimer <= 0) {
          this.p1.activePowerup = null;
          this.p1.shieldActive = false;
          this.p1.powerupTimer = 0;
          this.syncShipPowerupLook();
          this.lastHudPowerupCeil = -1;
          this.callbacks.onPowerupCollect(null);
        } else {
          const ceil = Math.ceil(this.p1.powerupTimer);
          if (ceil !== this.lastHudPowerupCeil) {
            this.lastHudPowerupCeil = ceil;
            this.callbacks.onPowerupCollect(this.p1.activePowerup);
          }
        }
      }
      this.p1ShieldMesh.visible = this.p1.shieldActive;
      if (this.p1.shieldActive) {
        this.p1ShieldMesh.rotation.y += delta * 3;
        this.p1ShieldMesh.scale.setScalar(1 + 0.08 * Math.sin(this.clock.getElapsedTime() * 6));
      }
      this.animateShipKits(delta);
    }
  }

  private syncShipPowerupLook() {
    const type = this.p1.activePowerup;
    for (const kit of ['kit_rapid_fire', 'kit_spread_shot', 'kit_plasma_shield', 'kit_laser_beam']) {
      const group = this.p1Mesh.getObjectByName(kit);
      if (group) group.visible = type !== null && kit === `kit_${type}`;
    }
    const powered = type !== null && type !== 'emp_nuke';
    const s = powered ? this.SHIP_SCALE_POWERED : this.SHIP_SCALE;
    this.p1Mesh.scale.setScalar(s);
    this.p1ShieldMesh.visible = this.p1.shieldActive;
  }

  private animateShipKits(delta: number) {
    if (this.pickupFlash > 0) {
      this.pickupFlash -= delta;
      const flash = this.p1Mesh.getObjectByName('pickup_flash');
      if (flash) {
        flash.visible = this.pickupFlash > 0 && Math.floor(this.pickupFlash * 16) % 2 === 0;
      }
    } else {
      const flash = this.p1Mesh.getObjectByName('pickup_flash');
      if (flash) flash.visible = false;
    }

    const ringL = this.p1Mesh.getObjectByName('rapid_ring_l');
    const ringR = this.p1Mesh.getObjectByName('rapid_ring_r');
    if (ringL) ringL.rotation.z += delta * 10;
    if (ringR) ringR.rotation.z -= delta * 10;

    const shieldKit = this.p1Mesh.getObjectByName('kit_plasma_shield');
    if (shieldKit?.visible) {
      const t = this.clock.getElapsedTime();
      shieldKit.children.forEach((crystal, i) => {
        crystal.rotation.y += delta * 4;
        crystal.position.y = 0.72 + Math.sin(t * 5 + i) * 0.08;
      });
    }
  }

  // Fire Player Laser — suit IS the gun (small Mario = one center bolt).
  private firePlayerLaser() {
    const profile = this.p1;
    const mesh = this.p1Mesh;
    const suit = profile.activePowerup;
    const color =
      suit && suit !== 'plasma_shield' && suit !== 'emp_nuke'
        ? POWERUP_PALETTE[suit]
        : this.theme.laserP1;
    const muzzleZ = mesh.position.z - 0.8;

    soundSynth.playPlayerLaser();
    this.triggerHaptic(8);

    // One trigger, however many bolts it throws. Accuracy counts this, not each bolt.
    const volleyId = this.nextVolleyId++;
    this.p1.shotsFired++;

    if (suit === 'spread_shot') {
      for (const xOff of [-1.35, 0, 1.35]) {
        this.spawnLaser('p1', mesh.position.x + xOff, muzzleZ, 0, -30, color, false, volleyId);
      }
    } else if (suit === 'rapid_fire') {
      // Gold kit barrels sit at ±0.9 — the shots come from what you see.
      this.spawnLaser('p1', mesh.position.x - 0.9, muzzleZ, 0, -34, color, false, volleyId);
      this.spawnLaser('p1', mesh.position.x + 0.9, muzzleZ, 0, -34, color, false, volleyId);
    } else if (suit === 'laser_beam') {
      this.spawnLaser('p1', mesh.position.x, muzzleZ, 0, -40, color, true, volleyId);
    } else {
      this.spawnLaser('p1', mesh.position.x, muzzleZ, 0, -32, color, false, volleyId);
    }
  }

  // Spawn Laser in Scene
  private spawnLaser(
    owner: 'p1' | 'invader',
    x: number,
    z: number,
    vx: number,
    vz: number,
    color: string,
    isBeam = false,
    volleyId?: number
  ) {
    const id = `laser_${Date.now()}_${Math.random()}`;
    const data: LaserData = {
      id,
      owner,
      x,
      z,
      vx,
      vz,
      damage: 1,
      color,
      isBeam,
      hitIds: isBeam ? [] : undefined,
      volleyId,
    };
    this.lasers.push(data);

    const mesh = owner === 'invader' ? createAlienShotMesh() : createLaserMesh(color, { beam: isBeam });
    // Alien drops sit above the swarm so they don't bury in invader hulls.
    mesh.position.set(x, owner === 'invader' ? 0.9 : 0.45, z);
    if (owner === 'invader') {
      this.orientAlienShot(mesh);
    }
    this.scene.add(mesh);
    this.laserMeshes.set(id, mesh);
  }

  /** Face the camera and shrink with distance so the drop never outgrows the ship. */
  private orientAlienShot(mesh: THREE.Group) {
    mesh.lookAt(this.camera.position);
    const dist = mesh.position.distanceTo(this.camera.position);
    const distScale = THREE.MathUtils.clamp(dist / 28, 0.42, 1.05);
    const pulse = 1 + 0.08 * Math.sin(this.clock.getElapsedTime() * Math.PI * 5);
    mesh.scale.setScalar(distScale * pulse);
  }

  // Update Invader Marching Physics & Plasma Shooting
  private updateInvaders(delta: number) {
    if (this.invaders.length === 0) return;

    this.invaderStepTimer += delta;

    // Movement speed dynamically accelerates as fewer invaders remain!
    const ratioRemaining = this.invaders.length / this.stats.totalInvaders;
    const dynamicInterval = Math.max(0.06, this.invaderStepInterval * (0.2 + ratioRemaining * 0.8));

    // Dynamic techno tempo sync
    soundSynth.setTempoMultiplier(1.0 + (1 - ratioRemaining) * 0.35);

    if (this.invaderStepTimer >= dynamicInterval) {
      this.invaderStepTimer = 0;
      this.invaderStepCounter++;

      // Check if any invader hits wall boundaries
      let hitEdge = false;
      const arenaLimit = this.ARENA_WIDTH / 2 - 1.2;

      for (const inv of this.invaders) {
        if (
          (this.invaderDir > 0 && inv.x >= arenaLimit) ||
          (this.invaderDir < 0 && inv.x <= -arenaLimit)
        ) {
          hitEdge = true;
          break;
        }
      }

      if (hitEdge) {
        this.invaderDir *= -1;
        // Step downward towards player!
        for (const inv of this.invaders) {
          inv.z += this.invaderDropDistance;
          const mesh = this.invaderMeshes.get(inv.id);
          if (mesh) {
            mesh.position.z = inv.z;
          }
        }
      } else {
        // Step sideways
        const stepDist = 0.55 * this.invaderDir;
        for (const inv of this.invaders) {
          inv.x += stepDist;
          const mesh = this.invaderMeshes.get(inv.id);
          if (mesh) {
            mesh.position.x = inv.x;
          }
        }
      }

      // 4-step classic space invaders tick
      soundSynth.playInvaderStep(this.invaderStepCounter);
    }

    // Alien Wing / Body animations
    const time = this.clock.getElapsedTime();
    this.invaders.forEach((inv) => {
      const mesh = this.invaderMeshes.get(inv.id);
      if (mesh) {
        const wingL = mesh.getObjectByName('wing_left');
        const wingR = mesh.getObjectByName('wing_right');
        if (wingL && wingR) {
          wingL.rotation.y = Math.sin(time * 8 + inv.animPhase) * 0.35;
          wingR.rotation.y = -Math.sin(time * 8 + inv.animPhase) * 0.35;
        }
        const reactor = mesh.getObjectByName('reactor_core');
        if (reactor) {
          reactor.rotation.y += delta * 4;
        }
      }
    });

    // Invader Plasma Bombs / Lasers
    this.invaderShootTimer += delta;
    const shootInterval = Math.max(0.45, 1.4 - this.stats.wave * 0.12);
    if (this.invaderShootTimer >= shootInterval) {
      this.invaderShootTimer = 0;
      this.invaderFireLaser();
    }

    // Game Over if invaders reach defense line
    for (const inv of this.invaders) {
      if (inv.z >= this.BREACH_Z) {
        this.triggerGameOver('The Alien Swarm breached your orbital defenses!');
        break;
      }
    }
  }

  // Front-of-column invader fires — a hole you punched is a safe lane.
  private invaderFireLaser() {
    if (this.invaders.length === 0) return;

    const frontByCol = new Map<number, InvaderData>();
    for (const inv of this.invaders) {
      const current = frontByCol.get(inv.col);
      if (!current || inv.z > current.z) frontByCol.set(inv.col, inv);
    }
    const frontline = [...frontByCol.values()];
    const shooter = frontline[Math.floor(Math.random() * frontline.length)];
    soundSynth.playInvaderLaser();

    this.spawnLaser('invader', shooter.x, shooter.z + 0.6, 0, 16 + this.stats.wave * 1.5, ALIEN_SHOT_RIM);
    this.createShockwave(shooter.x, shooter.z + 0.35, ALIEN_SHOT_RIM, 5, 0.12, 0.16);
  }

  // --- Mystery UFO Mothership ---
  private updateUFO(delta: number) {
    if (this.ufoData && this.ufoMesh) {
      const vx = this.ufoData.vx ?? 0;
      this.ufoData.x += vx * delta;
      this.ufoMesh.position.x = this.ufoData.x;

      const lightRing = this.ufoMesh.getObjectByName('ufo_light_ring');
      if (lightRing) {
        lightRing.rotation.y += delta * 6;
      }

      // Check if exited arena
      if (this.ufoData.x > this.ARENA_WIDTH + 4 || this.ufoData.x < -this.ARENA_WIDTH - 4) {
        this.removeUfo();
      }
    } else {
      this.ufoSpawnTimer -= delta;
      if (this.ufoSpawnTimer <= 0) {
        this.spawnUfo();
        this.ufoSpawnTimer = 14 + Math.random() * 10;
      }
    }
  }

  private spawnUfo() {
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -this.ARENA_WIDTH / 2 - 3 : this.ARENA_WIDTH / 2 + 3;
    const vx = fromLeft ? 5.2 : -5.2;
    // Behind the back rank, high enough to peek over the pack.
    const ufoZ = this.INVADER_FRONT_Z - (this.INVADER_ROW_COUNT - 1) * this.INVADER_SPACING_Z - 1.7;

    this.ufoData = {
      id: 'ufo_mothership',
      type: 'ufo',
      row: -1,
      col: -1,
      x: startX,
      z: ufoZ,
      points: 300,
      health: 1,
      maxHealth: 1,
      color: this.theme.invaderTiers[3],
      scale: 1.2,
      animPhase: 0,
      vx,
    };

    this.ufoMesh = createInvaderMesh('ufo', this.theme.invaderTiers[3]);
    this.ufoMesh.position.set(startX, 1.15, ufoZ);
    this.scene.add(this.ufoMesh);

    this.stats.ufoActive = true;
    this.startUfoSiren();
  }

  /** One siren for the ship that is on screen. A second call does not stack. */
  private startUfoSiren() {
    if (this.ufoSirenHandle) return;
    this.ufoSirenHandle = soundSynth.playUfoSiren();
  }

  /** Stop the tone without removing the ship, so a resume can start it again. */
  private silenceUfoSiren() {
    if (!this.ufoSirenHandle) return;
    this.ufoSirenHandle.stop();
    this.ufoSirenHandle = null;
  }

  private removeUfo() {
    if (this.ufoMesh) {
      this.scene.remove(this.ufoMesh);
      this.disposeObject(this.ufoMesh);
      this.ufoMesh = null;
    }
    this.silenceUfoSiren();
    this.ufoData = null;
    this.stats.ufoActive = false;
  }

  // --- Lasers Movement & Cleanup ---
  private updateLasers(delta: number) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.x += laser.vx * delta;
      laser.z += laser.vz * delta;

      const mesh = this.laserMeshes.get(laser.id);
      if (mesh) {
        mesh.position.set(laser.x, laser.owner === 'invader' ? 0.9 : 0.45, laser.z);
        if (laser.owner === 'invader') {
          this.orientAlienShot(mesh);
        }
      }

      // Bounds check
      if (laser.z < -26 || laser.z > 16 || Math.abs(laser.x) > this.ARENA_WIDTH / 2 + 2) {
        this.removeLaser(i);
      }
    }
  }

  private removeLaser(index: number) {
    const laser = this.lasers[index];
    const mesh = this.laserMeshes.get(laser.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
      this.laserMeshes.delete(laser.id);
    }
    this.lasers.splice(index, 1);
  }

  private clearLasers() {
    this.laserMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
    });
    this.laserMeshes.clear();
    this.lasers = [];
  }

  /** First swarm or UFO contact of a trigger counts as one hit. Bunkers do not. */
  private noteVolleyHit(laser: LaserData) {
    if (laser.volleyId == null) return;
    if (this.volleysHit.has(laser.volleyId)) return;
    this.volleysHit.add(laser.volleyId);
    this.p1.shotsHit++;
  }

  // --- Powerups ---
  private spawnPowerup(x: number, z: number, forcedType?: PowerupType) {
    const types: PowerupType[] = [
      'rapid_fire',
      'spread_shot',
      'plasma_shield',
      'emp_nuke',
      'laser_beam',
    ];

    const type = forcedType || types[Math.floor(Math.random() * types.length)];
    const id = `pow_${Date.now()}_${Math.random()}`;

    const drop: PowerupDrop = {
      id,
      type,
      x,
      z,
      vy: 4.5,
      duration: 12,
    };
    this.powerups.push(drop);

    const mesh = createPowerupMesh(type);
    mesh.position.set(x, 0.5, z);
    this.scene.add(mesh);
    this.powerupMeshes.set(id, mesh);
  }

  private updatePowerups(delta: number) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pow = this.powerups[i];
      pow.z += pow.vy * delta;

      const mesh = this.powerupMeshes.get(pow.id);
      if (mesh) {
        mesh.position.set(pow.x, 0.5, pow.z);
        mesh.rotation.y += delta * 3;
        const gem = mesh.getObjectByName('gem');
        if (gem) gem.rotation.x += delta * 4;
      }

      // Check player collection
      const checkCollect = (profile: PlayerProfile, playerMesh: THREE.Group) => {
        if (!profile.isAlive) return false;
        const dist = Math.hypot(pow.x - playerMesh.position.x, pow.z - playerMesh.position.z);
        return dist < 1.35;
      };

      if (checkCollect(this.p1, this.p1Mesh)) {
        this.applyPowerup(pow.type);
        this.removePowerup(i);
        continue;
      }

      if (pow.z > 14) {
        this.removePowerup(i);
      }
    }
  }

  private removePowerup(index: number) {
    const pow = this.powerups[index];
    const mesh = this.powerupMeshes.get(pow.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
      this.powerupMeshes.delete(pow.id);
    }
    this.powerups.splice(index, 1);
  }

  private clearPowerups() {
    this.powerupMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
    });
    this.powerupMeshes.clear();
    this.powerups = [];
  }

  private applyPowerup(type: PowerupType) {
    const profile = this.p1;
    soundSynth.playPowerup();
    this.triggerHaptic([15, 20, 25]);

    if (type === 'emp_nuke') {
      // POW block: wipes the front row, does not replace the current suit.
      soundSynth.playExplosion('ufo');
      this.shakeCamera(0.8);
      if (this.invaders.length > 0) {
        const lowestZ = Math.max(...this.invaders.map((inv) => inv.z));
        const targets = this.invaders.filter((inv) => Math.abs(inv.z - lowestZ) < 1.0);
        targets.forEach((target) => {
          this.destroyInvader(target);
        });
      }
    } else if (type === 'plasma_shield') {
      profile.shieldActive = true;
      profile.activePowerup = 'plasma_shield';
      profile.powerupTimer = 10;
    } else {
      profile.shieldActive = false;
      profile.activePowerup = type;
      profile.powerupTimer = type === 'laser_beam' ? 10 : 12;
    }

    this.pickupFlash = 0.4;
    this.lastHudPowerupCeil = Math.ceil(profile.powerupTimer);
    this.syncShipPowerupLook();
    this.callbacks.onPowerupCollect(type === 'emp_nuke' ? profile.activePowerup : type);
    this.callbacks.onLivesUpdate(this.p1.lives);
  }

  // --- Collision Detection Matrix ---
  private checkCollisions() {
    // 1. Lasers vs Invaders
    for (let lIdx = this.lasers.length - 1; lIdx >= 0; lIdx--) {
      const laser = this.lasers[lIdx];
      if (laser.owner === 'invader') continue;

      // Check vs UFO
      if (this.ufoData && this.ufoMesh) {
        const dist = Math.hypot(laser.x - this.ufoData.x, laser.z - this.ufoData.z);
        if (dist < 1.6 && !(laser.isBeam && laser.hitIds?.includes(this.ufoData.id))) {
          this.noteVolleyHit(laser);
          this.ufoData.health -= laser.damage;
          this.createSparkExplosion(laser.x, laser.z, laser.color, 12);
          if (laser.isBeam) {
            laser.hitIds = [...(laser.hitIds ?? []), this.ufoData.id];
          } else {
            this.removeLaser(lIdx);
          }

          if (this.ufoData.health <= 0) {
            this.destroyUFO();
          }
          if (!laser.isBeam) continue;
        }
      }

      // Check vs Swarm Invaders
      let consumed = false;
      for (let iIdx = this.invaders.length - 1; iIdx >= 0; iIdx--) {
        const inv = this.invaders[iIdx];
        const dist = Math.hypot(laser.x - inv.x, laser.z - inv.z);
        if (dist >= 1.0) continue;
        if (laser.isBeam && laser.hitIds?.includes(inv.id)) continue;

        this.noteVolleyHit(laser);
        inv.health -= laser.damage;
        this.createSparkExplosion(laser.x, laser.z, laser.color, 8);

        if (laser.isBeam) {
          laser.hitIds = [...(laser.hitIds ?? []), inv.id];
        } else {
          this.removeLaser(lIdx);
          consumed = true;
        }

        if (inv.health <= 0) {
          this.destroyInvader(inv);
        }
        if (consumed) break;
      }
      if (consumed) continue;

      // Check vs Bunkers (beam dies here too — it pierces ships, not cover)
      for (let bIdx = this.bunkerBlocks.length - 1; bIdx >= 0; bIdx--) {
        const block = this.bunkerBlocks[bIdx];
        if (Math.hypot(laser.x - block.x, laser.z - block.z) < 0.48) {
          soundSynth.playShieldHit();
          this.damageBunkerBlock(bIdx, 1);
          this.createSparkExplosion(laser.x, laser.z, block.color, 6);
          this.removeLaser(lIdx);
          break;
        }
      }
    }

    // 2. Invader Lasers vs Players & Bunkers
    for (let lIdx = this.lasers.length - 1; lIdx >= 0; lIdx--) {
      const laser = this.lasers[lIdx];
      if (laser.owner !== 'invader') continue;

      // Check vs Bunkers
      let hitBunker = false;
      for (let bIdx = this.bunkerBlocks.length - 1; bIdx >= 0; bIdx--) {
        const block = this.bunkerBlocks[bIdx];
        if (Math.hypot(laser.x - block.x, laser.z - block.z) < 0.48) {
          hitBunker = true;
          soundSynth.playShieldHit();
          this.damageBunkerBlock(bIdx, 1);
          this.createSparkExplosion(laser.x, laser.z, block.color, 6);
          this.removeLaser(lIdx);
          break;
        }
      }
      if (hitBunker) continue;

      // Check vs Player
      if (
        this.p1.isAlive &&
        this.p1Iframes <= 0 &&
        Math.hypot(laser.x - this.p1Mesh.position.x, laser.z - this.p1Mesh.position.z) < 1.1
      ) {
        this.hitPlayer();
        this.removeLaser(lIdx);
        continue;
      }
    }
  }

  private destroyInvader(inv: InvaderData) {
    const idx = this.invaders.findIndex((i) => i.id === inv.id);
    if (idx !== -1) {
      this.invaders.splice(idx, 1);
    }

    const mesh = this.invaderMeshes.get(inv.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.disposeObject(mesh);
      this.invaderMeshes.delete(inv.id);
    }

    soundSynth.playExplosion('invader');
    this.createShockwave(inv.x, inv.z, inv.color, 8, 0.28, 0.2);
    this.shakeCamera(0.2);
    this.triggerHaptic(6);

    // Score & Combo (shotsHit is counted on the laser contact, not the kill)
    const profile = this.p1;
    const comboBonus = this.stats.comboMultiplier;
    const addedScore = inv.points * comboBonus;
    profile.score += addedScore;
    if (profile.score > profile.highScore) {
      profile.highScore = profile.score;
      localStorage.setItem('gemfall_hs_p1', String(profile.highScore));
    }
    this.maybeExtraLife();

    this.stats.comboCount++;
    this.stats.comboMultiplier = Math.min(5, 1 + Math.floor(this.stats.comboCount / 5));
    this.stats.comboTimer = 3.5;
    this.stats.invadersRemaining = this.invaders.length;

    const popupText = comboBonus > 1 ? `+${addedScore}  ${comboBonus}x` : `+${addedScore}`;
    this.emitPopup(inv.x, 1.3, inv.z, popupText, comboBonus > 1 ? 'combo' : 'score');

    // Chance to drop powerup (higher on dreadnoughts)
    const dropRate = inv.type === 'dreadnought' ? 0.35 : 0.08;
    if (Math.random() < dropRate) {
      this.spawnPowerup(inv.x, inv.z);
    }

    this.callbacks.onScoreUpdate(this.p1.score);
    this.callbacks.onStatsUpdate(this.stats);

    // Wave Cleared Check!
    if (this.invaders.length === 0) {
      this.triggerWaveClear();
    }
  }

  private destroyUFO() {
    if (!this.ufoData) return;
    const x = this.ufoData.x;
    const z = this.ufoData.z;
    const points = this.ufoData.points;

    this.removeUfo();
    soundSynth.playExplosion('ufo');
    this.emitPopup(x, 2.2, z, `+${points}`, 'ufo');
    this.createShockwave(x, z, '#fde047', 14, 0.38, 0.26);
    this.shakeCamera(0.6);
    this.triggerHaptic([25, 25, 50]);

    const profile = this.p1;
    profile.score += points;
    if (profile.score > profile.highScore) {
      profile.highScore = profile.score;
      localStorage.setItem('gemfall_hs_p1', String(profile.highScore));
    }
    this.maybeExtraLife();

    // Always drop a powerup!
    this.spawnPowerup(x, z);

    this.callbacks.onScoreUpdate(this.p1.score);
  }

  private maybeExtraLife() {
    const profile = this.p1;
    let granted = 0;
    while (profile.score >= this.nextExtraLifeAt) {
      this.nextExtraLifeAt += this.EXTRA_LIFE_EVERY;
      if (profile.lives < profile.maxLives) {
        profile.lives++;
        granted++;
        soundSynth.playPowerup();
        this.callbacks.onLivesUpdate(profile.lives);
      }
    }
    if (granted > 0) {
      this.emitPopup(this.p1Mesh.position.x, this.p1Mesh.position.y + 1.6, this.p1Mesh.position.z, '1UP', 'life');
    }
  }

  private hitPlayer() {
    const profile = this.p1;
    const mesh = this.p1Mesh;
    if (this.p1Iframes > 0) return;

    if (profile.shieldActive) {
      soundSynth.playShieldHit();
      profile.shieldActive = false;
      profile.activePowerup = null;
      profile.powerupTimer = 0;
      this.p1Iframes = this.PLAYER_IFRAMES * 0.45;
      this.syncShipPowerupLook();
      this.createShockwave(mesh.position.x, mesh.position.z, POWERUP_PALETTE.plasma_shield);
      this.triggerHaptic([15, 20]);
      this.callbacks.onPowerupCollect(null);
      return;
    }

    profile.lives--;
    soundSynth.playExplosion('player');
    this.shakeCamera(0.7);
    this.createShockwave(mesh.position.x, mesh.position.z, profile.shipColor, 30);
    this.triggerHaptic([35, 25, 45]);

    this.callbacks.onLivesUpdate(this.p1.lives);

    if (profile.lives <= 0) {
      profile.isAlive = false;
      mesh.visible = false;

      this.triggerGameOver('Ship critical failure. Mission compromised!');
      return;
    }

    this.p1Iframes = this.PLAYER_IFRAMES;
  }

  private damageBunkerBlock(index: number, damage: number) {
    const block = this.bunkerBlocks[index];
    block.health -= damage;

    const mesh = this.bunkerBlockMeshes.get(block.id);
    if (!mesh) return;

    if (block.health <= 0) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.bunkerBlockMeshes.delete(block.id);
      this.bunkerBlocks.splice(index, 1);
    } else {
      // Crack tint
      (mesh.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.6);
      mesh.scale.multiplyScalar(0.85);
    }
  }

  private updateCombo(delta: number) {
    if (this.stats.comboTimer > 0) {
      this.stats.comboTimer -= delta;
      if (this.stats.comboTimer <= 0) {
        this.stats.comboCount = 0;
        this.stats.comboMultiplier = 1;
        this.callbacks.onStatsUpdate(this.stats);
      }
    }
  }

  private triggerWaveClear() {
    soundSynth.playWaveClear();
    this.callbacks.onWaveClear(this.stats.wave);

    // Warp streak camera effect, then restore the framing computed for this
    // container. A hardcoded FOV here would silently re-tune the camera after
    // every wave (e.g. phones would lose their portrait framing on wave 2).
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    setTimeout(() => {
      if (this.isDestroyed) return;
      this.spawnWave(this.stats.wave + 1);
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.updateCameraFraming(width, height);
    }, 2400);
  }

  private triggerGameOver(reason: string) {
    if (this.isRunning) {
      this.noteBestWave(this.stats.wave);
      this.callbacks.onStatsUpdate(this.stats);
    }
    this.isRunning = false;
    this.isPaused = false;
    this.keysDown = {};
    this.silenceUfoSiren();
    soundSynth.playGameOver();
    soundSynth.stopMusic();

    const winnerMsg = reason;

    this.callbacks.onGameOver(winnerMsg);
  }

  // --- Particle Systems & Shockwaves ---
  private createShockwave(
    x: number,
    z: number,
    colorHex: string,
    count = 24,
    maxLife = 0.65,
    size = 0.35
  ) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = x;
      positions[idx + 1] = 0.4;
      positions[idx + 2] = z;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      velocities[idx] = Math.cos(angle) * speed;
      velocities[idx + 1] = (Math.random() - 0.2) * 5;
      velocities[idx + 2] = Math.sin(angle) * speed;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(colorHex),
      size,
      transparent: true,
      opacity: 1.0,
    });

    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    this.particles.push({ mesh, velocities, life: 0, maxLife });
  }

  private createSparkExplosion(x: number, z: number, colorHex: string, count = 8) {
    this.createShockwave(x, z, colorHex, count);
  }

  private updateParticles(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;

      const posAttr = p.mesh.geometry.attributes.position;
      const positions = posAttr.array as Float32Array;
      const count = positions.length / 3;

      for (let j = 0; j < count; j++) {
        const idx = j * 3;
        positions[idx] += p.velocities[idx] * delta;
        positions[idx + 1] += p.velocities[idx + 1] * delta;
        positions[idx + 2] += p.velocities[idx + 2] * delta;
      }
      posAttr.needsUpdate = true;

      const mat = p.mesh.material as THREE.PointsMaterial;
      mat.opacity = 1 - p.life / p.maxLife;

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private shakeCamera(intensity: number) {
    this.cameraShakeIntensity = Math.min(1.2, this.cameraShakeIntensity + intensity);
  }

  // --- Rendering ---
  private render(delta: number) {
    // Follow a fraction of the depth lane so a push-in grows the swarm
    // and a drop-back buys a wider view, without the camera locking to the ship.
    const depthOffset = this.p1Mesh.position.z - this.PLAYER_Z;
    const targetCamZ = this.cameraBaseZ + depthOffset * 0.35;

    if (this.cameraShakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity * 0.8;
      const shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity * 0.6;
      this.camera.position.x = shakeX;
      this.camera.position.y = this.cameraBaseY + shakeY;
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - delta * 2.8);
    } else {
      const targetCamX = this.p1Mesh.position.x * 0.15;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 4, delta);
      this.camera.position.y = this.cameraBaseY;
    }
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 4, delta);

    this.camera.lookAt(
      this.cameraLookTarget.x,
      this.cameraLookTarget.y,
      this.cameraLookTarget.z + depthOffset * 0.15
    );
    this.renderer.render(this.scene, this.camera);
  }

  // --- Cleanup ---
  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    soundSynth.stopMusic();

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    this.clearLasers();
    this.clearPowerups();
    this.clearInvaders();
    this.clearBunkers();

    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}

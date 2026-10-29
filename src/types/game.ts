export type GameMode = 'solo';

export interface PlayerProfile {
  id: 'p1';
  name: string;
  callsign: string;
  shipColor: string;
  trailColor: string;
  score: number;
  highScore: number;
  lives: number;
  maxLives: number;
  activePowerup: PowerupType | null;
  powerupTimer: number; // in seconds remaining
  shieldActive: boolean;
  shotsFired: number;
  shotsHit: number;
  isAlive: boolean;
}

export type PowerupType = 
  | 'rapid_fire'
  | 'spread_shot'
  | 'plasma_shield'
  | 'emp_nuke'
  | 'laser_beam';

/** Pickup gem, ship kit, and shot color — one hue per power so the look IS the power. */
export const POWERUP_PALETTE: Record<PowerupType, string> = {
  rapid_fire: '#facc15',
  spread_shot: '#a855f7',
  plasma_shield: '#06b6d4',
  emp_nuke: '#ef4444',
  laser_beam: '#10b981',
};

export const POWERUP_LABEL: Record<PowerupType, string> = {
  rapid_fire: 'RAPID',
  spread_shot: 'SPREAD',
  plasma_shield: 'SHIELD',
  emp_nuke: 'EMP',
  laser_beam: 'BEAM',
};

export interface PowerupDrop {
  id: string;
  type: PowerupType;
  x: number;
  z: number;
  vy: number;
  duration: number;
}

export interface BunkerBlock {
  id: string;
  bunkerIndex: number;
  col: number;
  row: number;
  x: number;
  y: number;
  z: number;
  health: number; // 0 = destroyed, 1 = cracked, 2 = full
  color: string;
}

export type InvaderType = 'scout' | 'cruiser' | 'dreadnought' | 'ufo' | 'boss';

export interface InvaderData {
  id: string;
  type: InvaderType;
  row: number;
  col: number;
  x: number;
  z: number;
  points: number;
  health: number;
  maxHealth: number;
  color: string;
  scale: number;
  animPhase: number;
  vx?: number;
}

export interface LaserData {
  id: string;
  owner: 'p1' | 'invader';
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  color: string;
  isBeam?: boolean;
  /** Beam bolts skip invaders already pierced this flight. */
  hitIds?: string[];
  /** Player bolts from one trigger share an id so accuracy counts the trigger. */
  volleyId?: number;
}

/** Highest wave reached after a sortie has started. Title-screen boot does not write it. */
export const BEST_WAVE_STORAGE_KEY = 'gemfall_best_wave';

export function readBestWave(): number {
  try {
    const value = Number(localStorage.getItem(BEST_WAVE_STORAGE_KEY));
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value);
  } catch {
    return 0;
  }
}

export type ThemeId = 
  | 'synthwave'
  | 'cosmic_romance'
  | 'phosphor_arcade'
  | 'bio_swarm'
  | 'solar_flare'
  | 'cyber_matrix';

export interface GameTheme {
  id: ThemeId;
  name: string;
  tagline: string;
  p1Color: string;
  /** Cosmetic accent swatch only — there is no second pilot in solo mode. */
  p2Color: string;
  gridColor: string;
  gridHorizon: string;
  bgSpace: string;
  nebulaColors: [string, string, string];
  invaderTiers: [string, string, string, string]; // Scout, Cruiser, Dreadnought, UFO
  bunkerColor: string;
  laserP1: string;
  /** Cosmetic accent swatch only — never used for a second pilot's laser. */
  laserP2: string;
  laserAlien: string;
  particleColors: string[];
  ambientColor: string;
  keyLightColor: string;
  soundPreset: 'synthwave' | 'chiptune' | 'darktechno' | 'cosmic' | 'acid';
}

export interface GameStats {
  wave: number;
  invadersRemaining: number;
  totalInvaders: number;
  invaderSpeedMultiplier: number;
  ufoActive: boolean;
  ufoTimer: number;
  comboCount: number;
  comboMultiplier: number;
  comboTimer: number;
  /** Highest wave reached in any sortie on this browser. */
  bestWave: number;
}

/**
 * Gemfall Invaders
 * One pilot defending the frontier, with techno-space soundtrack,
 * 2.5D perspective visual effects, multiple themes, and mobile/desktop controls.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, ScorePopup } from './game/GameEngine';
import { GAME_THEMES, DEFAULT_THEME_ID } from './game/themes';
import { GameStats, PlayerProfile, readBestWave, ThemeId } from './types/game';
import { HUD } from './components/HUD';
import { TouchControls } from './components/TouchControls';
import { BottomDock } from './components/BottomDock';
import { CoupleModal } from './components/CoupleModal';
import { HelpModal } from './components/HelpModal';
import { GameOverModal } from './components/GameOverModal';
import { PauseOverlay } from './components/PauseOverlay';
import { WaveClearedBanner } from './components/WaveClearedBanner';
import { soundSynth } from './audio/SoundSynth';
import { Play, Sparkles, Heart } from 'lucide-react';

type ActiveScorePopup = ScorePopup & { id: number };

function ScoreFloater({
  popup,
  onDone,
}: {
  popup: ActiveScorePopup;
  onDone: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(popup.id), 700);
    return () => window.clearTimeout(timer);
  }, [onDone, popup.id]);

  return (
    <span
      data-testid="score-floater"
      className={`score-floater score-floater-${popup.tone}`}
      style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
    >
      {popup.text}
    </span>
  );
}

/**
 * The game is solo-only everywhere: one ship, one thumb dock on touch, one
 * set of keys on desktop.
 */
export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // App UI State
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Pause is derived from its causes rather than stored directly, so closing a
  // menu or collapsing the dock resumes exactly when nothing else holds the
  // sim. `manualPause` is the player's own toggle (button / P / Esc).
  const [manualPause, setManualPause] = useState(false);
  const [hiddenPause, setHiddenPause] = useState(false);
  const [isDockOpen, setIsDockOpen] = useState(false);

  // Modals
  const [isCoupleModalOpen, setIsCoupleModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);
  const [gameOverMsg, setGameOverMsg] = useState('');
  const [waveClearedNum, setWaveClearedNum] = useState<number | null>(null);

  // Player & Game State for HUD
  const [p1Profile, setP1Profile] = useState<PlayerProfile>({
    id: 'p1',
    name: localStorage.getItem('gemfall_p1_name') || localStorage.getItem('cosmic_p1_name') || 'Commander Dan',
    callsign: localStorage.getItem('gemfall_p1_callsign') || localStorage.getItem('cosmic_p1_callsign') || 'COMMANDER',
    shipColor: GAME_THEMES[DEFAULT_THEME_ID].p1Color,
    trailColor: GAME_THEMES[DEFAULT_THEME_ID].laserP1,
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
  });

  const [stats, setStats] = useState<GameStats>({
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
  });

  const floaterSeq = useRef(0);
  const [floaters, setFloaters] = useState<ActiveScorePopup[]>([]);
  const dismissFloater = useCallback((id: number) => {
    setFloaters((prev) => prev.filter((floater) => floater.id !== id));
  }, []);

  // Mobile AutoFire State
  const [p1AutoFire, setP1AutoFire] = useState(false);

  // Single source of truth for "the thumb dock is on screen". TouchControls
  // renders exactly when this is true, and the CSS reserves the control band
  // from the same flag — the two can never disagree (e.g. touchscreen laptops
  // that report both a fine pointer and touch, where media queries alone and
  // maxTouchPoints alone give different answers).
  const [hasThumbDock, setHasThumbDock] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const sync = () => setHasThumbDock(query.matches || navigator.maxTouchPoints > 0);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const isPaused =
    hasStarted &&
    !isGameOverModalOpen &&
    (manualPause || hiddenPause || isDockOpen || isCoupleModalOpen || isHelpModalOpen);

  // Engine is the actuator for the derived pause state.
  useEffect(() => {
    engineRef.current?.setPaused(isPaused);
  }, [isPaused]);

  // Leaving the tab mid-fight pauses instead of letting the swarm advance.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') setHiddenPause(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // P / Esc toggle pause; Esc also backs out of an open modal first.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

      // Esc backs out of an open modal even while a form field has focus.
      if (e.code === 'Escape') {
        if (isGameOverModalOpen) return;
        if (isCoupleModalOpen) {
          setIsCoupleModalOpen(false);
          return;
        }
        if (isHelpModalOpen) {
          setIsHelpModalOpen(false);
          return;
        }
      }

      // A "p" typed into a name field is not a pause request.
      if (isTyping) return;
      if (e.code !== 'KeyP' && e.code !== 'Escape') return;
      if (!hasStarted) return;
      e.preventDefault();
      setManualPause((prev) => !prev);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasStarted, isCoupleModalOpen, isHelpModalOpen, isGameOverModalOpen]);

  // Initialize Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const initialTheme = GAME_THEMES[currentThemeId];
    const engine = new GameEngine(
      containerRef.current,
      {
        onScoreUpdate: (score) => {
          setP1Profile((prev) => ({
            ...prev,
            score,
            highScore: Math.max(prev.highScore, score),
          }));
        },
        onLivesUpdate: (lives) => {
          setP1Profile((prev) => ({
            ...prev,
            lives,
            isAlive: lives > 0,
          }));
        },
        onWaveClear: (wave) => {
          setWaveClearedNum(wave);
          setTimeout(() => setWaveClearedNum(null), 2500);
        },
        onGameOver: (msg) => {
          const pilot = engineRef.current?.p1;
          if (pilot) {
            setP1Profile((prev) => ({
              ...prev,
              shotsFired: pilot.shotsFired,
              shotsHit: pilot.shotsHit,
              score: pilot.score,
              highScore: Math.max(prev.highScore, pilot.highScore),
              lives: pilot.lives,
              isAlive: pilot.isAlive,
            }));
          }
          setGameOverMsg(msg || 'Game Over');
          setIsGameOverModalOpen(true);
        },
        onStatsUpdate: (newStats) => {
          setStats({ ...newStats });
        },
        onScorePopup: (popup) => {
          const id = ++floaterSeq.current;
          setFloaters((prev) => {
            const next = [...prev, { ...popup, id }];
            return next.length > 12 ? next.slice(next.length - 12) : next;
          });
        },
        onPowerupCollect: () => {
          const p = engineRef.current?.p1;
          if (!p) return;
          setP1Profile((prev) => ({
            ...prev,
            activePowerup: p.activePowerup,
            powerupTimer: p.powerupTimer,
            shieldActive: p.shieldActive,
            lives: p.lives,
            isAlive: p.isAlive,
            score: p.score,
          }));
        },
      },
      initialTheme,
      p1Profile.name
    );

    engineRef.current = engine;

    // Dev-only test hook: lets Playwright drive the simulation (force a game
    // over, read ship visibility). `import.meta.env.DEV` is statically false in
    // production, so this block is stripped from the shipped bundle.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__gemfall = engine;
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
      if (import.meta.env.DEV) {
        delete (window as unknown as Record<string, unknown>).__gemfall;
      }
    };
  }, []);

  // Push the auto-fire toggle into the engine (kept out of the state updater so
  // the updater stays pure and StrictMode double-invocation is harmless)
  useEffect(() => {
    if (engineRef.current) engineRef.current.touchInputP1.autoFire = p1AutoFire;
  }, [p1AutoFire]);

  // Handle Theme Change
  const handleSelectTheme = (themeId: ThemeId) => {
    setCurrentThemeId(themeId);
    const thm = GAME_THEMES[themeId];
    if (engineRef.current) {
      engineRef.current.setTheme(thm);
    }
  };

  // Toggle Pause (the derived effect above is what actually suspends the sim)
  const handleTogglePause = useCallback(() => {
    if (!hasStarted) return;
    setManualPause((prev) => !prev);
  }, [hasStarted]);

  const handleResume = useCallback(() => {
    setManualPause(false);
    setHiddenPause(false);
    setIsDockOpen(false);
  }, []);

  // Toggle Mute
  const handleToggleMute = () => {
    const muted = soundSynth.toggleMute();
    setIsMuted(muted);
  };

  // Start Game from Title Screen
  const handleStartGame = () => {
    soundSynth.ensureAudio();
    if (engineRef.current) {
      engineRef.current.start();
    }
    setManualPause(false);
    setHiddenPause(false);
    setIsDockOpen(false);
    setHasStarted(true);
  };

  // Restart Match
  const handleRestart = () => {
    setIsGameOverModalOpen(false);
    setManualPause(false);
    setHiddenPause(false);
    setIsDockOpen(false);
    if (engineRef.current) {
      engineRef.current.restart();
    }
  };

  // Save Pilot Profile
  const handleSaveProfile = (name: string, callsign: string) => {
    setP1Profile((prev) => ({ ...prev, name, callsign }));

    localStorage.setItem('gemfall_p1_name', name);
    localStorage.setItem('gemfall_p1_callsign', callsign);

    if (engineRef.current) {
      engineRef.current.p1.name = name;
      engineRef.current.p1.callsign = callsign;
    }
  };

  // Touch Callbacks (single-pilot dock)
  const handleP1Move = useCallback((strafe: number, depth: number) => {
    if (!engineRef.current) return;
    engineRef.current.touchInputP1.moveX = strafe;
    engineRef.current.touchInputP1.moveZ = depth;
  }, []);

  const handleP1Fire = useCallback((fire: boolean) => {
    if (engineRef.current) engineRef.current.touchInputP1.fire = fire;
  }, []);

  const handleP1AutoFireToggle = useCallback(() => {
    setP1AutoFire((prev) => !prev);
  }, []);

  const activeTheme = GAME_THEMES[currentThemeId];

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-black select-none touch-none${
        hasThumbDock ? ' has-thumb-dock' : ''
      }`}
    >
      {/* Three.js canvas. On touch devices it stops above the thumb dock so
          the controls never sit on top of the arena (see .game-viewport). */}
      <div ref={containerRef} className="game-viewport absolute top-0 left-0 right-0 z-0" />

      <div
        className="game-viewport absolute top-0 left-0 right-0 z-20 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {floaters.map((floater) => (
          <ScoreFloater key={floater.id} popup={floater} onDone={dismissFloater} />
        ))}
      </div>

      {/* Fades the floor into the reserved control band instead of a hard cut */}
      <div className="game-viewport-fade" />

      {/* Optional CRT Scanlines Effect for Retro Theme */}
      {currentThemeId === 'phosphor_arcade' && <div className="crt-scanlines" />}

      {/* Main Game HUD */}
      {hasStarted && (
        <>
          <HUD
            p1={p1Profile}
            stats={stats}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onOpenProfiles={() => setIsCoupleModalOpen(true)}
          />

          {hasThumbDock && (
            <TouchControls
              onP1Move={handleP1Move}
              onP1Fire={handleP1Fire}
              onP1AutoFireToggle={handleP1AutoFireToggle}
              p1AutoFire={p1AutoFire}
              p1Color={activeTheme.p1Color}
              isPaused={isPaused}
              onTogglePause={handleTogglePause}
            />
          )}

          <BottomDock
            currentTheme={activeTheme}
            onSelectTheme={handleSelectTheme}
            onOpenCoupleModal={() => setIsCoupleModalOpen(true)}
            onOpenHelpModal={() => setIsHelpModalOpen(true)}
            onRestartGame={handleRestart}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isExpanded={isDockOpen}
            onToggleExpanded={() => setIsDockOpen((prev) => !prev)}
          />

          <PauseOverlay
            isOpen={isPaused}
            p1={p1Profile}
            wave={stats.wave}
            isMuted={isMuted}
            isTouch={hasThumbDock}
            onResume={handleResume}
            onRestart={handleRestart}
            onToggleMute={handleToggleMute}
          />
        </>
      )}

      {/* Wave Cleared Banner Overlay */}
      {waveClearedNum !== null && <WaveClearedBanner wave={waveClearedNum} />}

      {/* Start Game Title Screen Overlay */}
      {!hasStarted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-xl w-full max-h-[94vh] overflow-y-auto bg-slate-950/95 border border-cyan-500/50 rounded-3xl p-5 sm:p-9 shadow-2xl shadow-cyan-950/60 text-center flex flex-col items-center gap-4 sm:gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 font-chakra text-[11px] font-semibold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>SOLO ARCADE • 1080x2400 FHD+</span>
            </div>

            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-3xl sm:text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 tracking-wider">
                GEMFALL INVADERS
              </h1>
              <div className="font-arcade text-xs sm:text-sm text-cyan-300 tracking-widest glow-cyan">
                2.5D DEFENSE FORCE
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-chakra max-w-md">
              A high-octane 2.5D space battle built for one pilot: glide to steer, tap or press space to fire, and blast the swarm before it breaches the line. Live techno audio and haptic rumble included.
            </p>

            <div
              data-testid="title-best-wave"
              className="font-arcade text-[10px] sm:text-xs text-amber-300 tracking-widest"
            >
              BEST WAVE {stats.bestWave.toString().padStart(2, '0')}
            </div>

            {/* Pilot Badge */}
            <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
              <div className="bg-slate-900/90 border border-cyan-500/40 p-3 rounded-xl flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-orbitron font-bold text-xs border"
                  style={{
                    backgroundColor: `${activeTheme.p1Color}25`,
                    borderColor: activeTheme.p1Color,
                    color: activeTheme.p1Color,
                  }}
                >
                  P1
                </div>
                <div className="text-left truncate">
                  <div className="text-[10px] text-cyan-400 font-chakra uppercase">
                    {p1Profile.callsign}
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {p1Profile.name}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full max-w-md py-2 rounded-xl border border-cyan-500/40 bg-cyan-950/30 text-[11px] font-chakra font-bold uppercase tracking-widest text-cyan-200">
              Solo Pilot • One-Thumb Glide
            </div>

            {/* Launch Button */}
            <button
              onClick={handleStartGame}
              className="w-full max-w-md py-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-black font-orbitron font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-cyan-950/60 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>LAUNCH BATTLE WITH SOUND</span>
            </button>

            <div className="flex items-center gap-4 text-[11px] font-chakra text-slate-400">
              <span>Supports Keyboard & Mobile Touch</span>
              <span>•</span>
              <button
                onClick={() => setIsCoupleModalOpen(true)}
                className="text-pink-400 hover:underline flex items-center gap-1"
              >
                <Heart className="w-3 h-3" />
                <span>Customize Names</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CoupleModal
        isOpen={isCoupleModalOpen}
        onClose={() => setIsCoupleModalOpen(false)}
        p1={p1Profile}
        onSaveProfile={handleSaveProfile}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <GameOverModal
        isOpen={isGameOverModalOpen}
        message={gameOverMsg}
        p1={p1Profile}
        wave={stats.wave}
        bestWave={stats.bestWave}
        onRestart={handleRestart}
      />
    </div>
  );
}

import React from 'react';
import { GameStats, PlayerProfile, POWERUP_LABEL, POWERUP_PALETTE } from '../types/game';
import { Pause, Play, Shield, Zap } from 'lucide-react';

interface HUDProps {
  p1: PlayerProfile;
  stats: GameStats;
  isPaused: boolean;
  onTogglePause: () => void;
  onOpenProfiles: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  p1,
  stats,
  isPaused,
  onTogglePause,
  onOpenProfiles,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 pointer-events-none p-1.5 sm:p-3 pt-[max(6px,env(safe-area-inset-top))] flex flex-col gap-1 select-none">
      <div className="flex items-center justify-between gap-1 sm:gap-2 max-w-5xl mx-auto w-full">
        {/* --- Player 1 (Husband) --- */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 bg-black/75 backdrop-blur-md border border-cyan-500/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-lg shadow-cyan-950/40">
          <button
            onClick={onOpenProfiles}
            className="flex items-center gap-1.5 group text-left cursor-pointer transition active:scale-95"
            title="Customize Pilot Profile"
          >
            <div
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-orbitron font-bold text-[10px] sm:text-xs border shrink-0"
              style={{
                backgroundColor: `${p1.shipColor}25`,
                borderColor: p1.shipColor,
                color: p1.shipColor,
              }}
            >
              P1
            </div>
            <div className="leading-tight">
              <div className="text-[9px] font-chakra uppercase tracking-wider text-cyan-400 group-hover:text-cyan-300">
                {p1.callsign}
              </div>
              <div className="text-xs sm:text-sm font-bold text-white truncate max-w-[65px] sm:max-w-[110px]">
                {p1.name}
              </div>
            </div>
          </button>

          <div className="h-6 w-[1px] bg-slate-800" />

          <div className="text-right">
            <div className="text-[8px] font-arcade text-slate-400 hidden sm:block">SCORE</div>
            <div className="font-arcade text-[11px] sm:text-sm text-cyan-300 glow-cyan">
              {p1.score.toString().padStart(5, '0')}
            </div>
          </div>

          {/* Lives as Ships */}
          <div className="flex items-center gap-0.5 pl-0.5">
            {Array.from({ length: Math.max(0, p1.lives) }).map((_, i) => (
              <span
                key={i}
                className="inline-block w-2 h-3 sm:w-2.5 sm:h-3.5 bg-cyan-400 rounded-xs shadow-sm shadow-cyan-500"
                style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                title="Ship Life"
              />
            ))}
            {!p1.isAlive && (
              <span className="text-[9px] font-arcade text-rose-500 animate-pulse">
                DOWN
              </span>
            )}
          </div>

          {/* Active Powerup Badge */}
          {p1.activePowerup && (
            <div
              className="flex items-center gap-1 bg-black/90 px-1.5 py-0.5 rounded text-[9px] font-chakra font-bold"
              style={{
                color: POWERUP_PALETTE[p1.activePowerup],
                border: `1px solid ${POWERUP_PALETTE[p1.activePowerup]}`,
              }}
            >
              {p1.activePowerup === 'plasma_shield' ? (
                <Shield className="w-2.5 h-2.5" />
              ) : (
                <Zap className="w-2.5 h-2.5" />
              )}
              <span>{POWERUP_LABEL[p1.activePowerup]}</span>
              <span>{Math.ceil(p1.powerupTimer)}s</span>
            </div>
          )}
        </div>

        {/* --- Center Wave & Combo Telemetry --- */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 bg-black/80 backdrop-blur-md border border-purple-500/40 px-2 sm:px-3 py-1 rounded-xl text-center shadow-lg shadow-purple-950/40">
          <div>
            <div className="text-[8px] font-arcade text-purple-300">WAVE</div>
            <div className="font-orbitron font-black text-xs sm:text-base text-white">
              {stats.wave.toString().padStart(2, '0')}
            </div>
            {stats.bestWave > 0 && (
              <div
                data-testid="hud-best-wave"
                className="text-[7px] sm:text-[8px] font-arcade text-amber-300 leading-none mt-0.5"
              >
                BEST {stats.bestWave.toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {stats.comboMultiplier > 1 && (
            <div className="px-1.5 py-0.5 rounded bg-pink-500/20 border border-pink-500/60 font-orbitron font-bold text-[9px] sm:text-xs text-pink-300">
              {stats.comboMultiplier}x
            </div>
          )}

          {stats.ufoActive && (
            <div className="px-1.5 py-0.5 rounded bg-red-600/30 border border-red-500 font-arcade text-[7px] sm:text-[9px] text-red-300 animate-pulse">
              UFO!
            </div>
          )}

          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? 'Resume game' : 'Pause game'}
            title={isPaused ? 'Resume (P / Esc)' : 'Pause (P / Esc)'}
            className={`ml-0.5 p-1 rounded-md border transition active:scale-95 cursor-pointer ${
              isPaused
                ? 'bg-cyan-500 text-black border-cyan-300'
                : 'bg-slate-900/80 text-cyan-300 border-cyan-500/40 hover:bg-slate-800'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>
    </header>
  );
};

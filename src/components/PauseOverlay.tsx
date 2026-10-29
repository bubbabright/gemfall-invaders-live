import React from 'react';
import { PlayerProfile } from '../types/game';
import { Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';

interface PauseOverlayProps {
  isOpen: boolean;
  p1: PlayerProfile;
  wave: number;
  isMuted: boolean;
  /** Touch devices have no P/Esc key, so the hint changes. */
  isTouch: boolean;
  onResume: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
}

/**
 * Shown whenever the simulation is suspended — manually (P / Esc / pause
 * button), by opening the tactical dock or a modal, or by leaving the tab.
 *
 * Deliberately parked in the upper half of the screen: the tactical dock and
 * the thumb controls keep working underneath it, so you can change theme or
 * mute while the swarm holds position.
 */
export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  isOpen,
  p1,
  wave,
  isMuted,
  isTouch,
  onResume,
  onRestart,
  onToggleMute,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center px-4 pt-[max(64px,14vh)] pointer-events-none">
      <div
        role="dialog"
        aria-label="Game paused"
        className="pointer-events-auto w-full max-w-sm bg-slate-950/95 border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-950/60 p-4 sm:p-5 flex flex-col items-center gap-3 text-center"
      >
        <div className="flex items-center gap-2 text-cyan-300">
          <span className="w-9 h-9 rounded-full bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
            <Pause className="w-4 h-4" />
          </span>
          <h2 className="font-orbitron font-black text-xl sm:text-2xl text-white tracking-wider">
            PAUSED
          </h2>
        </div>

        <p className="text-[11px] sm:text-xs font-chakra text-slate-400">
          Sortie suspended. The swarm is holding position.
        </p>

        <div className="grid grid-cols-2 gap-2 w-full">
          <div className="bg-slate-900/90 border border-purple-500/40 rounded-lg py-1.5">
            <div className="text-[9px] font-arcade text-purple-300">WAVE</div>
            <div className="font-arcade text-sm text-white">
              {wave.toString().padStart(2, '0')}
            </div>
          </div>
          <div className="bg-slate-900/90 border border-cyan-500/40 rounded-lg py-1.5">
            <div className="text-[9px] font-arcade text-cyan-300">SCORE</div>
            <div className="font-arcade text-sm text-white">
              {p1.score.toString().padStart(5, '0')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onResume}
          className="w-full py-3 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-black font-orbitron font-black text-sm rounded-xl shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>RESUME MISSION</span>
        </button>

        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 font-chakra font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>RESTART SORTIE</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition active:scale-95"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>

        <div className="text-[10px] font-chakra text-slate-500 uppercase tracking-widest">
          {isTouch ? 'Tap Resume to re-engage' : 'P or Esc to resume'}
        </div>
      </div>
    </div>
  );
};

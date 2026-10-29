import React from 'react';
import { PlayerProfile } from '../types/game';
import { Trophy, RefreshCw } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  message: string;
  p1: PlayerProfile;
  wave: number;
  bestWave: number;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  message,
  p1,
  wave,
  bestWave,
  onRestart,
}) => {
  if (!isOpen) return null;

  const p1Accuracy = p1.shotsFired > 0 ? Math.round((p1.shotsHit / p1.shotsFired) * 100) : 0;
  const breached = /breach/i.test(message);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-950 border border-purple-500/50 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-purple-950/60 text-white flex flex-col gap-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 font-chakra text-xs font-semibold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Mission Debrief</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300">
            {wave > 5 ? 'DEEP RUN' : 'MISSION FAILED'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-chakra mt-1">
            {message}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {/* P1 Stats */}
          <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-400 font-chakra">
              <span>{p1.name}</span>
              <span className="font-arcade text-[10px]">P1</span>
            </div>
            <div className="text-xl sm:text-2xl font-arcade text-cyan-300 glow-cyan">
              {p1.score} <span className="text-[10px] text-slate-400">PTS</span>
            </div>
            <div className="text-[11px] font-chakra text-slate-400 flex justify-between">
              <span>Accuracy:</span>
              <span className="text-white font-bold">{p1Accuracy}%</span>
            </div>
            <div className="text-[11px] font-chakra text-slate-400 flex justify-between">
              <span>High Score:</span>
              <span className="text-cyan-400 font-bold">{p1.highScore}</span>
            </div>
          </div>

          {/* Wave Reached */}
          <div className="bg-slate-900/90 border border-purple-500/40 rounded-xl p-3.5 flex flex-col gap-1.5 justify-center">
            <div className="text-xs font-bold text-purple-300 font-chakra">
              WAVE DEFENSE
            </div>
            <div className="text-xl sm:text-2xl font-orbitron font-bold text-purple-200">
              WAVE {wave}
            </div>
            <div className="text-[11px] font-chakra text-slate-400">
              {breached ? 'Sector overrun.' : 'Ship lost in the corridor.'}
            </div>
            <div className="text-[11px] font-chakra text-slate-400 flex justify-between">
              <span>Best wave:</span>
              <span data-testid="debrief-best-wave" className="text-amber-300 font-bold">
                {bestWave.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRestart}
          className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 hover:from-cyan-400 hover:via-purple-500 hover:to-pink-400 text-black font-orbitron font-black text-sm rounded-xl shadow-xl shadow-purple-950/50 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>LAUNCH NEXT SORTIE</span>
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { X, Keyboard, Smartphone, Zap, Crosshair } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-950 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl shadow-cyan-950/40 text-white flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-orbitron font-bold text-white">
              Tactical Flight Manual & Controls
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Desktop Controls */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-cyan-400 font-chakra font-bold text-xs">
              <Keyboard className="w-4 h-4" />
              <span>DESKTOP CONTROLS</span>
            </div>
            <div className="text-xs font-chakra space-y-2 text-slate-300">
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <div className="font-bold text-cyan-300">Keyboard Pilot:</div>
                <div>Strafe: <span className="font-mono text-white bg-slate-800 px-1 rounded">A</span> / <span className="font-mono text-white bg-slate-800 px-1 rounded">D</span> or <span className="font-mono text-white bg-slate-800 px-1 rounded">◄</span> / <span className="font-mono text-white bg-slate-800 px-1 rounded">►</span></div>
                <div>Depth: <span className="font-mono text-white bg-slate-800 px-1 rounded">W</span> / <span className="font-mono text-white bg-slate-800 px-1 rounded">S</span> or <span className="font-mono text-white bg-slate-800 px-1 rounded">▲</span> / <span className="font-mono text-white bg-slate-800 px-1 rounded">▼</span> push in and drop back</div>
                <div>Shoot: <span className="font-mono text-white bg-slate-800 px-1 rounded">SPACEBAR</span> or <span className="font-mono text-white bg-slate-800 px-1 rounded">Z</span></div>
                <div>Pause: <span className="font-mono text-white bg-slate-800 px-1 rounded">P</span> or <span className="font-mono text-white bg-slate-800 px-1 rounded">ESC</span></div>
              </div>
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-purple-400 font-chakra font-bold text-xs">
              <Smartphone className="w-4 h-4" />
              <span>MOBILE & TABLET TOUCH</span>
            </div>
            <div className="text-xs font-chakra space-y-2 text-slate-300">
              <p>• <strong>Thumb pad</strong>: Drag left and right to strafe. Drag up to push toward the swarm, down to drop back.</p>
              <p>• <strong>Fire Button</strong>: Tap or hold to unleash laser barrages.</p>
              <p>• <strong>Auto-Fire Toggle</strong>: Turn ON for effortless one-thumb steering!</p>
              <p>• <strong>Pause</strong>: Tap the <span className="font-mono text-white bg-slate-800 px-1 rounded">II</span> button beside FIRE. Opening the tactical dock pauses too.</p>
              <p>• <strong>One ship, one screen</strong>: The whole arena is yours — no split-player layout.</p>
            </div>
          </div>
        </div>

        {/* Tactical Drops */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
          <div className="text-xs font-chakra font-bold text-amber-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            <span>POWERUP DROPS & TACTICS</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-chakra text-slate-300">
            <div className="p-2 bg-slate-950/70 rounded border border-yellow-500/20">
              <span className="text-yellow-400 font-bold block">Rapid Fire</span>
              Doubles laser fire rate.
            </div>
            <div className="p-2 bg-slate-950/70 rounded border border-purple-500/20">
              <span className="text-purple-400 font-bold block">Triple Spread</span>
              3-way angled laser burst.
            </div>
            <div className="p-2 bg-slate-950/70 rounded border border-cyan-500/20">
              <span className="text-cyan-400 font-bold block">Plasma Shield</span>
              Temporary invulnerability dome.
            </div>
            <div className="p-2 bg-slate-950/70 rounded border border-red-500/20">
              <span className="text-red-400 font-bold block">EMP Row Nuke</span>
              Wipes entire lowest alien rank!
            </div>
            <div className="p-2 bg-slate-950/70 rounded border border-amber-500/20">
              <span className="text-amber-400 font-bold block">Red UFO</span>
              Flies top horizon: 250+ pts & drop!
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs rounded-xl shadow-lg transition"
          >
            Engage Mission
          </button>
        </div>
      </div>
    </div>
  );
};

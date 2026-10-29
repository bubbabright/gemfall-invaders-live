import React from 'react';
import { Sparkles } from 'lucide-react';

interface WaveClearedBannerProps {
  wave: number;
}

export const WaveClearedBanner: React.FC<WaveClearedBannerProps> = ({ wave }) => {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
      <div className="bg-black/80 backdrop-blur-md border-y-2 border-cyan-400 py-6 px-12 text-center shadow-2xl shadow-cyan-950/80 animate-in zoom-in-75 fade-in duration-300">
        <div className="flex items-center justify-center gap-2 text-cyan-400 font-chakra text-xs tracking-widest uppercase mb-1">
          <Sparkles className="w-4 h-4" />
          <span>SECTOR DEFENDED</span>
          <Sparkles className="w-4 h-4" />
        </div>
        <h2 className="text-3xl sm:text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-400 to-amber-300 tracking-wider">
          WAVE {wave} CLEARED!
        </h2>
        <p className="text-xs sm:text-sm font-arcade text-emerald-400 mt-2">
          WARP DRIVE ENGAGED • ADVANCING TO NEXT SECTOR
        </p>
      </div>
    </div>
  );
};

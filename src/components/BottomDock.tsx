import React, { useEffect, useState } from 'react';
import { GameTheme, ThemeId } from '../types/game';
import { GAME_THEMES } from '../game/themes';
import {
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Settings,
  HelpCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { soundSynth } from '../audio/SoundSynth';

interface BottomDockProps {
  currentTheme: GameTheme;
  onSelectTheme: (themeId: ThemeId) => void;
  onOpenCoupleModal: () => void;
  onOpenHelpModal: () => void;
  onRestartGame: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  /** Controlled: opening the dock suspends the sim, closing it resumes. */
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  currentTheme,
  onSelectTheme,
  onOpenCoupleModal,
  onOpenHelpModal,
  onRestartGame,
  isMuted,
  onToggleMute,
  isExpanded,
  onToggleExpanded,
}) => {
  const [activeTab, setActiveTab] = useState<'themes' | 'audio'>('themes');
  const [volume, setVolume] = useState(soundSynth.getVolume());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browsers without the Fullscreen API simply keep the button inert.
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundSynth.setVolume(val);
  };

  return (
    <div
      className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 transition-transform duration-300 flex flex-col items-center"
      style={{
        maxWidth: 'min(920px, 96vw)',
        transform: `translateX(-50%) translateY(${isExpanded ? '0' : 'calc(100% - 28px)'})`,
      }}
    >
      {/* Collapse/Expand Toggle Header Tab */}
      <button
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
        aria-controls="tactical-dock"
        className="px-3 py-1 bg-black/80 hover:bg-slate-900 border-t border-x border-slate-700/60 rounded-t-lg text-[10px] font-chakra font-semibold text-slate-300 flex items-center gap-1 backdrop-blur-md cursor-pointer transition shadow-md"
        title={isExpanded ? 'Collapse the dock and resume' : 'Open tactical controls (pauses the game)'}
      >
        {!isExpanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Show Tactical Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Hide Dock</span>
          </>
        )}
      </button>

      {/* Main Glassmorphic Dock Container */}
      <div
        id="tactical-dock"
        className="w-full max-h-[calc(100vh-140px)] overflow-y-auto bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-b-2xl rounded-tl-2xl rounded-tr-2xl p-2 sm:p-2.5 shadow-2xl flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
          {/* Left: Tab switchers */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('themes')}
              className={`px-2.5 py-1 rounded-lg text-xs font-chakra font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'themes'
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Themes</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`px-2.5 py-1 rounded-lg text-xs font-chakra font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'audio'
                  ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Techno Audio</span>
            </button>
          </div>

          {/* Right: Quick actions (Couple Profile, Controls Guide, Restart) */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onOpenCoupleModal}
              className="px-2.5 py-1 bg-gradient-to-r from-pink-950 to-purple-950 hover:from-pink-900 hover:to-purple-900 border border-pink-500/40 rounded-lg text-xs font-chakra font-bold text-pink-200 flex items-center gap-1.5 transition"
              title="Couple Pilot Settings"
            >
              <Settings className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Pilot Profiles</span>
            </button>

            <button
              onClick={onOpenHelpModal}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 transition"
              title="Controls & Instructions"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 transition"
              title={isFullscreen ? 'Leave Fullscreen' : 'Fullscreen Edge-to-Edge'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-slate-300" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-300" />
              )}
            </button>

            <button
              onClick={onRestartGame}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 transition"
              title="Restart Wave / Match"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'themes' && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {Object.values(GAME_THEMES).map((thm) => {
              const isSelected = thm.id === currentTheme.id;
              return (
                <button
                  key={thm.id}
                  onClick={() => onSelectTheme(thm.id)}
                  className={`p-1.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-purple-400 shadow-md shadow-purple-950/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: thm.p1Color }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: thm.p2Color }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: thm.gridColor }}
                    />
                  </div>
                  <div className="text-[11px] font-chakra font-bold text-white truncate">
                    {thm.name}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="flex items-center justify-between gap-4 px-2 py-1">
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleMute}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
              <div className="flex flex-col">
                <span className="text-xs font-chakra font-bold text-white">
                  Dynamic Techno Soundtrack & SFX
                </span>
                <span className="text-[10px] text-slate-400">
                  Synthesized in real-time via Web Audio API • Tempo scales with wave intensity
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-chakra text-slate-400">VOL</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
              />
              <span className="text-xs font-arcade text-emerald-300 w-8">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

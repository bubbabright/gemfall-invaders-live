import React, { useRef, useState } from 'react';
import {
  Crosshair,
  Pause,
  Play,
  Repeat,
  Navigation,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';

interface TouchControlsProps {
  onP1Move: (strafe: number, depth: number) => void;
  onP1Fire: (fire: boolean) => void;
  onP1AutoFireToggle: () => void;
  p1AutoFire: boolean;
  p1Color: string;
  isPaused: boolean;
  onTogglePause: () => void;
}

/**
 * Single-pilot thumb dock. Touch-primary devices get one steer pad and one fire
 * button — never a split two-player layout, which does not fit on a phone.
 */
export const TouchControls: React.FC<TouchControlsProps> = ({
  onP1Move,
  onP1Fire,
  onP1AutoFireToggle,
  p1AutoFire,
  p1Color,
  isPaused,
  onTogglePause,
}) => {
  const steerZoneRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [thumbX, setThumbX] = useState(0);
  const [thumbZ, setThumbZ] = useState(0);

  // Visibility is owned by App (single hasThumbDock flag shared with the
  // viewport inset), so this component never has to detect touch itself.

  // Read the touch that belongs to this pad, not whichever finger is first on the page.
  const steerStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    dragStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const steerMove = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const origin = dragStart.current;
    if (!touch || !origin) return;
    // 55px sideways and 36px along the pad reach full deflection.
    // Up the pad is +depth, which the sim turns into −Z (into the corridor).
    const strafe = Math.max(-1, Math.min(1, (touch.clientX - origin.x) / 55));
    const depth = Math.max(-1, Math.min(1, -(touch.clientY - origin.y) / 36));
    setThumbX(strafe);
    setThumbZ(depth);
    onP1Move(strafe, depth);
  };

  const steerEnd = () => {
    dragStart.current = null;
    setThumbX(0);
    setThumbZ(0);
    onP1Move(0, 0);
  };

  return (
    <div className="fixed bottom-10 left-0 right-0 pointer-events-none z-20 px-2 sm:px-4 pb-[max(8px,env(safe-area-inset-bottom))] select-none">
      {/* Single-pilot dock: left thumb steers, right thumb fires.
          Sits above the tactical dock handle and inside the band the game
          viewport leaves free, so it never covers the arena. */}
      <div className="max-w-xl mx-auto w-full pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 p-2 sm:p-2.5 rounded-2xl flex items-center gap-2 sm:gap-2.5 shadow-2xl shadow-cyan-950/50">
        {/* Left Thumb: wide swipe steering zone.
            The hint lives as edge chevrons, not center text: the thumb knob
            rests in the middle and would cover any centered label. */}
        <div
          ref={steerZoneRef}
          data-testid="thumb-steer"
          title="Thumb steer: drag left and right to strafe, up to push in, down to drop back"
          className="relative flex-1 h-14 bg-slate-900/90 rounded-xl border border-cyan-500/30 overflow-hidden cursor-pointer touch-none flex items-center justify-center"
          onTouchStart={steerStart}
          onTouchMove={steerMove}
          onTouchEnd={steerEnd}
          onTouchCancel={steerEnd}
        >
          <ChevronLeft className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60 pointer-events-none" />
          <ChevronRight className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60 pointer-events-none" />
          <ChevronUp className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-cyan-400/50 pointer-events-none" />
          <ChevronDown className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-cyan-400/50 pointer-events-none" />
          <div
            className="absolute w-12 h-8 rounded-lg shadow-md flex items-center justify-center"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${thumbX * 36}px), calc(-50% + ${-thumbZ * 10}px))`,
              backgroundColor: p1Color,
              boxShadow: `0 0 16px ${p1Color}`,
            }}
          >
            <Navigation className="w-4 h-4 text-black rotate-90" />
          </div>
        </div>

        {/* Auto-Fire toggle */}
        <button
          type="button"
          onClick={onP1AutoFireToggle}
          className={`px-2.5 py-2.5 rounded-xl border text-xs font-chakra font-bold flex flex-col items-center justify-center transition active:scale-95 ${
            p1AutoFire
              ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/40'
              : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/30'
          }`}
          title="Auto Fire"
        >
          <Repeat className="w-4 h-4" />
          <span className="text-[9px] mt-0.5">AUTO</span>
        </button>

        {/* Right Thumb: fire */}
        <button
          type="button"
          className="px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 active:from-cyan-300 active:to-blue-400 text-black font-orbitron font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-1.5 active:scale-95 transition touch-none"
          onTouchStart={() => onP1Fire(true)}
          onTouchEnd={() => onP1Fire(false)}
          onTouchCancel={() => onP1Fire(false)}
        >
          <Crosshair className="w-4 h-4" />
          <span>FIRE</span>
        </button>

        {/* Pause lives under the firing thumb: a phone has no P/Esc key. */}
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume game' : 'Pause game'}
          className={`p-2.5 rounded-xl border transition active:scale-95 flex items-center justify-center ${
            isPaused
              ? 'bg-cyan-500 text-black border-cyan-300'
              : 'bg-slate-900 text-cyan-300 border-cyan-500/30'
          }`}
        >
          {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

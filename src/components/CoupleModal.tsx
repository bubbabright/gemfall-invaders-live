import React, { useState } from 'react';
import { PlayerProfile } from '../types/game';
import { Heart, X, Save } from 'lucide-react';

interface CoupleModalProps {
  isOpen: boolean;
  onClose: () => void;
  p1: PlayerProfile;
  onSaveProfile: (name: string, callsign: string) => void;
}

export const CoupleModal: React.FC<CoupleModalProps> = ({
  isOpen,
  onClose,
  p1,
  onSaveProfile,
}) => {
  const [p1Name, setP1Name] = useState(p1.name);
  const [p1Callsign, setP1Callsign] = useState(p1.callsign);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(p1Name, p1Callsign);
    onClose();
  };

  const callsignOptions = [
    'COMMANDER',
    'CAPTAIN',
    'STARLIGHT ACE',
    'VALKYRIE',
    'HONEYBEE',
    'SPACE QUEEN',
    'COSMIC HERO',
    'NIGHTHAWK',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-950 border border-pink-500/40 rounded-2xl p-6 shadow-2xl shadow-pink-950/40 text-white flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500/20" />
            <h2 className="text-lg font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400">
              Pilot Customizer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 font-chakra">
          Personalize your pilot. Your callsign and name carry over every sortie.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4">
            {/* Pilot Card */}
            <div className="bg-slate-900/80 border border-cyan-500/40 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-arcade text-cyan-400">PILOT</span>
                <span
                  className="w-3 h-3 rounded-full shadow"
                  style={{ backgroundColor: p1.shipColor }}
                />
              </div>

              <div>
                <label className="text-[11px] font-chakra text-slate-400 block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  maxLength={18}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-chakra text-slate-400 block mb-1">
                  Callsign / Title
                </label>
                <select
                  value={p1Callsign}
                  onChange={(e) => setP1Callsign(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-chakra focus:outline-none focus:border-cyan-400"
                >
                  {callsignOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-1 pt-2 border-t border-slate-800/80 flex justify-between text-[11px] font-chakra text-slate-400">
                <span>Personal Best:</span>
                <span className="font-arcade text-cyan-300">{p1.highScore} PTS</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-chakra text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-orbitron font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Pilot</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

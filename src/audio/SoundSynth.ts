/**
 * Web Audio API Techno-Space Synthesizer & Dynamic Soundtrack Engine
 * Zero external audio assets (100% procedural, zero 404s).
 */

class SoundSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  // Music Sequencer State
  private isMusicPlaying: boolean = false;
  private tempoBpm: number = 126;
  private currentStep: number = 0;
  private nextNoteTime: number = 0;
  private timerId: number | null = null;
  private soundPreset: string = 'synthwave';

  // Volume settings
  private isMuted: boolean = false;
  private masterVolume: number = 0.8;
  private musicVolume: number = 0.65;
  private sfxVolume: number = 0.85;

  // Audio Buffers (pre-cached noise for performance)
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction (standard web audio policy)
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Music Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(3200, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.musicGain.connect(this.filterNode);
      this.filterNode.connect(this.masterGain);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Generate noise buffer
      this.createNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  public ensureAudio() {
    this.initContext();
  }

  public setSoundPreset(preset: string) {
    this.soundPreset = preset;
    if (this.filterNode && this.ctx) {
      if (preset === 'chiptune') {
        this.filterNode.frequency.setValueAtTime(4500, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(1.0, this.ctx.currentTime);
      } else if (preset === 'darktechno') {
        this.filterNode.frequency.setValueAtTime(2200, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(4.0, this.ctx.currentTime);
      } else if (preset === 'acid') {
        this.filterNode.frequency.setValueAtTime(2800, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(6.0, this.ctx.currentTime);
      } else {
        this.filterNode.frequency.setValueAtTime(3400, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);
      }
    }
  }

  public setTempoMultiplier(mult: number) {
    // Base 124 BPM to max 160 BPM based on wave intensity and remaining invaders
    this.tempoBpm = Math.min(160, Math.max(118, 124 * mult));
  }

  public startMusic() {
    this.initContext();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.05;
    this.scheduleMusicLoop();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public toggleMute(): boolean {
    this.initContext();
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  // --- Dynamic Techno Music Sequencer ---
  private scheduleMusicLoop = () => {
    if (!this.isMusicPlaying || !this.ctx) return;

    const secondsPerStep = 60.0 / this.tempoBpm / 4; // 16th notes
    const lookahead = 0.15; // 150ms lookahead

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.playSequencerStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += secondsPerStep;
      this.currentStep = (this.currentStep + 1) % 64; // 4-bar 16-step sequence
    }

    this.timerId = window.setTimeout(this.scheduleMusicLoop, 45);
  };

  private playSequencerStep(step: number, time: number) {
    if (!this.ctx || !this.musicGain) return;

    const barStep = step % 16;
    const barIndex = Math.floor(step / 16);

    // 1. Four-on-the-floor Techno Kick (steps 0, 4, 8, 12)
    if (barStep % 4 === 0) {
      this.triggerTechnoKick(time);
    }

    // 2. Off-beat Sizzle Hi-Hats (steps 2, 6, 10, 14) and 16th ghost hats
    if (barStep % 4 === 2) {
      this.triggerHiHat(time, 0.22, 0.08); // Open/loud offbeat hat
    } else if (barStep % 2 === 1) {
      this.triggerHiHat(time, 0.07, 0.03); // Quiet 16th ghost hat
    }

    // 3. Techno Clap / Snare on 4 and 12
    if (barStep === 4 || barStep === 12) {
      this.triggerTechnoClap(time);
    }

    // 4. Bassline: 16th note rolling synth bass
    // Chord progression across 4 bars: A minor -> F major -> C major -> G major (or Dm-Bb-F-C)
    const chordRoots = [110.0, 87.31, 130.81, 98.0]; // A2, F2, C3, G2 in Hz
    const root = chordRoots[barIndex % chordRoots.length];

    // Bass rhythm pattern (pumping 16ths with syncopation)
    const bassOctavePattern = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 7, 10, 0];
    const semitone = bassOctavePattern[barStep];

    if (barStep % 2 === 0 || barStep === 3 || barStep === 7 || barStep === 11 || barStep === 15) {
      const bassFreq = root * Math.pow(2, (semitone - 12) / 12);
      this.triggerSynthBass(time, bassFreq, 0.12);
    }

    // 5. Cosmic Techno Arpeggiator (Steps through celestial space scale)
    const arpNotes = [0, 3, 7, 10, 12, 15, 12, 7];
    const arpSemitone = arpNotes[step % arpNotes.length];
    const arpFreq = root * 2 * Math.pow(2, arpSemitone / 12);
    
    // Play arp notes with pulsing volume and stereo/delay feel
    if (step % 2 === 0) {
      this.triggerArpNote(time, arpFreq, 0.14);
    }
  }

  // Kick: Pitch drop envelope 140Hz -> 36Hz
  private triggerTechnoKick(time: number) {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.28);
  }

  // Techno Snare / Clap
  private triggerTechnoClap(time: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1300, time);
    filter.Q.setValueAtTime(1.8, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.16);
  }

  // Hi-Hat
  private triggerHiHat(time: number, vol: number, dur: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + dur);
  }

  // Rolling Synth Bass
  private triggerSynthBass(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = this.soundPreset === 'chiptune' ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    const cutoff = this.soundPreset === 'acid' ? 1800 : 900;
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + duration);
    filter.Q.setValueAtTime(this.soundPreset === 'acid' ? 5.0 : 2.5, time);

    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  // Space Arpeggio Lead
  private triggerArpNote(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  // --- Sound Effects (SFX) ---

  // Player Laser Shot (the solo pilot's blaster: sawtooth zap, diving pitch)
  public playPlayerLaser() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const startFreq = 950;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(140, time + 0.14);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.14);
  }

  // Invader Plasma Bomb / Laser
  public playInvaderLaser() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + 0.18);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  // Classic Space Invaders 4-step march tick
  public playInvaderStep(step: number) {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const pitches = [180, 160, 140, 120];
    const freq = pitches[step % 4];

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  // Explosions: Invader, Player, Bunker, UFO
  public playExplosion(type: 'invader' | 'player' | 'bunker' | 'ufo') {
    this.initContext();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;

    const time = this.ctx.currentTime;

    // Noise rumble
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const filterFreq = type === 'player' ? 600 : type === 'ufo' ? 1200 : 850;
    filter.frequency.setValueAtTime(filterFreq, time);
    filter.frequency.linearRampToValueAtTime(80, time + (type === 'player' ? 0.6 : 0.28));

    const gain = this.ctx.createGain();
    const duration = type === 'player' ? 0.6 : type === 'ufo' ? 0.5 : 0.24;
    gain.gain.setValueAtTime(type === 'player' ? 0.5 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(time);
    noise.stop(time + duration);

    // Add sub-bass punch for big explosions
    if (type === 'player' || type === 'ufo') {
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(90, time);
      sub.frequency.exponentialRampToValueAtTime(25, time + 0.4);

      subGain.gain.setValueAtTime(0.45, time);
      subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      sub.connect(subGain);
      subGain.connect(this.sfxGain);

      sub.start(time);
      sub.stop(time + 0.4);
    }
  }

  // UFO Flying Saucer Siren
  public playUfoSiren(): { stop: () => void } {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return { stop: () => {} };

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, time);

    // LFO modulation for sci-fi warble
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(6, time); // 6 Hz warble
    lfoGain.gain.setValueAtTime(140, time);

    lfo.connect(osc.frequency);
    gain.gain.setValueAtTime(0.18, time);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    lfo.start(time);

    return {
      stop: () => {
        try {
          const stopTime = this.ctx ? this.ctx.currentTime : 0;
          gain.gain.linearRampToValueAtTime(0.001, stopTime + 0.08);
          setTimeout(() => {
            osc.stop();
            lfo.stop();
          }, 90);
        } catch {
          // ignore already stopped
        }
      },
    };
  }

  // Bunker Shield Block
  public playShieldHit() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, time);
    osc.frequency.exponentialRampToValueAtTime(320, time + 0.1);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.1);
  }

  // Powerup Pickup
  public playPowerup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const noteTime = time + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, noteTime);

      gain.gain.setValueAtTime(0.25, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.18);
    });
  }


  // Wave Clear Fanfare
  public playWaveClear() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const notes = [
      { f: 587.33, d: 0.12 }, // D5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 880.00, d: 0.16 }, // A5
      { f: 1174.66, d: 0.35 }, // D6
    ];

    let t = time;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + n.d);
      t += n.d * 0.8;
    });
  }

  // Game Over Synth Drop
  public playGameOver() {
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.8);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + 0.85);
  }
}

export const soundSynth = new SoundSynthEngine();

/**
 * Sound effects for the Aviator game using the Web Audio API.
 * All sounds are synthesized — no external files needed.
 * Supports mute/unmute with persistence to localStorage.
 */

const MUTE_KEY = 'aviator-muted';
const ENGINE_VOLUME_SCALE = 1.7;

export class AviatorSound {
  private ctx: AudioContext | null = null;
  private engineNodes: { osc: OscillatorNode; gain: GainNode; noiseGain: GainNode; noiseSource: AudioBufferSourceNode } | null = null;
  private isEngineRunning = false;
  private pendingEngineStart = false;
  private unlocked = false;
  private muted = false;

  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === 'true';
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      console.warn('[AviatorSound] Web Audio API not supported');
      return null;
    }
    return this.ctx;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Unlocks audio playback by creating/resuming the AudioContext.
   * Must be called from a user gesture (click/tap/keydown). Safe to call multiple times.
   */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this.unlocked = true;
        if (this.pendingEngineStart) {
          this.pendingEngineStart = false;
          this.startEngine();
        }
      }).catch(() => {});
    } else {
      this.unlocked = true;
      if (this.pendingEngineStart) {
        this.pendingEngineStart = false;
        this.startEngine();
      }
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, String(muted));
    if (muted && this.engineNodes) {
      this.engineNodes.gain.gain.setValueAtTime(0, this.now());
      this.engineNodes.noiseGain.gain.setValueAtTime(0, this.now());
    } else if (!muted && this.engineNodes) {
      this.engineNodes.gain.gain.setValueAtTime(0.15 * ENGINE_VOLUME_SCALE, this.now());
      this.engineNodes.noiseGain.gain.setValueAtTime(0.06 * ENGINE_VOLUME_SCALE, this.now());
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Starts the looping engine/propeller sound.
   * Call exactly when the plane lifts off (gameState -> 'running').
   */
  startEngine(): void {
    if (this.isEngineRunning) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.unlocked) {
      this.pendingEngineStart = true;
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.isEngineRunning = true;

    try {
      // Low-frequency oscillator for engine rumble
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);

      const gain = ctx.createGain();
      const startVol = this.muted ? 0 : 0.15 * ENGINE_VOLUME_SCALE;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(startVol, ctx.currentTime + 0.3);

      // Lowpass filter to make it sound like an engine
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      filter.Q.setValueAtTime(5, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // Noise source for propeller/air whoosh
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.createNoiseBuffer();
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(200, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2, ctx.currentTime);

      const noiseGain = ctx.createGain();
      const noiseStartVol = this.muted ? 0 : 0.06 * ENGINE_VOLUME_SCALE;
      noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      noiseGain.gain.linearRampToValueAtTime(noiseStartVol, ctx.currentTime + 0.3);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start();

      this.engineNodes = { osc, gain, noiseGain, noiseSource };
    } catch {
      this.isEngineRunning = false;
    }
  }

  /**
   * Updates the engine pitch and volume based on the multiplier.
   * Higher multiplier = faster pitch and louder volume.
   */
  updateEngine(multiplier: number): void {
    if (!this.isEngineRunning || !this.engineNodes || !this.ctx) return;

    const t = this.now();
    const freq = 80 + Math.min(multiplier - 1, 9) * 25;
    const vol = this.muted ? 0 : Math.min((0.15 + Math.min(multiplier - 1, 9) * 0.04) * ENGINE_VOLUME_SCALE, 1);
    const noiseVol = this.muted ? 0 : Math.min((0.06 + Math.min(multiplier - 1, 9) * 0.015) * ENGINE_VOLUME_SCALE, 1);
    const filterFreq = 400 + Math.min(multiplier - 1, 9) * 100;

    try {
      this.engineNodes.osc.frequency.linearRampToValueAtTime(freq, t + 0.05);
      this.engineNodes.gain.gain.linearRampToValueAtTime(vol, t + 0.05);
      this.engineNodes.noiseGain.gain.linearRampToValueAtTime(noiseVol, t + 0.05);
    } catch {
      // context may be closed
    }
  }

  /**
   * Stops the engine sound with a quick fade.
   */
  stopEngine(): void {
    if (!this.engineNodes || !this.ctx) {
      this.isEngineRunning = false;
      this.pendingEngineStart = false;
      return;
    }

    const t = this.now();
    try {
      this.engineNodes.gain.gain.linearRampToValueAtTime(0, t + 0.1);
      this.engineNodes.noiseGain.gain.linearRampToValueAtTime(0, t + 0.1);
    } catch {
      // ignore
    }

    const nodes = this.engineNodes;
    setTimeout(() => {
      try { nodes.osc.stop(); } catch {}
      try { nodes.noiseSource.stop(); } catch {}
    }, 150);

    this.engineNodes = null;
    this.isEngineRunning = false;
    this.pendingEngineStart = false;
  }

  /**
   * Plays the crash/explosion sound. Call the moment the plane crashes.
   */
  playCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    if (!this.unlocked) {
      this.unlock();
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const t = ctx.currentTime;

      // Low boom — descending sine wave
      const boom = ctx.createOscillator();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(120, t);
      boom.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      const boomGain = ctx.createGain();
      boomGain.gain.setValueAtTime(0.6, t);
      boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      boom.connect(boomGain);
      boomGain.connect(ctx.destination);
      boom.start(t);
      boom.stop(t + 0.5);

      // Noise burst — explosion crackle
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.createNoiseBuffer();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(3000, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(t);
      noiseSource.stop(t + 0.4);
    } catch {
      // Audio not available
    }
  }

  /**
   * Plays a cashout/win coin sound. Call when the user successfully cashes out.
   */
  playCashout(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    if (!this.unlocked) {
      this.unlock();
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const t = ctx.currentTime;

      // Two ascending coin chimes — like a cash register "cha-ching"
      const freqs = [880, 1320];
      freqs.forEach((freq, i) => {
        const startT = t + i * 0.08;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startT);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.3, startT + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.3);
      });
    } catch {
      // Audio not available
    }
  }

  /** Clean up everything. */
  destroy(): void {
    this.stopEngine();
    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
    this.unlocked = false;
  }
}

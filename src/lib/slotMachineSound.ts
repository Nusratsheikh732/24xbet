/**
 * Sound effects for the Slot Machine game using the Web Audio API.
 * All sounds are synthesized — no external files needed.
 * Supports mute/unmute with persistence to localStorage.
 */

const MUTE_KEY = 'slot-machine-muted';

export class SlotMachineSound {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private muted = false;
  private spinNodes: { osc: OscillatorNode; gain: GainNode; noiseSource: AudioBufferSourceNode; noiseGain: GainNode } | null = null;
  private isSpinRunning = false;

  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === 'true';
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
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

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { this.unlocked = true; }).catch(() => {});
    } else {
      this.unlocked = true;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, String(muted));
    if (muted && this.spinNodes) {
      try {
        this.spinNodes.gain.gain.setValueAtTime(0, this.now());
        this.spinNodes.noiseGain.gain.setValueAtTime(0, this.now());
      } catch {}
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Button click — short mechanical click */
  playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    } catch {}
  }

  /** Lever pull — mechanical thunk + spring */
  playLever(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const t = ctx.currentTime;
      // Clack
      const clack = ctx.createOscillator();
      clack.type = 'square';
      clack.frequency.setValueAtTime(200, t);
      clack.frequency.exponentialRampToValueAtTime(80, t + 0.08);
      const clackGain = ctx.createGain();
      clackGain.gain.setValueAtTime(0.2, t);
      clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      clack.connect(clackGain);
      clackGain.connect(ctx.destination);
      clack.start(t);
      clack.stop(t + 0.12);

      // Spring twang
      const spring = ctx.createOscillator();
      spring.type = 'triangle';
      spring.frequency.setValueAtTime(400, t + 0.05);
      spring.frequency.exponentialRampToValueAtTime(150, t + 0.25);
      const springGain = ctx.createGain();
      springGain.gain.setValueAtTime(0, t + 0.05);
      springGain.gain.linearRampToValueAtTime(0.08, t + 0.06);
      springGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      spring.connect(springGain);
      springGain.connect(ctx.destination);
      spring.start(t + 0.05);
      spring.stop(t + 0.32);
    } catch {}
  }

  /** Start the spinning reels sound — subtle, light mechanical whir */
  startSpin(): void {
    if (this.isSpinRunning) return;
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.isSpinRunning = true;
    try {
      const t = ctx.currentTime;

      // Soft whir — low-volume triangle wave for a gentle hum
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);

      const gain = ctx.createGain();
      const startVol = this.muted ? 0 : 0.025;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(startVol, t + 0.15);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, t);
      filter.Q.setValueAtTime(1, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // Very faint ticking — high bandpass noise at low volume
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.createNoiseBuffer();
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3000, t);
      noiseFilter.Q.setValueAtTime(12, t);

      const noiseGain = ctx.createGain();
      const noiseStartVol = this.muted ? 0 : 0.012;
      noiseGain.gain.setValueAtTime(0, t);
      noiseGain.gain.linearRampToValueAtTime(noiseStartVol, t + 0.15);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start();

      this.spinNodes = { osc, gain, noiseSource, noiseGain };
    } catch {
      this.isSpinRunning = false;
    }
  }

  /** Stop a single reel — short clunk as each reel lands */
  playReelStop(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(250, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } catch {}
  }

  /** Stop the spinning sound entirely */
  stopSpin(): void {
    if (!this.spinNodes || !this.ctx) {
      this.isSpinRunning = false;
      return;
    }
    const t = this.now();
    try {
      this.spinNodes.gain.gain.linearRampToValueAtTime(0, t + 0.05);
      this.spinNodes.noiseGain.gain.linearRampToValueAtTime(0, t + 0.05);
    } catch {}
    const nodes = this.spinNodes;
    setTimeout(() => {
      try { nodes.osc.stop(); } catch {}
      try { nodes.noiseSource.stop(); } catch {}
    }, 80);
    this.spinNodes = null;
    this.isSpinRunning = false;
  }

  /** Win sound — ascending coin chimes + celebratory melody */
  playWin(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const t = ctx.currentTime;

      // Coin shower — rapid ascending chimes
      const coinFreqs = [523, 659, 784, 1047, 1319];
      coinFreqs.forEach((freq, i) => {
        const startT = t + i * 0.06;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startT);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.2, startT + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.25);
      });

      // Celebratory chord
      const chordFreqs = [523, 659, 784];
      chordFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + 0.3);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t + 0.3);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.32);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + 0.3);
        osc.stop(t + 0.95);
      });
    } catch {}
  }

  /** Small win — single coin chime */
  playSmallWin(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const t = ctx.currentTime;
      const freqs = [880, 1320];
      freqs.forEach((freq, i) => {
        const startT = t + i * 0.08;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startT);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.2, startT + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.3);
      });
    } catch {}
  }

  /** Lose — descending tone */
  playLose(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, t);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    } catch {}
  }
}

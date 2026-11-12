let femaleVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function loadFemaleVoice() {
  if (voicesLoaded || typeof window === 'undefined' || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voicesLoaded = true;

  const femaleHints = [
    'female', 'samantha', 'victoria', 'karen', 'zira', 'susan', 'allison',
    'ava', 'serena', 'tessa', 'fiona', 'moira', 'veena', 'rishi',
    'google uk english female', 'google us english',
  ];

  femaleVoice =
    voices.find((v) => femaleHints.some((h) => v.name.toLowerCase().includes(h))) ??
    voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('google')) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadFemaleVoice();
  window.speechSynthesis.onvoiceschanged = loadFemaleVoice;
}

export type WinSound =
  | { file: string }
  | { text: string; rate?: number; pitch?: number };

let audioContext: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();
let activeSource: AudioBufferSourceNode | null = null;
let playToken = 0;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctor();
  }
  return audioContext;
}

function loadBuffer(src: string): Promise<AudioBuffer> {
  let pending = bufferCache.get(src);
  if (!pending) {
    pending = fetch(src)
      .then((res) => res.arrayBuffer())
      .then((data) => getAudioContext().decodeAudioData(data));
    bufferCache.set(src, pending);
    pending.catch(() => bufferCache.delete(src));
  }
  return pending;
}

function preloadWinSounds(files: string[]) {
  if (typeof window === 'undefined') return;
  files.forEach((file) => {
    loadBuffer(file).catch(() => {});
  });
}

function cancelPending() {
  playToken += 1;
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      // already stopped
    }
    activeSource = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

function playBuffer(src: string, token: number): Promise<void> {
  return loadBuffer(src)
    .then(
      (buffer) =>
        new Promise<void>((resolve) => {
          if (token !== playToken) return resolve();
          const ctx = getAudioContext();
          void ctx.resume();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => {
            if (activeSource === source) activeSource = null;
            resolve();
          };
          activeSource = source;
          source.start();
        }),
    )
    .catch(() => {});
}

function speakLine(sound: { text: string; rate?: number; pitch?: number }, token: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (token !== playToken || !window.speechSynthesis) return resolve();
    if (!voicesLoaded) loadFemaleVoice();
    const utter = new SpeechSynthesisUtterance(sound.text);
    if (femaleVoice) utter.voice = femaleVoice;
    utter.rate = sound.rate ?? 1.2;
    utter.pitch = sound.pitch ?? 1.4;
    utter.volume = 1;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

// Each win step's sounds play one after another. A newer step bumps the token,
// which stops the playing sound and skips whatever was still waiting.
async function playWinSequence(sounds: WinSound[]) {
  cancelPending();
  const token = playToken;
  for (const sound of sounds) {
    if (token !== playToken) return;
    if ('file' in sound) {
      await playBuffer(sound.file, token);
    } else {
      await speakLine(sound, token);
    }
  }
}

const ORDINALS = [
  'First time!',
  'Second time!',
  'Third time!',
  'Fourth time!',
  'Fifth time!',
  'Sixth time!',
  'Seventh time!',
  'Eighth time!',
];

function ordinalSpeech(level: number): WinSound {
  const idx = Math.min(level - 1, ORDINALS.length - 1);
  return { text: ORDINALS[idx], rate: 1.25, pitch: 1.45 };
}

export const superAceVoice = {
  preloadWinSounds,
  playWinSequence,
  ordinalSpeech,
  cancelPending,
};

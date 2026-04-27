/**
 * Lightweight sound layer. We synthesize each cue with the Web Audio API by
 * default so the game ships zero audio assets, but if a matching file lives
 * at /sounds/<name>.mp3 it gets used instead — drop your own there to
 * replace the synthesized cues without code changes.
 */

export type SoundCue =
  | 'click'
  | 'cannon'
  | 'march'
  | 'alliance'
  | 'conquest'
  | 'defeat';

const FILES: Record<SoundCue, string> = {
  click: 'click.mp3',
  cannon: 'cannon.mp3',
  march: 'march.mp3',
  alliance: 'alliance.mp3',
  conquest: 'conquest.mp3',
  defeat: 'defeat.mp3',
};

const MUTE_KEY = 'terra-bellum-muted';

let ctx: AudioContext | null = null;
let muted: boolean = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === 'yes';
  } catch {
    return false;
  }
})();

const fileBuffers: Partial<Record<SoundCue, AudioBuffer | null>> = {};

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

async function tryLoadFile(cue: SoundCue): Promise<AudioBuffer | null> {
  if (cue in fileBuffers) return fileBuffers[cue] ?? null;
  const c = getCtx();
  if (!c) return null;
  try {
    const url = `${import.meta.env.BASE_URL}sounds/${FILES[cue]}`;
    const res = await fetch(url);
    if (!res.ok) {
      fileBuffers[cue] = null;
      return null;
    }
    const buf = await res.arrayBuffer();
    const decoded = await c.decodeAudioData(buf.slice(0));
    fileBuffers[cue] = decoded;
    return decoded;
  } catch {
    fileBuffers[cue] = null;
    return null;
  }
}

function playBuffer(c: AudioContext, buffer: AudioBuffer, gain: number): void {
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start();
}

/** Synthesize a paper rustle / soft click. */
function synthClick(c: AudioContext, gain = 0.18): void {
  const now = c.currentTime;
  const dur = 0.12;
  // Short noise burst with a quick attack/decay.
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1200;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(now);
}

/** Synthesize a low rumble + crack: distant cannon. */
function synthCannon(c: AudioContext, gain = 0.32): void {
  const now = c.currentTime;
  // Sub-bass thud
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  osc.connect(og).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.55);

  // Crack noise
  const dur = 0.4;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 5);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  const ng = c.createGain();
  ng.gain.value = gain * 0.5;
  src.connect(filter).connect(ng).connect(c.destination);
  src.start(now);
}

/** Quick rhythmic taps: marching column. */
function synthMarch(c: AudioContext, gain = 0.18): void {
  const now = c.currentTime;
  for (let i = 0; i < 4; i++) {
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 220;
    const g = c.createGain();
    const start = now + i * 0.13;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain * 0.7, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.1);
  }
}

/** Bell-like chime: alliance. */
function synthAlliance(c: AudioContext, gain = 0.22): void {
  const now = c.currentTime;
  for (const [freq, delay, dur] of [
    [523.25, 0.0, 0.6],
    [659.25, 0.05, 0.6],
    [783.99, 0.1, 0.7],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now + delay);
    g.gain.exponentialRampToValueAtTime(gain, now + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
    osc.connect(g).connect(c.destination);
    osc.start(now + delay);
    osc.stop(now + delay + dur);
  }
}

/** Triumphant ascending arpeggio: conquest. */
function synthConquest(c: AudioContext, gain = 0.28): void {
  const now = c.currentTime;
  const notes = [261.63, 329.63, 392, 523.25];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = c.createGain();
    const start = now + i * 0.11;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

/** Slow descending dirge: defeat. */
function synthDefeat(c: AudioContext, gain = 0.3): void {
  const now = c.currentTime;
  const notes = [392, 329.63, 261.63, 207.65];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const g = c.createGain();
    const start = now + i * 0.18;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.75);
  });
}

const SYNTHESIZERS: Record<SoundCue, (c: AudioContext) => void> = {
  click: (c) => synthClick(c),
  cannon: (c) => synthCannon(c),
  march: (c) => synthMarch(c),
  alliance: (c) => synthAlliance(c),
  conquest: (c) => synthConquest(c),
  defeat: (c) => synthDefeat(c),
};

export function play(cue: SoundCue): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  // Resume on first user gesture (browsers gate AudioContext until then).
  if (c.state === 'suspended') {
    void c.resume();
  }
  void tryLoadFile(cue).then((buf) => {
    if (muted) return;
    if (buf) {
      playBuffer(c, buf, 0.7);
    } else {
      SYNTHESIZERS[cue](c);
    }
  });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? 'yes' : 'no');
  } catch {
    // ignore
  }
}

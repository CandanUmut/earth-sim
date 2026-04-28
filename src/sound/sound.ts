/**
 * Sound layer.
 *
 * SFX are synthesized by default with the Web Audio API. If a matching file
 * lives at `/sounds/<name>.mp3`, that file is used instead — drop your own
 * there to upgrade without touching code.
 *
 * Music is file-only (no synth fallback). Drop `music_peace.mp3`,
 * `music_war.mp3`, and `music_menu.mp3` in `public/sounds/` to hear it.
 *
 * Volume model: master * (sfx | music). Each is persisted to localStorage.
 */

export type SoundCue =
  | 'click'
  | 'hover'
  | 'cannon'
  | 'march'
  | 'alliance'
  | 'conquest'
  | 'defeat'
  | 'victory'
  | 'coin'
  | 'tech_unlock'
  | 'event_warning'
  | 'betrayal'
  | 'infantry_clash'
  | 'cavalry_charge'
  | 'cannon_volley'
  | 'battle_loop';

export type MusicMode = 'peace' | 'war' | 'menu' | null;

const SFX_FILES: Record<SoundCue, string> = {
  click: 'click.mp3',
  hover: 'hover.mp3',
  cannon: 'cannon.mp3',
  march: 'march.mp3',
  alliance: 'alliance.mp3',
  conquest: 'conquest.mp3',
  defeat: 'defeat.mp3',
  victory: 'victory.mp3',
  coin: 'coin.mp3',
  tech_unlock: 'tech_unlock.mp3',
  event_warning: 'event_warning.mp3',
  betrayal: 'betrayal.mp3',
  infantry_clash: 'infantry_clash.mp3',
  cavalry_charge: 'cavalry_charge.mp3',
  cannon_volley: 'cannon_volley.mp3',
  battle_loop: 'battle_loop.mp3',
};

const MUSIC_FILES: Record<Exclude<MusicMode, null>, string> = {
  peace: 'music_peace.mp3',
  war: 'music_war.mp3',
  menu: 'music_menu.mp3',
};

const MUTE_KEY = 'terra-bellum-muted';
const MASTER_KEY = 'terra-bellum-vol-master';
const SFX_KEY = 'terra-bellum-vol-sfx';
const MUSIC_KEY = 'terra-bellum-vol-music';

let ctx: AudioContext | null = null;
let muted: boolean = readBool(MUTE_KEY, false);
let masterVolume = readNum(MASTER_KEY, 0.8);
let sfxVolume = readNum(SFX_KEY, 0.9);
let musicVolume = readNum(MUSIC_KEY, 0.6);

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'yes';
  } catch {
    return fallback;
  }
}
function readNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  } catch {
    return fallback;
  }
}
function writeStr(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const sfxBuffers: Partial<Record<SoundCue, AudioBuffer | null>> = {};

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

async function tryLoadSfxFile(cue: SoundCue): Promise<AudioBuffer | null> {
  if (cue in sfxBuffers) return sfxBuffers[cue] ?? null;
  const c = getCtx();
  if (!c) return null;
  try {
    const url = `${import.meta.env.BASE_URL}sounds/${SFX_FILES[cue]}`;
    const res = await fetch(url);
    if (!res.ok) {
      sfxBuffers[cue] = null;
      return null;
    }
    const buf = await res.arrayBuffer();
    const decoded = await c.decodeAudioData(buf.slice(0));
    sfxBuffers[cue] = decoded;
    return decoded;
  } catch {
    sfxBuffers[cue] = null;
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

// ===== Synth fallbacks (one-shot SFX) ===========================
function synthClick(c: AudioContext, gain = 0.18): void {
  const now = c.currentTime;
  const dur = 0.12;
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
function synthCannon(c: AudioContext, gain = 0.32): void {
  const now = c.currentTime;
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
function synthCoin(c: AudioContext, gain = 0.22): void {
  const now = c.currentTime;
  for (const [freq, delay] of [
    [880, 0],
    [1318, 0.05],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now + delay);
    g.gain.exponentialRampToValueAtTime(gain, now + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.18);
    osc.connect(g).connect(c.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.2);
  }
}
function synthTechUnlock(c: AudioContext, gain = 0.22): void {
  const now = c.currentTime;
  const notes = [659.25, 880, 1108.73];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    const start = now + i * 0.07;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.42);
  });
}
function synthEventWarning(c: AudioContext, gain = 0.24): void {
  const now = c.currentTime;
  for (const [freq, delay, dur] of [
    [440, 0, 0.2],
    [330, 0.18, 0.3],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'square';
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
function synthBetrayal(c: AudioContext, gain = 0.3): void {
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(98, now + 0.6);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.75);
}
function synthInfantryClash(c: AudioContext, gain = 0.18): void {
  const now = c.currentTime;
  const dur = 0.18;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(now);
}
function synthCavalryCharge(c: AudioContext, gain = 0.22): void {
  const now = c.currentTime;
  for (let i = 0; i < 6; i++) {
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 160 + (i % 2) * 30;
    const g = c.createGain();
    const start = now + i * 0.07;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain * 0.8, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.1);
  }
}
function synthHover(c: AudioContext, gain = 0.06): void {
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1400;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}
function synthVictory(c: AudioContext, gain = 0.3): void {
  const now = c.currentTime;
  const notes = [261.63, 329.63, 392, 523.25, 659.25];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = c.createGain();
    const start = now + i * 0.13;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.75);
  });
}

const SYNTHESIZERS: Partial<Record<SoundCue, (c: AudioContext) => void>> = {
  click: synthClick,
  hover: synthHover,
  cannon: synthCannon,
  march: synthMarch,
  alliance: synthAlliance,
  conquest: synthConquest,
  defeat: synthDefeat,
  victory: synthVictory,
  coin: synthCoin,
  tech_unlock: synthTechUnlock,
  event_warning: synthEventWarning,
  betrayal: synthBetrayal,
  infantry_clash: synthInfantryClash,
  cavalry_charge: synthCavalryCharge,
  cannon_volley: synthCannon, // re-uses cannon synth
  // battle_loop intentionally has no synth fallback (looped sound only).
};

function effectiveSfxGain(): number {
  if (muted) return 0;
  return masterVolume * sfxVolume;
}
function effectiveMusicGain(): number {
  if (muted) return 0;
  return masterVolume * musicVolume;
}

export function play(cue: SoundCue): void {
  const eff = effectiveSfxGain();
  if (eff <= 0) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    void c.resume();
  }
  void tryLoadSfxFile(cue).then((buf) => {
    if (effectiveSfxGain() <= 0) return;
    if (buf) {
      playBuffer(c, buf, 0.7 * (eff / 0.8));
    } else {
      const synth = SYNTHESIZERS[cue];
      if (synth) synth(c);
    }
  });
}

// ===== Music subsystem ============================================
type MusicState = {
  mode: Exclude<MusicMode, null>;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

const musicBuffers: Partial<Record<Exclude<MusicMode, null>, AudioBuffer | null>> = {};
let activeMusic: MusicState | null = null;
let pendingMode: MusicMode = null;

async function loadMusic(
  mode: Exclude<MusicMode, null>,
): Promise<AudioBuffer | null> {
  if (mode in musicBuffers) return musicBuffers[mode] ?? null;
  const c = getCtx();
  if (!c) return null;
  try {
    const url = `${import.meta.env.BASE_URL}sounds/${MUSIC_FILES[mode]}`;
    const res = await fetch(url);
    if (!res.ok) {
      musicBuffers[mode] = null;
      return null;
    }
    const buf = await res.arrayBuffer();
    const decoded = await c.decodeAudioData(buf.slice(0));
    musicBuffers[mode] = decoded;
    return decoded;
  } catch {
    musicBuffers[mode] = null;
    return null;
  }
}

const FADE_MS = 1200;

function fadeOutAndStop(state: MusicState, c: AudioContext): void {
  const now = c.currentTime;
  const g = state.gain.gain;
  const cur = g.value;
  g.cancelScheduledValues(now);
  g.setValueAtTime(cur, now);
  g.linearRampToValueAtTime(0.0001, now + FADE_MS / 1000);
  setTimeout(() => {
    try {
      state.source.stop();
    } catch {
      // ignore
    }
  }, FADE_MS + 50);
}

function startMusicBuffer(
  c: AudioContext,
  mode: Exclude<MusicMode, null>,
  buffer: AudioBuffer,
): MusicState {
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  source.connect(gain).connect(c.destination);
  source.start();
  const target = effectiveMusicGain();
  const now = c.currentTime;
  gain.gain.linearRampToValueAtTime(target, now + FADE_MS / 1000);
  return { mode, buffer, source, gain };
}

export async function setMusicMode(mode: MusicMode): Promise<void> {
  pendingMode = mode;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    void c.resume();
  }
  if (mode === null) {
    if (activeMusic) {
      fadeOutAndStop(activeMusic, c);
      activeMusic = null;
    }
    return;
  }
  if (activeMusic && activeMusic.mode === mode) {
    // Already playing this mode; just refresh volume.
    activeMusic.gain.gain.cancelScheduledValues(c.currentTime);
    activeMusic.gain.gain.setValueAtTime(
      effectiveMusicGain(),
      c.currentTime,
    );
    return;
  }
  const buf = await loadMusic(mode);
  if (!buf) {
    // Music file not present — degrade to silence quietly.
    if (activeMusic) {
      fadeOutAndStop(activeMusic, c);
      activeMusic = null;
    }
    return;
  }
  // The user may have switched modes while we were loading.
  if (pendingMode !== mode) return;
  if (activeMusic) {
    fadeOutAndStop(activeMusic, c);
  }
  activeMusic = startMusicBuffer(c, mode, buf);
}

// ===== Looped SFX (battle_loop) ===================================
let battleLoop: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

export async function playBattleLoop(): Promise<void> {
  if (battleLoop) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const buf = await tryLoadSfxFile('battle_loop');
  if (!buf) return; // no synth fallback for the looped track
  const source = c.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  const gain = c.createGain();
  gain.gain.value = effectiveSfxGain() * 0.6;
  source.connect(gain).connect(c.destination);
  source.start();
  battleLoop = { source, gain };
}

export function stopBattleLoop(): void {
  if (!battleLoop) return;
  const c = getCtx();
  if (!c) {
    try {
      battleLoop.source.stop();
    } catch {
      // ignore
    }
    battleLoop = null;
    return;
  }
  const now = c.currentTime;
  battleLoop.gain.gain.cancelScheduledValues(now);
  battleLoop.gain.gain.setValueAtTime(battleLoop.gain.gain.value, now);
  battleLoop.gain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
  const ref = battleLoop;
  setTimeout(() => {
    try {
      ref.source.stop();
    } catch {
      // ignore
    }
  }, 600);
  battleLoop = null;
}

// ===== Mute / volume API ==========================================
export function isMuted(): boolean {
  return muted;
}
export function setMuted(next: boolean): void {
  muted = next;
  writeStr(MUTE_KEY, next ? 'yes' : 'no');
  applyVolumeChanges();
}

export function getMasterVolume(): number {
  return masterVolume;
}
export function getSfxVolume(): number {
  return sfxVolume;
}
export function getMusicVolume(): number {
  return musicVolume;
}
export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  writeStr(MASTER_KEY, masterVolume.toString());
  applyVolumeChanges();
}
export function setSfxVolume(v: number): void {
  sfxVolume = Math.max(0, Math.min(1, v));
  writeStr(SFX_KEY, sfxVolume.toString());
  applyVolumeChanges();
}
export function setMusicVolume(v: number): void {
  musicVolume = Math.max(0, Math.min(1, v));
  writeStr(MUSIC_KEY, musicVolume.toString());
  applyVolumeChanges();
}

function applyVolumeChanges(): void {
  const c = getCtx();
  if (!c) return;
  if (activeMusic) {
    const g = activeMusic.gain.gain;
    const now = c.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(effectiveMusicGain(), now, 0.05);
  }
  if (battleLoop) {
    const g = battleLoop.gain.gain;
    const now = c.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(effectiveSfxGain() * 0.6, now, 0.05);
  }
}

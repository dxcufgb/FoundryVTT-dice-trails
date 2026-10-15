/**
 * Sound effects for the dice trails: every trail design and damage type has a sound theme with
 * two sounds (sounds/<theme>-loop.ogg and sounds/<theme>-hit.ogg, all CC0, see
 * sounds/LICENSE-CC0-generated.txt and tools/make-sounds.py):
 *
 *   loop   a quiet, seamless loop that plays while a die with that trail flies. Its volume follows
 *          the die's speed, so the trail "roars" when the die is fast and dies away as it lands.
 *          One loop per theme is shared by all the dice that use it.
 *   hit    a loud one-shot for the moment a die bounces off the table, a wall or another die, and
 *          for the final landing: the louder the harder the impact. The loop also swells for a
 *          moment, so the bounce is the pronounced event of the roll.
 *
 * The sounds play on Foundry's interface audio channel, so the "Interface" volume slider applies
 * on top of the module's own "Sound volume" setting.
 */

import { MODULE_ID } from "./constants.js";
import { SOUNDS } from "./custom-trails.js";

/** Every theme a trail can sound like (the list lives with the trail data, so the editor can offer it). */
export const THEMES = SOUNDS;

/** Per-theme balance on top of the files: how loud its loop and its hit are relative to the others. */
const BALANCE = {
  thunder: { loop: 1.0, hit: 1.15 },
  lightning: { loop: 0.8, hit: 1.3 },   // the strike: sharp and sudden, let it jump out
  healing: { loop: 0.9, hit: 1.0 },
  stone: { loop: 0.9, hit: 1.1 },
  needle: { loop: 0.7, hit: 0.9 },
  petals: { loop: 0.8, hit: 0.8 },
  smoke: { loop: 0.8, hit: 0.8 },
  song: { loop: 0.7, hit: 0.9 },
  rainbow: { loop: 0.7, hit: 0.9 }
};

const LOOP_LEVEL = 0.55;      // loops are the quiet bed under the roll
const HIT_LEVEL = 1.0;        // hits are the event
const HIT_FLOOR = 0.25;       // the softest bounce still plays at this share of the hit's volume
const SWELL = 0.6;            // how much a bounce swells the loop (fades over SWELL_TIME)
const SWELL_TIME = 0.18;
const FULL_SPEED = 18;        // die radii per second at which the loop is at full volume
const HIT_GAP = 0.045;        // seconds between two hits of the same theme (many dice land together)
const MAX_HITS = 16;          // hits playing at once, across all themes
const MIN_HIT_CONCURRENCY_SHARE = 0.5;   // a theme already hitting twice is played at half volume

/* ======================================================================== */
/*  Settings                                                                 */
/* ======================================================================== */

export function soundsOn() {
  try {
    return !!game.settings.get(MODULE_ID, "sounds") && volumeSetting() > 0;
  } catch (_) {
    return false;
  }
}

function volumeSetting() {
  const v = Number(game.settings.get(MODULE_ID, "soundVolume"));
  return Number.isFinite(v) ? Math.max(0, v) : 0.2;
}

/** The module's volume, including Foundry's Interface volume when the audio context does not apply it itself. */
function masterVolume() {
  let v = volumeSetting();
  if (!state.bus) v *= Number(game.settings.get("core", "globalInterfaceVolume") ?? 1);
  return v;
}

/* ======================================================================== */
/*  Audio context and files                                                  */
/* ======================================================================== */

const state = { ctx: null, master: null, bus: false };

/** Foundry's interface audio context, once the user's first gesture has unlocked audio; null before. */
function audio() {
  if (state.ctx) return state;
  const ctx = game.audio?.interface ?? game.audio?.context ?? null;
  if (!ctx) return null;
  const master = ctx.createGain();
  // v12+ contexts carry a gain node that applies the matching core volume slider; older ones do not.
  const bus = ctx.gainNode ?? null;
  master.connect(bus ?? ctx.destination);
  state.ctx = ctx;
  state.master = master;
  state.bus = !!bus;
  return state;
}

const files = new Map();   // "theme-kind" -> { data, buffer, loading, decoding, failed }

function fileEntry(theme, kind) {
  const key = `${theme}-${kind}`;
  let e = files.get(key);
  if (!e) {
    e = { data: null, buffer: null, loading: null, decoding: null, failed: false };
    files.set(key, e);
  }
  return e;
}

/** Fetch a sound file (once); decoding waits for the audio context. */
function fetchFile(theme, kind) {
  const e = fileEntry(theme, kind);
  if (e.data || e.loading || e.failed) return e.loading;
  const url = foundry.utils.getRoute(`modules/${MODULE_ID}/sounds/${theme}-${kind}.ogg`);
  e.loading = fetch(url).then(async r => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    e.data = await r.arrayBuffer();
  }).catch(err => {
    e.failed = true;
    console.warn(`${MODULE_ID} | could not load sound ${theme}-${kind}.ogg`, err);
  });
  return e.loading;
}

/** The decoded buffer of a sound, or null while it is still loading or if it failed (loading is started). */
function bufferFor(theme, kind) {
  const e = fileEntry(theme, kind);
  if (e.buffer) return e.buffer;
  if (e.failed) return null;
  if (!e.data) { fetchFile(theme, kind); return null; }
  const a = audio();
  if (!a || e.decoding) return null;
  e.decoding = a.ctx.decodeAudioData(e.data.slice(0)).then(b => { e.buffer = b; }).catch(err => {
    e.failed = true;
    console.warn(`${MODULE_ID} | could not decode sound ${theme}-${kind}.ogg`, err);
  });
  return null;
}

/** Load every theme's files ahead of the first roll (they decode as soon as audio is unlocked). */
export function preloadSounds(themes = THEMES) {
  return Promise.all(themes.flatMap(t => [fetchFile(t, "loop"), fetchFile(t, "hit")]));
}

/* ======================================================================== */
/*  Loops: one per theme, shared by all dice that use it                     */
/* ======================================================================== */

const loops = new Map();   // theme -> { source, gain, want, count, swell, idle, level }

function loopOf(theme) {
  let l = loops.get(theme);
  if (!l) {
    l = { source: null, gain: null, want: 0, count: 0, swell: 0, idle: 0, level: 0 };
    loops.set(theme, l);
  }
  return l;
}

/** Call before the dice are updated in a frame: every die then says how loud it wants its loops. */
export function beginSoundFrame() {
  for (const l of loops.values()) { l.want = 0; l.count = 0; }
}

/** Call after the dice are updated: starts, fades and stops the loops. */
export function endSoundFrame(dt) {
  if (!loops.size) return;
  const a = audio();
  const on = soundsOn();
  const master = on ? masterVolume() : 0;
  for (const [theme, l] of loops) {
    l.swell *= Math.exp(-dt / SWELL_TIME);
    const b = BALANCE[theme] ?? {};
    // Several dice with the same theme: a little louder than one, not n times as loud.
    const want = l.count ? Math.min(1.4, l.want + 0.12 * (l.count - 1)) : 0;
    const target = master * LOOP_LEVEL * (b.loop ?? 1) * Math.min(1.6, want + l.swell * SWELL);
    l.level = target;
    if (target > 0.002) {
      l.idle = 0;
      if (!l.source && a) startLoop(theme, l, a);
      if (l.gain) l.gain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.06);
    } else if (l.source) {
      l.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.08);
      l.idle += dt;
      if (l.idle > 1.5) stopLoop(l);
    }
  }
}

function startLoop(theme, l, a) {
  const buffer = bufferFor(theme, "loop");
  if (!buffer) return;
  const source = a.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = a.ctx.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(a.master);
  source.start(0, Math.random() * buffer.duration);   // every roll starts the loop somewhere else
  l.source = source;
  l.gain = gain;
}

function stopLoop(l) {
  try { l.source?.stop(); } catch (_) { /* already stopped */ }
  try { l.source?.disconnect(); l.gain?.disconnect(); } catch (_) { /* never connected */ }
  l.source = null;
  l.gain = null;
  l.idle = 0;
}

/** Stop everything at once (the setting was switched off). */
export function stopAllSounds() {
  for (const l of loops.values()) stopLoop(l);
}

/* ======================================================================== */
/*  Hits                                                                     */
/* ======================================================================== */

const lastHit = new Map();   // theme -> context time of its last hit
let hitsPlaying = 0;
const hitsPerTheme = new Map();

/**
 * Play a theme's hit: strength 0..1 (how hard the bounce was), gain a multiplier (the layer's opacity).
 * Returns true if it played.
 */
export function playHit(theme, strength = 1, gain = 1) {
  const a = audio();
  if (!a || !soundsOn()) return false;
  const buffer = bufferFor(theme, "hit");
  if (!buffer) return false;
  const now = a.ctx.currentTime;
  if (now - (lastHit.get(theme) ?? -1) < HIT_GAP || hitsPlaying >= MAX_HITS) return false;
  lastHit.set(theme, now);

  strength = Math.min(1, Math.max(0, strength));
  const same = hitsPerTheme.get(theme) ?? 0;
  const crowd = same >= 2 ? MIN_HIT_CONCURRENCY_SHARE : 1;
  const b = BALANCE[theme] ?? {};
  const volume = masterVolume() * HIT_LEVEL * (b.hit ?? 1) * gain * (HIT_FLOOR + (1 - HIT_FLOOR) * strength) * crowd;
  if (volume <= 0.001) return false;

  const source = a.ctx.createBufferSource();
  source.buffer = buffer;
  // A little random pitch so repeated bounces don't sound like a machine; hard hits a touch deeper.
  source.playbackRate.value = (0.93 + Math.random() * 0.14) * (1.08 - 0.16 * strength);
  const g = a.ctx.createGain();
  g.gain.value = volume;
  source.connect(g).connect(a.master);
  hitsPlaying++;
  hitsPerTheme.set(theme, same + 1);
  source.onended = () => {
    hitsPlaying = Math.max(0, hitsPlaying - 1);
    hitsPerTheme.set(theme, Math.max(0, (hitsPerTheme.get(theme) ?? 1) - 1));
    try { source.disconnect(); g.disconnect(); } catch (_) { /* fine */ }
  };
  source.start();
  const l = loops.get(theme);
  if (l) l.swell = Math.max(l.swell, strength);
  return true;
}

/* ======================================================================== */
/*  One die's sound                                                          */
/* ======================================================================== */

/** The sound themes of an effect definition: {sound: "fire"} or a compiled trail's {sounds: [{theme, gain}]}. */
export function themesOf(def) {
  const list = Array.isArray(def?.sounds) ? def.sounds : def?.sound ? [{ theme: def.sound, gain: 1 }] : [];
  const seen = new Map();
  for (const s of list) {
    if (!s?.theme || !THEMES.includes(s.theme)) continue;
    const gain = Math.min(1, Math.max(0, Number(s.gain ?? 1) || 0));
    seen.set(s.theme, Math.max(seen.get(s.theme) ?? 0, gain));
  }
  return [...seen].map(([theme, gain]) => ({ theme, gain }));
}

export class DieSound {
  /** null when the effect has no sound. */
  static for(def) {
    const themes = themesOf(def);
    return themes.length ? new DieSound(themes) : null;
  }

  constructor(themes) {
    this.themes = themes;
    this.cooldown = 0;
    for (const { theme } of themes) { bufferFor(theme, "loop"); bufferFor(theme, "hit"); }
  }

  /**
   * Once per frame: speed in die radii per second, impact 0..1 if the die bounced this frame,
   * resting once the die lies still.
   */
  update(dt, speed, impact, resting) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const level = resting ? 0 : Math.min(1, speed / FULL_SPEED);
    for (const { theme, gain } of this.themes) {
      const l = loopOf(theme);
      const want = level * gain;
      if (want > 0) { l.want = Math.max(l.want, want); l.count++; }
      if (impact > 0 && this.cooldown === 0) playHit(theme, impact, gain);
    }
    if (impact > 0 && this.cooldown === 0) this.cooldown = 0.08;
  }

  dispose() {
    this.themes = [];
  }
}

/* ======================================================================== */
/*  Bounces                                                                  */
/* ======================================================================== */

const BOUNCE_MIN = 4;     // radii/s of velocity change below which nothing counts
const BOUNCE_HARD = 30;   // radii/s of velocity change that is a full-strength hit

/**
 * How hard a die bounced between two velocity samples (die radii per second), 0 if it did not:
 * a bounce is a sharp change of velocity against where the die was going, caused by a surface
 * (the impulse points up or sideways, never down: a downward one is just gravity at the apex).
 * A landing that stops the die counts as a (soft) bounce too.
 */
export function bounceStrength(prev, v) {
  const jx = v[0] - prev[0], jy = v[1] - prev[1], jz = v[2] - prev[2];
  const j = Math.hypot(jx, jy, jz);
  if (j < BOUNCE_MIN) return 0;
  if (jz < -0.3 * j) return 0;
  const into = -(prev[0] * jx + prev[1] * jy + prev[2] * jz) / j;   // speed into the surface before
  const away = (v[0] * jx + v[1] * jy + v[2] * jz) / j;             // speed away from it after
  if (into < 2 || away < -0.25 * into) return 0;
  return Math.min(1, (j - BOUNCE_MIN) / BOUNCE_HARD);
}

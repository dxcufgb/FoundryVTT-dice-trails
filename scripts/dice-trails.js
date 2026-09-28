/**
 * Dxcufgb's damage dice trails (dxcufgbs-dice-trails) - Foundry VTT V13 + Dice So Nice 5
 *
 * Gives every 3D die rolled for a damage type a streak of its element that follows
 * its flight path (a tail of fire, a jagged bolt, frost, death-smoke, ...), plus an
 * aura and a few accent particles, so it looks charged with that energy.
 *
 * How it works
 *  1. On Dice So Nice's "diceSoNiceRollStart" hook, every die term is tagged with
 *     the damage type of its roll (dnd5e: roll.options.type, or a [flavor] such as
 *     "1d6[fire]"). Dice So Nice copies die options onto the 3D mesh.
 *  2. A ticker finds tagged dice in Dice So Nice's three.js scene and attaches
 *     particle emitters that follow them. Particles are rendered by Dice So Nice's
 *     own renderer, so they appear with the dice.
 *
 * Preview from the console or a macro:
 *   game.modules.get("dxcufgbs-dice-trails").api.preview("fire")
 *   game.modules.get("dxcufgbs-dice-trails").api.previewAll()
 */

const MODULE_ID = "dxcufgbs-dice-trails";
const TAG = "dxTrail";
const THREE_URL = "modules/dice-so-nice/libs/three.module.min.js";

let THREE = null;
let TEXTURES = null;
const emitters = new Map();     // mesh uuid -> DieEmitter
let tickerActive = false;
let lastTime = 0;

/* ======================================================================== */
/*  Effect definitions                                                      */
/* ======================================================================== */
/*
 * Sizes and distances are in "die units" (u = the die's radius), speeds in u/second.
 * z is up (Dice So Nice's camera looks down on the table).
 *
 * ribbons: streaks drawn along the die's recent path (see class Ribbon)
 *   width      full width at the die (u)     time    seconds of path the streak covers
 *   colors     [at die, middle, tail tip]     core    colour of the hot centre line
 *   noiseAmt   how ragged the edges are       scroll  how fast the pattern flows (negative: toward the die)
 *   bands/bandAmt/bandSpeed  pulses along the streak   sparkle  twinkling glints
 *   jag        lightning zig-zag (u)          wave    { amp, freq, speed } weaving motion
 *
 * layer fields (accent particles):
 *   tex        glow | spark | ring | smoke | shard | bubble
 *   blend      add | normal
 *   rate       particles / second while the die flies (scaled by intensity)
 *   rest       rate multiplier while the die lies still (afterglow)
 *   life       [min, max] seconds
 *   size       [start, end]
 *   spawn      radius of the spawn sphere around the die (or {ring: r} / {orbit: r})
 *   vel        [x, y, z] base velocity, jitter = random extra speed in any direction
 *   gravity    z acceleration (negative falls)
 *   drag       0..1 velocity kept per second
 *   inherit    share of the die's own velocity the particle keeps
 *   colors     gradient over lifetime: [t, "#rrggbb", alpha]
 *   spin       rotation speed (rad/s) for textured particles
 *   flicker    0..1 random alpha flicker
 *   orbit      { radius, speed, rise }  particle circles the die and follows it
 *   inward     speed pulling particles toward the die (necrotic "draining")
 *   swirl      tangential speed around the die's vertical axis
 */
const EFFECTS = {
  fire: {
    aura: { color: "#ff7a1a", size: 3.0, alpha: 0.5, pulse: 0.12, flicker: 0.25 },
    ribbons: [
      // Smoke trailing far behind the flames
      { width: 3.2, time: 1.0, blend: "normal", alpha: 0.35, colors: ["#3a2a20", "#2a2420", "#151515"],
        noiseAmt: 1.3, noiseScale: [4, 3], scroll: 1.5, soft: 0.55, fadePow: 1.4, taper: 0.4 },
      // The fire tail: broad licking flames, orange to deep red at the tips
      { width: 3.6, time: 0.65, blend: "add", alpha: 1, colors: ["#ffe28a", "#ff4a08", "#6a0800"],
        core: "#fff0b0", coreAmt: 0.5, noiseAmt: 2.4, noiseScale: [5, 3], scroll: 5.5, colorNoise: 0.6,
        soft: 0.45, fadePow: 0.9, taper: 0.45, flicker: 0.12 },
      // White-hot core right behind the die
      { width: 1.3, time: 0.35, blend: "add", alpha: 1, colors: ["#ffffff", "#ffe27a", "#ff8a1a"],
        core: "#ffffff", coreAmt: 1, noiseAmt: 0.7, noiseScale: [8, 2], scroll: 6, soft: 0.3, fadePow: 0.9, taper: 0.8 }
    ],
    layers: [
      { tex: "spark", blend: "add", rate: 40, rest: 0.2, life: [0.5, 1.1], size: [0.35, 0.06], spawn: 0.8,
        vel: [0, 0, 3.2], jitter: 2.4, gravity: -1.5, drag: 0.6, spin: 6,
        colors: [[0, "#fff1a0", 1], [0.5, "#ffa13d", 0.9], [1, "#ff3300", 0]] },
      { tex: "glow", blend: "add", rate: 12, rest: 1.2, life: [0.3, 0.6], size: [1.2, 0.3], spawn: 0.4,
        vel: [0, 0, 1.8], jitter: 0.5, flicker: 0.4,
        colors: [[0, "#fff4b8", 0.8], [0.5, "#ff7a1a", 0.6], [1, "#400800", 0]] }
    ]
  },

  cold: {
    aura: { color: "#9fe8ff", size: 3.0, alpha: 0.45, pulse: 0.08 },
    ribbons: [
      // Freezing mist
      { width: 3.0, time: 0.75, blend: "add", alpha: 0.35, colors: ["#e8fbff", "#9fe0ff", "#2f7fd1"],
        noiseAmt: 1.0, noiseScale: [4, 2], scroll: 1, soft: 0.6, fadePow: 1.3, taper: 0.3 },
      // Frost streak: stretched icy striations that glint
      { width: 1.5, time: 0.5, blend: "add", alpha: 0.95, colors: ["#ffffff", "#9fe2ff", "#1f6fd1"],
        core: "#ffffff", coreAmt: 0.7, noiseAmt: 0.7, noiseScale: [14, 1.2], scroll: 0.6, colorNoise: 0.25,
        soft: 0.18, fadePow: 1.0, taper: 0.8, sparkle: 0.8 }
    ],
    layers: [
      { tex: "shard", blend: "add", rate: 22, rest: 0.4, life: [0.6, 1.1], size: [0.5, 0.15], spawn: 0.7,
        vel: [0, 0, 0], jitter: 1.2, gravity: -1.2, drag: 0.5, spin: 4, flicker: 0.4,
        colors: [[0, "#ffffff", 1], [0.4, "#c8f2ff", 0.9], [1, "#58b8ff", 0]] }
    ]
  },

  lightning: {
    aura: { color: "#bfe6ff", size: 3.3, alpha: 0.55, pulse: 0.05, flicker: 0.6 },
    arcs: { color: "#dff3ff", every: 0.05, count: 2, reach: [1.4, 3.0], restCount: 1 },
    ribbons: [
      // Electric glow around the bolt
      { width: 2.4, time: 0.38, blend: "add", alpha: 0.55, colors: ["#d6ecff", "#5fa8ff", "#1d3dff"],
        noiseAmt: 0.4, noiseScale: [10, 2], scroll: 8, soft: 0.5, fadePow: 0.9, taper: 0.5,
        bands: 7, bandAmt: 0.12, bandSpeed: 12, flicker: 0.5 },
      // Jagged white-hot bolt
      { width: 0.3, time: 0.36, blend: "add", alpha: 1, colors: ["#ffffff", "#e6f4ff", "#7fb8ff"],
        core: "#ffffff", coreAmt: 1, noiseAmt: 0.1, soft: 0.25, fadePow: 0.7, taper: 0.4, jag: 1.0, flicker: 0.35 }
    ],
    layers: [
      { tex: "spark", blend: "add", rate: 45, rest: 0.25, life: [0.08, 0.22], size: [0.5, 0.1], spawn: 0.5,
        vel: [0, 0, 0], jitter: 8, drag: 0.1, spin: 10, flicker: 0.6,
        colors: [[0, "#ffffff", 1], [0.5, "#9fd0ff", 0.9], [1, "#2f6bff", 0]] }
    ]
  },

  thunder: {
    aura: { color: "#8a7dff", size: 3.2, alpha: 0.45, pulse: 0.3, pulseSpeed: 9 },
    ribbons: [
      // A roaring streak with pulsing shock bands
      { width: 2.2, time: 0.45, blend: "add", alpha: 0.85, colors: ["#efeaff", "#8a7dff", "#2b1d8f"],
        core: "#ffffff", coreAmt: 0.5, noiseAmt: 0.5, noiseScale: [5, 2], scroll: 3, soft: 0.35, fadePow: 1.1,
        taper: 0.5, bands: 5, bandAmt: 0.4, bandSpeed: 5 }
    ],
    layers: [
      { tex: "ring", blend: "add", rate: 6, rest: 0.4, life: [0.45, 0.6], size: [0.6, 5.0], spawn: 0,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#efeaff", 0.85], [0.4, "#a99bff", 0.45], [1, "#5b48ff", 0]] }
    ]
  },

  acid: {
    aura: { color: "#8dff3a", size: 2.8, alpha: 0.4, pulse: 0.1 },
    ribbons: [
      // Caustic fumes
      { width: 2.4, time: 0.7, blend: "normal", alpha: 0.3, colors: ["#6fd12a", "#4f9a1e", "#2d5a10"],
        noiseAmt: 1.2, noiseScale: [4, 3], scroll: 1.2, soft: 0.6, fadePow: 1.3, taper: 0.3 },
      // Bubbling acid streak
      { width: 1.5, time: 0.5, blend: "add", alpha: 0.95, colors: ["#efffb0", "#86ff2a", "#1f6f00"],
        core: "#f4ffd0", coreAmt: 0.6, noiseAmt: 0.9, noiseScale: [9, 4], scroll: 2.2, colorNoise: 0.3,
        soft: 0.25, fadePow: 1.0, taper: 0.7, sparkle: 0.35 }
    ],
    layers: [
      { tex: "bubble", blend: "add", rate: 30, rest: 0.3, life: [0.45, 0.8], size: [0.45, 0.3], spawn: 0.5,
        vel: [0, 0, 0.4], jitter: 1.0, gravity: -7, drag: 0.7,
        colors: [[0, "#e4ff9a", 1], [0.5, "#8cff2a", 0.9], [1, "#2f8f00", 0]] }
    ]
  },

  poison: {
    aura: { color: "#4be35c", size: 3.0, alpha: 0.3, pulse: 0.15, pulseSpeed: 2 },
    ribbons: [
      // A billowing toxic cloud trail, green fading to sickly purple
      { width: 3.2, time: 0.95, blend: "normal", alpha: 0.5, colors: ["#58d64a", "#3f8f38", "#4b2a6a"],
        noiseAmt: 1.4, noiseScale: [4, 3], scroll: 1.2, colorNoise: 0.3, soft: 0.6, fadePow: 1.2, taper: 0.2 },
      { width: 0.9, time: 0.45, blend: "add", alpha: 0.6, colors: ["#e2ff8a", "#6aff3a", "#2a7a1a"],
        noiseAmt: 0.6, noiseScale: [6, 2], scroll: 2, soft: 0.4, fadePow: 1.0, taper: 0.8 }
    ],
    layers: [
      { tex: "glow", blend: "add", rate: 16, rest: 0.5, life: [0.8, 1.4], size: [0.3, 0.12], spawn: 0.9,
        vel: [0, 0, 0.4], jitter: 0.6, drag: 0.5, flicker: 0.3,
        colors: [[0, "#d6ff6a", 0.9], [1, "#6aff3a", 0]] }
    ]
  },

  necrotic: {
    aura: { color: "#12001c", size: 3.4, alpha: 0.6, pulse: 0.12, pulseSpeed: 2.5, blend: "normal",
            inner: { color: "#8a3cff", size: 1.6, alpha: 0.35 } },
    ribbons: [
      // Black death-smoke that flows back INTO the die (negative scroll)
      { width: 2.8, time: 0.85, blend: "normal", alpha: 0.75, colors: ["#0a0010", "#1a0026", "#000000"],
        noiseAmt: 1.4, noiseScale: [5, 3], scroll: -1.8, soft: 0.5, fadePow: 1.2, taper: 0.3 },
      // Sickly violet soul-fire at its edges
      { width: 1.3, time: 0.55, blend: "add", alpha: 0.65, colors: ["#d4a8ff", "#7a2cff", "#1f003a"],
        noiseAmt: 1.0, noiseScale: [7, 3], scroll: -2.4, colorNoise: 0.3, soft: 0.3, fadePow: 1.0, taper: 0.6 }
    ],
    layers: [
      { tex: "glow", blend: "add", rate: 14, rest: 0.6, life: [0.6, 1.1], size: [0.35, 0.1], spawn: { ring: 1.8 },
        vel: [0, 0, 0], jitter: 0.2, inward: 2.0, swirl: 2.6,
        colors: [[0, "#b77bff", 0.0], [0.3, "#9d4dff", 0.9], [1, "#3aff9a", 0]] }
    ]
  },

  radiant: {
    aura: { color: "#fff1a8", size: 3.8, alpha: 0.65, pulse: 0.15, pulseSpeed: 4 },
    ribbons: [
      // Wide soft golden light
      { width: 3.0, time: 0.55, blend: "add", alpha: 0.45, colors: ["#fff6cc", "#ffd24a", "#ff9d00"],
        noiseAmt: 0.3, noiseScale: [3, 1], scroll: 1, soft: 0.7, fadePow: 1.2, taper: 0.4 },
      // Brilliant white-gold beam
      { width: 1.2, time: 0.45, blend: "add", alpha: 1, colors: ["#ffffff", "#fff3a8", "#ffc21a"],
        core: "#ffffff", coreAmt: 1, noiseAmt: 0.15, soft: 0.25, fadePow: 0.9, taper: 0.7, sparkle: 0.6 }
    ],
    layers: [
      { tex: "spark", blend: "add", rate: 14, rest: 0.6, life: [0.3, 0.6], size: [1.4, 0.2], spawn: 0.2,
        vel: [0, 0, 0], jitter: 0.2, spin: 1.5,
        colors: [[0, "#ffffff", 0.9], [0.5, "#fff0a0", 0.7], [1, "#ffd24a", 0]] }
    ]
  },

  force: {
    aura: { color: "#b36bff", size: 3.2, alpha: 0.5, pulse: 0.1, pulseSpeed: 5 },
    ribbons: [
      // Pure arcane energy with rapidly flowing bands
      { width: 1.8, time: 0.45, blend: "add", alpha: 0.95, colors: ["#f3e4ff", "#b36bff", "#4a0fbf"],
        core: "#ffffff", coreAmt: 0.6, noiseAmt: 0.25, noiseScale: [4, 1], scroll: 2, soft: 0.25, fadePow: 1.0,
        taper: 0.6, bands: 6, bandAmt: 0.3, bandSpeed: 7 }
    ],
    layers: [
      { tex: "glow", blend: "add", rate: 26, rest: 0.8, life: [0.6, 1.0], size: [0.45, 0.15], spawn: 0,
        orbit: { radius: 1.3, speed: 9, rise: 0.3 },
        colors: [[0, "#f3e4ff", 1], [0.5, "#c28bff", 0.9], [1, "#7a2dff", 0]] }
    ]
  },

  psychic: {
    aura: { color: "#ff5cd6", size: 3.2, alpha: 0.45, pulse: 0.2, pulseSpeed: 3 },
    ribbons: [
      // A weaving mind-wave
      { width: 1.8, time: 0.55, blend: "add", alpha: 0.9, colors: ["#ffe0f7", "#ff5cd6", "#6a3cff"],
        core: "#ffffff", coreAmt: 0.4, noiseAmt: 0.45, noiseScale: [5, 2], scroll: 1.5, soft: 0.3, fadePow: 1.0,
        taper: 0.6, bands: 4, bandAmt: 0.6, bandSpeed: 3, wave: { amp: 0.9, freq: 2.2, speed: 8 } },
      { width: 0.7, time: 0.55, blend: "add", alpha: 0.8, colors: ["#ffffff", "#ffa6ea", "#a05cff"],
        noiseAmt: 0.2, soft: 0.3, fadePow: 1.0, taper: 0.5, wave: { amp: 0.9, freq: 2.2, speed: 8, phase: 3.14159 } }
    ],
    layers: [
      { tex: "ring", blend: "add", rate: 4, rest: 0.6, life: [0.7, 0.9], size: [0.5, 3.6], spawn: 0,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#ffc4f0", 0.6], [0.5, "#d57bff", 0.35], [1, "#7b5cff", 0]] }
    ]
  },

  bludgeoning: {
    aura: { color: "#c9b79c", size: 2.4, alpha: 0.18, pulse: 0.05, blend: "normal" },
    ribbons: [
      // A heavy trail of dust
      { width: 2.6, time: 0.6, blend: "normal", alpha: 0.5, colors: ["#b8a488", "#8a7862", "#4a4036"],
        noiseAmt: 1.3, noiseScale: [4, 3], scroll: 0.8, soft: 0.6, fadePow: 1.2, taper: 0.3 }
    ],
    layers: [
      { tex: "shard", blend: "normal", rate: 14, rest: 0.05, life: [0.4, 0.8], size: [0.3, 0.2], spawn: 0.6,
        vel: [0, 0, 2.0], jitter: 2.2, gravity: -10, drag: 0.8, spin: 8,
        colors: [[0, "#7a6a58", 1], [0.8, "#5a4c3e", 0.9], [1, "#3e342a", 0]] }
    ]
  },

  piercing: {
    aura: { color: "#e6f0ff", size: 2.2, alpha: 0.3, pulse: 0.05 },
    ribbons: [
      // A needle-thin, razor-straight streak
      { width: 0.9, time: 0.3, blend: "add", alpha: 0.35, colors: ["#e6f0ff", "#9fb8e8", "#4a6aa8"],
        noiseAmt: 0, soft: 0.6, fadePow: 0.8, taper: 0.5 },
      { width: 0.3, time: 0.3, blend: "add", alpha: 1, colors: ["#ffffff", "#e8f0ff", "#8aa6d6"],
        core: "#ffffff", coreAmt: 1, noiseAmt: 0, soft: 0.2, fadePow: 0.6, taper: 0.4 }
    ],
    layers: []
  },

  slashing: {
    aura: { color: "#ff3b3b", size: 2.6, alpha: 0.28, pulse: 0.08 },
    ribbons: [
      // Crimson glow of the swing
      { width: 1.6, time: 0.4, blend: "add", alpha: 0.5, colors: ["#ffb0b0", "#ff2a2a", "#5a0000"],
        noiseAmt: 0.3, soft: 0.5, fadePow: 1.0, taper: 0.6, wave: { amp: 0.8, freq: 1.2, speed: 10 } },
      // A sharp silver-edged slash that sweeps side to side
      { width: 0.55, time: 0.4, blend: "add", alpha: 1, colors: ["#ffffff", "#ffd6d6", "#c40000"],
        core: "#ffffff", coreAmt: 0.9, noiseAmt: 0.1, soft: 0.2, fadePow: 0.8, taper: 0.5,
        wave: { amp: 0.8, freq: 1.2, speed: 10 } }
    ],
    layers: []
  },

  healing: {
    aura: { color: "#7dffb0", size: 3.0, alpha: 0.42, pulse: 0.12, pulseSpeed: 2 },
    ribbons: [
      // A soft ribbon of life-light with gentle pulses and twinkles
      { width: 1.8, time: 0.6, blend: "add", alpha: 0.85, colors: ["#f4fff6", "#7dffb0", "#2fd97a"],
        core: "#ffffff", coreAmt: 0.5, noiseAmt: 0.45, noiseScale: [4, 2], scroll: 1.2, soft: 0.4,
        fadePow: 1.1, taper: 0.5, bands: 3, bandAmt: 0.3, bandSpeed: 2, sparkle: 0.5 }
    ],
    layers: [
      { tex: "glow", blend: "add", rate: 26, rest: 0.8, life: [0.8, 1.3], size: [0.4, 0.1], spawn: 0.7,
        vel: [0, 0, 1.4], jitter: 0.5, drag: 0.5,
        colors: [[0, "#eaffef", 1], [0.5, "#7dffb0", 0.9], [1, "#2fd97a", 0]] }
    ]
  },

  temphp: {
    aura: { color: "#8fd3ff", size: 3.0, alpha: 0.42, pulse: 0.1 },
    ribbons: [
      // A shimmering shield-light streak
      { width: 1.6, time: 0.5, blend: "add", alpha: 0.85, colors: ["#ffffff", "#8fd3ff", "#2a7ad1"],
        core: "#ffffff", coreAmt: 0.6, noiseAmt: 0.3, noiseScale: [4, 1], scroll: 1, soft: 0.3, fadePow: 1.0,
        taper: 0.6, bands: 8, bandAmt: 0.18, bandSpeed: 4 }
    ],
    layers: [
      { tex: "shard", blend: "add", rate: 22, rest: 0.8, life: [0.6, 1.0], size: [0.4, 0.2], spawn: 0,
        orbit: { radius: 1.3, speed: 5, rise: 0.2 }, spin: 1,
        colors: [[0, "#ffffff", 1], [0.5, "#bfe9ff", 0.8], [1, "#4aa8ff", 0]] }
    ]
  }
};

/** Other spellings that should map to an effect. */
const ALIASES = {
  heal: "healing", healing: "healing", temp: "temphp", temphp: "temphp", "temporary hp": "temphp",
  frost: "cold", ice: "cold", electric: "lightning", electricity: "lightning", sonic: "thunder",
  holy: "radiant", light: "radiant", negative: "necrotic", positive: "radiant", mental: "psychic",
  bleed: "slashing", physical: "bludgeoning"
};

/* ======================================================================== */
/*  Settings, hooks, API                                                    */
/* ======================================================================== */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enabled", {
    name: "DXDT.Settings.Enabled.Name", hint: "DXDT.Settings.Enabled.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "intensity", {
    name: "DXDT.Settings.Intensity.Name", hint: "DXDT.Settings.Intensity.Hint",
    scope: "client", config: true, type: Number, default: 1,
    range: { min: 0.25, max: 2, step: 0.25 }
  });
  game.settings.register(MODULE_ID, "afterglow", {
    name: "DXDT.Settings.Afterglow.Name", hint: "DXDT.Settings.Afterglow.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", async () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { preview, previewAll, types: Object.keys(EFFECTS) };
  if (!game.modules.get("dice-so-nice")?.active) return;
  try {
    await loadThree();
    startTicker();   // always on: rolls shown from other clients don't fire the start hook
  } catch (err) {
    console.error(`${MODULE_ID} | could not load three.js from Dice So Nice`, err);
  }
});

async function loadThree() {
  if (THREE) return THREE;
  THREE = await import(foundry.utils.getRoute(THREE_URL));
  TEXTURES = makeTextures();
  return THREE;
}

// Tag every die with its damage type before Dice So Nice builds the 3D dice.
Hooks.on("diceSoNiceRollStart", (messageID, context) => {
  try {
    if (!game.settings.get(MODULE_ID, "enabled") || !THREE) return;
    let tagged = 0;
    const message = messageID ? game.messages.get(messageID) : null;
    if (message) for (const roll of message.rolls ?? []) tagged += tagRoll(roll, null);
    if (context?.roll) tagged += tagRoll(context.roll, null);
    if (context?.dsnRoll) tagged += tagRoll(context.dsnRoll, null);
    if (tagged) startTicker();
  } catch (err) {
    console.error(`${MODULE_ID} | diceSoNiceRollStart`, err);
  }
});

/* ======================================================================== */
/*  Damage type detection                                                   */
/* ======================================================================== */

let labelMap = null;
function buildLabelMap() {
  labelMap = {};
  const add = (key, cfg) => {
    const label = cfg?.label ? game.i18n.localize(cfg.label) : null;
    if (label) labelMap[label.toLowerCase()] = key;
  };
  for (const [k, v] of Object.entries(CONFIG.DND5E?.damageTypes ?? {})) add(k, v);
  for (const [k, v] of Object.entries(CONFIG.DND5E?.healingTypes ?? {})) add(k, v);
}

/** Map a type key, alias or localized label to one of our effects. */
function normalizeType(value) {
  if (!value || typeof value !== "string") return null;
  const s = value.toLowerCase().trim();
  if (!s) return null;
  if (EFFECTS[s]) return s;
  if (ALIASES[s]) return ALIASES[s];
  if (!labelMap) buildLabelMap();
  const fromLabel = labelMap[s];
  if (fromLabel) return EFFECTS[fromLabel] ? fromLabel : (ALIASES[fromLabel] ?? null);
  return null;
}

function rollType(roll) {
  const o = roll?.options ?? {};
  return normalizeType(o.type) ?? normalizeType(Array.isArray(o.types) ? o.types[0] : null);
}

/** Tag all dice in a roll (recursing into dice pools). Returns number of dice tagged. */
function tagRoll(roll, inherited) {
  if (!roll?.terms) return 0;
  const type = rollType(roll) ?? inherited;
  let n = 0;
  for (const term of roll.terms) n += tagTerm(term, type);
  return n;
}

function tagTerm(term, type) {
  if (!term) return 0;
  if (Array.isArray(term.rolls)) {                         // PoolTerm
    let n = 0;
    for (const r of term.rolls) n += tagRoll(r, type);
    return n;
  }
  if (term.roll?.terms) return tagRoll(term.roll, type);  // ParentheticalTerm
  if (Array.isArray(term.results) && typeof term.faces === "number") {   // DiceTerm
    const t = normalizeType(term.flavor) ?? type;
    if (!t) return 0;
    term.options ??= {};
    if (!term.options[TAG]) term.options[TAG] = t;
    return 1;
  }
  return 0;
}

/* ======================================================================== */
/*  Textures                                                                */
/* ======================================================================== */

function canvasTexture(draw, size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTextures() {
  const radial = (g, s, stops) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [o, c] of stops) grd.addColorStop(o, c);
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  };
  return {
    glow: canvasTexture((g, s) => radial(g, s, [[0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,0.8)"], [0.6, "rgba(255,255,255,0.18)"], [1, "rgba(255,255,255,0)"]])),
    spark: canvasTexture((g, s) => {
      radial(g, s, [[0, "rgba(255,255,255,1)"], [0.15, "rgba(255,255,255,0.7)"], [0.4, "rgba(255,255,255,0.08)"], [1, "rgba(255,255,255,0)"]]);
      g.globalCompositeOperation = "lighter";
      for (const [w, h] of [[s, s * 0.06], [s * 0.06, s]]) {
        const grd = g.createLinearGradient(0, 0, w > h ? s : 0, w > h ? 0 : s);
        grd.addColorStop(0, "rgba(255,255,255,0)");
        grd.addColorStop(0.5, "rgba(255,255,255,0.95)");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.fillRect((s - w) / 2, (s - h) / 2, w, h);
      }
    }),
    ring: canvasTexture((g, s) => radial(g, s, [[0, "rgba(255,255,255,0)"], [0.62, "rgba(255,255,255,0)"], [0.8, "rgba(255,255,255,1)"], [0.9, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]), 128),
    smoke: canvasTexture((g, s) => {
      for (let i = 0; i < 9; i++) {
        const x = s * (0.3 + Math.random() * 0.4), y = s * (0.3 + Math.random() * 0.4), r = s * (0.18 + Math.random() * 0.2);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, "rgba(255,255,255,0.35)");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
      }
    }, 128),
    shard: canvasTexture((g, s) => {
      g.translate(s / 2, s / 2);
      const grd = g.createLinearGradient(0, -s / 2, 0, s / 2);
      grd.addColorStop(0, "rgba(255,255,255,0.2)");
      grd.addColorStop(0.5, "rgba(255,255,255,1)");
      grd.addColorStop(1, "rgba(255,255,255,0.2)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -s * 0.46); g.lineTo(s * 0.16, 0); g.lineTo(0, s * 0.46); g.lineTo(-s * 0.16, 0);
      g.closePath();
      g.fill();
    }),
    bubble: canvasTexture((g, s) => {
      radial(g, s, [[0, "rgba(255,255,255,0.15)"], [0.7, "rgba(255,255,255,0.35)"], [0.85, "rgba(255,255,255,0.95)"], [1, "rgba(255,255,255,0)"]]);
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.arc(s * 0.36, s * 0.34, s * 0.08, 0, Math.PI * 2);
      g.fill();
    })
  };
}

/* ======================================================================== */
/*  Particle rendering                                                      */
/* ======================================================================== */

const VERTEX = `
attribute float aSize;
attribute float aAlpha;
attribute float aRot;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying float vRot;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mv.z, 0.001);
  gl_Position = projectionMatrix * mv;
  vAlpha = aAlpha;
  vRot = aRot;
  vColor = aColor;
}`;

const FRAGMENT = `
uniform sampler2D uMap;
varying float vAlpha;
varying float vRot;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = mat2(c, -s, s, c) * uv + 0.5;
  vec4 t = texture2D(uMap, uv);
  float a = t.a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * t.rgb, a);
}`;

const hexCache = new Map();
function hexToRgb(hex) {
  let v = hexCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    hexCache.set(hex, v);
  }
  return v;
}

/** Sample a [t, hex, alpha] gradient at t (0..1) into out = [r,g,b,a]. */
function sampleGradient(stops, t, out) {
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0, a0] = stops[i];
  const [t1, c1, a1] = stops[Math.min(i + 1, stops.length - 1)];
  const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
  const A = hexToRgb(c0), B = hexToRgb(c1);
  out[0] = A[0] + (B[0] - A[0]) * f;
  out[1] = A[1] + (B[1] - A[1]) * f;
  out[2] = A[2] + (B[2] - A[2]) * f;
  out[3] = a0 + (a1 - a0) * f;
  return out;
}

class PointCloud {
  constructor(capacity, texture, blend) {
    this.capacity = capacity;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aRot", new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uScale: { value: 500 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: blend === "normal" ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = blend === "normal" ? 5 : 10;
    this.points.raycast = () => {};          // never picked by Dice So Nice's dice clicking
  }

  commit(count, scale) {
    const g = this.geometry;
    g.setDrawRange(0, count);
    for (const k of ["position", "aColor", "aAlpha", "aSize", "aRot"]) g.attributes[k].needsUpdate = true;
    this.material.uniforms.uScale.value = scale;
  }

  dispose() {
    this.points.removeFromParent?.();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* ======================================================================== */
/*  Emitters                                                                */
/* ======================================================================== */

const rand = (a, b) => a + Math.random() * (b - a);
function randomInSphere(r) {
  const u = Math.random(), v = Math.random(), w = Math.cbrt(Math.random()) * r;
  const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
  return [w * Math.sin(phi) * Math.cos(theta), w * Math.sin(phi) * Math.sin(theta), w * Math.cos(phi)];
}

class Layer {
  constructor(def, unit) {
    this.def = def;
    this.unit = unit;
    this.cloud = new PointCloud(420, TEXTURES[def.tex] ?? TEXTURES.glow, def.blend);
    this.parts = [];
    this.carry = 0;
    this.tmp = [0, 0, 0, 0];
  }

  emit(n, diePos, dieVel) {
    const d = this.def, u = this.unit;
    for (let i = 0; i < n && this.parts.length < this.cloud.capacity; i++) {
      const life = rand(d.life[0], d.life[1]);
      const p = { age: 0, life, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: Math.random() * 6.283,
                  spin: (d.spin ?? 0) * (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1), seed: Math.random() };
      if (d.orbit) {
        p.orbitAngle = Math.random() * Math.PI * 2;
        p.orbitZ = rand(-0.6, 0.6) * u;
        p.helixSign = Math.random() < 0.5 ? -1 : 1;
        p.x = diePos[0]; p.y = diePos[1]; p.z = diePos[2];
      } else if (d.spawn?.ring) {
        const a = Math.random() * Math.PI * 2, r = d.spawn.ring * u * rand(0.8, 1.1);
        p.x = diePos[0] + Math.cos(a) * r;
        p.y = diePos[1] + Math.sin(a) * r;
        p.z = diePos[2] + rand(-0.5, 0.8) * u;
      } else {
        const [ox, oy, oz] = randomInSphere((d.spawn ?? 0.5) * u);
        p.x = diePos[0] + ox; p.y = diePos[1] + oy; p.z = diePos[2] + oz;
      }
      const [jx, jy, jz] = randomInSphere((d.jitter ?? 0) * u);
      const inh = d.inherit ?? 0;
      p.vx = (d.vel?.[0] ?? 0) * u + jx + dieVel[0] * inh;
      p.vy = (d.vel?.[1] ?? 0) * u + jy + dieVel[1] * inh;
      p.vz = (d.vel?.[2] ?? 0) * u + jz + dieVel[2] * inh;
      this.parts.push(p);
    }
  }

  update(dt, diePos, dieVel, rateFactor, scale) {
    const d = this.def, u = this.unit;
    // Emit
    this.carry += d.rate * rateFactor * dt;
    const n = Math.floor(this.carry);
    this.carry -= n;
    if (n > 0) this.emit(n, diePos, dieVel);

    // Simulate
    const drag = d.drag != null ? Math.pow(d.drag, dt) : 1;
    const grav = (d.gravity ?? 0) * u * dt;
    const c = this.cloud;
    let k = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const t = p.age / p.life;

      if (d.orbit) {
        const o = d.orbit;
        p.orbitAngle += o.speed * dt * (o.helix ? p.helixSign : 1);
        const r = o.radius * u * (1 - 0.3 * t);
        const z = o.helix ? Math.sin(p.orbitAngle * 0.5) * u * 0.8 * p.helixSign : p.orbitZ;
        p.x = diePos[0] + Math.cos(p.orbitAngle) * r;
        p.y = diePos[1] + Math.sin(p.orbitAngle) * r;
        p.z = diePos[2] + z + (o.rise ?? 0) * u * p.age;
      } else {
        if (d.inward || d.swirl) {
          const dx = diePos[0] - p.x, dy = diePos[1] - p.y, dz = diePos[2] - p.z;
          const len = Math.hypot(dx, dy, dz) || 1;
          if (d.inward) {
            p.vx += (dx / len) * d.inward * u * dt * 3;
            p.vy += (dy / len) * d.inward * u * dt * 3;
            p.vz += (dz / len) * d.inward * u * dt * 3;
          }
          if (d.swirl) {
            const hl = Math.hypot(dx, dy) || 1;
            p.x += (-dy / hl) * d.swirl * u * dt;
            p.y += (dx / hl) * d.swirl * u * dt;
          }
        }
        p.vx *= drag; p.vy *= drag; p.vz = p.vz * drag + grav;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
      p.rot += p.spin * dt;

      sampleGradient(d.colors, t, this.tmp);
      let a = this.tmp[3];
      if (d.flicker) a *= 1 - d.flicker * Math.random();
      const size = (d.size[0] + (d.size[1] - d.size[0]) * t) * u;

      c.pos[k * 3] = p.x; c.pos[k * 3 + 1] = p.y; c.pos[k * 3 + 2] = p.z;
      c.col[k * 3] = this.tmp[0]; c.col[k * 3 + 1] = this.tmp[1]; c.col[k * 3 + 2] = this.tmp[2];
      c.alpha[k] = a;
      c.size[k] = size;
      c.rot[k] = p.rot;
      this.parts[k] = p;
      k++;
    }
    this.parts.length = k;
    c.commit(k, scale);
    return k;
  }
}

class Aura {
  constructor(def, unit) {
    this.def = def;
    this.unit = unit;
    this.cloud = new PointCloud(1, TEXTURES.glow, def.blend ?? "add");
    this.inner = def.inner ? new PointCloud(1, TEXTURES.glow, "add") : null;   // light core of a dark aura
    this.t = Math.random() * 10;
    this.level = 0;
  }

  addTo(scene) {
    scene.add(this.cloud.points);
    if (this.inner) scene.add(this.inner.points);
  }

  update(dt, diePos, strength, scale) {
    const d = this.def, u = this.unit;
    this.t += dt;
    this.level += (strength - this.level) * Math.min(1, dt * 4);
    const pulse = 1 + (d.pulse ?? 0) * Math.sin(this.t * (d.pulseSpeed ?? 6));
    const flick = 1 - (d.flicker ?? 0) * Math.random();
    const draw = (cloud, color, size, alpha) => {
      cloud.pos[0] = diePos[0]; cloud.pos[1] = diePos[1]; cloud.pos[2] = diePos[2];
      cloud.col.set(hexToRgb(color));
      cloud.alpha[0] = alpha * flick * this.level;
      cloud.size[0] = size * u * pulse;
      cloud.rot[0] = 0;
      cloud.commit(1, scale);
    };
    draw(this.cloud, d.color, d.size, d.alpha);
    if (this.inner) draw(this.inner, d.inner.color, d.inner.size, d.inner.alpha);
  }

  dispose() {
    this.cloud.dispose();
    this.inner?.dispose();
  }
}

/** Crackling lightning bolts that jump from the die. */
class Arcs {
  constructor(def, unit) {
    this.def = def;
    this.unit = unit;
    this.maxBolts = 5;
    this.segs = 7;
    const n = this.maxBolts * this.segs * 2;
    this.positions = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geometry = geo;
    this.material = new THREE.LineBasicMaterial({
      color: new THREE.Color(def.color), transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 11;
    this.lines.raycast = () => {};
    this.timer = 0;
    this.bolts = [];
  }
  update(dt, diePos, active, resting) {
    const d = this.def, u = this.unit;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = d.every * rand(0.6, 1.6);
      const count = !active ? 0 : resting ? d.restCount : Math.round(d.count * rand(0.5, 1.2));
      this.bolts = [];
      for (let b = 0; b < Math.min(count, this.maxBolts); b++) {
        const reach = rand(d.reach[0], d.reach[1]) * u;
        const [ex, ey, ez] = randomInSphere(1);
        const len = Math.hypot(ex, ey, ez) || 1;
        this.bolts.push({ dir: [ex / len, ey / len, ez / len * 0.6], reach, seed: Math.random() });
      }
    }
    let k = 0;
    const P = this.positions;
    for (const bolt of this.bolts) {
      let prev = [diePos[0], diePos[1], diePos[2]];
      for (let s = 1; s <= this.segs; s++) {
        const f = s / this.segs;
        const jitter = s === this.segs ? 0 : 0.35 * u;
        const next = [
          diePos[0] + bolt.dir[0] * bolt.reach * f + rand(-jitter, jitter),
          diePos[1] + bolt.dir[1] * bolt.reach * f + rand(-jitter, jitter),
          diePos[2] + bolt.dir[2] * bolt.reach * f + rand(-jitter, jitter)
        ];
        P.set(prev, k * 3); P.set(next, k * 3 + 3);
        k += 2;
        prev = next;
      }
    }
    this.geometry.setDrawRange(0, k);
    this.geometry.attributes.position.needsUpdate = true;
    this.material.opacity = 0.55 + Math.random() * 0.45;
    return this.bolts.length;
  }
  dispose() {
    this.lines.removeFromParent?.();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* ======================================================================== */
/*  Streaks (ribbons following the die's path)                              */
/* ======================================================================== */

const RIBBON_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// One shader for every element; the look comes from the uniforms.
// vUv.x runs 0 at the die -> 1 at the tail tip, vUv.y 0..1 across the streak.
const RIBBON_FRAGMENT = `
uniform float uTime, uSeed, uAlpha, uNoiseAmt, uColorNoise, uSoft, uFadePow;
uniform float uBands, uBandAmt, uBandSpeed, uSparkle, uCoreAmt, uScroll;
uniform vec2 uNoiseScale;
uniform vec3 uC0, uC1, uC2, uCore;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 grad(float t) {
  return t < 0.5 ? mix(uC0, uC1, t * 2.0) : mix(uC1, uC2, (t - 0.5) * 2.0);
}

void main() {
  float u = vUv.x;
  float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);            // 1 in the middle, 0 at the rim
  float n = fbm(vec2(u * uNoiseScale.x - uTime * uScroll, vUv.y * uNoiseScale.y + uSeed));
  float e = edge + (n - 0.5) * uNoiseAmt * (0.25 + u);    // ragged, licking edges further back
  float shape = smoothstep(0.0, max(uSoft, 0.001), e);
  float bands = 1.0 + uBandAmt * sin((u * uBands - uTime * uBandSpeed) * 6.2831853);
  vec3 col = grad(clamp(u + (n - 0.5) * uColorNoise, 0.0, 1.0));
  col = mix(col, uCore, clamp(pow(max(edge, 0.0), 5.0) * (1.0 - u) * uCoreAmt, 0.0, 1.0));
  float spark = 0.0;
  if (uSparkle > 0.0) {
    vec2 cell = floor(vec2(u * 50.0 + floor(uTime * 14.0), vUv.y * 6.0));
    spark = step(1.0 - 0.06 * uSparkle, hash(cell + uSeed)) * edge;
  }
  float fade = pow(max(1.0 - u, 0.0), uFadePow);
  float a = shape * fade * uAlpha * max(bands, 0.0) + spark * fade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * max(bands, 0.3) + spark, clamp(a, 0.0, 1.0));
}`;

const STREAK_WIDTH = 1.35;   // global multipliers so streaks read well next to the dice
const STREAK_TIME = 1.25;

class Ribbon {
  constructor(def, unit) {
    this.def = def;
    this.unit = unit;
    this.max = 90;
    this.pts = [];                 // newest first: { x, y, z, age, j }
    this.seed = Math.random() * 100;
    this.jagTimer = 0;
    this.time = Math.random() * 10;

    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 2 * 3);
    this.uvs = new Float32Array(this.max * 2 * 2);
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geometry = geo;

    const rgb = h => new THREE.Vector3(...hexToRgb(h));
    const c = def.colors;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uSeed: { value: this.seed }, uAlpha: { value: def.alpha ?? 1 },
        uNoiseAmt: { value: def.noiseAmt ?? 0.5 }, uColorNoise: { value: def.colorNoise ?? 0 },
        uSoft: { value: def.soft ?? 0.3 }, uFadePow: { value: def.fadePow ?? 1 },
        uBands: { value: def.bands ?? 0 }, uBandAmt: { value: def.bandAmt ?? 0 }, uBandSpeed: { value: def.bandSpeed ?? 0 },
        uSparkle: { value: def.sparkle ?? 0 }, uCoreAmt: { value: def.coreAmt ?? 0 }, uScroll: { value: def.scroll ?? 1 },
        uNoiseScale: { value: new THREE.Vector2(...(def.noiseScale ?? [5, 2])) },
        uC0: { value: rgb(c[0]) }, uC1: { value: rgb(c[1]) }, uC2: { value: rgb(c[2]) },
        uCore: { value: rgb(def.core ?? c[0]) }
      },
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: def.blend === "normal" ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = def.blend === "normal" ? 4 : 9;
    this.mesh.raycast = () => {};
  }

  update(dt, diePos, moving, camPos, intensity) {
    const d = this.def, u = this.unit;
    this.time += dt;

    // Age the path; drop points older than the trail length.
    for (const p of this.pts) p.age += dt;
    const life = d.time * STREAK_TIME;
    while (this.pts.length && this.pts[this.pts.length - 1].age > life) this.pts.pop();
    if (moving) {
      this.pts.unshift({ x: diePos[0], y: diePos[1], z: diePos[2], age: 0, j: 0 });
      if (this.pts.length > this.max) this.pts.length = this.max;
    }

    // Lightning: re-jag the bolt many times per second.
    if (d.jag) {
      this.jagTimer -= dt;
      if (this.jagTimer <= 0) {
        this.jagTimer = 0.045;
        // Random kinks every few points, straight segments in between: a real zig-zag.
        const step = 4;
        let prev = 0, next = Math.random() * 2 - 1;
        for (let i = 0; i < this.pts.length; i++) {
          if (i % step === 0) { prev = next; next = Math.random() * 2 - 1; }
          const f = (i % step) / step;
          this.pts[i].j = prev + (next - prev) * f;
        }
      }
    }

    const n = this.pts.length;
    if (n < 2) {
      this.geometry.setDrawRange(0, 0);
      return 0;
    }

    const P = this.pos, UV = this.uvs;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const a = this.pts[Math.max(0, i - 1)], b = this.pts[Math.min(n - 1, i + 1)];
      let tx = a.x - b.x, ty = a.y - b.y, tz = a.z - b.z;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      let vx = camPos[0] - p.x, vy = camPos[1] - p.y, vz = camPos[2] - p.z;
      const vl = Math.hypot(vx, vy, vz) || 1;
      vx /= vl; vy /= vl; vz /= vl;
      // side = tangent x view (the streak faces the camera)
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
      const sl = Math.hypot(sx, sy, sz);
      if (sl < 1e-5) { sx = 1; sy = 0; sz = 0; } else { sx /= sl; sy /= sl; sz /= sl; }

      const t = Math.min(1, p.age / life);                   // 0 at the die, 1 at the tip
      const head = Math.min(1, 0.35 + t * 10);               // rounded start at the die
      const w = d.width * STREAK_WIDTH * u * 0.5 * Math.pow(1 - t, d.taper ?? 0.7) * head;

      let off = 0;
      if (d.jag && i > 0) off += p.j * d.jag * u * Math.min(1, t * 6);
      if (d.wave) {
        const wv = d.wave;
        off += Math.sin(t * wv.freq * 6.2831853 - this.time * wv.speed + (wv.phase ?? 0)) * wv.amp * u * Math.min(1, t * 4);
      }
      const cx = p.x + sx * off, cy = p.y + sy * off, cz = p.z + sz * off;

      P[i * 6] = cx + sx * w;  P[i * 6 + 1] = cy + sy * w;  P[i * 6 + 2] = cz + sz * w;
      P[i * 6 + 3] = cx - sx * w; P[i * 6 + 4] = cy - sy * w; P[i * 6 + 5] = cz - sz * w;
      UV[i * 4] = t; UV[i * 4 + 1] = 0; UV[i * 4 + 2] = t; UV[i * 4 + 3] = 1;
    }
    this.geometry.setDrawRange(0, (n - 1) * 6);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;

    const un = this.material.uniforms;
    un.uTime.value = this.time;
    const flick = d.flicker ? 1 - d.flicker * Math.random() : 1;
    un.uAlpha.value = (d.alpha ?? 1) * flick * Math.min(1, 0.5 + 0.5 * intensity);
    return n;
  }

  dispose() {
    this.mesh.removeFromParent?.();
    this.geometry.dispose();
    this.material.dispose();
  }
}

class DieEmitter {
  constructor(box, group, mesh, type) {
    this.box = box;
    this.group = group;
    this.mesh = mesh;
    this.type = type;
    const def = EFFECTS[type];
    this.unit = dieRadius(mesh, group);
    this.layers = (def.layers ?? []).map(l => new Layer(l, this.unit));
    this.ribbons = (def.ribbons ?? []).map(r => new Ribbon(r, this.unit));
    this.aura = def.aura ? new Aura(def.aura, this.unit) : null;
    this.arcs = def.arcs ? new Arcs(def.arcs, this.unit) : null;
    this.lastPos = null;
    this.vel = [0, 0, 0];
    this.still = 0;
    this.emitting = true;
    this.alive = true;
    const scene = box.scene;
    for (const r of this.ribbons) scene.add(r.mesh);
    this.aura?.addTo(scene);
    for (const l of this.layers) scene.add(l.cloud.points);
    if (this.arcs) scene.add(this.arcs.lines);
  }

  get attached() {
    return !!this.group.parent && this.group.parent === this.box.scene;
  }

  update(dt, intensity, afterglow, scale) {
    if (!this.attached) {                   // Dice So Nice cleared the table
      this.alive = false;
      return 0;
    }
    const p = this.group.position;
    const pos = [p.x, p.y, p.z];
    if (this.lastPos && dt > 0) {
      this.vel = [(pos[0] - this.lastPos[0]) / dt, (pos[1] - this.lastPos[1]) / dt, (pos[2] - this.lastPos[2]) / dt];
    }
    this.lastPos = pos;

    const speed = Math.hypot(this.vel[0], this.vel[1], this.vel[2]) / this.unit;  // die radii per second
    this.still = speed < 0.6 ? this.still + dt : 0;
    const resting = this.still > 0.35 || this.box.rolling === false;

    let rateFactor;
    if (!resting) rateFactor = intensity * (0.45 + 0.55 * Math.min(1, speed / 12));
    else rateFactor = afterglow ? intensity : 0;

    let live = 0;
    const cam = this.box.camera?.position;
    const camPos = cam ? [cam.x, cam.y, cam.z] : [pos[0], pos[1], pos[2] + 3000];
    for (const r of this.ribbons) live += r.update(dt, pos, !resting, camPos, intensity);
    for (const l of this.layers) {
      const factor = resting ? rateFactor * (l.def.rest ?? 0.25) : rateFactor;
      live += l.update(dt, pos, this.vel, factor, scale);
    }
    const auraStrength = resting ? (afterglow ? 0.7 : 0) : 1;
    if (this.aura) this.aura.update(dt, pos, auraStrength, scale);
    if (this.arcs) live += this.arcs.update(dt, pos, !resting || afterglow, resting);
    if (this.aura && this.aura.level > 0.02) live++;
    return live;
  }

  dispose() {
    for (const r of this.ribbons) r.dispose();
    for (const l of this.layers) l.cloud.dispose();
    this.aura?.dispose();
    this.arcs?.dispose();
  }
}

function dieRadius(mesh, group) {
  try {
    const geo = mesh.geometry ?? mesh.children?.find(c => c.geometry)?.geometry;
    if (geo && !geo.boundingSphere) geo.computeBoundingSphere?.();
    const r = geo?.boundingSphere?.radius;
    const s = Math.max(mesh.scale?.x ?? 1, 1) * Math.max(group.scale?.x ?? 1, 1);
    if (r && Number.isFinite(r)) return r * s;
  } catch (_) { /* fall through */ }
  const base = game.dice3d?.DiceFactory?.baseScale ?? 50;
  return base * 0.6;
}

/* ======================================================================== */
/*  Ticker                                                                  */
/* ======================================================================== */

function startTicker() {
  if (tickerActive || !canvas?.app?.ticker) return;
  tickerActive = true;
  lastTime = performance.now();
  canvas.app.ticker.add(tick);
}

function stopTicker() {
  if (!tickerActive) return;
  tickerActive = false;
  canvas.app.ticker.remove(tick);
}

function tick() {
  if (!game.settings.get(MODULE_ID, "enabled")) return;
  const box = game.dice3d?.box;
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (!box?.scene || !THREE) return;

  // Find newly spawned, tagged dice
  for (const child of box.scene.children) {
    const mesh = child.children?.[0];
    const type = mesh?.options?.[TAG];
    if (!type || !EFFECTS[type] || mesh.sim === undefined) continue;
    const key = mesh.uuid;
    if (!emitters.has(key)) emitters.set(key, new DieEmitter(box, child, mesh, type));
  }

  if (!emitters.size) return;

  const intensity = game.settings.get(MODULE_ID, "intensity") ?? 1;
  const afterglow = game.settings.get(MODULE_ID, "afterglow") ?? true;
  const scale = pointScale(box);

  let live = 0;
  for (const [key, em] of emitters) {
    live += em.update(dt, intensity, afterglow, scale);
    if (!em.alive || (!em.attached)) {
      em.dispose();
      emitters.delete(key);
    }
  }

  // Dice So Nice stops drawing once the dice have landed; keep the afterglow and
  // fading particles moving by drawing the scene ourselves while it is on screen.
  if (live > 0 && box.rolling === false && box.isVisible !== false) {
    try { box.renderScene(); } catch (err) { /* table was cleared mid-frame */ }
  }
}

/** Converts a world-space size to pixels for gl_PointSize. */
function pointScale(box) {
  const cam = box.camera;
  const h = box.renderer?.domElement?.height ?? window.innerHeight;
  const fov = (cam?.fov ?? 20) * Math.PI / 180;
  return h / (2 * Math.tan(fov / 2));
}

/* ======================================================================== */
/*  Preview                                                                 */
/* ======================================================================== */

async function preview(type = "fire", formula = "2d6") {
  const key = normalizeType(type);
  if (!key) {
    ui.notifications.warn(`${MODULE_ID}: unknown damage type "${type}". Known: ${Object.keys(EFFECTS).join(", ")}`);
    return;
  }
  if (!game.dice3d) {
    ui.notifications.warn(`${MODULE_ID}: Dice So Nice is not active.`);
    return;
  }
  await loadThree();
  const roll = await new Roll(formula).evaluate();
  for (const d of roll.dice) d.options[TAG] = key;
  startTicker();
  return game.dice3d.showForRoll(roll, game.user, false);
}

async function previewAll(formula = "1d8") {
  for (const type of Object.keys(EFFECTS)) {
    ui.notifications.info(`${MODULE_ID}: ${type}`);
    await preview(type, formula);
  }
}

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
 * Settings: "Trail intensity" scales how bright, long and busy the trails are;
 * "Trail width" scales how wide the streaks, glow and particles are.
 *
 * Particle sprites: Kenney Particle Pack (CC0, www.kenney.nl), see textures/.
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
 *   strip      { row, repeat, scroll, mask, glow }  a streak texture (textures/strips.png, rows 0-7)
 *              laid along the streak. repeat 0 stretches it head-to-tail once, otherwise it
 *              tiles `repeat` times and flows at `scroll`. mask: how much it cuts the streak's
 *              shape (0-1); glow: how much it adds light on top.
 *              Rows: 0 crackling bolt, 1 thin bolt, 2-4 wispy threads, 5 soft band,
 *                    6 blast (bright head, long tail), 7 flame tongue
 *
 * layer fields (accent particles):
 *   tex        drawn: glow | spark | shard | bubble
 *              Kenney sprites: ring | heart | rune | smoke | bolts | stars | flames | twirls | slashes | debris
 *              (sheets of 4 variants; each particle picks one)
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
  // Signature: a real flame tail, orange all the way, with licking flame tongues, embers and smoke.
  fire: {
    aura: { color: "#ff6a00", size: 3.0, alpha: 0.6, pulse: 0.14, flicker: 0.3 },
    ribbons: [
      // Smoke trailing far behind the flames
      { width: 3.2, time: 1.1, blend: "normal", alpha: 0.45, colors: ["#3a2618", "#241c16", "#101010"],
        noiseAmt: 1.3, noiseScale: [4, 3], scroll: 1.5, soft: 0.55, fadePow: 1.3, taper: 0.4 },
      // The fire tail: licking flames, yellow at the die, orange, deep red at the tips
      { width: 3.8, time: 0.7, blend: "add", alpha: 1, colors: ["#ffc23a", "#ff4a00", "#8a0800"],
        core: "#ffe28a", coreAmt: 0.35, noiseAmt: 2.6, noiseScale: [5, 3], scroll: 6, colorNoise: 0.6,
        soft: 0.45, fadePow: 0.8, taper: 0.45, flicker: 0.15,
        strip: { row: 6, repeat: 0, mask: 0.35, glow: 0.5 } },
      // Hot yellow core right behind the die
      { width: 1.2, time: 0.35, blend: "add", alpha: 0.9, colors: ["#fff2b0", "#ffc23a", "#ff6a00"],
        core: "#fff6d0", coreAmt: 0.6, noiseAmt: 0.7, noiseScale: [8, 2], scroll: 6, soft: 0.3, fadePow: 0.9, taper: 0.8,
        strip: { row: 7, repeat: 0, mask: 0.5, glow: 0.4 } }
    ],
    layers: [
      { tex: "flames", blend: "add", rate: 28, rest: 0.8, life: [0.25, 0.5], size: [1.1, 0.4], spawn: 0.35,
        vel: [0, 0, 2.6], jitter: 0.5, drag: 0.6, flicker: 0.2,
        colors: [[0, "#ffd24a", 0.95], [0.4, "#ff6a00", 0.85], [1, "#8a1000", 0]] },
      { tex: "spark", blend: "add", rate: 45, rest: 0.3, life: [0.6, 1.2], size: [0.35, 0.06], spawn: 0.8,
        vel: [0, 0, 3.4], jitter: 2.6, gravity: -1.2, drag: 0.6, spin: 6,
        colors: [[0, "#ffe27a", 1], [0.5, "#ff8a1a", 0.9], [1, "#ff2a00", 0]] },
      { tex: "smoke", blend: "normal", rate: 10, rest: 0.5, life: [0.9, 1.4], size: [0.6, 1.8], spawn: 0.3,
        vel: [0, 0, 1.4], jitter: 0.3, drag: 0.6, spin: 0.8,
        colors: [[0, "#2a1c12", 0], [0.2, "#2a1c12", 0.45], [1, "#121212", 0]] }
    ]
  },

  // Signature: pale icy streak in freezing mist, falling ice shards and snow glints.
  cold: {
    aura: { color: "#bff4ff", size: 3.0, alpha: 0.5, pulse: 0.06 },
    ribbons: [
      // Freezing mist
      { width: 3.4, time: 0.9, blend: "add", alpha: 0.4, colors: ["#e8fbff", "#8fdcff", "#2f7fd1"],
        noiseAmt: 1.1, noiseScale: [4, 2], scroll: 0.8, soft: 0.65, fadePow: 1.3, taper: 0.3 },
      // Frost streak: icy striations that glint
      { width: 1.5, time: 0.55, blend: "add", alpha: 0.95, colors: ["#e6fbff", "#7fd8ff", "#1f6fd1"],
        core: "#ffffff", coreAmt: 0.5, noiseAmt: 0.7, noiseScale: [14, 1.2], scroll: 0.6, colorNoise: 0.25,
        soft: 0.18, fadePow: 1.0, taper: 0.8, sparkle: 1.0,
        strip: { row: 3, repeat: 1.5, scroll: 0.8, mask: 0, glow: 0.7 } }
    ],
    layers: [
      { tex: "shard", blend: "add", rate: 34, rest: 0.4, life: [0.6, 1.2], size: [0.6, 0.2], spawn: 0.7,
        vel: [0, 0, 0.5], jitter: 1.3, gravity: -3, drag: 0.5, spin: 4, flicker: 0.3,
        colors: [[0, "#ffffff", 1], [0.4, "#bff0ff", 0.95], [1, "#4aa8ff", 0]] },
      { tex: "stars", blend: "add", rate: 16, rest: 0.8, life: [0.25, 0.5], size: [0.9, 0.1], spawn: 0.9,
        vel: [0, 0, 0], jitter: 0.2, spin: 1,
        colors: [[0, "#ffffff", 1], [1, "#9fe2ff", 0]] }
    ]
  },

  // Signature: a thin, violently jagged bolt with arcs jumping off the die, crackling blue.
  lightning: {
    aura: { color: "#6fb4ff", size: 3.3, alpha: 0.6, pulse: 0.05, flicker: 0.7 },
    arcs: { color: "#cfe8ff", every: 0.04, count: 3, reach: [1.6, 3.4], restCount: 1 },
    ribbons: [
      // Electric glow around the bolt
      { width: 2.2, time: 0.4, blend: "add", alpha: 0.6, colors: ["#bfe0ff", "#3f8cff", "#1a2cff"],
        noiseAmt: 0.4, noiseScale: [10, 2], scroll: 8, soft: 0.5, fadePow: 0.9, taper: 0.5,
        bands: 7, bandAmt: 0.15, bandSpeed: 12, flicker: 0.6,
        strip: { row: 0, repeat: 1.2, scroll: 5, mask: 0.3, glow: 1.4 } },
      // Jagged white-hot bolt
      { width: 0.35, time: 0.4, blend: "add", alpha: 1, colors: ["#ffffff", "#e6f4ff", "#7fb8ff"],
        core: "#ffffff", coreAmt: 1, noiseAmt: 0.1, soft: 0.25, fadePow: 0.7, taper: 0.4, jag: 1.3, flicker: 0.35 }
    ],
    layers: [
      { tex: "bolts", blend: "add", rate: 40, rest: 0.3, life: [0.06, 0.16], size: [1.3, 1.0], spawn: 0.4,
        vel: [0, 0, 0], jitter: 1.5, drag: 0.1, flicker: 0.5,
        colors: [[0, "#ffffff", 1], [0.5, "#8fc4ff", 0.9], [1, "#2f5bff", 0]] }
    ]
  },

  // Signature: a dark indigo roar with big white shockwave rings bursting off the die.
  thunder: {
    aura: { color: "#4a4dff", size: 3.2, alpha: 0.45, pulse: 0.35, pulseSpeed: 10 },
    ribbons: [
      { width: 2.4, time: 0.5, blend: "add", alpha: 0.9, colors: ["#b8bcff", "#4a4dff", "#14106a"],
        core: "#e8eaff", coreAmt: 0.3, noiseAmt: 0.5, noiseScale: [5, 2], scroll: 3, soft: 0.35, fadePow: 1.1,
        taper: 0.5, bands: 5, bandAmt: 0.55, bandSpeed: 6 }
    ],
    layers: [
      { tex: "ring", blend: "add", rate: 9, rest: 0.5, life: [0.4, 0.55], size: [0.6, 5.5], spawn: 0,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#ffffff", 1], [0.35, "#c8caff", 0.6], [1, "#4a4dff", 0]] },
      { tex: "ring", blend: "add", rate: 4, rest: 0.2, life: [0.6, 0.8], size: [1.0, 8.0], spawn: 0,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#8f92ff", 0.5], [1, "#2a1d9f", 0]] }
    ]
  },

  // Signature: neon yellow-green streak dripping sizzling droplets, caustic fumes.
  acid: {
    aura: { color: "#c8ff1a", size: 2.8, alpha: 0.45, pulse: 0.12 },
    ribbons: [
      // Caustic fumes
      { width: 2.6, time: 0.75, blend: "normal", alpha: 0.35, colors: ["#9ad12a", "#6a9a1e", "#3a5a10"],
        noiseAmt: 1.2, noiseScale: [4, 3], scroll: 1.2, soft: 0.6, fadePow: 1.3, taper: 0.3 },
      // Bubbling acid streak
      { width: 1.6, time: 0.55, blend: "add", alpha: 1, colors: ["#f4ff7a", "#c8ff1a", "#4f8f00"],
        core: "#fbffc8", coreAmt: 0.4, noiseAmt: 0.9, noiseScale: [9, 4], scroll: 2.2, colorNoise: 0.3,
        soft: 0.25, fadePow: 1.0, taper: 0.7, sparkle: 0.35,
        strip: { row: 2, repeat: 2, scroll: 1.5, mask: 0, glow: 0.6 } }
    ],
    layers: [
      // Droplets that drip off and fall
      { tex: "bubble", blend: "add", rate: 36, rest: 0.4, life: [0.5, 0.9], size: [0.5, 0.3], spawn: 0.5,
        vel: [0, 0, 0.6], jitter: 1.0, gravity: -9, drag: 0.7,
        colors: [[0, "#f4ff9a", 1], [0.5, "#c8ff1a", 0.95], [1, "#4f8f00", 0]] },
      { tex: "smoke", blend: "add", rate: 8, rest: 0.6, life: [0.6, 1.0], size: [0.5, 1.4], spawn: 0.4,
        vel: [0, 0, 1.0], jitter: 0.3, drag: 0.6, spin: 1,
        colors: [[0, "#c8ff1a", 0], [0.3, "#9ad12a", 0.35], [1, "#3a5a10", 0]] }
    ]
  },

  // Signature: a thick, billowing green toxic cloud that lingers, sickly purple at the edges.
  poison: {
    aura: { color: "#3adf4a", size: 3.2, alpha: 0.35, pulse: 0.18, pulseSpeed: 2 },
    ribbons: [
      { width: 3.6, time: 1.1, blend: "normal", alpha: 0.6, colors: ["#4fd63a", "#2f8a2a", "#4b2a6a"],
        noiseAmt: 1.5, noiseScale: [4, 3], scroll: 1.0, colorNoise: 0.35, soft: 0.6, fadePow: 1.1, taper: 0.2 },
      { width: 0.9, time: 0.5, blend: "add", alpha: 0.7, colors: ["#b8ff6a", "#3aff3a", "#1a6a1a"],
        noiseAmt: 0.6, noiseScale: [6, 2], scroll: 2, soft: 0.4, fadePow: 1.0, taper: 0.8 }
    ],
    layers: [
      { tex: "smoke", blend: "normal", rate: 16, rest: 0.7, life: [1.0, 1.7], size: [0.6, 2.2], spawn: 0.4,
        vel: [0, 0, 0.5], jitter: 0.35, drag: 0.6, spin: 0.6,
        colors: [[0, "#3aa82a", 0], [0.25, "#2f8a2a", 0.55], [0.7, "#4b2a6a", 0.35], [1, "#2a1a3a", 0]] },
      { tex: "glow", blend: "add", rate: 14, rest: 0.5, life: [0.8, 1.4], size: [0.3, 0.12], spawn: 0.9,
        vel: [0, 0, 0.4], jitter: 0.6, drag: 0.5, flicker: 0.3,
        colors: [[0, "#b8ff6a", 0.9], [1, "#3aff3a", 0]] }
    ]
  },

  // Signature: black death-smoke pulled INTO the die, with ghostly green soul-wisps.
  necrotic: {
    aura: { color: "#050008", size: 3.6, alpha: 0.75, pulse: 0.12, pulseSpeed: 2.5, blend: "normal",
            inner: { color: "#3affb0", size: 1.5, alpha: 0.35 } },
    ribbons: [
      // Black death-smoke that flows back into the die (negative scroll)
      { width: 3.2, time: 0.95, blend: "normal", alpha: 0.85, colors: ["#050008", "#0a0a10", "#000000"],
        noiseAmt: 1.5, noiseScale: [5, 3], scroll: -1.8, soft: 0.5, fadePow: 1.1, taper: 0.3 },
      // Ghostly soul-fire at its edges
      { width: 1.2, time: 0.6, blend: "add", alpha: 0.7, colors: ["#b0ffe0", "#3affb0", "#004a3a"],
        noiseAmt: 1.0, noiseScale: [7, 3], scroll: -2.4, colorNoise: 0.3, soft: 0.3, fadePow: 1.0, taper: 0.6,
        strip: { row: 4, repeat: 1.5, scroll: -1.5, mask: 0, glow: 0.9 } }
    ],
    layers: [
      { tex: "smoke", blend: "normal", rate: 16, rest: 0.8, life: [0.7, 1.1], size: [1.6, 0.4], spawn: { ring: 1.8 },
        vel: [0, 0, 0], jitter: 0.1, inward: 1.6, swirl: 2.0, spin: 1.5,
        colors: [[0, "#000000", 0], [0.3, "#050008", 0.75], [1, "#000000", 0]] },
      { tex: "glow", blend: "add", rate: 16, rest: 0.8, life: [0.6, 1.1], size: [0.4, 0.1], spawn: { ring: 1.9 },
        vel: [0, 0, 0], jitter: 0.2, inward: 2.0, swirl: 2.6,
        colors: [[0, "#3affb0", 0.0], [0.3, "#6affc8", 0.9], [1, "#1a8a6a", 0]] }
    ]
  },

  // Signature: a wide golden sunbeam with a white-gold core, bursting with star glints.
  radiant: {
    aura: { color: "#ffe066", size: 4.0, alpha: 0.7, pulse: 0.15, pulseSpeed: 4 },
    ribbons: [
      { width: 3.4, time: 0.6, blend: "add", alpha: 0.5, colors: ["#fff0b0", "#ffc21a", "#ff8a00"],
        noiseAmt: 0.3, noiseScale: [3, 1], scroll: 1, soft: 0.7, fadePow: 1.2, taper: 0.4 },
      { width: 1.2, time: 0.5, blend: "add", alpha: 1, colors: ["#fffbe6", "#ffe066", "#ffb400"],
        core: "#ffffff", coreAmt: 0.7, noiseAmt: 0.15, soft: 0.25, fadePow: 0.9, taper: 0.7, sparkle: 0.8,
        strip: { row: 3, repeat: 2, scroll: 3, mask: 0, glow: 0.6 } }
    ],
    layers: [
      { tex: "stars", blend: "add", rate: 26, rest: 0.8, life: [0.3, 0.6], size: [1.4, 0.2], spawn: 0.6,
        vel: [0, 0, 0], jitter: 0.25, spin: 1.5,
        colors: [[0, "#ffffff", 1], [0.5, "#ffe680", 0.8], [1, "#ffb400", 0]] }
    ]
  },

  // Signature: magenta-violet arcane energy with arcane swirls orbiting the die.
  force: {
    aura: { color: "#c04dff", size: 3.2, alpha: 0.55, pulse: 0.12, pulseSpeed: 5 },
    ribbons: [
      { width: 1.9, time: 0.5, blend: "add", alpha: 1, colors: ["#eab8ff", "#c04dff", "#4a0f9f"],
        core: "#f6e0ff", coreAmt: 0.4, noiseAmt: 0.25, noiseScale: [4, 1], scroll: 2, soft: 0.25, fadePow: 1.0,
        taper: 0.6, bands: 6, bandAmt: 0.35, bandSpeed: 7,
        strip: { row: 2, repeat: 2.5, scroll: 4, mask: 0, glow: 0.9 } }
    ],
    layers: [
      { tex: "twirls", blend: "add", rate: 26, rest: 1.0, life: [0.5, 0.9], size: [1.0, 0.4], spawn: 0,
        orbit: { radius: 1.3, speed: 9, rise: 0.3 }, spin: 7,
        colors: [[0, "#f6e0ff", 1], [0.5, "#c04dff", 0.95], [1, "#6a0fcf", 0]] }
    ]
  },

  // Signature: two hot-pink strands weaving around each other, with spinning mind-swirls.
  psychic: {
    aura: { color: "#ff4fb8", size: 3.2, alpha: 0.5, pulse: 0.22, pulseSpeed: 3 },
    ribbons: [
      { width: 1.7, time: 0.6, blend: "add", alpha: 0.95, colors: ["#ffc8ea", "#ff4fb8", "#8a1a6a"],
        core: "#ffe6f6", coreAmt: 0.3, noiseAmt: 0.45, noiseScale: [5, 2], scroll: 1.5, soft: 0.3, fadePow: 1.0,
        taper: 0.6, bands: 4, bandAmt: 0.6, bandSpeed: 3, wave: { amp: 1.0, freq: 2.2, speed: 8 },
        strip: { row: 3, repeat: 2, scroll: 2, mask: 0, glow: 0.7 } },
      { width: 0.8, time: 0.6, blend: "add", alpha: 0.9, colors: ["#ffe0f4", "#ff8ad6", "#c04d9f"],
        noiseAmt: 0.2, soft: 0.3, fadePow: 1.0, taper: 0.5, wave: { amp: 1.0, freq: 2.2, speed: 8, phase: 3.14159 } }
    ],
    layers: [
      { tex: "twirls", blend: "add", rate: 9, rest: 0.8, life: [0.6, 0.9], size: [0.6, 3.0], spawn: 0,
        vel: [0, 0, 0], jitter: 0, spin: 5,
        colors: [[0, "#ffc8ea", 0.8], [0.5, "#ff4fb8", 0.45], [1, "#8a1a6a", 0]] }
    ]
  },

  // Signature: a heavy dust cloud, flying rock chips and dust rings where it hits.
  bludgeoning: {
    aura: { color: "#c9a878", size: 2.4, alpha: 0.2, pulse: 0.05, blend: "normal" },
    ribbons: [
      { width: 3.0, time: 0.7, blend: "normal", alpha: 0.65, colors: ["#c8ae88", "#8a7456", "#4a3e30"],
        noiseAmt: 1.4, noiseScale: [4, 3], scroll: 0.8, soft: 0.6, fadePow: 1.1, taper: 0.3 }
    ],
    layers: [
      { tex: "debris", blend: "normal", rate: 16, rest: 0.05, life: [0.4, 0.8], size: [1.0, 0.8], spawn: 0.5,
        vel: [0, 0, 2.2], jitter: 2.4, gravity: -10, drag: 0.8, spin: 8,
        colors: [[0, "#6a5a48", 1], [0.8, "#4a3e32", 0.95], [1, "#2e2620", 0]] },
      { tex: "smoke", blend: "normal", rate: 10, rest: 0.1, life: [0.6, 1.0], size: [0.6, 2.0], spawn: 0.4,
        vel: [0, 0, 0.6], jitter: 0.6, drag: 0.6, spin: 0.5,
        colors: [[0, "#b8a080", 0], [0.2, "#a08868", 0.5], [1, "#5a4a3a", 0]] },
      { tex: "ring", blend: "normal", rate: 3, rest: 0, life: [0.35, 0.5], size: [0.8, 4.0], spawn: 0,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#c8ae88", 0.7], [1, "#6a5a48", 0]] }
    ]
  },

  // Signature: a needle-thin, razor-straight silver streak with speed dashes and a glinting point.
  piercing: {
    aura: { color: "#dfe8ff", size: 1.8, alpha: 0.5, pulse: 0.05 },
    ribbons: [
      { width: 0.9, time: 0.45, blend: "add", alpha: 0.4, colors: ["#e6f0ff", "#9fb8e8", "#4a6aa8"],
        noiseAmt: 0, soft: 0.6, fadePow: 0.8, taper: 0.5 },
      { width: 0.3, time: 0.45, blend: "add", alpha: 1, colors: ["#ffffff", "#e8f0ff", "#8aa6d6"],
        core: "#ffffff", coreAmt: 1, noiseAmt: 0, soft: 0.2, fadePow: 0.6, taper: 0.3,
        strip: { row: 5, repeat: 3, scroll: 7, mask: 0.8, glow: 0 } }
    ],
    layers: [
      { tex: "stars", blend: "add", rate: 5, rest: 0.5, life: [0.12, 0.2], size: [1.8, 0.6], spawn: 0,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#ffffff", 1], [1, "#b8c8ff", 0]] },
      { tex: "stars", blend: "add", rate: 12, rest: 0.2, life: [0.15, 0.3], size: [0.6, 0.1], spawn: 0.3,
        vel: [0, 0, 0], jitter: 0.1,
        colors: [[0, "#ffffff", 1], [1, "#8aa6d6", 0]] }
    ]
  },

  // Signature: crimson slash marks cutting the air around a silver-and-red swing.
  slashing: {
    aura: { color: "#ff2a2a", size: 2.6, alpha: 0.35, pulse: 0.08 },
    ribbons: [
      { width: 1.7, time: 0.45, blend: "add", alpha: 0.65, colors: ["#ff8a8a", "#ff1a1a", "#5a0000"],
        noiseAmt: 0.3, soft: 0.5, fadePow: 1.0, taper: 0.6, wave: { amp: 0.8, freq: 1.2, speed: 10 } },
      { width: 0.55, time: 0.45, blend: "add", alpha: 1, colors: ["#ffffff", "#ffc0c0", "#c40000"],
        core: "#ffffff", coreAmt: 0.8, noiseAmt: 0.1, soft: 0.2, fadePow: 0.8, taper: 0.5,
        strip: { row: 2, repeat: 1.5, scroll: 4, mask: 0, glow: 0.8 },
        wave: { amp: 0.8, freq: 1.2, speed: 10 } }
    ],
    layers: [
      { tex: "slashes", blend: "add", rate: 10, rest: 0.2, life: [0.18, 0.32], size: [1.3, 2.0], spawn: 0.3,
        vel: [0, 0, 0], jitter: 0,
        colors: [[0, "#ffffff", 1], [0.4, "#ff4a4a", 0.8], [1, "#8a0000", 0]] },
      // A few red droplets flung off
      { tex: "glow", blend: "normal", rate: 10, rest: 0, life: [0.4, 0.7], size: [0.25, 0.2], spawn: 0.4,
        vel: [0, 0, 1.5], jitter: 2.0, gravity: -9, drag: 0.8,
        colors: [[0, "#c40000", 0.9], [1, "#5a0000", 0]] }
    ]
  },

  // Signature: soft green-gold life-light with little hearts rising from the die.
  healing: {
    aura: { color: "#7dffb0", size: 3.2, alpha: 0.5, pulse: 0.14, pulseSpeed: 2 },
    ribbons: [
      { width: 1.8, time: 0.65, blend: "add", alpha: 0.9, colors: ["#eaffc8", "#5dff9a", "#1fb86a"],
        core: "#ffffff", coreAmt: 0.35, noiseAmt: 0.45, noiseScale: [4, 2], scroll: 1.2, soft: 0.4,
        fadePow: 1.1, taper: 0.5, bands: 3, bandAmt: 0.3, bandSpeed: 2, sparkle: 0.6,
        strip: { row: 4, repeat: 2, scroll: 1.5, mask: 0, glow: 0.7 } }
    ],
    layers: [
      { tex: "heart", blend: "add", rate: 9, rest: 1.0, life: [0.9, 1.4], size: [1.5, 2.0], spawn: 0.8,
        vel: [0, 0, 1.6], jitter: 0.3, drag: 0.7,
        colors: [[0, "#ffffff", 0], [0.15, "#b8ffcc", 0.95], [1, "#3aff8a", 0]] },
      { tex: "glow", blend: "add", rate: 22, rest: 0.8, life: [0.8, 1.3], size: [0.4, 0.1], spawn: 0.7,
        vel: [0, 0, 1.4], jitter: 0.5, drag: 0.5,
        colors: [[0, "#f4ffe0", 1], [0.5, "#7dffb0", 0.9], [1, "#1fb86a", 0]] }
    ]
  },

  // Signature: a steel-blue shield streak, with a turning ward-rune around the die and orbiting shards.
  temphp: {
    aura: { color: "#6fb8ff", size: 3.0, alpha: 0.45, pulse: 0.1 },
    ribbons: [
      { width: 1.6, time: 0.55, blend: "add", alpha: 0.9, colors: ["#d8ecff", "#6fb8ff", "#1f4fa8"],
        core: "#ffffff", coreAmt: 0.4, noiseAmt: 0.3, noiseScale: [4, 1], scroll: 1, soft: 0.3, fadePow: 1.0,
        taper: 0.6, bands: 8, bandAmt: 0.22, bandSpeed: 4,
        strip: { row: 5, repeat: 3, scroll: 2, mask: 0.4, glow: 0.3 } }
    ],
    layers: [
      { tex: "rune", blend: "add", rate: 3, rest: 1.2, life: [0.8, 1.0], size: [4.4, 4.8], spawn: 0,
        orbit: { radius: 0, speed: 0, rise: 0, flat: true }, spin: 2,
        colors: [[0, "#dff0ff", 0], [0.2, "#bfe0ff", 1], [0.7, "#6fb8ff", 0.8], [1, "#2f6fd1", 0]] },
      { tex: "shard", blend: "add", rate: 22, rest: 0.8, life: [0.6, 1.0], size: [0.45, 0.2], spawn: 0,
        orbit: { radius: 1.4, speed: 5, rise: 0.2 }, spin: 1,
        colors: [[0, "#ffffff", 1], [0.5, "#bfe0ff", 0.85], [1, "#3a8aff", 0]] }
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
  game.settings.register(MODULE_ID, "size", {
    name: "DXDT.Settings.Size.Name", hint: "DXDT.Settings.Size.Hint",
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
  await loadSprites();
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

/** Kenney Particle Pack sprites (CC0). Sheets hold 2x2 variants. */
const SPRITES = { ring: 1, heart: 1, rune: 1, smoke: 4, bolts: 4, stars: 4, flames: 4, twirls: 4, slashes: 4, debris: 4, strips: 8 };
// The art fills only the middle of each sprite, so draw these larger to match the drawn ones.
const SPRITE_SIZE = { ring: 1.1, heart: 1.3, rune: 1, smoke: 1.5, bolts: 1.7, stars: 2.2, flames: 1.9, twirls: 1.7, slashes: 1.6, debris: 1.5 };
const FRAMES = {};   // texture name -> number of variants

async function loadSprites() {
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(SPRITES).map(async ([name, frames]) => {
    try {
      const tex = await loader.loadAsync(foundry.utils.getRoute(`modules/${MODULE_ID}/textures/${name}.png`));
      tex.generateMipmaps = frames === 1;           // no mipmaps on sheets: they would bleed between variants
      tex.minFilter = frames === 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      if (name === "strips") tex.wrapS = THREE.RepeatWrapping;
      TEXTURES[name] = tex;
      FRAMES[name] = frames;
    } catch (err) {
      console.warn(`${MODULE_ID} | could not load texture ${name}, using a plain glow`, err);
    }
  }));
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
attribute float aFrame;
uniform float uScale;
varying float vAlpha;
varying float vRot;
varying float vFrame;
varying vec3 vColor;
void main() {
  vFrame = aFrame;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mv.z, 0.001);
  gl_Position = projectionMatrix * mv;
  vAlpha = aAlpha;
  vRot = aRot;
  vColor = aColor;
}`;

const FRAGMENT = `
uniform sampler2D uMap;
uniform float uGrid;
varying float vAlpha;
varying float vRot;
varying float vFrame;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = mat2(c, -s, s, c) * uv + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;   // rotated corners
  vec2 d = abs(uv - 0.5);
  float border = 1.0 - smoothstep(0.4, 0.5, max(d.x, d.y));             // no hard sprite edges
  if (uGrid > 1.0) {
    vec2 cell = vec2(mod(vFrame, uGrid), floor(vFrame / uGrid));
    uv = (clamp(uv, 0.01, 0.99) + cell) / uGrid;
  }
  vec4 t = texture2D(uMap, uv);
  float a = t.a * vAlpha * border;
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
  constructor(capacity, texture, blend, frames = 1) {
    this.capacity = capacity;
    this.frames = frames;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.frame = new Float32Array(capacity);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aRot", new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aFrame", new THREE.BufferAttribute(this.frame, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uScale: { value: 500 }, uGrid: { value: frames > 1 ? 2 : 1 } },
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
    for (const k of ["position", "aColor", "aAlpha", "aSize", "aRot", "aFrame"]) g.attributes[k].needsUpdate = true;
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
    const tex = TEXTURES[def.tex];
    this.cloud = new PointCloud(420, tex ?? TEXTURES.glow, def.blend, tex ? (FRAMES[def.tex] ?? 1) : 1);
    this.texSize = tex && FRAMES[def.tex] ? (SPRITE_SIZE[def.tex] ?? 1) : 1;
    this.parts = [];
    this.carry = 0;
    this.tmp = [0, 0, 0, 0];
  }

  emit(n, diePos, dieVel) {
    const d = this.def, u = this.unit;
    for (let i = 0; i < n && this.parts.length < this.cloud.capacity; i++) {
      const life = rand(d.life[0], d.life[1]);
      const p = { age: 0, life, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: Math.random() * 6.283,
                  spin: (d.spin ?? 0) * (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1), seed: Math.random(),
                  frame: Math.floor(Math.random() * this.cloud.frames) };
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

  update(dt, diePos, dieVel, rateFactor, scale, sizeMul = 1) {
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
        const z = o.helix ? Math.sin(p.orbitAngle * 0.5) * u * 0.8 * p.helixSign : o.flat ? 0 : p.orbitZ;
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
      const size = (d.size[0] + (d.size[1] - d.size[0]) * t) * u * PARTICLE_SIZE * sizeMul * this.texSize;

      c.pos[k * 3] = p.x; c.pos[k * 3 + 1] = p.y; c.pos[k * 3 + 2] = p.z;
      c.col[k * 3] = this.tmp[0]; c.col[k * 3 + 1] = this.tmp[1]; c.col[k * 3 + 2] = this.tmp[2];
      c.alpha[k] = a;
      c.size[k] = size;
      c.rot[k] = p.rot;
      c.frame[k] = p.frame;
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

  update(dt, diePos, strength, scale, sizeMul = 1, intensity = 1) {
    const d = this.def, u = this.unit;
    this.t += dt;
    const bright = Math.min(1.6, Math.max(0.2, intensity));
    this.level += (strength - this.level) * Math.min(1, dt * 4);
    const pulse = 1 + (d.pulse ?? 0) * Math.sin(this.t * (d.pulseSpeed ?? 6));
    const flick = 1 - (d.flicker ?? 0) * Math.random();
    const draw = (cloud, color, size, alpha) => {
      cloud.pos[0] = diePos[0]; cloud.pos[1] = diePos[1]; cloud.pos[2] = diePos[2];
      cloud.col.set(hexToRgb(color));
      cloud.alpha[0] = Math.min(1, alpha * bright) * flick * this.level;
      cloud.size[0] = size * AURA_SIZE * sizeMul * u * pulse;
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
  update(dt, diePos, active, resting, sizeMul = 1) {
    const d = this.def, u = this.unit * sizeMul;
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
uniform sampler2D uStrip;
uniform float uStripOn, uStripRow, uStripRepeat, uStripScroll, uStripMask, uStripGlow;
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
  float st = 1.0;
  if (uStripOn > 0.5) {
    float sx = uStripRepeat > 0.0 ? u * uStripRepeat - uTime * uStripScroll : clamp(u, 0.0, 1.0);
    float sy = 1.0 - (uStripRow + 1.0 - clamp(vUv.y, 0.02, 0.98)) / 8.0;
    st = texture2D(uStrip, vec2(sx, sy)).a;
  }
  float shaped = shape * mix(1.0, st, uStripMask * uStripOn);
  float glow = st * uStripGlow * uStripOn;
  float a = (shaped + glow) * fade * uAlpha * max(bands, 0.0) + spark * fade;
  if (a < 0.004) discard;
  vec3 lit = mix(col, uCore, clamp(glow, 0.0, 1.0) * 0.6);
  gl_FragColor = vec4(lit * max(bands, 0.3) + spark, clamp(a, 0.0, 1.0));
}`;

// Global multipliers on top of the per-effect values (and the "Trail width" setting).
const STREAK_WIDTH = 0.45;   // streak width
const STREAK_TIME = 1.25;    // streak length (seconds of flight path)
const AURA_SIZE = 0.7;       // glow around the die
const PARTICLE_SIZE = 1.0;   // accent particles
const BASE_WIDTH = 0.75;     // what "Trail width" 1 means (everything above is multiplied by it)

class Ribbon {
  constructor(def, unit) {
    this.def = def;
    this.unit = unit;
    this.max = 140;                // enough points for the longest streak at high intensity
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
        uCore: { value: rgb(def.core ?? c[0]) },
        uStrip: { value: TEXTURES.strips ?? null },
        uStripOn: { value: def.strip && TEXTURES.strips ? 1 : 0 },
        uStripRow: { value: def.strip?.row ?? 0 }, uStripRepeat: { value: def.strip?.repeat ?? 0 },
        uStripScroll: { value: def.strip?.scroll ?? 0 }, uStripMask: { value: def.strip?.mask ?? 0 },
        uStripGlow: { value: def.strip?.glow ?? 0 }
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

  update(dt, diePos, moving, camPos, intensity, sizeMul = 1) {
    const d = this.def, u = this.unit;
    this.time += dt;

    // Age the path; drop points older than the trail length (longer at higher intensity).
    for (const p of this.pts) p.age += dt;
    const life = d.time * STREAK_TIME * (0.55 + 0.45 * intensity);
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
      const w = d.width * STREAK_WIDTH * sizeMul * u * 0.5 * Math.pow(1 - t, d.taper ?? 0.7) * head;

      let off = 0;
      if (d.jag && i > 0) off += p.j * d.jag * u * sizeMul * Math.min(1, t * 6);
      if (d.wave) {
        const wv = d.wave;
        off += Math.sin(t * wv.freq * 6.2831853 - this.time * wv.speed + (wv.phase ?? 0)) * wv.amp * u * sizeMul * Math.min(1, t * 4);
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
    un.uAlpha.value = (d.alpha ?? 1) * flick * Math.min(1.6, Math.max(0.2, intensity));
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

  update(dt, intensity, afterglow, scale, sizeMul = 1) {
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
    for (const r of this.ribbons) live += r.update(dt, pos, !resting, camPos, intensity, sizeMul);
    for (const l of this.layers) {
      const factor = resting ? rateFactor * (l.def.rest ?? 0.25) : rateFactor;
      live += l.update(dt, pos, this.vel, factor, scale, sizeMul);
    }
    const auraStrength = resting ? (afterglow ? 0.7 : 0) : 1;
    if (this.aura) this.aura.update(dt, pos, auraStrength, scale, sizeMul, intensity);
    if (this.arcs) live += this.arcs.update(dt, pos, !resting || afterglow, resting, sizeMul);
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
    const s = Math.abs(mesh.scale?.x || 1) * Math.abs(group.scale?.x || 1);
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

  const intensity = Number(game.settings.get(MODULE_ID, "intensity") ?? 1) || 1;
  const sizeMul = (Number(game.settings.get(MODULE_ID, "size") ?? 1) || 1) * BASE_WIDTH;
  const afterglow = game.settings.get(MODULE_ID, "afterglow") ?? true;
  const scale = pointScale(box);

  let live = 0;
  for (const [key, em] of emitters) {
    live += em.update(dt, intensity, afterglow, scale, sizeMul);
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

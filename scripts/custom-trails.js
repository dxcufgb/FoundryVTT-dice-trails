/**
 * Custom trails for regular rolls: the designs, their styles, the roll kinds they can be given to,
 * and the compiler that turns a trail (a stack of layers) into an effect the renderer draws.
 *
 * A trail is {layers: [layer, ...]}, drawn together on the die. Each layer:
 *   design, style          what is drawn and its colours (or design "custom": an image of your own)
 *   scale, length, speed,  fine-tuning: width, how far back the streak reaches, how fast it flows,
 *   alpha, density         how strong it is, how many particles
 *   color                  an own colour instead of the style's (null: the style's colours)
 *   glow, pulse,           effects: an aura around the die, a pulse along the streak and aura,
 *   sparkle, wave          glints along the streak, a weaving motion
 *   sound                  the layer's sound theme (SOUNDS), "none", or null: the design's own
 *   src, motion, count,    "custom" only: the image, how it moves, how many, how big,
 *   size, blend, colorMode additive blending, and whether it keeps its colours, is tinted or recoloured
 *
 * This file has no Foundry or three.js dependencies, so the editor, the import/export and the
 * renderer all share it.
 */

export const CUSTOM = "custom";
/** How many effects a trail can stack. Every layer is drawn in full, so many busy layers cost frames. */
export const MAX_LAYERS = 20;

/** The kinds of roll a trail can be given to. Damage and healing rolls keep their damage type trails. */
export const KINDS = ["attack", "check", "save", "death", "initiative", "other"];

/**
 * The sound themes (sounds/<theme>-loop.ogg and -hit.ogg, see trail-sounds.js). A layer's `sound` is
 * one of these, "none", or null for its design's own sound (an image of your own has none by default).
 */
export const SOUNDS = [
  "fire", "frost", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "force", "psychic",
  "stone", "needle", "blade", "healing", "ward", "smoke", "stardust", "comet", "rainbow", "tide",
  "charm", "petals", "song"
];

/* ======================================================================== */
/*  Designs                                                                 */
/* ======================================================================== */
/*
 * colors: [bright, main, dark]. Each design's `build(p, s)` returns the parts of an effect
 * (ribbons, layers, auras, arcs) in the renderer's format, using the palette p and the style s.
 * Sizes are in die radii, see the renderer for the fields. `sound` names the design's sound theme
 * (trail-sounds.js): a loop while the die flies and a hit when it bounces.
 */
export const DESIGNS = {
  flame: {
    label: "Flame", icon: "fa-solid fa-fire", sound: "fire",
    styles: {
      fire: { label: "Fire", colors: ["#ffe08a", "#ff6a10", "#8a0a00"] },
      blue: { label: "Blue Flame", colors: ["#e8fbff", "#2a8aff", "#0a1a8a"] },
      fel: { label: "Fel Fire", colors: ["#eaffb0", "#5adf1a", "#0a3a02"] },
      shadowflame: { label: "Shadowflame", colors: ["#f0c8ff", "#9a2adf", "#1a0030"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.0, alpha: 0.55, pulse: 0.14, flicker: 0.3 }],
      ribbons: [
        { width: 3.2, time: 1.1, blend: "normal", alpha: 0.4, colors: [mix(p.dark, "#000000", 0.5), "#1a1410", "#0a0a0a"],
          noiseAmt: 1.3, noiseScale: [4, 3], scroll: 1.5, soft: 0.55, fadePow: 1.3, taper: 0.4 },
        { width: 3.8, time: 0.7, blend: "add", alpha: 1, colors: [p.bright, p.main, p.dark],
          core: mix(p.bright, "#ffffff", 0.5), coreAmt: 0.35, noiseAmt: 2.6, noiseScale: [5, 3], scroll: 6, colorNoise: 0.6,
          soft: 0.45, fadePow: 0.8, taper: 0.45, flicker: 0.15, strip: { row: 6, repeat: 0, mask: 0.35, glow: 0.5 } },
        { width: 1.2, time: 0.35, blend: "add", alpha: 0.9, colors: [mix(p.bright, "#ffffff", 0.6), p.bright, p.main],
          core: "#ffffff", coreAmt: 0.6, noiseAmt: 0.7, noiseScale: [8, 2], scroll: 6, soft: 0.3, fadePow: 0.9, taper: 0.8,
          strip: { row: 7, repeat: 0, mask: 0.5, glow: 0.4 } }
      ],
      layers: [
        { tex: "flames", blend: "add", rate: 28, rest: 0.8, life: [0.25, 0.5], size: [1.1, 0.4], spawn: 0.35,
          vel: [0, 0, 2.6], jitter: 0.5, drag: 0.6, flicker: 0.2,
          colors: [[0, p.bright, 0.95], [0.4, p.main, 0.85], [1, p.dark, 0]] },
        { tex: "spark", blend: "add", rate: 45, rest: 0.3, life: [0.6, 1.2], size: [0.35, 0.06], spawn: 0.8,
          vel: [0, 0, 3.4], jitter: 2.6, gravity: -1.2, drag: 0.6, spin: 6,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.9], [1, p.dark, 0]] },
        { tex: "smoke", blend: "normal", rate: 10, rest: 0.5, life: [0.9, 1.4], size: [0.6, 1.8], spawn: 0.3,
          vel: [0, 0, 1.4], jitter: 0.3, drag: 0.6, spin: 0.8,
          colors: [[0, "#2a1c12", 0], [0.2, mix(p.dark, "#201818", 0.7), 0.4], [1, "#121212", 0]] }
      ]
    })
  },

  frost: {
    label: "Frost", icon: "fa-solid fa-snowflake", sound: "frost",
    styles: {
      frost: { label: "Frost", colors: ["#ffffff", "#9ad8ff", "#1a4a7a"] },
      glacier: { label: "Glacier", colors: ["#e0ffff", "#3a9ad8", "#0a1a4a"] },
      rime: { label: "Rime", colors: ["#ffffff", "#c8d4dc", "#4a5a68"] },
      amethyst: { label: "Amethyst", colors: ["#fff0ff", "#b878ff", "#2a0a5a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.0, alpha: 0.45, pulse: 0.06 }],
      ribbons: [
        { width: 3.4, time: 0.9, blend: "add", alpha: 0.4, colors: [p.bright, p.main, p.dark],
          noiseAmt: 1.1, noiseScale: [4, 2], scroll: 0.8, soft: 0.65, fadePow: 1.3, taper: 0.3 },
        { width: 1.5, time: 0.55, blend: "add", alpha: 0.95, colors: [p.bright, p.main, p.dark],
          core: "#ffffff", coreAmt: 0.5, noiseAmt: 0.7, noiseScale: [14, 1.2], scroll: 0.6, colorNoise: 0.25,
          soft: 0.18, fadePow: 1.0, taper: 0.8, sparkle: 1.0, strip: { row: 3, repeat: 1.5, scroll: 0.8, mask: 0, glow: 0.7 } }
      ],
      layers: [
        { tex: "shard", blend: "add", rate: 30, rest: 0.4, life: [0.6, 1.2], size: [0.6, 0.2], spawn: 0.7,
          vel: [0, 0, 0.5], jitter: 1.3, gravity: -3, drag: 0.5, spin: 4, flicker: 0.3,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.95], [1, p.main, 0]] },
        { tex: "snowflakes", blend: "add", rate: 10, rest: 0.6, life: [0.7, 1.3], size: [0.7, 0.3], spawn: 0.8,
          vel: [0, 0, 0.3], jitter: 0.8, gravity: -1.5, drag: 0.5, spin: 2,
          colors: [[0, "#ffffff", 0.95], [0.6, p.bright, 0.8], [1, p.main, 0]] },
        { tex: "stars", blend: "add", rate: 14, rest: 0.8, life: [0.25, 0.5], size: [0.9, 0.1], spawn: 0.9,
          vel: [0, 0, 0], jitter: 0.2, spin: 1, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  storm: {
    label: "Storm", icon: "fa-solid fa-bolt", sound: "lightning",
    styles: {
      thunder: { label: "Thunder", colors: ["#ffffff", "#6ab8ff", "#0a1a4a"] },
      arcane: { label: "Arcane", colors: ["#fff0ff", "#c05aff", "#2a0a4a"] },
      golden: { label: "Golden", colors: ["#ffffff", "#ffd84a", "#4a3000"] },
      crimson: { label: "Crimson", colors: ["#fff0f0", "#ff3a4a", "#3a0008"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.3, alpha: 0.55, pulse: 0.05, flicker: 0.7 }],
      arcs: [{ color: mix(p.bright, p.main, 0.3), every: 0.04, count: 3, reach: [1.6, 3.4], restCount: 1 }],
      ribbons: [
        { width: 2.2, time: 0.4, blend: "add", alpha: 0.6, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.4, noiseScale: [10, 2], scroll: 8, soft: 0.5, fadePow: 0.9, taper: 0.5,
          bands: 7, bandAmt: 0.15, bandSpeed: 12, flicker: 0.6, strip: { row: 0, repeat: 1.2, scroll: 5, mask: 0.3, glow: 1.4 } },
        { width: 0.35, time: 0.4, blend: "add", alpha: 1, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 1, noiseAmt: 0.1, soft: 0.25, fadePow: 0.7, taper: 0.4, jag: 1.3, flicker: 0.35 }
      ],
      layers: [
        { tex: "bolts", blend: "add", rate: 40, rest: 0.3, life: [0.06, 0.16], size: [1.3, 1.0], spawn: 0.4,
          vel: [0, 0, 0], jitter: 1.5, drag: 0.1, flicker: 0.5,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  smoke: {
    label: "Magic Smoke", icon: "fa-solid fa-smog", sound: "smoke",
    styles: {
      arcane: { label: "Arcane", colors: ["#e8c8ff", "#9a4dff", "#2a0a5a"] },
      shadow: { label: "Shadow", colors: ["#5a4a6a", "#1a1422", "#050308"] },
      emerald: { label: "Emerald", colors: ["#c8ffd8", "#2adf7a", "#063a1a"] },
      crimson: { label: "Crimson", colors: ["#ffc8c0", "#e0202a", "#3a0206"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.35, pulse: 0.18, pulseSpeed: 2 }],
      ribbons: [
        { width: 3.6, time: 1.1, blend: "normal", alpha: 0.65, colors: [p.main, mix(p.main, p.dark, 0.5), p.dark],
          noiseAmt: 1.5, noiseScale: [4, 3], scroll: 1.0, colorNoise: 0.35, soft: 0.6, fadePow: 1.1, taper: 0.2 },
        { width: 0.9, time: 0.5, blend: "add", alpha: 0.6, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.6, noiseScale: [6, 2], scroll: 2, soft: 0.4, fadePow: 1.0, taper: 0.8 }
      ],
      layers: [
        { tex: "smoke", blend: "normal", rate: 16, rest: 0.7, life: [1.0, 1.7], size: [0.6, 2.2], spawn: 0.4,
          vel: [0, 0, 0.5], jitter: 0.35, drag: 0.6, spin: 0.6,
          colors: [[0, p.main, 0], [0.25, p.main, 0.55], [0.7, p.dark, 0.35], [1, p.dark, 0]] },
        { tex: "glow", blend: "add", rate: 14, rest: 0.5, life: [0.8, 1.4], size: [0.3, 0.12], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.6, drag: 0.5, flicker: 0.3,
          colors: [[0, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  rays: {
    label: "Sunbeam", icon: "fa-solid fa-sun", sound: "radiant",
    styles: {
      holy: { label: "Holy", colors: ["#ffffff", "#ffe89a", "#c89a2a"] },
      sun: { label: "Sunfire", colors: ["#fff4c0", "#ffa02a", "#c8400a"] },
      moon: { label: "Moonlight", colors: ["#ffffff", "#b8d8ff", "#4a6aa8"] },
      eclipse: { label: "Eclipse", colors: ["#ffd0f0", "#b03aff", "#2a0a4a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 4.0, alpha: 0.65, pulse: 0.15, pulseSpeed: 4 }],
      ribbons: [
        { width: 3.4, time: 0.6, blend: "add", alpha: 0.5, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.3, noiseScale: [3, 1], scroll: 1, soft: 0.7, fadePow: 1.2, taper: 0.4 },
        { width: 1.2, time: 0.5, blend: "add", alpha: 1, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 0.7, noiseAmt: 0.15, soft: 0.25, fadePow: 0.9, taper: 0.7, sparkle: 0.8,
          strip: { row: 3, repeat: 2, scroll: 3, mask: 0, glow: 0.6 } }
      ],
      layers: [
        { tex: "stars", blend: "add", rate: 26, rest: 0.8, life: [0.3, 0.6], size: [1.4, 0.2], spawn: 0.6,
          vel: [0, 0, 0], jitter: 0.25, spin: 1.5,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]] }
      ]
    })
  },

  arcane: {
    label: "Arcane", icon: "fa-solid fa-hat-wizard", sound: "force",
    styles: {
      arcane: { label: "Arcane", colors: ["#e0f4ff", "#3a9aff", "#0a1a4a"] },
      fey: { label: "Fey", colors: ["#f0ffe8", "#5aff9a", "#0a3a2a"] },
      infernal: { label: "Infernal", colors: ["#ffe0c0", "#ff3a1a", "#3a0400"] },
      void: { label: "Void", colors: ["#e8c8ff", "#6a1ad8", "#07020f"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.5, pulse: 0.12, pulseSpeed: 5 }],
      ribbons: [
        { width: 1.9, time: 0.5, blend: "add", alpha: 1, colors: [p.bright, p.main, p.dark],
          core: mix(p.bright, "#ffffff", 0.5), coreAmt: 0.4, noiseAmt: 0.25, noiseScale: [4, 1], scroll: 2, soft: 0.25, fadePow: 1.0,
          taper: 0.6, bands: 6, bandAmt: 0.35, bandSpeed: 7, strip: { row: 2, repeat: 2.5, scroll: 4, mask: 0, glow: 0.9 } }
      ],
      layers: [
        { tex: "twirls", blend: "add", rate: 22, rest: 1.0, life: [0.5, 0.9], size: [1.0, 0.4], spawn: 0,
          orbit: { radius: 1.3, speed: 9, rise: 0.3 }, spin: 7,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.95], [1, p.dark, 0]] },
        { tex: "glyphs", blend: "add", rate: 4, rest: 0.6, life: [0.6, 1.0], size: [0.9, 1.6], spawn: 0.6,
          vel: [0, 0, 0.8], jitter: 0.2, drag: 0.7, spin: 1.5,
          colors: [[0, "#ffffff", 0], [0.2, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  stardust: {
    label: "Stardust", icon: "fa-solid fa-star", sound: "stardust",
    styles: {
      stardust: { label: "Stardust", colors: ["#ffffff", "#9ad0ff", "#2a3a8a"] },
      fireflies: { label: "Fireflies", colors: ["#f0ffa0", "#b8e84a", "#3a5a0a"] },
      embers: { label: "Embers", colors: ["#ffe0a0", "#ff7a1a", "#8a1a00"] },
      motes: { label: "Arcane Motes", colors: ["#f0d8ff", "#b36bff", "#3a0a7a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.35, pulse: 0.1, pulseSpeed: 3 }],
      ribbons: [
        { width: 1.4, time: 0.7, blend: "add", alpha: 0.7, colors: [p.bright, p.main, p.dark],
          core: "#ffffff", coreAmt: 0.3, noiseAmt: 0.5, noiseScale: [8, 2], scroll: 1.5, soft: 0.4, fadePow: 1.1,
          taper: 0.6, sparkle: 1.2, strip: { row: 4, repeat: 2, scroll: 2, mask: 0, glow: 0.5 } }
      ],
      layers: [
        { tex: "stars", blend: "add", rate: 30, rest: 0.9, life: [0.5, 1.0], size: [0.9, 0.1], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.6, drag: 0.5, spin: 1.5, flicker: 0.4,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.9], [1, p.main, 0]] },
        { tex: "glow", blend: "add", rate: 20, rest: 0.8, life: [0.8, 1.5], size: [0.3, 0.08], spawn: 1.0,
          vel: [0, 0, 0.3], jitter: 0.5, drag: 0.5, flicker: 0.5,
          colors: [[0, p.bright, 0.9], [1, p.main, 0]] },
        { tex: "flares", blend: "add", rate: 5, rest: 0.4, life: [0.3, 0.6], size: [1.6, 0.4], spawn: 0.5,
          vel: [0, 0, 0], jitter: 0.1, colors: [[0, "#ffffff", 0.9], [1, p.bright, 0]] }
      ]
    })
  },

  comet: {
    label: "Comet", icon: "fa-solid fa-meteor", sound: "comet",
    styles: {
      silver: { label: "Silver", colors: ["#ffffff", "#c8d8e8", "#3a4a5a"] },
      gold: { label: "Gold", colors: ["#fff8d0", "#ffc84a", "#4a3000"] },
      azure: { label: "Azure", colors: ["#f0fbff", "#4ab8ff", "#0a2a4a"] },
      rose: { label: "Rose", colors: ["#fff0f6", "#ff7ab8", "#4a0a2a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.5, pulse: 0.06 }],
      ribbons: [
        { width: 2.4, time: 0.8, blend: "add", alpha: 0.5, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.5, noiseScale: [5, 2], scroll: 3, soft: 0.6, fadePow: 1.1, taper: 0.5 },
        { width: 0.8, time: 0.6, blend: "add", alpha: 1, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 0.9, noiseAmt: 0.15, soft: 0.25, fadePow: 0.8, taper: 0.5,
          strip: { row: 6, repeat: 0, mask: 0.3, glow: 0.5 } }
      ],
      layers: [
        { tex: "spark", blend: "add", rate: 30, rest: 0.3, life: [0.5, 1.0], size: [0.35, 0.05], spawn: 0.5,
          vel: [0, 0, 0.5], jitter: 1.6, gravity: -1, drag: 0.6, spin: 4,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.9], [1, p.main, 0]] },
        { tex: "flares", blend: "add", rate: 4, rest: 0.6, life: [0.25, 0.5], size: [2.2, 0.6], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 0.9], [1, p.bright, 0]] }
      ]
    })
  },

  rainbow: {
    label: "Rainbow", icon: "fa-solid fa-rainbow", sound: "rainbow",
    styles: {
      prism: { label: "Prism", colors: ["#ff4a4a", "#4aff6a", "#4a8aff"] },
      pastel: { label: "Pastel", colors: ["#ffb3c6", "#c8ffb3", "#b3d9ff"] },
      neon: { label: "Neon", colors: ["#ff2bd6", "#2bff9a", "#2bb8ff"] },
      aurora: { label: "Aurora", colors: ["#7aff9a", "#3ad8ff", "#b36bff"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.35, pulse: 0.1, pulseSpeed: 3 }],
      ribbons: [p.bright, p.main, p.dark].map((c, i) => ({
        width: 1.1, time: 0.7, blend: "add", alpha: 0.9, colors: [mix(c, "#ffffff", 0.3), c, mix(c, "#000000", 0.3)],
        core: mix(c, "#ffffff", 0.6), coreAmt: 0.4, noiseAmt: 0.25, noiseScale: [5, 1.5], scroll: 2, soft: 0.35, fadePow: 1.0,
        taper: 0.6, wave: { amp: 0.9, freq: 1.6, speed: 7, phase: i * 2.0944 },
        strip: { row: 3, repeat: 2, scroll: 2, mask: 0, glow: 0.5 }
      })),
      layers: [
        { tex: "stars", blend: "add", rate: 14, rest: 0.8, life: [0.3, 0.6], size: [0.9, 0.1], spawn: 0.8,
          vel: [0, 0, 0.3], jitter: 0.3, spin: 1.5,
          colors: [[0, "#ffffff", 1], [0.35, p.bright, 0.9], [0.7, p.main, 0.8], [1, p.dark, 0]] }
      ]
    })
  },

  necrotic: {
    label: "Necrotic", icon: "fa-solid fa-skull", sound: "necrotic",
    styles: {
      necrotic: { label: "Necrotic", colors: ["#c8ff8a", "#3affb0", "#050008"] },
      shadow: { label: "Shadow", colors: ["#c8a8ff", "#4a2a7a", "#050308"] },
      blood: { label: "Blood", colors: ["#ff8a7a", "#a80a0a", "#0a0202"] },
      bone: { label: "Bone", colors: ["#ffffff", "#c8bca0", "#2a241a"] }
    },
    build: (p, s) => ({
      auras: [{ color: p.dark, size: 3.6, alpha: 0.7, pulse: 0.12, pulseSpeed: 2.5, blend: "normal",
                inner: { color: p.main, size: 1.5, alpha: 0.35 } }],
      ribbons: [
        { width: 3.2, time: 0.95, blend: "normal", alpha: 0.85, colors: [p.dark, mix(p.dark, "#000000", 0.5), "#000000"],
          noiseAmt: 1.5, noiseScale: [5, 3], scroll: -1.8, soft: 0.5, fadePow: 1.1, taper: 0.3 },
        { width: 1.2, time: 0.6, blend: "add", alpha: 0.7, colors: [p.bright, p.main, mix(p.main, "#000000", 0.6)],
          noiseAmt: 1.0, noiseScale: [7, 3], scroll: -2.4, colorNoise: 0.3, soft: 0.3, fadePow: 1.0, taper: 0.6,
          strip: { row: 4, repeat: 1.5, scroll: -1.5, mask: 0, glow: 0.9 } }
      ],
      layers: [
        { tex: "smoke", blend: "normal", rate: 16, rest: 0.8, life: [0.7, 1.1], size: [1.6, 0.4], spawn: { ring: 1.8 },
          vel: [0, 0, 0], jitter: 0.1, inward: 1.6, swirl: 2.0, spin: 1.5,
          colors: [[0, "#000000", 0], [0.3, p.dark, 0.75], [1, "#000000", 0]] },
        { tex: "glow", blend: "add", rate: 16, rest: 0.8, life: [0.6, 1.1], size: [0.4, 0.1], spawn: { ring: 1.9 },
          vel: [0, 0, 0], jitter: 0.2, inward: 2.0, swirl: 2.6,
          colors: [[0, p.main, 0.0], [0.3, p.bright, 0.9], [1, p.main, 0]] },
        { tex: "skulls", blend: s === "bone" ? "normal" : "add", rate: s === "bone" ? 6 : 2.5, rest: 0.5, life: [0.7, 1.1],
          size: [0.9, 0.5], spawn: 0.6, vel: [0, 0, 0.9], jitter: 0.3, drag: 0.6, spin: 1,
          colors: [[0, "#ffffff", 0], [0.2, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  tide: {
    label: "Tide", icon: "fa-solid fa-water", sound: "tide",
    styles: {
      ocean: { label: "Ocean", colors: ["#e0ffff", "#1a8ad8", "#06204a"] },
      tropical: { label: "Tropical", colors: ["#f0fff8", "#1ad8c0", "#04404a"] },
      swamp: { label: "Swamp", colors: ["#d8f0a0", "#5a7a2a", "#1a2408"] },
      blood: { label: "Blood", colors: ["#ffb0a8", "#a80a14", "#2a0002"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.4, pulse: 0.1, pulseSpeed: 2 }],
      ribbons: [
        { width: 2.6, time: 0.8, blend: "add", alpha: 0.7, colors: [p.bright, p.main, p.dark],
          core: mix(p.bright, "#ffffff", 0.4), coreAmt: 0.3, noiseAmt: 0.8, noiseScale: [6, 2], scroll: 2, colorNoise: 0.3,
          soft: 0.45, fadePow: 1.0, taper: 0.5, wave: { amp: 0.7, freq: 1.4, speed: 6 },
          strip: { row: 3, repeat: 2, scroll: 1.5, mask: 0, glow: 0.5 } },
        { width: 1.0, time: 0.6, blend: "add", alpha: 0.8, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.5, soft: 0.35, fadePow: 1.0, taper: 0.6, wave: { amp: 0.7, freq: 1.4, speed: 6, phase: 3.14159 } }
      ],
      layers: [
        { tex: "bubbles", blend: "add", rate: 16, rest: 0.6, life: [0.7, 1.3], size: [0.3, 0.6], spawn: 0.6,
          vel: [0, 0, 1.6], jitter: 0.5, drag: 0.6, spin: 0.5,
          colors: [[0, p.bright, 0.9], [0.7, p.main, 0.7], [1, p.main, 0]] },
        { tex: "drops", blend: "normal", rate: 18, rest: 0.1, life: [0.4, 0.8], size: [0.45, 0.35], spawn: 0.5,
          vel: [0, 0, 1.2], jitter: 1.8, gravity: -9, drag: 0.7, spin: 1,
          colors: [[0, p.bright, 0.95], [0.6, p.main, 0.9], [1, p.dark, 0]] }
      ]
    })
  },

  ward: {
    label: "Arcane Ward", icon: "fa-solid fa-shield-halved", sound: "ward",
    styles: {
      arcane: { label: "Arcane", colors: ["#e8f8ff", "#3a9aff", "#0a1a4a"] },
      holy: { label: "Holy", colors: ["#fffbe0", "#ffc83a", "#4a3000"] },
      nature: { label: "Nature", colors: ["#f0ffe0", "#4adf6a", "#0a3a12"] },
      infernal: { label: "Infernal", colors: ["#ffe8d0", "#ff4a1a", "#3a0400"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.0, alpha: 0.45, pulse: 0.1 }],
      ribbons: [
        { width: 1.6, time: 0.55, blend: "add", alpha: 0.9, colors: [p.bright, p.main, p.dark],
          core: "#ffffff", coreAmt: 0.4, noiseAmt: 0.3, noiseScale: [4, 1], scroll: 1, soft: 0.3, fadePow: 1.0,
          taper: 0.6, bands: 8, bandAmt: 0.22, bandSpeed: 4, strip: { row: 5, repeat: 3, scroll: 2, mask: 0.4, glow: 0.3 } }
      ],
      layers: [
        { tex: "rune", blend: "add", rate: 3, rest: 1.2, life: [0.8, 1.0], size: [4.4, 4.8], spawn: 0,
          orbit: { radius: 0, speed: 0, rise: 0, flat: true }, spin: 2,
          colors: [[0, p.bright, 0], [0.2, p.bright, 1], [0.7, p.main, 0.8], [1, p.dark, 0]] },
        { tex: "shard", blend: "add", rate: 22, rest: 0.8, life: [0.6, 1.0], size: [0.45, 0.2], spawn: 0,
          orbit: { radius: 1.4, speed: 5, rise: 0.2 }, spin: 1,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.85], [1, p.main, 0]] }
      ]
    })
  },

  charm: {
    label: "Charm", icon: "fa-solid fa-heart", sound: "charm",
    styles: {
      rose: { label: "Rose", colors: ["#ffe0ec", "#ff4a8a", "#4a0020"] },
      lovesick: { label: "Lovesick", colors: ["#f8e0ff", "#b04aff", "#2a0040"] },
      crimson: { label: "Crimson", colors: ["#ffd0d0", "#e0101a", "#3a0002"] },
      fae: { label: "Fae", colors: ["#f0fff0", "#ff8ad8", "#0a3a2a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.45, pulse: 0.2, pulseSpeed: 2.5 }],
      ribbons: [
        { width: 1.8, time: 0.65, blend: "add", alpha: 0.9, colors: [p.bright, p.main, p.dark],
          core: "#ffffff", coreAmt: 0.35, noiseAmt: 0.45, noiseScale: [4, 2], scroll: 1.2, soft: 0.4,
          fadePow: 1.1, taper: 0.5, bands: 3, bandAmt: 0.3, bandSpeed: 2, sparkle: 0.5,
          strip: { row: 4, repeat: 2, scroll: 1.5, mask: 0, glow: 0.7 } }
      ],
      layers: [
        { tex: "heart", blend: "add", rate: 9, rest: 1.0, life: [0.9, 1.4], size: [1.5, 2.0], spawn: 0.8,
          vel: [0, 0, 1.6], jitter: 0.3, drag: 0.7,
          colors: [[0, "#ffffff", 0], [0.15, p.bright, 0.95], [1, p.main, 0]] },
        { tex: "glow", blend: "add", rate: 20, rest: 0.8, life: [0.8, 1.3], size: [0.4, 0.1], spawn: 0.7,
          vel: [0, 0, 1.4], jitter: 0.5, drag: 0.5,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.9], [1, p.dark, 0]] }
      ]
    })
  },

  petals: {
    label: "Leaves & Petals", icon: "fa-solid fa-seedling", sound: "petals",
    styles: {
      blossom: { label: "Cherry Blossom", colors: ["#ffe8f4", "#ff9ac8", "#8a2a5a"], tex: "petals" },
      autumn: { label: "Autumn Leaves", colors: ["#ffe0a0", "#e8801c", "#5a2a0a"], tex: "leaves" },
      spring: { label: "Spring Leaves", colors: ["#eaffc8", "#6adf3a", "#1a5a0a"], tex: "leaves" },
      winter: { label: "Snowfall", colors: ["#ffffff", "#bfe8ff", "#4a7aa8"], tex: "snowflakes" }
    },
    build: (p, s, style) => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.3, pulse: 0.08, pulseSpeed: 1.5 }],
      ribbons: [
        { width: 2.4, time: 0.8, blend: "add", alpha: 0.45, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.9, noiseScale: [4, 2], scroll: 1, soft: 0.6, fadePow: 1.2, taper: 0.4 }
      ],
      layers: [
        { tex: style.tex ?? "petals", blend: "normal", rate: 18, rest: 0.6, life: [1.0, 1.6], size: [0.6, 0.45], spawn: 0.7,
          vel: [0, 0, 0.8], jitter: 1.2, gravity: -1.8, drag: 0.55, spin: 3,
          colors: [[0, "#ffffff", 0], [0.1, p.bright, 1], [0.6, p.main, 0.95], [1, p.dark, 0]] },
        { tex: "glow", blend: "add", rate: 10, rest: 0.6, life: [0.8, 1.3], size: [0.25, 0.08], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.5, drag: 0.5, flicker: 0.4,
          colors: [[0, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  song: {
    label: "Bard's Song", icon: "fa-solid fa-music", sound: "song",
    styles: {
      golden: { label: "Golden", colors: ["#fff8d0", "#ffc84a", "#4a3000"] },
      silver: { label: "Silver", colors: ["#ffffff", "#c8d8e8", "#3a4a5a"] },
      rose: { label: "Rose", colors: ["#fff0f6", "#ff7ab8", "#4a0a2a"] },
      azure: { label: "Azure", colors: ["#f0fbff", "#4ab8ff", "#0a2a4a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.4, pulse: 0.25, pulseSpeed: 4 }],
      ribbons: [
        { width: 2.0, time: 0.7, blend: "add", alpha: 0.8, colors: [p.bright, p.main, p.dark],
          core: "#ffffff", coreAmt: 0.3, noiseAmt: 0.3, noiseScale: [4, 1], scroll: 1.5, soft: 0.4, fadePow: 1.0,
          taper: 0.6, bands: 10, bandAmt: 0.4, bandSpeed: 5, wave: { amp: 0.5, freq: 2.5, speed: 6 },
          strip: { row: 5, repeat: 4, scroll: 3, mask: 0.3, glow: 0.4 } }
      ],
      layers: [
        { tex: "notes", blend: "add", rate: 8, rest: 0.9, life: [0.9, 1.4], size: [1.1, 1.4], spawn: 0.7,
          vel: [0, 0, 1.8], jitter: 0.4, drag: 0.7, spin: 0.6,
          colors: [[0, "#ffffff", 0], [0.15, p.bright, 1], [1, p.main, 0]] },
        { tex: "stars", blend: "add", rate: 12, rest: 0.6, life: [0.3, 0.6], size: [0.8, 0.1], spawn: 0.8,
          vel: [0, 0, 0.5], jitter: 0.3, spin: 1,
          colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  blades: {
    label: "Knives", icon: "fa-solid fa-khanda", sound: "blade",
    styles: {
      steel: { label: "Steel", colors: ["#ffffff", "#a8b0bc", "#2a2e36"] },
      assassin: { label: "Assassin", colors: ["#ff5a5a", "#6a6a74", "#08080a"] },
      gilded: { label: "Gilded", colors: ["#fff4c8", "#d8a83a", "#3a2608"] },
      spectral: { label: "Spectral", colors: ["#e0f8ff", "#5ac8ff", "#0a2a4a"] }
    },
    build: (p, s) => ({
      auras: [{ color: p.bright, size: 2.0, alpha: 0.35, pulse: 0.05 }],
      ribbons: [
        { width: 1.4, time: 0.45, blend: "add", alpha: 0.6, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.3, soft: 0.5, fadePow: 1.0, taper: 0.6, wave: { amp: 0.6, freq: 1.2, speed: 10 } },
        { width: 0.4, time: 0.45, blend: "add", alpha: 1, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 0.8, noiseAmt: 0.1, soft: 0.2, fadePow: 0.8, taper: 0.5,
          strip: { row: 5, repeat: 3, scroll: 7, mask: 0.6, glow: 0.2 } }
      ],
      layers: [
        { tex: "knives", blend: s === "spectral" ? "add" : "normal", rate: 10, rest: 0.9, life: [0.9, 1.3], size: [1.6, 1.5], spawn: 0,
          orbit: { radius: 1.7, speed: 6, rise: 0 }, spin: 8,
          colors: [[0, "#ffffff", 0], [0.1, p.bright, 1], [0.8, p.main, 1], [1, p.main, 0]] },
        { tex: "slashes", blend: "add", rate: 6, rest: 0.2, life: [0.18, 0.32], size: [1.3, 2.0], spawn: 0.3,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.8], [1, p.main, 0]] }
      ]
    })
  },

  stones: {
    label: "Orbiting Stones", icon: "fa-solid fa-mountain", sound: "stone",
    styles: {
      granite: { label: "Granite", colors: ["#d8d8d0", "#8a8a84", "#2a2a28"] },
      sandstone: { label: "Sandstone", colors: ["#fff0c8", "#d8a868", "#4a3010"] },
      obsidian: { label: "Obsidian", colors: ["#c8a8ff", "#3a3048", "#08060c"] },
      jade: { label: "Jade", colors: ["#e0fff0", "#3ab87a", "#06301a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.4, alpha: 0.2, pulse: 0.05, blend: "normal" }],
      ribbons: [
        { width: 3.0, time: 0.7, blend: "normal", alpha: 0.6, colors: [p.main, mix(p.main, p.dark, 0.5), p.dark],
          noiseAmt: 1.4, noiseScale: [4, 3], scroll: 0.8, soft: 0.6, fadePow: 1.1, taper: 0.3 }
      ],
      layers: [
        { tex: "stones", blend: "normal", rate: 8, rest: 1.0, life: [1.0, 1.4], size: [1.1, 1.0], spawn: 0,
          orbit: { radius: 1.6, speed: 4, rise: 0.1 }, spin: 3,
          colors: [[0, p.bright, 0], [0.1, p.bright, 1], [0.8, p.main, 1], [1, p.main, 0]] },
        { tex: "debris", blend: "normal", rate: 12, rest: 0.05, life: [0.4, 0.8], size: [0.9, 0.7], spawn: 0.5,
          vel: [0, 0, 2.2], jitter: 2.4, gravity: -10, drag: 0.8, spin: 8,
          colors: [[0, p.main, 1], [0.8, p.dark, 0.95], [1, p.dark, 0]] },
        { tex: "smoke", blend: "normal", rate: 8, rest: 0.1, life: [0.6, 1.0], size: [0.6, 2.0], spawn: 0.4,
          vel: [0, 0, 0.6], jitter: 0.6, drag: 0.6, spin: 0.5,
          colors: [[0, p.main, 0], [0.2, p.main, 0.45], [1, p.dark, 0]] }
      ]
    })
  },

  // Soft glowing fire puffs that swell, rise and cool from a white-hot core to embers and smoke.
  // Also the fire damage trail (EFFECTS.fire in dice-trails.js builds it with the Fire style).
  fireTrail: {
    label: "Fire Trail", icon: "fa-solid fa-fire-flame-curved", sound: "fire",
    styles: {
      fire: { label: "Fire", colors: ["#fff0a0", "#ff7a1a", "#a01400"] },
      hellfire: { label: "Hellfire", colors: ["#ffd0a0", "#ff2a1a", "#4a0008"] },
      soulfire: { label: "Soulfire", colors: ["#e8ffff", "#2ad8d0", "#06304a"] },
      witchfire: { label: "Witchfire", colors: ["#f4ffc0", "#8adf1a", "#1a3a04"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.5, pulse: 0.12, flicker: 0.25 }],
      layers: [
        // The flame puffs: hot at birth, swelling and reddening as they rise and fall behind
        { tex: "glow", blend: "add", rate: 110, rest: 0.15, life: [0.5, 1.1], size: [1.0, 2.4], spawn: 0.45,
          vel: [0, 0, 1.6], jitter: 0.6, inherit: -0.08, drag: 0.7, flicker: 0.1,
          colors: [[0, mix(p.bright, "#ffffff", 0.4), 0.9], [0.3, p.bright, 0.75], [0.6, p.main, 0.45], [1, p.dark, 0]] },
        // A brighter core close behind the die
        { tex: "glow", blend: "add", rate: 50, rest: 0.1, life: [0.2, 0.4], size: [0.9, 0.5], spawn: 0.25,
          vel: [0, 0, 0.6], jitter: 0.3, drag: 0.5,
          colors: [[0, "#ffffff", 0.9], [0.5, p.bright, 0.7], [1, p.main, 0]] },
        // Thin smoke above the flames
        { tex: "smoke", blend: "normal", rate: 8, rest: 0.3, life: [0.9, 1.4], size: [0.8, 2.2], spawn: 0.4,
          vel: [0, 0, 1.8], jitter: 0.4, drag: 0.6, spin: 0.6,
          colors: [[0, "#2a1c12", 0], [0.3, mix(p.dark, "#201818", 0.7), 0.3], [1, "#121212", 0]] }
      ]
    })
  },

  // Twinkling four-point sparkles shed by the die, lingering and drifting down to the table.
  starlight: {
    label: "Starlight", icon: "fa-solid fa-star", sound: "stardust",
    styles: {
      starlight: { label: "Starlight", colors: ["#ffffff", "#8cbeff", "#1c2f6b"] },
      moonsilver: { label: "Moonsilver", colors: ["#ffffff", "#c8d4e8", "#3a4458"] },
      sungold: { label: "Sungold", colors: ["#fffbe0", "#ffd04a", "#6a4000"] },
      rosestar: { label: "Rose Star", colors: ["#fff0f6", "#ff8ac8", "#5a0a3a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.4, pulse: 0.1, pulseSpeed: 3 }],
      layers: [
        // The sparkles: a cross glint that twinkles and shrinks as it falls
        { tex: "spark", blend: "add", rate: 70, rest: 0.2, life: [0.8, 1.8], size: [0.8, 0.15], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.5, gravity: -0.8, drag: 0.7, spin: 1.5, flicker: 0.55,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.9], [1, p.main, 0]] },
        // A soft halo around each cluster of sparkles
        { tex: "glow", blend: "add", rate: 30, rest: 0.2, life: [0.8, 1.6], size: [1.6, 0.4], spawn: 0.9,
          vel: [0, 0, 0.3], jitter: 0.4, gravity: -0.6, drag: 0.7,
          colors: [[0, p.main, 0.3], [1, p.dark, 0]] },
        // A few bigger stars
        { tex: "stars", blend: "add", rate: 10, rest: 0.4, life: [0.5, 1.0], size: [1.0, 0.2], spawn: 0.8,
          vel: [0, 0, 0.2], jitter: 0.3, gravity: -0.5, spin: 1, flicker: 0.3,
          colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Dark smoke that swells and curls away from the die, with a faint glow inside it.
  shadowWisp: {
    label: "Shadow Wisp", icon: "fa-solid fa-ghost", sound: "smoke",
    styles: {
      shadow: { label: "Shadow", colors: ["#c9a8ff", "#4a1e7a", "#14061e"] },
      midnight: { label: "Midnight", colors: ["#a8c4ff", "#1e2a6a", "#060a1e"] },
      ashen: { label: "Ashen", colors: ["#d8d4d0", "#4a4644", "#121110"] },
      abyssal: { label: "Abyssal", colors: ["#a8ffe0", "#0e4a44", "#020e0e"] }
    },
    build: p => ({
      auras: [{ color: p.dark, size: 3.2, alpha: 0.55, pulse: 0.1, pulseSpeed: 2, blend: "normal" }],
      layers: [
        // The dark smoke: swelling puffs that curl around the die's path
        { tex: "smoke", blend: "normal", rate: 40, rest: 0.4, life: [1.0, 1.8], size: [0.9, 3.0], spawn: 0.3,
          vel: [0, 0, 0.8], jitter: 0.6, inherit: -0.05, drag: 0.6, spin: 0.8, swirl: 0.8,
          colors: [[0, p.dark, 0], [0.15, p.dark, 0.6], [0.6, mix(p.dark, p.main, 0.3), 0.35], [1, p.dark, 0]] },
        // A faint coloured glow inside the smoke
        { tex: "glow", blend: "add", rate: 25, rest: 0.3, life: [0.6, 1.2], size: [1.2, 2.0], spawn: 0.4,
          vel: [0, 0, 0.6], jitter: 0.4, drag: 0.6, swirl: 0.8,
          colors: [[0, p.main, 0.35], [0.6, p.main, 0.15], [1, p.dark, 0]] },
        // Tiny pale motes caught in it
        { tex: "spark", blend: "add", rate: 8, rest: 0.3, life: [0.6, 1.2], size: [0.3, 0.08], spawn: 0.7,
          vel: [0, 0, 0.8], jitter: 0.5, drag: 0.6, swirl: 1.2, flicker: 0.4,
          colors: [[0, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  /* ---- Class trails: one for each D&D 5e class; their styles include subclass names ---- */

  // Artificer: brass sparks off a grinding wheel, hissing steam, small arcs and spinning cogs.
  arcforge: {
    label: "Arcforge", icon: "fa-solid fa-gears", sound: "needle",
    styles: {
      brass: { label: "Brass", colors: ["#fff0c0", "#e0a03a", "#3a2408"] },
      copper: { label: "Copper", colors: ["#ffe0c8", "#d8703a", "#2a1008"] },
      alchemist: { label: "Alchemist", colors: ["#e8ffe0", "#5adf8a", "#0a2a1a"] },
      battleSmith: { label: "Battle Smith", colors: ["#e8f4ff", "#4ab8ff", "#0a1a2a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.0, alpha: 0.25, pulse: 0.08 }],
      arcs: [{ color: mix(p.bright, "#ffffff", 0.4), every: 0.12, count: 1, reach: [1.2, 2.2], restCount: 0 }],
      layers: [
        // Steam puffs rising off the die
        { tex: "smoke", blend: "normal", rate: 22, rest: 0.4, life: [0.9, 1.5], size: [0.6, 2.4], spawn: 0.4,
          vel: [0, 0, 1.6], jitter: 0.4, inherit: -0.06, drag: 0.6, spin: 0.6,
          colors: [[0, mix(p.bright, "#ffffff", 0.55), 0], [0.15, mix(p.bright, "#ffffff", 0.55), 0.3], [1, mix(p.bright, "#ffffff", 0.55), 0]] },
        // Grinding-wheel sparks thrown up and falling back to the table
        { tex: "spark", blend: "add", rate: 70, rest: 0.05, life: [0.3, 0.6], size: [0.35, 0.1], spawn: 0.3,
          vel: [0, 0, 3], jitter: 3, inherit: 0.2, gravity: -12, drag: 0.7,
          colors: [[0, "#ffffff", 1], [0.25, p.bright, 1], [0.7, p.main, 0.8], [1, p.dark, 0]] },
        // Small cogs turning around the die
        { tex: "ring", blend: "add", rate: 5, rest: 0.6, life: [0.8, 1.2], size: [0.6, 0.8], spawn: 0,
          orbit: { radius: 1.3, speed: 3, rise: 0.2 }, spin: 4,
          colors: [[0, p.bright, 0], [0.15, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  // Barbarian: a heartbeat-pulsing aura, furious embers, ash and chunks of floor torn up by the die.
  bloodRage: {
    label: "Blood Rage", icon: "fa-solid fa-hand-fist", sound: "thunder",
    styles: {
      rage: { label: "Rage", colors: ["#ffd0a0", "#e0201a", "#3a0204"] },
      berserker: { label: "Berserker", colors: ["#fff0c0", "#ff7a1a", "#5a1000"] },
      stormHerald: { label: "Storm Herald", colors: ["#ffffff", "#7ac8ff", "#0a2a5a"] },
      wildHeart: { label: "Wild Heart", colors: ["#f0e0b0", "#a8742a", "#2a1a08"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.0, alpha: 0.5, pulse: 0.35, pulseSpeed: 7 }],
      layers: [
        // Furious embers rising behind the die
        { tex: "glow", blend: "add", rate: 80, rest: 0.2, life: [0.5, 1.1], size: [0.5, 0.1], spawn: 0.6,
          vel: [0, 0, 1.4], jitter: 0.6, inherit: -0.08, drag: 0.7, flicker: 0.5, swirl: 0.6,
          colors: [[0, p.bright, 1], [0.3, p.main, 0.9], [1, p.dark, 0]] },
        // A hot core close behind the die
        { tex: "glow", blend: "add", rate: 40, rest: 0.1, life: [0.15, 0.3], size: [1.2, 0.5], spawn: 0.2,
          vel: [0, 0, 0], jitter: 0.2, colors: [[0, p.bright, 0.8], [1, p.main, 0]] },
        // Ash smoke
        { tex: "smoke", blend: "normal", rate: 12, rest: 0.2, life: [1.2, 2.0], size: [0.8, 2.8], spawn: 0.5,
          vel: [0, 0, 0.6], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.dark, "#28282c", 0.5), 0], [0.2, mix(p.dark, "#28282c", 0.5), 0.45], [1, "#101012", 0]] },
        // Chunks of floor kicked up and falling back
        { tex: "debris", blend: "normal", rate: 14, rest: 0.05, life: [0.6, 1.0], size: [0.7, 0.6], spawn: 0.4,
          vel: [0, 0, 3], jitter: 2.4, gravity: -11, drag: 0.8, spin: 8,
          colors: [[0, mix(p.dark, "#5a5248", 0.5), 1], [0.8, mix(p.dark, "#3a3430", 0.5), 0.95], [1, p.dark, 0]] }
      ]
    })
  },

  // Bard: notes that sway and spin up off the die like a tune still playing, with stage-light twinkles.
  encore: {
    label: "Encore", icon: "fa-solid fa-guitar", sound: "song",
    styles: {
      ballad: { label: "Ballad", colors: ["#fff4d0", "#ffb84a", "#7a2a6a"] },
      lullaby: { label: "Lullaby", colors: ["#f0f4ff", "#a8b8ff", "#3a3a8a"] },
      jig: { label: "Jig", colors: ["#f0ffd0", "#6adf4a", "#0a4a3a"] },
      dirge: { label: "Dirge", colors: ["#e8d8ff", "#7a4aa8", "#120818"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.4, alpha: 0.35, pulse: 0.15, pulseSpeed: 2 }],
      layers: [
        // Notes swaying upward and turning
        { tex: "notes", blend: "add", rate: 16, rest: 0.8, life: [1.2, 2.0], size: [1.0, 0.8], spawn: 0.6,
          vel: [0, 0, 1.2], jitter: 0.5, inherit: -0.05, drag: 0.7, spin: 1, swirl: 1.0,
          colors: [[0, p.bright, 0], [0.1, p.bright, 1], [0.6, p.main, 0.9], [1, p.dark, 0]] },
        // Stage-light twinkles
        { tex: "spark", blend: "add", rate: 30, rest: 0.4, life: [0.6, 1.2], size: [0.4, 0.1], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.3, drag: 0.6, flicker: 0.8, spin: 1,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 1], [1, p.main, 0]] },
        // Small glints close to the die
        { tex: "glow", blend: "add", rate: 20, rest: 0.3, life: [0.3, 0.6], size: [0.35, 0.1], spawn: 0.5,
          vel: [0, 0, 0.2], jitter: 0.2, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Cleric: soft halos open around the die and blessed motes drift upward, calm rather than fiery.
  divineHalo: {
    label: "Divine Halo", icon: "fa-solid fa-hands-praying", sound: "radiant",
    styles: {
      life: { label: "Life", colors: ["#ffffff", "#ffe08a", "#c8902a"] },
      light: { label: "Light", colors: ["#fff8e0", "#ffb02a", "#a83a00"] },
      twilight: { label: "Twilight", colors: ["#f0e8ff", "#9a8aff", "#2a1a5a"] },
      grave: { label: "Grave", colors: ["#f0fff8", "#8adfc0", "#1a3a3a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 3.2, alpha: 0.45, pulse: 0.1, pulseSpeed: 1.4 }],
      layers: [
        // Halos widening around the die
        { tex: "ring", blend: "add", rate: 6, rest: 0.6, life: [0.9, 1.3], size: [0.8, 4.2], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.bright, 0.9], [1, p.main, 0]] },
        // Blessed motes drifting up
        { tex: "glow", blend: "add", rate: 40, rest: 0.4, life: [1.2, 2.0], size: [0.35, 0.15], spawn: 0.8,
          vel: [0, 0, 1.2], jitter: 0.3, drag: 0.8, flicker: 0.6,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.8], [1, p.main, 0]] },
        // A white core on the die
        { tex: "glow", blend: "add", rate: 25, rest: 0.3, life: [0.2, 0.3], size: [1.3, 0.6], spawn: 0.1,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 0.7], [1, p.bright, 0]] }
      ]
    })
  },

  // Druid: leaves tumble off the die while spores and fireflies drift up, as if it rolled through a forest.
  wildGrowth: {
    label: "Wild Growth", icon: "fa-solid fa-leaf", sound: "petals",
    styles: {
      grove: { label: "Grove", colors: ["#e8ffb0", "#5ab83a", "#1a3a0a"] },
      autumn: { label: "Autumn", colors: ["#ffe0a0", "#e0701a", "#4a1a04"] },
      moon: { label: "Moon", colors: ["#f0f0ff", "#a8c0e8", "#2a3a5a"] },
      spores: { label: "Spores", colors: ["#f0e0ff", "#a85adf", "#2a1a10"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.2, alpha: 0.25, pulse: 0.08 }],
      layers: [
        // Tumbling leaves
        { tex: "leaves", blend: "normal", rate: 18, rest: 0.6, life: [1.4, 2.2], size: [0.7, 0.6], spawn: 0.6,
          vel: [0, 0, 1.2], jitter: 1.2, inherit: -0.1, gravity: -1.6, drag: 0.5, spin: 3, swirl: 0.8,
          colors: [[0, p.main, 0], [0.1, p.main, 1], [0.7, mix(p.main, p.dark, 0.3), 1], [1, p.dark, 0]] },
        // Spores and fireflies drifting up
        { tex: "glow", blend: "add", rate: 30, rest: 0.5, life: [1.5, 2.5], size: [0.3, 0.15], spawn: 0.9,
          vel: [0, 0, 0.6], jitter: 0.4, drag: 0.6, flicker: 0.7, swirl: 0.6,
          colors: [[0, p.bright, 0], [0.15, p.bright, 1], [1, p.main, 0]] },
        // Pollen glints
        { tex: "spark", blend: "add", rate: 14, rest: 0.3, life: [0.4, 0.8], size: [0.3, 0.08], spawn: 0.7,
          vel: [0, 0, 0.3], jitter: 0.3, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Fighter: sparks fly like a blade on a whetstone and bounce on the table, with quick slash arcs.
  steelSparks: {
    label: "Steel Sparks", icon: "fa-solid fa-shield", sound: "blade",
    styles: {
      forge: { label: "Forge", colors: ["#fff8d0", "#ffa02a", "#5a2000"] },
      steel: { label: "Steel", colors: ["#ffffff", "#c8d4e0", "#3a4450"] },
      champion: { label: "Champion", colors: ["#fffbe0", "#ffd84a", "#5a3a00"] },
      eldritchKnight: { label: "Eldritch Knight", colors: ["#f0e0ff", "#8a5aff", "#1a0a3a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.0, alpha: 0.2, pulse: 0.05 }],
      layers: [
        // Whetstone sparks: thrown up and out, falling back to the table
        { tex: "spark", blend: "add", rate: 110, rest: 0.03, life: [0.35, 0.7], size: [0.3, 0.1], spawn: 0.35,
          vel: [0, 0, 3.5], jitter: 3.5, inherit: 0.25, gravity: -14, drag: 0.7,
          colors: [[0, "#ffffff", 1], [0.2, p.bright, 1], [0.7, p.main, 0.8], [1, p.dark, 0]] },
        // Bright glints on the die
        { tex: "spark", blend: "add", rate: 14, rest: 0.1, life: [0.15, 0.3], size: [1.0, 0.2], spawn: 0.5,
          vel: [0, 0, 0], jitter: 0, spin: 2, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] },
        // Quick slash arcs
        { tex: "slashes", blend: "add", rate: 5, rest: 0, life: [0.25, 0.35], size: [1.6, 2.2], spawn: 0.2,
          vel: [0, 0, 0], jitter: 0, inherit: 0.3,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  // Monk: two ribbons of breath weave around each other behind the die, with soft wisps and ki rings.
  flowingKi: {
    label: "Flowing Ki", icon: "fa-solid fa-yin-yang", sound: "force",
    styles: {
      openHand: { label: "Open Hand", colors: ["#ffffff", "#8ad8ff", "#1a4a6a"] },
      elements: { label: "Elements", colors: ["#fff4d0", "#3ad8c0", "#1a2a5a"] },
      shadow: { label: "Shadow", colors: ["#d8d0ff", "#6a5aaa", "#08060f"] },
      mercy: { label: "Mercy", colors: ["#fff0e8", "#e05a6a", "#2a0a10"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.6, alpha: 0.3, pulse: 0.2, pulseSpeed: 1.6 }],
      ribbons: [
        { width: 1.0, time: 0.6, blend: "add", alpha: 0.85, colors: [p.bright, p.main, p.dark],
          core: "#ffffff", coreAmt: 0.25, noiseAmt: 0.25, soft: 0.4, fadePow: 1.0, taper: 0.6,
          wave: { amp: 0.9, freq: 1.8, speed: 7 }, strip: { row: 3, repeat: 2, scroll: 2, mask: 0, glow: 0.5 } },
        { width: 0.6, time: 0.6, blend: "add", alpha: 0.9, colors: ["#ffffff", p.bright, p.main],
          noiseAmt: 0.15, soft: 0.3, fadePow: 1.0, taper: 0.5, wave: { amp: 0.9, freq: 1.8, speed: 7, phase: 3.14159 } }
      ],
      layers: [
        // Soft wisps curling off the ribbons
        { tex: "glow", blend: "add", rate: 30, rest: 0.3, life: [0.8, 1.4], size: [0.6, 1.4], spawn: 0.5,
          vel: [0, 0, 0.3], jitter: 0.3, inherit: -0.12, drag: 0.6, swirl: 1.2,
          colors: [[0, p.bright, 0.45], [1, p.main, 0]] },
        // Ki rings breathing out from the die
        { tex: "ring", blend: "add", rate: 5, rest: 0.4, life: [0.5, 0.7], size: [0.6, 3.2], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.bright, 0.7], [1, p.main, 0]] },
        // Tiny bright motes
        { tex: "spark", blend: "add", rate: 12, rest: 0.3, life: [0.3, 0.6], size: [0.3, 0.08], spawn: 0.7,
          vel: [0, 0, 0.3], jitter: 0.3, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Paladin: a divine smite in motion, radiant flame licking upward, upright holy glints and rising sparks.
  sacredOath: {
    label: "Sacred Oath", icon: "fa-solid fa-chess-knight", sound: "ward",
    styles: {
      devotion: { label: "Devotion", colors: ["#ffffff", "#ffd84a", "#8a5a0a"] },
      vengeance: { label: "Vengeance", colors: ["#ffe0d0", "#e0301a", "#2a0404"] },
      ancients: { label: "Ancients", colors: ["#f0ffe0", "#7adf4a", "#1a4a0a"] },
      oathbreaker: { label: "Oathbreaker", colors: ["#e0c8ff", "#7a2aa8", "#08020c"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 3.0, alpha: 0.45, pulse: 0.2, pulseSpeed: 3 }],
      layers: [
        // Radiant flame licking upward
        { tex: "flames", blend: "add", rate: 70, rest: 0.25, life: [0.45, 0.8], size: [1.1, 0.4], spawn: 0.45,
          vel: [0, 0, 2.4], jitter: 0.4, inherit: -0.06, drag: 0.6, spin: 0.4,
          colors: [[0, "#ffffff", 1], [0.25, p.bright, 1], [0.6, p.main, 0.8], [1, p.dark, 0]] },
        // Holy glints
        { tex: "flares", blend: "add", rate: 8, rest: 0.4, life: [0.6, 0.9], size: [1.4, 0.4], spawn: 0.6,
          vel: [0, 0, 0.8], jitter: 0.2, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] },
        // Rising sparks
        { tex: "glow", blend: "add", rate: 30, rest: 0.3, life: [0.8, 1.3], size: [0.25, 0.1], spawn: 0.7,
          vel: [0, 0, 2.0], jitter: 0.5, drag: 0.8, flicker: 0.5, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Ranger: arrow streaks whip past, forest leaves fall, and a hunter's mark closes in on the die.
  huntersMark: {
    label: "Hunter's Mark", icon: "fa-solid fa-bullseye", sound: "needle",
    styles: {
      hunter: { label: "Hunter", colors: ["#ffe0c8", "#e0302a", "#1a3a12"] },
      gloomStalker: { label: "Gloom Stalker", colors: ["#d8d0ff", "#7a5aff", "#0a0814"] },
      beastMaster: { label: "Beast Master", colors: ["#fff0c0", "#e0a02a", "#3a2a0a"] },
      feyWanderer: { label: "Fey Wanderer", colors: ["#f0ffe8", "#ff7ad8", "#1a4a3a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.0, alpha: 0.22, pulse: 0.05 }],
      ribbons: [
        // An arrow's flight: a needle-thin streak with speed dashes
        { width: 0.35, time: 0.35, blend: "add", alpha: 0.9, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 0.6, noiseAmt: 0.05, soft: 0.2, fadePow: 0.8, taper: 0.7,
          strip: { row: 5, repeat: 4, scroll: 8, mask: 0.6, glow: 0.2 } }
      ],
      layers: [
        // Forest leaves falling behind
        { tex: "leaves", blend: "normal", rate: 14, rest: 0.4, life: [1.2, 1.8], size: [0.5, 0.45], spawn: 0.6,
          vel: [0, 0, 0.8], jitter: 1.0, inherit: -0.1, gravity: -1.8, drag: 0.5, spin: 3,
          colors: [[0, p.dark, 0], [0.1, mix(p.dark, "#5a7a3a", 0.3), 1], [0.7, p.dark, 1], [1, p.dark, 0]] },
        // The mark: a ring closing in on the die
        { tex: "ring", blend: "add", rate: 2.5, rest: 1.2, life: [0.5, 0.6], size: [4.0, 1.0], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.main, 0], [0.3, p.main, 1], [1, p.main, 0]] },
        // Embers of the mark
        { tex: "glow", blend: "add", rate: 20, rest: 0.3, life: [0.3, 0.6], size: [0.3, 0.1], spawn: 0.6,
          vel: [0, 0, 0.3], jitter: 0.3, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Rogue: the die slips through its own smoke; a glint of a blade or a coin flashes and is gone.
  shadowstep: {
    label: "Shadowstep", icon: "fa-solid fa-mask", sound: "smoke",
    styles: {
      thief: { label: "Thief", colors: ["#fff0b0", "#ffd84a", "#0c0a10"] },
      assassin: { label: "Assassin", colors: ["#ffd0d0", "#c01a2a", "#08040a"] },
      arcaneTrickster: { label: "Arcane Trickster", colors: ["#e8d8ff", "#9a5aff", "#0a0614"] },
      swashbuckler: { label: "Swashbuckler", colors: ["#e8fbff", "#3ab8ff", "#0a1420"] }
    },
    build: p => ({
      auras: [{ color: p.dark, size: 2.6, alpha: 0.55, pulse: 0.05, blend: "normal" }],
      layers: [
        // The smoke the die slips through
        { tex: "smoke", blend: "normal", rate: 45, rest: 0.4, life: [1.0, 1.8], size: [0.8, 2.8], spawn: 0.4,
          vel: [0, 0, 0.4], jitter: 0.5, inherit: -0.1, drag: 0.6, spin: 0.6, swirl: 0.6,
          colors: [[0, p.dark, 0], [0.15, p.dark, 0.75], [1, p.dark, 0]] },
        // Glints of a blade or a coin
        { tex: "spark", blend: "add", rate: 6, rest: 0.4, life: [0.2, 0.4], size: [0.8, 0.1], spawn: 0.9,
          vel: [0, 0, 0], jitter: 0, spin: 1, colors: [[0, "#ffffff", 1], [0.5, p.bright, 1], [1, p.main, 0]] },
        // Small daggers flicked up and tumbling back
        { tex: "knives", blend: "normal", rate: 4, rest: 0, life: [0.5, 0.8], size: [0.8, 0.8], spawn: 0.4,
          vel: [0, 0, 2.6], jitter: 1.4, gravity: -8, spin: 12,
          colors: [[0, p.bright, 1], [0.7, p.main, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  // Sorcerer: raw magic that will not behave, jittering sparks in drifting hues, popping bursts and stray arcs.
  wildSurge: {
    label: "Wild Surge", icon: "fa-solid fa-wand-sparkles", sound: "lightning",
    styles: {
      wildMagic: { label: "Wild Magic", colors: ["#fff0ff", "#ff4ad8", "#4a1aa8"] },
      draconic: { label: "Draconic", colors: ["#fff0c0", "#ff6a1a", "#6a0a0a"] },
      storm: { label: "Storm", colors: ["#ffffff", "#4ad8ff", "#1a3aa8"] },
      aberrant: { label: "Aberrant", colors: ["#f0ffe0", "#8aff4a", "#4a0a6a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.4, pulse: 0.4, pulseSpeed: 9, flicker: 0.3 }],
      arcs: [{ color: mix(p.bright, p.main, 0.3), every: 0.08, count: 2, reach: [1.4, 2.8], restCount: 1 }],
      layers: [
        // Jittering sparks in the main hue
        { tex: "glow", blend: "add", rate: 45, rest: 0.3, life: [0.4, 0.9], size: [0.45, 0.1], spawn: 0.6,
          vel: [0, 0, 0.4], jitter: 2.0, inherit: -0.08, drag: 0.4, flicker: 0.6,
          colors: [[0, "#ffffff", 1], [0.2, p.main, 1], [1, p.main, 0]] },
        // ... and in the far end of the palette, so the colours drift
        { tex: "glow", blend: "add", rate: 35, rest: 0.3, life: [0.4, 0.9], size: [0.45, 0.1], spawn: 0.6,
          vel: [0, 0, 0.4], jitter: 2.0, inherit: -0.08, drag: 0.4, flicker: 0.6,
          colors: [[0, "#ffffff", 1], [0.2, mix(p.dark, "#ffffff", 0.35), 1], [1, mix(p.dark, p.main, 0.5), 0]] },
        // Popping bursts flung out in every direction
        { tex: "stars", blend: "add", rate: 16, rest: 0.2, life: [0.3, 0.5], size: [0.6, 0.1], spawn: 0.1,
          vel: [0, 0, 0], jitter: 4.0, drag: 0.15, spin: 4,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Warlock: an eldritch blast beam crackles behind the die, wrapped in dark tendrils and pact glyphs.
  eldritchPact: {
    label: "Eldritch Pact", icon: "fa-solid fa-eye", sound: "necrotic",
    styles: {
      eldritch: { label: "Eldritch", colors: ["#f0d8ff", "#a83aff", "#08020f"] },
      fiend: { label: "Fiend", colors: ["#ffe0c0", "#ff3a1a", "#1a0202"] },
      greatOldOne: { label: "Great Old One", colors: ["#e0ffe8", "#3adf9a", "#06040f"] },
      archfey: { label: "Archfey", colors: ["#ffe0ff", "#d85aff", "#0a1a2a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.35, pulse: 0.15, pulseSpeed: 4 }],
      ribbons: [
        // The eldritch blast: a crackling beam with a white core
        { width: 1.2, time: 0.45, blend: "add", alpha: 0.9, colors: [p.bright, p.main, mix(p.main, p.dark, 0.6)],
          core: "#ffffff", coreAmt: 0.55, noiseAmt: 0.5, noiseScale: [6, 2], scroll: 3, soft: 0.3, fadePow: 0.9,
          taper: 0.6, jag: 0.15, sparkle: 0.3, strip: { row: 6, repeat: 0, scroll: 0, mask: 0.3, glow: 0.6 } }
      ],
      layers: [
        // Dark tendrils curling around the beam
        { tex: "smoke", blend: "normal", rate: 28, rest: 0.4, life: [1.0, 1.6], size: [0.6, 2.2], spawn: 0.4,
          vel: [0, 0, 0.4], jitter: 0.4, inherit: -0.06, drag: 0.6, spin: 1.2, swirl: 1.6,
          colors: [[0, p.dark, 0], [0.15, p.dark, 0.8], [1, p.dark, 0]] },
        // Pact glyphs floating away
        { tex: "glyphs", blend: "add", rate: 7, rest: 0.8, life: [1.2, 1.8], size: [0.8, 0.9], spawn: 0.8,
          vel: [0, 0, 0.6], jitter: 0.2, drag: 0.7, spin: 0.5,
          colors: [[0, p.main, 0], [0.2, p.bright, 1], [1, p.main, 0]] },
        // Crackling motes
        { tex: "glow", blend: "add", rate: 25, rest: 0.3, life: [0.4, 0.8], size: [0.3, 0.1], spawn: 0.6,
          vel: [0, 0, 0.3], jitter: 0.4, flicker: 0.6, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Wizard: runes written in light peel off the die and float away, leaving faint spell circles.
  spellscript: {
    label: "Spellscript", icon: "fa-solid fa-book-open", sound: "force",
    styles: {
      evocation: { label: "Evocation", colors: ["#e8f4ff", "#4a9aff", "#0a1a4a"] },
      abjuration: { label: "Abjuration", colors: ["#f0fff8", "#3adfd8", "#0a3a3a"] },
      necromancy: { label: "Necromancy", colors: ["#e0ffd0", "#7adf3a", "#0a1a08"] },
      illusion: { label: "Illusion", colors: ["#ffe8ff", "#ff7ad8", "#2a0a3a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.35, pulse: 0.1, pulseSpeed: 2 }],
      layers: [
        // Runes peeling off and floating away
        { tex: "rune", blend: "add", rate: 16, rest: 0.8, life: [1.4, 2.2], size: [0.8, 1.0], spawn: 0.6,
          vel: [0, 0, 1.0], jitter: 0.3, inherit: -0.05, drag: 0.7, spin: 0.6,
          colors: [[0, p.bright, 0], [0.15, p.bright, 1], [0.6, p.main, 0.8], [1, p.main, 0]] },
        // Faint spell circles left on the table
        { tex: "ring", blend: "add", rate: 4, rest: 0.5, life: [0.9, 1.1], size: [1.8, 2.6], spawn: 0,
          vel: [0, 0, 0], jitter: 0, spin: 0.8, colors: [[0, p.main, 0.7], [1, p.main, 0]] },
        // Arcane motes circling the die
        { tex: "glow", blend: "add", rate: 25, rest: 0.6, life: [0.6, 1.0], size: [0.3, 0.1], spawn: 0,
          orbit: { radius: 1.4, speed: 4, rise: 0.3 }, flicker: 0.4,
          colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  /* ---- Race trails: one for each D&D 5e species; their styles include lineages and ancestries ---- */

  // Aasimar: soft feathers shed from unseen wings, drifting down through a gentle radiant glow.
  heavenlyWings: {
    label: "Heavenly Wings", icon: "fa-solid fa-feather", sound: "radiant",
    styles: {
      wings: { label: "Heavenly Wings", colors: ["#ffffff", "#e0ecff", "#7a90c0"] },
      radiance: { label: "Inner Radiance", colors: ["#fff8e0", "#ffd04a", "#a8700a"] },
      shroud: { label: "Necrotic Shroud", colors: ["#e0d0f0", "#5a4a6a", "#0a060e"] },
      dawn: { label: "Dawn", colors: ["#fff0e8", "#ffa8a0", "#8a3a4a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 3.2, alpha: 0.45, pulse: 0.12, pulseSpeed: 1.6 }],
      ribbons: [
        // Two faint wing-sweeps beating out of step
        { width: 1.8, time: 0.7, blend: "add", alpha: 0.35, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.6, noiseScale: [3, 2], scroll: 1, soft: 0.7, fadePow: 1.2, taper: 0.4,
          wave: { amp: 1.2, freq: 1.2, speed: 5 } },
        { width: 1.8, time: 0.7, blend: "add", alpha: 0.35, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.6, noiseScale: [3, 2], scroll: 1, soft: 0.7, fadePow: 1.2, taper: 0.4,
          wave: { amp: 1.2, freq: 1.2, speed: 5, phase: 3.14159 } }
      ],
      layers: [
        // Feathers drifting down
        { tex: "petals", blend: "normal", rate: 16, rest: 0.7, life: [1.6, 2.4], size: [0.8, 0.7], spawn: 0.7,
          vel: [0, 0, 1.0], jitter: 1.0, inherit: -0.1, gravity: -1.0, drag: 0.4, spin: 2, swirl: 0.8,
          colors: [[0, p.bright, 0], [0.1, p.bright, 1], [0.7, p.main, 0.9], [1, p.dark, 0]] },
        // Radiant motes
        { tex: "glow", blend: "add", rate: 30, rest: 0.4, life: [1.0, 1.6], size: [0.35, 0.12], spawn: 0.8,
          vel: [0, 0, 0.8], jitter: 0.3, drag: 0.7, flicker: 0.5,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]] },
        // A soft white core
        { tex: "glow", blend: "add", rate: 20, rest: 0.3, life: [0.2, 0.3], size: [1.2, 0.6], spawn: 0.1,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 0.6], [1, p.bright, 0]] }
      ]
    })
  },

  // Dragonborn: a breath weapon roaring out behind the die, with scales glinting as they tumble.
  dragonBreath: {
    label: "Dragon Breath", icon: "fa-solid fa-dragon", sound: "fire",
    styles: {
      red: { label: "Red", colors: ["#ffe0a0", "#ff4a1a", "#5a0400"] },
      blue: { label: "Blue", colors: ["#ffffff", "#4ab8ff", "#0a1a5a"] },
      green: { label: "Green", colors: ["#e8ffb0", "#4adf3a", "#0a3a0a"] },
      gold: { label: "Gold", colors: ["#fff8d0", "#ffc84a", "#6a4000"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.4, pulse: 0.15, pulseSpeed: 4 }],
      layers: [
        // The breath: puffs blown hard back along the die's path, swelling as they slow
        { tex: "glow", blend: "add", rate: 110, rest: 0.1, life: [0.4, 0.8], size: [0.6, 1.8], spawn: 0.3,
          vel: [0, 0, 0.3], jitter: 0.8, inherit: -0.35, drag: 0.35, swirl: 0.4,
          colors: [[0, "#ffffff", 0.9], [0.2, p.bright, 0.8], [0.6, p.main, 0.5], [1, p.dark, 0]] },
        // Scales tumbling off
        { tex: "shard", blend: "normal", rate: 12, rest: 0.05, life: [0.6, 0.9], size: [0.45, 0.4], spawn: 0.5,
          vel: [0, 0, 2.4], jitter: 1.6, gravity: -9, drag: 0.8, spin: 8,
          colors: [[0, p.bright, 1], [0.3, p.main, 1], [0.8, p.dark, 1], [1, p.dark, 0]] },
        // Glints
        { tex: "spark", blend: "add", rate: 14, rest: 0.2, life: [0.2, 0.4], size: [0.6, 0.1], spawn: 0.5,
          vel: [0, 0, 0], jitter: 0, spin: 2, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Dwarf: stone chips and ore knocked loose from the mountain, flecked with gold and gem glints.
  deepVein: {
    label: "Deep Vein", icon: "fa-solid fa-gem", sound: "stone",
    styles: {
      gold: { label: "Gold Vein", colors: ["#fff4c0", "#ffc84a", "#3a2a10"] },
      mithral: { label: "Mithral", colors: ["#ffffff", "#c8d8f0", "#2a3040"] },
      ruby: { label: "Ruby", colors: ["#ffd0d0", "#e0203a", "#2a0a10"] },
      emerald: { label: "Emerald", colors: ["#e0ffe8", "#2adf7a", "#06201a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.2, alpha: 0.3, pulse: 0.08, pulseSpeed: 2 }],
      layers: [
        // Stone chips knocked loose
        { tex: "debris", blend: "normal", rate: 16, rest: 0.05, life: [0.7, 1.1], size: [0.8, 0.6], spawn: 0.4,
          vel: [0, 0, 3], jitter: 2.2, gravity: -11, drag: 0.8, spin: 8,
          colors: [[0, mix(p.dark, "#6a6458", 0.5), 1], [0.8, mix(p.dark, "#3a3630", 0.5), 0.95], [1, p.dark, 0]] },
        // Gold and gem flecks
        { tex: "spark", blend: "add", rate: 40, rest: 0.3, life: [0.4, 0.9], size: [0.4, 0.1], spawn: 0.6,
          vel: [0, 0, 1.6], jitter: 1.0, gravity: -4, drag: 0.7, flicker: 0.6, spin: 1,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 1], [1, p.main, 0]] },
        // A few ore nuggets
        { tex: "stones", blend: "normal", rate: 5, rest: 0, life: [0.7, 1.0], size: [0.5, 0.45], spawn: 0.4,
          vel: [0, 0, 2.4], jitter: 1.4, gravity: -10, spin: 6,
          colors: [[0, p.bright, 1], [0.6, p.main, 1], [1, p.dark, 0]] },
        // Dust low on the table
        { tex: "smoke", blend: "normal", rate: 8, rest: 0.1, life: [0.8, 1.4], size: [0.8, 2.4], spawn: 0.5,
          vel: [0, 0, 0.2], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.dark, "#5a5248", 0.5), 0], [0.2, mix(p.dark, "#5a5248", 0.5), 0.4], [1, p.dark, 0]] }
      ]
    })
  },

  // Elf: one fine silver streak, slender leaves turning in its wake and fey motes that wink in and out.
  elvenGrace: {
    label: "Elven Grace", icon: "fa-solid fa-moon", sound: "petals",
    styles: {
      high: { label: "High Elf", colors: ["#f0f8ff", "#9ad0ff", "#2a4a7a"] },
      wood: { label: "Wood Elf", colors: ["#f0ffd8", "#7ac83a", "#1a3a0a"] },
      drow: { label: "Drow", colors: ["#f0d8ff", "#b05aff", "#0a0414"] },
      eladrin: { label: "Eladrin", colors: ["#ffe8d0", "#ff9a4a", "#4a1a0a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.4, alpha: 0.3, pulse: 0.08, pulseSpeed: 1.2 }],
      ribbons: [
        // The fine silver streak
        { width: 0.45, time: 0.7, blend: "add", alpha: 0.95, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 0.5, noiseAmt: 0.1, soft: 0.3, fadePow: 1.0, taper: 0.6,
          wave: { amp: 0.3, freq: 0.8, speed: 3 } },
        { width: 1.4, time: 0.7, blend: "add", alpha: 0.3, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.4, soft: 0.6, fadePow: 1.2, taper: 0.5, wave: { amp: 0.3, freq: 0.8, speed: 3 } }
      ],
      layers: [
        // Glowing leaves turning in the wake
        { tex: "leaves", blend: "add", rate: 14, rest: 0.6, life: [1.4, 2.2], size: [0.6, 0.5], spawn: 0.6,
          vel: [0, 0, 1.0], jitter: 0.8, inherit: -0.08, gravity: -0.8, drag: 0.5, spin: 2, swirl: 0.8,
          colors: [[0, p.bright, 0], [0.1, p.bright, 0.9], [0.7, p.main, 0.7], [1, p.dark, 0]] },
        // Fey motes winking in and out
        { tex: "glow", blend: "add", rate: 25, rest: 0.6, life: [1.0, 1.8], size: [0.3, 0.1], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.3, drag: 0.6, flicker: 0.8, swirl: 0.6,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Gnome: bubbles that wobble up, little twirls of illusion and pops of starlight.
  gnomishWhimsy: {
    label: "Gnomish Whimsy", icon: "fa-solid fa-lightbulb", sound: "charm",
    styles: {
      forest: { label: "Forest Gnome", colors: ["#e8ffd0", "#6adf6a", "#0a3a1a"] },
      rock: { label: "Rock Gnome", colors: ["#fff0d0", "#ff9a4a", "#4a2008"] },
      deep: { label: "Deep Gnome", colors: ["#e0e8ff", "#7a8aa8", "#0a0e1a"] },
      illusion: { label: "Illusion", colors: ["#ffe8ff", "#ff8ad8", "#3a0a4a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.2, alpha: 0.3, pulse: 0.2, pulseSpeed: 5 }],
      layers: [
        // Wobbling bubbles
        { tex: "bubbles", blend: "add", rate: 16, rest: 0.7, life: [1.0, 1.8], size: [0.4, 0.8], spawn: 0.6,
          vel: [0, 0, 1.4], jitter: 0.4, inherit: -0.06, drag: 0.7, swirl: 1.0,
          colors: [[0, p.bright, 0], [0.1, p.bright, 0.9], [0.85, p.main, 0.7], [1, "#ffffff", 0]] },
        // Twirls of illusion
        { tex: "twirls", blend: "add", rate: 8, rest: 0.5, life: [0.5, 0.8], size: [0.5, 1.6], spawn: 0.4,
          vel: [0, 0, 0], jitter: 0, spin: 7, colors: [[0, p.bright, 0.9], [1, p.main, 0]] },
        // Pops of starlight
        { tex: "stars", blend: "add", rate: 14, rest: 0.4, life: [0.3, 0.6], size: [0.6, 0.1], spawn: 0.8,
          vel: [0, 0, 0.3], jitter: 0.3, spin: 1, flicker: 0.5,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Goliath: every bounce lands like a giant's step, with shockwave rings, boulders and heavy dust.
  titanStride: {
    label: "Titan Stride", icon: "fa-solid fa-mountain-sun", sound: "thunder",
    styles: {
      stone: { label: "Stone Giant", colors: ["#e8e0d0", "#9a8a78", "#2a241c"] },
      frost: { label: "Frost Giant", colors: ["#ffffff", "#9ad8ff", "#1a3a6a"] },
      fire: { label: "Fire Giant", colors: ["#ffe0a0", "#ff6a1a", "#4a0a00"] },
      storm: { label: "Storm Giant", colors: ["#ffffff", "#7ab8ff", "#1a1a4a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.25, pulse: 0.1, pulseSpeed: 2 }],
      layers: [
        // Shockwave rings spreading over the table
        { tex: "ring", blend: "add", rate: 5, rest: 0.2, life: [0.5, 0.7], size: [1.0, 5.5], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.bright, 0.9], [1, p.main, 0]] },
        // Boulders thrown up and crashing back
        { tex: "stones", blend: "normal", rate: 10, rest: 0, life: [0.7, 1.1], size: [0.8, 0.7], spawn: 0.4,
          vel: [0, 0, 3.4], jitter: 2.0, gravity: -12, drag: 0.85, spin: 6,
          colors: [[0, p.main, 1], [0.8, p.dark, 1], [1, p.dark, 0]] },
        // Heavy dust
        { tex: "smoke", blend: "normal", rate: 16, rest: 0.1, life: [0.8, 1.4], size: [1.0, 3.2], spawn: 0.6,
          vel: [0, 0, 0.3], jitter: 0.6, inherit: -0.06, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.dark, "#5a5248", 0.5), 0], [0.2, mix(p.dark, "#5a5248", 0.5), 0.45], [1, p.dark, 0]] },
        // The giant's power flickering on the die
        { tex: "glow", blend: "add", rate: 25, rest: 0.2, life: [0.4, 0.8], size: [0.35, 0.1], spawn: 0.6,
          vel: [0, 0, 1.2], jitter: 0.4, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Halfling: lucky clovers tossed in the air and golden glints, for the die that refuses to land on a 1.
  halflingLuck: {
    label: "Halfling Luck", icon: "fa-solid fa-clover", sound: "stardust",
    styles: {
      lightfoot: { label: "Lightfoot", colors: ["#ffe68a", "#5ac83a", "#1a3a0a"] },
      stout: { label: "Stout", colors: ["#ffd84a", "#c8742a", "#3a2008"] },
      hearth: { label: "Hearth", colors: ["#ffe0a0", "#e04a3a", "#3a0a08"] },
      ghostwise: { label: "Ghostwise", colors: ["#f0f0ff", "#8aa0d8", "#1a1a3a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.4, alpha: 0.35, pulse: 0.1, pulseSpeed: 2.4 }],
      layers: [
        // Clovers tossed up and fluttering down
        { tex: "leaves", blend: "normal", rate: 14, rest: 0.4, life: [1.1, 1.7], size: [0.55, 0.5], spawn: 0.5,
          vel: [0, 0, 2.4], jitter: 1.4, inherit: -0.08, gravity: -3, drag: 0.5, spin: 5,
          colors: [[0, p.main, 0], [0.1, p.main, 1], [0.75, p.main, 1], [1, p.dark, 0]] },
        // Golden glints
        { tex: "spark", blend: "add", rate: 40, rest: 0.4, life: [0.5, 1.1], size: [0.5, 0.1], spawn: 0.8,
          vel: [0, 0, 0.5], jitter: 0.3, drag: 0.6, flicker: 0.7, spin: 1.5,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 1], [1, p.bright, 0]] },
        // A warm glow on the die
        { tex: "glow", blend: "add", rate: 18, rest: 0.4, life: [0.5, 0.9], size: [0.35, 0.1], spawn: 0.6,
          vel: [0, 0, 0.4], jitter: 0.2, colors: [[0, p.bright, 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Human: a bright, steady streak that never wavers, trailing sparks and small stars.
  heroicResolve: {
    label: "Heroic Resolve", icon: "fa-solid fa-flag", sound: "comet",
    styles: {
      valor: { label: "Valor", colors: ["#fff8e0", "#ffc84a", "#6a3a00"] },
      ambition: { label: "Ambition", colors: ["#ffe0e0", "#e0303a", "#3a0408"] },
      wanderlust: { label: "Wanderlust", colors: ["#e8f8ff", "#4ab8ff", "#0a2a4a"] },
      versatile: { label: "Versatile", colors: ["#f0fff0", "#3adf9a", "#0a3a2a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.4, alpha: 0.35, pulse: 0.05 }],
      ribbons: [
        // The steady streak: a wide glow around a white-hot line
        { width: 1.6, time: 0.55, blend: "add", alpha: 0.6, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.2, soft: 0.5, fadePow: 1.0, taper: 0.5 },
        { width: 0.45, time: 0.55, blend: "add", alpha: 1, colors: ["#ffffff", p.bright, p.main],
          core: "#ffffff", coreAmt: 0.8, noiseAmt: 0.05, soft: 0.2, fadePow: 0.8, taper: 0.5 }
      ],
      layers: [
        // Sparks shed along the streak
        { tex: "spark", blend: "add", rate: 50, rest: 0.1, life: [0.3, 0.6], size: [0.3, 0.08], spawn: 0.4,
          vel: [0, 0, 0.8], jitter: 1.4, inherit: -0.15, drag: 0.5,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 1], [1, p.main, 0]] },
        // Small stars
        { tex: "stars", blend: "add", rate: 10, rest: 0.3, life: [0.4, 0.8], size: [0.6, 0.1], spawn: 0.8,
          vel: [0, 0, 0.2], jitter: 0.2, spin: 1, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Orc: a surge of speed, with rushing streaks, war-cry rings bursting off the die and hot ash.
  adrenalineRush: {
    label: "Adrenaline Rush", icon: "fa-solid fa-person-running", sound: "thunder",
    styles: {
      warpaint: { label: "Warpaint", colors: ["#ffd0b0", "#e0401a", "#2a0604"] },
      ironjaw: { label: "Ironjaw", colors: ["#e0f0d0", "#6a8a4a", "#141a0c"] },
      bonepaint: { label: "Bonepaint", colors: ["#fffff0", "#d8ccb0", "#2a2418"] },
      stormcry: { label: "Stormcry", colors: ["#e8f8ff", "#5ab8ff", "#0a1a2a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.4, pulse: 0.3, pulseSpeed: 8 }],
      ribbons: [
        // Rushing speed lines
        { width: 2.2, time: 0.3, blend: "add", alpha: 0.6, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.6, noiseScale: [8, 1], scroll: 6, soft: 0.4, fadePow: 0.8, taper: 0.4,
          strip: { row: 5, repeat: 5, scroll: 9, mask: 0.6, glow: 0.3 } }
      ],
      layers: [
        // War-cry rings
        { tex: "ring", blend: "add", rate: 5, rest: 0.2, life: [0.35, 0.5], size: [1.0, 4.6], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.bright, 1], [1, p.main, 0]] },
        // Hot embers
        { tex: "glow", blend: "add", rate: 50, rest: 0.2, life: [0.5, 0.9], size: [0.4, 0.1], spawn: 0.6,
          vel: [0, 0, 1.4], jitter: 0.6, inherit: -0.1, drag: 0.7, flicker: 0.5,
          colors: [[0, p.bright, 1], [0.4, p.main, 0.9], [1, p.dark, 0]] },
        // Ash kicked up behind
        { tex: "smoke", blend: "normal", rate: 10, rest: 0.1, life: [0.9, 1.5], size: [0.8, 2.6], spawn: 0.5,
          vel: [0, 0, 0.4], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.dark, "#28282c", 0.5), 0], [0.2, mix(p.dark, "#28282c", 0.5), 0.45], [1, "#101012", 0]] }
      ]
    })
  },

  // Tiefling: hellfire tongues, brimstone smoke and the sigils of a fiendish bloodline.
  infernalLegacy: {
    label: "Infernal Legacy", icon: "fa-solid fa-fire-flame-simple", sound: "fire",
    styles: {
      infernal: { label: "Infernal", colors: ["#ffd0a0", "#ff3a1a", "#2a0204"] },
      abyssal: { label: "Abyssal", colors: ["#e8ffb0", "#7adf1a", "#1a0420"] },
      chthonic: { label: "Chthonic", colors: ["#e8d8ff", "#7a3ac8", "#08040e"] },
      brimstone: { label: "Brimstone", colors: ["#fff0a0", "#ffb02a", "#3a1a04"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.45, pulse: 0.15, pulseSpeed: 4, flicker: 0.2 }],
      layers: [
        // Hellfire tongues
        { tex: "flames", blend: "add", rate: 60, rest: 0.25, life: [0.4, 0.75], size: [1.0, 0.4], spawn: 0.45,
          vel: [0, 0, 2.2], jitter: 0.4, inherit: -0.06, drag: 0.6, spin: 0.4,
          colors: [[0, p.bright, 0.9], [0.3, p.main, 0.85], [1, p.dark, 0]] },
        // Brimstone smoke
        { tex: "smoke", blend: "normal", rate: 20, rest: 0.4, life: [1.0, 1.6], size: [0.8, 2.6], spawn: 0.4,
          vel: [0, 0, 1.2], jitter: 0.4, drag: 0.6, spin: 0.6, swirl: 0.6,
          colors: [[0, p.dark, 0], [0.15, p.dark, 0.7], [1, p.dark, 0]] },
        // Sigils of the bloodline
        { tex: "glyphs", blend: "add", rate: 4, rest: 0.6, life: [0.9, 1.3], size: [1.0, 1.2], spawn: 0.8,
          vel: [0, 0, 0.5], jitter: 0.1, spin: 0.8,
          colors: [[0, p.main, 0], [0.2, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Half-Elf: two strands, one from each side of the family, weaving around each other.
  twinHeritage: {
    label: "Twin Heritage", icon: "fa-solid fa-handshake", sound: "charm",
    styles: {
      sunMoon: { label: "Sun & Moon", colors: ["#d8ecff", "#ffb84a", "#2a2440"] },
      leafFlame: { label: "Leaf & Flame", colors: ["#c8ffb0", "#ff7a3a", "#2a1a0a"] },
      seaSky: { label: "Sea & Sky", colors: ["#c8fff0", "#4a8aff", "#0a1a3a"] },
      roseIvy: { label: "Rose & Ivy", colors: ["#ffc8e0", "#5adf7a", "#1a2a1a"] }
    },
    build: p => ({
      auras: [{ color: mix(p.bright, p.main, 0.5), size: 2.4, alpha: 0.3, pulse: 0.1, pulseSpeed: 2 }],
      ribbons: [
        // One strand in each colour, out of phase
        { width: 0.8, time: 0.65, blend: "add", alpha: 0.9, colors: ["#ffffff", p.bright, mix(p.bright, p.dark, 0.5)],
          noiseAmt: 0.2, soft: 0.3, fadePow: 1.0, taper: 0.5, wave: { amp: 1.0, freq: 2.0, speed: 7 } },
        { width: 0.8, time: 0.65, blend: "add", alpha: 0.9, colors: ["#ffffff", p.main, mix(p.main, p.dark, 0.5)],
          noiseAmt: 0.2, soft: 0.3, fadePow: 1.0, taper: 0.5, wave: { amp: 1.0, freq: 2.0, speed: 7, phase: 3.14159 } }
      ],
      layers: [
        // Motes of one side ...
        { tex: "glow", blend: "add", rate: 20, rest: 0.4, life: [0.6, 1.1], size: [0.35, 0.1], spawn: 0.7,
          vel: [0, 0, 0.5], jitter: 0.3, inherit: -0.08, flicker: 0.4, colors: [[0, p.bright, 1], [1, p.bright, 0]] },
        // ... and of the other
        { tex: "glow", blend: "add", rate: 20, rest: 0.4, life: [0.6, 1.1], size: [0.35, 0.1], spawn: 0.7,
          vel: [0, 0, 0.5], jitter: 0.3, inherit: -0.08, flicker: 0.4, colors: [[0, p.main, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Half-Orc: Savage Attacks, with brutal slash marks off the die, flung droplets and a dark haze.
  savageStrike: {
    label: "Savage Strike", icon: "fa-solid fa-skull-crossbones", sound: "blade",
    styles: {
      blood: { label: "Blood", colors: ["#ffb0a8", "#c00a14", "#1a0002"] },
      steel: { label: "Steel", colors: ["#ffffff", "#a8b0bc", "#202428"] },
      bonecrusher: { label: "Bonecrusher", colors: ["#f0e8d0", "#a89a70", "#2a2010"] },
      venom: { label: "Venom", colors: ["#e8ffb0", "#7adf1a", "#0a1a04"] }
    },
    build: p => ({
      auras: [{ color: p.dark, size: 2.6, alpha: 0.5, pulse: 0.05, blend: "normal" }],
      layers: [
        // Brutal slash marks
        { tex: "slashes", blend: "add", rate: 7, rest: 0.1, life: [0.25, 0.4], size: [1.8, 2.6], spawn: 0.2,
          vel: [0, 0, 0], jitter: 0, inherit: 0.3,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.9], [1, p.main, 0]] },
        // Flung droplets
        { tex: "drops", blend: "normal", rate: 30, rest: 0.05, life: [0.5, 0.8], size: [0.4, 0.35], spawn: 0.4,
          vel: [0, 0, 2.4], jitter: 2.4, gravity: -10, drag: 0.8, spin: 4,
          colors: [[0, p.main, 1], [0.8, p.main, 0.9], [1, p.dark, 0]] },
        // A dark, heavy haze
        { tex: "smoke", blend: "normal", rate: 20, rest: 0.3, life: [0.9, 1.5], size: [0.8, 2.6], spawn: 0.4,
          vel: [0, 0, 0.3], jitter: 0.4, inherit: -0.08, drag: 0.6, spin: 0.5,
          colors: [[0, p.dark, 0], [0.15, p.dark, 0.6], [1, p.dark, 0]] }
      ]
    })
  },

  /* ---- Background trails: one for each D&D 5e (2024) background ---- */

  // Acolyte: thin curls of incense smoke, candle motes rising and a holy symbol glowing on the table.
  templeIncense: {
    label: "Temple Incense", icon: "fa-solid fa-place-of-worship", sound: "radiant",
    styles: {
      sandalwood: { label: "Sandalwood", colors: ["#fff4d0", "#ffc84a", "#5a3a1a"] },
      myrrh: { label: "Myrrh", colors: ["#ffe0c8", "#e0603a", "#3a1408"] },
      moonshrine: { label: "Moonshrine", colors: ["#ffffff", "#a8c8ff", "#2a3458"] },
      groveShrine: { label: "Grove Shrine", colors: ["#f0ffd8", "#7adf5a", "#1a3a14"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.4, alpha: 0.3, pulse: 0.1, pulseSpeed: 1.6 }],
      layers: [
        // Incense smoke curling up in thin threads
        { tex: "smoke", blend: "normal", rate: 22, rest: 0.6, life: [1.6, 2.4], size: [0.4, 2.2], spawn: 0.4,
          vel: [0, 0, 1.4], jitter: 0.2, inherit: -0.05, drag: 0.7, spin: 1.2, swirl: 1.4,
          colors: [[0, mix(p.bright, "#ffffff", 0.55), 0], [0.15, mix(p.bright, "#ffffff", 0.55), 0.35], [1, mix(p.bright, "#ffffff", 0.55), 0]] },
        // Candle motes
        { tex: "glow", blend: "add", rate: 30, rest: 0.4, life: [0.9, 1.5], size: [0.35, 0.1], spawn: 0.7,
          vel: [0, 0, 1.2], jitter: 0.3, drag: 0.8, flicker: 0.5,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.8], [1, p.main, 0]] },
        // A holy symbol glowing briefly beneath the die
        { tex: "glyphs", blend: "add", rate: 2.5, rest: 0.8, life: [0.9, 1.1], size: [1.6, 2.4], spawn: 0,
          vel: [0, 0, 0], jitter: 0, spin: 0.6, colors: [[0, p.bright, 0.8], [1, p.main, 0]] }
      ]
    })
  },

  // Artisan: curling shavings, sparks off the tools, sawdust and the glint of a finished piece.
  craftwork: {
    label: "Craftwork", icon: "fa-solid fa-hammer", sound: "stone",
    styles: {
      woodwright: { label: "Woodwright", colors: ["#ffe8c0", "#c88a4a", "#3a2410"] },
      smith: { label: "Smith", colors: ["#fff0c0", "#ff8a2a", "#2a2420"] },
      glassblower: { label: "Glassblower", colors: ["#e8ffff", "#3ad8e0", "#0a2a3a"] },
      potter: { label: "Potter", colors: ["#ffe0c8", "#c8603a", "#3a180a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.0, alpha: 0.2, pulse: 0.05 }],
      layers: [
        // Curled shavings tossed off the die
        { tex: "twirls", blend: "normal", rate: 18, rest: 0.05, life: [0.8, 1.2], size: [0.6, 0.5], spawn: 0.4,
          vel: [0, 0, 2.4], jitter: 1.6, inherit: -0.1, gravity: -7, drag: 0.6, spin: 8,
          colors: [[0, p.bright, 1], [0.5, p.main, 1], [1, p.main, 0]] },
        // Sparks off the tools
        { tex: "spark", blend: "add", rate: 45, rest: 0.03, life: [0.3, 0.55], size: [0.3, 0.08], spawn: 0.3,
          vel: [0, 0, 3], jitter: 3, inherit: 0.2, gravity: -12, drag: 0.7,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 1], [1, p.main, 0]] },
        // Sawdust
        { tex: "smoke", blend: "normal", rate: 10, rest: 0.1, life: [0.8, 1.3], size: [0.6, 2.0], spawn: 0.5,
          vel: [0, 0, 0.3], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, p.main, 0], [0.2, p.main, 0.3], [1, p.main, 0]] },
        // The glint of a finished piece
        { tex: "flares", blend: "add", rate: 5, rest: 0.3, life: [0.2, 0.4], size: [1.2, 0.2], spawn: 0.6,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Charlatan: shiny coins tumble off the die and vanish in a puff before anyone can count them.
  foolsGold: {
    label: "Fool's Gold", icon: "fa-solid fa-masks-theater", sound: "charm",
    styles: {
      foolsGold: { label: "Fool's Gold", colors: ["#fff4b0", "#ffc83a", "#5a2a6a"] },
      counterfeit: { label: "Counterfeit", colors: ["#ffffff", "#c8d0dc", "#3a2a4a"] },
      snakeOil: { label: "Snake Oil", colors: ["#e8ffb0", "#7adf3a", "#3a0a3a"] },
      masquerade: { label: "Masquerade", colors: ["#ffe0f8", "#ff5ad8", "#1a0a3a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.2, alpha: 0.3, pulse: 0.15, pulseSpeed: 4 }],
      layers: [
        // Coins that never land: they fade out mid-air
        { tex: "coins", blend: "normal", rate: 12, rest: 0.3, life: [0.6, 0.9], size: [0.6, 0.55], spawn: 0.4,
          vel: [0, 0, 2.2], jitter: 1.2, inherit: -0.08, gravity: -5, drag: 0.8, spin: 6,
          colors: [[0, p.bright, 1], [0.7, p.main, 1], [1, p.main, 0]] },
        // The puff they vanish into
        { tex: "smoke", blend: "normal", rate: 20, rest: 0.4, life: [0.6, 1.0], size: [0.4, 1.8], spawn: 0.6,
          vel: [0, 0, 0.8], jitter: 0.4, drag: 0.6, spin: 1,
          colors: [[0, p.dark, 0], [0.3, p.dark, 0.7], [1, p.dark, 0]] },
        // Glints
        { tex: "spark", blend: "add", rate: 16, rest: 0.4, life: [0.2, 0.45], size: [0.6, 0.1], spawn: 0.7,
          vel: [0, 0, 0], jitter: 0, spin: 1, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] },
        // A twirl of misdirection
        { tex: "twirls", blend: "add", rate: 4, rest: 0.4, life: [0.5, 0.7], size: [0.5, 1.6], spawn: 0.4,
          vel: [0, 0, 0], jitter: 0, spin: 7, colors: [[0, p.bright, 0.8], [1, p.main, 0]] }
      ]
    })
  },

  // Criminal: low gutter smoke, a thrown knife, the scrape of a lockpick and a purse spilling coins.
  backAlley: {
    label: "Back Alley", icon: "fa-solid fa-user-ninja", sound: "blade",
    styles: {
      cutpurse: { label: "Cutpurse", colors: ["#fff0b0", "#c8a03a", "#0c0a0e"] },
      smuggler: { label: "Smuggler", colors: ["#d8fff0", "#3aa8a0", "#06100e"] },
      fence: { label: "Fence", colors: ["#f0d8ff", "#8a5ab8", "#0a0610"] },
      thug: { label: "Thug", colors: ["#ffc8c0", "#b02a2a", "#0e0606"] }
    },
    build: p => ({
      auras: [{ color: p.dark, size: 2.6, alpha: 0.5, pulse: 0.05, blend: "normal" }],
      layers: [
        // Gutter smoke hugging the table
        { tex: "smoke", blend: "normal", rate: 35, rest: 0.4, life: [1.0, 1.6], size: [0.8, 2.8], spawn: 0.4,
          vel: [0, 0, 0.1], jitter: 0.5, inherit: -0.1, drag: 0.6, spin: 0.5,
          colors: [[0, p.dark, 0], [0.15, p.dark, 0.7], [1, p.dark, 0]] },
        // A thrown knife, tumbling
        { tex: "knives", blend: "normal", rate: 3, rest: 0, life: [0.5, 0.8], size: [0.9, 0.9], spawn: 0.3,
          vel: [0, 0, 2.4], jitter: 1.6, inherit: -0.2, gravity: -8, spin: 14,
          colors: [[0, p.bright, 1], [0.7, p.main, 0.9], [1, p.main, 0]] },
        // Lockpick glints
        { tex: "spark", blend: "add", rate: 12, rest: 0.2, life: [0.15, 0.3], size: [0.5, 0.1], spawn: 0.6,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] },
        // Coins spilling from a cut purse
        { tex: "coins", blend: "normal", rate: 6, rest: 0, life: [0.6, 0.9], size: [0.45, 0.45], spawn: 0.3,
          vel: [0, 0, 0.6], jitter: 0.6, gravity: -9, spin: 6,
          colors: [[0, p.bright, 1], [0.8, p.main, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Entertainer: curtain call, with confetti in three colours, spotlight rings and stage stars.
  showstopper: {
    label: "Showstopper", icon: "fa-solid fa-ticket", sound: "song",
    styles: {
      carnival: { label: "Carnival", colors: ["#ffe84a", "#ff4ad8", "#3ab8ff"] },
      opera: { label: "Opera", colors: ["#fff0c0", "#e02a3a", "#6a0a1a"] },
      jester: { label: "Jester", colors: ["#ffe0a0", "#3adf6a", "#a83aff"] },
      moonlitStage: { label: "Moonlit Stage", colors: ["#ffffff", "#a8c0ff", "#6a4ab8"] }
    },
    build: p => {
      // Confetti: the same flutter in each of the palette's three colours
      const confetti = c => ({ tex: "shard", blend: "normal", rate: 14, rest: 0.4, life: [1.0, 1.6], size: [0.35, 0.3], spawn: 0.5,
        vel: [0, 0, 2.6], jitter: 1.8, inherit: -0.08, gravity: -3, drag: 0.5, spin: 6, swirl: 0.6,
        colors: [[0, c, 1], [0.8, c, 1], [1, c, 0]] });
      return {
        auras: [{ color: p.main, size: 2.4, alpha: 0.3, pulse: 0.2, pulseSpeed: 4 }],
        layers: [
          confetti(p.bright), confetti(p.main), confetti(p.dark),
          // Spotlight rings
          { tex: "ring", blend: "add", rate: 4, rest: 0.3, life: [0.5, 0.7], size: [0.8, 3.6], spawn: 0,
            vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 0.8], [1, p.bright, 0]] },
          // Stage stars
          { tex: "stars", blend: "add", rate: 16, rest: 0.4, life: [0.3, 0.6], size: [0.6, 0.1], spawn: 0.8,
            vel: [0, 0, 0.2], jitter: 0.2, spin: 1, flicker: 0.6, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
        ]
      };
    }
  },

  // Farmer: chaff and seeds thrown up from a threshing floor, drifting in warm, dusty light.
  harvest: {
    label: "Harvest", icon: "fa-solid fa-wheat-awn", sound: "petals",
    styles: {
      wheat: { label: "Wheat", colors: ["#fff0b0", "#e0b04a", "#4a3010"] },
      orchard: { label: "Orchard", colors: ["#ffe0c0", "#e0402a", "#2a4a10"] },
      hayfield: { label: "Hayfield", colors: ["#f8f0d0", "#c8b878", "#3a3420"] },
      pumpkinPatch: { label: "Pumpkin Patch", colors: ["#ffe0a0", "#ff8a1a", "#2a3a10"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.2, alpha: 0.22, pulse: 0.05 }],
      layers: [
        // Chaff fluttering down
        { tex: "leaves", blend: "normal", rate: 20, rest: 0.4, life: [1.2, 1.8], size: [0.4, 0.35], spawn: 0.5,
          vel: [0, 0, 1.8], jitter: 1.2, inherit: -0.1, gravity: -2, drag: 0.45, spin: 5, swirl: 0.6,
          colors: [[0, p.main, 0], [0.1, p.main, 1], [0.7, p.main, 1], [1, p.dark, 0]] },
        // Seeds drifting in the light
        { tex: "glow", blend: "add", rate: 25, rest: 0.4, life: [0.9, 1.5], size: [0.22, 0.1], spawn: 0.7,
          vel: [0, 0, 0.8], jitter: 0.3, drag: 0.7, swirl: 0.4, colors: [[0, p.bright, 1], [1, p.bright, 0]] },
        // Dust from the threshing floor
        { tex: "smoke", blend: "normal", rate: 12, rest: 0.2, life: [0.9, 1.5], size: [0.8, 2.8], spawn: 0.5,
          vel: [0, 0, 0.2], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, p.bright, 0], [0.2, p.bright, 0.25], [1, p.bright, 0]] }
      ]
    })
  },

  // Guard: a lantern on the walls, with flickering warm light, a watchful sweep and glints of mail.
  nightWatch: {
    label: "Night Watch", icon: "fa-solid fa-tower-observation", sound: "ward",
    styles: {
      lantern: { label: "Lantern", colors: ["#fff0c0", "#ffb04a", "#2a1a08"] },
      cityWatch: { label: "City Watch", colors: ["#e8f4ff", "#5a9aff", "#0a1428"] },
      gatehouseTorch: { label: "Gatehouse Torch", colors: ["#ffe0a0", "#ff5a1a", "#2a0a04"] },
      moonwatch: { label: "Moonwatch", colors: ["#ffffff", "#c8d4e8", "#1a2030"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 3.0, alpha: 0.5, pulse: 0.15, pulseSpeed: 6, flicker: 0.3 }],
      layers: [
        // Lantern light rising off the die
        { tex: "glow", blend: "add", rate: 40, rest: 0.4, life: [0.6, 1.1], size: [0.45, 0.1], spawn: 0.5,
          vel: [0, 0, 1.6], jitter: 0.4, inherit: -0.06, drag: 0.7, flicker: 0.6,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 1], [1, p.main, 0]] },
        // A watchful sweep
        { tex: "ring", blend: "add", rate: 5, rest: 0.4, life: [0.6, 0.8], size: [0.6, 3.6], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.bright, 0.8], [1, p.main, 0]] },
        // Glints of mail
        { tex: "spark", blend: "add", rate: 12, rest: 0.2, life: [0.15, 0.3], size: [0.7, 0.1], spawn: 0.6,
          vel: [0, 0, 0], jitter: 0, spin: 2, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Guide: a guiding star circles the die and shows the way, with trail wind and leaves behind.
  pathfinder: {
    label: "Pathfinder", icon: "fa-solid fa-compass", sound: "stardust",
    styles: {
      northStar: { label: "North Star", colors: ["#ffffff", "#9ad0ff", "#1a2a5a"] },
      forestTrail: { label: "Forest Trail", colors: ["#f0ffd0", "#6ac83a", "#14300a"] },
      desertRoad: { label: "Desert Road", colors: ["#fff0c8", "#e0a84a", "#4a2a10"] },
      tundra: { label: "Tundra", colors: ["#ffffff", "#bfe8ff", "#3a5a7a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.2, alpha: 0.25, pulse: 0.05 }],
      ribbons: [
        // The trail wind
        { width: 0.9, time: 0.6, blend: "add", alpha: 0.5, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.5, noiseScale: [4, 2], scroll: 1.5, soft: 0.5, fadePow: 1.1, taper: 0.5,
          wave: { amp: 0.7, freq: 1.4, speed: 5 }, strip: { row: 2, repeat: 2, scroll: 2, mask: 0, glow: 0.5 } }
      ],
      layers: [
        // The guiding star circling the die
        { tex: "spark", blend: "add", rate: 3, rest: 1.0, life: [0.9, 1.2], size: [1.2, 0.8], spawn: 0,
          orbit: { radius: 1.6, speed: 5, rise: 0, flat: true }, spin: 1,
          colors: [[0, "#ffffff", 0], [0.1, "#ffffff", 1], [0.8, p.bright, 1], [1, p.bright, 0]] },
        // Leaves blown along the trail
        { tex: "leaves", blend: "normal", rate: 10, rest: 0.3, life: [1.2, 1.8], size: [0.5, 0.45], spawn: 0.5,
          vel: [0, 0, 0.8], jitter: 0.8, inherit: -0.1, gravity: -1.2, drag: 0.5, spin: 3,
          colors: [[0, p.main, 0], [0.1, p.main, 0.9], [1, p.dark, 0]] },
        // Motes
        { tex: "glow", blend: "add", rate: 20, rest: 0.4, life: [0.5, 1.0], size: [0.25, 0.1], spawn: 0.7,
          vel: [0, 0, 0.4], jitter: 0.3, flicker: 0.4, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Hermit: one small candle flame on the die, cold mist and a few fireflies keeping it company.
  loneCandle: {
    label: "Lone Candle", icon: "fa-solid fa-campground", sound: "smoke",
    styles: {
      candle: { label: "Candle", colors: ["#fff0c0", "#ffa84a", "#3a2a20"] },
      cave: { label: "Cave", colors: ["#e0f0ff", "#7a9ab8", "#141a20"] },
      mountain: { label: "Mountain", colors: ["#f8f0ff", "#b8a8e0", "#2a2438"] },
      marsh: { label: "Marsh", colors: ["#f0ffd0", "#9ac85a", "#1a2410"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.2, alpha: 0.45, pulse: 0.2, pulseSpeed: 9, flicker: 0.3 }],
      layers: [
        // The candle flame, riding on top of the die
        { tex: "flames", blend: "add", rate: 6, rest: 1.0, life: [0.25, 0.4], size: [0.8, 0.5], spawn: 0,
          orbit: { radius: 0, speed: 0, rise: 0.4, flat: true, lift: 1.1 },
          colors: [[0, "#ffffff", 0.9], [0.4, p.bright, 0.9], [1, p.main, 0]] },
        // Cold mist
        { tex: "smoke", blend: "normal", rate: 10, rest: 0.6, life: [1.8, 2.6], size: [1.2, 3.6], spawn: 0.6,
          vel: [0, 0, 0.1], jitter: 0.3, inherit: -0.04, drag: 0.6, spin: 0.3,
          colors: [[0, mix(p.bright, "#ffffff", 0.55), 0], [0.3, mix(p.bright, "#ffffff", 0.55), 0.18], [1, mix(p.bright, "#ffffff", 0.55), 0]] },
        // A few fireflies
        { tex: "glow", blend: "add", rate: 8, rest: 1.0, life: [1.4, 2.2], size: [0.3, 0.18], spawn: 1.1,
          vel: [0, 0, 0.3], jitter: 0.3, drag: 0.6, flicker: 0.85, swirl: 0.6,
          colors: [[0, p.bright, 0], [0.2, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Merchant: business is good, coins spill and bounce off the die, catching the light as they spin.
  coinShower: {
    label: "Coin Shower", icon: "fa-solid fa-coins", sound: "stardust",
    styles: {
      gold: { label: "Gold", colors: ["#fff8c0", "#ffc83a", "#5a3a08"] },
      silver: { label: "Silver", colors: ["#ffffff", "#c8d0dc", "#3a404a"] },
      copper: { label: "Copper", colors: ["#ffe0c8", "#d8783a", "#3a1a08"] },
      platinum: { label: "Platinum", colors: ["#ffffff", "#d8e8f0", "#4a5a6a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.4, alpha: 0.3, pulse: 0.1, pulseSpeed: 3 }],
      layers: [
        // Coins spilling up and out
        { tex: "coins", blend: "normal", rate: 26, rest: 0.1, life: [0.8, 1.3], size: [0.55, 0.5], spawn: 0.4,
          vel: [0, 0, 3.2], jitter: 1.8, inherit: -0.1, gravity: -11, drag: 0.85, spin: 9,
          colors: [[0, p.bright, 1], [0.85, p.main, 1], [1, p.main, 0]] },
        // Light catching them
        { tex: "spark", blend: "add", rate: 20, rest: 0.3, life: [0.2, 0.4], size: [0.7, 0.1], spawn: 0.7,
          vel: [0, 0, 0], jitter: 0, spin: 1.5, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Noble: a velvet streak in house colours edged with gold thread, trailing gold dust and sparkle.
  nobleCrest: {
    label: "Noble Crest", icon: "fa-solid fa-crown", sound: "charm",
    styles: {
      royal: { label: "Royal", colors: ["#ffe08a", "#8a3aff", "#1a0a3a"] },
      imperial: { label: "Imperial", colors: ["#ffe08a", "#d0203a", "#3a0410"] },
      silverCourt: { label: "Silver Court", colors: ["#ffffff", "#4a7ad8", "#0a1a3a"] },
      emeraldCourt: { label: "Emerald Court", colors: ["#ffe8a0", "#1aa860", "#062a18"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.4, alpha: 0.3, pulse: 0.08, pulseSpeed: 1.6 }],
      ribbons: [
        // The velvet streak in the house colour
        { width: 2.0, time: 0.6, blend: "normal", alpha: 0.75, colors: [p.main, mix(p.main, p.dark, 0.5), p.dark],
          noiseAmt: 0.2, soft: 0.5, fadePow: 1.1, taper: 0.5, wave: { amp: 0.3, freq: 0.8, speed: 3 } },
        // Gold thread along it
        { width: 0.35, time: 0.6, blend: "add", alpha: 0.9, colors: ["#ffffff", p.bright, mix(p.bright, p.main, 0.5)],
          noiseAmt: 0.05, soft: 0.2, fadePow: 0.9, taper: 0.5, sparkle: 0.4, wave: { amp: 0.3, freq: 0.8, speed: 3 } }
      ],
      layers: [
        // Gold dust settling
        { tex: "glow", blend: "add", rate: 35, rest: 0.4, life: [0.8, 1.4], size: [0.22, 0.08], spawn: 0.7,
          vel: [0, 0, 0.3], jitter: 0.3, gravity: -0.5, drag: 0.7, flicker: 0.4,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 1], [1, p.bright, 0]] },
        // Courtly sparkle
        { tex: "stars", blend: "add", rate: 8, rest: 0.4, life: [0.3, 0.6], size: [0.7, 0.1], spawn: 0.8,
          vel: [0, 0, 0], jitter: 0.1, spin: 1, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Sage: the die draws a constellation, a thin chart line pinned with stars, and an astrolabe ring.
  starChart: {
    label: "Star Chart", icon: "fa-solid fa-book-atlas", sound: "stardust",
    styles: {
      astronomer: { label: "Astronomer", colors: ["#ffffff", "#7ab0ff", "#1a2458"] },
      archivist: { label: "Archivist", colors: ["#fff4d0", "#e0b05a", "#3a2a14"] },
      seer: { label: "Seer", colors: ["#f4e0ff", "#b07aff", "#2a1048"] },
      naturalist: { label: "Naturalist", colors: ["#e8ffe8", "#5adfa0", "#0a3024"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.2, alpha: 0.25, pulse: 0.05 }],
      ribbons: [
        // The chart line, long and thin
        { width: 0.18, time: 1.1, blend: "add", alpha: 0.7, colors: ["#ffffff", p.bright, p.main],
          noiseAmt: 0, soft: 0.2, fadePow: 1.0, taper: 0.2 }
      ],
      layers: [
        // Stars pinned along the line, left where the die passed
        { tex: "spark", blend: "add", rate: 9, rest: 0.4, life: [1.1, 1.5], size: [0.7, 0.35], spawn: 0.05,
          vel: [0, 0, 0], jitter: 0, spin: 0.3, flicker: 0.25,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 1], [1, p.main, 0]] },
        // Faint background stars
        { tex: "glow", blend: "add", rate: 20, rest: 0.4, life: [0.8, 1.4], size: [0.2, 0.08], spawn: 1.0,
          vel: [0, 0, 0], jitter: 0.1, flicker: 0.6, colors: [[0, p.bright, 1], [1, p.main, 0]] },
        // An astrolabe ring now and then
        { tex: "glyphs", blend: "add", rate: 1.5, rest: 0.6, life: [0.9, 1.1], size: [2.0, 2.6], spawn: 0,
          vel: [0, 0, 0], jitter: 0, spin: 0.5, colors: [[0, p.main, 0.7], [1, p.main, 0]] }
      ]
    })
  },

  // Sailor: salt spray flung off a bow wave, foam bubbles and a sea-wind streak rolling behind the die.
  seaSpray: {
    label: "Sea Spray", icon: "fa-solid fa-anchor", sound: "tide",
    styles: {
      openSea: { label: "Open Sea", colors: ["#ffffff", "#3a9ae0", "#0a2a4a"] },
      tropic: { label: "Tropic", colors: ["#f0fffa", "#2ad8c8", "#064048"] },
      stormSea: { label: "Storm Sea", colors: ["#e8eef4", "#6a8098", "#141c24"] },
      pirate: { label: "Pirate", colors: ["#fff0c0", "#2a8a8a", "#0a1414"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.4, alpha: 0.25, pulse: 0.1, pulseSpeed: 2 }],
      ribbons: [
        // The rolling sea-wind streak
        { width: 1.6, time: 0.6, blend: "add", alpha: 0.45, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.8, noiseScale: [5, 2], scroll: 2, soft: 0.6, fadePow: 1.1, taper: 0.4,
          wave: { amp: 0.8, freq: 1.4, speed: 6 } }
      ],
      layers: [
        // Salt spray
        { tex: "drops", blend: "add", rate: 40, rest: 0.05, life: [0.5, 0.8], size: [0.3, 0.25], spawn: 0.4,
          vel: [0, 0, 2.6], jitter: 2.2, inherit: -0.15, gravity: -10, drag: 0.8, spin: 2,
          colors: [[0, "#ffffff", 0.9], [0.4, p.bright, 0.8], [1, p.main, 0]] },
        // Foam bubbles
        { tex: "bubbles", blend: "add", rate: 16, rest: 0.4, life: [0.7, 1.2], size: [0.25, 0.5], spawn: 0.6,
          vel: [0, 0, 0.6], jitter: 0.3, drag: 0.7, swirl: 0.6,
          colors: [[0, "#ffffff", 0], [0.1, "#ffffff", 0.8], [1, p.bright, 0]] },
        // Sea mist
        { tex: "smoke", blend: "normal", rate: 8, rest: 0.2, life: [0.8, 1.3], size: [0.8, 2.4], spawn: 0.5,
          vel: [0, 0, 0.2], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.bright, "#ffffff", 0.55), 0], [0.2, mix(p.bright, "#ffffff", 0.55), 0.25], [1, mix(p.bright, "#ffffff", 0.55), 0]] }
      ]
    })
  },

  // Scribe: a quill stroke in ink follows the die, flicking droplets and blooming blots, with a glint of gilding.
  inkBlot: {
    label: "Ink Blot", icon: "fa-solid fa-feather-pointed", sound: "needle",
    styles: {
      ironGall: { label: "Iron Gall", colors: ["#c8d0f0", "#3a4a7a", "#06080e"] },
      sepia: { label: "Sepia", colors: ["#f0dcc0", "#8a5a2a", "#1a1008"] },
      vermilion: { label: "Vermilion", colors: ["#ffd0c0", "#d02a1a", "#2a0604"] },
      goldLeaf: { label: "Gold Leaf", colors: ["#fff4c0", "#d8a83a", "#2a1e08"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.0, alpha: 0.2, pulse: 0.05, blend: "normal" }],
      ribbons: [
        // The quill stroke, drawn in ink rather than light
        { width: 0.6, time: 0.7, blend: "normal", alpha: 0.9, colors: [p.main, p.main, p.dark],
          noiseAmt: 0.15, soft: 0.25, fadePow: 1.0, taper: 0.7, wave: { amp: 0.3, freq: 0.6, speed: 2 } }
      ],
      layers: [
        // Flicked droplets
        { tex: "drops", blend: "normal", rate: 30, rest: 0.05, life: [0.5, 0.8], size: [0.35, 0.3], spawn: 0.4,
          vel: [0, 0, 2.2], jitter: 2.0, gravity: -10, drag: 0.8, spin: 3,
          colors: [[0, p.main, 1], [0.8, p.main, 0.9], [1, p.dark, 0]] },
        // Blots blooming where the ink lands
        { tex: "smoke", blend: "normal", rate: 14, rest: 0.2, life: [0.6, 1.0], size: [0.3, 1.4], spawn: 0.5,
          vel: [0, 0, 0], jitter: 0.2, inherit: -0.04, spin: 0.4,
          colors: [[0, p.main, 0.8], [1, p.dark, 0]] },
        // A glint of gilding
        { tex: "spark", blend: "add", rate: 10, rest: 0.2, life: [0.2, 0.4], size: [0.5, 0.1], spawn: 0.6,
          vel: [0, 0, 0], jitter: 0, colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Soldier: a regimental banner snapping behind the die, drumbeat rings, marching dust and embers.
  warBanner: {
    label: "War Banner", icon: "fa-solid fa-chess-rook", sound: "thunder",
    styles: {
      legion: { label: "Legion", colors: ["#ffe08a", "#c0202a", "#2a0408"] },
      ironGuard: { label: "Iron Guard", colors: ["#e8f0ff", "#5a7aa8", "#141a24"] },
      mercenary: { label: "Mercenary", colors: ["#ffd8a0", "#e0701a", "#141010"] },
      highland: { label: "Highland", colors: ["#f0ffe0", "#2a8a4a", "#0a1a10"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.4, alpha: 0.25, pulse: 0.2, pulseSpeed: 4 }],
      ribbons: [
        // The banner: wide cloth in the regiment's colour, snapping in the wind
        { width: 2.4, time: 0.6, blend: "normal", alpha: 0.85, colors: [p.main, p.main, mix(p.main, p.dark, 0.5)],
          noiseAmt: 0.15, soft: 0.3, fadePow: 1.0, taper: 0.2, wave: { amp: 0.6, freq: 1.6, speed: 8 } },
        // Its gold edging
        { width: 0.25, time: 0.6, blend: "add", alpha: 0.9, colors: [p.bright, p.bright, p.main],
          noiseAmt: 0, soft: 0.2, fadePow: 1.0, taper: 0.2, wave: { amp: 0.6, freq: 1.6, speed: 8 } }
      ],
      layers: [
        // Marching dust
        { tex: "smoke", blend: "normal", rate: 14, rest: 0.1, life: [0.8, 1.3], size: [0.8, 2.6], spawn: 0.5,
          vel: [0, 0, 0.2], jitter: 0.4, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.dark, "#5a5248", 0.5), 0], [0.2, mix(p.dark, "#5a5248", 0.5), 0.45], [1, p.dark, 0]] },
        // Drumbeat rings
        { tex: "ring", blend: "add", rate: 3.5, rest: 0.2, life: [0.45, 0.55], size: [1.0, 4.2], spawn: 0,
          vel: [0, 0, 0], jitter: 0, colors: [[0, p.bright, 0.9], [1, p.main, 0]] },
        // Embers
        { tex: "glow", blend: "add", rate: 25, rest: 0.2, life: [0.5, 0.9], size: [0.3, 0.1], spawn: 0.6,
          vel: [0, 0, 1.4], jitter: 0.4, flicker: 0.5, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  // Wayfarer: life on the road, with dust kicked up by every bounce, pebbles, a blown leaf and warm motes.
  dustyRoad: {
    label: "Dusty Road", icon: "fa-solid fa-road", sound: "stone",
    styles: {
      sunset: { label: "Sunset", colors: ["#ffe0b0", "#e08a4a", "#4a2a2a"] },
      autumnRoad: { label: "Autumn Road", colors: ["#ffe8b0", "#c8702a", "#3a2010"] },
      rainyRoad: { label: "Rainy Road", colors: ["#e0eef8", "#7a8ea0", "#1a222a"] },
      nightRoad: { label: "Night Road", colors: ["#e8e8ff", "#6a6aa8", "#10101e"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.0, alpha: 0.2, pulse: 0.05 }],
      layers: [
        // Road dust
        { tex: "smoke", blend: "normal", rate: 24, rest: 0.1, life: [1.0, 1.6], size: [1.0, 3.4], spawn: 0.5,
          vel: [0, 0, 0.3], jitter: 0.5, inherit: -0.08, drag: 0.6, spin: 0.5,
          colors: [[0, mix(p.dark, "#5a5248", 0.5), 0], [0.2, mix(p.dark, "#5a5248", 0.5), 0.5], [1, p.dark, 0]] },
        // Pebbles
        { tex: "debris", blend: "normal", rate: 10, rest: 0, life: [0.6, 0.9], size: [0.5, 0.4], spawn: 0.4,
          vel: [0, 0, 2.4], jitter: 1.6, gravity: -10, drag: 0.8, spin: 6,
          colors: [[0, mix(p.dark, "#6a6458", 0.5), 1], [0.8, mix(p.dark, "#3a3630", 0.5), 0.95], [1, p.dark, 0]] },
        // A leaf blown along
        { tex: "leaves", blend: "normal", rate: 5, rest: 0.2, life: [1.2, 1.8], size: [0.5, 0.45], spawn: 0.5,
          vel: [0, 0, 0.8], jitter: 0.8, inherit: -0.1, gravity: -1.2, drag: 0.5, spin: 3,
          colors: [[0, p.main, 0], [0.1, p.main, 1], [1, p.dark, 0]] },
        // Warm evening motes
        { tex: "glow", blend: "add", rate: 18, rest: 0.4, life: [0.8, 1.4], size: [0.25, 0.1], spawn: 0.7,
          vel: [0, 0, 0.5], jitter: 0.3, flicker: 0.5, colors: [[0, p.bright, 1], [1, p.main, 0]] }
      ]
    })
  },

  /* Damage types: the trails damage dice wear (dice-trails.js EFFECTS), also offered as designs. */

  // Fire damage: licking flame tongues and a white-hot core, with embers that swirl up and drift away.
  emberstorm: {
    label: "Emberstorm", icon: "fa-solid fa-fire", sound: "fire",
    styles: {
      fire: { label: "Fire", colors: ["#fff1a8", "#ff6a10", "#8a1000"] },
      cinder: { label: "Cinder", colors: ["#ffc890", "#d8300a", "#3a0604"] },
      bluefire: { label: "Blue Flame", colors: ["#e6f8ff", "#3a9cff", "#0a1a6a"] },
      sulfur: { label: "Sulfur", colors: ["#fffbc0", "#e8c010", "#5a1a6a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.0, alpha: 0.55, pulse: 0.14, pulseSpeed: 9, flicker: 0.3 }],
      layers: [
        // Flame tongues that lick up off the die and cool as they fall behind
        { tex: "flames", blend: "add", rate: 60, rest: 0.25, life: [0.35, 0.7], size: [1.6, 0.6], spawn: 0.4,
          vel: [0, 0, 2.2], jitter: 0.4, inherit: -0.05, drag: 0.6, flicker: 0.2, spin: 0.6,
          colors: [[0, mix(p.bright, "#ffffff", 0.5), 0.95], [0.3, p.bright, 0.85], [0.65, p.main, 0.5], [1, p.dark, 0]] },
        // A white-hot core around the die
        { tex: "glow", blend: "add", rate: 40, rest: 0.2, life: [0.15, 0.3], size: [1.5, 0.7], spawn: 0.2,
          vel: [0, 0, 0.4], jitter: 0.2, drag: 0.5,
          colors: [[0, "#ffffff", 0.9], [0.5, p.bright, 0.6], [1, p.main, 0]] },
        // Embers that swirl up, flicker and fade far behind the die
        { tex: "spark", blend: "add", rate: 45, rest: 0.5, life: [2.0, 3.0], size: [0.4, 0.32], spawn: 0.6,
          vel: [0, 0, 2.6], jitter: 1.4, drag: 0.75, swirl: 0.8, flicker: 0.6,
          colors: linger([[0, "#ffffff", 1], [0.3, p.bright, 0.95], [0.7, p.main, 0.7], [1, p.dark, 0]]) },
        // Dark smoke rising behind
        { tex: "smoke", blend: "normal", rate: 10, rest: 0.3, life: [2.0, 3.0], size: [0.8, 2.6], spawn: 0.4,
          vel: [0, 0, 2.0], jitter: 0.4, drag: 0.6, spin: 0.6,
          colors: linger([[0, "#2a1c12", 0], [0.3, mix(p.dark, "#1a1414", 0.7), 0.32], [1, "#101010", 0]]) }
      ]
    })
  },

  // Cold damage: icy shards flung off and falling, snowflakes spinning down through a freezing mist.
  hoarfrost: {
    label: "Hoarfrost", icon: "fa-solid fa-snowflake", sound: "frost",
    styles: {
      frost: { label: "Frost", colors: ["#f0fcff", "#8fdcff", "#1f5fb8"] },
      glacier: { label: "Glacier", colors: ["#e0fff8", "#3fd0c0", "#06404a"] },
      rime: { label: "Rime", colors: ["#ffffff", "#c8d8e8", "#4a5a70"] },
      permafrost: { label: "Permafrost", colors: ["#f0eaff", "#9a8cff", "#2a1a7a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 3.0, alpha: 0.45, pulse: 0.06 }],
      layers: [
        // Freezing mist that hangs behind the die
        { tex: "smoke", blend: "add", rate: 18, rest: 0.5, life: [2.0, 3.0], size: [1.0, 2.8], spawn: 0.5,
          vel: [0, 0, 0.3], jitter: 0.3, drag: 0.5, spin: 0.4,
          colors: linger([[0, p.bright, 0], [0.3, p.main, 0.3], [1, p.dark, 0]]) },
        // Ice shards flung off, tumbling down to the table
        { tex: "shard", blend: "add", rate: 40, rest: 0.3, life: [0.5, 1.0], size: [0.7, 0.25], spawn: 0.6,
          vel: [0, 0, 1.2], jitter: 2.0, gravity: -8, drag: 0.7, spin: 6, flicker: 0.3,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.95], [1, p.main, 0]] },
        // Snowflakes that spin slowly down
        { tex: "snowflakes", blend: "add", rate: 12, rest: 0.6, life: [2.0, 3.0], size: [0.7, 0.56], spawn: 0.9,
          vel: [0, 0, 0.4], jitter: 0.6, gravity: -1.2, drag: 0.6, spin: 1.5,
          colors: linger([[0, "#ffffff", 0], [0.15, "#ffffff", 0.95], [0.7, p.bright, 0.7], [1, p.main, 0]]) },
        // Frost glints
        { tex: "spark", blend: "add", rate: 20, rest: 0.6, life: [0.2, 0.45], size: [0.9, 0.1], spawn: 0.8,
          jitter: 0.2, flicker: 0.4,
          colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Lightning damage: a jagged bolt trails the die and pulls back into it when it lands; arcs and sparks.
  staticSurge: {
    label: "Static Surge", icon: "fa-solid fa-bolt", sound: "lightning",
    styles: {
      storm: { label: "Storm", colors: ["#e6f4ff", "#4f9cff", "#1a2aa8"] },
      plasma: { label: "Plasma", colors: ["#f6e6ff", "#b86aff", "#3a0a8a"] },
      ion: { label: "Ion", colors: ["#e6fff8", "#3affc8", "#045a4a"] },
      sunstrike: { label: "Sunstrike", colors: ["#fffbe0", "#ffd02a", "#8a4a00"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.6, pulse: 0.05, flicker: 0.7 }],
      arcs: [{ color: p.bright, every: 0.05, count: 3, reach: [1.4, 3.0], restCount: 1 }],
      ribbons: [
        // Electric glow around the bolt
        { width: 2.2, time: 0.8, blend: "add", alpha: 0.55, colors: [p.bright, p.main, p.dark],
          noiseAmt: 0.4, noiseScale: [10, 2], scroll: 8, soft: 0.5, fadePow: 0.9, taper: 0.5,
          bands: 7, bandAmt: 0.15, bandSpeed: 12, flicker: 0.6,
          strip: { row: 0, repeat: 1.2, scroll: 5, mask: 0.3, glow: 1.4 } },
        // The jagged bolt: it follows the die's path, so it shrinks back into the die when it stops
        { width: 0.4, time: 0.8, blend: "add", alpha: 1, colors: ["#ffffff", mix(p.bright, "#ffffff", 0.5), p.main],
          core: "#ffffff", coreAmt: 1, noiseAmt: 0.1, soft: 0.25, fadePow: 0.7, taper: 0.4, jag: 1.3, flicker: 0.35 }
      ],
      layers: [
        // Crackling bolts that flash around the die
        { tex: "bolts", blend: "add", rate: 50, rest: 0.3, life: [0.06, 0.14], size: [1.6, 1.1], spawn: 0.5,
          jitter: 1.2, drag: 0.1, flicker: 0.6,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.9], [1, p.main, 0]] },
        // Hot sparks spraying off and dropping
        { tex: "spark", blend: "add", rate: 60, rest: 0.2, life: [0.15, 0.4], size: [0.5, 0.1], spawn: 0.3,
          jitter: 4.0, gravity: -6, drag: 0.3, flicker: 0.5,
          colors: [[0, "#ffffff", 1], [0.4, p.bright, 0.9], [1, p.main, 0]] },
        // A flickering charge on the die
        { tex: "glow", blend: "add", rate: 30, rest: 0.4, life: [0.1, 0.25], size: [1.3, 0.4], spawn: 0.2,
          flicker: 0.7,
          colors: [[0, "#ffffff", 0.9], [1, p.main, 0]] },
        // The ionised path left behind, glowing as it fades
        { tex: "glow", blend: "add", rate: 70, rest: 0, life: [2.0, 3.0], size: [0.7, 0.56], spawn: 0.15,
          flicker: 0.5,
          colors: linger([[0, "#ffffff", 0.9], [0.15, p.bright, 0.7], [0.5, p.main, 0.4], [1, p.dark, 0]]) },
        // Crackles still jumping along it
        { tex: "spark", blend: "add", rate: 22, rest: 0, life: [2.0, 3.0], size: [0.7, 0.56], spawn: 0.35,
          flicker: 0.9,
          colors: linger([[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]]) }
      ]
    })
  },

  // Thunder damage: a dark storm cloud lit by flashes from inside, with shockwaves booming off the die.
  thunderhead: {
    label: "Thunderhead", icon: "fa-solid fa-cloud-bolt", sound: "thunder",
    styles: {
      thunder: { label: "Thunder", colors: ["#d8daff", "#5a5dff", "#16123a"] },
      tempest: { label: "Tempest", colors: ["#e0f4f8", "#4aa0b8", "#0e2228"] },
      roar: { label: "Roar", colors: ["#fff0d0", "#ff9a2a", "#2a1408"] },
      sonic: { label: "Sonic", colors: ["#ffffff", "#9af0ff", "#1a3a5a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.45, pulse: 0.35, pulseSpeed: 10 }],
      layers: [
        // The storm cloud, dragged along behind the die
        { tex: "smoke", blend: "normal", rate: 18, rest: 0.5, life: [2.0, 3.0], size: [1.0, 3], spawn: 0.5,
          vel: [0, 0, 0.6], jitter: 0.5, drag: 0.6, spin: 0.8,
          colors: linger([[0, p.dark, 0], [0.25, mix(p.dark, p.main, 0.25), 0.6], [1, mix(p.dark, "#000000", 0.5), 0]]) },
        // Flashes inside the cloud
        { tex: "glow", blend: "add", rate: 8, rest: 0.3, life: [0.05, 0.12], size: [2.5, 3.0], spawn: 0.8,
          flicker: 0.8,
          colors: [[0, "#ffffff", 0.8], [1, p.bright, 0]] },
        // Big shockwaves booming off the die
        { tex: "ring", blend: "add", rate: 6, rest: 0.4, life: [0.35, 0.5], size: [0.6, 6.0], spawn: 0,
          colors: [[0, "#ffffff", 1], [0.35, p.bright, 0.6], [1, p.main, 0]] },
        // Quick inner ripples
        { tex: "ring", blend: "add", rate: 12, rest: 0.2, life: [0.2, 0.3], size: [0.4, 2.5], spawn: 0,
          colors: [[0, p.bright, 0.7], [1, p.main, 0]] }
      ]
    })
  },

  // Acid damage: glowing drops dripping off the die, popping bubbles and caustic fumes.
  corrosion: {
    label: "Corrosion", icon: "fa-solid fa-flask-vial", sound: "acid",
    styles: {
      acid: { label: "Acid", colors: ["#f6ffa0", "#b8ff1a", "#3a6a00"] },
      bile: { label: "Bile", colors: ["#fff4b0", "#e8b81a", "#5a3a00"] },
      ooze: { label: "Ooze", colors: ["#f8e0ff", "#c04dff", "#3a0a5a"] },
      caustic: { label: "Caustic", colors: ["#e0fff8", "#2ae8c8", "#04483a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.8, alpha: 0.45, pulse: 0.12 }],
      layers: [
        // Drops that drip off and fall to the table
        { tex: "drops", blend: "add", rate: 40, rest: 0.3, life: [0.5, 0.9], size: [0.5, 0.35], spawn: 0.5,
          vel: [0, 0, 0.8], jitter: 0.8, gravity: -12, drag: 0.8,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.95], [1, p.dark, 0]] },
        // Bubbles that swell and pop
        { tex: "bubbles", blend: "add", rate: 18, rest: 0.8, life: [0.4, 0.9], size: [0.25, 0.6], spawn: 0.7,
          vel: [0, 0, 0.6], jitter: 0.4, drag: 0.5, flicker: 0.2,
          colors: [[0, p.bright, 0.4], [0.85, p.main, 0.9], [1, p.bright, 0]] },
        // Caustic fumes
        { tex: "smoke", blend: "normal", rate: 12, rest: 0.5, life: [2.0, 3.0], size: [0.6, 2.2], spawn: 0.4,
          vel: [0, 0, 1.2], jitter: 0.3, drag: 0.6, spin: 1,
          colors: linger([[0, p.main, 0], [0.3, mix(p.dark, p.main, 0.4), 0.35], [1, p.dark, 0]]) },
        // A sizzling glow on the die
        { tex: "glow", blend: "add", rate: 30, rest: 0.2, life: [0.15, 0.3], size: [1.1, 0.5], spawn: 0.3,
          flicker: 0.3,
          colors: [[0, p.bright, 0.8], [1, p.main, 0]] },
        // A glowing smear left on the die's path
        { tex: "glow", blend: "add", rate: 35, rest: 0, life: [2.0, 3.0], size: [0.6, 0.48], spawn: 0.3,
          flicker: 0.2,
          colors: linger([[0, p.bright, 0.6], [0.4, p.main, 0.4], [1, p.dark, 0]]) }
      ]
    })
  },

  // Poison damage: a thick toxic cloud that curls and lingers, full of glowing spores.
  miasma: {
    label: "Miasma", icon: "fa-solid fa-skull-crossbones", sound: "poison",
    styles: {
      venom: { label: "Venom", colors: ["#c8ff7a", "#3ab82a", "#3a1a5a"] },
      nightshade: { label: "Nightshade", colors: ["#f0c8ff", "#8a3ad8", "#1a0a2a"] },
      toxin: { label: "Toxin", colors: ["#f4ffa0", "#a8d81a", "#2a3a08"] },
      blight: { label: "Blight", colors: ["#e0e8a0", "#7a8a3a", "#2a2010"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.4, alpha: 0.5, pulse: 0.18, pulseSpeed: 2 }],
      layers: [
        // The toxic cloud, thick and curling as it lingers
        { tex: "smoke", blend: "normal", rate: 32, rest: 0.8, life: [2.0, 3.0], size: [1.0, 3.4], spawn: 0.5,
          vel: [0, 0, 0.4], jitter: 0.3, drag: 0.55, swirl: 0.6, spin: 0.5,
          colors: linger([[0, p.main, 0], [0.2, p.main, 0.7], [0.7, mix(p.main, p.dark, 0.5), 0.55], [1, p.dark, 0]]) },
        // A sickly glow inside the cloud
        { tex: "smoke", blend: "add", rate: 14, rest: 0.6, life: [2.0, 3.0], size: [0.8, 2.4], spawn: 0.4,
          vel: [0, 0, 0.3], jitter: 0.2, drag: 0.55, swirl: 0.6, spin: 0.4,
          colors: linger([[0, p.bright, 0], [0.2, p.main, 0.35], [1, p.dark, 0]]) },
        // Glowing spores drifting in it
        { tex: "glow", blend: "add", rate: 30, rest: 0.8, life: [2.0, 3.0], size: [0.35, 0.28], spawn: 1.0,
          vel: [0, 0, 0.3], jitter: 0.3, drag: 0.5, swirl: 0.8, flicker: 0.4,
          colors: linger([[0, p.bright, 0], [0.15, p.bright, 0.95], [1, p.main, 0]]) },
        // Sickly bubbles
        { tex: "bubbles", blend: "add", rate: 8, rest: 0.6, life: [0.6, 1.0], size: [0.3, 0.5], spawn: 0.6,
          vel: [0, 0, 0.8], jitter: 0.3, drag: 0.6,
          colors: [[0, p.bright, 0.6], [0.8, p.main, 0.6], [1, p.bright, 0]] }
      ]
    })
  },

  // Necrotic damage: a black shroud trailing the die, ghost-flames and spectral skulls, souls drawn in.
  graveShroud: {
    label: "Grave Shroud", icon: "fa-solid fa-skull", sound: "necrotic",
    styles: {
      necrotic: { label: "Necrotic", colors: ["#c8ffe0", "#3affa0", "#003a2a"] },
      wraith: { label: "Wraith", colors: ["#eaf4ff", "#8ab8ff", "#0a1a3a"] },
      bloodmoon: { label: "Blood Moon", colors: ["#ffd0c8", "#ff2a3a", "#2a0008"] },
      void: { label: "Void", colors: ["#f0d8ff", "#9a3aff", "#10002a"] }
    },
    build: p => ({
      auras: [{ color: "#050008", size: 3.4, alpha: 0.7, pulse: 0.12, pulseSpeed: 2.5, blend: "normal",
                inner: { color: p.main, size: 1.4, alpha: 0.35 } }],
      layers: [
        // The black shroud trailing behind
        { tex: "smoke", blend: "normal", rate: 22, rest: 0.6, life: [2.0, 3.0], size: [1.2, 2.6], spawn: 0.4,
          vel: [0, 0, 0.3], inherit: -0.06, jitter: 0.3, drag: 0.6, spin: 0.7,
          colors: linger([[0, "#000000", 0], [0.25, mix(p.dark, "#000000", 0.4), 0.75], [1, "#000000", 0]]) },
        // Ghost-light left glowing in the shroud along the die's path
        { tex: "glow", blend: "add", rate: 45, rest: 0, life: [2.0, 3.0], size: [0.9, 0.75], spawn: 0.3,
          vel: [0, 0, 0.2], jitter: 0.15, drag: 0.5, flicker: 0.25,
          colors: linger([[0, p.bright, 0.8], [0.3, p.main, 0.55], [1, p.dark, 0]]) },
        // Ghost-flames licking off the die
        { tex: "flames", blend: "add", rate: 30, rest: 0.4, life: [0.3, 0.6], size: [1.2, 0.5], spawn: 0.4,
          vel: [0, 0, 1.6], jitter: 0.3, drag: 0.6, flicker: 0.3,
          colors: [[0, p.bright, 0.9], [0.4, p.main, 0.7], [1, p.dark, 0]] },
        // Spectral skulls rising slowly and lingering before they fade
        { tex: "skulls", blend: "add", rate: 4, rest: 0.6, life: [2.0, 3.0], size: [1.1, 1.4], spawn: 0.4,
          vel: [0, 0, 0.6], jitter: 0.2, drag: 0.6,
          colors: linger([[0, p.bright, 0], [0.2, p.main, 0.65], [1, p.dark, 0]]) },
        // Souls drawn in to the die
        { tex: "glow", blend: "add", rate: 14, rest: 1.0, life: [0.6, 1.0], size: [0.35, 0.1], spawn: { ring: 2.0 },
          jitter: 0.1, inward: 1.8, swirl: 2.0,
          colors: [[0, p.main, 0], [0.3, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  // Radiant damage: a sunlit halo and blazing core, with star glints and motes of light rising.
  sunburst: {
    label: "Sunburst", icon: "fa-solid fa-sun", sound: "radiant",
    styles: {
      radiant: { label: "Radiant", colors: ["#fffbe0", "#ffd84a", "#c06a00"] },
      dawn: { label: "Dawn", colors: ["#fff0ea", "#ffa88a", "#8a2a3a"] },
      celestial: { label: "Celestial", colors: ["#ffffff", "#bfe0ff", "#3a5aa8"] },
      solar: { label: "Solar", colors: ["#fff4c8", "#ff9a1a", "#7a2000"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 4.0, alpha: 0.7, pulse: 0.15, pulseSpeed: 4 }],
      layers: [
        // A halo that stays on the die
        { tex: "ring", blend: "add", rate: 3, rest: 1.2, life: [0.6, 0.8], size: [2.5, 3.2], spawn: 0,
          orbit: { radius: 0, speed: 0, rise: 0, flat: true },
          colors: [[0, p.bright, 0], [0.3, p.bright, 0.6], [1, p.main, 0]] },
        // The blazing core
        { tex: "glow", blend: "add", rate: 30, rest: 0.4, life: [0.2, 0.35], size: [1.6, 0.8], spawn: 0.2,
          colors: [[0, "#ffffff", 0.9], [0.5, p.bright, 0.6], [1, p.main, 0]] },
        // Star glints
        { tex: "stars", blend: "add", rate: 30, rest: 0.8, life: [0.3, 0.6], size: [1.5, 0.2], spawn: 0.7,
          jitter: 0.25, spin: 1.5,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]] },
        // Motes of light rising
        { tex: "glow", blend: "add", rate: 40, rest: 0.6, life: [2.0, 3.0], size: [0.4, 0.32], spawn: 0.6,
          vel: [0, 0, 1.8], jitter: 0.5, drag: 0.6, flicker: 0.3,
          colors: linger([[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]]) }
      ]
    })
  },

  // Force damage: pulse rings closing in on the die, crystal shards spiralling round it, a burst of sparks.
  kineticPulse: {
    label: "Kinetic Pulse", icon: "fa-solid fa-burst", sound: "force",
    styles: {
      force: { label: "Force", colors: ["#f4e0ff", "#c04dff", "#3a0a8a"] },
      eldritch: { label: "Eldritch", colors: ["#e0fff8", "#2ad8c0", "#063a4a"] },
      telekinetic: { label: "Telekinetic", colors: ["#e6f0ff", "#4a7aff", "#0a1a6a"] },
      prism: { label: "Prism", colors: ["#ffffff", "#ffb8f0", "#4a2a8a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.55, pulse: 0.2, pulseSpeed: 8 }],
      layers: [
        // Pulse rings closing in, left lingering on the die's path
        { tex: "ring", blend: "add", rate: 7, rest: 1.0, life: [1.4, 2.0], size: [5.0, 0.8], spawn: 0,
          colors: linger([[0, p.main, 0], [0.25, p.bright, 0.75], [1, "#ffffff", 0]]) },
        // Crystal shards spiralling round the die
        { tex: "shard", blend: "add", rate: 30, rest: 1.0, life: [0.5, 0.9], size: [0.5, 0.2], spawn: 0,
          orbit: { radius: 1.4, speed: 7, helix: true }, spin: 3,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.9], [1, p.main, 0]] },
        // Crystal splinters shed along the die's path
        { tex: "shard", blend: "add", rate: 32, rest: 0, life: [2.0, 3.0], size: [0.45, 0.36], spawn: 0.4,
          jitter: 0.3, drag: 0.5, spin: 2, flicker: 0.3,
          colors: linger([[0, "#ffffff", 1], [0.3, p.bright, 0.8], [1, p.main, 0]]) },
        // Sparks pushed out by the force
        { tex: "spark", blend: "add", rate: 30, rest: 0.3, life: [0.2, 0.4], size: [0.6, 0.1], spawn: 0.3,
          jitter: 3.5, drag: 0.2,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]] }
      ]
    })
  },

  // Psychic damage: mind-swirls circling the die, thought-glyphs drifting off and ripples of will.
  mindstorm: {
    label: "Mindstorm", icon: "fa-solid fa-brain", sound: "psychic",
    styles: {
      psychic: { label: "Psychic", colors: ["#ffe0f4", "#ff4fb8", "#5a0a4a"] },
      dream: { label: "Dream", colors: ["#f0eaff", "#a88aff", "#2a1a5a"] },
      madness: { label: "Madness", colors: ["#eaffd0", "#8aff3a", "#5a0a4a"] },
      insight: { label: "Insight", colors: ["#e6fcff", "#3ad8ff", "#0a2a5a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.5, pulse: 0.22, pulseSpeed: 3 }],
      layers: [
        // Mind-swirls circling the die
        { tex: "twirls", blend: "add", rate: 14, rest: 1.0, life: [0.6, 1.0], size: [1.4, 0.4], spawn: 0,
          orbit: { radius: 1.1, speed: 6, rise: 0.2 }, spin: 6,
          colors: [[0, p.bright, 1], [0.5, p.main, 0.9], [1, p.dark, 0]] },
        // Thought-glyphs drifting off
        { tex: "glyphs", blend: "add", rate: 8, rest: 0.8, life: [0.9, 1.4], size: [0.6, 0.9], spawn: 0.8,
          vel: [0, 0, 1.0], jitter: 0.4, drag: 0.6, flicker: 0.2, spin: 0.5,
          colors: [[0, p.bright, 0], [0.2, p.bright, 0.9], [1, p.main, 0]] },
        // A tail of mind-swirls left turning slowly on the die's path
        { tex: "twirls", blend: "add", rate: 30, rest: 0, life: [2.0, 3.0], size: [0.9, 0.75], spawn: 0.3,
          jitter: 0.1, drag: 0.5, spin: 2,
          colors: linger([[0, "#ffffff", 0.9], [0.25, p.bright, 0.8], [0.6, p.main, 0.6], [1, p.dark, 0]]) },
        // Thought-motes
        { tex: "glow", blend: "add", rate: 40, rest: 0.5, life: [2.0, 3.0], size: [0.45, 0.36], spawn: 0.5,
          jitter: 0.3, swirl: 0.6, flicker: 0.5,
          colors: linger([[0, "#ffffff", 1], [0.5, p.bright, 0.8], [1, p.main, 0]]) },
        // Ripples of will
        { tex: "ring", blend: "add", rate: 4, rest: 0.6, life: [0.6, 0.9], size: [0.8, 4.0], spawn: 0,
          colors: [[0, p.bright, 0.7], [0.5, p.main, 0.4], [1, p.dark, 0]] }
      ]
    })
  },

  // Bludgeoning damage: rock chips and pebbles flung up in a cloud of dust, with dust rings thudding out.
  rockfall: {
    label: "Rockfall", icon: "fa-solid fa-hammer", sound: "stone",
    styles: {
      stone: { label: "Stone", colors: ["#d8c8a8", "#8a7456", "#3a3026"] },
      iron: { label: "Iron", colors: ["#d0d8e0", "#6a7480", "#24282e"] },
      sandstone: { label: "Sandstone", colors: ["#ffe0b0", "#c8884a", "#5a3418"] },
      obsidian: { label: "Obsidian", colors: ["#b8a8c8", "#3a3448", "#0a080e"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 2.6, alpha: 0.3, pulse: 0.05, blend: "normal" }],
      layers: [
        // Rock chips flung up, falling back
        { tex: "debris", blend: "normal", rate: 30, rest: 0.05, life: [0.4, 0.8], size: [1.0, 0.8], spawn: 0.5,
          vel: [0, 0, 2.4], jitter: 2.6, gravity: -12, drag: 0.8, spin: 8,
          colors: [[0, p.main, 1], [0.8, p.dark, 0.95], [1, p.dark, 0]] },
        // Pebbles
        { tex: "stones", blend: "normal", rate: 14, rest: 0.05, life: [0.5, 0.9], size: [0.6, 0.5], spawn: 0.5,
          vel: [0, 0, 3.0], jitter: 2.0, gravity: -14, drag: 0.8, spin: 6,
          colors: [[0, mix(p.main, p.bright, 0.3), 1], [0.8, p.main, 0.95], [1, p.dark, 0]] },
        // Dust cloud, thick and slow to settle
        { tex: "smoke", blend: "normal", rate: 24, rest: 0.2, life: [2.0, 3.0], size: [1.0, 3.2], spawn: 0.4,
          vel: [0, 0, 0.5], jitter: 0.5, drag: 0.6, spin: 0.5,
          colors: linger([[0, p.bright, 0], [0.2, p.bright, 0.7], [1, p.main, 0]]) },
        // Grit left lying along the die's path
        { tex: "debris", blend: "normal", rate: 25, rest: 0, life: [2.0, 3.0], size: [0.45, 0.4], spawn: 0.4,
          jitter: 0.3, drag: 0.4, spin: 1,
          colors: linger([[0, p.main, 0.95], [0.5, mix(p.main, p.dark, 0.5), 0.9], [1, p.dark, 0]]) },
        // Dust rings thudding out
        { tex: "ring", blend: "normal", rate: 5, rest: 0, life: [0.35, 0.5], size: [0.8, 4.5], spawn: 0,
          colors: [[0, p.bright, 0.9], [1, p.main, 0]] }
      ]
    })
  },

  // Piercing damage: a needle-thin line of light behind the die with speed glints and a bright point.
  needlepoint: {
    label: "Needlepoint", icon: "fa-solid fa-location-arrow", sound: "needle",
    styles: {
      steel: { label: "Steel", colors: ["#ffffff", "#a8c0e8", "#3a5080"] },
      gilded: { label: "Gilded", colors: ["#fffbe0", "#e8c060", "#6a4a10"] },
      bone: { label: "Bone", colors: ["#fffaf0", "#e0d4b8", "#5a4a30"] },
      venomtip: { label: "Venom Tip", colors: ["#f0ffe0", "#7aff4a", "#1a5a0a"] }
    },
    build: p => ({
      auras: [{ color: p.bright, size: 1.8, alpha: 0.5, pulse: 0.05 }],
      layers: [
        // The needle line: many tiny glows left exactly on the die's path
        { tex: "glow", blend: "add", rate: 90, rest: 0, life: [2.0, 3.0], size: [0.35, 0.28], spawn: 0.05,
          colors: linger([[0, "#ffffff", 1], [0.2, p.bright, 0.9], [0.6, p.main, 0.5], [1, p.dark, 0]]) },
        // A soft glow along it
        { tex: "glow", blend: "add", rate: 60, rest: 0, life: [2.0, 3.0], size: [0.9, 0.72], spawn: 0.08,
          colors: linger([[0, p.bright, 0.35], [1, p.dark, 0]]) },
        // Speed glints shooting back
        { tex: "spark", blend: "add", rate: 18, rest: 0, life: [0.1, 0.2], size: [1.2, 0.2], spawn: 0.4,
          inherit: -0.3,
          colors: [[0, "#ffffff", 0.9], [1, p.main, 0]] },
        // The bright point
        { tex: "stars", blend: "add", rate: 6, rest: 0.5, life: [0.12, 0.2], size: [1.8, 0.6], spawn: 0,
          colors: [[0, "#ffffff", 1], [1, p.bright, 0]] }
      ]
    })
  },

  // Slashing damage: slash marks cut the air round the die and leave a long trail of stripes; sparks and drops.
  crimsonEdge: {
    label: "Crimson Edge", icon: "fa-solid fa-khanda", sound: "blade",
    styles: {
      crimson: { label: "Crimson", colors: ["#ffe0e0", "#ff2a2a", "#4a0000"] },
      steel: { label: "Steel", colors: ["#ffffff", "#b8c4d4", "#3a4250"] },
      gale: { label: "Gale", colors: ["#f0fff4", "#8affc0", "#0a4a2a"] },
      shadowblade: { label: "Shadow Blade", colors: ["#e8d8ff", "#7a4aff", "#10062a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 2.6, alpha: 0.35, pulse: 0.08 }],
      layers: [
        // Slash marks
        { tex: "slashes", blend: "add", rate: 12, rest: 0.2, life: [0.18, 0.32], size: [1.4, 2.2], spawn: 0.4,
          colors: [[0, "#ffffff", 1], [0.3, p.bright, 0.9], [0.7, p.main, 0.6], [1, p.dark, 0]] },
        // A trail of slash stripes left along the die's path, fading from white to blood
        { tex: "slashes", blend: "add", rate: 40, rest: 0, life: [2.0, 3.0], size: [1.3, 1.04], spawn: 0.25,
          colors: linger([[0, "#ffffff", 0.95], [0.2, p.bright, 0.85], [0.6, p.main, 0.6], [1, p.dark, 0]]) },
        // Steel sparks
        { tex: "spark", blend: "add", rate: 30, rest: 0.1, life: [0.15, 0.35], size: [0.5, 0.08], spawn: 0.3,
          jitter: 3.0, gravity: -5, drag: 0.3, flicker: 0.4,
          colors: [[0, "#ffffff", 1], [1, p.bright, 0]] },
        // Drops flung off
        { tex: "drops", blend: "normal", rate: 16, rest: 0, life: [0.4, 0.7], size: [0.35, 0.28], spawn: 0.4,
          vel: [0, 0, 1.6], jitter: 2.0, gravity: -12, drag: 0.8,
          colors: [[0, p.main, 0.95], [0.6, mix(p.main, p.dark, 0.5), 0.9], [1, p.dark, 0]] }
      ]
    })
  },

  // Healing: leaves and little hearts drifting up off the die in a rising halo of life-light.
  lifebloom: {
    label: "Lifebloom", icon: "fa-solid fa-seedling", sound: "healing",
    styles: {
      life: { label: "Life", colors: ["#f4ffd8", "#5dff8a", "#1a7a3a"] },
      blossom: { label: "Blossom", colors: ["#fff0f6", "#ff9ac8", "#7a2a4a"] },
      spring: { label: "Spring", colors: ["#e8fff8", "#3ae0b0", "#0a5a4a"] },
      golden: { label: "Golden", colors: ["#fffbe0", "#ffd86a", "#7a5a10"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.2, alpha: 0.5, pulse: 0.14, pulseSpeed: 2 }],
      layers: [
        // Leaves fluttering off
        { tex: "leaves", blend: "normal", rate: 10, rest: 0.6, life: [2.0, 3.0], size: [0.7, 0.6], spawn: 0.7,
          vel: [0, 0, 0.6], jitter: 0.5, gravity: -0.8, drag: 0.6, spin: 2,
          colors: linger([[0, p.main, 0], [0.15, mix(p.main, p.bright, 0.3), 0.95], [0.8, p.main, 0.85], [1, p.dark, 0]]) },
        // Little hearts rising
        { tex: "heart", blend: "add", rate: 5, rest: 1.0, life: [1.0, 1.4], size: [1.1, 1.6], spawn: 0.7,
          vel: [0, 0, 1.6], jitter: 0.3, drag: 0.7,
          colors: [[0, "#ffffff", 0], [0.15, p.bright, 0.95], [1, p.main, 0]] },
        // Motes of life-light curling up
        { tex: "glow", blend: "add", rate: 36, rest: 0.9, life: [2.0, 3.0], size: [0.35, 0.28], spawn: 0.8,
          vel: [0, 0, 1.5], jitter: 0.5, drag: 0.5, swirl: 0.8, flicker: 0.3,
          colors: linger([[0, "#ffffff", 1], [0.5, p.bright, 0.85], [1, p.main, 0]]) },
        // A soft halo blooming out
        { tex: "ring", blend: "add", rate: 2, rest: 1.0, life: [0.9, 1.2], size: [1.0, 3.5], spawn: 0,
          colors: [[0, p.bright, 0.6], [1, p.main, 0]] }
      ]
    })
  },

  // Temporary hit points: a shimmering shield bubble round the die, crystal plates spiralling in it.
  aegis: {
    label: "Aegis", icon: "fa-solid fa-shield", sound: "ward",
    styles: {
      aegis: { label: "Aegis", colors: ["#e8f4ff", "#6fb8ff", "#1a3a8a"] },
      golden: { label: "Golden", colors: ["#fffbe0", "#ffcc4a", "#6a4000"] },
      verdant: { label: "Verdant", colors: ["#eaffe8", "#5ad88a", "#0a4a2a"] },
      arcane: { label: "Arcane", colors: ["#f4e8ff", "#b07aff", "#2a0a6a"] }
    },
    build: p => ({
      auras: [{ color: p.main, size: 3.0, alpha: 0.4, pulse: 0.1 }],
      layers: [
        // The shield bubble on the die
        { tex: "bubble", blend: "add", rate: 3, rest: 1.2, life: [0.6, 0.8], size: [3.6, 3.9], spawn: 0,
          orbit: { radius: 0, speed: 0, rise: 0, flat: true },
          colors: [[0, p.bright, 0], [0.3, p.bright, 0.5], [0.7, p.main, 0.4], [1, p.main, 0]] },
        // Crystal plates spiralling round it
        { tex: "shard", blend: "add", rate: 22, rest: 1.0, life: [0.6, 1.0], size: [0.55, 0.25], spawn: 0,
          orbit: { radius: 1.5, speed: 4, helix: true }, spin: 1,
          colors: [[0, "#ffffff", 1], [0.5, p.bright, 0.85], [1, p.main, 0]] },
        // Glints on the shield
        { tex: "spark", blend: "add", rate: 14, rest: 0.8, life: [0.2, 0.4], size: [0.8, 0.1], spawn: 1.1,
          flicker: 0.4,
          colors: [[0, "#ffffff", 1], [1, p.bright, 0]] },
        // A shimmering wake left behind, with glinting plates
        { tex: "glow", blend: "add", rate: 60, rest: 0, life: [2.0, 3.0], size: [0.8, 0.64], spawn: 0.3,
          colors: linger([[0, p.bright, 0.6], [0.4, p.main, 0.4], [1, p.dark, 0]]) },
        { tex: "shard", blend: "add", rate: 16, rest: 0, life: [2.0, 3.0], size: [0.4, 0.32], spawn: 0.4,
          spin: 1.5, flicker: 0.4,
          colors: linger([[0, "#ffffff", 0.9], [0.4, p.bright, 0.6], [1, p.main, 0]]) }
      ]
    })
  }
};

/**
 * How the Dice trails window groups the designs in its dropdown, in this order. A design missing
 * here is listed under "Other", so a new design always shows up.
 */
export const DESIGN_CATEGORIES = [
  { label: "Elements", designs: ["flame", "fireTrail", "frost", "storm", "tide"] },
  { label: "Damage Types", designs: ["emberstorm", "hoarfrost", "staticSurge", "thunderhead", "corrosion", "miasma",
    "graveShroud", "sunburst", "kineticPulse", "mindstorm", "rockfall", "needlepoint", "crimsonEdge", "lifebloom", "aegis"] },
  { label: "Magic", designs: ["smoke", "arcane", "ward", "charm", "song", "necrotic", "shadowWisp"] },
  { label: "Light & Stars", designs: ["rays", "stardust", "starlight", "comet", "rainbow"] },
  { label: "Nature, Stone & Steel", designs: ["petals", "stones", "blades"] },
  { label: "Classes", designs: ["arcforge", "bloodRage", "encore", "divineHalo", "wildGrowth", "steelSparks", "flowingKi",
    "sacredOath", "huntersMark", "shadowstep", "wildSurge", "eldritchPact", "spellscript"] },
  { label: "Species", designs: ["heavenlyWings", "dragonBreath", "deepVein", "elvenGrace", "gnomishWhimsy", "titanStride",
    "halflingLuck", "heroicResolve", "adrenalineRush", "infernalLegacy", "twinHeritage", "savageStrike"] },
  { label: "Backgrounds", designs: ["templeIncense", "craftwork", "foolsGold", "backAlley", "showstopper", "harvest",
    "nightWatch", "pathfinder", "loneCandle", "coinShower", "nobleCrest", "starChart", "seaSpray", "inkBlot",
    "warBanner", "dustyRoad"] }
];

/* ======================================================================== */
/*  Your own image                                                          */
/* ======================================================================== */

/**
 * How an image of your own moves. Each motion is a particle layer without texture and colours;
 * `count` is how many copies are in the air at once, `size` their default size in die radii.
 */
export const MOTIONS = {
  trail:   { label: "DXDT.Motion.Trail",   size: 0.8, count: 12, single: false,
             base: { life: [0.5, 0.9], spawn: 0.3, vel: [0, 0, 0], jitter: 0.4, drag: 0.4, spin: 1 } },
  orbit:   { label: "DXDT.Motion.Orbit",   size: 0.8, count: 6, single: false,
             base: { life: [0.8, 1.2], spawn: 0, orbit: { radius: 1.4, speed: 5, rise: 0.2 }, spin: 1 } },
  rise:    { label: "DXDT.Motion.Rise",    size: 0.7, count: 10, single: false,
             base: { life: [0.7, 1.2], spawn: 0.5, vel: [0, 0, 2], jitter: 0.5, drag: 0.6, spin: 0.5 } },
  burst:   { label: "DXDT.Motion.Burst",   size: 0.55, count: 14, single: false,
             base: { life: [0.4, 0.8], spawn: 0.3, vel: [0, 0, 1], jitter: 3, gravity: -3, drag: 0.5, spin: 4 } },
  flutter: { label: "DXDT.Motion.Flutter", size: 0.7, count: 10, single: false,
             base: { life: [0.8, 1.4], spawn: 0.6, vel: [0, 0, 0.5], jitter: 1.2, gravity: -2.5, drag: 0.5, spin: 3 } },
  spin:    { label: "DXDT.Motion.Spin",    size: 3.5, count: 1, single: true,
             base: { life: [0.8, 1.0], spawn: 0, orbit: { radius: 0, speed: 0, rise: 0, flat: true, lift: 1.3 }, spin: 2 } }
};
export const COLOR_MODES = ["original", "tint", "colorize"];

/* ======================================================================== */
/*  Normalisation                                                           */
/* ======================================================================== */

export const LAYER_DEFAULTS = {
  design: "comet", style: "silver", scale: 1, length: 1, speed: 1, alpha: 1, density: 1, color: null,
  glow: 0, pulse: 0, sparkle: 0, wave: 0, sound: null
};
export const CUSTOM_DEFAULTS = { src: "", motion: "trail", count: 12, size: 0.8, blend: "add", colorMode: "original" };

const RANGES = [
  ["scale", 0.4, 2.5], ["length", 0.3, 2.5], ["speed", 0, 3], ["alpha", 0.1, 1], ["density", 0, 2.5],
  ["glow", 0, 1], ["pulse", 0, 1], ["sparkle", 0, 1], ["wave", 0, 1]
];
const CUSTOM_RANGES = [["count", 1, 40], ["size", 0.05, 4]];

function clampFields(c, ranges, defaults) {
  for (const [k, lo, hi] of ranges) {
    const v = Number(c[k]);
    c[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : defaults[k];
  }
}

export const isHex = c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

/** Fill in one layer's missing fields and fall back to valid values. */
export function normalizeLayer(layer = {}) {
  const src = layer ?? {};
  const c = {};
  for (const k of Object.keys(LAYER_DEFAULTS)) c[k] = src[k] ?? LAYER_DEFAULTS[k];
  clampFields(c, RANGES, LAYER_DEFAULTS);
  if (c.color && !isHex(c.color)) c.color = null;
  if (c.sound !== "none" && !SOUNDS.includes(c.sound)) c.sound = null;
  if (c.design === CUSTOM) {
    c.style = CUSTOM;
    for (const k of Object.keys(CUSTOM_DEFAULTS)) c[k] = src[k] ?? CUSTOM_DEFAULTS[k];
    clampFields(c, CUSTOM_RANGES, CUSTOM_DEFAULTS);
    c.count = Math.round(c.count);
    c.src = typeof c.src === "string" ? c.src.trim() : "";
    if (/^\s*(javascript|data:text)/i.test(c.src)) c.src = "";
    if (!MOTIONS[c.motion]) c.motion = CUSTOM_DEFAULTS.motion;
    if (!COLOR_MODES.includes(c.colorMode)) c.colorMode = "original";
    if (c.blend !== "normal") c.blend = "add";
    if ((c.colorMode === "tint" || c.colorMode === "colorize") && !c.color) c.color = "#8a5aff";
    return c;
  }
  if (!DESIGNS[c.design]) c.design = LAYER_DEFAULTS.design;
  const styles = DESIGNS[c.design].styles;
  if (!styles[c.style]) c.style = Object.keys(styles)[0];
  return c;
}

/** A trail is a stack of layers: {layers: [layer, ...]}. */
export function normalizeConfig(cfg = {}) {
  let layers = cfg?.layers;
  if (layers && !Array.isArray(layers) && typeof layers === "object") layers = Object.values(layers);
  if (!Array.isArray(layers)) layers = cfg && (cfg.design || cfg.style) ? [cfg] : [];
  layers = layers.slice(0, MAX_LAYERS).map(normalizeLayer);
  if (!layers.length) layers = [normalizeLayer({})];
  return { layers };
}

/** Image paths used by a trail's custom layers. */
export function customSources(cfg) {
  return [...new Set(normalizeConfig(cfg).layers.filter(l => l.design === CUSTOM && l.src).map(l => l.src))];
}

/** A short name for a layer, for lists. */
export function layerLabel(layer) {
  if (layer.design === CUSTOM) {
    const file = decodeURIComponent((layer.src || "").split(/[\\/]/).pop() || "").replace(/\.[a-z0-9]+$/i, "");
    return file || null;
  }
  const d = DESIGNS[layer.design];
  return `${d.label}: ${d.styles[layer.style]?.label ?? ""}`;
}

/** A short name for a whole trail: its layers' names. */
export function trailLabel(cfg, customLabel = "Your image") {
  return normalizeConfig(cfg).layers.map(l => layerLabel(l) ?? customLabel).join(" + ");
}

/* ======================================================================== */
/*  Colours                                                                 */
/* ======================================================================== */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}
/** Mix two hex colours: t = 0 gives a, t = 1 gives b. */
/**
 * A long tail's colours: keeps the gradient's colours but holds it near full strength until 80% of
 * the particle's life and only then fades it out, so the tail lingers on the table for a while. Tail layers
 * also live 2-3 seconds and barely shrink, so they stay visible until they fade.
 */
export function linger(stops) {
  const peak = Math.max(...stops.map(s => s[2]));
  const top = stops.findIndex(s => s[2] === peak);
  const held = stops.filter(s => s[0] < 0.8).map((s, i) => [s[0], s[1], i < top ? s[2] : Math.max(s[2], peak * 0.9)]);
  return [...held, [0.8, gradientColor(stops, 0.8), peak * 0.85], [1, stops[stops.length - 1][1], 0]];
}

/** The colour of a [t, hex, alpha] gradient at t. */
function gradientColor(stops, t) {
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[Math.min(i + 1, stops.length - 1)];
  return mix(c0, c1, t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0);
}

export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** The palette of a layer: the style's colours, or ones made from the layer's own colour. */
function palette(layer) {
  if (layer.color) return { bright: mix(layer.color, "#ffffff", 0.65), main: layer.color, dark: mix(layer.color, "#000000", 0.55) };
  const [bright, main, dark] = DESIGNS[layer.design].styles[layer.style].colors;
  return { bright, main, dark };
}

/* ======================================================================== */
/*  Compiling a trail into an effect                                        */
/* ======================================================================== */

const scaleColors = (colors, alpha) => colors.map(([t, c, a]) => [t, c, a * alpha]);

/** Apply a layer's fine-tuning and effects to the parts its design built. */
function tune(parts, l) {
  const sizeMul = Math.sqrt(l.scale);
  const ribbons = (parts.ribbons ?? []).map(r => {
    const o = { ...r, width: r.width * l.scale, time: r.time * l.length, alpha: (r.alpha ?? 1) * l.alpha,
                scroll: (r.scroll ?? 1) * l.speed, bandSpeed: (r.bandSpeed ?? 0) * l.speed };
    if (o.strip) o.strip = { ...o.strip, scroll: (o.strip.scroll ?? 0) * l.speed };
    if (l.sparkle > 0) o.sparkle = (o.sparkle ?? 0) + l.sparkle * 1.2;
    if (l.pulse > 0) {
      o.bands = o.bands || 5;
      o.bandAmt = Math.max(o.bandAmt ?? 0, l.pulse * 0.6);
      o.bandSpeed = (o.bandSpeed || 6 * l.speed);
    }
    if (l.wave > 0) {
      o.wave = { amp: (o.wave?.amp ?? 0) + l.wave * 1.2, freq: o.wave?.freq ?? 1.8, speed: (o.wave?.speed ?? 8) * Math.max(0.2, l.speed), phase: o.wave?.phase ?? 0 };
    } else if (o.wave) {
      o.wave = { ...o.wave, speed: o.wave.speed * Math.max(0.2, l.speed) };
    }
    return o;
  });
  const layers = (parts.layers ?? []).map(p => {
    const o = { ...p, rate: p.rate * l.density, size: [p.size[0] * sizeMul, p.size[1] * sizeMul],
                colors: scaleColors(p.colors, l.alpha), spin: (p.spin ?? 0) * Math.max(0.3, l.speed) };
    if (p.vel) o.vel = p.vel.map(v => v * l.speed);
    if (p.jitter != null) o.jitter = p.jitter * (0.5 + 0.5 * l.speed);
    if (p.orbit) o.orbit = { ...p.orbit, speed: p.orbit.speed * l.speed, radius: p.orbit.radius * sizeMul };
    if (p.spawn && typeof p.spawn === "object") o.spawn = { ...p.spawn, ring: (p.spawn.ring ?? 1) * sizeMul };
    if (p.inward) o.inward = p.inward * l.speed;
    if (p.swirl) o.swirl = p.swirl * l.speed;
    return o;
  });
  const auras = (parts.auras ?? []).map(a => ({
    ...a, size: a.size * sizeMul, alpha: a.alpha * l.alpha,
    pulse: (a.pulse ?? 0) + l.pulse * 0.3, pulseSpeed: (a.pulseSpeed ?? 6) * Math.max(0.3, l.speed)
  }));
  const arcs = (parts.arcs ?? []).map(a => ({ ...a, count: Math.max(1, Math.round(a.count * l.density)), reach: a.reach.map(v => v * sizeMul) }));
  if (l.sparkle > 0) {
    const c = parts.glowColor;
    layers.push({ tex: "stars", blend: "add", rate: 22 * l.sparkle * Math.max(0.3, l.density), rest: 0.8, life: [0.25, 0.5],
                  size: [0.9 * sizeMul, 0.1], spawn: 0.9 * sizeMul, vel: [0, 0, 0.3], jitter: 0.3, spin: 1.5,
                  colors: [[0, "#ffffff", l.alpha], [1, c, 0]] });
  }
  if (l.glow > 0) {
    auras.push({ color: parts.glowColor, size: (2.4 + 2.4 * l.glow) * sizeMul, alpha: 0.75 * l.glow * l.alpha,
                 pulse: 0.08 + l.pulse * 0.3, pulseSpeed: 3 * Math.max(0.3, l.speed) });
  }
  return { ribbons, layers, auras, arcs };
}

/** The particle layer of an image of your own. */
function buildCustom(l) {
  const motion = MOTIONS[l.motion];
  const base = motion.base;
  const meanLife = (base.life[0] + base.life[1]) / 2;
  const rate = motion.single ? 3 : l.count / meanLife;
  const color = l.colorMode === "original" ? "#ffffff" : l.color;
  const layer = {
    ...base, tex: `custom:${l.src}`, blend: l.blend, rate, rest: 0.8,
    size: motion.single ? [l.size, l.size * 1.05] : [l.size, l.size * 0.6],
    colorize: l.colorMode === "colorize",
    colors: [[0, color, 0], [0.12, color, 1], [0.75, color, 1], [1, color, 0]]
  };
  return { layers: [layer], glowColor: l.colorMode === "original" ? "#ffffff" : l.color };
}

/**
 * Turn a trail into one effect definition for the renderer: {ribbons, layers, auras, arcs},
 * with every layer's parts tuned and stacked.
 */
export function compileTrail(cfg) {
  const trail = normalizeConfig(cfg);
  const out = { ribbons: [], layers: [], auras: [], arcs: [], sounds: [] };
  for (const l of trail.layers) {
    let parts;
    if (l.design === CUSTOM) {
      if (!l.src) continue;
      parts = buildCustom(l);
    } else {
      const design = DESIGNS[l.design];
      const p = palette(l);
      parts = design.build(p, l.style, design.styles[l.style]);
      parts.glowColor = p.main;
    }
    // The layer's chosen sound, or its design's own, as loud as the layer is opaque.
    const theme = l.sound ?? (l.design === CUSTOM ? null : DESIGNS[l.design].sound);
    if (theme && theme !== "none") out.sounds.push({ theme, gain: l.alpha });
    const t = tune(parts, l);
    out.ribbons.push(...t.ribbons);
    out.layers.push(...t.layers);
    out.auras.push(...t.auras);
    out.arcs.push(...t.arcs);
  }
  return out;
}

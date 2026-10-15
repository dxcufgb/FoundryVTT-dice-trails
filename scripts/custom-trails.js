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
  }
};

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

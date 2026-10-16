/**
 * Dxcufgb's dice trails (dxcufgbs-dice-trails) - Foundry VTT V13 + Dice So Nice 5
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
 * Sound: every trail has a sound theme (EFFECTS[type].sound, DESIGNS[design].sound): a quiet loop
 * while the die flies, and a loud hit whenever it bounces (detected from its velocity in
 * DieEmitter.update) or lands. See trail-sounds.js; the files in sounds/ are the module's own (CC0).
 *
 * Custom trails for regular rolls (attacks, checks, saves, initiative, ...): every user designs
 * their own in the "Dice trails" window (Configure Settings -> Dxcufgb's dice trails, or the
 * button in the Token Controls) out of layers (Flame, Frost, Storm, Comet, ..., or an image of
 * their own), and gives them to kinds of roll, for themselves (stored on the User, so they follow
 * them to any computer) or for a character or token they own (stored on the Actor; an unlinked
 * token's on that token). A roll made as a character uses its trail, else its player's, and
 * everyone at the table sees it.
 * See custom-trails.js (designs, compiler) and trail-editor.js (the window).
 *
 * Preview from the console or a macro:
 *   game.modules.get("dxcufgbs-dice-trails").api.preview("fire")
 *   game.modules.get("dxcufgbs-dice-trails").api.previewAll()
 *   game.modules.get("dxcufgbs-dice-trails").api.open()          // the Dice trails window
 */

import { MODULE_ID, TAG, TAG_KIND, TAG_USER, TAG_OWNER, FLAG_PRESETS, FLAG_TRAILS } from "./constants.js";
import { DESIGNS, KINDS, CUSTOM, normalizeConfig, customSources, compileTrail } from "./custom-trails.js";
import { DiceTrailsEditor } from "./trail-editor.js";
import { exportTrail, importTrail } from "./transfer.js";
import { applyDefaultTrail, defaultTrail, characterSources, defaultTrailUpdate, unsavedDefault, isDefaultTrail } from "./default-trails.js";
import { DieSound, THEMES, bounceStrength, beginSoundFrame, endSoundFrame, playHit, preloadSounds, soundsOn, stopAllSounds } from "./trail-sounds.js";

export { MODULE_ID };

const THREE_URL = "modules/dice-so-nice/libs/three.module.min.js";

let THREE = null;
let TEXTURES = null;
const emitters = new Map();     // mesh uuid -> DieEmitter
let tickerActive = false;
let lastTime = 0;
let previewDef = null;          // the effect the editor's test roll shows
const compiled = new Map();     // JSON of a trail -> compiled effect

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
 *              own sprites (tools/make-textures.py): leaves | petals | snowflakes | notes | glyphs | knives |
 *              stones | flares | bubbles | drops | skulls | coins
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
  // Signature: flame tongues round a white-hot core, embers swirling up into a long tail and dark smoke.
  // The same look as the Emberstorm design, so players can pick it (and its other styles) for their own rolls too.
  fire: {
    sound: "fire",
    ...DESIGNS.emberstorm.build({ bright: "#fff1a8", main: "#ff6a10", dark: "#8a1000" })
  },

  // Signature: ice shards tumbling down, snowflakes spinning through a long freezing mist.
  // The same look as the Hoarfrost design, so players can pick it (and its other styles) for their own rolls too.
  cold: {
    sound: "frost",
    ...DESIGNS.hoarfrost.build({ bright: "#f0fcff", main: "#8fdcff", dark: "#1f5fb8" })
  },

  // Signature: a jagged bolt trailing the die that shrinks back into it as it lands, arcs, sparks and a long crackling path.
  // The same look as the Static Surge design, so players can pick it (and its other styles) for their own rolls too.
  lightning: {
    sound: "lightning",
    ...DESIGNS.staticSurge.build({ bright: "#e6f4ff", main: "#4f9cff", dark: "#1a2aa8" })
  },

  // Signature: a long dark storm cloud lit by flashes, with shockwave rings booming off the die.
  // The same look as the Thunderhead design, so players can pick it (and its other styles) for their own rolls too.
  thunder: {
    sound: "thunder",
    ...DESIGNS.thunderhead.build({ bright: "#d8daff", main: "#5a5dff", dark: "#16123a" })
  },

  // Signature: glowing drops dripping off, popping bubbles, caustic fumes and a glowing smear on its path.
  // The same look as the Corrosion design, so players can pick it (and its other styles) for their own rolls too.
  acid: {
    sound: "acid",
    ...DESIGNS.corrosion.build({ bright: "#f6ffa0", main: "#b8ff1a", dark: "#3a6a00" })
  },

  // Signature: a thick toxic cloud that curls and lingers, full of glowing spores.
  // The same look as the Miasma design, so players can pick it (and its other styles) for their own rolls too.
  poison: {
    sound: "poison",
    ...DESIGNS.miasma.build({ bright: "#c8ff7a", main: "#3ab82a", dark: "#3a1a5a" })
  },

  // Signature: a long black shroud, ghost-flames, spectral skulls and souls drawn in to the die.
  // The same look as the Grave Shroud design, so players can pick it (and its other styles) for their own rolls too.
  necrotic: {
    sound: "necrotic",
    ...DESIGNS.graveShroud.build({ bright: "#c8ffe0", main: "#3affa0", dark: "#003a2a" })
  },

  // Signature: a halo and blazing core, star glints and a long tail of rising light.
  // The same look as the Sunburst design, so players can pick it (and its other styles) for their own rolls too.
  radiant: {
    sound: "radiant",
    ...DESIGNS.sunburst.build({ bright: "#fffbe0", main: "#ffd84a", dark: "#c06a00" })
  },

  // Signature: rings closing in on the die, crystal shards spiralling round it, a long tail of splinters.
  // The same look as the Kinetic Pulse design, so players can pick it (and its other styles) for their own rolls too.
  force: {
    sound: "force",
    ...DESIGNS.kineticPulse.build({ bright: "#f4e0ff", main: "#c04dff", dark: "#3a0a8a" })
  },

  // Signature: mind-swirls circling the die, thought-glyphs drifting off, ripples and a long tail of motes.
  // The same look as the Mindstorm design, so players can pick it (and its other styles) for their own rolls too.
  psychic: {
    sound: "psychic",
    ...DESIGNS.mindstorm.build({ bright: "#ffe0f4", main: "#ff4fb8", dark: "#5a0a4a" })
  },

  // Signature: rock chips and pebbles flung up in a long dust cloud, with dust rings thudding out.
  // The same look as the Rockfall design, so players can pick it (and its other styles) for their own rolls too.
  bludgeoning: {
    sound: "stone",
    ...DESIGNS.rockfall.build({ bright: "#d8c8a8", main: "#8a7456", dark: "#3a3026" })
  },

  // Signature: a long, needle-thin line of light on the die's path, speed glints and a bright point.
  // The same look as the Needlepoint design, so players can pick it (and its other styles) for their own rolls too.
  piercing: {
    sound: "needle",
    ...DESIGNS.needlepoint.build({ bright: "#ffffff", main: "#a8c0e8", dark: "#3a5080" })
  },

  // Signature: slash marks round the die leaving a long trail of slash stripes, steel sparks and flung drops.
  // The same look as the Crimson Edge design, so players can pick it (and its other styles) for their own rolls too.
  slashing: {
    sound: "blade",
    ...DESIGNS.crimsonEdge.build({ bright: "#ffe0e0", main: "#ff2a2a", dark: "#4a0000" })
  },

  // Signature: leaves and little hearts drifting up in a long, rising trail of life-light.
  // The same look as the Lifebloom design, so players can pick it (and its other styles) for their own rolls too.
  healing: {
    sound: "healing",
    ...DESIGNS.lifebloom.build({ bright: "#f4ffd8", main: "#5dff8a", dark: "#1a7a3a" })
  },

  // Signature: a shield bubble round the die, crystal plates spiralling in it, a long shimmering wake.
  // The same look as the Aegis design, so players can pick it (and its other styles) for their own rolls too.
  temphp: {
    sound: "ward",
    ...DESIGNS.aegis.build({ bright: "#e8f4ff", main: "#6fb8ff", dark: "#1a3a8a" })
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
  game.settings.register(MODULE_ID, "sounds", {
    name: "DXDT.Settings.Sounds.Name", hint: "DXDT.Settings.Sounds.Hint",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: on => { if (!on) stopAllSounds(); else preloadSounds(); }
  });
  game.settings.register(MODULE_ID, "soundVolume", {
    name: "DXDT.Settings.SoundVolume.Name", hint: "DXDT.Settings.SoundVolume.Hint",
    scope: "client", config: true, type: Number, default: 0.2,
    range: { min: 0, max: 2, step: 0.05 }
  });
  game.settings.registerMenu(MODULE_ID, "editor", {
    name: "DXDT.Settings.Editor.Name", label: "DXDT.Settings.Editor.Label", hint: "DXDT.Settings.Editor.Hint",
    icon: "fa-solid fa-dice-d20", type: DiceTrailsEditor.Menu, restricted: false
  });
  game.settings.register(MODULE_ID, "showOthers", {
    name: "DXDT.Settings.ShowOthers.Name", hint: "DXDT.Settings.ShowOthers.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "lastConfig", { scope: "client", config: false, type: Object, default: {} });

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      preview, previewAll, types: Object.keys(EFFECTS),
      sounds: THEMES, playSound: (theme, strength = 1) => playHit(theme, strength),
      open: (owner = null) => DiceTrailsEditor.open({ owner }),
      designs: DESIGNS, kinds: KINDS,
      presets, savePreset, deletePreset, trails, setTrail, clearTrail, ownerRef, ownerFromRef, exportTrail, importTrail,
      defaultTrail: actor => defaultTrail(characterSources(actor)), applyDefaultTrail
    };
  }
});

// A button in the Token Controls, next to the other per-player looks (rings, ...). With a token selected it
// opens that character's trails.
Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens;
  if (!tokens?.tools) return;
  const orders = Object.values(tokens.tools).map(t => t.order ?? 0);
  tokens.tools[MODULE_ID] = {
    name: MODULE_ID, order: Math.max(0, ...orders) + 1, title: "DXDT.Control.Title",
    icon: "fa-solid fa-dice-d20", button: true, visible: true,
    onChange: () => DiceTrailsEditor.open()
  };
});

Hooks.once("ready", async () => {
  if (!game.modules.get("dice-so-nice")?.active) return;
  try {
    await loadThree();
    startTicker();   // always on: rolls shown from other clients don't fire the start hook
    if (soundsOn()) preloadSounds();
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

// Tag every die with its damage type before Dice So Nice builds the 3D dice; the dice of a
// regular roll (no damage type) get the roller's custom trail for that kind of roll instead.
Hooks.on("diceSoNiceRollStart", (messageID, context) => {
  try {
    if (!game.settings.get(MODULE_ID, "enabled") || !THREE) return;
    let tagged = 0;
    const message = messageID ? game.messages.get(messageID) : null;
    const rolls = [...(message?.rolls ?? []), context?.roll, context?.dsnRoll].filter(r => r?.terms);
    for (const roll of rolls) tagged += tagRoll(roll, null);

    const user = context?.user ?? message?.author ?? message?.user ?? null;
    const kind = rollKind(message, rolls);
    const owner = kind ? trailOwner(message, user, kind) : null;
    const cfg = trailFor(owner, kind);
    if (cfg && (user?.id === game.user.id || game.settings.get(MODULE_ID, "showOthers"))) {
      for (const roll of rolls) tagged += tagCustom(roll, kind, user?.id, owner !== user ? ownerRef(owner) : null);
    }
    if (tagged) startTicker();
  } catch (err) {
    console.error(`${MODULE_ID} | diceSoNiceRollStart`, err);
  }
});

/* ======================================================================== */
/*  Regular rolls: which kind, whose trail                                  */
/* ======================================================================== */

/**
 * What kind of roll a message is, for custom trails: attack, check, save, death, initiative or
 * other. Damage and healing rolls return null (they get their damage type trails). Reads the
 * dnd5e and pf2e roll flags and falls back to the roll's own options and class.
 */
export function rollKind(message, rolls = []) {
  const hints = [];
  const f = message?.flags ?? {};
  if (f.core?.initiativeRoll) return "initiative";
  if (f.dnd5e?.roll?.type) hints.push(f.dnd5e.roll.type);
  if (f.pf2e?.context?.type) hints.push(f.pf2e.context.type);
  for (const r of rolls) {
    if (typeof r.options?.type === "string") hints.push(r.options.type);
    if (r.constructor?.name) hints.push(r.constructor.name);
  }
  for (const raw of hints) {
    const h = String(raw).toLowerCase();
    if (/damage|heal/.test(h)) return null;
    if (/death/.test(h)) return "death";
    if (/initiative/.test(h)) return "initiative";
    if (/attack/.test(h)) return "attack";
    if (/sav(e|ing)|concentration/.test(h)) return "save";
    if (/skill|abilit|tool|check|perception/.test(h)) return "check";
  }
  // A roll with a damage type anywhere is a damage roll, whatever the system.
  if (rolls.some(r => rollType(r))) return null;
  return "other";
}

/** Tag the dice of a roll that have no damage type yet with a custom trail: a character's (ref) or the user's. */
function tagCustom(roll, kind, userId, ref = null) {
  if (!roll?.terms) return 0;
  let n = 0;
  for (const term of roll.terms) {
    if (Array.isArray(term?.rolls)) { for (const r of term.rolls) n += tagCustom(r, kind, userId, ref); continue; }
    if (term?.roll?.terms) { n += tagCustom(term.roll, kind, userId, ref); continue; }
    if (!(Array.isArray(term?.results) && typeof term.faces === "number")) continue;
    term.options ??= {};
    if (term.options[TAG]) continue;
    term.options[TAG] = CUSTOM;
    term.options[TAG_KIND] = kind;
    term.options[TAG_USER] = userId;
    if (ref) term.options[TAG_OWNER] = ref;
    n++;
  }
  return n;
}

/* ======================================================================== */
/*  Custom trails: storage (flags on the User or on a character)            */
/* ======================================================================== */

/*
 * Trails belong to an owner: a User (a player's own trails) or an Actor (a character's). A linked
 * character's trails are on its Actor and shared by its tokens; an unlinked token's actor keeps its
 * own on the token, so every token can have a different trail.
 */

/** The character a chat message speaks for (an unlinked token's own actor), if any. */
function speakerActor(message) {
  const speaker = message?.speaker;
  if (!speaker?.actor && !speaker?.token) return null;
  try {
    return CONFIG.ChatMessage.documentClass.getSpeakerActor(speaker) ?? null;
  } catch (_) {
    return null;
  }
}

/**
 * Whose trail a roll gets: the character it is made as, if that has one for this kind; else the player's.
 * A character's default trail (saved or not) gives way to a trail the player gave this kind themselves.
 */
export function trailOwner(message, user, kind) {
  const actor = speakerActor(message);
  if (!actor || !trailFor(actor, kind)) return user;
  return isDefaultTrail(actor, kind) && trailFor(user, kind) ? user : actor;
}

/** A reference to an owner that fits in a die's options: a uuid, the token's for an unlinked token. */
export function ownerRef(owner) {
  return owner?.isToken && owner.token ? owner.token.uuid : owner?.uuid ?? null;
}

/** The owner (User or Actor) a reference made by ownerRef() points at, if it still exists. */
export function ownerFromRef(ref) {
  if (!ref) return null;
  try {
    const doc = foundry.utils.fromUuidSync(ref);
    return doc?.documentName === "Token" ? doc.actor : doc ?? null;
  } catch (_) {
    return null;
  }
}

/**
 * An owner's trails by kind of roll: {attack: trail, ...}. Missing kinds have none. A character whose
 * default trail (default-trails.js) is not saved on it yet has that on every kind it gave no trail.
 */
export function trails(owner = game.user) {
  const out = {};
  for (const k of KINDS) {
    const cfg = trailFor(owner, k);
    if (cfg) out[k] = cfg;
  }
  return out;
}

/** The trail an owner (User or Actor) has given this kind of roll, if any; a character's default until saved. */
export function trailFor(owner, kind) {
  if (!owner || !kind) return null;
  const t = owner.getFlag?.(MODULE_ID, FLAG_TRAILS);
  return t?.[kind]?.layers ? normalizeConfig(t[kind]) : unsavedDefault(owner, kind);
}

/** Give one or more kinds of roll a trail, for an owner: you (default) or a character you own. */
export async function setTrail(kinds, cfg, owner = game.user) {
  const list = (Array.isArray(kinds) ? kinds : [kinds]).filter(k => KINDS.includes(k));
  if (!list.length || !owner) return false;
  const data = normalizeConfig(cfg);
  // A character's default trail is saved with it, so its other kinds keep showing it.
  await owner.update({
    ...defaultTrailUpdate(owner, list),
    ...Object.fromEntries(list.map(k => [`flags.${MODULE_ID}.${FLAG_TRAILS}.${k}`, data]))
  });
  return true;
}

/** Take the trail off one or more kinds of roll, for an owner: you (default) or a character you own. */
export async function clearTrail(kinds, owner = game.user) {
  const list = (Array.isArray(kinds) ? kinds : [kinds]).filter(k => KINDS.includes(k));
  if (!list.length || !owner) return false;
  // Updates merge into the flag, so a kind is removed with Foundry's "-=" deletion key. A character's default
  // trail is saved with it (on its other kinds), so the kind taken off stays off.
  await owner.update({
    ...defaultTrailUpdate(owner, list),
    ...Object.fromEntries(list.map(k => [`flags.${MODULE_ID}.${FLAG_TRAILS}.-=${k}`, null]))
  });
  return true;
}

/** This user's saved trails: [{id, name, cfg}], kept in a flag on their User document. */
export function presets() {
  const list = game.user.getFlag(MODULE_ID, FLAG_PRESETS);
  return Array.isArray(list) ? list.filter(p => p?.id && p.cfg) : [];
}

/** Save a trail under a name; a saved trail with the same name is replaced. Returns its id. */
export async function savePreset(name, cfg) {
  name = String(name ?? "").trim().slice(0, 60);
  if (!name) return null;
  const list = presets();
  const old = list.find(p => p.name.toLowerCase() === name.toLowerCase());
  const entry = { id: old?.id ?? foundry.utils.randomID(), name, cfg: normalizeConfig(cfg) };
  const next = old ? list.map(p => (p === old ? entry : p)) : [...list, entry];
  next.sort((a, b) => a.name.localeCompare(b.name));
  await game.user.setFlag(MODULE_ID, FLAG_PRESETS, next);
  return entry.id;
}

export async function deletePreset(id) {
  await game.user.setFlag(MODULE_ID, FLAG_PRESETS, presets().filter(p => p.id !== id));
}

/** The compiled effect of a trail (cached by content). */
function effectOf(cfg) {
  const key = JSON.stringify(cfg);
  let def = compiled.get(key);
  if (!def) {
    if (compiled.size > 60) compiled.clear();
    def = compileTrail(cfg);
    compiled.set(key, def);
  }
  return def;
}

/** The effect a tagged 3D die should get: a damage type's, a user's custom trail or the editor's preview. */
function effectForDie(mesh) {
  const type = mesh.options?.[TAG];
  if (!type) return null;
  if (EFFECTS[type]) return { def: EFFECTS[type], cfg: null };
  if (type === "preview") return previewDef ? { def: previewDef, cfg: null } : null;
  if (type === CUSTOM) {
    const ref = mesh.options[TAG_OWNER];
    const owner = (ref && ownerFromRef(ref)) || game.users.get(mesh.options[TAG_USER]);
    const cfg = trailFor(owner, mesh.options[TAG_KIND]);
    return cfg ? { def: effectOf(cfg), cfg } : null;
  }
  return null;
}

/** Show the editor's trail on the next test roll and on dice already on the table. */
export function setPreviewEffect(cfg) {
  previewDef = cfg ? compileTrail(cfg) : null;
  for (const [key, em] of emitters) {
    if (em.mesh?.options?.[TAG] !== "preview") continue;
    em.dispose();
    emitters.delete(key);
  }
}

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

/**
 * Sprite sheets in textures/ (2x2 variants, white with an alpha shape): the Kenney Particle Pack
 * ones (CC0) and the module's own (tools/make-textures.py, CC0).
 */
const SPRITES = {
  ring: 1, heart: 1, rune: 1, smoke: 4, bolts: 4, stars: 4, flames: 4, twirls: 4, slashes: 4, debris: 4, strips: 8,
  leaves: 4, petals: 4, snowflakes: 4, notes: 4, glyphs: 4, knives: 4, stones: 4, flares: 4, bubbles: 4, drops: 4, skulls: 4, coins: 4
};
// The art fills only the middle of each sprite, so draw these larger to match the drawn ones.
const SPRITE_SIZE = {
  ring: 1.1, heart: 1.3, rune: 1, smoke: 1.5, bolts: 1.7, stars: 2.2, flames: 1.9, twirls: 1.7, slashes: 1.6, debris: 1.5,
  leaves: 1.3, petals: 1.4, snowflakes: 1.2, notes: 1.3, glyphs: 1.2, knives: 1.1, stones: 1.3, flares: 1.3, bubbles: 1.2, drops: 1.3, skulls: 1.4, coins: 1.2
};
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

/** Images of the users' own ("custom:<path>" textures), loaded on demand. */
const customTextures = new Map();   // src -> { promise, done }

/** Load the user images a trail needs; resolves once they are ready (failed ones draw as a plain glow). */
export function loadCustomTextures(cfg) {
  return Promise.all(customSources(cfg).map(src => {
    let entry = customTextures.get(src);
    if (!entry) {
      entry = { done: false };
      entry.promise = new THREE.TextureLoader().loadAsync(src).then(tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        TEXTURES[`custom:${src}`] = tex;
        FRAMES[`custom:${src}`] = 1;
        return tex;
      }).catch(err => {
        console.warn(`${MODULE_ID} | image ${src} could not be loaded`, err);
        return null;
      }).finally(() => { entry.done = true; });
      customTextures.set(src, entry);
    }
    return entry.promise;
  }));
}

/** True once every user image a trail needs has been tried (loaded or failed). */
function customTexturesReady(cfg) {
  return customSources(cfg).every(src => customTextures.get(src)?.done);
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
uniform float uColorize;
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
  // colorize: keep the image's light and shade, paint it in the particle colour
  vec3 rgb = uColorize > 0.5 ? vColor * dot(t.rgb, vec3(0.299, 0.587, 0.114)) : vColor * t.rgb;
  gl_FragColor = vec4(rgb, a);
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
  constructor(capacity, texture, blend, frames = 1, colorize = false) {
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
      uniforms: { uMap: { value: texture }, uScale: { value: 500 }, uGrid: { value: frames > 1 ? 2 : 1 }, uColorize: { value: colorize ? 1 : 0 } },
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
    this.cloud = new PointCloud(420, tex ?? TEXTURES.glow, def.blend, tex ? (FRAMES[def.tex] ?? 1) : 1, !!def.colorize);
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
        p.z = diePos[2] + z + (o.lift ?? 0) * u + (o.rise ?? 0) * u * p.age;   // lift: hover above the die
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

/**
 * Everything drawn for one die: the streaks, particles, auras and arcs of an effect definition
 * ({ribbons, layers, aura | auras, arcs} - a damage type's from EFFECTS, or a compiled custom trail).
 */
export class DieEmitter {
  constructor(box, group, mesh, def) {
    this.box = box;
    this.group = group;
    this.mesh = mesh;
    this.unit = dieRadius(mesh, group);
    const auras = def.auras ?? (def.aura ? [def.aura] : []);
    const arcs = Array.isArray(def.arcs) ? def.arcs : def.arcs ? [def.arcs] : [];
    this.layers = (def.layers ?? []).map(l => new Layer(l, this.unit));
    this.ribbons = (def.ribbons ?? []).map(r => new Ribbon(r, this.unit));
    this.auras = auras.map(a => new Aura(a, this.unit));
    this.arcs = arcs.map(a => new Arcs(a, this.unit));
    this.lastPos = null;
    this.vel = [0, 0, 0];
    this.still = 0;
    this.emitting = true;
    this.alive = true;
    // Sound: the effect's themes (none in the editor's silent preview). Bounces are read from the
    // velocity between frames in which the die actually moved (Dice So Nice animates at its own rate).
    this.sound = box.silent ? null : DieSound.for(def);
    this.moveVel = null;      // velocity over the last two moved frames, in die radii per second
    this.sinceMove = 0;
    this.wasResting = false;
    const scene = box.scene;
    for (const r of this.ribbons) scene.add(r.mesh);
    for (const a of this.auras) a.addTo(scene);
    for (const l of this.layers) scene.add(l.cloud.points);
    for (const a of this.arcs) scene.add(a.lines);
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

    // Bounce detection: velocity between frames in which the die moved, compared with the previous one.
    let impact = 0;
    this.sinceMove += dt;
    const moved = !this.lastPos || pos[0] !== this.lastPos[0] || pos[1] !== this.lastPos[1] || pos[2] !== this.lastPos[2];
    if (moved && this.lastPos && this.sinceMove > 0) {
      const k = 1 / (this.unit * this.sinceMove);
      const v = [(pos[0] - this.lastPos[0]) * k, (pos[1] - this.lastPos[1]) * k, (pos[2] - this.lastPos[2]) * k];
      if (this.moveVel) impact = bounceStrength(this.moveVel, v);
      this.moveVel = v;
    }
    if (moved) this.sinceMove = 0;
    this.lastPos = pos;

    const speed = Math.hypot(this.vel[0], this.vel[1], this.vel[2]) / this.unit;  // die radii per second
    this.still = speed < 0.6 ? this.still + dt : 0;
    const resting = this.still > 0.35 || this.box.rolling === false;
    // A die that slides to rest sends no final zero-velocity sample: the moment it comes to rest is its landing.
    if (resting && !this.wasResting && impact === 0 && this.moveVel) impact = bounceStrength(this.moveVel, [0, 0, 0]);
    this.wasResting = resting;
    if (this.sound) {
      const moveSpeed = this.moveVel ? Math.hypot(this.moveVel[0], this.moveVel[1], this.moveVel[2]) : 0;
      this.sound.update(dt, moveSpeed, impact, resting);
    }

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
    for (const a of this.auras) {
      a.update(dt, pos, auraStrength, scale, sizeMul, intensity);
      if (a.level > 0.02) live++;
    }
    for (const a of this.arcs) live += a.update(dt, pos, !resting || afterglow, resting, sizeMul);
    return live;
  }

  dispose() {
    for (const r of this.ribbons) r.dispose();
    for (const l of this.layers) l.cloud.dispose();
    for (const a of this.auras) a.dispose();
    for (const a of this.arcs) a.dispose();
    this.sound?.dispose();
    this.sound = null;
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
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  beginSoundFrame();
  if (game.settings.get(MODULE_ID, "enabled")) tickDice(dt);
  endSoundFrame(dt);   // the loops fade out and stop on their own once no die wants them
}

function tickDice(dt) {
  const box = game.dice3d?.box;
  if (!box?.scene || !THREE) return;

  // Find newly spawned, tagged dice
  for (const child of box.scene.children) {
    const mesh = child.children?.[0];
    if (!mesh?.options?.[TAG] || mesh.sim === undefined) continue;
    const key = mesh.uuid;
    if (emitters.has(key)) continue;
    const effect = effectForDie(mesh);
    if (!effect) continue;
    if (effect.cfg && !customTexturesReady(effect.cfg)) { loadCustomTextures(effect.cfg); continue; }   // next tick
    emitters.set(key, new DieEmitter(box, child, mesh, effect.def));
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

/**
 * Roll dice on the table with a trail: a damage type by name ("fire"), or a custom trail
 * ({layers: [...]}) as the editor builds them.
 */
async function preview(type = "fire", formula = "2d6") {
  if (type && typeof type === "object") return previewTrail(type, formula);
  const key = normalizeType(type);
  if (!key) {
    ui.notifications.warn(`${MODULE_ID}: unknown damage type "${type}". Known: ${Object.keys(EFFECTS).join(", ")}`);
    return;
  }
  return rollTagged(formula, { [TAG]: key });
}

/** Roll dice on the table with a custom trail (the editor's "Test roll"). */
export async function previewTrail(cfg, formula = "1d20") {
  setPreviewEffect(cfg);
  await loadThree();
  await loadCustomTextures(cfg);
  return rollTagged(formula, { [TAG]: "preview" });
}

async function rollTagged(formula, options) {
  if (!game.dice3d) {
    ui.notifications.warn(`${MODULE_ID}: Dice So Nice is not active.`);
    return;
  }
  await loadThree();
  const roll = await new Roll(formula).evaluate();
  for (const d of roll.dice) Object.assign(d.options, options);
  startTicker();
  return game.dice3d.showForRoll(roll, game.user, false);
}

/** What the editor's live preview needs from this file. */
export function renderContext() {
  return {
    THREE,
    DieEmitter,
    pointScale,
    intensity: Number(game.settings.get(MODULE_ID, "intensity") ?? 1) || 1,
    sizeMul: (Number(game.settings.get(MODULE_ID, "size") ?? 1) || 1) * BASE_WIDTH,
    afterglow: game.settings.get(MODULE_ID, "afterglow") ?? true
  };
}

export { loadThree };

async function previewAll(formula = "1d8") {
  for (const type of Object.keys(EFFECTS)) {
    ui.notifications.info(`${MODULE_ID}: ${type}`);
    await preview(type, formula);
  }
}

/**
 * Default trails for characters: every character gets a trail made of its class, species and
 * background designs (one layer each, styled after its subclass, lineage or background where a
 * style has that name) for every kind of roll that is not damage. A creature without a class (a
 * monster, an NPC) gets its creature type's design instead, and one with none of these a plain
 * Comet. It is saved on the character like a trail its player gave it, so it shows in the Dice
 * trails window and can be changed there; until it is saved, rolls and the window use it anyway.
 *
 * The default is applied once per character and again when its class, species or background
 * changes; kinds of roll the player gave a trail of their own (or took the trail off) are left
 * alone. One client writes it: the active GM, or without one the first active player owning it.
 */

import { MODULE_ID, FLAG_TRAILS, FLAG_DEFAULT } from "./constants.js";
import { DESIGNS, KINDS, normalizeConfig } from "./custom-trails.js";

/** Class design by class: the first pattern that matches the class's identifier or name wins. */
const CLASS_DESIGNS = [
  [/artificer/, "arcforge"], [/barbarian/, "bloodRage"], [/\bbard\b/, "encore"], [/cleric/, "divineHalo"],
  [/druid/, "wildGrowth"], [/fighter/, "steelSparks"], [/\bmonk\b/, "flowingKi"], [/paladin/, "sacredOath"],
  [/ranger/, "huntersMark"], [/rogue/, "shadowstep"], [/sorcerer/, "wildSurge"], [/warlock/, "eldritchPact"],
  [/wizard/, "spellscript"]
];

/** Species design by species; half-elf and half-orc come before elf and orc. */
const SPECIES_DESIGNS = [
  [/half[- ]?elf/, "twinHeritage"], [/half[- ]?orc/, "savageStrike"], [/aasimar/, "heavenlyWings"],
  [/dragonborn/, "dragonBreath"], [/dwarf|duergar/, "deepVein"], [/\b(elf|elven|drow|eladrin)\b/, "elvenGrace"],
  [/gnome/, "gnomishWhimsy"], [/goliath/, "titanStride"], [/halfling/, "halflingLuck"], [/\bhuman\b/, "heroicResolve"],
  [/\borc\b/, "adrenalineRush"], [/tiefling/, "infernalLegacy"]
];

/** Background design by background, including the older backgrounds closest to each. */
const BACKGROUND_DESIGNS = [
  [/acolyte/, "templeIncense"], [/artisan/, "craftwork"], [/charlatan/, "foolsGold"],
  [/criminal|urchin|\bspy\b/, "backAlley"], [/entertainer|gladiator/, "showstopper"], [/farmer|folk[- ]?hero/, "harvest"],
  [/\bguard\b|city[- ]?watch/, "nightWatch"], [/\bguide\b|outlander/, "pathfinder"], [/hermit/, "loneCandle"],
  [/merchant/, "coinShower"], [/noble|knight|courtier/, "nobleCrest"], [/\bsage\b/, "starChart"],
  [/sailor|pirate/, "seaSpray"], [/scribe/, "inkBlot"], [/soldier/, "warBanner"], [/wayfarer/, "dustyRoad"]
];

/** Design (and its style when the name has none) by creature type, for creatures without a class (dnd5e NPCs). */
const CREATURE_DESIGNS = [
  [/aberration/, "eldritchPact", "greatOldOne"], [/beast/, "wildGrowth", "grove"], [/celestial/, "heavenlyWings", "wings"],
  [/construct/, "arcforge", "brass"], [/dragon/, "dragonBreath", "red"], [/elemental/, "storm", "thunder"],
  [/\bfey\b/, "charm", "fae"], [/fiend/, "infernalLegacy", "infernal"], [/giant/, "titanStride", "stone"],
  [/humanoid/, "heroicResolve", "valor"], [/monstrosity/, "savageStrike", "blood"], [/ooze/, "tide", "swamp"],
  [/plant/, "wildGrowth", "spores"], [/undead/, "necrotic", "necrotic"]
];

/** The trail of a creature nothing else is known about. */
const FALLBACK = { design: "comet", style: "silver" };

/** Item types (dnd5e) whose changes can change a character's default trail. */
const SOURCE_TYPES = new Set(["class", "subclass", "race", "background"]);

const lower = s => String(s ?? "").toLowerCase();
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function designFor(table, text) {
  return table.find(([re]) => re.test(text))?.[1] ?? null;
}

/** A style of the design named in the text, else the given one (if it exists), else the design's first. */
function styleOr(design, text, fallback) {
  const styles = DESIGNS[design]?.styles ?? {};
  const named = styleFor(design, text);
  return named && named !== Object.keys(styles)[0] ? named : (styles[fallback] ? fallback : named);
}

/**
 * The style of a design whose name appears in the text as whole words ("Path of the Berserker" ->
 * Berserker, "Wood Elf" -> Wood Elf), longest name first; otherwise the design's first style.
 */
export function styleFor(design, text) {
  const styles = Object.entries(DESIGNS[design]?.styles ?? {});
  const t = lower(text);
  const byLength = [...styles].sort((a, b) => b[1].label.length - a[1].label.length);
  const hit = byLength.find(([, s]) => new RegExp(`\\b${escapeRegExp(lower(s.label))}\\b`).test(t));
  return (hit ?? styles[0])?.[0] ?? null;
}

/**
 * The default trail for a character described by plain text: its class (and subclass), species and
 * background names or identifiers, and for a creature without a class its creature type and name.
 * Missing or unknown parts get no layer; with no layer at all it is a plain Comet, so every character
 * has a trail.
 */
export function defaultTrail({ cls = "", subclass = "", species = "", background = "", creature = "", name = "" } = {}) {
  const layers = [];
  const add = (design, text, extra = {}) => {
    if (design) layers.push({ design, style: styleFor(design, text), ...extra });
  };
  // The class is the main streak; species and background are lighter so three layers stay readable.
  const clsDesign = designFor(CLASS_DESIGNS, lower(cls));
  const speciesDesign = designFor(SPECIES_DESIGNS, lower(species));
  add(clsDesign, subclass);
  // Without a class, the creature type is the main streak (an elf humanoid is shown by its species instead).
  const type = clsDesign ? null : CREATURE_DESIGNS.find(([re]) => re.test(lower(creature)));
  if (type && !(speciesDesign && type[1] === "heroicResolve")) {
    layers.push({ design: type[1], style: styleOr(type[1], `${name} ${creature}`, type[2]) });
  }
  // Species and background are lighter, unless one of them is the main streak.
  const light = () => (layers.length ? { density: 0.6, alpha: 0.85 } : {});
  add(speciesDesign, species, light());
  add(designFor(BACKGROUND_DESIGNS, lower(background)), background, light());
  return normalizeConfig({ layers: layers.length ? layers : [FALLBACK] });
}

/* ======================================================================== */
/*  Reading a character (dnd5e)                                             */
/* ======================================================================== */

const itemText = item => item ? `${item.system?.identifier ?? ""} ${item.name ?? ""}` : "";

/** The class a character is mostly: its original class, else the one with the most levels. */
function mainClass(actor) {
  const classes = actor.items.filter(i => i.type === "class");
  if (!classes.length) return null;
  const original = actor.system?.details?.originalClass;
  return classes.find(c => c.id === original)
    ?? classes.sort((a, b) => (b.system?.levels ?? 0) - (a.system?.levels ?? 0))[0];
}

/** What a character's default trail is made of, as plain text. */
export function characterSources(actor) {
  const cls = mainClass(actor);
  const id = cls?.system?.identifier;
  const subclass = cls?.subclass
    ?? actor.items.find(i => i.type === "subclass" && id && i.system?.classIdentifier === id);
  const details = actor.system?.details ?? {};
  // An NPC's creature type: {value: "humanoid", subtype: "elf", custom: ...} in dnd5e, or plain text.
  const type = details.type ?? actor.system?.traits?.type ?? null;
  const creature = typeof type === "string" ? type : [type?.value, type?.custom].filter(Boolean).join(" ");
  const subtype = typeof type === "object" ? type?.subtype ?? "" : "";
  const species = actor.items.find(i => i.type === "race")
    ?? (typeof details.race === "string" && details.race ? { name: details.race } : subtype ? { name: subtype } : null);
  const background = actor.items.find(i => i.type === "background")
    ?? (typeof details.background === "string" ? { name: details.background } : null);
  return {
    cls: itemText(cls), subclass: itemText(subclass), species: itemText(species), background: itemText(background),
    creature, name: actor.name ?? ""
  };
}

/* ======================================================================== */
/*  Saving it on the character                                              */
/* ======================================================================== */

const same = (a, b) => JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));

/** Whether this client writes the default for the actor, so only one client does. */
function isWriter(actor) {
  const gm = game.users.activeGM;
  if (gm) return gm.isSelf;
  // While the GM's own client is not counted as active yet (early in "ready"), it still writes.
  if (game.user.isGM) return true;
  if (!actor.isOwner) return false;
  const owners = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  owners.sort((a, b) => a.id.localeCompare(b.id));
  return owners[0]?.isSelf ?? false;
}

/** An Actor (a character, an NPC or an unlinked token's own actor) that can carry trails. */
const isActor = doc => doc?.documentName === "Actor" && !doc.pack;

/**
 * The update that saves an actor's default trail: on every kind of roll that has none yet (the first
 * time) or still has the previous default (when its class, species or background changed), except
 * the kinds in `skip`. null if there is nothing to save.
 */
export function defaultTrailUpdate(actor, skip = []) {
  if (!isActor(actor) || !enabled()) return null;
  const cfg = defaultTrail(characterSources(actor));
  const prev = actor.getFlag(MODULE_ID, FLAG_DEFAULT);
  if (prev?.layers && same(prev, cfg)) return null;
  const current = actor.getFlag(MODULE_ID, FLAG_TRAILS) ?? {};
  const update = { [`flags.${MODULE_ID}.${FLAG_DEFAULT}`]: cfg };
  for (const k of KINDS) {
    if (skip.includes(k)) continue;
    const cur = current[k]?.layers ? current[k] : null;
    // Before the first default every empty kind gets it; afterwards an empty kind was cleared on purpose.
    const take = prev?.layers ? cur && same(cur, prev) : !cur;
    if (take) update[`flags.${MODULE_ID}.${FLAG_TRAILS}.${k}`] = cfg;
  }
  return update;
}

/**
 * The default trail an actor shows on a kind of roll before it has been saved on it (null once it
 * has been: from then on the saved trails count, and a kind taken off stays off).
 */
export function unsavedDefault(actor, kind) {
  if (!isActor(actor) || !KINDS.includes(kind) || !enabled()) return null;
  if (actor.getFlag(MODULE_ID, FLAG_DEFAULT)?.layers) return null;
  return defaultTrail(characterSources(actor));
}

/** Save a character's default trail now. */
export async function applyDefaultTrail(actor) {
  const update = defaultTrailUpdate(actor);
  if (!update) return false;
  await actor.update(update);
  return true;
}

function enabled() {
  try {
    return game.settings.get(MODULE_ID, "defaultTrails");
  } catch (_) {
    return false;
  }
}

const pending = new Map();
/** Apply an actor's default a moment later, once the items of an import or level-up have all landed. */
function schedule(actor) {
  if (!isActor(actor) || !enabled() || !isWriter(actor)) return;
  const key = actor.uuid;
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    // An unlinked token's actor is rebuilt on every change, so take its token's current one.
    const a = actor.isToken ? actor.token?.actor : game.actors.get(actor.id);
    if (a) applyDefaultTrail(a).catch(err => console.error(`${MODULE_ID} | default trail for ${a.name}`, err));
  }, 250));
}

/**
 * Save the default trail on every actor in the world and on the unlinked tokens of the viewed scene
 * (their own actors), in a few batched updates.
 */
export async function applyAllDefaultTrails() {
  if (!enabled()) return;
  try {
    const updates = [];
    for (const actor of game.actors ?? []) {
      if (!isWriter(actor)) continue;
      const update = defaultTrailUpdate(actor);
      if (update) updates.push({ _id: actor.id, ...update });
    }
    for (let i = 0; i < updates.length; i += 100) {
      await CONFIG.Actor.documentClass.updateDocuments(updates.slice(i, i + 100));
    }
    for (const token of canvas?.scene?.tokens ?? []) if (!token.actorLink && token.actor) schedule(token.actor);
  } catch (err) {
    console.error(`${MODULE_ID} | default trails`, err);
  }
}

Hooks.once("init", () => {
  // World scope on purpose, unlike the other settings: one client (the GM, or an owner) writes the defaults
  // for the whole world, so whether they are applied must not depend on that one client's own choice.
  game.settings.register(MODULE_ID, "defaultTrails", {
    name: "DXDT.Settings.DefaultTrails.Name", hint: "DXDT.Settings.DefaultTrails.Hint",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: on => { if (on) applyAllDefaultTrails(); }
  });
});

Hooks.once("ready", applyAllDefaultTrails);
Hooks.on("createActor", actor => schedule(actor));
// Species and background can also be plain text in the actor's details (and the original class an id there).
Hooks.on("updateActor", (actor, changes) => {
  if (changes?.system?.details) schedule(actor);
});
// A user who logs in can become the one who writes (the GM, or the first owner while no GM is on).
Hooks.on("userConnected", () => applyAllDefaultTrails());
// Unlinked tokens keep their own actors: save theirs when they are placed, and those of a scene when it is viewed.
Hooks.on("createToken", token => { if (!token.actorLink && token.actor) schedule(token.actor); });
Hooks.on("canvasReady", cv => {
  for (const token of cv?.scene?.tokens ?? []) if (!token.actorLink && token.actor) schedule(token.actor);
});
for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, item => {
    if (SOURCE_TYPES.has(item?.type) && isActor(item.parent)) schedule(item.parent);
  });
}

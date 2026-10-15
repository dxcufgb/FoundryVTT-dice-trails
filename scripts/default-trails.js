/**
 * Default trails for characters: every character gets a trail made of its class, species and
 * background designs (one layer each, styled after its subclass, lineage or background where a
 * style has that name) for every kind of roll that is not damage. It is saved on the character
 * like a trail its player gave it, so it shows in the Dice trails window and can be changed there.
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

/** Item types (dnd5e) whose changes can change a character's default trail. */
const SOURCE_TYPES = new Set(["class", "subclass", "race", "background"]);

const lower = s => String(s ?? "").toLowerCase();
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function designFor(table, text) {
  return table.find(([re]) => re.test(text))?.[1] ?? null;
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
 * background names or identifiers. Missing or unknown parts get no layer; null if none is known.
 */
export function defaultTrail({ cls = "", subclass = "", species = "", background = "" } = {}) {
  const layers = [];
  const add = (design, text, extra = {}) => {
    if (design) layers.push({ design, style: styleFor(design, text), ...extra });
  };
  // The class is the main streak; species and background are lighter so three layers stay readable.
  add(designFor(CLASS_DESIGNS, lower(cls)), subclass);
  add(designFor(SPECIES_DESIGNS, lower(species)), species, { density: 0.6, alpha: 0.85 });
  add(designFor(BACKGROUND_DESIGNS, lower(background)), background, { density: 0.6, alpha: 0.85 });
  return layers.length ? normalizeConfig({ layers }) : null;
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
  const species = actor.items.find(i => i.type === "race") ?? (typeof details.race === "string" ? { name: details.race } : null);
  const background = actor.items.find(i => i.type === "background")
    ?? (typeof details.background === "string" ? { name: details.background } : null);
  return { cls: itemText(cls), subclass: itemText(subclass), species: itemText(species), background: itemText(background) };
}

/* ======================================================================== */
/*  Saving it on the character                                              */
/* ======================================================================== */

const same = (a, b) => JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));

/** Whether this client writes the default for the actor, so only one client does. */
function isWriter(actor) {
  const gm = game.users.activeGM;
  if (gm) return gm.isSelf;
  if (!actor.isOwner) return false;
  const owners = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  owners.sort((a, b) => a.id.localeCompare(b.id));
  return owners[0]?.isSelf ?? false;
}

/**
 * Give a character its default trail on every kind of roll that has none yet (the first time) or
 * still has the previous default (when its class, species or background changed).
 */
export async function applyDefaultTrail(actor) {
  if (!actor || actor.pack || actor.isToken) return false;
  const cfg = defaultTrail(characterSources(actor));
  if (!cfg) return false;
  const prev = actor.getFlag(MODULE_ID, FLAG_DEFAULT);
  if (prev?.layers && same(prev, cfg)) return false;
  const current = actor.getFlag(MODULE_ID, FLAG_TRAILS) ?? {};
  const update = { [`flags.${MODULE_ID}.${FLAG_DEFAULT}`]: cfg };
  for (const k of KINDS) {
    const cur = current[k]?.layers ? current[k] : null;
    // Before the first default every empty kind gets it; afterwards an empty kind was cleared on purpose.
    const take = prev?.layers ? cur && same(cur, prev) : !cur;
    if (take) update[`flags.${MODULE_ID}.${FLAG_TRAILS}.${k}`] = cfg;
  }
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
  if (!actor || actor.pack || actor.isToken || !enabled() || !isWriter(actor)) return;
  clearTimeout(pending.get(actor.id));
  pending.set(actor.id, setTimeout(() => {
    pending.delete(actor.id);
    const a = game.actors.get(actor.id);
    if (a) applyDefaultTrail(a).catch(err => console.error(`${MODULE_ID} | default trail for ${a.name}`, err));
  }, 250));
}

/** Give every character in the world its default trail. */
export function applyAllDefaultTrails() {
  for (const actor of game.actors ?? []) schedule(actor);
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
for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, item => {
    if (SOURCE_TYPES.has(item?.type) && item.parent?.documentName === "Actor") schedule(item.parent);
  });
}

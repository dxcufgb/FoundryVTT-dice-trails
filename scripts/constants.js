export const MODULE_ID = "dxcufgbs-dice-trails";

/** Die option that names the trail: a damage type, "custom" (a user's trail) or "preview" (the editor's). */
export const TAG = "dxTrail";
/** Die options of a custom trail: the kind of roll and the user whose trail it is. */
export const TAG_KIND = "dxTrailKind";
export const TAG_USER = "dxTrailUser";
/** Die option of a custom trail that belongs to a character: a reference made by ownerRef() (dice-trails.js). */
export const TAG_OWNER = "dxTrailOwner";

/**
 * Where custom trails live: flags on a User (a player's own trails, which follow them to any computer) or on
 * an Actor (a character's; an unlinked token's actor keeps them on that token, so every token can differ).
 */
export const FLAG_PRESETS = "presets";
export const FLAG_TRAILS = "trails";

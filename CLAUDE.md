# Dxcufgb's dice trails

FoundryVTT v13 module (id `dxcufgbs-dice-trails`, the install folder must have the same name) that requires
Dice So Nice 5. Damage dice get a trail of their damage type while they roll; for every other kind of roll each
user (or character / token) designs a trail of up to 20 layers in the **Dice trails** window, and everyone sees it.
The trails are drawn with Dice So Nice's own three.js (`modules/dice-so-nice/libs/three.module.min.js`) in its 3D
scene, not with PIXI. Every trail also has a sound theme. No build step and no npm dependencies; the shipped
textures and sounds are made by Python scripts in `tools/`.

## Layout
- `scripts/dice-trails.js` – entry point: settings, API, Token-controls button, `diceSoNiceRollStart` tagging (damage type or custom trail in the die options `TAG`, `TAG_KIND`, `TAG_USER`, `TAG_OWNER`), `EFFECTS` (the 15 damage types, each built from its design in `DESIGNS`), `ALIASES`, trail storage on User/Actor flags (`trails`, `setTrail`, `clearTrail`, presets), textures, the renderer (`PointCloud`, `Layer`, `Aura`, `Arcs`, `Ribbon`, `DieEmitter`) and the ticker. The comment above `EFFECTS` is the field reference for effects.
- `scripts/custom-trails.js` – no Foundry or three.js dependencies: `DESIGNS` (76 designs, each `{label, icon, sound, styles, build}`), `DESIGN_CATEGORIES`, `KINDS`, `SOUNDS`, `MOTIONS`, `MAX_LAYERS`, `normalizeLayer` / `normalizeConfig` (clamps every field), `compileTrail`.
- `scripts/default-trails.js` – a character's default trail from its class, species and background (creature type for NPCs, a silver Comet otherwise); written by one client (`isWriter`: the active GM, else the first active owner); world setting `defaultTrails`.
- `scripts/trail-editor.js`, `templates/editor.hbs`, `styles/dice-trails.css` – the Dice trails window (ApplicationV2) with its own small three.js preview (`TrailPreview`, own `WebGLRenderer` and `requestAnimationFrame` loop).
- `scripts/trail-sounds.js` – Web Audio on Foundry's interface context: one shared loop per theme following die speed, a hit per bounce (`bounceStrength`), caps (`MAX_HITS`, `HIT_GAP`).
- `scripts/transfer.js` – `.dice-trail.json` export/import (format `dxcufgbs-dice-trails.trail`, `FORMAT_VERSION` 1) with embedded images, uploaded on import to `worlds/<world>/dxcufgbs-dice-trails/imported/`.
- `scripts/constants.js` – `MODULE_ID`, die option tags, flag names (`trails`, `presets`, `defaultTrail`).
- `textures/` (Kenney CC0 sheets plus own sheets), `sounds/<theme>-loop.ogg` / `-hit.ogg` (own, CC0). `tools/make-textures.py` (Pillow, numpy) and `tools/make-sounds.py` (numpy, ffmpeg) generate them, seeded so output is reproducible; they are not shipped (`.github/foundry-module.json` lists what goes into the zip).
- `.github/workflows/ci.yml` / `release.yml` – thin callers of `dxcufgb/foundry-module-ci` (checks, packaging, release); identical in every module, do not edit here.

## Conventions
- `MODULE_ID` must equal `id` in `module.json`; every visible setting needs a Name and Hint in `lang/en.json` (CI checks both). UI strings are under `DXDT.*`; design and style labels are plain English in `DESIGNS`, not in `lang/en.json`.
- A complete new **design**: an entry in `DESIGNS` with `label`, `icon`, a `sound` that is in `SOUNDS`, at least one style with `colors: [bright, main, dark]`, and `build(p)` using only `p.bright` / `p.main` / `p.dark` and `mix()` for colours (so styles and the user's own colour work); its id in a `DESIGN_CATEGORIES` group (otherwise it lands under "Other"); a row in the README designs table and the updated design count there (and in `module.json`'s description, which says 76 designs). A layer holds at most 420 particles: `rate × max life` well under that.
- A changed **damage type** look: its `EFFECTS` entry stays `...DESIGNS.<design>.build({...})` so the type and its design never drift apart; update the README damage-type table and the `// Signature:` comment.
- A new **sound theme**: the id in `SOUNDS`, its generator in `THEMES` of `tools/make-sounds.py`, both `.ogg` files, and a `DXDT.Sound.<theme>` string.
- New particle sheet: add it to `SPRITES` / `SPRITE_SIZE`, and to `tools/make-textures.py` if it is the module's own.
- Update `README.md` when designs, settings or the API change.

## Review focus
- **Per-frame cost**: the ticker (`tick` on `canvas.app.ticker`) is always on once ready, so its idle path must stay cheap; per die and frame, no new objects beyond what `DieEmitter.update` already does, no document lookups or `normalizeConfig` (those happen once per die in `effectForDie`), no new three.js materials or geometries. Compiled trails are cached in `compiled`.
- **Cleanup**: every `DieEmitter` is disposed (geometries, materials, removed from the scene, its `DieSound`) when its die leaves Dice So Nice's scene; the editor's `close()` must cancel the animation frame, dispose the preview renderer and clear `setPreviewEffect`. Sound loops must fade and stop when no die wants them, and `stopAllSounds` when sounds are turned off.
- **Dice So Nice**: guard every use (`game.dice3d`, `box.scene`, mesh `options`); a missing or changed Dice So Nice must log and do nothing, never throw from a hook.
- **Untrusted trail data**: trails come from other users' and actors' flags and from imported files; everything goes through `normalizeConfig` / `normalizeLayer` before use. Keep the clamps, the `isHex` check and the `javascript:` / `data:text` filter on `src`; on import, images are only accepted by sniffed bytes (PNG, WebP, JPEG, GIF, AVIF; never SVG) and under `MAX_IMAGE_BYTES`. Note that a custom layer's `src` is loaded by every client that sees the roll.
- **Permissions**: `setTrail` / `clearTrail` update the owner directly, so the editor only offers owners the user may update (own User, owned actors); only one client writes default trails (`isWriter`). Strings put into dialog HTML go through the editor's `escapeHTML`; templates use `{{ }}` only.
- **Setting scopes**: looks, sounds and `showOthers` are `client`; only `defaultTrails` is `world` (one writer for the world). Trails themselves are flags (User or Actor), not settings.
- **Roll kinds**: `rollKind` must keep returning `null` for damage and healing so those dice keep their damage-type trail; `KINDS` is stored data (flag keys), so renaming a kind loses saved trails.
- Changing a design's id or a style id breaks saved trails, presets and exported files (they fall back to the first style / Comet): flag it.

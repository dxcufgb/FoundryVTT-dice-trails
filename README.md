# Dxcufgb's damage dice trails

Gives [Dice So Nice](https://foundryvtt.com/packages/dice-so-nice) dice a streak of their damage type while they roll, so damage dice look charged with their element: a tail of fire, a jagged lightning bolt, a frost streak, black death-smoke and more. For every other roll (attacks, checks, saves, initiative, ...) you design your own trail in the **Dice trails** window, and everyone at the table sees it on your rolls.

**Foundry VTT:** v13 · **Requires:** Dice So Nice 5 · tested with dnd5e 5.2.5

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-dice-trails/releases/latest/download/module.json
```

## Damage type trails

Every die rolled for a damage type drags a streak of that element along its flight path (long when it's fast, shrinking as it lands), textured with flowing wisps, crackles or flame shapes, with a glowing aura and a few accent particles:

| Type | Streak |
| --- | --- |
| Fire | Glowing fire puffs that swell and rise, cooling from white-hot to deep red, with thin smoke |
| Cold | Pale icy streak in freezing mist, falling ice shards and snow glints |
| Lightning | Thin, violently jagged white bolt in a crackling blue glow, with arcs jumping off the die |
| Thunder | Dark indigo roar with big white shockwave rings bursting off the die |
| Acid | Neon yellow-green streak dripping sizzling droplets, caustic fumes |
| Poison | Thick, billowing green toxic cloud, sickly purple at the edges |
| Necrotic | Black death-smoke pulled into the die, with ghostly green soul-wisps |
| Radiant | Wide golden sunbeam with a white-gold core and star glints |
| Force | Magenta-violet arcane energy with swirls orbiting the die |
| Psychic | Two hot-pink strands weaving around each other, spinning mind-swirls |
| Bludgeoning | Heavy dust cloud, flying rock chips and dust rings |
| Piercing | Needle-thin, razor-straight silver streak with speed dashes and a glinting point |
| Slashing | Crimson slash marks around a silver-and-red swing, flung droplets |
| Healing | Soft green life-light with little hearts rising from the die |
| Temp HP | Steel-blue shield streak with a turning ward-rune around the die and orbiting shards |

- **dnd5e**: each die gets the damage type of the damage part it belongs to, so "1d8 slashing + 2d6 fire" gives slashing dice and fire dice.
- **Any system**: dice with a damage type as flavor, e.g. `1d6[fire]`, get the matching streak.
- Works for rolls shown from other players too.

## Your own trails for regular rolls

Open the **Dice trails** window from the d20 button in the Token Controls, or from **Configure Settings → Dxcufgb's damage dice trails → Open the Dice trails window**. It works like a paint box:

- **61 designs, each with several styles,** picked from a dropdown grouped by category (Elements, Magic, Light & Stars, Nature, Stone & Steel, Classes, Species, Backgrounds). 13 are made for the D&D classes, 12 for the D&D species and 16 for the D&D backgrounds; their styles include subclass, lineage and ancestry names (Battle Smith, Eldritch Knight, Wood Elf, Storm Giant, ...):

  | Design | Styles |
  | --- | --- |
  | Flame | Fire, Blue Flame, Fel Fire, Shadowflame |
  | Frost | Frost, Glacier, Rime, Amethyst |
  | Storm | Thunder, Arcane, Golden, Crimson |
  | Magic Smoke | Arcane, Shadow, Emerald, Crimson |
  | Sunbeam | Holy, Sunfire, Moonlight, Eclipse |
  | Arcane | Arcane, Fey, Infernal, Void |
  | Stardust | Stardust, Fireflies, Embers, Arcane Motes |
  | Comet | Silver, Gold, Azure, Rose |
  | Rainbow | Prism, Pastel, Neon, Aurora |
  | Necrotic | Necrotic, Shadow, Blood, Bone |
  | Tide | Ocean, Tropical, Swamp, Blood |
  | Arcane Ward | Arcane, Holy, Nature, Infernal |
  | Charm | Rose, Lovesick, Crimson, Fae |
  | Leaves & Petals | Cherry Blossom, Autumn Leaves, Spring Leaves, Snowfall |
  | Bard's Song | Golden, Silver, Rose, Azure |
  | Knives | Steel, Assassin, Gilded, Spectral |
  | Orbiting Stones | Granite, Sandstone, Obsidian, Jade |
  | Fire Trail | Fire, Hellfire, Soulfire, Witchfire |
  | Starlight | Starlight, Moonsilver, Sungold, Rose Star |
  | Shadow Wisp | Shadow, Midnight, Ashen, Abyssal |
  | Arcforge (Artificer) | Brass, Copper, Alchemist, Battle Smith |
  | Blood Rage (Barbarian) | Rage, Berserker, Storm Herald, Wild Heart |
  | Encore (Bard) | Ballad, Lullaby, Jig, Dirge |
  | Divine Halo (Cleric) | Life, Light, Twilight, Grave |
  | Wild Growth (Druid) | Grove, Autumn, Moon, Spores |
  | Steel Sparks (Fighter) | Forge, Steel, Champion, Eldritch Knight |
  | Flowing Ki (Monk) | Open Hand, Elements, Shadow, Mercy |
  | Sacred Oath (Paladin) | Devotion, Vengeance, Ancients, Oathbreaker |
  | Hunter's Mark (Ranger) | Hunter, Gloom Stalker, Beast Master, Fey Wanderer |
  | Shadowstep (Rogue) | Thief, Assassin, Arcane Trickster, Swashbuckler |
  | Wild Surge (Sorcerer) | Wild Magic, Draconic, Storm, Aberrant |
  | Eldritch Pact (Warlock) | Eldritch, Fiend, Great Old One, Archfey |
  | Spellscript (Wizard) | Evocation, Abjuration, Necromancy, Illusion |
  | Heavenly Wings (Aasimar) | Heavenly Wings, Inner Radiance, Necrotic Shroud, Dawn |
  | Dragon Breath (Dragonborn) | Red, Blue, Green, Gold |
  | Deep Vein (Dwarf) | Gold Vein, Mithral, Ruby, Emerald |
  | Elven Grace (Elf) | High Elf, Wood Elf, Drow, Eladrin |
  | Gnomish Whimsy (Gnome) | Forest Gnome, Rock Gnome, Deep Gnome, Illusion |
  | Titan Stride (Goliath) | Stone Giant, Frost Giant, Fire Giant, Storm Giant |
  | Halfling Luck (Halfling) | Lightfoot, Stout, Hearth, Ghostwise |
  | Heroic Resolve (Human) | Valor, Ambition, Wanderlust, Versatile |
  | Adrenaline Rush (Orc) | Warpaint, Ironjaw, Bonepaint, Stormcry |
  | Infernal Legacy (Tiefling) | Infernal, Abyssal, Chthonic, Brimstone |
  | Twin Heritage (Half-Elf) | Sun & Moon, Leaf & Flame, Sea & Sky, Rose & Ivy |
  | Savage Strike (Half-Orc) | Blood, Steel, Bonecrusher, Venom |
  | Temple Incense (Acolyte) | Sandalwood, Myrrh, Moonshrine, Grove Shrine |
  | Craftwork (Artisan) | Woodwright, Smith, Glassblower, Potter |
  | Fool's Gold (Charlatan) | Fool's Gold, Counterfeit, Snake Oil, Masquerade |
  | Back Alley (Criminal) | Cutpurse, Smuggler, Fence, Thug |
  | Showstopper (Entertainer) | Carnival, Opera, Jester, Moonlit Stage |
  | Harvest (Farmer) | Wheat, Orchard, Hayfield, Pumpkin Patch |
  | Night Watch (Guard) | Lantern, City Watch, Gatehouse Torch, Moonwatch |
  | Pathfinder (Guide) | North Star, Forest Trail, Desert Road, Tundra |
  | Lone Candle (Hermit) | Candle, Cave, Mountain, Marsh |
  | Coin Shower (Merchant) | Gold, Silver, Copper, Platinum |
  | Noble Crest (Noble) | Royal, Imperial, Silver Court, Emerald Court |
  | Star Chart (Sage) | Astronomer, Archivist, Seer, Naturalist |
  | Sea Spray (Sailor) | Open Sea, Tropic, Storm Sea, Pirate |
  | Ink Blot (Scribe) | Iron Gall, Sepia, Vermilion, Gold Leaf |
  | War Banner (Soldier) | Legion, Iron Guard, Mercenary, Highland |
  | Dusty Road (Wayfarer) | Sunset, Autumn Road, Rainy Road, Night Road |

- **Layers: combine effects into one trail.** Stack up to 20 layers, for example Blue Flame + Spectral Knives + Stardust. Each layer has its own design, style, fine-tuning and effects; reorder, duplicate or remove them. Every layer is drawn in full on every die, so a trail with many busy layers costs frames on slower computers: lower the **Trail intensity** setting or the layers' *Particles* if rolls stutter.
- **Your own image as a layer.** Pick *Your image*, then **Browse** to an image or **Upload** a PNG (it goes into `worlds/<your world>/dxcufgbs-dice-trails/`). Choose how it moves (trailing behind the die, circling, rising, bursting out, fluttering down, spinning on the die), its size and how many, and its colour: *Original colours*, *Tint* or *Recolour*, optionally glowing like light (additive blending). Uploading needs Foundry's *Upload New Files* permission; without it you can still pick an image that is already on the server, or type its path or URL.
- **Fine-tune every layer:** width, length, speed, opacity, number of particles, and an own colour instead of the style's.
- **Effects for every layer:** *Glow* (an aura around the die), *Pulse* (a beat along the streak and aura), *Sparkle* (glints) and *Wave* (a weaving motion).
- **Live preview:** a die flies through the window with the trail, rests a moment and goes again; every change shows at once. **Test roll** throws a d20 on the table with it.
- **Give it to your rolls:** tick the kinds of roll and click **Use for ticked rolls**. Each kind can have a different trail:

  | Kind | Rolls |
  | --- | --- |
  | Attack rolls | weapon and spell attacks |
  | Checks | ability, skill and tool checks |
  | Saving throws | saving throws and concentration |
  | Death saves | death saving throws |
  | Initiative | initiative rolls |
  | Other rolls | everything else that is not damage or healing: hit dice, plain `/roll` commands, tables, ... |

  The kind is read from the dnd5e and pf2e roll flags; in other systems rolls are *Other rolls* unless they are initiative. Damage and healing dice always keep their damage type trail.
- **Everyone sees them.** Trails belong to your user, so they follow you to any computer, and other players see your trails on your rolls (each player can turn that off for themselves).
- **Saved trails:** save the whole stack under a name and load it again later.
- **Export / import:** **Export to file** saves the trail in the editor as a single `.dice-trail.json` file, with every image of your own packed inside it. **Import from file** in any other world or Foundry adds those images to that world (in `worlds/<world>/dxcufgbs-dice-trails/imported/`, each image only once), loads the trail into the editor and adds it to your saved trails. Importing images needs permission to upload files; otherwise ask the GM to import it. PNG, WebP, JPEG, GIF and AVIF images are packed; SVG images and web addresses that don't allow it are kept as links only.

## Sound effects

Every trail sounds like its element, in two parts:

- **While the die flies:** a quiet loop that follows the die's speed, so a fast die roars, crackles or hums and the sound dies away as it slows: a fire roars and crackles, ice crackles and creaks, lightning charges the air with static, thunder rumbles, acid sizzles, poison bubbles like a cauldron, necrotic drones and moans, radiant shimmers, healing holds a choir's chord, a comet whooshes, the Bard's Song plays a tune, and so on.
- **When the die bounces:** the moment a die hits the table, a wall or another die, its trail bursts out loud: a flare-up of flame, ice breaking, a lightning strike, a thunder boom, a cauldron boiling over, a stone thud, a blade clang, a chime of bells, a splash, ... The harder the impact, the louder and deeper the hit, and the loop swells with it, so the bounces are what you hear most. The final landing counts as a (soft) bounce too.

Every damage type and every design has its own sound theme (the Flame design sounds like fire damage, Frost like cold, Storm like lightning, Orbiting Stones like bludgeoning, Knives like slashing, Arcane Ward like temporary HP, ...). Damage dice always keep their damage type's sound. For your own trails you choose: every layer has a **Sound** picker in the Dice trails window with its design's own sound, *None*, or any of the 23 themes, so a Blue Flame can crackle like ice or a layer made of your own image can roar like fire (an image is silent unless you give it a sound). Picking one plays its bounce, and the speaker button plays it again. A trail with several layers plays all of their sounds, each as loud as its layer's opacity. The sounds play on Foundry's **Interface** audio channel, so that volume slider applies on top of the module's own **Sound volume** setting, and you can switch them off with **Trail sounds**. The live preview in the Dice trails window is silent (it would loop forever while you design); **Test roll** plays the sound on the table.

All sounds are the module's own: `tools/make-sounds.py` synthesizes them from noise, sine waves, filters and envelopes, with no recordings or third-party samples, and they are dedicated to the public domain (CC0 1.0), see [sounds/LICENSE-CC0-generated.txt](sounds/LICENSE-CC0-generated.txt).

## Settings (per user)

- **Show dice trails**: on/off.
- **Trail intensity** (0.25–2): how bright, long and busy the trails are. Lower it if rolls stutter.
- **Trail width** (0.25–2): how wide the streaks, glow and particles are. The default is a narrow streak about as wide as the die.
- **Keep glowing after landing**: dice keep a faint aura on the table.
- **Trail sounds**: on/off.
- **Sound volume** (0–2, default 0.2): how loud the trail sounds are, on top of Foundry's Interface volume.
- **Your trails for regular rolls**: opens the Dice trails window.
- **Show other players' trails**: show the trails the other players designed on their rolls.

## API

```js
const api = game.modules.get("dxcufgbs-dice-trails").api;
api.open();                                                   // the Dice trails window
api.preview("fire");                                          // roll dice with a damage type trail
api.previewAll();                                             // every damage type in turn
api.preview({ layers: [{ design: "flame", style: "blue" }] });   // roll dice with a custom trail
api.setTrail("attack", { layers: [                            // your trail for attack rolls, bottom to top
  { design: "storm", style: "golden", glow: 0.5 },
  { design: "custom", src: "path/to/crest.png", motion: "orbit", count: 4, size: 0.8, colorMode: "colorize", color: "#ff8a2a" }
] });
api.setTrail(["check", "save"], cfg);                         // several kinds at once
api.clearTrail("attack");
api.trails();                                                 // your trails by kind; api.trails(user) another user's
api.designs; api.kinds; api.types;                            // designs and styles, kinds of roll, damage types
api.sounds; api.playSound("thunder", 1);                      // the sound themes; play one's bounce hit (strength 0-1)
api.presets();                                                // your saved trails
await api.exportTrail(cfg, "My trail");                       // download it as one file, images included
const { name, cfg } = await api.importTrail(file);            // read such a file (a File or its text)
```

## License

Code: [MIT](LICENSE).

Particle and streak textures in `textures/`: the Kenney sprites (bolts, debris, flames, heart, ring, rune, slashes, smoke, stars, strips, twirls) are from the [Particle Pack](https://kenney.nl/assets/particle-pack) by Kenney (www.kenney.nl), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain), see [textures/LICENSE-Kenney.txt](textures/LICENSE-Kenney.txt). The leaves, petals, snowflakes, notes, glyphs, knives, stones, flares, bubbles, drops, skulls and coins are drawn by the module's own script (`tools/make-textures.py`) and dedicated to the public domain too (CC0 1.0), see [textures/LICENSE-CC0-generated.txt](textures/LICENSE-CC0-generated.txt).

Sound effects in `sounds/`: synthesized by the module's own script (`tools/make-sounds.py`), no recordings or third-party samples, dedicated to the public domain (CC0 1.0), see [sounds/LICENSE-CC0-generated.txt](sounds/LICENSE-CC0-generated.txt). Everything is free to use, change and share.

## Releasing

For the maintainer: **Actions → Release module → Run workflow**, type the version (for example `1.2.3`) and run it. The module is checked and packaged first; only then is the release `v1.2.3` published with `module.json` and `module.zip`. CI and releases come from [dxcufgb/foundry-module-ci](https://github.com/dxcufgb/foundry-module-ci), the same for every module.

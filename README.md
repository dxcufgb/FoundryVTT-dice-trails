# Dxcufgb's damage dice trails

Gives [Dice So Nice](https://foundryvtt.com/packages/dice-so-nice) dice a streak of their damage type while they roll, so damage dice look charged with their element: a tail of fire, a jagged lightning bolt, a frost streak, black death-smoke and more.

**Foundry VTT:** v13 · **Requires:** Dice So Nice 5 · tested with dnd5e 5.2.5

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-dice-trails/releases/latest/download/module.json
```

## Features

Every die rolled for a damage type drags a streak of that element along its flight path (long when it's fast, shrinking as it lands), textured with flowing wisps, crackles or flame shapes, with a glowing aura and a few accent particles:

| Type | Streak |
| --- | --- |
| Fire | Orange flame tail with licking flame tongues, rising embers and smoke |
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
- Untyped dice (attacks, saves, …) are unchanged. Works for rolls shown from other players too.

## Settings (per user)

- **Show damage type trails**: on/off.
- **Trail intensity** (0.25–2): how bright, long and busy the trails are. Lower it if rolls stutter.
- **Trail width** (0.25–2): how wide the streaks, glow and particles are. The default is a narrow streak about as wide as the die.
- **Keep glowing after landing**: dice keep a faint aura on the table.

## Preview

Run in the console (F12) or as a macro:

```js
game.modules.get("dxcufgbs-dice-trails").api.previewAll()       // every type in turn
game.modules.get("dxcufgbs-dice-trails").api.preview("fire")    // one type
```

## License

Code: [MIT](LICENSE).

Particle and streak textures in `textures/`: from the [Particle Pack](https://kenney.nl/assets/particle-pack) by Kenney (www.kenney.nl), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain), see [textures/LICENSE-Kenney.txt](textures/LICENSE-Kenney.txt). Free to use, change and share.

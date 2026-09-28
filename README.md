# Dxcufgb's damage dice trails

Gives [Dice So Nice](https://foundryvtt.com/packages/dice-so-nice) dice a streak of their damage type while they roll, so damage dice look charged with their element: a tail of fire, a jagged lightning bolt, a frost streak, black death-smoke and more.

**Foundry VTT:** v13 · **Requires:** Dice So Nice 5 · tested with dnd5e 5.2.5

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-dice-trails/releases/latest/download/module.json
```

## Features

Every die rolled for a damage type drags a streak of that element along its flight path (long when it's fast, shrinking as it lands), with a glowing aura and a few accent particles:

| Type | Streak |
| --- | --- |
| Fire | Wide flame tail, white-hot at the die, ragged orange tongues into deep red, smoke and embers |
| Cold | Icy streak with glinting frost striations in freezing mist, ice shards |
| Lightning | Jagged white bolt that re-zig-zags constantly in a blue electric glow, sparks and arcs |
| Thunder | Violet streak pulsing with shock-bands, shockwave rings |
| Acid | Bubbling green streak under caustic fumes, dripping droplets |
| Poison | Billowing toxic cloud, green turning sickly purple |
| Necrotic | Black death-smoke flowing back into the die, violet soul-fire at its edges |
| Radiant | Brilliant white-gold beam in a wide golden glow, starbursts |
| Force | Violet arcane energy with flowing bands, orbiting motes |
| Psychic | Two weaving strands of pink mind-light, ripples |
| Bludgeoning | Heavy dust trail with debris |
| Piercing | Needle-thin, razor-straight white streak |
| Slashing | Sharp silver-and-crimson streak sweeping side to side |
| Healing | Soft green life-light streak with twinkles and rising motes |
| Temp HP | Shimmering blue shield streak with orbiting shards |

- **dnd5e**: each die gets the damage type of the damage part it belongs to, so "1d8 slashing + 2d6 fire" gives slashing dice and fire dice.
- **Any system**: dice with a damage type as flavor, e.g. `1d6[fire]`, get the matching streak.
- Untyped dice (attacks, saves, …) are unchanged. Works for rolls shown from other players too.

## Settings (per user)

- **Show damage type trails**: on/off.
- **Trail intensity**: fewer particles if rolls stutter.
- **Keep glowing after landing**: dice keep a faint aura on the table.

## Preview

Run in the console (F12) or as a macro:

```js
game.modules.get("dxcufgbs-dice-trails").api.previewAll()       // every type in turn
game.modules.get("dxcufgbs-dice-trails").api.preview("fire")    // one type
```

## License

[MIT](LICENSE)

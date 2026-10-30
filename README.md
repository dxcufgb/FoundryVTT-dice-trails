# Dxcufgb's dice trails

[![Foundry v13](https://img.shields.io/github/v/release/dxcufgb/FoundryVTT-dice-trails?label=Foundry%20v13&logo=foundryvirtualtabletop&color=ff6400)](https://github.com/dxcufgb/FoundryVTT-dice-trails/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dxcufgb/FoundryVTT-dice-trails/module.zip?label=downloads&color=blue)](https://github.com/dxcufgb/FoundryVTT-dice-trails/releases)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/dxcufgb)\
[![CI](https://img.shields.io/github/actions/workflow/status/dxcufgb/FoundryVTT-dice-trails/ci.yml?branch=main&label=CI)](https://github.com/dxcufgb/FoundryVTT-dice-trails/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/dxcufgb/FoundryVTT-dice-trails)](LICENSE)
[![Requires Dice So Nice](https://img.shields.io/badge/requires-Dice%20So%20Nice%205-8a5cf6)](https://foundryvtt.com/packages/dice-so-nice)

<a href="https://dxcufgb.github.io/FVTT-dev-showcase/"><img src="https://dxcufgb.github.io/FVTT-dev-showcase/assets/img/workshop-badge.png" alt="Dxcufgb's Workshop: every Foundry VTT project, video and changelog in one place" width="650"></a>

Gives [Dice So Nice](https://foundryvtt.com/packages/dice-so-nice) dice a streak of their damage type while they roll, so damage dice look charged with their element: a tail of fire, crackling lightning, freezing mist, a black death-shroud and more. For every other roll (attacks, checks, saves, initiative, ...) you design your own trail in the **Dice trails** window, and everyone at the table sees it on your rolls.

**Foundry VTT:** v13 · **Requires:** Dice So Nice 5 · tested with dnd5e 5.2.5

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-dice-trails/releases/latest/download/module.json
```

Requirements and updating: see [Installation](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Installation) in the wiki.

## Documentation

The full guide is in the [wiki](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki):

- [Damage Type Trails](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Damage-Type-Trails): the 15 trails damage dice get
- [The Dice Trails Window](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/The-Dice-Trails-Window): layers, your own images, kinds of roll, character and default trails, saving, export and import
- [Designs and Styles](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Designs-and-Styles): all 76 designs and their styles
- [Sound Effects](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Sound-Effects): flight loops, bounce hits and the 23 sound themes
- [Settings](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Settings): every setting
- [API](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/API): for macro and module authors, with the trail and file formats and stored data
- [Troubleshooting](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Troubleshooting): common problems and fixes
- [Credits](https://github.com/dxcufgb/FoundryVTT-dice-trails/wiki/Credits): code, texture and sound licences

## License

Code: [MIT](LICENSE).

Particle and streak textures in `textures/`: the Kenney sprites (bolts, debris, flames, heart, ring, rune, slashes, smoke, stars, strips, twirls) are from the [Particle Pack](https://kenney.nl/assets/particle-pack) by Kenney (www.kenney.nl), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain), see [textures/LICENSE-Kenney.txt](textures/LICENSE-Kenney.txt). The leaves, petals, snowflakes, notes, glyphs, knives, stones, flares, bubbles, drops, skulls and coins are drawn by the module's own script (`tools/make-textures.py`) and dedicated to the public domain too (CC0 1.0), see [textures/LICENSE-CC0-generated.txt](textures/LICENSE-CC0-generated.txt).

Sound effects in `sounds/`: synthesized by the module's own script (`tools/make-sounds.py`), no recordings or third-party samples, dedicated to the public domain (CC0 1.0), see [sounds/LICENSE-CC0-generated.txt](sounds/LICENSE-CC0-generated.txt). Everything is free to use, change and share.

## Releasing

For the maintainer: **Actions → Release module → Run workflow**, type the version (for example `1.2.3`) and run it. The module is checked and packaged first; only then is the release `v1.2.3` published with `module.json` and `module.zip`. CI and releases come from [dxcufgb/foundry-module-ci](https://github.com/dxcufgb/foundry-module-ci), the same for every module.

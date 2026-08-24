# Omarchy Gym

Progressive keybinding workouts for [Omarchy](https://omarchy.org/) Quattro.

Gym is a sandbox overlay. It prompts an English desktop action, waits for the chord, and **scores** the attempt. It does not dispatch the real Hyprland / Omarchy action.

Workouts are ordered lessons. A new learner starts on launch (menu, terminal, browser, files). Later lessons stay locked until every exercise in the current lesson is mastered (three hits in a row).

## Install

```sh
omarchy plugin add https://github.com/YOU/omarchy-gym.git --enable
```

Local checkout (real directory — the validator rejects a symlinked plugin folder):

```sh
mkdir -p ~/.config/omarchy/plugins/sd.gym
cp -a ~/Projects/omarchy-gym/plugin/sd.gym/. ~/.config/omarchy/plugins/sd.gym/
omarchy plugin validate ~/.config/omarchy/plugins/sd.gym
omarchy plugin enable sd.gym
```

Open it from **Learn → Gym**, or:

```sh
omarchy-shell shell summon sd.gym
```

While a workout is open, Hyprland switches to the `omarchy-gym` submap (`hyprctl dispatch 'hl.dsp.submap("omarchy-gym")'`) so Super+Space and friends are scored in the overlay instead of launching the real menu/terminal. Escape leaves. F12 is the failsafe if the overlay dies while grabbed.

Do not bind Super+G — that is Grok on this desktop.

## Tests

```sh
node --test tests/test_gym.js
```

The tests import `plugin/sd.gym/GymLogic.js`, the same module the overlay uses.

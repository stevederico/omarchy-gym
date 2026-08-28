# Omarchy Gym

Rhythm-game keybinding workouts for [Omarchy](https://omarchy.org/) Quattro.

Gym is a **normal tiled window** (like a terminal). Dots fall down **four DDR-style streams** (← ↓ ↑ →) toward receptors at the bottom. Press the matching chord as the dot hits the ring. Marvelous / Perfect / Great / Good — late or wrong is a Miss. Hits vanish at the line; misses continue past. It does **not** dispatch the real Hyprland / Omarchy action.

The chart uses **Learn → Keybindings** (`omarchy menu keybindings --print`). A new player starts with the first 3 keyboard chords, then 5, 10, 20, 40… until the full playable catalog. Clearing a stage with a C or better unlocks the next pool. Silent chart for v1 (no music).

Mouse binds and hardware (`XF86*`) keys are dropped — see `plugin/sd.gym/DROPS.md`.

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

Open it from the launcher: search **Gym**, or **Learn → Gym**. Also:

```sh
omarchy-shell shell summon sd.gym
```

Menu row (user extension, hot-reloads):

```sh
cp extra/omarchy-menu-gym.jsonc ~/.config/omarchy/extensions/omarchy-menu.jsonc
# or merge the learn.gym object into your existing extension file
```

Apps launcher desktop file:

```sh
cp extra/sd.gym.desktop ~/.local/share/applications/
```

While Gym is focused, Hyprland switches to the `omarchy-gym` submap so Super+Space and friends are scored instead of launching the real menu/terminal. Super+W closes the window. Escape leaves. F12 is the failsafe if Gym dies while grabbed.

Define that submap in `~/.config/hypr/bindings.lua` (see the `omarchy-gym` block). Without it, Super combos never reach the window.

Do not bind Super+G — that is Grok on this desktop.

## Tests

```sh
node --test tests/test_gym.js
```

The tests import `plugin/sd.gym/run/GymLogic.js`, the same module the overlay uses, and parse the bundled `plugin/sd.gym/keybindings-print.txt` fixture.

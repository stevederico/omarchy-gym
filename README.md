# Omarchy Gym

Rhythm-game keybinding workouts for [Omarchy](https://omarchy.org/) Quattro.

Gym is a **normal tiled window**. Dots fall down four DDR-style streams
(← ↓ ↑ →) toward receptors at the bottom. Press the matching chord as a dot
hits the ring. Marvelous / Perfect / Great / Good are scored; late or wrong
presses are misses. Gym never dispatches the real Hyprland or Omarchy action.

The chart follows the **Learn → Keybindings** order. It starts with the first
3 playable keyboard chords, then expands to 5, 10, 20, 40, and so on. A stage
grade of C or better unlocks the next pool. The chart is silent in v1.
At startup, Gym reads the current `omarchy menu keybindings --print` output.
`catalog.json` and `keybindings-print.txt` preserve the bundled raw snapshot;
`GymLogic.js` applies the documented filters before chart generation and uses
the snapshot only if the command is unavailable, does not finish within 3
seconds, or produces no playable rows.

Mouse binds, hardware (`XF86*`) keys, and Gym's `Super+W` close control are
excluded from scoring. See `plugin/sd.gym/DROPS.md`.

## Requirements and safety

- Omarchy Quattro with the Quickshell shell and Hyprland.
- A user-configured `omarchy-gym` Hyprland submap; see
  `extra/omarchy-gym-submap.lua` (Lua config) or
  `extra/omarchy-gym-submap.conf` (hyprlang config).
- No sudo is required.
- Gym has no setup script, system unit, network access, or external runtime
  dependency. It only uses tools that ship with Omarchy.
- Gym writes progress only to
  `~/.local/state/omarchy/gym-progress.json`.
- Gym invokes `hyprctl` only to enter and leave its temporary submap.
- The optional menu extension must be merged manually; Gym does not overwrite
  user configuration.

## Install

```sh
omarchy plugin add https://github.com/stevederico/omarchy-gym.git --enable
```

Open it from the launcher by searching **Gym**, or run:

```sh
omarchy-shell shell summon io.github.stevederico.omarchy-gym
```

Local checkout (copy the repository root, not a symlink):

```sh
PLUGIN_ID="io.github.stevederico.omarchy-gym"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
mkdir -p "$PLUGIN_DIR"
cp -a ~/Projects/omarchy-gym/manifest.json \
  ~/Projects/omarchy-gym/plugin \
  ~/Projects/omarchy-gym/README.md \
  ~/Projects/omarchy-gym/LICENSE \
  "$PLUGIN_DIR/"
omarchy plugin validate "$PLUGIN_DIR"
omarchy plugin enable "$PLUGIN_ID"
```

## Optional integrations

To add a **Learn → Gym** menu row, merge the `learn.gym` object from
`extra/omarchy-menu-gym.jsonc` into your existing
`~/.config/omarchy/extensions/omarchy-menu.jsonc`. Do not replace that file.

To add an application-launcher entry:

```sh
cp extra/sd.gym.desktop ~/.local/share/applications/
```

To make Super chords reach Gym instead of Hyprland, merge one submap block
into your Hyprland bindings source:

- Lua config (Omarchy Quattro default): merge `extra/omarchy-gym-submap.lua`
  into `~/.config/hypr/bindings.lua`.
- hyprlang config: merge `extra/omarchy-gym-submap.conf` into
  `bindings.conf`.

Do not replace `bindings.lua` or `bindings.conf`. Leave all other chords
unbound in the submap so Qt can receive them. `Super+W` closes Gym; bare
Escape closes normally; F12 is the emergency close path.

## Remove

```sh
PLUGIN_ID="io.github.stevederico.omarchy-gym"
omarchy-shell shell hide "$PLUGIN_ID"
omarchy plugin disable "$PLUGIN_ID"
omarchy plugin remove "$PLUGIN_ID"
```

If installed, manually remove the optional menu object, desktop file, and
`omarchy-gym` submap block from your user configuration.

## Development checks

```sh
node --test tests/test_gym.js
```

On an Omarchy installation, also validate the root plugin:

```sh
PLUGIN_ID="io.github.stevederico.omarchy-gym"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
omarchy plugin validate "$PLUGIN_DIR"
qmllint -I "$OMARCHY_PATH/shell" "$PLUGIN_DIR/plugin/sd.gym/run/Gym.qml"
```

If `qmllint` is not on your `PATH`, use `/usr/lib/qt6/bin/qmllint`. It exits 0
and reports `import` and `unqualified` warnings for the shell's `qs.Commons`
and `qs.Ui` singletons; the first-party Omarchy plugins report the same.

The tests exercise the same `plugin/sd.gym/run/GymLogic.js` module used by the
overlay and parse the bundled `plugin/sd.gym/keybindings-print.txt` fixture.

## License

MIT. See [LICENSE](LICENSE).

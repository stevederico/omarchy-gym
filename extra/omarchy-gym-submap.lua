-- Merge this block into ~/.config/hypr/bindings.lua (Hyprland Lua config).
-- Keep your normal bindings above it. Do not replace the file.

hl.define_submap("omarchy-gym", function()
  -- These controls are intentionally not playable chart entries.
  hl.bind("SUPER + W", hl.dsp.exec_cmd("omarchy-shell shell hide io.github.stevederico.omarchy-gym"))
  hl.bind("F12", hl.dsp.exec_cmd("omarchy-shell shell hide io.github.stevederico.omarchy-gym"))

  -- Do not bind the remaining keys here: unbound chords must reach Gym's Qt
  -- key catcher for scoring.
end)

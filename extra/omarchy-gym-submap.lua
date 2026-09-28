-- Merge this block into ~/.config/hypr/bindings.lua (Hyprland Lua config).
-- Keep your normal bindings above it. Do not replace the file.
--
-- Gym enters the omarchy-gym submap only while its window has keyboard focus
-- and leaves it when focus moves away. Chords left unbound here are not
-- dispatched, so Super+Space and friends are scored instead of launched.

hl.define_submap("omarchy-gym", function()
  -- Close Gym. This control is not a playable chart entry.
  hl.bind("SUPER + W", hl.dsp.exec_cmd("omarchy-shell shell hide io.github.stevederico.omarchy-gym"))
  -- Failsafe: always leaves the submap, even if omarchy-shell is not running.
  hl.bind("F12", hl.dsp.submap("reset"))
end)

-- Super chords may not reach a normal window at all, so this listener
-- forwards each press made inside the submap to Gym over shell IPC. Gym drops
-- the copy its own window also receives.
local gym_key_names = {
  [1] = "ESCAPE", [2] = "1", [3] = "2", [4] = "3", [5] = "4", [6] = "5",
  [7] = "6", [8] = "7", [9] = "8", [10] = "9", [11] = "0", [12] = "MINUS",
  [13] = "EQUAL", [14] = "BACKSPACE", [15] = "TAB", [16] = "Q", [17] = "W",
  [18] = "E", [19] = "R", [20] = "T", [21] = "Y", [22] = "U", [23] = "I",
  [24] = "O", [25] = "P", [26] = "BRACKETLEFT", [27] = "BRACKETRIGHT",
  [28] = "RETURN", [30] = "A", [31] = "S", [32] = "D", [33] = "F", [34] = "G",
  [35] = "H", [36] = "J", [37] = "K", [38] = "L", [39] = "SEMICOLON",
  [40] = "APOSTROPHE", [41] = "GRAVE", [43] = "BACKSLASH", [44] = "Z",
  [45] = "X", [46] = "C", [47] = "V", [48] = "B", [49] = "N", [50] = "M",
  [51] = "COMMA", [52] = "PERIOD", [53] = "SLASH", [57] = "SPACE",
  [59] = "F1", [60] = "F2", [61] = "F3", [62] = "F4", [63] = "F5",
  [64] = "F6", [65] = "F7", [66] = "F8", [67] = "F9", [68] = "F10",
  [87] = "F11", [88] = "F12", [99] = "PRINT", [102] = "HOME", [103] = "UP",
  [104] = "PAGEUP", [105] = "LEFT", [106] = "RIGHT", [107] = "END",
  [108] = "DOWN", [109] = "PAGEDOWN", [111] = "DELETE",
}

local function gym_down(left, right)
  return hl.is_key_down(left) or hl.is_key_down(right)
end

hl.on("input.keyboard.key", function(keycode, _, state)
  if state ~= 1 or hl.get_current_submap() ~= "omarchy-gym" then
    return
  end
  -- keycode is an XKB keycode: the Linux evdev code plus 8. Modifier keys
  -- are not in the table, so pressing one alone sends nothing.
  local name = type(keycode) == "number" and gym_key_names[keycode - 8] or nil
  if not name or name == "F12" then
    return
  end

  local super = gym_down("Super_L", "Super_R")
  local shift = gym_down("Shift_L", "Shift_R")
  local ctrl = gym_down("Control_L", "Control_R")
  local alt = gym_down("Alt_L", "Alt_R")
  if name == "W" and super and not shift and not ctrl and not alt then
    return
  end

  local parts = {}
  if super then parts[#parts + 1] = "SUPER" end
  if shift then parts[#parts + 1] = "SHIFT" end
  if ctrl then parts[#parts + 1] = "CTRL" end
  if alt then parts[#parts + 1] = "ALT" end
  parts[#parts + 1] = name

  -- Chord text is only table names and modifiers, so it is safe to quote.
  hl.exec_cmd("omarchy-shell -q shell call io.github.stevederico.omarchy-gym scoreChord '" .. table.concat(parts, " + ") .. "'")
end)

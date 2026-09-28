// Shared gym logic. overlay/Gym.qml imports this; Node tests require the same file.
// Chart generation, catalog parse, timing, combo/score/grade, and progress
// live here so node --test can drive them without QML.

var MOD_ORDER = ["SUPER", "SHIFT", "CTRL", "ALT"]

var TOKEN_ALIASES = {
  META: "SUPER",
  WIN: "SUPER",
  MOD4: "SUPER",
  SUPER_L: "SUPER",
  SUPER_R: "SUPER",
  CONTROL: "CTRL",
  CTL: "CTRL",
  ENTER: "RETURN",
  ESC: "ESCAPE",
  PGUP: "PAGEUP",
  PGDN: "PAGEDOWN",
  PAGE_UP: "PAGEUP",
  PAGE_DOWN: "PAGEDOWN",
  DELETE: "DELETE",
  HOME: "HOME"
}

var MODIFIER_KEYS = {
  SUPER: true,
  SHIFT: true,
  CTRL: true,
  ALT: true,
  META: true,
  CONTROL: true
}

// Keys we can score from a Qt key event (see overlay/Gym.qml keyName).
var SCORABLE_KEYS = {
  SPACE: true,
  RETURN: true,
  ESCAPE: true,
  TAB: true,
  BACKSPACE: true,
  DELETE: true,
  LEFT: true,
  RIGHT: true,
  UP: true,
  DOWN: true,
  HOME: true,
  END: true,
  PAGEUP: true,
  PAGEDOWN: true,
  PRINT: true,
  MINUS: true,
  EQUAL: true,
  BRACKETLEFT: true,
  BRACKETRIGHT: true,
  COMMA: true,
  SLASH: true,
  PERIOD: true,
  BACKSLASH: true,
  SEMICOLON: true,
  APOSTROPHE: true,
  GRAVE: true
}

var i
for (i = 0; i < 26; i++) SCORABLE_KEYS[String.fromCharCode(65 + i)] = true
for (i = 0; i < 10; i++) SCORABLE_KEYS[String(i)] = true
for (i = 1; i <= 12; i++) SCORABLE_KEYS["F" + i] = true

// DDR step-zone windows (ms from the receptor line). Keyboard Super-chords
// are a bit slower than a pad, so these are DDR-like but slightly generous.
// delta < 0 = EARLY (note has not reached the line yet)
// delta = 0 = on the line
// delta > 0 = LATE (note already passed the line)
var WINDOW = {
  marvelous: 25,
  perfect: 70,
  great: 140,
  good: 250
}

var SCORE_MAX = 1000000

var EMPTY_COUNTS = {
  Marvelous: 0,
  Perfect: 0,
  Great: 0,
  Good: 0,
  Miss: 0
}

var PASSING_GRADES = { S: true, A: true, B: true, C: true }

var STAGE_START_SIZES = [3, 5, 10, 20]

var LANE_COUNT = 4

function laneForIndex(catalogIndex) {
  var n = Number(catalogIndex)
  if (!isFinite(n) || n < 0) n = 0
  return Math.floor(n) % LANE_COUNT
}

// Hyprland binds run before layer-shell exclusive focus. While the gym is
// open we enter this empty-ish submap so Super+Space etc. reach the overlay
// instead of launching the real menu/terminal.
var GYM_SUBMAP = "omarchy-gym"

// Populated after parse of the bundled print fixture (Node) or generated bake (QML).
var BAKED_PLAYABLE = [
  {
    "id": "kb.0",
    "index": 0,
    "chord": "SUPER + K",
    "action": "Keybindings"
  },
  {
    "id": "kb.1",
    "index": 1,
    "chord": "SUPER + SPACE",
    "action": "Omarchy menu"
  },
  {
    "id": "kb.2",
    "index": 2,
    "chord": "SUPER + RETURN",
    "action": "Terminal"
  },
  {
    "id": "kb.3",
    "index": 3,
    "chord": "SUPER + SHIFT + RETURN",
    "action": "Browser"
  },
  {
    "id": "kb.4",
    "index": 4,
    "chord": "SUPER + SHIFT + F",
    "action": "File manager"
  },
  {
    "id": "kb.5",
    "index": 5,
    "chord": "SUPER + ESCAPE",
    "action": "System menu"
  },
  {
    "id": "kb.6",
    "index": 6,
    "chord": "SUPER + SHIFT + CTRL + SPACE",
    "action": "Theme menu"
  },
  {
    "id": "kb.7",
    "index": 7,
    "chord": "SUPER + F",
    "action": "Full screen"
  },
  {
    "id": "kb.8",
    "index": 8,
    "chord": "SUPER + ALT + F",
    "action": "Full width"
  },
  {
    "id": "kb.9",
    "index": 9,
    "chord": "CTRL + ALT + DELETE",
    "action": "Close all windows"
  },
  {
    "id": "kb.10",
    "index": 10,
    "chord": "SUPER + CTRL + L",
    "action": "Lock system"
  },
  {
    "id": "kb.11",
    "index": 11,
    "chord": "SUPER + T",
    "action": "Toggle window floating/tiling"
  },
  {
    "id": "kb.12",
    "index": 12,
    "chord": "SUPER + J",
    "action": "Toggle window split"
  },
  {
    "id": "kb.13",
    "index": 13,
    "chord": "SUPER + O",
    "action": "Pop window out (float & pin)"
  },
  {
    "id": "kb.14",
    "index": 14,
    "chord": "SUPER + C",
    "action": "Universal copy"
  },
  {
    "id": "kb.15",
    "index": 15,
    "chord": "SUPER + V",
    "action": "Universal paste"
  },
  {
    "id": "kb.16",
    "index": 16,
    "chord": "SUPER + X",
    "action": "Universal cut"
  },
  {
    "id": "kb.17",
    "index": 17,
    "chord": "SUPER + CTRL + V",
    "action": "Clipboard manager"
  },
  {
    "id": "kb.18",
    "index": 18,
    "chord": "SUPER + CTRL + E",
    "action": "Emojis"
  },
  {
    "id": "kb.19",
    "index": 19,
    "chord": "SUPER + PRINT",
    "action": "Color picker"
  },
  {
    "id": "kb.20",
    "index": 20,
    "chord": "PRINT",
    "action": "Screenshot"
  },
  {
    "id": "kb.21",
    "index": 21,
    "chord": "ALT + PRINT",
    "action": "Screenrecording"
  },
  {
    "id": "kb.22",
    "index": 22,
    "chord": "SUPER + ALT + RETURN",
    "action": "Tmux"
  },
  {
    "id": "kb.23",
    "index": 23,
    "chord": "SUPER + CTRL + RETURN",
    "action": "Herdr"
  },
  {
    "id": "kb.24",
    "index": 24,
    "chord": "SUPER + SHIFT + ALT + B",
    "action": "Browser (private)"
  },
  {
    "id": "kb.25",
    "index": 25,
    "chord": "SUPER + SHIFT + B",
    "action": "Browser"
  },
  {
    "id": "kb.26",
    "index": 26,
    "chord": "SUPER + SHIFT + ALT + F",
    "action": "File manager (cwd)"
  },
  {
    "id": "kb.27",
    "index": 27,
    "chord": "SUPER + 0",
    "action": "Switch to workspace 10"
  },
  {
    "id": "kb.28",
    "index": 28,
    "chord": "SUPER + 1",
    "action": "Switch to workspace 1"
  },
  {
    "id": "kb.29",
    "index": 29,
    "chord": "SUPER + 2",
    "action": "Switch to workspace 2"
  },
  {
    "id": "kb.30",
    "index": 30,
    "chord": "SUPER + 3",
    "action": "Switch to workspace 3"
  },
  {
    "id": "kb.31",
    "index": 31,
    "chord": "SUPER + 4",
    "action": "Switch to workspace 4"
  },
  {
    "id": "kb.32",
    "index": 32,
    "chord": "SUPER + 5",
    "action": "Switch to workspace 5"
  },
  {
    "id": "kb.33",
    "index": 33,
    "chord": "SUPER + 6",
    "action": "Switch to workspace 6"
  },
  {
    "id": "kb.34",
    "index": 34,
    "chord": "SUPER + 7",
    "action": "Switch to workspace 7"
  },
  {
    "id": "kb.35",
    "index": 35,
    "chord": "SUPER + 8",
    "action": "Switch to workspace 8"
  },
  {
    "id": "kb.36",
    "index": 36,
    "chord": "SUPER + 9",
    "action": "Switch to workspace 9"
  },
  {
    "id": "kb.37",
    "index": 37,
    "chord": "SUPER + CTRL + TAB",
    "action": "Former workspace"
  },
  {
    "id": "kb.38",
    "index": 38,
    "chord": "SUPER + SHIFT + TAB",
    "action": "Previous workspace"
  },
  {
    "id": "kb.39",
    "index": 39,
    "chord": "SUPER + TAB",
    "action": "Next workspace"
  },
  {
    "id": "kb.40",
    "index": 40,
    "chord": "SUPER + SHIFT + 0",
    "action": "Move window to workspace 10"
  },
  {
    "id": "kb.41",
    "index": 41,
    "chord": "SUPER + SHIFT + 1",
    "action": "Move window to workspace 1"
  },
  {
    "id": "kb.42",
    "index": 42,
    "chord": "SUPER + SHIFT + 2",
    "action": "Move window to workspace 2"
  },
  {
    "id": "kb.43",
    "index": 43,
    "chord": "SUPER + SHIFT + 3",
    "action": "Move window to workspace 3"
  },
  {
    "id": "kb.44",
    "index": 44,
    "chord": "SUPER + SHIFT + 4",
    "action": "Move window to workspace 4"
  },
  {
    "id": "kb.45",
    "index": 45,
    "chord": "SUPER + SHIFT + 5",
    "action": "Move window to workspace 5"
  },
  {
    "id": "kb.46",
    "index": 46,
    "chord": "SUPER + SHIFT + 6",
    "action": "Move window to workspace 6"
  },
  {
    "id": "kb.47",
    "index": 47,
    "chord": "SUPER + SHIFT + 7",
    "action": "Move window to workspace 7"
  },
  {
    "id": "kb.48",
    "index": 48,
    "chord": "SUPER + SHIFT + 8",
    "action": "Move window to workspace 8"
  },
  {
    "id": "kb.49",
    "index": 49,
    "chord": "SUPER + SHIFT + 9",
    "action": "Move window to workspace 9"
  },
  {
    "id": "kb.50",
    "index": 50,
    "chord": "SUPER + SHIFT + ALT + 0",
    "action": "Move window silently to workspace 10"
  },
  {
    "id": "kb.51",
    "index": 51,
    "chord": "SUPER + SHIFT + ALT + 1",
    "action": "Move window silently to workspace 1"
  },
  {
    "id": "kb.52",
    "index": 52,
    "chord": "SUPER + SHIFT + ALT + 2",
    "action": "Move window silently to workspace 2"
  },
  {
    "id": "kb.53",
    "index": 53,
    "chord": "SUPER + SHIFT + ALT + 3",
    "action": "Move window silently to workspace 3"
  },
  {
    "id": "kb.54",
    "index": 54,
    "chord": "SUPER + SHIFT + ALT + 4",
    "action": "Move window silently to workspace 4"
  },
  {
    "id": "kb.55",
    "index": 55,
    "chord": "SUPER + SHIFT + ALT + 5",
    "action": "Move window silently to workspace 5"
  },
  {
    "id": "kb.56",
    "index": 56,
    "chord": "SUPER + SHIFT + ALT + 6",
    "action": "Move window silently to workspace 6"
  },
  {
    "id": "kb.57",
    "index": 57,
    "chord": "SUPER + SHIFT + ALT + 7",
    "action": "Move window silently to workspace 7"
  },
  {
    "id": "kb.58",
    "index": 58,
    "chord": "SUPER + SHIFT + ALT + 8",
    "action": "Move window silently to workspace 8"
  },
  {
    "id": "kb.59",
    "index": 59,
    "chord": "SUPER + SHIFT + ALT + 9",
    "action": "Move window silently to workspace 9"
  },
  {
    "id": "kb.60",
    "index": 60,
    "chord": "SUPER + SHIFT + DOWN",
    "action": "Swap window down"
  },
  {
    "id": "kb.61",
    "index": 61,
    "chord": "SUPER + SHIFT + LEFT",
    "action": "Swap window to the left"
  },
  {
    "id": "kb.62",
    "index": 62,
    "chord": "SUPER + SHIFT + RIGHT",
    "action": "Swap window to the right"
  },
  {
    "id": "kb.63",
    "index": 63,
    "chord": "SUPER + SHIFT + UP",
    "action": "Swap window up"
  },
  {
    "id": "kb.64",
    "index": 64,
    "chord": "ALT + TAB",
    "action": "Focus on next window"
  },
  {
    "id": "kb.65",
    "index": 65,
    "chord": "CTRL + ALT + TAB",
    "action": "Focus on next monitor"
  },
  {
    "id": "kb.66",
    "index": 66,
    "chord": "SHIFT + ALT + TAB",
    "action": "Focus on previous window"
  },
  {
    "id": "kb.67",
    "index": 67,
    "chord": "SHIFT + CTRL + ALT + TAB",
    "action": "Focus on previous monitor"
  },
  {
    "id": "kb.68",
    "index": 68,
    "chord": "SUPER + DOWN",
    "action": "Focus on below window"
  },
  {
    "id": "kb.69",
    "index": 69,
    "chord": "SUPER + LEFT",
    "action": "Focus on left window"
  },
  {
    "id": "kb.70",
    "index": 70,
    "chord": "SUPER + RIGHT",
    "action": "Focus on right window"
  },
  {
    "id": "kb.71",
    "index": 71,
    "chord": "SUPER + UP",
    "action": "Focus on above window"
  },
  {
    "id": "kb.72",
    "index": 72,
    "chord": "SUPER + ALT + MINUS",
    "action": "Expand window left a little"
  },
  {
    "id": "kb.73",
    "index": 73,
    "chord": "SUPER + CTRL + MINUS",
    "action": "Expand window left a lot"
  },
  {
    "id": "kb.74",
    "index": 74,
    "chord": "SUPER + MINUS",
    "action": "Expand window left"
  },
  {
    "id": "kb.75",
    "index": 75,
    "chord": "SUPER + SHIFT + ALT + EQUAL",
    "action": "Expand window down a little"
  },
  {
    "id": "kb.76",
    "index": 76,
    "chord": "SUPER + SHIFT + CTRL + EQUAL",
    "action": "Expand window down a lot"
  },
  {
    "id": "kb.77",
    "index": 77,
    "chord": "SUPER + SHIFT + EQUAL",
    "action": "Expand window down"
  },
  {
    "id": "kb.78",
    "index": 78,
    "chord": "SUPER + ALT + EQUAL",
    "action": "Shrink window left a little"
  },
  {
    "id": "kb.79",
    "index": 79,
    "chord": "SUPER + CTRL + EQUAL",
    "action": "Shrink window left a lot"
  },
  {
    "id": "kb.80",
    "index": 80,
    "chord": "SUPER + EQUAL",
    "action": "Shrink window left"
  },
  {
    "id": "kb.81",
    "index": 81,
    "chord": "SUPER + SHIFT + ALT + MINUS",
    "action": "Shrink window up a little"
  },
  {
    "id": "kb.82",
    "index": 82,
    "chord": "SUPER + SHIFT + CTRL + MINUS",
    "action": "Shrink window up a lot"
  },
  {
    "id": "kb.83",
    "index": 83,
    "chord": "SUPER + SHIFT + MINUS",
    "action": "Shrink window up"
  },
  {
    "id": "kb.84",
    "index": 84,
    "chord": "SUPER + ALT + S",
    "action": "Move window to scratchpad"
  },
  {
    "id": "kb.85",
    "index": 85,
    "chord": "SUPER + S",
    "action": "Toggle scratchpad"
  },
  {
    "id": "kb.86",
    "index": 86,
    "chord": "SUPER + ALT + COMMA",
    "action": "Invoke last notification"
  },
  {
    "id": "kb.87",
    "index": 87,
    "chord": "SUPER + COMMA",
    "action": "Dismiss last notification"
  },
  {
    "id": "kb.88",
    "index": 88,
    "chord": "SUPER + CTRL + COMMA",
    "action": "Toggle silencing notifications"
  },
  {
    "id": "kb.89",
    "index": 89,
    "chord": "SUPER + SHIFT + ALT + COMMA",
    "action": "Open notification history"
  },
  {
    "id": "kb.90",
    "index": 90,
    "chord": "SUPER + SHIFT + COMMA",
    "action": "Dismiss all notifications"
  },
  {
    "id": "kb.91",
    "index": 91,
    "chord": "SUPER + BACKSPACE",
    "action": "Toggle window transparency"
  },
  {
    "id": "kb.92",
    "index": 92,
    "chord": "SUPER + CTRL + N",
    "action": "Toggle nightlight"
  },
  {
    "id": "kb.93",
    "index": 93,
    "chord": "SUPER + CTRL + I",
    "action": "Toggle locking on idle"
  },
  {
    "id": "kb.94",
    "index": 94,
    "chord": "F9",
    "action": "Start dictation (push-to-talk)"
  },
  {
    "id": "kb.95",
    "index": 95,
    "chord": "F9",
    "action": "Stop dictation (push-to-talk)"
  },
  {
    "id": "kb.96",
    "index": 96,
    "chord": "SHIFT + ALT + D",
    "action": "Download Video from Web App"
  },
  {
    "id": "kb.97",
    "index": 97,
    "chord": "SHIFT + ALT + L",
    "action": "Copy URL from Web App"
  },
  {
    "id": "kb.98",
    "index": 98,
    "chord": "SUPER + ALT + BRACKETLEFT",
    "action": "Make webcam overlay smaller"
  },
  {
    "id": "kb.99",
    "index": 99,
    "chord": "SUPER + ALT + BRACKETRIGHT",
    "action": "Make webcam overlay larger"
  },
  {
    "id": "kb.100",
    "index": 100,
    "chord": "SUPER + ALT + HOME",
    "action": "Save window width"
  },
  {
    "id": "kb.101",
    "index": 101,
    "chord": "SUPER + ALT + SLASH",
    "action": "Monitor scaling down"
  },
  {
    "id": "kb.102",
    "index": 102,
    "chord": "SUPER + ALT + SPACE",
    "action": "Apps menu"
  },
  {
    "id": "kb.103",
    "index": 103,
    "chord": "SUPER + CTRL + 1",
    "action": "Bar panel 1"
  },
  {
    "id": "kb.104",
    "index": 104,
    "chord": "SUPER + CTRL + 2",
    "action": "Bar panel 2"
  },
  {
    "id": "kb.105",
    "index": 105,
    "chord": "SUPER + CTRL + 3",
    "action": "Bar panel 3"
  },
  {
    "id": "kb.106",
    "index": 106,
    "chord": "SUPER + CTRL + 4",
    "action": "Bar panel 4"
  },
  {
    "id": "kb.107",
    "index": 107,
    "chord": "SUPER + CTRL + 5",
    "action": "Bar panel 5"
  },
  {
    "id": "kb.108",
    "index": 108,
    "chord": "SUPER + CTRL + 6",
    "action": "Bar panel 6"
  },
  {
    "id": "kb.109",
    "index": 109,
    "chord": "SUPER + CTRL + 7",
    "action": "Bar panel 7"
  },
  {
    "id": "kb.110",
    "index": 110,
    "chord": "SUPER + CTRL + 8",
    "action": "Bar panel 8"
  },
  {
    "id": "kb.111",
    "index": 111,
    "chord": "SUPER + CTRL + 9",
    "action": "Bar panel 9"
  },
  {
    "id": "kb.112",
    "index": 112,
    "chord": "SUPER + CTRL + A",
    "action": "Audio"
  },
  {
    "id": "kb.113",
    "index": 113,
    "chord": "SUPER + CTRL + ALT + B",
    "action": "Show battery remaining"
  },
  {
    "id": "kb.114",
    "index": 114,
    "chord": "SUPER + CTRL + ALT + D",
    "action": "Calendar"
  },
  {
    "id": "kb.115",
    "index": 115,
    "chord": "SUPER + CTRL + ALT + DELETE",
    "action": "Toggle laptop display mirroring"
  },
  {
    "id": "kb.116",
    "index": 116,
    "chord": "SUPER + CTRL + ALT + R",
    "action": "Show reminders"
  },
  {
    "id": "kb.117",
    "index": 117,
    "chord": "SUPER + CTRL + ALT + T",
    "action": "Show time"
  },
  {
    "id": "kb.118",
    "index": 118,
    "chord": "SUPER + CTRL + ALT + W",
    "action": "Toggle weather"
  },
  {
    "id": "kb.119",
    "index": 119,
    "chord": "SUPER + CTRL + ALT + Z",
    "action": "Reset zoom"
  },
  {
    "id": "kb.120",
    "index": 120,
    "chord": "SUPER + CTRL + BACKSPACE",
    "action": "Toggle single-window square aspect"
  },
  {
    "id": "kb.121",
    "index": 121,
    "chord": "SUPER + CTRL + B",
    "action": "Bluetooth"
  },
  {
    "id": "kb.122",
    "index": 122,
    "chord": "SUPER + CTRL + C",
    "action": "Capture menu"
  },
  {
    "id": "kb.123",
    "index": 123,
    "chord": "SUPER + CTRL + D",
    "action": "Display"
  },
  {
    "id": "kb.124",
    "index": 124,
    "chord": "SUPER + CTRL + DELETE",
    "action": "Toggle laptop display"
  },
  {
    "id": "kb.125",
    "index": 125,
    "chord": "SUPER + CTRL + F",
    "action": "Tiled full screen"
  },
  {
    "id": "kb.126",
    "index": 126,
    "chord": "SUPER + CTRL + H",
    "action": "Hardware menu"
  },
  {
    "id": "kb.127",
    "index": 127,
    "chord": "SUPER + CTRL + O",
    "action": "Toggle menu"
  },
  {
    "id": "kb.128",
    "index": 128,
    "chord": "SUPER + CTRL + PERIOD",
    "action": "Transcode"
  },
  {
    "id": "kb.129",
    "index": 129,
    "chord": "SUPER + CTRL + P",
    "action": "Power"
  },
  {
    "id": "kb.130",
    "index": 130,
    "chord": "SUPER + CTRL + PRINT",
    "action": "Extract text (OCR) from screenshot"
  },
  {
    "id": "kb.131",
    "index": 131,
    "chord": "SUPER + CTRL + Q",
    "action": "Calculator"
  },
  {
    "id": "kb.132",
    "index": 132,
    "chord": "SUPER + CTRL + R",
    "action": "Set reminder"
  },
  {
    "id": "kb.133",
    "index": 133,
    "chord": "SUPER + CTRL + SPACE",
    "action": "Background switcher"
  },
  {
    "id": "kb.134",
    "index": 134,
    "chord": "SUPER + CTRL + S",
    "action": "Share"
  },
  {
    "id": "kb.135",
    "index": 135,
    "chord": "SUPER + CTRL + T",
    "action": "Activity"
  },
  {
    "id": "kb.136",
    "index": 136,
    "chord": "SUPER + CTRL + W",
    "action": "Network"
  },
  {
    "id": "kb.137",
    "index": 137,
    "chord": "SUPER + CTRL + X",
    "action": "Toggle dictation"
  },
  {
    "id": "kb.138",
    "index": 138,
    "chord": "SUPER + CTRL + Z",
    "action": "Zoom in"
  },
  {
    "id": "kb.139",
    "index": 139,
    "chord": "SUPER + HOME",
    "action": "Restore window width"
  },
  {
    "id": "kb.140",
    "index": 140,
    "chord": "SUPER + L",
    "action": "Toggle workspace layout"
  },
  {
    "id": "kb.141",
    "index": 141,
    "chord": "SUPER + P",
    "action": "Pseudo window"
  },
  {
    "id": "kb.142",
    "index": 142,
    "chord": "SUPER + SHIFT + A",
    "action": "ChatGPT"
  },
  {
    "id": "kb.143",
    "index": 143,
    "chord": "SUPER + SHIFT + ALT + A",
    "action": "Grok"
  },
  {
    "id": "kb.144",
    "index": 144,
    "chord": "SUPER + SHIFT + ALT + DOWN",
    "action": "Move workspace to down monitor"
  },
  {
    "id": "kb.145",
    "index": 145,
    "chord": "SUPER + SHIFT + ALT + E",
    "action": "New email"
  },
  {
    "id": "kb.146",
    "index": 146,
    "chord": "SUPER + SHIFT + ALT + G",
    "action": "WhatsApp"
  },
  {
    "id": "kb.147",
    "index": 147,
    "chord": "SUPER + SHIFT + ALT + LEFT",
    "action": "Move workspace to left monitor"
  },
  {
    "id": "kb.148",
    "index": 148,
    "chord": "SUPER + SHIFT + ALT + M",
    "action": "Music TUI"
  },
  {
    "id": "kb.149",
    "index": 149,
    "chord": "SUPER + SHIFT + ALT + RIGHT",
    "action": "Move workspace to right monitor"
  },
  {
    "id": "kb.150",
    "index": 150,
    "chord": "SUPER + SHIFT + ALT + UP",
    "action": "Move workspace to up monitor"
  },
  {
    "id": "kb.151",
    "index": 151,
    "chord": "SUPER + SHIFT + ALT + X",
    "action": "X Post"
  },
  {
    "id": "kb.152",
    "index": 152,
    "chord": "SUPER + SHIFT + BACKSPACE",
    "action": "Toggle window gaps"
  },
  {
    "id": "kb.153",
    "index": 153,
    "chord": "SUPER + SHIFT + C",
    "action": "Calendar"
  },
  {
    "id": "kb.154",
    "index": 154,
    "chord": "SUPER + SHIFT + CTRL + A",
    "action": "Agent"
  },
  {
    "id": "kb.155",
    "index": 155,
    "chord": "SUPER + SHIFT + CTRL + G",
    "action": "Google Messages"
  },
  {
    "id": "kb.156",
    "index": 156,
    "chord": "SUPER + SHIFT + CTRL + R",
    "action": "Clear reminders"
  },
  {
    "id": "kb.157",
    "index": 157,
    "chord": "SUPER + SHIFT + D",
    "action": "Docker"
  },
  {
    "id": "kb.158",
    "index": 158,
    "chord": "SUPER + SHIFT + E",
    "action": "Email"
  },
  {
    "id": "kb.159",
    "index": 159,
    "chord": "SUPER + SHIFT + G",
    "action": "Signal"
  },
  {
    "id": "kb.160",
    "index": 160,
    "chord": "SUPER + SHIFT + M",
    "action": "Music"
  },
  {
    "id": "kb.161",
    "index": 161,
    "chord": "SUPER + SHIFT + N",
    "action": "Editor"
  },
  {
    "id": "kb.162",
    "index": 162,
    "chord": "SUPER + SHIFT + O",
    "action": "Obsidian"
  },
  {
    "id": "kb.163",
    "index": 163,
    "chord": "SUPER + SHIFT + P",
    "action": "Google Photos"
  },
  {
    "id": "kb.164",
    "index": 164,
    "chord": "SUPER + SHIFT + S",
    "action": "Google Maps"
  },
  {
    "id": "kb.165",
    "index": 165,
    "chord": "SUPER + SHIFT + SLASH",
    "action": "Passwords"
  },
  {
    "id": "kb.166",
    "index": 166,
    "chord": "SUPER + SHIFT + SPACE",
    "action": "Toggle top bar"
  },
  {
    "id": "kb.167",
    "index": 167,
    "chord": "SUPER + SHIFT + W",
    "action": "Omawrite"
  },
  {
    "id": "kb.168",
    "index": 168,
    "chord": "SUPER + SHIFT + X",
    "action": "X"
  },
  {
    "id": "kb.169",
    "index": 169,
    "chord": "SUPER + SHIFT + Y",
    "action": "YouTube"
  },
  {
    "id": "kb.170",
    "index": 170,
    "chord": "SUPER + SLASH",
    "action": "Monitor scaling up"
  },
  {
    "id": "kb.171",
    "index": 171,
    "chord": "SUPER + ALT + 1",
    "action": "Switch to group window 1"
  },
  {
    "id": "kb.172",
    "index": 172,
    "chord": "SUPER + ALT + 2",
    "action": "Switch to group window 2"
  },
  {
    "id": "kb.173",
    "index": 173,
    "chord": "SUPER + ALT + 3",
    "action": "Switch to group window 3"
  },
  {
    "id": "kb.174",
    "index": 174,
    "chord": "SUPER + ALT + 4",
    "action": "Switch to group window 4"
  },
  {
    "id": "kb.175",
    "index": 175,
    "chord": "SUPER + ALT + 5",
    "action": "Switch to group window 5"
  },
  {
    "id": "kb.176",
    "index": 176,
    "chord": "SUPER + ALT + DOWN",
    "action": "Move window to group on bottom"
  },
  {
    "id": "kb.177",
    "index": 177,
    "chord": "SUPER + ALT + G",
    "action": "Move active window out of group"
  },
  {
    "id": "kb.178",
    "index": 178,
    "chord": "SUPER + ALT + LEFT",
    "action": "Move window to group on left"
  },
  {
    "id": "kb.179",
    "index": 179,
    "chord": "SUPER + ALT + RIGHT",
    "action": "Move window to group on right"
  },
  {
    "id": "kb.180",
    "index": 180,
    "chord": "SUPER + ALT + TAB",
    "action": "Next window in group"
  },
  {
    "id": "kb.181",
    "index": 181,
    "chord": "SUPER + ALT + UP",
    "action": "Move window to group on top"
  },
  {
    "id": "kb.182",
    "index": 182,
    "chord": "SUPER + CTRL + LEFT",
    "action": "Move grouped window focus left"
  },
  {
    "id": "kb.183",
    "index": 183,
    "chord": "SUPER + CTRL + RIGHT",
    "action": "Move grouped window focus right"
  },
  {
    "id": "kb.184",
    "index": 184,
    "chord": "SUPER + G",
    "action": "Toggle window grouping"
  },
  {
    "id": "kb.185",
    "index": 185,
    "chord": "SUPER + SHIFT + ALT + TAB",
    "action": "Previous window in group"
  },
  {
    "id": "kb.186",
    "index": 186,
    "chord": "ALT + TAB",
    "action": "Reveal active window on top"
  },
  {
    "id": "kb.187",
    "index": 187,
    "chord": "SHIFT + ALT + TAB",
    "action": "Reveal active window on top"
  },
  {
    "id": "kb.188",
    "index": 188,
    "chord": "SUPER + ALT + K",
    "action": "Tmux keybindings"
  },
  {
    "id": "kb.189",
    "index": 189,
    "chord": "SUPER + CTRL + K",
    "action": "Herdr keybindings"
  }
]

BAKED_PLAYABLE = BAKED_PLAYABLE.filter(function (row) {
  return !isGymControlChord(row.chord)
})
for (i = 0; i < BAKED_PLAYABLE.length; i++) {
  BAKED_PLAYABLE[i].id = "kb." + i
  BAKED_PLAYABLE[i].index = i
}

function tokenizeChord(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s*\+\s*/g, " ")
    .trim()
    .split(/\s+/)
    .filter(function (part) { return part.length > 0 })
}

function canonicalToken(token) {
  var upper = String(token || "").toUpperCase()
  return TOKEN_ALIASES[upper] || upper
}

function normalizeChord(raw) {
  var tokens = tokenizeChord(raw)
  var mods = []
  var key = ""
  var t
  for (t = 0; t < tokens.length; t++) {
    var token = canonicalToken(tokens[t])
    if (MOD_ORDER.indexOf(token) !== -1) {
      if (mods.indexOf(token) === -1) mods.push(token)
    } else if (token.length > 0) {
      key = token
    }
  }
  mods.sort(function (a, b) {
    return MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b)
  })
  if (!key) return mods.join(" + ")
  return mods.concat([key]).join(" + ")
}

function chordPrimaryKey(raw) {
  var n = normalizeChord(raw)
  if (!n) return ""
  var parts = n.split(" + ")
  return parts.length ? parts[parts.length - 1] : n
}

// Shifted or punctuation characters mapped to the unshifted key Hyprland
// names. With Super or Shift held, Qt often sends an empty event.text but a
// shifted key code (Qt.Key_Plus, Qt.Key_Question, ...), whose values equal
// these characters' code points.
var SYMBOL_KEY_NAMES = {
  "!": "1",
  "@": "2",
  "#": "3",
  "$": "4",
  "%": "5",
  "^": "6",
  "&": "7",
  "*": "8",
  "(": "9",
  ")": "0",
  "-": "MINUS",
  "_": "MINUS",
  "=": "EQUAL",
  "+": "EQUAL",
  "[": "BRACKETLEFT",
  "{": "BRACKETLEFT",
  "]": "BRACKETRIGHT",
  "}": "BRACKETRIGHT",
  "\\": "BACKSLASH",
  "|": "BACKSLASH",
  ";": "SEMICOLON",
  ":": "SEMICOLON",
  "'": "APOSTROPHE",
  "\"": "APOSTROPHE",
  ",": "COMMA",
  "<": "COMMA",
  ".": "PERIOD",
  ">": "PERIOD",
  "/": "SLASH",
  "?": "SLASH",
  "`": "GRAVE",
  "~": "GRAVE"
}

function symbolKeyName(ch) {
  return SYMBOL_KEY_NAMES[String(ch || "")] || ""
}

// Qt key codes for printable ASCII equal the character code point.
function keyNameForQtKey(code) {
  var n = Number(code)
  if (!(n >= 0x21 && n <= 0x7e)) return ""
  var ch = String.fromCharCode(n)
  if (/[A-Za-z0-9]/.test(ch)) return ch.toUpperCase()
  return symbolKeyName(ch)
}

function isModifierKey(name) {
  return !!MODIFIER_KEYS[canonicalToken(name)]
}

function chordFromParts(parts) {
  parts = parts || {}
  var bits = []
  if (parts.superHeld) bits.push("SUPER")
  if (parts.shiftHeld) bits.push("SHIFT")
  if (parts.ctrlHeld) bits.push("CTRL")
  if (parts.altHeld) bits.push("ALT")
  if (parts.key && !isModifierKey(parts.key)) bits.push(String(parts.key))
  return normalizeChord(bits.join(" + "))
}

function isBareEscape(parts) {
  parts = parts || {}
  return canonicalToken(parts.key) === "ESCAPE"
    && !parts.superHeld
    && !parts.shiftHeld
    && !parts.ctrlHeld
    && !parts.altHeld
}

function isBareF12(parts) {
  parts = parts || {}
  return canonicalToken(parts.key) === "F12"
    && !parts.superHeld
    && !parts.shiftHeld
    && !parts.ctrlHeld
    && !parts.altHeld
}

function isBareReturn(parts) {
  parts = parts || {}
  return canonicalToken(parts.key) === "RETURN"
    && !parts.superHeld
    && !parts.shiftHeld
    && !parts.ctrlHeld
    && !parts.altHeld
}

function sandboxEnterDispatch() {
  return 'hl.dsp.submap("' + GYM_SUBMAP + '")'
}

function sandboxLeaveDispatch() {
  return 'hl.dsp.submap("reset")'
}

function sandboxEnterArgs() {
  return ["hyprctl", "dispatch", sandboxEnterDispatch()]
}

function sandboxLeaveArgs() {
  return ["hyprctl", "dispatch", sandboxLeaveDispatch()]
}

function chordsMatch(expected, pressed) {
  var a = normalizeChord(expected)
  var b = normalizeChord(pressed)
  return a.length > 0 && a === b
}

function scoreAttempt(exercise, pressedChord) {
  var expected = normalizeChord(exercise && exercise.chord)
  var pressed = normalizeChord(pressedChord)
  var hit = expected.length > 0 && expected === pressed
  return {
    hit: hit,
    expected: expected,
    pressed: pressed
  }
}

function isMouseChord(raw) {
  var text = String(raw || "")
  if (/\bmouse_/i.test(text)) return true
  if (/\bMOUSE\b/i.test(text)) return true
  return false
}

function dropReason(chord) {
  if (isMouseChord(chord)) return "mouse"
  if (isGymControlChord(chord)) return "reserved for Gym control"
  var tokens = tokenizeChord(chord)
  if (tokens.length === 0) return "empty"
  var t
  var keyCount = 0
  for (t = 0; t < tokens.length; t++) {
    var token = canonicalToken(tokens[t])
    if (MOD_ORDER.indexOf(token) !== -1) continue
    keyCount += 1
    if (token.indexOf("XF86") === 0) return "unscorable token: " + token
    if (!SCORABLE_KEYS[token]) return "unscorable token: " + token
  }
  if (keyCount === 0) return "modifier-only"
  if (keyCount > 1) return "multi-key chord"
  return ""
}

function isGymControlChord(chord) {
  return normalizeChord(chord) === "SUPER + W"
}

function parseKeybindingsPrint(text) {
  var playable = []
  var dropped = []
  var lines = String(text || "").split(/\r?\n/)
  var n
  for (n = 0; n < lines.length; n++) {
    var line = lines[n].trim()
    if (!line) continue
    var parts = line.split("→")
    if (parts.length < 2) parts = line.split("->")
    if (parts.length < 2) {
      dropped.push({ chord: line, action: "", reason: "malformed row" })
      continue
    }
    var chord = parts[0].trim()
    var action = parts.slice(1).join("→").trim()
    var reason = dropReason(chord)
    if (reason) {
      dropped.push({ chord: chord, action: action, reason: reason })
      continue
    }
    playable.push({
      id: "kb." + playable.length,
      index: playable.length,
      chord: normalizeChord(chord),
      action: action
    })
  }
  return { playable: playable, dropped: dropped }
}

function defaultPlayable() {
  return BAKED_PLAYABLE.slice()
}

function stagePoolSizes(catalogLength) {
  var n = Number(catalogLength) || 0
  if (n <= 0) return []
  var raw = STAGE_START_SIZES.slice()
  var last = raw[raw.length - 1]
  while (last < n) {
    last = last * 2
    raw.push(last)
  }
  var out = []
  var s
  for (s = 0; s < raw.length; s++) {
    var size = raw[s] > n ? n : raw[s]
    if (out.length === 0 || out[out.length - 1] !== size) out.push(size)
    if (size === n) break
  }
  if (out[out.length - 1] !== n) out.push(n)
  return out
}

function poolSizeForStage(stage, catalogLength) {
  var sizes = stagePoolSizes(catalogLength)
  if (sizes.length === 0) return 0
  var idx = Math.max(0, (Number(stage) || 1) - 1)
  if (idx >= sizes.length) idx = sizes.length - 1
  return sizes[idx]
}

function maxStage(catalogLength) {
  return stagePoolSizes(catalogLength).length
}

function poolForStage(playable, stage) {
  var list = Array.isArray(playable) ? playable : []
  var size = poolSizeForStage(stage, list.length)
  return list.slice(0, size)
}

function stageParams(stage) {
  var s = Math.max(1, Number(stage) || 1)
  var scrollMs = Math.max(1600, 4000 - (s - 1) * 200)
  var gapMs = Math.max(WINDOW.good * 2 + 80, 2200 - (s - 1) * 100)
  var noteCount = Math.min(48, 10 + s * 2)
  return {
    scrollMs: scrollMs,
    gapMs: gapMs,
    noteCount: noteCount,
    leadInMs: scrollMs
  }
}

function pickPoolIndex(poolLength, noteIndex, stage, prevIndex) {
  if (poolLength <= 0) return 0
  if (stage <= 2) return noteIndex % poolLength
  var idx = Math.abs((stage * 10007 + noteIndex * 9176) % poolLength)
  if (idx === prevIndex && poolLength > 1) idx = (idx + 1) % poolLength
  return idx
}

function generateChart(playable, stage) {
  var s = Math.max(1, Number(stage) || 1)
  var pool = poolForStage(playable, s)
  var params = stageParams(s)
  var notes = []
  var t = params.leadInMs
  var prev = -1
  var n
  for (n = 0; n < params.noteCount; n++) {
    var idx = pickPoolIndex(pool.length, n, s, prev)
    var binding = pool[idx] || pool[0]
    if (!binding) break
    notes.push({
      index: notes.length,
      id: binding.id,
      chord: binding.chord,
      action: binding.action,
      hitTimeMs: t,
      lane: laneForIndex(binding.index)
    })
    prev = idx
    t += params.gapMs
  }
  return {
    stage: s,
    poolSize: pool.length,
    catalogLength: Array.isArray(playable) ? playable.length : 0,
    notes: notes,
    scrollMs: params.scrollMs,
    gapMs: params.gapMs
  }
}

function emptyProgress() {
  return {
    version: 2,
    stage: 1,
    highestStageCleared: 0,
    highScore: 0,
    highScores: {},
    exercises: {},
    workoutsCompleted: []
  }
}

function cloneProgress(progress) {
  return JSON.parse(JSON.stringify(progress && typeof progress === "object" ? progress : emptyProgress()))
}

function parseProgress(raw) {
  try {
    var parsed = JSON.parse(String(raw || ""))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyProgress()
    var next = emptyProgress()
    if (parsed.exercises && typeof parsed.exercises === "object") next.exercises = parsed.exercises
    if (Array.isArray(parsed.workoutsCompleted)) next.workoutsCompleted = parsed.workoutsCompleted
    var stage = Number(parsed.stage)
    if (stage >= 1) next.stage = Math.floor(stage)
    var cleared = Number(parsed.highestStageCleared)
    if (cleared >= 0) next.highestStageCleared = Math.floor(cleared)
    var high = Number(parsed.highScore)
    if (high >= 0) next.highScore = high
    if (parsed.highScores && typeof parsed.highScores === "object") next.highScores = parsed.highScores
    return next
  } catch (err) {
    return emptyProgress()
  }
}

function serializeProgress(progress) {
  return JSON.stringify(cloneProgress(progress), null, 2) + "\n"
}

function emptyRun(chart) {
  var notes = chart && Array.isArray(chart.notes) ? chart.notes : []
  var judgements = []
  var n
  for (n = 0; n < notes.length; n++) judgements.push(null)
  return {
    chart: chart,
    judgements: judgements,
    combo: 0,
    maxCombo: 0,
    score: 0,
    ghostMisses: 0,
    lastDeltaMs: 0,
    lastTiming: "",
    lastHitAt: -9999,
    counts: {
      Marvelous: 0,
      Perfect: 0,
      Great: 0,
      Good: 0,
      Miss: 0
    },
    chartComplete: notes.length === 0
  }
}

function cloneRun(run) {
  return JSON.parse(JSON.stringify(run))
}

function firstUnscoredIndex(run) {
  var judgements = run && run.judgements ? run.judgements : []
  var i
  for (i = 0; i < judgements.length; i++) {
    if (!judgements[i]) return i
  }
  return -1
}

function judgementForDelta(deltaMs) {
  var a = Math.abs(Number(deltaMs) || 0)
  if (a <= WINDOW.marvelous) return "Marvelous"
  if (a <= WINDOW.perfect) return "Perfect"
  if (a <= WINDOW.great) return "Great"
  if (a <= WINDOW.good) return "Good"
  return ""
}

function timingLabel(deltaMs) {
  var d = Number(deltaMs) || 0
  if (Math.abs(d) <= WINDOW.marvelous) return "HIT"
  if (d < 0) return "EARLY"
  return "LATE"
}

function stepScore(chart) {
  var n = chart && Array.isArray(chart.notes) ? chart.notes.length : 0
  if (n < 1) n = 1
  return Math.floor(SCORE_MAX / n)
}

function pointsFor(judgement, combo, chart) {
  var sc = stepScore(chart)
  if (judgement === "Marvelous") return sc
  if (judgement === "Perfect") return Math.max(0, sc - 10)
  if (judgement === "Great") return Math.max(0, Math.floor(sc / 2) - 10)
  if (judgement === "Good") return Math.max(0, Math.floor(sc / 5) - 10)
  return 0
}

function formatScore(score) {
  var n = Math.max(0, Math.floor(Number(score) || 0))
  var s = String(n)
  while (s.length < 7) s = "0" + s
  return s
}

function noteInWindow(note, nowMs) {
  if (!note) return false
  return judgementForDelta(nowMs - note.hitTimeMs) !== ""
}

function bumpCount(run, judgement) {
  if (!run.counts) run.counts = {
    Marvelous: 0, Perfect: 0, Great: 0, Good: 0, Miss: 0
  }
  if (run.counts[judgement] === undefined) run.counts[judgement] = 0
  run.counts[judgement] += 1
}

function applyJudgement(run, index, judgement) {
  run.judgements[index] = judgement
  bumpCount(run, judgement)
  if (judgement === "Miss") {
    run.combo = 0
  } else {
    run.combo += 1
    if (run.combo > run.maxCombo) run.maxCombo = run.combo
    run.score += pointsFor(judgement, run.combo, run.chart)
    run.lastHitAt = Number(run.lastHitAt)
  }
}

function maybeComplete(run) {
  var judgements = run.judgements || []
  if (judgements.length === 0) {
    run.chartComplete = true
    return run
  }
  var i
  for (i = 0; i < judgements.length; i++) {
    if (!judgements[i]) {
      run.chartComplete = false
      return run
    }
  }
  run.chartComplete = true
  return run
}

// Returns the same run object when no note timed out, so callers can skip
// reassigning (and re-evaluating bindings) on most ticks.
function advanceChart(run, nowMs) {
  var pending = run && run.chart && Array.isArray(run.chart.notes) ? run.chart.notes : []
  var due = false
  var d
  for (d = 0; d < pending.length; d++) {
    if (!run.judgements[d] && nowMs > pending[d].hitTimeMs + WINDOW.good) {
      due = true
      break
    }
  }
  if (!due) return run
  var next = cloneRun(run)
  var chart = next.chart || {}
  var notes = Array.isArray(chart.notes) ? chart.notes : []
  var i
  for (i = 0; i < notes.length; i++) {
    if (next.judgements[i]) continue
    if (nowMs > notes[i].hitTimeMs + WINDOW.good) {
      next.judgements[i] = "Miss"
      next.combo = 0
      bumpCount(next, "Miss")
    }
  }
  return maybeComplete(next)
}

function scorePress(run, nowMs, pressedChord) {
  var next = cloneRun(run)
  var chart = next.chart || {}
  var notes = Array.isArray(chart.notes) ? chart.notes : []
  var idx = firstUnscoredIndex(next)
  if (idx < 0) {
    next.ghostMisses += 1
    next.combo = 0
    next.lastTiming = ""
    next.lastDeltaMs = 0
    return { run: maybeComplete(next), result: "ghost", noteIndex: null, deltaMs: 0, timing: "" }
  }
  var note = notes[idx]
  var deltaMs = nowMs - note.hitTimeMs
  if (!noteInWindow(note, nowMs)) {
    if (nowMs - (Number(next.lastHitAt) || -9999) < 220) {
      return { run: next, result: "ignore", noteIndex: null, deltaMs: deltaMs, timing: "" }
    }
    next.ghostMisses += 1
    next.combo = 0
    next.lastDeltaMs = deltaMs
    next.lastTiming = timingLabel(deltaMs)
    return { run: next, result: "ghost", noteIndex: null, deltaMs: deltaMs, timing: next.lastTiming }
  }
  if (!chordsMatch(note.chord, pressedChord)) {
    applyJudgement(next, idx, "Miss")
    next.lastDeltaMs = deltaMs
    next.lastTiming = timingLabel(deltaMs)
    return { run: maybeComplete(next), result: "Miss", reason: "wrong", noteIndex: idx, deltaMs: deltaMs, timing: next.lastTiming }
  }
  var judgement = judgementForDelta(deltaMs)
  applyJudgement(next, idx, judgement)
  next.lastHitAt = nowMs
  next.lastDeltaMs = deltaMs
  next.lastTiming = timingLabel(deltaMs)
  return {
    run: maybeComplete(next),
    result: judgement,
    noteIndex: idx,
    deltaMs: deltaMs,
    timing: next.lastTiming
  }
}

function accuracyForRun(run) {
  var judgements = run && run.judgements ? run.judgements : []
  if (judgements.length === 0) return 0
  var hits = 0
  var i
  for (i = 0; i < judgements.length; i++) {
    var j = judgements[i]
    if (j === "Marvelous" || j === "Perfect" || j === "Great" || j === "Good") hits += 1
  }
  return hits / judgements.length
}

function gradeForRun(run) {
  var acc = accuracyForRun(run)
  if (acc >= 0.95) return "S"
  if (acc >= 0.90) return "A"
  if (acc >= 0.80) return "B"
  if (acc >= 0.70) return "C"
  return "F"
}

function isPassingGrade(grade) {
  return !!PASSING_GRADES[grade]
}

function applyChartResult(progress, run) {
  var next = cloneProgress(progress)
  var chart = run && run.chart ? run.chart : {}
  var stage = Number(chart.stage) || 1
  var grade = gradeForRun(run)
  var score = Number(run && run.score) || 0
  if (score > (Number(next.highScore) || 0)) next.highScore = score
  if (!next.highScores || typeof next.highScores !== "object") next.highScores = {}
  var key = String(stage)
  if (score > (Number(next.highScores[key]) || 0)) next.highScores[key] = score
  if (isPassingGrade(grade)) {
    next.highestStageCleared = Math.max(Number(next.highestStageCleared) || 0, stage)
    var cap = maxStage(Number(chart.catalogLength) || 0)
    if (cap < 1) cap = stage
    var following = stage + 1
    if (following > cap) following = cap
    if (following > (Number(next.stage) || 1)) next.stage = following
  }
  return next
}

function routeKeyEvent(session, parts) {
  session = session || {}
  parts = parts || {}
  if (!session.opened) return { action: "none" }
  if (isBareEscape(parts) || isBareF12(parts)) return { action: "dismiss" }
  if (!parts.key || isModifierKey(parts.key)) return { action: "ignore" }
  if (isGymControlChord(chordFromParts(parts))) return { action: "dismiss" }
  var complete = !!(session.chartComplete || session.workoutComplete)
  var hasChart = session.hasChart === true || session.hasExercise === true
  if (complete && isBareReturn(parts)) return { action: "retry" }
  if (complete || !hasChart) return { action: "ignore" }
  var chord = chordFromParts(parts)
  if (!chord) return { action: "ignore" }
  return { action: "score", chord: chord }
}

// The Qt key path and the Hyprland key listener can both report one press.
var DUPLICATE_PRESS_MS = 150

function isDuplicatePress(last, chord, nowMs) {
  if (!last || !last.chord) return false
  return last.chord === normalizeChord(chord) && Math.abs(nowMs - last.atMs) < DUPLICATE_PRESS_MS
}

// Exit 124 is timeout(1) stopping a stalled command; its output is partial.
function catalogTextForExit(exitCode, text) {
  return Number(exitCode) === 0 ? String(text || "") : ""
}

function noteY(note, nowMs, spawnY, hitY, scrollMs) {
  var travel = hitY - spawnY
  var ms = Number(scrollMs) || 1
  var progress = (nowMs - (note.hitTimeMs - ms)) / ms
  return spawnY + progress * travel
}

if (typeof module !== "undefined") {
  module.exports = {
    WINDOW: WINDOW,
    SCORE_MAX: SCORE_MAX,
    formatScore: formatScore,
    timingLabel: timingLabel,
    stepScore: stepScore,
    GYM_SUBMAP: GYM_SUBMAP,
    LANE_COUNT: LANE_COUNT,
    STAGE_START_SIZES: STAGE_START_SIZES,
    laneForIndex: laneForIndex,
    tokenizeChord: tokenizeChord,
    canonicalToken: canonicalToken,
    normalizeChord: normalizeChord,
    chordPrimaryKey: chordPrimaryKey,
    isModifierKey: isModifierKey,
    symbolKeyName: symbolKeyName,
    keyNameForQtKey: keyNameForQtKey,
    isGymControlChord: isGymControlChord,
    isDuplicatePress: isDuplicatePress,
    DUPLICATE_PRESS_MS: DUPLICATE_PRESS_MS,
    catalogTextForExit: catalogTextForExit,
    chordFromParts: chordFromParts,
    isBareEscape: isBareEscape,
    isBareReturn: isBareReturn,
    isBareF12: isBareF12,
    sandboxEnterDispatch: sandboxEnterDispatch,
    sandboxLeaveDispatch: sandboxLeaveDispatch,
    sandboxEnterArgs: sandboxEnterArgs,
    sandboxLeaveArgs: sandboxLeaveArgs,
    chordsMatch: chordsMatch,
    scoreAttempt: scoreAttempt,
    parseKeybindingsPrint: parseKeybindingsPrint,
    defaultPlayable: defaultPlayable,
    BAKED_PLAYABLE: BAKED_PLAYABLE,
    dropReason: dropReason,
    stagePoolSizes: stagePoolSizes,
    poolSizeForStage: poolSizeForStage,
    maxStage: maxStage,
    poolForStage: poolForStage,
    stageParams: stageParams,
    generateChart: generateChart,
    emptyProgress: emptyProgress,
    parseProgress: parseProgress,
    serializeProgress: serializeProgress,
    emptyRun: emptyRun,
    firstUnscoredIndex: firstUnscoredIndex,
    judgementForDelta: judgementForDelta,
    advanceChart: advanceChart,
    scorePress: scorePress,
    gradeForRun: gradeForRun,
    accuracyForRun: accuracyForRun,
    isPassingGrade: isPassingGrade,
    applyChartResult: applyChartResult,
    routeKeyEvent: routeKeyEvent,
    noteY: noteY
  }
}

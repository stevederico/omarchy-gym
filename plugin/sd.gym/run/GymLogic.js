// Shared gym logic. run/Gym.qml imports this; Node tests require the same file.
// Chart generation, catalog parse, timing, combo/score/stars, and progress
// live here so node --test can drive them without QML. The rules follow
// Rockstar Hero: Perfect/Great/Good, a x1 to x4 combo multiplier, 5 stars.

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

// Keys we can score from a Qt key event (see run/Gym.qml keyName).
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

// Hit windows in ms from the strike line. Chords take longer to press than a
// guitar key, so these are wider than Rockstar Hero's 45/90/135.
// delta < 0 = EARLY (note has not reached the line yet)
// delta > 0 = LATE (note already passed the line)
var WINDOW = {
  perfect: 70,
  great: 140,
  good: 250
}

var GRADE_POINTS = { Perfect: 100, Great: 75, Good: 50 }
var COMBO_PER_MULTIPLIER = 10
var MAX_MULTIPLIER = 4
// Share of the star points needed for each star. Star points leave out the
// combo multiplier, so hitting about half the notes cleanly earns three stars.
var STAR_THRESHOLDS = [0.28, 0.35, 0.39, 0.6, 0.85]
var STARS_TO_PASS = 3

var STAGE_START_SIZES = [3, 5, 10, 20]

// Five lanes, one per modifier set, so the lane teaches the modifiers and the
// gem shows the key.
var LANE_COUNT = 5
var LANES = [
  { label: "KEY", mods: [] },
  { label: "SUPER", mods: ["SUPER"] },
  { label: "SUPER SHIFT", mods: ["SUPER", "SHIFT"] },
  { label: "SUPER CTRL", mods: ["SUPER", "CTRL"] },
  { label: "SUPER ALT", mods: ["SUPER", "ALT"] }
]

// Hyprland binds run before a normal window sees the key. While Gym has focus
// it enters this empty submap so Super+Space etc. are scored, not launched.
var GYM_SUBMAP = "omarchy-gym"

// Notes after the last one keep the song going this long before results.
var CHART_TAIL_MS = 1500
// Earliest first note, so the opening notes can scroll in from the far end.
var FIRST_NOTE_MIN_MS = 2000

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

// Songs from Rockstar Hero, written by tools/write-songs.js.
var SONGS = [
  {
    "id": "neon-backroads",
    "title": "Neon Backroads",
    "artist": "The Static Pilots",
    "bpm": 112,
    "durationMs": 104457,
    "hue": 285,
    "hueAlt": 190,
    "file": "songs/neon-backroads.ogg",
    "onsetsMs": [2143,3214,4286,5357,5893,6429,6830,7098,7232,7500,7768,8036,8304,8438,8571,8973,9241,9375,9643,9911,10179,10446,10580,10714,11116,11384,11518,11786,12054,12321,12589,12723,12857,13259,13527,13661,13929,14464,14732,14866,15000,15402,15670,15804,16071,16339,16607,16875,17009,17143,17545,17813,17946,18214,18482,18750,19018,19152,19286,19688,19955,20089,20357,20625,20893,21161,21295,21429,21830,22098,22232,22500,23036,23304,23438,23571,24107,24375,24643,25179,25446,25580,25714,26250,26518,26786,27321,27589,27723,27857,28393,28661,28929,29196,29464,29732,29866,30000,30268,30536,30804,31071,32143,32679,32946,33214,33750,34018,34152,34286,34821,35089,35357,35893,36161,36295,36429,36964,37232,37500,37768,38036,38304,38438,38571,38839,39107,39375,39643,40714,41116,41250,41384,41518,41786,41920,42054,42188,42321,42589,42723,42857,43259,43393,43527,43661,43929,44196,44464,44732,44866,45000,45402,45536,45670,45804,46071,46205,46339,46473,46607,46875,47009,47143,47545,47679,47813,47946,48214,48750,49018,49152,49286,49821,50089,50357,50893,51161,51295,51429,51964,52232,52500,53036,53304,53438,53571,54107,54375,54643,54911,55179,55446,55580,55714,55982,56250,56518,56786,57857,58393,58661,58929,59464,59732,59866,60000,60536,60804,61071,61607,61875,62009,62143,62679,62946,63214,63482,63750,64018,64152,64286,64554,64821,65089,65357,66429,66563,66696,66830,66964,67098,67232,67500,67768,68036,68304,68571,68839,69107,69375,69643,69777,69911,70045,70179,70313,70446,70714,70848,70982,71116,71250,71384,71518,71786,72054,72321,72589,72857,73125,73393,73661,73929,74063,74196,74330,74464,74598,74732,75000,75134,75268,75402,75536,75670,75804,76071,76339,76607,76875,77143,77411,77679,77946,78214,78348,78482,78616,78750,78884,79018,79286,79420,79554,79821,79955,80089,80357,80491,80625,80893,81027,81161,81429,81696,81964,82232,82500,83571,84107,84375,84643,85179,85446,85580,85714,86250,86518,86786,87321,87589,87723,87857,88393,88661,88929,89196,89464,89732,89866,90000,90268,90536,90804,91071,92143,92679,92946,93214,93750,94018,94152,94286,94821,95089,95357,95893,96161,96295,96429,96964,97232,97500,97768,98036,98304,98438,98571,98839,99107,99375,99643,100714]
  },
  {
    "id": "voltage-parade",
    "title": "Voltage Parade",
    "artist": "Kid Capacitor",
    "bpm": 140,
    "durationMs": 97600,
    "hue": 160,
    "hueAlt": 40,
    "file": "songs/voltage-parade.ogg",
    "onsetsMs": [1714,3429,4286,4714,5143,5571,5786,6000,6214,6429,6643,6750,6857,7286,7500,7714,7929,8143,8357,8464,8571,9000,9214,9429,9643,9857,10071,10179,10286,10714,10929,11143,11357,11571,11786,11893,12000,12429,12643,12857,13071,13286,13500,13607,13714,14143,14357,14571,14786,15000,15214,15321,15429,15857,16071,16286,16500,16714,16929,17036,17143,17571,17786,18000,18214,18429,18643,18750,18857,19071,19179,19286,19500,19607,19714,19929,20036,20143,20357,20464,20571,20786,20893,21000,21214,21321,21429,21643,21750,21857,22071,22179,22286,22500,22607,22714,22929,23036,23143,23357,23464,23571,23786,23893,24000,24214,24321,24429,24643,24750,24857,25714,26357,26571,27000,27214,27321,27429,28071,28286,28714,28929,29036,29143,29786,30000,30429,30643,30750,30857,31286,31714,32143,32357,32464,32571,33214,33429,33857,34071,34179,34286,34929,35143,35571,35786,35893,36000,36643,36857,37286,37500,37607,37714,37929,38143,38357,38571,39429,39750,39857,40071,40286,40500,40714,40929,41036,41143,41464,41571,41786,42000,42214,42429,42643,42750,42857,43179,43286,43500,43714,43929,44143,44357,44464,44571,44893,45000,45214,45429,45643,45857,46071,46179,46286,46500,46607,46714,46929,47036,47143,47357,47464,47571,47786,47893,48000,48214,48321,48429,48643,48750,48857,49071,49179,49286,49500,49607,49714,49929,50036,50143,50357,50464,50571,50786,50893,51000,51214,51321,51429,51643,51750,51857,52071,52179,52286,53143,53786,54000,54429,54643,54750,54857,55500,55714,56143,56357,56464,56571,57214,57429,57857,58071,58179,58286,58714,59143,59571,59786,59893,60000,60643,60857,61286,61500,61607,61714,62357,62571,63000,63214,63321,63429,64071,64286,64714,64929,65036,65143,65357,65571,65786,66000,66857,67071,67286,67393,67500,67607,67714,67929,68143,68357,68464,68571,68786,69000,69107,69214,69429,69643,69750,69857,70071,70179,70286,70500,70714,70821,70929,71036,71143,71357,71571,71786,71893,72000,72214,72429,72536,72643,72857,73071,73179,73286,73500,73607,73714,73929,74143,74250,74357,74464,74571,74786,75000,75214,75321,75429,75643,75857,75964,76071,76286,76500,76607,76714,76929,77036,77143,77357,77571,77679,77786,77893,78000,78214,78429,78643,78750,78857,79071,79286,79500,79714,79821,79929,80036,80143,80571,81214,81429,81857,82071,82179,82286,82929,83143,83571,83786,83893,84000,84643,84857,85286,85500,85607,85714,86143,86571,87000,87214,87321,87429,88071,88286,88714,88929,89036,89143,89786,90000,90429,90643,90750,90857,91500,91714,92143,92357,92464,92571,92786,93000,93214,93429,94286]
  },
  {
    "id": "dragon-freeway",
    "title": "Dragon Freeway",
    "artist": "Iron Lantern",
    "bpm": 165,
    "durationMs": 91782,
    "hue": 12,
    "hueAlt": 48,
    "file": "songs/dragon-freeway.ogg",
    "onsetsMs": [1455,2909,3636,4000,4364,5091,5818,6545,6909,7091,7273,7455,7545,7636,7818,7909,8000,8182,8273,8364,8545,8636,8727,8909,9000,9091,9273,9364,9455,9636,9727,9818,10000,10091,10182,10364,10455,10545,10727,10818,10909,11091,11182,11273,11455,11545,11636,11818,11909,12000,12182,12273,12364,12545,12636,12727,12909,13000,13091,13273,13364,13455,13636,13727,13818,14000,14091,14182,14364,14455,14545,14727,14818,14909,15091,15182,15273,15455,15545,15636,15818,15909,16000,16182,16273,16364,16545,16636,16727,16909,17000,17091,17273,17364,17455,17636,17727,17818,18000,18091,18182,18364,18455,18545,18727,18818,18909,19273,19636,20000,20364,20545,20727,20909,21091,21273,21455,21636,21818,22182,22545,22909,23273,23455,23636,23818,24000,24182,24364,24545,24727,25091,25273,25455,25818,26000,26182,26545,26727,26909,27273,27455,27636,28000,28182,28364,28727,28909,29091,29455,29636,29818,30182,30364,30545,30909,31091,31273,31636,31818,32000,32364,32545,32727,33091,33273,33455,33818,34000,34182,34545,34727,34909,35091,35273,35455,35636,35818,36000,36182,36364,36545,36636,36727,36909,37000,37091,37273,37364,37455,37636,37727,37818,38000,38091,38182,38364,38455,38545,38727,38818,38909,39091,39182,39273,39455,39545,39636,39818,39909,40000,40182,40273,40364,40545,40636,40727,40909,41000,41091,41273,41364,41455,41636,41727,41818,42000,42091,42182,42364,42455,42545,42727,42818,42909,43091,43182,43273,43455,43545,43636,43818,43909,44000,44182,44273,44364,44545,44636,44727,44909,45000,45091,45273,45364,45455,45636,45727,45818,46000,46091,46182,46364,46455,46545,46727,46818,46909,47091,47182,47273,47455,47545,47636,47818,47909,48000,48364,48727,49091,49455,49636,49818,50000,50182,50364,50545,50727,50909,51273,51636,52000,52364,52545,52727,52909,53091,53273,53455,53636,53818,54182,54364,54545,54909,55091,55273,55636,55818,56000,56364,56545,56727,57091,57273,57455,57818,58000,58182,58545,58727,58909,59273,59455,59636,60000,60182,60364,60727,60909,61091,61455,61636,61818,62182,62364,62545,62909,63091,63273,63636,63818,64000,64182,64364,64545,64727,64909,65091,65273,65455,65636,65818,66000,66182,66364,66545,66636,66727,66818,66909,67273,67455,67636,67818,68000,68364,68545,68727,68909,69091,69273,69455,69545,69636,69727,69818,70182,70364,70545,70727,70909,71273,71455,71636,71818,72000,72182,72364,72455,72545,72636,72727,73091,73273,73455,73636,73818,74000,74182,74364,74545,74727,74909,75091,75273,75455,75636,75818,76000,76182,76364,76545,76727,76909,77091,77455,77636,77818,78182,78364,78545,78909,79091,79273,79636,79818,80000,80364,80545,80727,81091,81273,81455,81818,82000,82182,82545,82727,82909,83273,83455,83636,84000,84182,84364,84727,84909,85091,85455,85636,85818,86182,86364,86545,86909,87091,87273,87455,87636,87818,88000,88182,88364,88545,88727]
  }
]
// End of SONGS.

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


// Lane for a chord: no Super, Super alone, then the strongest extra modifier
// (Alt, then Ctrl, then Shift). Super+Shift+Ctrl sits in the Ctrl lane.
function laneForChord(chord) {
  var tokens = tokenizeChord(chord).map(canonicalToken)
  if (tokens.indexOf("SUPER") === -1) return 0
  if (tokens.indexOf("ALT") !== -1) return 4
  if (tokens.indexOf("CTRL") !== -1) return 3
  if (tokens.indexOf("SHIFT") !== -1) return 2
  return 1
}

var KEY_GLYPHS = {
  RETURN: "RET",
  ESCAPE: "ESC",
  BACKSPACE: "BKSP",
  DELETE: "DEL",
  PRINT: "PRT",
  PAGEUP: "PGUP",
  PAGEDOWN: "PGDN",
  BRACKETLEFT: "[",
  BRACKETRIGHT: "]",
  MINUS: "-",
  EQUAL: "=",
  COMMA: ",",
  PERIOD: ".",
  SLASH: "/",
  BACKSLASH: "\\",
  SEMICOLON: ";",
  APOSTROPHE: "'",
  GRAVE: "`",
  LEFT: "←",
  RIGHT: "→",
  UP: "↑",
  DOWN: "↓"
}

// Text on a gem: the key, plus any modifier the lane does not already show.
function noteGlyph(chord) {
  var normalized = normalizeChord(chord)
  if (!normalized) return ""
  var parts = normalized.split(" + ")
  var key = parts[parts.length - 1]
  var implied = LANES[laneForChord(normalized)].mods
  var shown = []
  var p
  for (p = 0; p < parts.length - 1; p++) {
    if (implied.indexOf(parts[p]) === -1) shown.push(parts[p] === "SHIFT" ? "⇧" : parts[p])
  }
  shown.push(KEY_GLYPHS[key] || key)
  return shown.join(" ")
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
    firstNoteMs: Math.max(FIRST_NOTE_MIN_MS, scrollMs)
  }
}

function songForStage(stage) {
  if (!SONGS.length) return null
  var s = Math.max(1, Math.floor(Number(stage) || 1))
  return SONGS[(s - 1) % SONGS.length]
}

function beatMs(song) {
  return 60000 / (Number(song && song.bpm) || 120)
}

// Times the music gives us to land a note on: every lead guitar onset and
// every beat, in order.
function songCandidateTimes(song) {
  if (!song) return []
  var seen = {}
  var out = []
  var onsets = Array.isArray(song.onsetsMs) ? song.onsetsMs : []
  var n
  for (n = 0; n < onsets.length; n++) {
    var t = Math.round(onsets[n])
    if (!seen[t]) { seen[t] = true; out.push(t) }
  }
  var beat = beatMs(song)
  var end = (Number(song.durationMs) || 0) - CHART_TAIL_MS
  for (n = 0; n * beat <= end; n++) {
    var b = Math.round(n * beat)
    if (!seen[b]) { seen[b] = true; out.push(b) }
  }
  out.sort(function (a, b) { return a - b })
  return out
}

// Note times at least gapMs apart, each snapped to the next thing you can hear.
// Past the end of the song they fall back to an even spacing.
function pickNoteTimes(song, count, gapMs, firstMs) {
  var candidates = songCandidateTimes(song)
  var times = []
  var target = firstMs
  var c = 0
  while (times.length < count) {
    while (c < candidates.length && candidates[c] < target) c++
    var t = c < candidates.length ? candidates[c] : target
    times.push(t)
    target = t + gapMs
  }
  return times
}

function pickPoolIndex(poolLength, noteIndex, stage, prevIndex) {
  if (poolLength <= 0) return 0
  if (stage <= 2) return noteIndex % poolLength
  var idx = Math.abs((stage * 10007 + noteIndex * 9176) % poolLength)
  if (idx === prevIndex && poolLength > 1) idx = (idx + 1) % poolLength
  return idx
}

function generateChart(playable, stage, song) {
  var s = Math.max(1, Number(stage) || 1)
  if (song === undefined) song = songForStage(s)
  var pool = poolForStage(playable, s)
  var params = stageParams(s)
  var times = pool.length ? pickNoteTimes(song, params.noteCount, params.gapMs, params.firstNoteMs) : []
  var notes = []
  var prev = -1
  var n
  for (n = 0; n < times.length; n++) {
    var idx = pickPoolIndex(pool.length, n, s, prev)
    var binding = pool[idx] || pool[0]
    notes.push({
      index: notes.length,
      id: binding.id,
      chord: binding.chord,
      action: binding.action,
      hitTimeMs: times[n],
      lane: laneForChord(binding.chord)
    })
    prev = idx
  }
  var last = notes.length ? notes[notes.length - 1].hitTimeMs : 0
  return {
    stage: s,
    poolSize: pool.length,
    catalogLength: Array.isArray(playable) ? playable.length : 0,
    notes: notes,
    scrollMs: params.scrollMs,
    gapMs: params.gapMs,
    songId: song ? song.id : "",
    endMs: last + WINDOW.good + CHART_TAIL_MS
  }
}

function emptyProgress() {
  return {
    version: 3,
    stage: 1,
    highestStageCleared: 0,
    highScore: 0,
    highScores: {},
    bestStars: {},
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
    if (parsed.bestStars && typeof parsed.bestStars === "object") next.bestStars = parsed.bestStars
    return next
  } catch (err) {
    return emptyProgress()
  }
}

function serializeProgress(progress) {
  return JSON.stringify(cloneProgress(progress), null, 2) + "\n"
}

function emptyCounts() {
  return { Perfect: 0, Great: 0, Good: 0, Miss: 0 }
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
    starPoints: 0,
    ghostMisses: 0,
    lastDeltaMs: 0,
    lastTiming: "",
    lastHitAt: -9999,
    counts: emptyCounts(),
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
  if (a <= WINDOW.perfect) return "Perfect"
  if (a <= WINDOW.great) return "Great"
  if (a <= WINDOW.good) return "Good"
  return ""
}

function timingLabel(deltaMs) {
  var d = Number(deltaMs) || 0
  if (Math.abs(d) <= WINDOW.perfect) return "HIT"
  if (d < 0) return "EARLY"
  return "LATE"
}

function comboMultiplier(combo) {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor((Number(combo) || 0) / COMBO_PER_MULTIPLIER))
}

function maxStarPoints(chart) {
  var notes = chart && Array.isArray(chart.notes) ? chart.notes : []
  return notes.length * GRADE_POINTS.Perfect
}

function starsFor(points, maxPoints) {
  if (!(maxPoints > 0)) return 0
  var share = points / maxPoints
  var stars = 0
  var t
  for (t = 0; t < STAR_THRESHOLDS.length; t++) {
    if (share >= STAR_THRESHOLDS[t]) stars += 1
  }
  return stars
}

function starsForRun(run) {
  return starsFor(Number(run && run.starPoints) || 0, maxStarPoints(run && run.chart))
}

function isPassingStars(stars) {
  return (Number(stars) || 0) >= STARS_TO_PASS
}

// Score with thousands separators, like Rockstar Hero's HUD.
function formatScore(score) {
  var s = String(Math.max(0, Math.floor(Number(score) || 0)))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function noteInWindow(note, nowMs) {
  if (!note) return false
  return judgementForDelta(nowMs - note.hitTimeMs) !== ""
}

function bumpCount(run, judgement) {
  if (!run.counts) run.counts = emptyCounts()
  if (run.counts[judgement] === undefined) run.counts[judgement] = 0
  run.counts[judgement] += 1
}

// Hits raise the combo first and then score, so the 10th hit in a row
// already pays x2, as in Rockstar Hero.
function applyJudgement(run, index, judgement) {
  run.judgements[index] = judgement
  bumpCount(run, judgement)
  if (judgement === "Miss") {
    run.combo = 0
    return
  }
  run.combo += 1
  if (run.combo > run.maxCombo) run.maxCombo = run.combo
  var base = GRADE_POINTS[judgement] || 0
  run.starPoints += base
  run.score += base * comboMultiplier(run.combo)
}

function maybeComplete(run) {
  var judgements = run.judgements || []
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
  var notes = next.chart.notes
  var i
  for (i = 0; i < notes.length; i++) {
    if (next.judgements[i]) continue
    if (nowMs > notes[i].hitTimeMs + WINDOW.good) applyJudgement(next, i, "Miss")
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
    if (j === "Perfect" || j === "Great" || j === "Good") hits += 1
  }
  return hits / judgements.length
}

function applyChartResult(progress, run) {
  var next = cloneProgress(progress)
  var chart = run && run.chart ? run.chart : {}
  var stage = Number(chart.stage) || 1
  var stars = starsForRun(run)
  var score = Number(run && run.score) || 0
  var key = String(stage)
  if (score > (Number(next.highScore) || 0)) next.highScore = score
  if (!next.highScores || typeof next.highScores !== "object") next.highScores = {}
  if (score > (Number(next.highScores[key]) || 0)) next.highScores[key] = score
  if (!next.bestStars || typeof next.bestStars !== "object") next.bestStars = {}
  if (stars > (Number(next.bestStars[key]) || 0)) next.bestStars[key] = stars
  if (isPassingStars(stars)) {
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

// Keep the song clock on the audio position once it drifts past this.
var AUDIO_RESYNC_MS = 45

// New clock origin (Date.now() at song time 0) given where the audio says it is.
function resyncOrigin(origin, wallMs, audioMs) {
  var clock = wallMs - origin
  if (Math.abs(clock - audioMs) <= AUDIO_RESYNC_MS) return origin
  return wallMs - audioMs
}

if (typeof module !== "undefined") {
  module.exports = {
    WINDOW: WINDOW,
    GRADE_POINTS: GRADE_POINTS,
    STAR_THRESHOLDS: STAR_THRESHOLDS,
    STARS_TO_PASS: STARS_TO_PASS,
    MAX_MULTIPLIER: MAX_MULTIPLIER,
    CHART_TAIL_MS: CHART_TAIL_MS,
    FIRST_NOTE_MIN_MS: FIRST_NOTE_MIN_MS,
    AUDIO_RESYNC_MS: AUDIO_RESYNC_MS,
    formatScore: formatScore,
    timingLabel: timingLabel,
    GYM_SUBMAP: GYM_SUBMAP,
    LANE_COUNT: LANE_COUNT,
    LANES: LANES,
    SONGS: SONGS,
    STAGE_START_SIZES: STAGE_START_SIZES,
    laneForChord: laneForChord,
    noteGlyph: noteGlyph,
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
    resyncOrigin: resyncOrigin,
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
    songForStage: songForStage,
    songCandidateTimes: songCandidateTimes,
    pickNoteTimes: pickNoteTimes,
    generateChart: generateChart,
    emptyProgress: emptyProgress,
    parseProgress: parseProgress,
    serializeProgress: serializeProgress,
    emptyRun: emptyRun,
    firstUnscoredIndex: firstUnscoredIndex,
    judgementForDelta: judgementForDelta,
    comboMultiplier: comboMultiplier,
    maxStarPoints: maxStarPoints,
    starsFor: starsFor,
    starsForRun: starsForRun,
    isPassingStars: isPassingStars,
    advanceChart: advanceChart,
    scorePress: scorePress,
    accuracyForRun: accuracyForRun,
    applyChartResult: applyChartResult,
    routeKeyEvent: routeKeyEvent
  }
}

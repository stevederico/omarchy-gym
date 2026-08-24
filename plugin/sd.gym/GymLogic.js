// Shared gym logic. Gym.qml imports this; Node tests require the same file.

var MASTERY_STREAK = 3

var LESSON_ORDER = ["launch", "windows", "focus", "workspaces", "capture", "system"]

var LESSON_NAMES = {
  launch: "Launch",
  windows: "Windows",
  focus: "Focus",
  workspaces: "Workspaces",
  capture: "Capture",
  system: "System"
}

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
  PAGE_DOWN: "PAGEDOWN"
}

var MODIFIER_KEYS = {
  SUPER: true,
  SHIFT: true,
  CTRL: true,
  ALT: true,
  META: true,
  CONTROL: true
}

// Progressive catalog. Launch is the beginner workout; later lessons stay
// locked until every exercise in the previous lesson is mastered.
var DEFAULT_EXERCISES = [
  { id: "launch.menu", lesson: "launch", prompt: "Open the Omarchy menu", chord: "SUPER + SPACE" },
  { id: "launch.terminal", lesson: "launch", prompt: "Open a terminal", chord: "SUPER + RETURN" },
  { id: "launch.browser", lesson: "launch", prompt: "Open a browser", chord: "SUPER SHIFT + RETURN" },
  { id: "launch.files", lesson: "launch", prompt: "Open the file manager", chord: "SUPER SHIFT + F" },

  { id: "windows.fullscreen", lesson: "windows", prompt: "Full screen the focused window", chord: "SUPER + F" },
  { id: "windows.float", lesson: "windows", prompt: "Toggle window floating or tiling", chord: "SUPER + T" },
  { id: "windows.split", lesson: "windows", prompt: "Toggle the window split", chord: "SUPER + J" },
  { id: "windows.popout", lesson: "windows", prompt: "Pop the window out (float and pin)", chord: "SUPER + O" },

  { id: "focus.left", lesson: "focus", prompt: "Focus the window to the left", chord: "SUPER + LEFT" },
  { id: "focus.right", lesson: "focus", prompt: "Focus the window to the right", chord: "SUPER + RIGHT" },
  { id: "focus.up", lesson: "focus", prompt: "Focus the window above", chord: "SUPER + UP" },
  { id: "focus.down", lesson: "focus", prompt: "Focus the window below", chord: "SUPER + DOWN" },

  { id: "workspaces.one", lesson: "workspaces", prompt: "Switch to workspace 1", chord: "SUPER + 1" },
  { id: "workspaces.two", lesson: "workspaces", prompt: "Switch to workspace 2", chord: "SUPER + 2" },
  { id: "workspaces.three", lesson: "workspaces", prompt: "Switch to workspace 3", chord: "SUPER + 3" },
  { id: "workspaces.four", lesson: "workspaces", prompt: "Switch to workspace 4", chord: "SUPER + 4" },

  { id: "capture.screenshot", lesson: "capture", prompt: "Take a screenshot", chord: "PRINT" },
  { id: "capture.clipboard", lesson: "capture", prompt: "Open the clipboard manager", chord: "SUPER CTRL + V" },
  { id: "capture.emojis", lesson: "capture", prompt: "Open the emoji picker", chord: "SUPER CTRL + E" },

  { id: "system.lock", lesson: "system", prompt: "Lock the system", chord: "SUPER CTRL + L" },
  { id: "system.menu", lesson: "system", prompt: "Open the system menu", chord: "SUPER + ESCAPE" },
  { id: "system.keybindings", lesson: "system", prompt: "Open the keybindings list", chord: "SUPER + K" }
]

function fullCatalog(exercises) {
  if (Array.isArray(exercises) && exercises.length > 0) return exercises
  return DEFAULT_EXERCISES.slice()
}

function lessonName(lesson) {
  return LESSON_NAMES[lesson] || String(lesson || "")
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
  var i
  for (i = 0; i < tokens.length; i++) {
    var token = canonicalToken(tokens[i])
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

// Hyprland binds run before layer-shell exclusive focus. While the gym is
// open we enter this empty-ish submap so Super+Space etc. reach the overlay
// instead of launching the real menu/terminal.
var GYM_SUBMAP = "omarchy-gym"

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

// Overlay key router. Bare Escape always dismisses, even on the success
// screen or during the hit-advance delay — otherwise exclusive grab traps
// the keyboard.
function routeKeyEvent(session, parts) {
  session = session || {}
  parts = parts || {}
  if (!session.opened) return { action: "none" }
  if (isBareEscape(parts)) return { action: "dismiss" }
  if (isModifierKey(parts.key)) return { action: "ignore" }
  if (session.workoutComplete || session.awaitingAdvance || !session.hasExercise)
    return { action: "ignore" }
  var chord = chordFromParts(parts)
  if (!chord) return { action: "ignore" }
  return { action: "score", chord: chord }
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

function emptyProgress() {
  return {
    version: 1,
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
    return next
  } catch (err) {
    return emptyProgress()
  }
}

function serializeProgress(progress) {
  return JSON.stringify(cloneProgress(progress), null, 2) + "\n"
}

function exerciseRecord(progress, exerciseId) {
  var rec = progress && progress.exercises ? progress.exercises[exerciseId] : null
  if (!rec || typeof rec !== "object") {
    return { hits: 0, misses: 0, consecutiveHits: 0, mastered: false }
  }
  return {
    hits: Number(rec.hits) || 0,
    misses: Number(rec.misses) || 0,
    consecutiveHits: Number(rec.consecutiveHits) || 0,
    mastered: rec.mastered === true
  }
}

function isMastered(progress, exerciseId) {
  return exerciseRecord(progress, exerciseId).mastered === true
}

function applyAttempt(progress, exerciseId, hit) {
  var next = cloneProgress(progress)
  if (!next.exercises || typeof next.exercises !== "object") next.exercises = {}
  var rec = exerciseRecord(next, exerciseId)
  if (hit) {
    rec.hits += 1
    rec.consecutiveHits += 1
    if (rec.consecutiveHits >= MASTERY_STREAK) rec.mastered = true
  } else {
    rec.misses += 1
    rec.consecutiveHits = 0
  }
  next.exercises[exerciseId] = rec
  return next
}

function exercisesForLesson(lesson, catalog) {
  var source = fullCatalog(catalog)
  var out = []
  var i
  for (i = 0; i < source.length; i++) {
    if (source[i] && source[i].lesson === lesson) out.push(source[i])
  }
  return out
}

function lessonMastered(progress, lesson, catalog) {
  var xs = exercisesForLesson(lesson, catalog)
  if (xs.length === 0) return true
  var i
  for (i = 0; i < xs.length; i++) {
    if (!isMastered(progress, xs[i].id)) return false
  }
  return true
}

function nextLessonId(progress, catalog) {
  var i
  for (i = 0; i < LESSON_ORDER.length; i++) {
    if (!lessonMastered(progress, LESSON_ORDER[i], catalog)) return LESSON_ORDER[i]
  }
  return LESSON_ORDER[LESSON_ORDER.length - 1]
}

function assembleWorkout(progress, catalog) {
  var source = fullCatalog(catalog)
  var state = progress && typeof progress === "object" ? progress : emptyProgress()
  var lesson = nextLessonId(state, source)
  var exercises = exercisesForLesson(lesson, source)
  return {
    id: "workout-" + lesson,
    lesson: lesson,
    name: lessonName(lesson),
    exercises: exercises
  }
}

function finishWorkout(progress, workout) {
  var next = cloneProgress(progress)
  if (!Array.isArray(next.workoutsCompleted)) next.workoutsCompleted = []
  var id = workout && workout.id ? String(workout.id) : ""
  if (id && next.workoutsCompleted.indexOf(id) === -1) next.workoutsCompleted.push(id)
  return next
}

if (typeof module !== "undefined") {
  module.exports = {
    MASTERY_STREAK: MASTERY_STREAK,
    LESSON_ORDER: LESSON_ORDER,
    DEFAULT_EXERCISES: DEFAULT_EXERCISES,
    fullCatalog: fullCatalog,
    lessonName: lessonName,
    normalizeChord: normalizeChord,
    isModifierKey: isModifierKey,
    chordFromParts: chordFromParts,
    isBareEscape: isBareEscape,
    GYM_SUBMAP: GYM_SUBMAP,
    sandboxEnterDispatch: sandboxEnterDispatch,
    sandboxLeaveDispatch: sandboxLeaveDispatch,
    sandboxEnterArgs: sandboxEnterArgs,
    sandboxLeaveArgs: sandboxLeaveArgs,
    routeKeyEvent: routeKeyEvent,
    chordsMatch: chordsMatch,
    scoreAttempt: scoreAttempt,
    emptyProgress: emptyProgress,
    parseProgress: parseProgress,
    serializeProgress: serializeProgress,
    isMastered: isMastered,
    applyAttempt: applyAttempt,
    assembleWorkout: assembleWorkout,
    finishWorkout: finishWorkout,
    exercisesForLesson: exercisesForLesson,
    lessonMastered: lessonMastered
  }
}

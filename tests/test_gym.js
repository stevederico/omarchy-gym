"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")

const repoLogic = path.join(__dirname, "..", "plugin", "sd.gym", "run", "GymLogic.js")
const gym = require(repoLogic)
const stage = require(path.join(__dirname, "..", "plugin", "sd.gym", "run", "Stage.js"))
const fixturePath = path.join(__dirname, "..", "plugin", "sd.gym", "keybindings-print.txt")
const fixture = fs.readFileSync(fixturePath, "utf8")

test("tests require the repo plugin module, not the installed copy", () => {
  assert.equal(require.resolve(repoLogic), path.resolve(repoLogic))
  assert.match(repoLogic, /plugin\/sd\.gym\/run\/GymLogic\.js$/)
})

test("chordPrimaryKey is the last token of the chord", () => {
  assert.equal(gym.chordPrimaryKey("SUPER + SPACE"), "SPACE")
  assert.equal(gym.chordPrimaryKey("SUPER + SHIFT + RETURN"), "RETURN")
  assert.equal(gym.chordPrimaryKey("SUPER + SHIFT + CTRL + SPACE"), "SPACE")
  assert.equal(gym.chordPrimaryKey("K"), "K")
  assert.equal(gym.chordPrimaryKey("super+k"), "K")
})

test("catalog parse of keybindings-print fixture excludes mouse rows", () => {
  const parsed = gym.parseKeybindingsPrint(fixture)
  assert.ok(parsed.playable.length > 0, "playable catalog must not be empty")
  const mouseDropped = parsed.dropped.filter((row) => row.reason === "mouse")
  assert.ok(mouseDropped.length >= 2, "mouse rows must be dropped")
  for (const row of mouseDropped) {
    assert.match(row.chord, /mouse/i)
  }
  for (const row of parsed.playable) {
    assert.doesNotMatch(row.chord, /mouse/i)
    assert.doesNotMatch(row.chord, /XF86/i)
  }
})

test("playable pool is the keyboard prefix of Learn print order", () => {
  const parsed = gym.parseKeybindingsPrint(fixture)
  const baked = gym.defaultPlayable()
  assert.equal(parsed.playable.length, baked.length)
  assert.equal(parsed.playable[0].chord, "SUPER + K")
  assert.equal(parsed.playable[0].action, "Keybindings")
  assert.equal(parsed.playable[1].chord, "SUPER + SPACE")
  assert.equal(parsed.playable[1].action, "Omarchy menu")
  assert.equal(parsed.playable[2].chord, "SUPER + RETURN")
  assert.equal(parsed.playable[2].action, "Terminal")
  assert.deepEqual(
    parsed.playable.map((row) => row.chord),
    baked.map((row) => row.chord)
  )
  assert.ok(Array.isArray(gym.BAKED_PLAYABLE))
  assert.equal(gym.BAKED_PLAYABLE.length, parsed.playable.length)
  assert.deepEqual(
    gym.BAKED_PLAYABLE.map((row) => row.chord),
    parsed.playable.map((row) => row.chord),
    "QML overlay catalog (BAKED_PLAYABLE) must match the print fixture"
  )
})

test("stage pools are 3, 5, 10, 20, then doubling until the full catalog", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const sizes = gym.stagePoolSizes(playable.length)
  assert.equal(sizes[0], 3)
  assert.equal(sizes[1], 5)
  assert.equal(sizes[2], 10)
  assert.equal(sizes[3], 20)
  assert.equal(sizes[4], 40)
  assert.equal(sizes[sizes.length - 1], playable.length)
  for (let i = 4; i < sizes.length - 1; i++) {
    assert.equal(sizes[i], sizes[i - 1] * 2)
  }
  assert.equal(gym.poolSizeForStage(1, playable.length), 3)
  assert.equal(gym.poolSizeForStage(2, playable.length), 5)
  assert.equal(gym.poolSizeForStage(3, playable.length), 10)
  assert.equal(gym.poolSizeForStage(4, playable.length), 20)
})

test("stage-1 chart chords are a subset of the first 3 playable rows", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const first3 = new Set(playable.slice(0, 3).map((row) => row.chord))
  const chart = gym.generateChart(playable, 1)
  assert.equal(chart.stage, 1)
  assert.equal(chart.poolSize, 3)
  assert.ok(chart.notes.length > 0, "chart must have notes")
  for (const note of chart.notes) {
    assert.ok(first3.has(note.chord), `stage-1 note ${note.chord} must be in first 3`)
    assert.ok(note.action, "note must carry the English action")
    assert.equal(note.lane, gym.laneForChord(note.chord), "lane comes from the modifiers")
  }
  for (let i = 1; i < chart.notes.length; i++) {
    assert.ok(
      chart.notes[i].hitTimeMs > chart.notes[i - 1].hitTimeMs,
      "one note at a time: hit times must be strictly increasing"
    )
    assert.ok(
      chart.notes[i].hitTimeMs - chart.notes[i - 1].hitTimeMs > gym.WINDOW.good * 2,
      "windows must not overlap"
    )
  }
})

test("hit is judged against the strike line: Perfect on the line, Great slightly off, late is Miss", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const note = chart.notes[0]

  const onLine = gym.scorePress(gym.emptyRun(chart), note.hitTimeMs, note.chord)
  assert.equal(onLine.result, "Perfect")
  assert.equal(onLine.timing, "HIT")
  assert.equal(onLine.deltaMs, 0)
  assert.equal(onLine.run.judgements[0], "Perfect")
  assert.equal(onLine.run.combo, 1)
  assert.equal(onLine.run.score, gym.GRADE_POINTS.Perfect)

  const early = gym.scorePress(gym.emptyRun(chart), note.hitTimeMs - (gym.WINDOW.perfect + 8), note.chord)
  assert.equal(early.result, "Great")
  assert.equal(early.timing, "EARLY")
  assert.ok(early.deltaMs < 0)

  const late = gym.scorePress(gym.emptyRun(chart), note.hitTimeMs + (gym.WINDOW.great + 8), note.chord)
  assert.equal(late.result, "Good")
  assert.equal(late.timing, "LATE")
  assert.ok(late.deltaMs > 0)

  const lateRun = gym.advanceChart(gym.emptyRun(chart), note.hitTimeMs + gym.WINDOW.good + 1)
  assert.equal(lateRun.judgements[0], "Miss")
  assert.equal(lateRun.combo, 0)

  const wrong = gym.scorePress(gym.emptyRun(chart), note.hitTimeMs, "ALT + F12")
  assert.equal(gym.chordsMatch(note.chord, "ALT + F12"), false)
  assert.equal(wrong.result, "Miss")
  assert.equal(wrong.reason, "wrong")
  assert.equal(wrong.run.judgements[0], "Miss")
  assert.equal(wrong.run.combo, 0)
})

test("ghost miss breaks combo and does not skip a note", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const first = chart.notes[0]
  const second = chart.notes[1]
  let result = gym.scorePress(gym.emptyRun(chart), first.hitTimeMs, first.chord)
  assert.equal(result.result, "Perfect")
  assert.equal(result.run.combo, 1)
  assert.equal(result.run.judgements[0], "Perfect")
  assert.equal(result.run.judgements[1], null)

  const midway = first.hitTimeMs + (second.hitTimeMs - first.hitTimeMs) / 2
  result = gym.scorePress(result.run, midway, first.chord)
  assert.equal(result.result, "ghost")
  assert.equal(result.run.combo, 0)
  assert.equal(result.run.ghostMisses, 1)
  assert.equal(result.run.judgements[1], null, "ghost miss must not skip the next note")
  assert.equal(gym.firstUnscoredIndex(result.run), 1)
})

test("a press right after a hit is ignored and does not turn Great into Miss", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const first = chart.notes[0]
  let result = gym.scorePress(gym.emptyRun(chart), first.hitTimeMs + 90, first.chord)
  assert.equal(result.result, "Great")
  assert.equal(result.run.combo, 1)
  const echo = gym.scorePress(result.run, first.hitTimeMs + 120, first.chord)
  assert.equal(echo.result, "ignore")
  assert.equal(echo.run.combo, 1)
  assert.equal(echo.run.judgements[0], "Great")
})

test("combo resets on miss", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const first = chart.notes[0]
  const second = chart.notes[1]
  let result = gym.scorePress(gym.emptyRun(chart), first.hitTimeMs, first.chord)
  assert.equal(result.run.combo, 1)
  result = gym.scorePress(result.run, second.hitTimeMs, "SUPER SHIFT CTRL ALT + F9")
  assert.equal(result.result, "Miss")
  assert.equal(result.run.combo, 0)
  assert.equal(result.run.judgements[1], "Miss")
})

test("next stage unlocks only with three stars or more", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const missed = gym.advanceChart(gym.emptyRun(chart), chart.notes[chart.notes.length - 1].hitTimeMs + gym.WINDOW.good + 50)
  assert.equal(missed.chartComplete, true)
  assert.equal(gym.starsForRun(missed), 0)
  let progress = gym.applyChartResult(gym.emptyProgress(), missed)
  assert.equal(progress.stage, 1)
  assert.equal(progress.highestStageCleared, 0)

  let passRun = gym.emptyRun(chart)
  for (const note of chart.notes) {
    const scored = gym.scorePress(passRun, note.hitTimeMs, note.chord)
    assert.equal(scored.result, "Perfect")
    passRun = scored.run
  }
  assert.equal(gym.starsForRun(passRun), 5)
  assert.equal(gym.isPassingStars(5), true)
  progress = gym.applyChartResult(gym.emptyProgress(), passRun)
  assert.equal(progress.stage, 2)
  assert.equal(progress.highestStageCleared, 1)
  assert.equal(progress.bestStars["1"], 5)
  assert.ok(progress.highScore > 0)
})

test("old gym-progress.json still parses", () => {
  const old = JSON.stringify({
    version: 1,
    exercises: {
      "launch.menu": { hits: 3, misses: 1, consecutiveHits: 3, mastered: true }
    },
    workoutsCompleted: ["workout-launch"]
  })
  const parsed = gym.parseProgress(old)
  assert.equal(parsed.stage, 1)
  assert.equal(parsed.highestStageCleared, 0)
  assert.equal(parsed.highScore, 0)
  assert.equal(parsed.exercises["launch.menu"].mastered, true)
  assert.deepEqual(parsed.workoutsCompleted, ["workout-launch"])
  assert.equal(gym.parseProgress("{}").stage, 1)
  assert.equal(gym.parseProgress("not-json").stage, 1)
})

test("stage 1 notes fall slowly enough to read", () => {
  const params = gym.stageParams(1)
  assert.ok(params.scrollMs >= 3500, `stage-1 scroll ${params.scrollMs} should be slow`)
  assert.ok(params.gapMs >= 2000, `stage-1 gap ${params.gapMs} should leave time between notes`)
})

test("five lanes by modifier: none, Super, Super+Shift, Super+Ctrl, Super+Alt", () => {
  assert.equal(gym.LANE_COUNT, 5)
  assert.deepEqual(gym.LANES.map((lane) => lane.label), ["KEY", "SUPER", "SUPER SHIFT", "SUPER CTRL", "SUPER ALT"])
  assert.equal(gym.laneForChord("PRINT"), 0)
  assert.equal(gym.laneForChord("CTRL + ALT + DELETE"), 0)
  assert.equal(gym.laneForChord("SUPER + K"), 1)
  assert.equal(gym.laneForChord("SUPER + SHIFT + F"), 2)
  assert.equal(gym.laneForChord("SUPER + CTRL + L"), 3)
  assert.equal(gym.laneForChord("SUPER + SHIFT + CTRL + SPACE"), 3, "Ctrl outranks Shift")
  assert.equal(gym.laneForChord("SUPER + ALT + F"), 4)
  assert.equal(gym.laneForChord("SUPER + SHIFT + ALT + B"), 4, "Alt outranks Shift")
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const used = new Set(playable.map((row) => gym.laneForChord(row.chord)))
  assert.deepEqual([...used].sort(), [0, 1, 2, 3, 4], "the stock catalog fills every lane")
})

test("gems show the key plus any modifier the lane does not", () => {
  assert.equal(gym.noteGlyph("SUPER + K"), "K")
  assert.equal(gym.noteGlyph("SUPER + RETURN"), "RET")
  assert.equal(gym.noteGlyph("SUPER + SHIFT + SLASH"), "/")
  assert.equal(gym.noteGlyph("SUPER + SHIFT + CTRL + SPACE"), "⇧ SPACE")
  assert.equal(gym.noteGlyph("CTRL + ALT + DELETE"), "CTRL ALT DEL")
  assert.equal(gym.noteGlyph("SUPER + LEFT"), "←")
})

test("bare Escape dismisses even when the chart is complete or mid-run", () => {
  const escape = { key: "ESCAPE", superHeld: false, shiftHeld: false, ctrlHeld: false, altHeld: false }
  const complete = gym.routeKeyEvent(
    { opened: true, chartComplete: true, hasChart: false },
    escape
  )
  const waiting = gym.routeKeyEvent(
    { opened: true, chartComplete: false, hasChart: true },
    escape
  )
  const active = gym.routeKeyEvent(
    { opened: true, chartComplete: false, hasChart: true },
    escape
  )
  assert.equal(complete.action, "dismiss")
  assert.equal(waiting.action, "dismiss")
  assert.equal(active.action, "dismiss")
})

test("bare Return retries after the chart is complete", () => {
  const enter = { key: "RETURN", superHeld: false, shiftHeld: false, ctrlHeld: false, altHeld: false }
  const done = gym.routeKeyEvent(
    { opened: true, chartComplete: true, hasChart: true },
    enter
  )
  const playing = gym.routeKeyEvent(
    { opened: true, chartComplete: false, hasChart: true },
    enter
  )
  assert.equal(done.action, "retry")
  assert.equal(playing.action, "score")
  assert.equal(playing.chord, "RETURN")
})

test("bare F12 dismisses as the grab failsafe", () => {
  const f12 = { key: "F12", superHeld: false, shiftHeld: false, ctrlHeld: false, altHeld: false }
  const routed = gym.routeKeyEvent({ opened: true, chartComplete: false, hasChart: true }, f12)
  assert.equal(routed.action, "dismiss")
})

test("Super+Escape is scored, not treated as leave", () => {
  const routed = gym.routeKeyEvent(
    { opened: true, chartComplete: false, hasChart: true },
    { key: "ESCAPE", superHeld: true, shiftHeld: false, ctrlHeld: false, altHeld: false }
  )
  assert.equal(routed.action, "score")
  assert.equal(routed.chord, "SUPER + ESCAPE")
})

test("sandbox enter dispatch names omarchy-gym and leave is reset", () => {
  const enter = gym.sandboxEnterArgs()
  const leave = gym.sandboxLeaveArgs()
  const enterCode = gym.sandboxEnterDispatch()
  const leaveCode = gym.sandboxLeaveDispatch()

  assert.match(enterCode, /hl\.dsp\.submap\("/)
  assert.ok(enterCode.includes(gym.GYM_SUBMAP), "enter dispatch must name the gym submap")
  assert.ok(!enterCode.includes("reset"), "enter must not reset")
  assert.match(leaveCode, /hl\.dsp\.submap\("reset"\)/)
  assert.deepEqual(enter, ["hyprctl", "dispatch", enterCode])
  assert.deepEqual(leave, ["hyprctl", "dispatch", leaveCode])
  assert.equal(gym.GYM_SUBMAP, "omarchy-gym")
})

test("notes roll toward the strike line along the perspective highway", () => {
  const layout = stage.computeLayout(1100, 700)
  assert.equal(layout.isPortrait, false)
  const lookahead = 2000
  const at = (nowMs) => stage.project(layout, stage.laneCenter(2), stage.noteDepth(2000, nowMs, lookahead))
  const far = at(0)
  const mid = at(1000)
  const hit = at(2000)
  const past = at(2300)
  assert.ok(far.y < mid.y && mid.y < hit.y && hit.y < past.y, "notes move down the screen")
  assert.equal(hit.y, layout.strikeY)
  assert.ok(stage.depthScale(1) < stage.depthScale(0), "far notes are smaller")
  const left = stage.project(layout, stage.laneCenter(0), 0)
  const right = stage.project(layout, stage.laneCenter(4), 0)
  assert.ok(left.x < layout.centerX && right.x > layout.centerX)
  assert.ok(stage.computeLayout(500, 900).isPortrait)
})

test("stage colors are plain rgba strings Qt's canvas accepts", () => {
  assert.equal(stage.hsla(0, 100, 50), "rgba(255, 0, 0, 1)")
  assert.equal(stage.hsla(120, 100, 50, 0.5), "rgba(0, 255, 0, 0.5)")
  assert.match(stage.hsla(265, 65, 7.37, 0.123456), /^rgba\(\d+, \d+, \d+, 0\.123\)$/)
  assert.equal(stage.rgba([1, 2, 3], 2), "rgba(1, 2, 3, 1)")
})

test("hit and miss effects appear and fade", () => {
  const layout = stage.computeLayout(1100, 700)
  const fx = stage.createEffects()
  stage.effectsHit(fx, layout, 2, "Perfect")
  stage.effectsMiss(fx, 3)
  assert.ok(fx.particles.length > 0 && fx.rings.length === 1 && fx.popups.length === 2 && fx.shake > 0)
  stage.updateEffects(fx, 2)
  assert.equal(stage.hasEffects(fx), false)
})

test("modifier-only keydowns are ignored until the non-modifier key arrives", () => {
  const routed = gym.routeKeyEvent(
    { opened: true, chartComplete: false, hasChart: true },
    { key: "SUPER", superHeld: true, shiftHeld: false, ctrlHeld: false, altHeld: false }
  )
  assert.equal(routed.action, "ignore")
})

test("Gym.qml reruns the keybindings command without a bare Process.exec()", () => {
  const qml = fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "run", "Gym.qml"), "utf8")
  assert.doesNotMatch(qml, /\.exec\(\s*\)/, "Process.exec() without a command throws in Quickshell")
  assert.match(qml, /catalogFallbackTimer\.restart\(\)/, "catalog refresh must arm the baked fallback")
})

test("baked fallback catalog is playable when the print command yields nothing", () => {
  const parsed = gym.parseKeybindingsPrint("")
  assert.equal(parsed.playable.length, 0)
  const baked = gym.defaultPlayable()
  assert.ok(baked.length >= 3, "baked catalog must cover stage 1")
  const chart = gym.generateChart(baked, 1)
  assert.ok(chart.notes.length > 0)
  for (const row of baked) assert.equal(gym.dropReason(row.chord), "")
})

test("root and nested manifests describe the same plugin", () => {
  const root = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"))
  const nested = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "manifest.json"), "utf8"))
  for (const field of ["schemaVersion", "id", "name", "version", "author", "license", "description"]) {
    assert.equal(nested[field], root[field], "manifest field " + field + " drifted")
  }
  assert.deepEqual(nested.kinds, root.kinds)
  assert.equal(root.entryPoints.overlay, "plugin/sd.gym/" + nested.entryPoints.overlay)
  assert.ok(fs.existsSync(path.join(__dirname, "..", root.entryPoints.overlay)))
})

const qmlSource = fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "run", "Gym.qml"), "utf8")
const luaSnippet = fs.readFileSync(path.join(__dirname, "..", "extra", "omarchy-gym-submap.lua"), "utf8")
const confSnippet = fs.readFileSync(path.join(__dirname, "..", "extra", "omarchy-gym-submap.conf"), "utf8")

test("F12 in both submap snippets resets the submap without omarchy-shell", () => {
  assert.match(luaSnippet, /hl\.bind\("F12", hl\.dsp\.submap\("reset"\)\)/)
  assert.match(confSnippet, /^bind = , F12, submap, reset$/m)
  assert.match(luaSnippet, /hl\.bind\("SUPER \+ W", hl\.dsp\.exec_cmd\("omarchy-shell shell hide io\.github\.stevederico\.omarchy-gym"\)\)/)
  assert.match(confSnippet, /^bind = SUPER, W, exec, omarchy-shell shell hide io\.github\.stevederico\.omarchy-gym$/m)
})

test("Lua snippet forwards chords to this plugin id, not a private one", () => {
  assert.match(luaSnippet, /omarchy-shell -q shell call io\.github\.stevederico\.omarchy-gym scoreChord/)
  assert.doesNotMatch(luaSnippet, /sd\.gym/)
  assert.match(luaSnippet, /keycode - 8/, "keycodes are XKB, so only the evdev offset lookup is used")
  assert.doesNotMatch(luaSnippet, /or gym_key_names\[keycode\]/, "a raw-code fallback turns bare modifiers into fake chords")
  // No description: described binds would show up in Learn and in Gym's own chart.
  assert.doesNotMatch(luaSnippet, /description/)
})

test("Gym.qml follows window focus for the submap", () => {
  assert.match(qmlSource, /readonly property bool windowActive: Window\.active/)
  assert.match(qmlSource, /onWindowActiveChanged: root\.syncSandbox\(\)/)
  assert.match(qmlSource, /root\.opened && window\.visible && keyCatcher\.windowActive/)
})

test("routeKeyEvent ignores an event with no key", () => {
  const session = { opened: true, chartComplete: false, hasChart: true }
  assert.equal(gym.routeKeyEvent(session, { key: "", superHeld: true }).action, "ignore")
  assert.equal(gym.routeKeyEvent(session, { superHeld: true, shiftHeld: true }).action, "ignore")
})

test("Super+W dismisses from either key path instead of scoring", () => {
  const session = { opened: true, chartComplete: false, hasChart: true }
  assert.equal(gym.routeKeyEvent(session, { key: "W", superHeld: true }).action, "dismiss")
  assert.equal(gym.routeKeyEvent(session, { key: "W", superHeld: true, shiftHeld: true }).action, "score")
})

test("shifted Qt key codes map to the unshifted key name", () => {
  // Qt.Key_* values for printable ASCII are the character code points.
  const qtKeys = {
    Exclam: [0x21, "1"], At: [0x40, "2"], NumberSign: [0x23, "3"], Dollar: [0x24, "4"],
    Percent: [0x25, "5"], AsciiCircum: [0x5e, "6"], Ampersand: [0x26, "7"], Asterisk: [0x2a, "8"],
    ParenLeft: [0x28, "9"], ParenRight: [0x29, "0"], Plus: [0x2b, "EQUAL"], Underscore: [0x5f, "MINUS"],
    Less: [0x3c, "COMMA"], Greater: [0x3e, "PERIOD"], Question: [0x3f, "SLASH"], Colon: [0x3a, "SEMICOLON"],
    QuoteDbl: [0x22, "APOSTROPHE"], BraceLeft: [0x7b, "BRACKETLEFT"], BraceRight: [0x7d, "BRACKETRIGHT"],
    Bar: [0x7c, "BACKSLASH"], AsciiTilde: [0x7e, "GRAVE"], Semicolon: [0x3b, "SEMICOLON"],
    Apostrophe: [0x27, "APOSTROPHE"], Backslash: [0x5c, "BACKSLASH"], QuoteLeft: [0x60, "GRAVE"],
    Comma: [0x2c, "COMMA"], Period: [0x2e, "PERIOD"], Slash: [0x2f, "SLASH"], Minus: [0x2d, "MINUS"], Equal: [0x3d, "EQUAL"]
  }
  for (const [name, [code, expected]] of Object.entries(qtKeys)) {
    assert.equal(gym.keyNameForQtKey(code), expected, "Qt.Key_" + name)
    assert.equal(gym.dropReason("SUPER + " + expected), "", expected + " must be scorable")
  }
  assert.equal(gym.keyNameForQtKey(0x41), "A")
  assert.equal(gym.keyNameForQtKey(0x35), "5")
  assert.equal(gym.keyNameForQtKey(0x01000000), "", "Qt.Key_Escape is not printable")
  assert.equal(gym.symbolKeyName("?"), "SLASH")
  assert.match(qmlSource, /GymLogic\.keyNameForQtKey\(event\.key\)/)
  assert.doesNotMatch(qmlSource, /function symbolKeyName/, "one symbol table, in GymLogic")
})

test("a press reported by both key paths is scored once", () => {
  const last = { chord: "SUPER + SPACE", atMs: 1000 }
  assert.equal(gym.isDuplicatePress(last, "super+space", 1000 + gym.DUPLICATE_PRESS_MS - 1), true)
  assert.equal(gym.isDuplicatePress(last, "SUPER + SPACE", 1000 + gym.DUPLICATE_PRESS_MS), false)
  assert.equal(gym.isDuplicatePress(last, "SUPER + K", 1010), false)
  assert.equal(gym.isDuplicatePress({ chord: "", atMs: 0 }, "SUPER + K", 10), false)
  assert.match(qmlSource, /function scoreRouted\(chord\)/)
  assert.equal((qmlSource.match(/GymLogic\.scorePress\(/g) || []).length, 1, "both paths go through scoreRouted")
})

test("a timed-out keybindings scan is treated as stalled", () => {
  assert.equal(gym.catalogTextForExit(0, "SUPER + K → Keybindings"), "SUPER + K → Keybindings")
  assert.equal(gym.catalogTextForExit(124, "SUPER + K → Keyb"), "")
  assert.equal(gym.catalogTextForExit(127, "partial"), "")
  assert.match(qmlSource, /onExited: function\(exitCode\) \{\s*root\.finishCatalog\(exitCode\)/)
  assert.match(qmlSource, /command: \["timeout", "3", /)
  assert.match(qmlSource, /interval: 4000/)
  assert.match(qmlSource, /3 s timeout\. This backstop fires 1 s later/)
})

test("the keybindings scan starts on open, not at shell start", () => {
  const block = qmlSource.slice(qmlSource.indexOf("id: keybindingsProcess"))
  assert.match(block.slice(0, 600), /running: false/)
  assert.match(qmlSource, /function open\(payloadJson\) \{[\s\S]*?root\.refreshCatalog\(\)/)
})

test("progress IO is bounded, refuses symlinks, and replaces instead of following", () => {
  assert.doesNotMatch(qmlSource, /FileView \{/, "no unbounded, symlink-following FileView")
  const { execFileSync } = require("child_process")
  const os = require("os")
  const cmd = (id) => {
    const block = qmlSource.slice(qmlSource.indexOf("id: " + id))
    const m = block.match(/command: \[("sh", "-c", ".*?")(, "gym-progress")/)
    assert.ok(m, id + " command found")
    return JSON.parse("[" + m[1] + "]")[2]
  }
  const readScript = cmd("progressReader")
  const writeScript = cmd("progressWriter")
  assert.match(readScript, new RegExp("head -c " + (gym.PROGRESS_MAX_BYTES + 1)))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gym-io-"))
  const target = path.join(dir, "target.txt")
  const link = path.join(dir, "gym-progress.json")
  fs.writeFileSync(target, "secret")
  fs.symlinkSync(target, link)
  const run = (script, ...args) => {
    try { return { code: 0, out: execFileSync("sh", ["-c", script, "gym-progress", ...args]).toString() } }
    catch (err) { return { code: err.status, out: String(err.stdout || "") } }
  }
  assert.equal(run(readScript, link).code, 3, "read refuses a symlink")
  assert.equal(run(writeScript, link, '{"stage":2}').code, 0)
  assert.equal(fs.readFileSync(target, "utf8"), "secret", "write did not follow the symlink")
  assert.equal(fs.lstatSync(link).isSymbolicLink(), false)
  assert.equal(run(readScript, link).out, '{"stage":2}')
  fs.writeFileSync(link, "a".repeat(100000))
  const big = run(readScript, link).out
  assert.equal(big.length, gym.PROGRESS_MAX_BYTES + 1, "read stops at the cap")
  assert.equal(gym.parseProgress(big).stage, 1, "oversized progress is ignored")
  fs.mkdirSync(path.join(dir, "adir"))
  assert.equal(run(writeScript, path.join(dir, "adir"), "{}").code, 1, "never writes into a directory")
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.startsWith(".gym-progress.")), [], "no temp files left")
  fs.rmSync(dir, { recursive: true, force: true })
})

test("progress values are sanitized on load", () => {
  const parsed = gym.parseProgress(JSON.stringify({
    stage: 3,
    highScores: { "1": 900, "2": "x", "-1": 5, "__proto__": 1, "99999": 4 },
    bestStars: { "1": 4.7, "2": -1 }
  }))
  assert.equal(parsed.stage, 3)
  assert.deepEqual(parsed.highScores, { "1": 900 })
  assert.deepEqual(parsed.bestStars, { "1": 4 })
  assert.equal(gym.parseProgress(JSON.stringify({ stage: 1e9 })).stage, 1)
})

test("keybinding scan output is capped and cut-off output is rejected", () => {
  assert.match(qmlSource, new RegExp('command: \\["timeout", "3", "sh", "-c", "omarchy menu keybindings --print \\| head -c ' + gym.CATALOG_MAX_BYTES + '"\\]'))
  assert.doesNotMatch(qmlSource, /"omarchy", "menu", "keybindings", "--print"\]/, "no uncapped scan")
  const line = "SUPER + K                           → Keybindings\n"
  const full = line.repeat(Math.ceil(gym.CATALOG_MAX_BYTES / gym.utf8Length(line)))
  const capped = Buffer.from(full).subarray(0, gym.CATALOG_MAX_BYTES).toString()
  assert.equal(gym.catalogTextForExit(0, capped), "", "output at the cap was cut off")
  assert.equal(gym.catalogTextForExit(0, line.repeat(10)), line.repeat(10))
  assert.equal(gym.utf8Length("→"), 3)
  assert.equal(gym.utf8Length("a😀"), 5)
})

test("every Text shows plain text, never rich text", () => {
  const texts = qmlSource.match(/^\s*Text \{\s*$/gm) || []
  const plain = qmlSource.match(/^\s*textFormat: Text\.PlainText\s*$/gm) || []
  assert.ok(texts.length > 0)
  assert.equal(plain.length, texts.length)
  assert.doesNotMatch(qmlSource, /RichText|StyledText|AutoText/)
})

test("IPC chords are length-capped", () => {
  assert.match(qmlSource, /if \(chord\.length > GymLogic\.CHORD_ARG_MAX\) return "ignore"/)
  assert.equal(gym.CHORD_ARG_MAX, 64)
})

test("advanceChart returns the same run when no note timed out", () => {
  const chart = gym.generateChart(gym.defaultPlayable(), 1)
  const run = gym.emptyRun(chart)
  const first = chart.notes[0]
  assert.equal(gym.advanceChart(run, first.hitTimeMs), run)
  assert.equal(gym.advanceChart(run, first.hitTimeMs + gym.WINDOW.good), run)
  const later = gym.advanceChart(run, first.hitTimeMs + gym.WINDOW.good + 1)
  assert.notEqual(later, run)
  assert.equal(later.judgements[0], "Miss")
  assert.equal(run.judgements[0], null, "input run is not mutated")
  assert.equal(gym.advanceChart(later, first.hitTimeMs + gym.WINDOW.good + 2), later)
  assert.match(qmlSource, /if \(next !== root\.run\) root\.applyAdvance\(next\)/)
})

test("bundled keybindings are stock Omarchy, with no personal binds", () => {
  for (const text of [fixture, fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "catalog.json"), "utf8")]) {
    assert.doesNotMatch(text, /Default agent/)
  }
  assert.ok(!gym.BAKED_PLAYABLE.some((row) => row.action === "Default agent"))
  assert.ok(gym.BAKED_PLAYABLE.some((row) => row.chord === "SUPER + SHIFT + A" && row.action === "ChatGPT"))
  const parsed = gym.parseKeybindingsPrint(fixture)
  assert.deepEqual(gym.BAKED_PLAYABLE.map((row) => row.chord), parsed.playable.map((row) => row.chord))
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "catalog.json"), "utf8"))
  assert.equal(catalog.length, parsed.playable.length + 1, "catalog keeps the reserved Super+W row")
})

test("each stage plays a Rockstar Hero song and its notes land on the music", () => {
  assert.equal(gym.SONGS.length, 3)
  assert.deepEqual([1, 2, 3, 4].map((s) => gym.songForStage(s).id), ["neon-backroads", "voltage-parade", "dragon-freeway", "neon-backroads"])
  const playable = gym.defaultPlayable()
  for (let stageNo = 1; stageNo <= gym.maxStage(playable.length); stageNo++) {
    const song = gym.songForStage(stageNo)
    assert.ok(fs.existsSync(path.join(__dirname, "..", "plugin", "sd.gym", song.file)), song.file + " is bundled")
    const chart = gym.generateChart(playable, stageNo)
    const heard = new Set(gym.songCandidateTimes(song))
    assert.equal(chart.songId, song.id)
    assert.ok(chart.notes[0].hitTimeMs >= gym.stageParams(stageNo).firstNoteMs)
    for (const note of chart.notes) {
      assert.ok(heard.has(note.hitTimeMs), `stage ${stageNo} note at ${note.hitTimeMs} ms is on an onset or beat`)
    }
    assert.ok(chart.endMs <= song.durationMs, `stage ${stageNo} ends before ${song.id} does`)
  }
})

test("charts without a song fall back to even spacing", () => {
  const chart = gym.generateChart(gym.defaultPlayable(), 1, null)
  const params = gym.stageParams(1)
  assert.equal(chart.songId, "")
  assert.equal(chart.notes[0].hitTimeMs, params.firstNoteMs)
  assert.equal(chart.notes[1].hitTimeMs - chart.notes[0].hitTimeMs, params.gapMs)
})

test("combo multiplier and stars follow Rockstar Hero", () => {
  assert.equal(gym.comboMultiplier(0), 1)
  assert.equal(gym.comboMultiplier(9), 1)
  assert.equal(gym.comboMultiplier(10), 2)
  assert.equal(gym.comboMultiplier(39), 4)
  assert.equal(gym.comboMultiplier(500), gym.MAX_MULTIPLIER)
  assert.deepEqual(gym.STAR_THRESHOLDS, [0.28, 0.35, 0.39, 0.6, 0.85])
  assert.equal(gym.starsFor(27, 100), 0)
  assert.equal(gym.starsFor(50, 100), 3)
  assert.equal(gym.starsFor(85, 100), 5)
  assert.equal(gym.formatScore(58496), "58,496")
  assert.equal(gym.formatScore(1234567), "1,234,567")
  // The 10th hit in a row already pays x2.
  const chart = gym.generateChart(gym.defaultPlayable(), 1)
  let run = gym.emptyRun(chart)
  for (let i = 0; i < 10; i++) run = gym.scorePress(run, chart.notes[i].hitTimeMs, chart.notes[i].chord).run
  assert.equal(run.score, 9 * 100 + 200)
  assert.equal(run.starPoints, 10 * 100, "stars ignore the multiplier")
})

test("the song clock follows the audio once it drifts", () => {
  assert.equal(gym.resyncOrigin(1000, 5000, 4000 - gym.AUDIO_RESYNC_MS), 1000, "small drift is left alone")
  assert.equal(gym.resyncOrigin(1000, 5000, 3800), 1200)
  assert.equal(gym.resyncOrigin(1000, 5000, 4100), 900)
})

test("music is optional: SongPlayer loads through a Loader", () => {
  assert.match(qmlSource, /Loader \{\s*id: songLoader\s*source: "SongPlayer\.qml"/)
  assert.doesNotMatch(qmlSource, /import QtMultimedia/, "Gym.qml must load without Qt Multimedia")
  const player = fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "run", "SongPlayer.qml"), "utf8")
  assert.match(player, /import QtMultimedia/)
  assert.match(qmlSource, /function syncToAudio\(ms\)/)
})

test("music follows the current default audio output", () => {
  const player = fs.readFileSync(path.join(__dirname, "..", "plugin", "sd.gym", "run", "SongPlayer.qml"), "utf8")
  assert.match(player, /MediaDevices \{ id: devices \}/)
  assert.match(player, /device: devices\.defaultAudioOutput/)
})

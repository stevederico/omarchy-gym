"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")

const repoLogic = path.join(__dirname, "..", "plugin", "sd.gym", "GymLogic.js")
const gym = require(repoLogic)
const fixturePath = path.join(__dirname, "..", "plugin", "sd.gym", "keybindings-print.txt")
const fixture = fs.readFileSync(fixturePath, "utf8")

test("tests require the repo plugin module, not the installed copy", () => {
  assert.equal(require.resolve(repoLogic), path.resolve(repoLogic))
  assert.match(repoLogic, /plugin\/sd\.gym\/GymLogic\.js$/)
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
    assert.equal(typeof note.lane, "number")
    assert.ok(note.lane >= 0 && note.lane < gym.LANE_COUNT)
  }
  const lanes = new Set(chart.notes.map((note) => note.lane))
  assert.ok(lanes.size >= 2, "stage-1 must use more than one of the four streams")
  for (const lane of lanes) {
    assert.ok(lane <= 2, "stage-1 first 3 catalog rows map to lanes 0-2")
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

test("hit is judged against the receptor line: Marvelous on the line, Perfect slightly off, late is Miss", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const note = chart.notes[0]

  const onLine = gym.scorePress(gym.emptyRun(chart), note.hitTimeMs, note.chord)
  assert.equal(onLine.result, "Marvelous")
  assert.equal(onLine.timing, "HIT")
  assert.equal(onLine.deltaMs, 0)
  assert.equal(onLine.run.judgements[0], "Marvelous")
  assert.equal(onLine.run.combo, 1)
  assert.ok(onLine.run.score > 0)
  assert.equal(gym.formatScore(onLine.run.score).length, 7)

  const early = gym.scorePress(
    gym.emptyRun(chart),
    note.hitTimeMs - (gym.WINDOW.marvelous + 8),
    note.chord
  )
  assert.equal(early.result, "Perfect")
  assert.equal(early.timing, "EARLY")
  assert.ok(early.deltaMs < 0)

  const late = gym.scorePress(
    gym.emptyRun(chart),
    note.hitTimeMs + (gym.WINDOW.marvelous + 8),
    note.chord
  )
  assert.equal(late.result, "Perfect")
  assert.equal(late.timing, "LATE")
  assert.ok(late.deltaMs > 0)

  const lateRun = gym.advanceChart(
    gym.emptyRun(chart),
    note.hitTimeMs + gym.WINDOW.good + 1
  )
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
  assert.equal(result.result, "Marvelous")
  assert.equal(result.run.combo, 1)
  assert.equal(result.run.judgements[0], "Marvelous")
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

test("next stage unlocks only after a passing grade", () => {
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 1)
  const failRun = gym.emptyRun(chart)
  const missed = gym.advanceChart(failRun, chart.notes[chart.notes.length - 1].hitTimeMs + gym.WINDOW.good + 50)
  assert.equal(gym.gradeForRun(missed), "F")
  assert.equal(gym.isPassingGrade("F"), false)
  let progress = gym.applyChartResult(gym.emptyProgress(), missed)
  assert.equal(progress.stage, 1)
  assert.equal(progress.highestStageCleared, 0)

  let passRun = gym.emptyRun(chart)
  for (const note of chart.notes) {
    const scored = gym.scorePress(passRun, note.hitTimeMs, note.chord)
    assert.equal(scored.result, "Marvelous")
    passRun = scored.run
  }
  assert.equal(gym.gradeForRun(passRun), "S")
  assert.equal(gym.isPassingGrade("S"), true)
  progress = gym.applyChartResult(gym.emptyProgress(), passRun)
  assert.equal(progress.stage, 2)
  assert.equal(progress.highestStageCleared, 1)
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

test("four DDR streams: catalog index maps onto lanes 0-3", () => {
  assert.equal(gym.LANE_COUNT, 4)
  assert.equal(gym.laneForIndex(0), 0)
  assert.equal(gym.laneForIndex(1), 1)
  assert.equal(gym.laneForIndex(2), 2)
  assert.equal(gym.laneForIndex(3), 3)
  assert.equal(gym.laneForIndex(4), 0)
  const playable = gym.parseKeybindingsPrint(fixture).playable
  const chart = gym.generateChart(playable, 4)
  for (const note of chart.notes) {
    assert.ok(note.lane >= 0 && note.lane < 4)
  }
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

test("notes fall down: y increases as nowMs approaches the hit line", () => {
  const note = { hitTimeMs: 2000 }
  const spawnY = 0
  const hitY = 800
  const scrollMs = 2000
  const yEarly = gym.noteY(note, 0, spawnY, hitY, scrollMs)
  const yMid = gym.noteY(note, 1000, spawnY, hitY, scrollMs)
  const yHit = gym.noteY(note, 2000, spawnY, hitY, scrollMs)
  const yLate = gym.noteY(note, 2500, spawnY, hitY, scrollMs)
  assert.ok(yEarly < yMid)
  assert.ok(yMid < yHit)
  assert.ok(yLate > yHit)
  assert.equal(yHit, hitY)
})

test("modifier-only keydowns are ignored until the non-modifier key arrives", () => {
  const routed = gym.routeKeyEvent(
    { opened: true, chartComplete: false, hasChart: true },
    { key: "SUPER", superHeld: true, shiftHeld: false, ctrlHeld: false, altHeld: false }
  )
  assert.equal(routed.action, "ignore")
})

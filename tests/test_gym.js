"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const gym = require(path.join(
  process.env.HOME,
  ".config/omarchy/plugins/sd.gym",
  "GymLogic.js"
))

test("matching chord scores a hit; a different chord scores a miss", () => {
  const exercise = { id: "launch.terminal", prompt: "Open a terminal", chord: "SUPER + RETURN" }
  const hit = gym.scoreAttempt(exercise, "super+enter")
  const miss = gym.scoreAttempt(exercise, "SUPER + K")

  assert.equal(hit.hit, true)
  assert.equal(hit.expected, "SUPER + RETURN")
  assert.equal(miss.hit, false)
  assert.equal(miss.pressed, "SUPER + K")
  assert.notEqual(miss.pressed, miss.expected)
})

test("new learner gets a beginner workout smaller than the full catalog", () => {
  const catalog = gym.fullCatalog()
  const workout = gym.assembleWorkout(gym.emptyProgress(), catalog)

  assert.ok(Array.isArray(catalog) && catalog.length > 0, "catalog must not be empty")
  assert.ok(Array.isArray(workout.exercises), "workout must list exercises")
  assert.equal(workout.lesson, "launch")
  assert.ok(
    workout.exercises.length < catalog.length,
    `beginner workout (${workout.exercises.length}) must be smaller than catalog (${catalog.length})`
  )
  for (const exercise of workout.exercises) {
    assert.equal(exercise.lesson, "launch")
  }
})

test("bare Escape dismisses even when the workout is complete or awaiting advance", () => {
  const escape = { key: "ESCAPE", superHeld: false, shiftHeld: false, ctrlHeld: false, altHeld: false }
  const complete = gym.routeKeyEvent(
    { opened: true, workoutComplete: true, awaitingAdvance: false, hasExercise: false },
    escape
  )
  const waiting = gym.routeKeyEvent(
    { opened: true, workoutComplete: false, awaitingAdvance: true, hasExercise: true },
    escape
  )
  const active = gym.routeKeyEvent(
    { opened: true, workoutComplete: false, awaitingAdvance: false, hasExercise: true },
    escape
  )

  assert.equal(complete.action, "dismiss")
  assert.equal(waiting.action, "dismiss")
  assert.equal(active.action, "dismiss")
})

test("Super+Escape is scored, not treated as leave", () => {
  const routed = gym.routeKeyEvent(
    { opened: true, workoutComplete: false, awaitingAdvance: false, hasExercise: true },
    { key: "ESCAPE", superHeld: true, shiftHeld: false, ctrlHeld: false, altHeld: false }
  )
  assert.equal(routed.action, "score")
  assert.equal(routed.chord, "SUPER + ESCAPE")
})

test("sandbox submap args inhibit Hyprland instead of dispatching the chord", () => {
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
  assert.notDeepEqual(enter, ["hyprctl", "dispatch", "submap", gym.GYM_SUBMAP])
})

test("mastering beginner exercises unlocks a later workout that is still not the full catalog", () => {
  const catalog = gym.fullCatalog()
  const beginner = gym.assembleWorkout(gym.emptyProgress(), catalog)
  const beginnerIds = new Set(beginner.exercises.map((exercise) => exercise.id))

  let progress = gym.emptyProgress()
  for (const exercise of beginner.exercises) {
    for (let i = 0; i < gym.MASTERY_STREAK; i++) {
      const scored = gym.scoreAttempt(exercise, exercise.chord)
      assert.equal(scored.hit, true)
      progress = gym.applyAttempt(progress, exercise.id, scored.hit)
    }
    assert.equal(gym.isMastered(progress, exercise.id), true)
  }

  progress = gym.finishWorkout(progress, beginner)
  const next = gym.assembleWorkout(progress, catalog)
  const nextIds = next.exercises.map((exercise) => exercise.id)
  const unlockedNew = nextIds.some((id) => !beginnerIds.has(id))

  assert.ok(next.exercises.length > 0, "next workout must include exercises")
  assert.ok(unlockedNew, "next workout must include a previously locked exercise")
  assert.ok(
    next.exercises.length < catalog.length,
    `unlocked workout (${next.exercises.length}) must still omit the full catalog (${catalog.length})`
  )
  assert.notEqual(next.lesson, beginner.lesson)
})

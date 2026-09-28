// Stage renderer for run/Gym.qml: a port of Rockstar Hero's Canvas 2D stage
// (sky, light beams, crowd, perspective highway, gems, pads, and hit effects)
// to the QML Context2D API. Node tests require the same file for the math.
//
// QML Context2D differences from the browser canvas:
// - ellipse(x, y, w, h) takes a bounding box, not a center and radii
// - colors are passed as rgba()/hsla() strings with commas

// How strongly the highway narrows with distance.
var PERSPECTIVE = 2.4
// Depth of the far end of the highway. The strike line is depth 0.
var FAR_DEPTH = 1
// Notes past the strike line are drawn down to this depth, then dropped.
var NEAR_DEPTH = -0.22
var LANES = 5

var PORTRAIT = { halfWidth: 0.47, strikeY: 0.8, vanishY: 0.1 }
var LANDSCAPE = { halfWidth: 0.3, maxHalfWidthOfHeight: 0.5, strikeY: 0.84, vanishY: 0.06 }

var LANE_COLORS = [[47, 224, 255], [255, 79, 154], [255, 211, 56], [109, 255, 122], [180, 123, 255]]
var DEAD_NOTE = [90, 86, 112]
var MISS_COLOR = [255, 84, 104]
var GRADE_COLORS = { Perfect: [255, 247, 176], Great: [141, 255, 180], Good: [143, 212, 255] }

var NOTE_RADIUS = 0.41
var NOTE_SQUASH = 0.45
var NOTE_THICKNESS = 0.4
var PAD_RADIUS = 0.4
var PAD_SQUASH = 0.42
var FADE_IN_RATE = 6
var BEAM_COUNT = 6
var SPECK_COUNT = 60
var CROWD_ROWS = 3
var HEADS_PER_ROW = 26
var GRAVITY = 900
var MAX_PARTICLES = 260
var SPARKS = { Perfect: 14, Great: 9, Good: 6 }
var POPUP_SECONDS = 0.55
var RING_SECONDS = 0.3
var PRESS_GLOW_MS = 180
var SHAKE_PIXELS = 7
var FULL_TURN = Math.PI * 2

function rgba(c, a) {
  var alpha = a === undefined ? 1 : Math.max(0, Math.min(1, Number(a) || 0))
  return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + Math.round(alpha * 1000) / 1000 + ")"
}

// Qt's canvas color parser rejects fractional hsla(), so convert to rgba().
function hsla(h, s, l, a) {
  var hue = ((Number(h) % 360) + 360) % 360 / 360
  var sat = Math.max(0, Math.min(1, s / 100))
  var light = Math.max(0, Math.min(1, l / 100))
  var q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  var p = 2 * light - q
  function channel(t) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return rgba([
    Math.round(channel(hue + 1 / 3) * 255),
    Math.round(channel(hue) * 255),
    Math.round(channel(hue - 1 / 3) * 255)
  ], a)
}

function laneColor(lane) {
  return LANE_COLORS[lane] || [255, 255, 255]
}

// Where the highway sits on screen, in pixels.
function computeLayout(width, height) {
  var isPortrait = height > width
  var shape = isPortrait ? PORTRAIT : LANDSCAPE
  var halfWidth = isPortrait
    ? width * PORTRAIT.halfWidth
    : Math.min(width * LANDSCAPE.halfWidth, height * LANDSCAPE.maxHalfWidthOfHeight)
  return {
    width: width,
    height: height,
    centerX: width / 2,
    strikeY: height * shape.strikeY,
    vanishY: height * shape.vanishY,
    halfWidth: halfWidth,
    isPortrait: isPortrait
  }
}

// Size of things at a depth, relative to their size on the strike line.
function depthScale(depth) {
  return 1 / (1 + PERSPECTIVE * Math.max(depth, NEAR_DEPTH))
}

// Depth of a note: 0 on the strike line, 1 when it first appears.
function noteDepth(noteMs, nowMs, lookaheadMs) {
  return (noteMs - nowMs) / lookaheadMs
}

// Highway position from -1 (left edge) to 1 (right edge) of a lane center.
function laneCenter(lane) {
  return ((lane + 0.5) / LANES) * 2 - 1
}

function laneEdge(lane) {
  return (lane / LANES) * 2 - 1
}

function project(layout, across, depth) {
  var scale = depthScale(depth)
  return {
    x: layout.centerX + across * layout.halfWidth * scale,
    y: layout.vanishY + (layout.strikeY - layout.vanishY) * scale
  }
}

function laneWidth(layout) {
  return (layout.halfWidth * 2) / LANES
}

// Brightness kick on each beat: 1 on the beat, fading to 0 before the next.
function beatPulse(nowMs, bpm) {
  if (nowMs < 0 || !(bpm > 0)) return 0
  var beat = nowMs / (60000 / bpm)
  var phase = beat - Math.floor(beat)
  return (1 - phase) * (1 - phase)
}

// Cheap repeatable noise from an index, 0 to 1.
function hash(index) {
  var value = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function ellipse(g, x, y, rx, ry) {
  g.beginPath()
  g.ellipse(x - rx, y - ry, rx * 2, ry * 2)
}

function tracePath(g, layout, corners) {
  g.beginPath()
  var i
  for (i = 0; i < corners.length; i++) {
    var p = project(layout, corners[i][0], corners[i][1])
    if (i === 0) g.moveTo(p.x, p.y)
    else g.lineTo(p.x, p.y)
  }
  g.closePath()
}

// A soft round glow, added on top of what is there.
function drawGlow(g, color, x, y, radius, alpha) {
  if (!(alpha > 0) || !(radius > 0)) return
  g.save()
  g.globalCompositeOperation = "lighter"
  g.globalAlpha = Math.min(1, alpha * 0.9)
  var gradient = g.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)")
  gradient.addColorStop(0.25, typeof color === "string" ? color : rgba(color, 1))
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
  g.fillStyle = gradient
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  g.restore()
}

function drawSky(g, layout, hue, pulse) {
  var sky = g.createLinearGradient(0, 0, 0, layout.height)
  sky.addColorStop(0, hsla(hue, 65, 5 + pulse * 2))
  sky.addColorStop(0.45, hsla(hue, 70, 11 + pulse * 5))
  sky.addColorStop(1, hsla(260, 60, 3))
  g.fillStyle = sky
  g.fillRect(0, 0, layout.width, layout.height)
}

function drawSpecks(g, layout, seconds) {
  g.fillStyle = "rgba(255, 255, 255, 1)"
  var i
  for (i = 0; i < SPECK_COUNT; i++) {
    var drift = seconds * (4 + hash(i + 200) * 8)
    var x = (hash(i) * layout.width + drift) % layout.width
    var y = hash(i + 100) * layout.height * 0.55
    var twinkle = 0.5 + 0.5 * Math.sin(seconds * 2 + i)
    g.globalAlpha = 0.15 + 0.35 * twinkle * hash(i + 300)
    g.fillRect(x, y, 2, 2)
  }
  g.globalAlpha = 1
}

function drawBeams(g, layout, seconds, hues, pulse) {
  g.save()
  g.globalCompositeOperation = "lighter"
  var reach = layout.height * 0.9
  var i
  for (i = 0; i < BEAM_COUNT; i++) {
    var originX = (layout.width * (i + 0.5)) / BEAM_COUNT
    var sway = Math.sin(seconds * 0.7 + i * 1.9) * 0.35
    var angle = (i - (BEAM_COUNT - 1) / 2) * 0.12 + sway
    var spread = layout.width * 0.07
    var endX = originX + Math.sin(angle) * reach
    var beam = g.createLinearGradient(originX, 0, endX, reach)
    var hue = hues[i % hues.length]
    beam.addColorStop(0, hsla(hue, 100, 65, 0.2 + pulse * 0.16))
    beam.addColorStop(1, hsla(hue, 100, 60, 0))
    g.fillStyle = beam
    g.beginPath()
    g.moveTo(originX - 4, -10)
    g.lineTo(originX + 4, -10)
    g.lineTo(endX + spread, reach)
    g.lineTo(endX - spread, reach)
    g.closePath()
    g.fill()
  }
  g.restore()
}

// Rows of bobbing heads along the horizon. They jump higher as the combo grows.
function drawCrowd(g, layout, pulse, mood) {
  var horizon = project(layout, 0, FAR_DEPTH).y
  var row
  for (row = 0; row < CROWD_ROWS; row++) {
    var size = layout.width / HEADS_PER_ROW / (1.5 - row * 0.2)
    var baseY = horizon + row * size * 0.5
    g.fillStyle = hsla(260, 40, 4 + row * 2.5)
    var i
    for (i = -1; i <= HEADS_PER_ROW * 1.6; i++) {
      var x = (i + hash(i + row * 50) * 0.6) * size * 1.25
      var jump = pulse * mood * size * (0.3 + hash(i * 3 + row) * 0.7)
      g.beginPath()
      g.arc(x, baseY - jump, size * 0.55, 0, FULL_TURN, false)
      g.fill()
    }
    g.fillRect(0, baseY, layout.width, layout.height - baseY)
  }
}

function drawBackground(g, layout, frame, pulse) {
  var seconds = frame.nowMs / 1000
  drawSky(g, layout, frame.hue, pulse)
  drawSpecks(g, layout, seconds)
  drawBeams(g, layout, seconds, [frame.hue, frame.hueAlt], pulse)
  var horizon = project(layout, 0, FAR_DEPTH)
  drawGlow(g, hsla(frame.hueAlt, 100, 60), horizon.x, horizon.y, layout.halfWidth * (1.1 + pulse * 0.2), 0.5)
  drawCrowd(g, layout, pulse, frame.mood)
}

function drawSurface(g, layout) {
  var top = project(layout, 0, FAR_DEPTH).y
  var surface = g.createLinearGradient(0, top, 0, layout.height)
  surface.addColorStop(0, hsla(258, 45, 9, 0.35))
  surface.addColorStop(0.3, hsla(258, 45, 9, 0.9))
  surface.addColorStop(1, hsla(258, 45, 9, 0.97))
  g.fillStyle = surface
  tracePath(g, layout, [[-1, FAR_DEPTH], [1, FAR_DEPTH], [1, NEAR_DEPTH], [-1, NEAR_DEPTH]])
  g.fill()
}

function drawPressedLane(g, layout, frame) {
  var lane = frame.pressLane
  if (lane < 0 || frame.pressAgeMs > PRESS_GLOW_MS) return
  var fade = 1 - frame.pressAgeMs / PRESS_GLOW_MS
  var top = project(layout, 0, 0.6).y
  var glow = g.createLinearGradient(0, layout.strikeY, 0, top)
  glow.addColorStop(0, rgba(laneColor(lane), 0.4 * fade))
  glow.addColorStop(1, rgba(laneColor(lane), 0))
  g.fillStyle = glow
  tracePath(g, layout, [[laneEdge(lane), 0.6], [laneEdge(lane + 1), 0.6], [laneEdge(lane + 1), 0], [laneEdge(lane), 0]])
  g.fill()
}

function drawBeatLines(g, layout, frame) {
  var beat = 60000 / (frame.bpm || 120)
  var first = Math.max(0, Math.ceil(frame.nowMs / beat))
  var last = Math.floor((frame.nowMs + frame.lookaheadMs) / beat)
  var index
  for (index = first; index <= last; index++) {
    var depth = noteDepth(index * beat, frame.nowMs, frame.lookaheadMs)
    var isBar = index % 4 === 0
    var left = project(layout, -1, depth)
    var right = project(layout, 1, depth)
    var fade = Math.min(1, (FAR_DEPTH - depth) * 5)
    g.strokeStyle = rgba([255, 255, 255], (isBar ? 0.4 : 0.14) * fade)
    g.lineWidth = (isBar ? 3 : 1.5) * depthScale(depth)
    g.beginPath()
    g.moveTo(left.x, left.y)
    g.lineTo(right.x, right.y)
    g.stroke()
  }
}

function drawLaneLines(g, layout, frame) {
  var lane
  for (lane = 0; lane <= LANES; lane++) {
    var isRail = lane === 0 || lane === LANES
    var far = project(layout, laneEdge(lane), FAR_DEPTH)
    var near = project(layout, laneEdge(lane), NEAR_DEPTH)
    g.strokeStyle = isRail ? hsla(frame.hue, 100, 70) : "rgba(255, 255, 255, 0.13)"
    g.lineWidth = isRail ? 3 : 1
    g.beginPath()
    g.moveTo(far.x, far.y)
    g.lineTo(near.x, near.y)
    g.stroke()
  }
}

function drawHighway(g, layout, frame) {
  drawSurface(g, layout)
  drawPressedLane(g, layout, frame)
  drawBeatLines(g, layout, frame)
  drawLaneLines(g, layout, frame)
  var left = project(layout, -1, 0)
  var right = project(layout, 1, 0)
  g.strokeStyle = "rgba(255, 255, 255, 0.55)"
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(left.x, left.y)
  g.lineTo(right.x, right.y)
  g.stroke()
}

function fitFont(g, text, maxWidth, size, family) {
  var s = size
  g.font = "bold " + Math.round(s) + "px \"" + family + "\""
  while (s > 7 && g.measureText(text).width > maxWidth) {
    s -= 1
    g.font = "bold " + Math.round(s) + "px \"" + family + "\""
  }
  return s
}

function drawPad(g, layout, frame, lane) {
  var center = project(layout, laneCenter(lane), 0)
  var isDown = frame.pressLane === lane && frame.pressAgeMs <= PRESS_GLOW_MS
  var radius = laneWidth(layout) * PAD_RADIUS * (isDown ? 0.92 : 1)
  var color = laneColor(lane)
  if (isDown) drawGlow(g, color, center.x, center.y, radius * 2.2, 0.7)
  ellipse(g, center.x, center.y, radius, radius * PAD_SQUASH)
  g.fillStyle = isDown ? rgba(color, 1) : "rgba(8, 6, 18, 0.85)"
  g.fill()
  g.lineWidth = Math.max(2.5, radius * 0.12)
  g.strokeStyle = rgba(color, 1)
  g.stroke()
  ellipse(g, center.x, center.y, radius * 0.55, radius * 0.55 * PAD_SQUASH)
  g.strokeStyle = isDown ? "rgba(255, 255, 255, 0.9)" : rgba(color, 0.53)
  g.lineWidth = 1.5
  g.stroke()
  // Lane label under the pad: the modifiers this lane stands for.
  var words = String(frame.laneLabels[lane] || "").split(" ")
  g.fillStyle = rgba(color, 0.95)
  g.textAlign = "center"
  g.textBaseline = "top"
  var size = fitFont(g, words.join(" "), laneWidth(layout) * 0.95, Math.max(9, radius * 0.3), frame.fontFamily)
  var w
  for (w = 0; w < words.length; w++) {
    g.fillText(words[w], center.x, center.y + radius * PAD_SQUASH + 4 + w * (size + 2))
  }
}

function drawHead(g, layout, frame, note, depth, color, alpha, isCurrent) {
  var center = project(layout, laneCenter(note.lane), depth)
  var rx = laneWidth(layout) * NOTE_RADIUS * depthScale(depth)
  var ry = rx * NOTE_SQUASH
  var top = center.y - ry * NOTE_THICKNESS
  if (isCurrent) drawGlow(g, color, center.x, top, rx * 1.9, 0.45 * alpha)
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = rgba(color, 1)
  ellipse(g, center.x, center.y, rx, ry)
  g.fill()
  g.fillStyle = "rgba(0, 0, 0, 0.5)"
  g.fill()
  g.fillStyle = rgba(color, 1)
  ellipse(g, center.x, top, rx, ry)
  g.fill()
  g.lineWidth = Math.max(1, rx * 0.09)
  g.strokeStyle = "rgba(255, 255, 255, 0.95)"
  g.stroke()
  g.fillStyle = "rgba(10, 8, 24, 0.75)"
  ellipse(g, center.x, top, rx * 0.72, ry * 0.72)
  g.fill()
  // The key to press, on the gem.
  if (rx > 9 && note.glyph) {
    g.fillStyle = "rgba(255, 255, 255, 1)"
    g.textAlign = "center"
    g.textBaseline = "middle"
    fitFont(g, note.glyph, rx * 1.35, rx * 0.62, frame.fontFamily)
    g.fillText(note.glyph, center.x, top + 1)
  }
  g.restore()
}

// Every note on the highway, far ones first so near ones overlap them.
function drawNotes(g, layout, frame) {
  var notes = frame.notes
  var i
  for (i = notes.length - 1; i >= 0; i--) {
    var note = notes[i]
    var judged = frame.judgements[i]
    if (judged && judged !== "Miss") continue
    var depth = noteDepth(note.hitTimeMs, frame.nowMs, frame.lookaheadMs)
    if (depth > FAR_DEPTH || depth < NEAR_DEPTH) continue
    var color = judged === "Miss" ? DEAD_NOTE : laneColor(note.lane)
    var alpha = Math.min(1, (FAR_DEPTH - depth) * FADE_IN_RATE)
    drawHead(g, layout, frame, note, depth, color, alpha, i === frame.currentIndex)
  }
}

// Short lived eye candy: sparks, rings and grade popups.
function createEffects() {
  return { particles: [], popups: [], rings: [], shake: 0 }
}

function clearEffects(fx) {
  fx.particles = []
  fx.popups = []
  fx.rings = []
  fx.shake = 0
}

function addPopup(fx, lane, text, color) {
  fx.popups = fx.popups.filter(function (p) { return p.lane !== lane })
  fx.popups.push({ text: text, color: color, lane: lane, age: 0 })
}

function effectsHit(fx, layout, lane, grade) {
  var color = laneColor(lane)
  fx.rings.push({ lane: lane, color: color, age: 0 })
  addPopup(fx, lane, String(grade).toUpperCase(), GRADE_COLORS[grade] || [255, 255, 255])
  var origin = project(layout, laneCenter(lane), 0)
  var reach = laneWidth(layout)
  var count = SPARKS[grade] || 6
  var i
  for (i = 0; i < count && fx.particles.length < MAX_PARTICLES; i++) {
    var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9
    var speed = reach * (2.5 + Math.random() * 4.5)
    fx.particles.push({
      x: origin.x + (Math.random() - 0.5) * reach * 0.5,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.3 + Math.random() * 0.35,
      size: reach * (0.03 + Math.random() * 0.05),
      color: Math.random() < 0.3 ? [255, 255, 255] : color
    })
  }
}

function effectsMiss(fx, lane) {
  addPopup(fx, lane, "MISS", MISS_COLOR)
  fx.shake = Math.min(1, fx.shake + 0.5)
}

function updateEffects(fx, seconds) {
  var i
  for (i = 0; i < fx.particles.length; i++) {
    var p = fx.particles[i]
    p.age += seconds
    p.vy += GRAVITY * seconds
    p.x += p.vx * seconds
    p.y += p.vy * seconds
  }
  for (i = 0; i < fx.popups.length; i++) fx.popups[i].age += seconds
  for (i = 0; i < fx.rings.length; i++) fx.rings[i].age += seconds
  fx.particles = fx.particles.filter(function (p) { return p.age < p.life })
  fx.popups = fx.popups.filter(function (p) { return p.age < POPUP_SECONDS })
  fx.rings = fx.rings.filter(function (r) { return r.age < RING_SECONDS })
  fx.shake = Math.max(0, fx.shake - seconds * 5)
}

function hasEffects(fx) {
  return fx.particles.length > 0 || fx.popups.length > 0 || fx.rings.length > 0 || fx.shake > 0
}

function drawEffects(g, layout, fx, family) {
  var i
  for (i = 0; i < fx.rings.length; i++) {
    var ring = fx.rings[i]
    var progress = ring.age / RING_SECONDS
    var center = project(layout, laneCenter(ring.lane), 0)
    var radius = laneWidth(layout) * (0.4 + progress * 0.55)
    drawGlow(g, ring.color, center.x, center.y, radius * 2.4, (1 - progress) * 0.9)
    g.strokeStyle = rgba(ring.color, 1)
    g.globalAlpha = 1 - progress
    g.lineWidth = 3
    ellipse(g, center.x, center.y, radius, radius * 0.42)
    g.stroke()
  }
  g.globalAlpha = 1
  g.save()
  g.globalCompositeOperation = "lighter"
  for (i = 0; i < fx.particles.length; i++) {
    var p = fx.particles[i]
    g.globalAlpha = 1 - p.age / p.life
    g.fillStyle = rgba(p.color, 1)
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  g.restore()
  var size = Math.max(11, laneWidth(layout) * 0.16)
  g.font = "bold " + Math.round(size) + "px \"" + family + "\""
  g.textAlign = "center"
  g.textBaseline = "middle"
  for (i = 0; i < fx.popups.length; i++) {
    var popup = fx.popups[i]
    var t = popup.age / POPUP_SECONDS
    var base = project(layout, laneCenter(popup.lane), 0.09)
    var y = base.y - t * size * 2.2
    g.globalAlpha = 1 - t * t
    g.lineWidth = 4
    g.strokeStyle = "rgba(5, 3, 12, 0.8)"
    g.strokeText(popup.text, base.x, y)
    g.fillStyle = rgba(popup.color, 1)
    g.fillText(popup.text, base.x, y)
  }
  g.globalAlpha = 1
}

// Draw one frame. `frame` carries the song clock, chart, and press state;
// `fx` is the effects state from createEffects().
function drawFrame(g, layout, frame, fx) {
  var pulse = beatPulse(frame.nowMs, frame.bpm)
  g.save()
  g.globalCompositeOperation = "source-over"
  g.globalAlpha = 1
  drawBackground(g, layout, frame, pulse)
  if (fx.shake > 0) {
    var reach = fx.shake * SHAKE_PIXELS
    g.translate((Math.random() - 0.5) * reach, (Math.random() - 0.5) * reach)
  }
  drawHighway(g, layout, frame)
  var lane
  for (lane = 0; lane < LANES; lane++) drawPad(g, layout, frame, lane)
  drawNotes(g, layout, frame)
  drawEffects(g, layout, fx, frame.fontFamily)
  g.restore()
}

if (typeof module !== "undefined") {
  module.exports = {
    PERSPECTIVE: PERSPECTIVE,
    FAR_DEPTH: FAR_DEPTH,
    NEAR_DEPTH: NEAR_DEPTH,
    LANES: LANES,
    LANE_COLORS: LANE_COLORS,
    computeLayout: computeLayout,
    depthScale: depthScale,
    noteDepth: noteDepth,
    laneCenter: laneCenter,
    project: project,
    laneWidth: laneWidth,
    beatPulse: beatPulse,
    rgba: rgba,
    hsla: hsla,
    createEffects: createEffects,
    clearEffects: clearEffects,
    effectsHit: effectsHit,
    effectsMiss: effectsMiss,
    updateEffects: updateEffects,
    hasEffects: hasEffects,
    drawFrame: drawFrame
  }
}

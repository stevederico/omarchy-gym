import Quickshell
import Quickshell.Io
import QtQuick
import qs.Commons
import qs.Ui
import "GymLogic.js" as GymLogic
import "Stage.js" as Stage

Item {
  id: root

  property var shell: null
  property var manifest: null

  property bool opened: false
  property bool closingFromHost: false
  property var progress: ({})
  property var playable: []
  property var chart: ({})
  property var run: ({})
  property var song: null
  property var stageNotes: []
  property bool chartComplete: false
  property bool passedStage: false
  property int playedStage: 1
  property int resultStars: 0
  property bool catalogLoaded: false
  property string catalogText: ""
  property var lastPress: ({ chord: "", atMs: 0 })
  property bool pendingChartStart: false
  property string catalogSource: "baked fallback"
  property string lastJudgement: ""
  property real nowMs: 0
  property real startEpoch: 0
  property real lastTickAt: 0
  property int pressLane: -1
  property real pressAt: 0
  // Sparks, rings, and popups. Mutated in place by Stage.js each frame.
  property var fx: Stage.createEffects()

  readonly property string fontFamily: Style.font.menuFamily
  readonly property color textColor: "#f4f1ff"
  readonly property color dimTextColor: "#a9a3c4"
  readonly property color starColor: "#ffd338"
  readonly property color stageColor: "#07050f"
  readonly property var laneColors: ["#2fe0ff", "#ff4f9a", "#ffd338", "#6dff7a", "#b47bff"]

  property string progressPath: Quickshell.env("HOME") + "/.local/state/omarchy/gym-progress.json"

  readonly property int stageNumber: Number(root.chart && root.chart.stage) || 1
  readonly property int combo: Number(root.run && root.run.combo) || 0
  readonly property int maxCombo: Number(root.run && root.run.maxCombo) || 0
  readonly property int score: Number(root.run && root.run.score) || 0
  readonly property int multiplier: GymLogic.comboMultiplier(root.combo)
  readonly property int liveStars: GymLogic.starsForRun(root.run)
  readonly property int maximumStage: GymLogic.maxStage(root.playable.length)
  readonly property bool hasNextStage: root.playedStage < root.maximumStage
  readonly property var counts: (root.run && root.run.counts) ? root.run.counts : ({})
  readonly property int currentNoteIndex: GymLogic.firstUnscoredIndex(root.run)
  readonly property var currentNote: {
    if (root.chartComplete) return null
    var notes = root.chart && root.chart.notes ? root.chart.notes : []
    return notes[root.currentNoteIndex] || null
  }
  readonly property string currentAction: root.currentNote ? String(root.currentNote.action || "") : ""
  readonly property string currentChord: root.currentNote ? GymLogic.normalizeChord(root.currentNote.chord) : ""
  readonly property color currentColor: root.currentNote ? root.laneColors[root.currentNote.lane] : root.textColor

  // The Hyprland submap is global, so Gym holds it only while its window has
  // keyboard focus and releases it as soon as focus moves elsewhere.
  property bool sandboxed: false

  function enterSandbox() {
    if (root.sandboxed) return
    root.sandboxed = true
    // QML array (not a .js return value) so Quickshell.execDetached actually runs.
    Quickshell.execDetached(["hyprctl", "dispatch", GymLogic.sandboxEnterDispatch()])
  }

  function leaveSandbox() {
    if (!root.sandboxed) return
    root.sandboxed = false
    Quickshell.execDetached(["hyprctl", "dispatch", GymLogic.sandboxLeaveDispatch()])
  }

  function syncSandbox() {
    if (root.opened && window.visible && keyCatcher.windowActive) root.enterSandbox()
    else root.leaveSandbox()
  }

  function open(payloadJson) {
    root.closingFromHost = false
    root.opened = true
    root.lastJudgement = ""
    root.chartComplete = false
    window.visible = true
    root.syncSandbox()
    root.refreshCatalog()
    root.startChart()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.closingFromHost = true
    tickTimer.stop()
    root.stopSong()
    root.opened = false
    root.leaveSandbox()
    window.visible = false
    root.closingFromHost = false
  }

  function dismiss() {
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "io.github.stevederico.omarchy-gym")
    else
      root.close()
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function retry() {
    root.startChartAt(root.playedStage || 1)
  }

  function nextLevel() {
    if (!root.hasNextStage) return
    root.startChartAt((root.playedStage || 1) + 1)
  }

  function startChart() {
    if (!root.catalogLoaded) {
      root.pendingChartStart = true
      return
    }
    if (!root.progress || typeof root.progress !== "object" || Array.isArray(root.progress))
      root.progress = GymLogic.emptyProgress()
    var stage = Number(root.progress.stage) || 1
    root.pendingChartStart = false
    root.startChartAt(stage)
  }

  function startChartAt(stage) {
    if (!root.catalogLoaded) {
      root.pendingChartStart = true
      return
    }
    if (!root.progress || typeof root.progress !== "object" || Array.isArray(root.progress))
      root.progress = GymLogic.emptyProgress()
    if (!root.playable || root.playable.length === 0)
      root.playable = GymLogic.defaultPlayable()
    var s = Math.max(1, Number(stage) || 1)
    var cap = GymLogic.maxStage(root.playable.length)
    if (cap >= 1 && s > cap) s = cap
    root.playedStage = s
    root.passedStage = false
    root.resultStars = 0
    root.song = GymLogic.songForStage(s)
    root.chart = GymLogic.generateChart(root.playable, s, root.song)
    root.stageNotes = root.chart.notes.map(function(note) {
      return { hitTimeMs: note.hitTimeMs, lane: note.lane, glyph: GymLogic.noteGlyph(note.chord) }
    })
    root.run = GymLogic.emptyRun(root.chart)
    root.chartComplete = false
    root.lastJudgement = ""
    root.pressLane = -1
    Stage.clearEffects(root.fx)
    root.nowMs = 0
    root.startEpoch = Date.now()
    root.lastTickAt = root.startEpoch
    root.playSong()
    tickTimer.start()
    stageCanvas.requestPaint()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
    console.log("io.github.stevederico.omarchy-gym chart stage=" + s + " song=" + root.chart.songId + " notes=" + root.chart.notes.length + " playable=" + root.playable.length + " audio=" + !!songLoader.item)
  }

  function playSong() {
    if (!songLoader.item || !root.song) return
    songLoader.item.play(Qt.resolvedUrl("../" + root.song.file))
  }

  function stopSong() {
    if (songLoader.item) songLoader.item.stop()
  }

  // The audio position leads once the song is playing.
  function syncToAudio(ms) {
    if (!root.opened || root.chartComplete || !songLoader.item || !songLoader.item.playing) return
    root.startEpoch = GymLogic.resyncOrigin(root.startEpoch, Date.now(), ms)
  }

  function loadProgress(raw) {
    root.progress = GymLogic.parseProgress(raw)
    if (root.opened && (!root.chart || !root.chart.notes)) root.startChart()
  }

  function loadCatalog(raw) {
    var parsed = GymLogic.parseKeybindingsPrint(raw)
    if (parsed.playable.length > 0) {
      root.playable = parsed.playable
      root.catalogSource = "current Learn keybindings"
    } else {
      root.playable = GymLogic.defaultPlayable()
      root.catalogSource = "baked fallback"
    }
    root.catalogLoaded = true
    catalogFallbackTimer.stop()
    console.log("io.github.stevederico.omarchy-gym catalog=" + root.catalogSource + " playable=" + root.playable.length)
    if (root.opened && root.pendingChartStart) root.startChart()
  }

  function refreshCatalog() {
    root.catalogLoaded = false
    root.pendingChartStart = true
    catalogFallbackTimer.restart()
    if (keybindingsProcess.running) return
    root.catalogText = ""
    // Process.exec needs a command argument; rerun the declared command instead.
    keybindingsProcess.running = true
  }

  function finishCatalog(exitCode) {
    catalogFallbackTimer.stop()
    if (root.catalogLoaded) return
    root.loadCatalog(GymLogic.catalogTextForExit(exitCode, root.catalogText))
  }

  function saveProgress() {
    progressFile.setText(GymLogic.serializeProgress(root.progress))
  }

  function finishChart() {
    tickTimer.stop()
    root.chartComplete = true
    root.resultStars = GymLogic.starsForRun(root.run)
    root.passedStage = GymLogic.isPassingStars(root.resultStars)
    root.progress = GymLogic.applyChartResult(root.progress, root.run)
    root.saveProgress()
    if (songLoader.item) songLoader.item.fadeOut()
    stageCanvas.requestPaint()
    console.log("io.github.stevederico.omarchy-gym end stage=" + root.playedStage + " stars=" + root.resultStars + " score=" + root.score + " passed=" + root.passedStage)
  }

  function keyName(event) {
    if (event.key === Qt.Key_Escape) return "ESCAPE"
    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) return "RETURN"
    if (event.key === Qt.Key_Space) return "SPACE"
    if (event.key === Qt.Key_Tab) return "TAB"
    if (event.key === Qt.Key_Backspace) return "BACKSPACE"
    if (event.key === Qt.Key_Delete) return "DELETE"
    if (event.key === Qt.Key_Left) return "LEFT"
    if (event.key === Qt.Key_Right) return "RIGHT"
    if (event.key === Qt.Key_Up) return "UP"
    if (event.key === Qt.Key_Down) return "DOWN"
    if (event.key === Qt.Key_Home) return "HOME"
    if (event.key === Qt.Key_End) return "END"
    if (event.key === Qt.Key_PageUp) return "PAGEUP"
    if (event.key === Qt.Key_PageDown) return "PAGEDOWN"
    if (event.key === Qt.Key_Print) return "PRINT"
    if (event.key === Qt.Key_Minus) return "MINUS"
    if (event.key === Qt.Key_Equal) return "EQUAL"
    if (event.key === Qt.Key_BracketLeft) return "BRACKETLEFT"
    if (event.key === Qt.Key_BracketRight) return "BRACKETRIGHT"
    if (event.key === Qt.Key_Comma) return "COMMA"
    if (event.key === Qt.Key_Slash) return "SLASH"
    if (event.key === Qt.Key_Period) return "PERIOD"
    if (event.key >= Qt.Key_A && event.key <= Qt.Key_Z)
      return String.fromCharCode(event.key)
    if (event.key >= Qt.Key_0 && event.key <= Qt.Key_9)
      return String.fromCharCode(event.key)
    if (event.key === Qt.Key_F1) return "F1"
    if (event.key === Qt.Key_F2) return "F2"
    if (event.key === Qt.Key_F3) return "F3"
    if (event.key === Qt.Key_F4) return "F4"
    if (event.key === Qt.Key_F5) return "F5"
    if (event.key === Qt.Key_F6) return "F6"
    if (event.key === Qt.Key_F7) return "F7"
    if (event.key === Qt.Key_F8) return "F8"
    if (event.key === Qt.Key_F9) return "F9"
    if (event.key === Qt.Key_F10) return "F10"
    if (event.key === Qt.Key_F11) return "F11"
    if (event.key === Qt.Key_F12) return "F12"
    if (event.key === Qt.Key_Shift) return "SHIFT"
    if (event.key === Qt.Key_Control) return "CTRL"
    if (event.key === Qt.Key_Alt) return "ALT"
    if (event.key === Qt.Key_Meta) return "SUPER"
    // Shifted symbols (Qt.Key_Plus, Qt.Key_Underscore, Qt.Key_Less,
    // Qt.Key_Greater, Qt.Key_Question, Qt.Key_Exclam..Qt.Key_ParenRight, ...)
    // map back to the unshifted key Hyprland binds use.
    var shifted = GymLogic.keyNameForQtKey(event.key)
    if (shifted) return shifted
    var symbol = GymLogic.symbolKeyName(event.text)
    if (symbol) return symbol
    if (event.text && event.text.length === 1) {
      var ch = event.text.toUpperCase()
      if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127) return ch
    }
    return ""
  }

  function handleChord(event) {
    event.accepted = true
    var parts = {
      superHeld: !!(event.modifiers & Qt.MetaModifier),
      shiftHeld: !!(event.modifiers & Qt.ShiftModifier),
      ctrlHeld: !!(event.modifiers & Qt.ControlModifier),
      altHeld: !!(event.modifiers & Qt.AltModifier),
      key: root.keyName(event)
    }
    var routed = GymLogic.routeKeyEvent({
      opened: root.opened,
      chartComplete: root.chartComplete,
      hasChart: !!(root.chart && root.chart.notes && root.chart.notes.length)
    }, parts)

    if (routed.action === "dismiss") {
      root.dismiss()
      return
    }
    if (routed.action === "retry") {
      root.retry()
      return
    }
    if (routed.action !== "score") return
    root.scoreRouted(routed.chord)
  }

  function scoreRouted(chord) {
    var now = Date.now()
    if (GymLogic.isDuplicatePress(root.lastPress, chord, now)) return "duplicate"
    root.lastPress = { chord: GymLogic.normalizeChord(chord), atMs: now }
    root.pressLane = GymLogic.laneForChord(chord)
    root.pressAt = now
    root.applyScore(GymLogic.scorePress(root.run, root.nowMs, chord))
    return root.lastJudgement
  }

  function scoreChord(arg) {
    if (!root.opened) return "idle"
    var chord = String(arg || "")
    if (!chord) return "empty"
    var routed = GymLogic.routeKeyEvent({
      opened: root.opened,
      chartComplete: root.chartComplete,
      hasChart: !!(root.chart && root.chart.notes && root.chart.notes.length)
    }, root.partsFromChord(chord))
    if (routed.action === "dismiss") {
      root.dismiss()
      return "dismiss"
    }
    if (routed.action === "retry") {
      root.retry()
      return "retry"
    }
    if (root.chartComplete || routed.action !== "score") return routed.action || "ignore"
    return root.scoreRouted(routed.chord || chord)
  }

  function partsFromChord(chord) {
    var tokens = GymLogic.tokenizeChord(chord)
    var parts = { superHeld: false, shiftHeld: false, ctrlHeld: false, altHeld: false, key: "" }
    var t
    for (t = 0; t < tokens.length; t++) {
      var token = GymLogic.canonicalToken(tokens[t])
      if (token === "SUPER") parts.superHeld = true
      else if (token === "SHIFT") parts.shiftHeld = true
      else if (token === "CTRL") parts.ctrlHeld = true
      else if (token === "ALT") parts.altHeld = true
      else parts.key = token
    }
    return parts
  }

  function applyScore(scored) {
    if (!scored || !scored.run) return
    root.run = scored.run
    if (scored.result === "ignore") return
    var j = scored.result === "ghost" ? "" : String(scored.result || "")
    if (!j) return
    root.lastJudgement = j
    var note = scored.noteIndex !== null && scored.noteIndex !== undefined ? root.chart.notes[scored.noteIndex] : null
    if (note) {
      var layout = Stage.computeLayout(stageCanvas.width, stageCanvas.height)
      if (j === "Miss") Stage.effectsMiss(root.fx, note.lane)
      else Stage.effectsHit(root.fx, layout, note.lane, j)
    }
    stageCanvas.requestPaint()
    if (root.run.chartComplete) root.finishChart()
  }

  // Notes that ran past the window become misses, with a MISS popup each.
  function applyAdvance(next) {
    var before = root.run.judgements || []
    var i
    for (i = 0; i < next.judgements.length; i++) {
      if (!before[i] && next.judgements[i] === "Miss") Stage.effectsMiss(root.fx, root.chart.notes[i].lane)
    }
    root.run = next
    if (root.run.chartComplete) root.finishChart()
  }

  function frameState() {
    return {
      nowMs: root.nowMs,
      bpm: root.song ? root.song.bpm : 120,
      hue: root.song ? root.song.hue : 265,
      hueAlt: root.song ? root.song.hueAlt : 190,
      lookaheadMs: (root.chart && root.chart.scrollMs) || 4000,
      notes: root.stageNotes,
      judgements: (root.run && root.run.judgements) || [],
      currentIndex: root.currentNoteIndex,
      pressLane: root.pressLane,
      pressAgeMs: Date.now() - root.pressAt,
      laneLabels: GymLogic.LANES.map(function(lane) { return lane.label }),
      fontFamily: root.fontFamily,
      mood: Math.min(1, 0.25 + 0.25 * (root.multiplier - 1))
    }
  }

  // One step per rendered frame, in time with the display.
  FrameAnimation {
    id: tickTimer
    running: false
    onTriggered: {
      if (!root.opened || root.chartComplete) {
        stop()
        return
      }
      var wall = Date.now()
      Stage.updateEffects(root.fx, Math.min(0.1, (wall - root.lastTickAt) / 1000))
      root.lastTickAt = wall
      root.nowMs = wall - root.startEpoch
      var next = GymLogic.advanceChart(root.run, root.nowMs)
      // advanceChart returns the same run on quiet ticks; skip the reassign.
      if (next !== root.run) root.applyAdvance(next)
      stageCanvas.requestPaint()
    }
  }

  // The scan runs under a 3 s timeout. This backstop fires 1 s later in case
  // the process never reports an exit, and loads the baked snapshot.
  Timer {
    id: catalogFallbackTimer
    interval: 4000
    repeat: false
    onTriggered: {
      if (root.catalogLoaded) return
      root.loadCatalog("")
      keybindingsProcess.running = false
    }
  }

  FileView {
    id: progressFile
    path: root.progressPath
    atomicWrites: true
    // Only the first-run "file missing" load error is expected, so loads stay
    // quiet and save failures are reported below.
    printErrors: false
    onLoaded: root.loadProgress(text())
    onLoadFailed: root.loadProgress("{}")
    onSaveFailed: function(error) {
      console.warn("io.github.stevederico.omarchy-gym could not save progress to " + root.progressPath + ": " + FileViewError.toString(error))
    }
  }

  Process {
    id: keybindingsProcess
    // timeout stops the whole process group, so a stalled scan leaves no
    // child behind.
    command: ["timeout", "3", "omarchy", "menu", "keybindings", "--print"]
    // Started by refreshCatalog() when Gym opens, not at every shell start.
    running: false
    // The stream finishes before the exit is reported; finishCatalog uses the
    // exit code to reject partial output from a timed-out scan (exit 124).
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.catalogText = this.text
    }
    onExited: function(exitCode) {
      root.finishCatalog(exitCode)
    }
  }

  // Music needs Qt Multimedia. Without it this Loader errors quietly and
  // Gym plays silent on the wall clock.
  Loader {
    id: songLoader
    source: "SongPlayer.qml"
    onStatusChanged: {
      if (status === Loader.Error) console.warn("io.github.stevederico.omarchy-gym Qt Multimedia unavailable; playing without music")
    }
  }

  Connections {
    target: songLoader.item
    ignoreUnknownSignals: true
    function onPositionReport(ms) { root.syncToAudio(ms) }
  }

  FloatingWindow {
    id: window
    title: "Gym"
    visible: false
    color: root.stageColor
    implicitWidth: Style.space(720)
    implicitHeight: Style.space(560)
    minimumSize: Qt.size(Style.space(420), Style.space(420))

    onVisibleChanged: {
      if (visible) {
        root.syncSandbox()
        Qt.callLater(function() { keyCatcher.forceActiveFocus() })
      } else {
        root.stopSong()
        root.leaveSandbox()
        if (!root.closingFromHost && root.shell && typeof root.shell.hide === "function")
          root.shell.hide((root.manifest && root.manifest.id) || "io.github.stevederico.omarchy-gym")
      }
    }

    Item {
      id: keyCatcher
      anchors.fill: parent
      focus: true
      readonly property bool windowActive: Window.active
      onWindowActiveChanged: root.syncSandbox()
      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        root.handleChord(event)
      }
    }

    // Sky, crowd, highway, gems, pads, and hit effects.
    Canvas {
      id: stageCanvas
      anchors.fill: parent
      renderStrategy: Canvas.Cooperative
      renderTarget: Canvas.FramebufferObject
      onPaint: {
        var g = getContext("2d")
        Stage.drawFrame(g, Stage.computeLayout(width, height), root.frameState(), root.fx)
      }
      onWidthChanged: requestPaint()
      onHeightChanged: requestPaint()
    }

    // Song progress along the top edge.
    Rectangle {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      height: 4
      color: Qt.rgba(1, 1, 1, 0.12)

      Rectangle {
        height: parent.height
        width: parent.width * Math.min(1, Math.max(0, root.nowMs / ((root.chart && root.chart.endMs) || 1)))
        color: root.song ? Qt.hsla(root.song.hueAlt / 360, 1, 0.65, 1) : root.textColor
      }
    }

    // Score and stars, top left.
    Column {
      anchors.left: parent.left
      anchors.top: parent.top
      anchors.leftMargin: 16
      anchors.topMargin: 18
      spacing: 4
      visible: !root.chartComplete

      Text {
        text: "SCORE"
        color: root.dimTextColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.weight: Font.Bold
      }

      Text {
        text: GymLogic.formatScore(root.score)
        color: root.textColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.displayLarge
        font.weight: Font.ExtraBold
      }

      Row {
        spacing: 4
        Repeater {
          model: 5
          Text {
            required property int index
            text: "★"
            color: index < root.liveStars ? root.starColor : Qt.rgba(1, 1, 1, 0.16)
            font.pixelSize: Style.font.heading
          }
        }
      }
    }

    // Stage and song, top right.
    Column {
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.rightMargin: 16
      anchors.topMargin: 18
      spacing: 2
      visible: !root.chartComplete

      Text {
        anchors.right: parent.right
        text: "STAGE " + root.stageNumber
        color: root.dimTextColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.weight: Font.Bold
      }

      Text {
        anchors.right: parent.right
        text: root.song ? root.song.title : ""
        color: root.textColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
        font.weight: Font.Bold
      }

      Text {
        anchors.right: parent.right
        text: root.song ? root.song.artist : ""
        color: root.dimTextColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
      }
    }

    // Multiplier, combo, and the chord to press next, top center.
    Column {
      anchors.horizontalCenter: parent.horizontalCenter
      y: parent.height * 0.07
      width: parent.width * 0.6
      spacing: 2
      visible: !root.chartComplete

      Text {
        width: parent.width
        text: "x" + root.multiplier
        color: root.textColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.displayLarge
        font.weight: Font.ExtraBold
        horizontalAlignment: Text.AlignHCenter
        style: Text.Outline
        styleColor: Qt.rgba(0.02, 0.01, 0.05, 0.6)
      }

      Text {
        width: parent.width
        text: root.combo >= 2 ? root.combo + " COMBO" : " "
        color: root.dimTextColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.weight: Font.Bold
        horizontalAlignment: Text.AlignHCenter
      }

      Text {
        width: parent.width
        topPadding: Style.spacing.sm
        text: root.currentAction
        color: root.textColor
        wrapMode: Text.Wrap
        maximumLineCount: 2
        font.family: root.fontFamily
        font.pixelSize: Style.font.heading
        font.weight: Font.Bold
        horizontalAlignment: Text.AlignHCenter
        style: Text.Outline
        styleColor: Qt.rgba(0.02, 0.01, 0.05, 0.7)
      }

      Text {
        width: parent.width
        text: root.currentChord
        color: root.currentColor
        wrapMode: Text.Wrap
        font.family: root.fontFamily
        font.pixelSize: Style.font.display
        font.weight: Font.ExtraBold
        horizontalAlignment: Text.AlignHCenter
        style: Text.Outline
        styleColor: Qt.rgba(0.02, 0.01, 0.05, 0.7)
      }
    }

    Text {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      anchors.bottomMargin: 6
      visible: !root.chartComplete
      text: "Chords are scored, never run   ·   Esc or Super+W leaves   ·   F12 frees your keys"
      color: root.dimTextColor
      opacity: 0.7
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
    }

    // Results.
    Rectangle {
      id: endScreen
      visible: root.chartComplete
      anchors.fill: parent
      z: 80
      color: Qt.rgba(0.03, 0.02, 0.07, 0.86)

      MouseArea {
        anchors.fill: parent
      }

      Column {
        id: endContent
        width: Math.min(endScreen.width - 48, 520)
        anchors.centerIn: parent
        spacing: 14

        Text {
          width: endContent.width
          text: "STAGE " + root.playedStage + (root.song ? "  ·  " + root.song.title.toUpperCase() : "")
          color: root.dimTextColor
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.weight: Font.Bold
          horizontalAlignment: Text.AlignHCenter
        }

        Row {
          anchors.horizontalCenter: parent.horizontalCenter
          spacing: 8
          Repeater {
            model: 5
            Text {
              required property int index
              text: "★"
              color: index < root.resultStars ? root.starColor : Qt.rgba(1, 1, 1, 0.16)
              font.pixelSize: Style.font.displayLarge * 1.4
            }
          }
        }

        Text {
          width: endContent.width
          text: GymLogic.formatScore(root.score)
          color: root.textColor
          font.family: root.fontFamily
          font.pixelSize: Style.font.displayLarge
          font.weight: Font.ExtraBold
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: endContent.width
          text: "PERFECT " + (root.counts.Perfect || 0)
            + "   GREAT " + (root.counts.Great || 0)
            + "   GOOD " + (root.counts.Good || 0)
            + "   MISS " + (root.counts.Miss || 0)
            + "   ·   MAX COMBO " + root.maxCombo
          color: root.dimTextColor
          wrapMode: Text.Wrap
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.weight: Font.Bold
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: endContent.width
          text: {
            if (root.passedStage)
              return root.hasNextStage ? "Next stage unlocked" : "Every stage cleared"
            return root.hasNextStage
              ? GymLogic.STARS_TO_PASS + " stars unlock the next stage"
              : "Play again to improve your stars"
          }
          color: root.textColor
          wrapMode: Text.Wrap
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          horizontalAlignment: Text.AlignHCenter
        }

        Rectangle {
          width: endContent.width
          height: 56
          radius: height / 2
          visible: root.passedStage && root.hasNextStage
          color: nextMouse.containsMouse ? root.laneColors[0] : "transparent"
          border.width: 3
          border.color: root.laneColors[0]

          Text {
            anchors.centerIn: parent
            text: "Next stage"
            color: nextMouse.containsMouse ? root.stageColor : root.textColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            font.weight: Font.Bold
          }

          MouseArea {
            id: nextMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.nextLevel()
          }
        }

        Rectangle {
          width: endContent.width
          height: 56
          radius: height / 2
          color: retryMouse.containsMouse ? root.laneColors[1] : "transparent"
          border.width: 3
          border.color: root.laneColors[1]

          Text {
            anchors.centerIn: parent
            text: "Retry"
            color: retryMouse.containsMouse ? root.stageColor : root.textColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            font.weight: Font.Bold
          }

          MouseArea {
            id: retryMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.retry()
          }
        }

        Text {
          width: endContent.width
          text: "Return retries   ·   Esc leaves"
          color: root.dimTextColor
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          horizontalAlignment: Text.AlignHCenter
        }
      }
    }
  }
}

import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "GymLogic.js" as GymLogic

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
  property bool chartComplete: false
  property string lastJudgement: ""
  property string flashJudgement: ""
  property int flashLane: -1
  property int flashSeq: 0
  property real nowMs: 0
  property real startEpoch: 0

  property color background: Color.background
  property color foreground: Color.foreground
  property color border: Color.menu.border
  property var borderSpec: Border.surfaceSpec("menu", "border", border, Math.max(1, Style.space(2)))
  property color selectedBackground: Color.menu.selectedBackground
  property color selectedText: Color.menu.selectedText
  readonly property int cornerRadius: Style.cornerRadius
  property string fontFamily: Style.font.menuFamily

  property string progressPath: Quickshell.env("HOME") + "/.local/state/omarchy/gym-progress.json"

  readonly property int laneCount: 4
  readonly property int laneWidth: Style.space(80)
  readonly property int highwayWidth: laneWidth * laneCount + Style.spacing.xl * 2
  readonly property int dotSize: Style.space(44)
  readonly property real spawnY: -dotSize
  readonly property real hitY: Math.max(Style.space(180), playfield.height * 0.82)
  readonly property int stageNumber: Number(root.chart && root.chart.stage) || 1
  readonly property int poolSize: Number(root.chart && root.chart.poolSize) || 0
  readonly property int combo: Number(root.run && root.run.combo) || 0
  readonly property int maxCombo: Number(root.run && root.run.maxCombo) || 0
  readonly property int score: Number(root.run && root.run.score) || 0
  readonly property int highScore: Number(root.progress && root.progress.highScore) || 0
  readonly property string scoreText: GymLogic.formatScore(root.score)
  readonly property string lastTiming: String((root.run && root.run.lastTiming) || "")
  readonly property int lastDeltaMs: Number(root.run && root.run.lastDeltaMs) || 0
  readonly property var counts: (root.run && root.run.counts) ? root.run.counts : ({})
  readonly property string gradeText: root.chartComplete ? GymLogic.gradeForRun(root.run) : ""
  readonly property color judgementColor: {
    var j = root.flashJudgement || root.lastJudgement
    if (j === "Marvelous") return Color.accent
    if (j === "Perfect") return Color.foreground
    if (j === "Great") return Color.muted
    if (j === "Good") return Color.muted
    if (j === "Miss") return Color.urgent
    return root.foreground
  }

  function enterSandbox() {
    // QML array (not a .js return value) so Quickshell.execDetached actually runs.
    Quickshell.execDetached(["hyprctl", "dispatch", GymLogic.sandboxEnterDispatch()])
  }

  function leaveSandbox() {
    Quickshell.execDetached(["hyprctl", "dispatch", GymLogic.sandboxLeaveDispatch()])
  }

  function open(payloadJson) {
    root.closingFromHost = false
    root.opened = true
    root.lastJudgement = ""
    root.chartComplete = false
    window.visible = true
    root.enterSandbox()
    root.startChart()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.closingFromHost = true
    tickTimer.stop()
    root.opened = false
    root.leaveSandbox()
    window.visible = false
    root.closingFromHost = false
  }

  function dismiss() {
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "sd.gym")
    else
      root.close()
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function startChart() {
    if (!root.progress || typeof root.progress !== "object" || Array.isArray(root.progress))
      root.progress = GymLogic.emptyProgress()
    root.playable = GymLogic.defaultPlayable()
    var stage = Number(root.progress.stage) || 1
    root.chart = GymLogic.generateChart(root.playable, stage)
    root.run = GymLogic.emptyRun(root.chart)
    root.chartComplete = false
    root.lastJudgement = ""
    root.nowMs = 0
    root.startEpoch = Date.now()
    root.rebuildNoteModel()
    tickTimer.start()
    console.log("sd.gym chart stage=" + stage + " notes=" + ((root.chart.notes && root.chart.notes.length) || 0) + " playable=" + root.playable.length)
  }

  function rebuildNoteModel() {
    noteModel.clear()
    var notes = root.chart && root.chart.notes ? root.chart.notes : []
    var i
    for (i = 0; i < notes.length; i++) {
      var n = notes[i]
      noteModel.append({
        noteIndex: n.index,
        noteId: n.id,
        chord: n.chord,
        action: n.action,
        hitTimeMs: n.hitTimeMs,
        lane: Number(n.lane) || 0
      })
    }
  }

  function loadProgress(raw) {
    root.progress = GymLogic.parseProgress(raw)
    if (root.opened && (!root.chart || !root.chart.notes)) root.startChart()
  }

  function saveProgress() {
    progressFile.setText(GymLogic.serializeProgress(root.progress))
  }

  function finishChart() {
    tickTimer.stop()
    root.chartComplete = true
    root.progress = GymLogic.applyChartResult(root.progress, root.run)
    root.saveProgress()
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
    if (routed.action !== "score") return
    root.applyScore(GymLogic.scorePress(root.run, root.nowMs, routed.chord))
  }

  function scoreChord(arg) {
    if (!root.opened || root.chartComplete) return "idle"
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
    if (routed.action !== "score") return routed.action || "ignore"
    root.applyScore(GymLogic.scorePress(root.run, root.nowMs, routed.chord || chord))
    return root.lastJudgement
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
    root.flashJudgement = j
    var idx = scored.noteIndex
    if (idx !== null && idx !== undefined && root.chart && root.chart.notes && root.chart.notes[idx])
      root.flashLane = Number(root.chart.notes[idx].lane)
    else
      root.flashLane = -1
    root.flashSeq += 1
    flashTimer.restart()
    console.log("sd.gym score " + j + " chord=" + (scored.run && scored.result) + " lane=" + root.flashLane)
    if (root.run.chartComplete) root.finishChart()
  }

  Timer {
    id: flashTimer
    interval: 520
    repeat: false
    onTriggered: {
      root.flashJudgement = ""
      root.flashLane = -1
    }
  }

  Timer {
    id: tickTimer
    interval: 16
    repeat: true
    onTriggered: {
      if (!root.opened || root.chartComplete) {
        stop()
        return
      }
      root.nowMs = Date.now() - root.startEpoch
      root.run = GymLogic.advanceChart(root.run, root.nowMs)
      if (root.run.chartComplete) root.finishChart()
    }
  }

  FileView {
    id: progressFile
    path: root.progressPath
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadProgress(text())
    onLoadFailed: root.loadProgress("{}")
  }

  FloatingWindow {
    id: window
    title: "Gym"
    visible: false
    color: root.background
    implicitWidth: Style.space(520)
    implicitHeight: Style.space(640)
    minimumSize: Qt.size(Style.space(400), Style.space(480))

    onVisibleChanged: {
      if (visible) {
        root.enterSandbox()
        Qt.callLater(function() { keyCatcher.forceActiveFocus() })
      } else {
        root.leaveSandbox()
        if (!root.closingFromHost && root.shell && typeof root.shell.hide === "function")
          root.shell.hide((root.manifest && root.manifest.id) || "sd.gym")
      }
    }

    Item {
      id: keyCatcher
      anchors.fill: parent
      focus: true
      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        root.handleChord(event)
      }
    }

    Item {
      id: playfield
      anchors.fill: parent
      clip: true

      readonly property var receptorGlyphs: ["←", "↓", "↑", "→"]

      Rectangle {
        anchors.fill: parent
        color: Qt.rgba(root.background.r, root.background.g, root.background.b, 0.22)
      }

      Column {
        id: scoreTracker
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.topMargin: Style.spacing.sm
        spacing: Style.spacing.xxs

        Text {
          width: parent.width
          text: "Gym · Stage " + root.stageNumber
          color: root.foreground
          opacity: 0.7
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          text: root.scoreText
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.displayLarge
          font.weight: Font.DemiBold
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          visible: root.combo > 0
          text: root.combo + " COMBO"
          color: Color.accent
          font.family: root.fontFamily
          font.pixelSize: Style.font.heading
          font.weight: Font.DemiBold
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          text: {
            var t = root.lastJudgement
            if (!t) return "hit the line"
            var side = root.lastTiming
            if (side === "HIT") return t
            if (side === "EARLY") return t + "  EARLY " + Math.abs(root.lastDeltaMs) + "ms"
            if (side === "LATE") return t + "  LATE " + Math.abs(root.lastDeltaMs) + "ms"
            return t
          }
          color: root.lastJudgement ? root.judgementColor : root.foreground
          opacity: root.lastJudgement ? 1 : 0.55
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          font.weight: Font.DemiBold
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          text: "MARV " + (root.counts.Marvelous || 0)
                + "   PERF " + (root.counts.Perfect || 0)
                + "   GREAT " + (root.counts.Great || 0)
                + "   GOOD " + (root.counts.Good || 0)
                + "   MISS " + (root.counts.Miss || 0)
          color: root.foreground
          opacity: 0.62
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          visible: root.highScore > 0
          text: "Best " + GymLogic.formatScore(root.highScore)
          color: root.foreground
          opacity: 0.45
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          horizontalAlignment: Text.AlignHCenter
        }
      }

      Repeater {
        model: root.laneCount
        Item {
          required property int index
          width: root.laneWidth
          height: playfield.height
          x: Math.round((playfield.width - root.highwayWidth) / 2) + index * root.laneWidth + Style.spacing.xl
          y: 0

          Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: Math.max(2, Style.space(2))
            height: parent.height
            color: root.foreground
            opacity: 0.12
          }

          Rectangle {
            id: receptor
            width: root.dotSize + Style.space(10)
            height: width
            radius: width / 2
            anchors.horizontalCenter: parent.horizontalCenter
            y: root.hitY - height / 2
            color: (root.flashLane === index && root.flashJudgement.length)
              ? root.judgementColor
              : "transparent"
            border.width: Math.max(2, Style.space(3))
            border.color: (root.flashLane === index && root.flashJudgement.length)
              ? root.judgementColor
              : root.foreground
            opacity: 0.95

            Text {
              anchors.centerIn: parent
              text: playfield.receptorGlyphs[index]
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.heading
              font.weight: Font.DemiBold
            }
          }
        }
      }

      ListModel { id: noteModel }

      Repeater {
        model: noteModel

        Item {
          id: note
          required property int index
          required property string chord
          required property string action
          required property real hitTimeMs
          required property int lane
          width: root.laneWidth
          height: root.dotSize + Style.font.caption * 2
          x: Math.round((playfield.width - root.highwayWidth) / 2) + lane * root.laneWidth + Style.spacing.xl
          y: GymLogic.noteY(
            { hitTimeMs: hitTimeMs },
            root.nowMs,
            root.spawnY,
            root.hitY,
            (root.chart && root.chart.scrollMs) || 4000
          ) - root.dotSize / 2
          visible: {
            var judged = root.run && root.run.judgements ? root.run.judgements[index] : null
            if (judged && judged !== "Miss") return false
            return y > -height && y < playfield.height
          }
          opacity: {
            var judged = root.run && root.run.judgements ? root.run.judgements[index] : null
            if (judged === "Miss") {
              var fade = (root.nowMs - hitTimeMs) / 500
              return Math.max(0.15, 1 - Math.max(0, fade))
            }
            return 1
          }

          Rectangle {
            id: dot
            width: root.dotSize
            height: root.dotSize
            radius: width / 2
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            color: {
              var judged = root.run && root.run.judgements ? root.run.judgements[index] : null
              if (judged === "Marvelous" || judged === "Perfect" || judged === "Great" || judged === "Good")
                return root.selectedBackground
              return root.foreground
            }
            border.width: Math.max(1, Style.space(2))
            border.color: root.background
            opacity: 0.95
          }

          Text {
            anchors.top: dot.bottom
            anchors.topMargin: Style.spacing.xxs
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width - Style.spacing.xs
            text: GymLogic.normalizeChord(note.chord)
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.weight: Font.DemiBold
            wrapMode: Text.NoWrap
            elide: Text.ElideRight
            horizontalAlignment: Text.AlignHCenter
          }
        }
      }

      Text {
        id: flashLabel
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.verticalCenter: parent.verticalCenter
        text: root.flashJudgement ? root.flashJudgement.toUpperCase() : ""
        visible: root.flashJudgement.length > 0
        color: root.judgementColor
        font.family: root.fontFamily
        font.pixelSize: Style.font.displayLarge
        font.weight: Font.Black
        style: Text.Outline
        styleColor: root.background
        z: 20
      }

      Text {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.bottomMargin: Style.spacing.md
        text: "Sandbox — chords scored, not dispatched   ·   Esc leaves   ·   F12 failsafe"
        color: root.foreground
        opacity: 0.5
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        wrapMode: Text.WordWrap
        horizontalAlignment: Text.AlignHCenter
      }

      Rectangle {
        visible: root.chartComplete
        anchors.fill: parent
        color: Qt.rgba(root.background.r, root.background.g, root.background.b, 0.72)

        Column {
          anchors.centerIn: parent
          width: parent.width - Style.spacing.xl * 2
          spacing: Style.spacing.md

          Text {
            width: parent.width
            text: "Stage " + root.stageNumber + "  ·  " + root.gradeText
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.display
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignHCenter
          }

          Text {
            width: parent.width
            text: "Score " + root.score + "   ·   Max combo " + ((root.run && root.run.maxCombo) || 0)
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            horizontalAlignment: Text.AlignHCenter
          }

          Text {
            width: parent.width
            text: GymLogic.isPassingGrade(root.gradeText)
              ? "Passed — next pool unlocked"
              : "Try again — need C or better to unlock"
            color: root.foreground
            opacity: 0.8
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
          }

          Text {
            width: parent.width
            text: "Esc to leave"
            color: root.foreground
            opacity: 0.55
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            horizontalAlignment: Text.AlignHCenter
          }
        }
      }
    }
  }
}

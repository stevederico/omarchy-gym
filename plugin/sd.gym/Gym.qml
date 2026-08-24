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
  property var progress: ({})
  property var workout: ({})
  property int exerciseIndex: 0
  property string lastFeedback: ""
  property bool lastHit: false
  property bool workoutComplete: false
  property bool awaitingAdvance: false

  property color background: Color.menu.background
  property color foreground: Color.menu.text
  property color border: Color.menu.border
  property var borderSpec: Border.surfaceSpec("menu", "border", border, Math.max(1, Style.space(2)))
  property color scrim: Color.menu.scrim
  property color selectedBackground: Color.menu.selectedBackground
  property color selectedText: Color.menu.selectedText
  readonly property int cornerRadius: Style.cornerRadius
  property string fontFamily: Style.font.menuFamily
  property int contentMargin: Style.spacing.panelPadding
  property int cardWidth: Math.min(Style.space(520), panel.width - Style.gapsOut * 2)
  property int cardMaxHeight: Math.max(Style.space(240), panel.height - Style.gapsOut * 2)

  property string progressPath: Quickshell.env("HOME") + "/.local/state/omarchy/gym-progress.json"

  readonly property var currentExercise: {
    if (!root.workout || !Array.isArray(root.workout.exercises)) return null
    if (root.exerciseIndex < 0 || root.exerciseIndex >= root.workout.exercises.length) return null
    return root.workout.exercises[root.exerciseIndex]
  }

  readonly property string promptText: root.workoutComplete
    ? "Workout complete"
    : (root.currentExercise ? String(root.currentExercise.prompt || "") : "")

  readonly property string chordText: root.workoutComplete
    ? "Esc to leave · next lesson unlocks after mastery"
    : (root.currentExercise ? GymLogic.normalizeChord(root.currentExercise.chord) : "")

  readonly property string workoutTitle: root.workout && root.workout.name ? String(root.workout.name) : "Gym"

  readonly property string progressLabel: {
    if (root.workoutComplete) return "Done"
    var total = root.workout && Array.isArray(root.workout.exercises) ? root.workout.exercises.length : 0
    if (total <= 0) return ""
    return (root.exerciseIndex + 1) + " / " + total
  }

  function enterSandbox() {
    // QML array (not a .js return value) so Quickshell.execDetached actually runs.
    // Omarchy's hyprctl dispatch is Lua: `submap NAME` is invalid.
    Quickshell.execDetached(["hyprctl", "dispatch", GymLogic.sandboxEnterDispatch()])
  }

  function leaveSandbox() {
    Quickshell.execDetached(["hyprctl", "dispatch", GymLogic.sandboxLeaveDispatch()])
  }

  function open(payloadJson) {
    root.enterSandbox()
    root.opened = true
    root.lastFeedback = ""
    root.lastHit = false
    root.workoutComplete = false
    root.awaitingAdvance = false
    root.exerciseIndex = 0
    root.startWorkout()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.opened = false
    advanceTimer.stop()
    root.leaveSandbox()
  }

  function dismiss() {
    root.opened = false
    advanceTimer.stop()
    root.leaveSandbox()
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "sd.gym")
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function startWorkout() {
    if (!root.progress || typeof root.progress !== "object" || Array.isArray(root.progress))
      root.progress = GymLogic.emptyProgress()
    root.workout = GymLogic.assembleWorkout(root.progress, GymLogic.fullCatalog())
    root.exerciseIndex = 0
    root.workoutComplete = false
    root.lastFeedback = ""
    root.awaitingAdvance = false
  }

  function loadProgress(raw) {
    root.progress = GymLogic.parseProgress(raw)
    if (root.opened && (!root.workout || !root.workout.id)) root.startWorkout()
  }

  function saveProgress() {
    progressFile.setText(GymLogic.serializeProgress(root.progress))
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
    if (event.key === Qt.Key_Meta)
      return "SUPER"
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
      workoutComplete: root.workoutComplete,
      awaitingAdvance: root.awaitingAdvance,
      hasExercise: !!root.currentExercise
    }, parts)

    if (routed.action === "dismiss") {
      root.dismiss()
      return
    }
    if (routed.action !== "score") return

    var scored = GymLogic.scoreAttempt(root.currentExercise, routed.chord)
    root.progress = GymLogic.applyAttempt(root.progress, root.currentExercise.id, scored.hit)
    root.saveProgress()
    root.lastHit = scored.hit
    root.lastFeedback = scored.hit ? "Hit" : "Miss — try " + scored.expected

    if (scored.hit) {
      root.awaitingAdvance = true
      advanceTimer.restart()
    }
  }

  function advanceAfterHit() {
    root.awaitingAdvance = false
    if (!root.opened) return
    if (!root.workout || !Array.isArray(root.workout.exercises)) return
    if (root.exerciseIndex + 1 < root.workout.exercises.length) {
      root.exerciseIndex += 1
      root.lastFeedback = ""
      root.lastHit = false
      return
    }
    root.progress = GymLogic.finishWorkout(root.progress, root.workout)
    root.saveProgress()
    root.workoutComplete = true
    root.lastFeedback = "Results saved"
  }

  Timer {
    id: advanceTimer
    interval: 420
    repeat: false
    onTriggered: root.advanceAfterHit()
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

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omarchy-gym"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.dismiss()
    }

    BorderSurface {
      id: card
      width: root.cardWidth
      height: Math.min(
        root.cardMaxHeight,
        card.contentTopInset + body.implicitHeight + card.contentBottomInset
      )
      radius: root.cornerRadius
      anchors.centerIn: parent
      color: root.background
      borderSpec: root.borderSpec
      padding: root.contentMargin
      clip: true

      MouseArea { anchors.fill: parent; onClicked: {} }

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: function(event) {
          root.handleChord(event)
        }
      }

      Column {
        id: body
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.leftMargin: card.contentLeftInset
        spacing: Style.spacing.md

        Item {
          width: parent.width
          height: Math.max(titleLabel.implicitHeight, progressLabelText.implicitHeight)

          Text {
            id: titleLabel
            anchors.left: parent.left
            anchors.right: progressLabelText.left
            anchors.rightMargin: Style.spacing.md
            anchors.verticalCenter: parent.verticalCenter
            text: "Gym · " + root.workoutTitle
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.title
            font.weight: Font.DemiBold
            elide: Text.ElideRight
            wrapMode: Text.NoWrap
          }

          Text {
            id: progressLabelText
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: root.progressLabel
            color: root.foreground
            opacity: 0.62
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
          }
        }

        Text {
          width: parent.width
          text: "Sandbox — chords are scored, not dispatched"
          color: root.foreground
          opacity: 0.5
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          wrapMode: Text.WordWrap
        }

        Text {
          width: parent.width
          text: root.promptText
          color: root.foreground
          wrapMode: Text.WordWrap
          font.family: root.fontFamily
          font.pixelSize: Style.font.heading
          font.weight: Font.Medium
        }

        Text {
          width: parent.width
          text: root.chordText
          color: root.lastHit ? root.selectedText : root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.display
          font.weight: Font.DemiBold
          wrapMode: Text.WordWrap
        }

        Rectangle {
          visible: root.lastFeedback.length > 0
          width: parent.width
          height: feedbackLabel.implicitHeight + Style.spacing.controlPaddingY * 2
          radius: Math.max(4, root.cornerRadius / 2)
          color: root.lastHit ? root.selectedBackground : root.border
          clip: true

          Text {
            id: feedbackLabel
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: Style.spacing.rowPaddingX
            anchors.rightMargin: Style.spacing.rowPaddingX
            text: root.lastFeedback
            color: root.lastHit ? root.selectedText : root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }
        }

        Text {
          width: parent.width
          text: "Esc leaves · hit advances · misses stay on the exercise"
          color: root.foreground
          opacity: 0.45
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          wrapMode: Text.WordWrap
        }
      }
    }
  }
}

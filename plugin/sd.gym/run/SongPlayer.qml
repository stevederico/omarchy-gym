import QtQuick
import QtMultimedia

// Plays one pre-rendered Rockstar Hero song. Gym.qml loads this file through a
// Loader, so a system without Qt Multimedia still plays Gym, just silent.
Item {
  id: player

  property real volume: 0.8
  readonly property bool playing: media.playbackState === MediaPlayer.PlayingState
  readonly property real position: media.position

  signal positionReport(real ms)

  function play(url) {
    fade.stop()
    output.volume = player.volume
    media.stop()
    media.source = url
    media.play()
  }

  function stop() {
    fade.stop()
    media.stop()
  }

  // Ramp the song down instead of cutting it mid-bar.
  function fadeOut() {
    if (!player.playing) return
    fade.from = output.volume
    fade.restart()
  }

  // Follow the system default output, so headphones connected after the
  // shell started still get the music.
  MediaDevices { id: devices }

  MediaPlayer {
    id: media
    audioOutput: AudioOutput {
      id: output
      device: devices.defaultAudioOutput
      volume: player.volume
    }
    onPositionChanged: player.positionReport(media.position)
    onErrorOccurred: function(error, errorString) {
      console.warn("io.github.stevederico.omarchy-gym song error: " + errorString)
    }
  }

  NumberAnimation {
    id: fade
    target: output
    property: "volume"
    to: 0
    duration: 900
    onFinished: media.stop()
  }
}

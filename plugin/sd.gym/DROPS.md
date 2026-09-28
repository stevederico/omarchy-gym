# Dropped Learn keybindings

Rows from `omarchy menu keybindings --print` that Gym cannot score from a Qt key event.
They stay in the print fixture but are excluded from the playable pool.
`catalog.json` preserves the raw Learn catalog; `GymLogic.js` applies these
filters when it builds the playable pool.

The bundled fixture comes from stock Omarchy bindings only; see
`tools/regen-stock-keybindings.sh`.

| Chord | Action | Reason |
|---|---|---|
| SUPER + W | Close window | reserved for Gym control |
| SUPER + LEFT MOUSE BUTTON | Move window | mouse |
| SUPER + RIGHT MOUSE BUTTON | Resize window | mouse |
| SUPER ALT + mouse_down | Next window in group | mouse |
| SUPER ALT + mouse_up | Previous window in group | mouse |
| SUPER + mouse_down | Scroll active workspace forward | mouse |
| SUPER + mouse_up | Scroll active workspace backward | mouse |
| ALT + XF86AudioLowerVolume | Volume down precise | unscorable token: XF86AUDIOLOWERVOLUME |
| ALT + XF86AudioPlay | Next track | unscorable token: XF86AUDIOPLAY |
| ALT + XF86AudioRaiseVolume | Volume up precise | unscorable token: XF86AUDIORAISEVOLUME |
| ALT + XF86MonBrightnessDown | Brightness down precise | unscorable token: XF86MONBRIGHTNESSDOWN |
| ALT + XF86MonBrightnessUp | Brightness up precise | unscorable token: XF86MONBRIGHTNESSUP |
| SHIFT ALT + XF86AudioPlay | Previous track | unscorable token: XF86AUDIOPLAY |
| SHIFT + XF86AudioMute | Switch audio output | unscorable token: XF86AUDIOMUTE |
| SHIFT + XF86AudioPause | Switch media source | unscorable token: XF86AUDIOPAUSE |
| SHIFT + XF86AudioPlay | Switch media source | unscorable token: XF86AUDIOPLAY |
| SHIFT + XF86MonBrightnessDown | Brightness minimum | unscorable token: XF86MONBRIGHTNESSDOWN |
| SHIFT + XF86MonBrightnessUp | Brightness maximum | unscorable token: XF86MONBRIGHTNESSUP |
| XF86AudioLowerVolume | Volume down | unscorable token: XF86AUDIOLOWERVOLUME |
| XF86AudioMicMute | Mute microphone | unscorable token: XF86AUDIOMICMUTE |
| XF86AudioMute | Mute | unscorable token: XF86AUDIOMUTE |
| XF86AudioNext | Next track | unscorable token: XF86AUDIONEXT |
| XF86AudioPause | Pause | unscorable token: XF86AUDIOPAUSE |
| XF86AudioPlay | Play | unscorable token: XF86AUDIOPLAY |
| XF86AudioPrev | Previous track | unscorable token: XF86AUDIOPREV |
| XF86AudioRaiseVolume | Volume up | unscorable token: XF86AUDIORAISEVOLUME |
| XF86Calculator | Calculator | unscorable token: XF86CALCULATOR |
| XF86Eject | Eject media | unscorable token: XF86EJECT |
| XF86KbdBrightnessDown | Keyboard brightness down | unscorable token: XF86KBDBRIGHTNESSDOWN |
| XF86KbdBrightnessUp | Keyboard brightness up | unscorable token: XF86KBDBRIGHTNESSUP |
| XF86KbdLightOnOff | Keyboard backlight cycle | unscorable token: XF86KBDLIGHTONOFF |
| XF86MonBrightnessDown | Brightness down | unscorable token: XF86MONBRIGHTNESSDOWN |
| XF86MonBrightnessUp | Brightness up | unscorable token: XF86MONBRIGHTNESSUP |
| XF86PowerOff | Power menu | unscorable token: XF86POWEROFF |
| XF86TouchpadOff | Disable touchpad | unscorable token: XF86TOUCHPADOFF |
| XF86TouchpadOn | Enable touchpad | unscorable token: XF86TOUCHPADON |
| XF86TouchpadToggle | Toggle touchpad | unscorable token: XF86TOUCHPADTOGGLE |

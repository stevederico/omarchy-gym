"use strict"

// Refresh catalog.json, the baked list in GymLogic.js, and DROPS.md from
// plugin/sd.gym/keybindings-print.txt. Run by tools/regen-stock-keybindings.sh.

const fs = require("fs")
const path = require("path")

const pluginDir = path.join(__dirname, "..", "plugin", "sd.gym")
const logicPath = path.join(pluginDir, "run", "GymLogic.js")
const gym = require(logicPath)

const print = fs.readFileSync(path.join(pluginDir, "keybindings-print.txt"), "utf8")
const parsed = gym.parseKeybindingsPrint(print)

// catalog.json keeps every keyboard row, including the reserved Gym control.
const catalog = []
for (const line of print.split(/\r?\n/)) {
  const parts = line.trim().split("→")
  if (parts.length < 2) continue
  const chord = parts[0].trim()
  const reason = gym.dropReason(chord)
  if (reason && reason !== "reserved for Gym control") continue
  catalog.push({
    id: "kb." + catalog.length,
    index: catalog.length,
    chord: gym.normalizeChord(chord),
    action: parts.slice(1).join("→").trim()
  })
}
fs.writeFileSync(path.join(pluginDir, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n")

const logic = fs.readFileSync(logicPath, "utf8")
const start = logic.indexOf("var BAKED_PLAYABLE = [")
const end = logic.indexOf("\n\n// Songs from Rockstar Hero")
if (start < 0 || end < 0) throw new Error("BAKED_PLAYABLE block not found in GymLogic.js")
fs.writeFileSync(
  logicPath,
  logic.slice(0, start) + "var BAKED_PLAYABLE = " + JSON.stringify(parsed.playable, null, 2) + logic.slice(end)
)

const drops = [
  "# Dropped Learn keybindings",
  "",
  "Rows from `omarchy menu keybindings --print` that Gym cannot score from a Qt key event.",
  "They stay in the print fixture but are excluded from the playable pool.",
  "`catalog.json` preserves the raw Learn catalog; `GymLogic.js` applies these",
  "filters when it builds the playable pool.",
  "",
  "The bundled fixture comes from stock Omarchy bindings only; see",
  "`tools/regen-stock-keybindings.sh`.",
  "",
  "| Chord | Action | Reason |",
  "|---|---|---|"
]
for (const row of parsed.dropped) drops.push("| " + row.chord + " | " + row.action + " | " + row.reason + " |")
fs.writeFileSync(path.join(pluginDir, "DROPS.md"), drops.join("\n") + "\n")

console.log("playable " + parsed.playable.length + ", catalog " + catalog.length + ", dropped " + parsed.dropped.length)

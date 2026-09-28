"use strict"

// Replace the SONGS block in GymLogic.js with song timing data written by the
// render page. Run by tools/render-songs.sh.

const fs = require("fs")
const path = require("path")

const metaPath = process.argv[2]
if (!metaPath) throw new Error("usage: node tools/write-songs.js <songs.json>")
const songs = JSON.parse(fs.readFileSync(metaPath, "utf8"))
for (const song of songs) song.file = "songs/" + song.id + ".ogg"

const logicPath = path.join(__dirname, "..", "plugin", "sd.gym", "run", "GymLogic.js")
const logic = fs.readFileSync(logicPath, "utf8")
const startMarker = "// Songs from Rockstar Hero, written by tools/write-songs.js.\nvar SONGS = "
const start = logic.indexOf(startMarker)
const end = logic.indexOf("\n// End of SONGS.")
if (start < 0 || end < 0) throw new Error("SONGS block not found in GymLogic.js")
const block = startMarker + JSON.stringify(songs.map((song) => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  bpm: song.bpm,
  durationMs: song.durationMs,
  hue: song.hue,
  hueAlt: song.hueAlt,
  file: song.file,
  // One line so the list stays readable in diffs.
  onsetsMs: "@@" + song.onsetsMs.join(",") + "@@"
})), null, 2).replace(/"@@([0-9,]*)@@"/g, "[$1]")
fs.writeFileSync(logicPath, logic.slice(0, start) + block + logic.slice(end))
console.log("songs " + songs.map((song) => song.id).join(", "))

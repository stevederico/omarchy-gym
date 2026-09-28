// Dev server for tools/render-songs.sh. Serves a page that renders Rockstar
// Hero's songs with its own WebAudio synth code in an OfflineAudioContext and
// posts the audio back here to be written into OUT_DIR.

import fs from "node:fs"
import path from "node:path"

const here = path.dirname(new URL(import.meta.url).pathname)
const rockstarDir = path.resolve(process.env.ROCKSTAR_HERO_DIR || path.join(here, "..", "..", "..", "rockstar-hero"))
const outDir = path.resolve(process.env.OUT_DIR || path.join(here, "out"))

function saveRoute() {
  return {
    name: "gym-save",
    configureServer(server) {
      server.middlewares.use("/save", (req, res) => {
        const file = new URL(req.url, "http://localhost").searchParams.get("file") || ""
        if (req.method !== "POST" || !/^[a-z0-9-]+\.(wav|json)$/.test(file)) {
          res.statusCode = 400
          res.end("bad request")
          return
        }
        const chunks = []
        req.on("data", (chunk) => chunks.push(chunk))
        req.on("end", () => {
          fs.mkdirSync(outDir, { recursive: true })
          fs.writeFileSync(path.join(outDir, file), Buffer.concat(chunks))
          res.end("ok")
        })
      })
    }
  }
}

export default {
  root: here,
  logLevel: "warn",
  resolve: { alias: { "@rockstar": path.join(rockstarDir, "src") } },
  server: { host: "127.0.0.1", port: 5241, strictPort: true, fs: { allow: [here, rockstarDir] } },
  plugins: [saveRoute()]
}

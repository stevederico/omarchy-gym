// Renders every Rockstar Hero song to a WAV file with the game's own synth,
// plus the timing data Gym needs to place notes on what you hear.

import { SONGS } from '@riff/game/songs/index.ts';
import { buildArrangement } from '@riff/game/arrangement.ts';
import { buildChart } from '@riff/game/chart.ts';
import { songDuration } from '@riff/game/timing.ts';
import { createSongMix, playEvent } from '@riff/audio/mixer.ts';
import { createNoiseBuffer } from '@riff/audio/drums.ts';
import type { SongDef } from '@riff/game/types.ts';

const RATE = 44100;
/** Rockstar Hero's default volume setting. */
const MASTER_VOLUME = 0.8;

const log = (line: string): void => {
  const el = document.getElementById('log');
  if (el) el.textContent += `\n${line}`;
};

function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = 44 + frames * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const text = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = Math.max(-1, Math.min(1, data[c]?.[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return view.buffer;
}

async function renderSong(song: SongDef): Promise<ArrayBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(songDuration(song) * RATE), RATE);
  // Same master chain as Rockstar Hero's AudioEngine.
  const master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -9;
  limiter.knee.value = 6;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ctx.destination);
  const mix = createSongMix(ctx, master, createNoiseBuffer(ctx));
  for (const event of buildArrangement(song)) playEvent(ctx, mix, event, event.time);
  return encodeWav(await ctx.startRendering());
}

async function save(file: string, body: BodyInit): Promise<void> {
  const response = await fetch(`/save?file=${file}`, { method: 'POST', body });
  if (!response.ok) throw new Error(`save ${file} failed: ${response.status}`);
}

async function main(): Promise<void> {
  const meta = [];
  for (const song of SONGS) {
    log(`${song.id}...`);
    await save(`${song.id}.wav`, await renderSong(song));
    const onsets = new Set(buildChart(song, 'hard').notes.map((note) => Math.round(note.time * 1000)));
    meta.push({
      id: song.id,
      title: song.title,
      artist: song.artist,
      bpm: song.bpm,
      durationMs: Math.round(songDuration(song) * 1000),
      hue: song.theme.hue,
      hueAlt: song.theme.hueAlt,
      onsetsMs: [...onsets].sort((a, b) => a - b),
    });
  }
  await save('songs.json', JSON.stringify(meta, null, 2));
  log('done');
  document.title = 'Gym song render done';
}

main().catch((error: unknown) => {
  log(`error: ${String(error)}`);
  document.title = 'Gym song render failed';
});

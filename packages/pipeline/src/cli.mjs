#!/usr/bin/env node
import path from "node:path";
import { captions, burnCaptions } from "./captions.mjs";
import { highlights } from "./highlights.mjs";
import { cutClips } from "./clips.mjs";
import { exportTimeline, exportSingle } from "./export.mjs";
import { listShaders } from "./shaders.mjs";
import { probeMedia, which } from "./ffmpeg.mjs";

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}
function has(flag) {
  return process.argv.includes(flag);
}

const cmd = process.argv[2];
const rest = process.argv.slice(3).filter((a) => !a.startsWith("-"));

function help() {
  console.log(`Cutlab pipeline — real ffmpeg, HyperFrames captions, viral highlights

  node packages/pipeline/src/cli.mjs doctor
  node packages/pipeline/src/cli.mjs captions <video> [--out dir] [--model small.en] [--lang en]
  node packages/pipeline/src/cli.mjs burn <video> --srt captions.srt --out captioned.mp4
  node packages/pipeline/src/cli.mjs highlights <video> [--out highlights.json] [--max 8]
  node packages/pipeline/src/cli.mjs clips <video> --from highlights.json [--outdir clips]
  node packages/pipeline/src/cli.mjs export --timeline timeline.json --out out.mp4
  node packages/pipeline/src/cli.mjs remux <video> --out out.mp4
  node packages/pipeline/src/cli.mjs pipeline <video>     captions + highlights + clips
  node packages/pipeline/src/cli.mjs shaders
  node packages/pipeline/src/cli.mjs serve [--port 4174]

Export is always libx264 + AAC +faststart. Never canvas.captureStream().
`);
}

async function doctor() {
  const bins = {};
  for (const b of ["ffmpeg", "ffprobe", "node", "gh"]) bins[b] = await which(b);
  let hf = null;
  try {
    const { run } = await import("./ffmpeg.mjs");
    const r = await run("npx", ["hyperframes", "--version"]);
    hf = r.out.trim() || r.err.trim();
  } catch (e) {
    hf = String(e.message || e);
  }
  const report = {
    bins,
    hyperframes: hf,
    node: process.version,
    whisperModel: process.env.CUTLAB_WHISPER_MODEL || process.env.WHISPER_MODEL || null,
    ffmpegWhisper: "this gyan FFmpeg 9 build includes filter=whisper",
  };
  console.log(JSON.stringify(report, null, 2));
  if (!bins.ffmpeg || !bins.ffprobe) process.exitCode = 1;
}

async function runPipeline(input) {
  const outDir = path.resolve(arg("--out", path.join(path.dirname(path.resolve(input)), "cutlab-out")));
  const cap = await captions(input, { out: outDir, model: arg("--model"), language: arg("--lang") });
  console.log("captions", cap);
  const hi = await highlights(input, { outDir, out: path.join(outDir, "highlights.json") });
  console.log("highlights", hi.path, hi.clips.length);
  const cl = await cutClips(input, hi.path, { outdir: path.join(outDir, "clips") });
  console.log("clips", cl);
  return { captions: cap, highlights: hi, clips: cl };
}

try {
  if (!cmd || cmd === "-h" || cmd === "--help") {
    help();
  } else if (cmd === "doctor") {
    await doctor();
  } else if (cmd === "captions") {
    if (!rest[0]) throw new Error("captions needs a video path");
    console.log(JSON.stringify(await captions(rest[0], {
      out: arg("--out"),
      model: arg("--model"),
      language: arg("--lang"),
    }), null, 2));
  } else if (cmd === "burn") {
    const out = arg("--out");
    const srt = arg("--srt");
    if (!rest[0] || !out || !srt) throw new Error("burn <video> --srt file --out file");
    console.log(await burnCaptions(rest[0], srt, out));
  } else if (cmd === "highlights") {
    if (!rest[0]) throw new Error("highlights needs a video path");
    const r = await highlights(rest[0], {
      out: arg("--out"),
      outDir: arg("--outDir") || arg("--outdir"),
      max: arg("--max"),
      minLen: arg("--min"),
      maxLen: arg("--max-len"),
    });
    console.log(JSON.stringify({ path: r.path, clips: r.clips }, null, 2));
  } else if (cmd === "clips") {
    const from = arg("--from");
    if (!rest[0] || !from) throw new Error("clips <video> --from highlights.json");
    console.log(JSON.stringify(await cutClips(rest[0], from, { outdir: arg("--outdir") }), null, 2));
  } else if (cmd === "export") {
    const tl = arg("--timeline");
    const out = arg("--out");
    if (!tl || !out) throw new Error("export --timeline timeline.json --out out.mp4");
    console.log(JSON.stringify(await exportTimeline(tl, out), null, 2));
  } else if (cmd === "remux") {
    const out = arg("--out");
    if (!rest[0] || !out) throw new Error("remux <video> --out out.mp4");
    console.log(JSON.stringify(await exportSingle(rest[0], out), null, 2));
  } else if (cmd === "pipeline") {
    if (!rest[0]) throw new Error("pipeline needs a video path");
    await runPipeline(rest[0]);
  } else if (cmd === "shaders") {
    console.log(JSON.stringify(await listShaders(), null, 2));
  } else if (cmd === "serve") {
    process.env.CUTLAB_PORT = arg("--port") || process.env.CUTLAB_PORT || "4174";
    await import("./server.mjs");
  } else if (cmd === "probe") {
    console.log(JSON.stringify(await probeMedia(rest[0]), null, 2));
  } else {
    help();
    throw new Error(`unknown command ${cmd}`);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

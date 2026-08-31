import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { ffmpeg, run, ffmpegPathForFilter, H264_AAC, mustExist } from "./ffmpeg.mjs";

function srtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

export function srtToSec(stamp) {
  const clean = String(stamp).trim().replace(",", ".");
  const [hms, frac = "0"] = clean.split(".");
  const [h, m, s] = hms.split(":").map(Number);
  const ms = Number(`0.${frac}`);
  return h * 3600 + m * 60 + s + ms;
}

export function parseSrt(srt) {
  const blocks = String(srt || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n\r?\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.length);
    const time = lines.find((l) => l.includes("-->"));
    if (!time) continue;
    const [a, b] = time.split("-->").map((x) => x.trim());
    const text = lines.slice(lines.indexOf(time) + 1).join(" ").trim();
    if (!text) continue;
    cues.push({ start: srtToSec(a), end: srtToSec(b), text });
  }
  return cues;
}

export function cuesToSrt(cues) {
  return (cues || [])
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}

export function wordsToSrt(words) {
  const cues = [];
  let buf = [];
  let start = null;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim();
    const end = buf[buf.length - 1].end;
    cues.push({ start, end, text });
    buf = [];
    start = null;
  };
  for (const w of words) {
    const t = String(w.text || "").trim();
    if (!t) continue;
    if (start == null) start = Number(w.start) || 0;
    const next = [...buf, { ...w, text: t }];
    const line = next.map((x) => x.text).join(" ");
    const dur = Number(w.end) - start;
    if (buf.length && (line.length > 42 || dur > 2.6)) flush();
    if (start == null) start = Number(w.start) || 0;
    buf.push({ ...w, text: t });
  }
  flush();
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}

function parseWords(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.words)) return payload.words;
  if (Array.isArray(payload?.transcript)) return payload.transcript;
  if (Array.isArray(payload?.result?.words)) return payload.result.words;
  return [];
}

async function ffmpegWhisper(input, { language, srtPath }) {
  const modelPath = process.env.CUTLAB_WHISPER_MODEL || process.env.WHISPER_MODEL;
  if (!modelPath) return null;
  await mustExist(modelPath);
  const dest = ffmpegPathForFilter(srtPath);
  const lang = language || "auto";
  const af = `whisper=model='${ffmpegPathForFilter(modelPath)}':language=${lang}:format=srt:destination='${dest}'`;
  await ffmpeg(["-y", "-i", input, "-af", af, "-f", "null", "-"]);
  return { srtPath, words: [], engine: "ffmpeg-whisper" };
}

async function hyperframesTranscribe(input, { model, language, outDir }) {
  const srtPath = path.join(outDir, "captions.srt");
  const args = [
    "hyperframes",
    "transcribe",
    input,
    "--model",
    model,
    "--to",
    "srt",
    "--output",
    srtPath,
    "--json",
  ];
  if (language) args.push("--language", language);
  const { out } = await run("npx", args);
  let words = [];
  try {
    const jsonStart = out.indexOf("{") >= 0 ? out.indexOf("{") : out.indexOf("[");
    if (jsonStart >= 0) words = parseWords(JSON.parse(out.slice(jsonStart)));
  } catch {
    words = [];
  }
  return { srtPath, words, engine: "hyperframes" };
}

export async function captions(input, opts = {}) {
  const file = await mustExist(input);
  const outDir = path.resolve(opts.out || path.join(path.dirname(file), "cutlab-out"));
  await mkdir(outDir, { recursive: true });
  const model = opts.model || (opts.language ? "small" : "small.en");
  const srtPath = path.join(outDir, "captions.srt");
  let result = await ffmpegWhisper(file, { language: opts.language, srtPath });
  if (!result) {
    try {
      result = await hyperframesTranscribe(file, {
        model,
        language: opts.language,
        outDir,
      });
    } catch (err) {
      const wav = path.join(outDir, "speech.wav");
      await ffmpeg(["-y", "-i", file, "-vn", "-ac", "1", "-ar", "16000", wav]);
      throw new Error(
        `Auto-captions failed (${err.message}). FFmpeg extracted ${wav}. This FFmpeg build has a whisper filter — set CUTLAB_WHISPER_MODEL to a ggml file, or run:\n` +
          `  npx hyperframes transcribe "${file}" --model ${model} --to srt -o "${srtPath}"`,
      );
    }
  }
  if (result.words.length) {
    await writeFile(path.join(outDir, "words.json"), JSON.stringify(result.words, null, 2));
    if (!(await fileExists(result.srtPath))) {
      await writeFile(result.srtPath, wordsToSrt(result.words), "utf8");
    }
  }
  let cues = [];
  try {
    cues = parseSrt(await readFile(result.srtPath, "utf8"));
  } catch {
    cues = [];
  }
  if (!cues.length && result.words.length) {
    const srt = wordsToSrt(result.words);
    await writeFile(result.srtPath, srt, "utf8");
    cues = parseSrt(srt);
  }
  return {
    srt: result.srtPath,
    words: path.join(outDir, "words.json"),
    engine: result.engine,
    count: cues.length || result.words.length,
    cues,
  };
}

async function fileExists(p) {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

export async function burnCaptions(input, srt, output) {
  await mustExist(input);
  await mustExist(srt);
  const vf = `subtitles='${ffmpegPathForFilter(srt)}':force_style='Fontname=Arial,Fontsize=28,Outline=1.4,Shadow=0,Alignment=2,MarginV=48,PrimaryColour=&H00E8C36A,OutlineColour=&H80000000'`;
  await ffmpeg(["-y", "-i", input, "-vf", vf, ...H264_AAC, output]);
  return output;
}

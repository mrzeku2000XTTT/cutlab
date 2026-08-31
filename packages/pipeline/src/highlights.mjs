import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ffmpeg, probeMedia, mustExist } from "./ffmpeg.mjs";

function parseSilence(stderr) {
  const starts = [];
  const ends = [];
  for (const line of stderr.split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*([0-9.]+)/);
    const e = line.match(/silence_end:\s*([0-9.]+)/);
    if (s) starts.push(Number(s[1]));
    if (e) ends.push(Number(e[1]));
  }
  const ranges = [];
  const n = Math.min(starts.length, ends.length);
  for (let i = 0; i < n; i++) ranges.push({ start: starts[i], end: ends[i] });
  return ranges;
}

function parseScenes(stderr) {
  const times = [];
  for (const line of stderr.split(/\r?\n/)) {
    const m = line.match(/pts_time:([0-9.]+)/);
    if (m) times.push(Number(m[1]));
  }
  return times;
}

function parseMomentary(stderr) {
  const samples = [];
  for (const line of stderr.split(/\r?\n/)) {
    const m = line.match(/t:\s*([0-9.]+).*?\bM:\s*([-\d.]+)/);
    if (m) samples.push({ t: Number(m[1]), M: Number(m[2]) });
  }
  return samples;
}

function speechRatio(silences, start, end, duration) {
  let silent = 0;
  for (const s of silences) {
    const a = Math.max(start, s.start);
    const b = Math.min(end, s.end);
    if (b > a) silent += b - a;
  }
  const len = Math.max(0.001, Math.min(end, duration) - start);
  return 1 - Math.min(1, silent / len);
}

function meanLoudness(samples, start, end) {
  const hit = samples.filter((s) => s.t >= start && s.t < end);
  if (!hit.length) return -70;
  return hit.reduce((a, b) => a + b.M, 0) / hit.length;
}

function sceneHits(scenes, start, end) {
  return scenes.filter((t) => t >= start && t < end).length;
}

function mergeWindows(windows, gap = 0.6) {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const out = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end + gap) {
      last.end = Math.max(last.end, w.end);
      last.score = Math.max(last.score, w.score);
      last.reasons = [...new Set([...(last.reasons || []), ...(w.reasons || [])])];
    } else out.push({ ...w, reasons: [...(w.reasons || [])] });
  }
  return out;
}

async function optionalGrokRank(candidates, transcriptHint) {
  const key = process.env.XAI_API_KEY;
  if (!key || !candidates.length) return candidates;
  const body = {
    model: process.env.XAI_MODEL || "grok-4.5",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You rank video highlight windows for short-form virality. Return JSON only: {\"ranks\":[{\"id\":0,\"score\":0-100,\"why\":\"...\"}]}",
      },
      {
        role: "user",
        content: JSON.stringify({
          hint: transcriptHint || "",
          windows: candidates.map((c, i) => ({
            id: i,
            start: c.start,
            end: c.end,
            ffmpegScore: c.score,
            reasons: c.reasons,
          })),
        }),
      },
    ],
  };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return candidates;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text.slice(text.indexOf("{")));
    return candidates.map((c, i) => {
      const hit = (parsed.ranks || []).find((r) => r.id === i);
      if (!hit) return c;
      return {
        ...c,
        grok: hit.score,
        score: Number(c.score) + Number(hit.score) / 20,
        reasons: [...c.reasons, `grok:${hit.why || hit.score}`],
      };
    });
  } catch {
    return candidates;
  }
}

export async function highlights(input, opts = {}) {
  const file = await mustExist(input);
  const info = await probeMedia(file);
  const duration = info.duration;
  if (!duration) throw new Error("ffprobe returned no duration");

  const minLen = Number(opts.minLen || 6);
  const maxLen = Number(opts.maxLen || 24);
  const maxClips = Number(opts.max || 8);
  const hop = 2;
  const win = Math.max(minLen, 8);

  const silenceJob = ffmpeg([
    "-hide_banner",
    "-i",
    file,
    "-af",
    "silencedetect=n=-30dB:d=0.35",
    "-f",
    "null",
    "-",
  ]);
  const sceneJob = ffmpeg([
    "-hide_banner",
    "-i",
    file,
    "-vf",
    "select='gt(scene,0.28)',showinfo",
    "-f",
    "null",
    "-",
  ]);
  const loudJob = ffmpeg([
    "-hide_banner",
    "-i",
    file,
    "-filter_complex",
    "ebur128=peak=true:framelog=verbose",
    "-f",
    "null",
    "-",
  ]);

  const [sil, sc, lo] = await Promise.allSettled([silenceJob, sceneJob, loudJob]);
  const silences = sil.status === "fulfilled" ? parseSilence(sil.value.err) : [];
  const scenes = sc.status === "fulfilled" ? parseScenes(sc.value.err) : [];
  const momentary = lo.status === "fulfilled" ? parseMomentary(lo.value.err) : [];
  const medianM = momentary.length
    ? [...momentary].sort((a, b) => a.M - b.M)[Math.floor(momentary.length / 2)].M
    : -23;

  const raw = [];
  for (let t = 0; t + minLen <= duration; t += hop) {
    const start = t;
    const end = Math.min(duration, t + win);
    const speech = speechRatio(silences, start, end, duration);
    const cuts = sceneHits(scenes, start, end);
    const loud = meanLoudness(momentary, start, end);
    const reasons = [];
    let score = 0;
    if (speech > 0.35) {
      score += speech * 3;
      reasons.push(`speech:${speech.toFixed(2)}`);
    }
    if (cuts) {
      score += Math.min(6, cuts * 1.4);
      reasons.push(`cuts:${cuts}`);
    }
    if (loud > medianM) {
      const boost = Math.min(4, (loud - medianM) / 3);
      score += boost;
      reasons.push(`loud:${loud.toFixed(1)}LUFS`);
    }
    if (score >= 2.2) raw.push({ start, end, score, reasons, speech, cuts, loud });
  }

  const merged = mergeWindows(raw).map((w) => {
    const mid = (w.start + w.end) / 2;
    let start = Math.max(0, mid - maxLen / 2);
    let end = Math.min(duration, start + maxLen);
    if (end - start < minLen) {
      start = Math.max(0, end - minLen);
      end = Math.min(duration, start + minLen);
    }
    if (end - start > maxLen) end = start + maxLen;
    return { ...w, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) };
  });

  const ranked = (await optionalGrokRank(merged, opts.transcriptHint))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxClips)
    .sort((a, b) => a.start - b.start)
    .map((w, i) => ({ id: `h${i + 1}`, ...w }));

  const outDir = path.resolve(opts.outDir || path.join(path.dirname(file), "cutlab-out"));
  await mkdir(outDir, { recursive: true });
  const outPath = opts.out || path.join(outDir, "highlights.json");
  const payload = {
    source: path.resolve(file),
    duration,
    fps: info.fps,
    width: info.width,
    height: info.height,
    engine: "ffmpeg-silencedetect+scene+ebur128",
    grok: Boolean(process.env.XAI_API_KEY),
    clips: ranked,
  };
  await writeFile(outPath, JSON.stringify(payload, null, 2));
  return { ...payload, path: outPath };
}

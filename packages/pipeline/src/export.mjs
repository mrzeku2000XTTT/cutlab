import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { ffmpeg, ffprobe, H264_AAC, mustExist, probeMedia } from "./ffmpeg.mjs";

/**
 * Real MP4 export. Never canvas.captureStream().
 * Timeline JSON clips are cut with ffmpeg, then muxed H.264 + AAC +faststart.
 */
export async function exportTimeline(timelinePath, output, opts = {}) {
  const spec = JSON.parse(await readFile(timelinePath, "utf8"));
  const fps = Number(spec.fps || 30);
  const clips = [];
  for (const track of spec.tracks || []) {
    for (const c of track.clips || []) clips.push({ ...c, kind: track.kind || "video" });
  }
  if (spec.clips) clips.push(...spec.clips);
  const videoClips = clips.filter((c) => (c.kind || "video") !== "audio" && c.src);
  if (!videoClips.length) throw new Error("timeline has no video clips");

  const out = path.resolve(output);
  await mkdir(path.dirname(out), { recursive: true });
  const work = path.resolve(opts.work || path.join(path.dirname(out), ".cutlab-export"));
  await mkdir(work, { recursive: true });

  const parts = [];
  for (const [i, c] of videoClips.entries()) {
    const src = await mustExist(c.src);
    const part = path.join(work, `part-${String(i + 1).padStart(3, "0")}.mp4`);
    const start = Number(c.in ?? c.srcIn ?? 0);
    const end = c.out ?? c.srcOut;
    const args = ["-y", "-i", src];
    if (start) args.push("-ss", String(start));
    if (end != null) args.push("-to", String(end));
    args.push("-r", String(fps), ...H264_AAC, part);
    await ffmpeg(args);
    parts.push(part);
  }

  if (parts.length === 1) {
    await ffmpeg(["-y", "-i", parts[0], ...H264_AAC, out]);
  } else {
    const list = path.join(work, "concat.txt");
    await writeFile(
      list,
      parts.map((p) => `file '${p.replaceAll("\\", "/")}'`).join("\n"),
    );
    await ffmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      ...H264_AAC,
      out,
    ]);
  }

  const { out: probe } = await ffprobe(["-hide_banner", out]);
  const info = await probeMedia(out);
  if (!info.duration || !info.vcodec) {
    throw new Error(`export wrote a file but ffprobe looks empty:\n${probe}`);
  }
  return { file: out, info, probe };
}

export async function exportSingle(input, output) {
  await mustExist(input);
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await ffmpeg(["-y", "-i", input, ...H264_AAC, output]);
  return probeMedia(output);
}

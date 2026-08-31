import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ffmpeg, H264_AAC, mustExist } from "./ffmpeg.mjs";

export async function cutClips(input, highlightsFile, opts = {}) {
  const file = await mustExist(input);
  const spec = JSON.parse(await readFile(highlightsFile, "utf8"));
  const clips = spec.clips || spec.windows || [];
  if (!clips.length) throw new Error("No clips in highlights JSON");
  const outDir = path.resolve(opts.outdir || path.join(path.dirname(file), "cutlab-out", "clips"));
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const [i, c] of clips.entries()) {
    const start = Number(c.start);
    const end = Number(c.end);
    const id = c.id || `clip-${String(i + 1).padStart(2, "0")}`;
    const out = path.join(outDir, `${id}.mp4`);
    await ffmpeg([
      "-y",
      "-i",
      file,
      "-ss",
      String(start),
      "-to",
      String(end),
      ...H264_AAC,
      out,
    ]);
    written.push({ id, start, end, file: out });
  }
  return { outDir, clips: written };
}

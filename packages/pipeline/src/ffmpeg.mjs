import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

export function run(cmd, args, { cwd } = {}) {
  const shell =
    process.platform === "win32" && ["npx", "npm", "gh"].includes(cmd);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      err += d.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(" ")} exited ${code}\n${err.slice(-6000)}`));
        return;
      }
      resolve({ out, err, code });
    });
  });
}

export function ffmpeg(args, opts) {
  return run("ffmpeg", args, opts);
}

export function ffprobe(args, opts) {
  return run("ffprobe", args, opts);
}

export async function which(bin) {
  try {
    const { out } = await run(process.platform === "win32" ? "where" : "which", [bin]);
    return out.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

export async function probeMedia(file) {
  const { out } = await ffprobe([
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const json = JSON.parse(out);
  const video = (json.streams || []).find((s) => s.codec_type === "video");
  const audio = (json.streams || []).find((s) => s.codec_type === "audio");
  const duration = Number(json.format?.duration || video?.duration || 0);
  const fps = video?.r_frame_rate ? Number(evalRatio(video.r_frame_rate)) : 30;
  return {
    duration,
    fps,
    width: Number(video?.width || 0),
    height: Number(video?.height || 0),
    vcodec: video?.codec_name || null,
    acodec: audio?.codec_name || null,
    format: json.format?.format_name || null,
  };
}

function evalRatio(ratio) {
  const [a, b] = String(ratio).split("/").map(Number);
  if (!b) return a || 30;
  return a / b;
}

export function ffmpegPathForFilter(file) {
  return path
    .resolve(file)
    .replaceAll("\\", "/")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'");
}

export async function mustExist(file) {
  await access(file);
  return file;
}

export const H264_AAC = [
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
];

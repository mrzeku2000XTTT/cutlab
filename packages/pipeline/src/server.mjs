import http from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captions, burnCaptions, cuesToSrt } from "./captions.mjs";
import { highlights } from "./highlights.mjs";
import { cutClips } from "./clips.mjs";
import { exportTimeline, exportSingle } from "./export.mjs";
import { listShaders } from "./shaders.mjs";
import { probeMedia } from "./ffmpeg.mjs";
import { parseMultipart } from "./multipart.mjs";
import { sendFile, mediaType } from "./media.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB = path.join(ROOT, "apps/web");
const WORK = path.join(ROOT, "work");
const PORT = Number(process.env.CUTLAB_PORT || 4174);
const media = new Map();

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readRaw(req);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

function resolveMedia(id) {
  const item = media.get(id);
  if (!item) throw new Error(`unknown media ${id}`);
  return item;
}

async function saveUpload(filename, data) {
  await mkdir(WORK, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const ext = path.extname(filename || "").toLowerCase() || ".mp4";
  const file = path.join(WORK, `${id}${ext}`);
  await writeFile(file, data);
  const info = await probeMedia(file);
  const item = {
    id,
    name: path.basename(filename || file),
    file,
    url: `/media/${id}`,
    probe: info,
  };
  media.set(id, item);
  return item;
}

const OVERLAYS = [
  { id: "title-sting", name: "Title sting", duration: 4, src: "/overlays/title-sting.html" },
  { id: "captions", name: "Caption card", duration: 3, src: "/overlays/captions.html" },
  { id: "highlight-sting", name: "Viral hit", duration: 3, src: "/overlays/highlight-sting.html" },
];

function mimeStatic(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return mediaType(file);
}

async function handleExport(body) {
  const item = resolveMedia(body.mediaId);
  await mkdir(WORK, { recursive: true });
  const out = path.join(WORK, `${item.id}-export.mp4`);
  const cues = body.cues || [];
  if (cues.length) {
    const srt = path.join(WORK, `${item.id}-export.srt`);
    await writeFile(srt, cuesToSrt(cues), "utf8");
    await burnCaptions(item.file, srt, out);
  } else {
    await exportSingle(item.file, out);
  }
  const exportId = `${item.id}-export`;
  media.set(exportId, {
    id: exportId,
    name: `${item.name.replace(/\.[^.]+$/, "")}-cutlab.mp4`,
    file: out,
    url: `/media/${exportId}`,
    probe: await probeMedia(out),
  });
  return { id: exportId, url: `/media/${exportId}`, probe: media.get(exportId).probe };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      json(res, 200, { ok: true, name: "cutlab", app: true, port: PORT });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/overlays") {
      json(res, 200, { overlays: OVERLAYS });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/shaders") {
      json(res, 200, await listShaders());
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/upload") {
      const raw = await readRaw(req);
      const { files } = parseMultipart(raw, req.headers["content-type"]);
      const file = files.find((f) => f.name === "file") || files[0];
      if (!file) throw new Error("no file in upload");
      json(res, 200, await saveUpload(file.filename, file.data));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/open") {
      const body = await readJson(req);
      const src = body.file;
      if (!src || !existsSync(src)) throw new Error("file not found");
      const data = await readFile(src);
      json(res, 200, await saveUpload(path.basename(src), data));
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      const id = url.pathname.slice("/media/".length);
      sendFile(req, res, resolveMedia(id).file);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/captions") {
      const body = await readJson(req);
      const item = resolveMedia(body.mediaId);
      const outDir = path.join(WORK, item.id);
      const result = await captions(item.file, { ...body, out: outDir });
      json(res, 200, result);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/highlights") {
      const body = await readJson(req);
      const item = resolveMedia(body.mediaId);
      const outDir = path.join(WORK, item.id);
      json(res, 200, await highlights(item.file, { ...body, outDir, out: path.join(outDir, "highlights.json") }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/clips") {
      const body = await readJson(req);
      const item = resolveMedia(body.mediaId);
      const from = body.from || path.join(WORK, item.id, "highlights.json");
      const outdir = path.join(WORK, item.id, "clips");
      const result = await cutClips(item.file, from, { outdir });
      const saved = [];
      for (const c of result.clips) {
        const clip = await saveUpload(path.basename(c.file), await readFile(c.file));
        saved.push({ ...c, mediaId: clip.id, url: clip.url, probe: clip.probe });
      }
      json(res, 200, { ...result, clips: saved });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/export") {
      const body = await readJson(req);
      if (body.timeline && !body.mediaId) {
        json(res, 200, await exportTimeline(body.timeline, body.out));
        return;
      }
      json(res, 200, await handleExport(body));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/probe") {
      const body = await readJson(req);
      if (body.mediaId) json(res, 200, resolveMedia(body.mediaId).probe);
      else json(res, 200, await probeMedia(body.file));
      return;
    }

    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = path.join(WEB, path.normalize(file).replace(/^[/\\]+/, ""));
    if (!full.startsWith(WEB)) {
      json(res, 403, { error: "bad path" });
      return;
    }
    const html = await readFile(full);
    res.writeHead(200, { "Content-Type": mimeStatic(full), "Cache-Control": "no-store" });
    res.end(html);
  } catch (err) {
    json(res, 500, { error: String(err.message || err) });
  }
});

await mkdir(WORK, { recursive: true });
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cutlab editor  http://127.0.0.1:${PORT}`);
  console.log("Our app. HyperFrames is the overlay engine, not the UI.");
});

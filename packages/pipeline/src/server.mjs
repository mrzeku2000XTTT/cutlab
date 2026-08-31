import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captions, burnCaptions } from "./captions.mjs";
import { highlights } from "./highlights.mjs";
import { cutClips } from "./clips.mjs";
import { exportTimeline, exportSingle } from "./export.mjs";
import { listShaders } from "./shaders.mjs";
import { probeMedia } from "./ffmpeg.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB = path.join(ROOT, "apps/web");
const PORT = Number(process.env.CUTLAB_PORT || 4174);

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
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
      json(res, 200, { ok: true, name: "cutlab", port: PORT });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/shaders") {
      json(res, 200, await listShaders());
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/probe") {
      const body = await readBody(req);
      json(res, 200, await probeMedia(body.file));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/captions") {
      const body = await readBody(req);
      json(res, 200, await captions(body.file, body));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/burn") {
      const body = await readBody(req);
      json(res, 200, { file: await burnCaptions(body.file, body.srt, body.out) });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/highlights") {
      const body = await readBody(req);
      json(res, 200, await highlights(body.file, body));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/clips") {
      const body = await readBody(req);
      json(res, 200, await cutClips(body.file, body.from, body));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/export") {
      const body = await readBody(req);
      if (body.timeline) json(res, 200, await exportTimeline(body.timeline, body.out, body));
      else json(res, 200, await exportSingle(body.file, body.out));
      return;
    }

    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = path.join(WEB, path.normalize(file).replace(/^[/\\]+/, ""));
    if (!full.startsWith(WEB)) {
      json(res, 403, { error: "bad path" });
      return;
    }
    const html = await readFile(full);
    res.writeHead(200, { "Content-Type": mime(full) });
    res.end(html);
  } catch (err) {
    json(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cutlab pipeline UI  http://127.0.0.1:${PORT}`);
  console.log("Local files only. Pass absolute paths. Real ffmpeg export.");
});

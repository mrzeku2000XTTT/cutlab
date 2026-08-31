import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".srt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export function mediaType(file) {
  return TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

export function sendFile(req, res, filePath) {
  const st = statSync(filePath);
  const type = mediaType(filePath);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) {
      res.writeHead(416);
      res.end();
      return;
    }
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : st.size - 1;
    if (start >= st.size || end >= st.size) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${st.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": type,
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    "Content-Length": st.size,
    "Accept-Ranges": "bytes",
    "Content-Type": type,
  });
  createReadStream(filePath).pipe(res);
}

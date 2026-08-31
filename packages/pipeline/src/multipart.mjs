export function parseMultipart(buf, contentType) {
  const m = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!m) throw new Error("multipart: missing boundary");
  const boundary = (m[1] || m[2]).trim();
  const sep = Buffer.from(`--${boundary}`);
  const files = [];
  const fields = {};
  let pos = 0;
  while (pos < buf.length) {
    const start = buf.indexOf(sep, pos);
    if (start < 0) break;
    pos = start + sep.length;
    if (buf.slice(pos, pos + 2).toString("ascii") === "--") break;
    if (buf[pos] === 13 && buf[pos + 1] === 10) pos += 2;
    const headerEnd = buf.indexOf(Buffer.from("\r\n\r\n"), pos);
    if (headerEnd < 0) break;
    const headers = buf.slice(pos, headerEnd).toString("utf8");
    const next = buf.indexOf(sep, headerEnd + 4);
    let end = next < 0 ? buf.length : next;
    if (end >= 2 && buf[end - 2] === 13 && buf[end - 1] === 10) end -= 2;
    const body = buf.slice(headerEnd + 4, end);
    const name = /name="([^"]+)"/.exec(headers)?.[1];
    const filename = /filename\*?=(?:UTF-8''|")(.*?)(?:";|$)/i.exec(headers)?.[1];
    const fname = filename ? decodeURIComponent(filename.replace(/"$/, "")) : null;
    if (name && fname) files.push({ name, filename: fname, data: body });
    else if (name) fields[name] = body.toString("utf8");
    pos = next < 0 ? buf.length : next;
  }
  return { files, fields };
}

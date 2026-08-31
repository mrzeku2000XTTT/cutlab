const $ = (s) => document.querySelector(s);
const state = {
  media: null,
  duration: 12,
  playhead: 0,
  playing: false,
  px: 80,
  captions: [],
  highlights: [],
  overlays: [],
  overlayLib: [],
};

const video = $("#preview");
const overlay = $("#overlay");
const cueEl = $("#cue");
const playheadEl = $("#playhead");
const logEl = $("#log");

function log(msg, cls) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.prepend(line);
}

function fmt(t) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * 30);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

async function api(path, body, isFile) {
  const res = await fetch(path, isFile ? body : {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function xOf(t) {
  return t * state.px;
}
function tOf(x) {
  return Math.max(0, Math.min(state.duration, x / state.px));
}

function setPlayhead(t, fromVideo) {
  state.playhead = Math.max(0, Math.min(state.duration, t));
  $("#tc").textContent = fmt(state.playhead);
  playheadEl.style.left = `${88 + xOf(state.playhead)}px`;
  if (!fromVideo && video.src) video.currentTime = state.playhead;
  const cap = state.captions.find((c) => state.playhead >= c.start && state.playhead <= c.end);
  cueEl.textContent = cap ? cap.text : "";
  cueEl.classList.toggle("hidden", !cap);
  const gfx = state.overlays.find((o) => state.playhead >= o.start && state.playhead < o.start + o.duration);
  if (gfx) {
    if (overlay.dataset.id !== gfx.id) {
      overlay.dataset.id = gfx.id;
      overlay.src = gfx.src;
    }
    overlay.classList.remove("hidden");
    const local = state.playhead - gfx.start;
    overlay.contentWindow?.postMessage({ type: "cutlab-seek", t: local }, "*");
  } else {
    overlay.classList.add("hidden");
  }
}

function renderRuler() {
  const ticks = $("#ticks");
  ticks.innerHTML = "";
  const w = Math.max($(".lane")?.clientWidth || 800, state.duration * state.px + 40);
  document.querySelectorAll(".lane").forEach((l) => { l.style.minWidth = `${w}px`; });
  $("#ruler-inner").style.minWidth = `${w}px`;
  for (let t = 0; t <= state.duration + 0.01; t += 1) {
    const el = document.createElement("div");
    el.className = "tick";
    el.style.left = `${xOf(t)}px`;
    el.textContent = fmt(t).slice(0, 5);
    ticks.appendChild(el);
  }
}

function clipEl(cls, start, dur, label) {
  const el = document.createElement("div");
  el.className = `clip ${cls}`;
  el.style.left = `${xOf(start)}px`;
  el.style.width = `${Math.max(8, xOf(dur))}px`;
  el.textContent = label;
  return el;
}

function renderClips() {
  const v = $("#lane-v");
  const c = $("#lane-c");
  const g = $("#lane-g");
  const h = $("#lane-h");
  v.innerHTML = "";
  c.innerHTML = "";
  g.innerHTML = "";
  h.innerHTML = "";
  if (state.media) v.appendChild(clipEl("v", 0, state.duration, state.media.name));
  state.captions.forEach((cap) => c.appendChild(clipEl("c", cap.start, cap.end - cap.start, cap.text)));
  state.overlays.forEach((o) => g.appendChild(clipEl("g", o.start, o.duration, o.name)));
  state.highlights.forEach((hi) => h.appendChild(clipEl("h", hi.start, hi.end - hi.start, hi.id || "hit")));
  setPlayhead(state.playhead, true);
}

function renderBin() {
  const box = $("#bin");
  box.innerHTML = "";
  if (state.media) {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<b>${state.media.name}</b><span>${state.media.probe?.width || "?"}×${state.media.probe?.height || "?"} · ${fmt(state.duration)}</span>`;
    box.appendChild(el);
  }
  state.overlayLib.forEach((o) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<b>${o.name}</b><span>Motion overlay · ${o.duration}s</span>`;
    el.onclick = () => addOverlay(o);
    box.appendChild(el);
  });
}

function addOverlay(o) {
  state.overlays.push({
    ...o,
    start: state.playhead,
  });
  renderClips();
  log(`Added ${o.name} at ${fmt(state.playhead)}`);
}

function loadMedia(item) {
  state.media = item;
  state.duration = Number(item.probe?.duration || 12);
  state.captions = [];
  state.highlights = [];
  state.overlays = [];
  video.src = item.url;
  video.load();
  $("#status").textContent = item.name;
  renderBin();
  renderRuler();
  renderClips();
  setPlayhead(0);
  log(`Imported ${item.name} (${item.probe?.vcodec}/${item.probe?.acodec})`);
}

async function importFile(file) {
  log(`Uploading ${file.name}…`);
  const fd = new FormData();
  fd.append("file", file);
  const item = await api("/api/upload", { method: "POST", body: fd }, true);
  loadMedia(item);
}

async function autoCaptions() {
  if (!state.media) throw new Error("import a video first");
  log("Auto captions… Whisper / HyperFrames transcribe / FFmpeg whisper");
  const r = await api("/api/captions", { mediaId: state.media.id });
  state.captions = r.cues || [];
  renderClips();
  log(`Captions: ${state.captions.length} cues (${r.engine})`, "ok");
}

async function autoHighlights() {
  if (!state.media) throw new Error("import a video first");
  log("Detecting viral windows (ffmpeg silence + scene + loudness)…");
  const r = await api("/api/highlights", { mediaId: state.media.id, max: 8 });
  state.highlights = r.clips || [];
  renderClips();
  log(`Highlights: ${state.highlights.length} windows`, "ok");
}

async function cutHighlights() {
  if (!state.media) throw new Error("import a video first");
  if (!state.highlights.length) await autoHighlights();
  log("Cutting highlight clips with ffmpeg…");
  const r = await api("/api/clips", { mediaId: state.media.id });
  log(`Wrote ${r.clips.length} MP4 clips`, "ok");
  r.clips.forEach((c) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<b>${c.id}</b><span>clip · ${fmt(c.end - c.start)}</span>`;
    $("#bin").appendChild(el);
  });
}

async function exportMp4() {
  if (!state.media) throw new Error("import a video first");
  log("Export H.264 + AAC +faststart…");
  const r = await api("/api/export", { mediaId: state.media.id, cues: state.captions });
  log(`Export ready ${r.probe?.vcodec} ${r.probe?.duration?.toFixed?.(2)}s`, "ok");
  const a = document.createElement("a");
  a.href = r.url;
  a.download = r.id + ".mp4";
  a.click();
}

function playToggle() {
  if (!video.src) return;
  if (video.paused) {
    video.play();
    $("#play").textContent = "❚❚";
  } else {
    video.pause();
    $("#play").textContent = "▶";
  }
}

video.addEventListener("timeupdate", () => setPlayhead(video.currentTime, true));
video.addEventListener("loadedmetadata", () => {
  if (video.duration && isFinite(video.duration)) {
    state.duration = video.duration;
    renderRuler();
    renderClips();
  }
});
video.addEventListener("play", () => { $("#play").textContent = "❚❚"; });
video.addEventListener("pause", () => { $("#play").textContent = "▶"; });
video.addEventListener("ended", () => { $("#play").textContent = "▶"; });
overlay.addEventListener("load", () => {
  const gfx = state.overlays.find((o) => o.id === overlay.dataset.id);
  if (!gfx) return;
  overlay.contentWindow?.postMessage({ type: "cutlab-seek", t: Math.max(0, state.playhead - gfx.start) }, "*");
});

function bindScrub(el) {
  const hit = (e) => {
    const lane = el.querySelector(".lane") || el.querySelector("#ruler-inner") || el;
    const x = e.clientX - lane.getBoundingClientRect().left;
    setPlayhead(tOf(x));
  };
  el.addEventListener("mousedown", (e) => {
    hit(e);
    const move = (ev) => hit(ev);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", () => window.removeEventListener("mousemove", move), { once: true });
  });
}

bindScrub($("#ruler"));
bindScrub($("#tracks"));

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input")) return;
  if (e.code === "Space") { e.preventDefault(); playToggle(); }
  if (e.code === "Home") setPlayhead(0);
});

$("#import").onclick = () => $("#file").click();
$("#file").onchange = () => {
  const f = $("#file").files?.[0];
  if (f) importFile(f).catch((err) => log(err.message, "bad"));
};
$("#play").onclick = playToggle;
$("#captions").onclick = () => autoCaptions().catch((err) => log(err.message, "bad"));
$("#highlights").onclick = () => autoHighlights().catch((err) => log(err.message, "bad"));
$("#clips").onclick = () => cutHighlights().catch((err) => log(err.message, "bad"));
$("#export").onclick = () => exportMp4().catch((err) => log(err.message, "bad"));
$("#go").onclick = () => runPrompt($("#prompt").value);
$("#prompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter") runPrompt($("#prompt").value);
});

async function runPrompt(text) {
  const q = (text || "").trim();
  if (!q) return;
  $("#prompt").value = "";
  log(`AI: ${q}`);
  const t = q.toLowerCase();
  try {
    if (t.includes("caption") || t.includes("subtitle")) await autoCaptions();
    else if (t.includes("highlight") || t.includes("viral")) await autoHighlights();
    else if (t.includes("clip")) await cutHighlights();
    else if (t.includes("export") || t.includes("mp4")) await exportMp4();
    else if (t.includes("title") || t.includes("sting")) {
      const o = state.overlayLib.find((x) => x.id === "title-sting");
      if (o) addOverlay(o);
    } else if (t.includes("hit") || t.includes("shader")) {
      const o = state.overlayLib.find((x) => x.id === "highlight-sting");
      if (o) addOverlay(o);
    } else log("Try: add captions · find highlights · cut clips · add title sting · export");
  } catch (err) {
    log(err.message, "bad");
  }
}

fetch("/api/overlays")
  .then((r) => r.json())
  .then((d) => {
    state.overlayLib = d.overlays || [];
    renderBin();
  })
  .catch(() => {});

log("Cutlab editor. Import a video. HyperFrames overlays live on the graphics track — this is not Studio.");
renderRuler();
renderClips();
setPlayhead(0);

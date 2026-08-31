# Cutlab

Open-source **AI video editor** — timeline, motion graphics, auto captions, viral highlights, real MP4.

This is not a fake Export button. Preview and export share **timeline JSON**. Bytes on disk are **H.264 + AAC** with `+faststart`.

## Stack

| Layer | Engine | Where |
|---|---|---|
| Motion graphics | **HyperFrames** (HTML + seekable GSAP + shaders) | `packages/motion` |
| Chat / shaders / Remotion MP4 | **OpenChatCut** (AGPL) | `vendor/openchatcut` |
| Desktop NLE + ffmpeg mux + Whisper | **Frontstage** (GPL-3) | `vendor/frontstage` |
| Browser WebCodecs MP4 | **WebAV** (MIT) | `vendor/webav` |
| Captions / highlights / clips / mux | **native FFmpeg 9** + HyperFrames transcribe | `packages/pipeline` |

You log in. The agent forks Frontstage, OpenChatCut, and WebAV under your GitHub. See [FORK.md](FORK.md).

## One-time

```powershell
gh auth login -h github.com -p https -w
cd C:\Users\mrzek\cutlab
.\scripts\login-and-fork.ps1
.\scripts\vendor.ps1
npm run doctor
```

## Pipeline (works now, no GitHub required)

Needs `ffmpeg` / `ffprobe` on PATH (this machine has FFmpeg 9).

```powershell
npm run pipeline -- take.mp4
npm run dev
```

- Auto captions → Whisper/Parakeet via `hyperframes transcribe`, then optional `burn`
- Viral highlights → ffmpeg silence + scene cuts + loudness, optional Grok rank (`XAI_API_KEY`)
- Clips → ffmpeg cut to playable MP4
- Export → `libx264 -crf 18 -c:a aac -movflags +faststart`

## Motion pack

```powershell
cd packages/motion
npm run check
npm run dev
```

## Site

Open `index.html`, or `npx --yes serve .`

## License

MIT for Cutlab (`packages/*`, site). Vendor forks keep **GPL-3 / AGPL**. Do not relicense them.

# Cutlab

Open-source **AI video editor** research + landing site.

Goal: a real non-linear editor — **multi-track timeline**, **preview that matches the cut**, **export to a playable H.264/AAC MP4** — with an AI agent that edits the **same timeline JSON** you do.

This repo is the public map. We do **not** invent a fake “Export MP4” button. Real export is either:

1. **FFmpeg** (desktop/server) muxing compositor frames + mixed audio, or
2. **WebCodecs + mp4box** (browser) encoding `VideoFrame`s and AAC/Opus into an MP4, not `canvas.captureStream()`.

## Site

Open `index.html` locally, or deploy the folder to Vercel / GitHub Pages.

- [Repos we surveyed](REPOS.md) (US + CN)
- [Architecture](ARCHITECTURE.md)

## What to fork first (working product, not a demo)

| Priority | Repo | Why |
|---|---|---|
| 1 | [x777/frontstage](https://github.com/x777/frontstage) | Real timeline + **ffmpeg MP4** + AI agent + MCP |
| 2 | [0xsline/OpenChatCut](https://github.com/0xsline/OpenChatCut) | Chat + multi-track + **Remotion MP4** |
| 3 | [OpenCut-app/opencut-classic](https://github.com/OpenCut-app/opencut-classic) | CapCut-like UI; current OpenCut **main is a rewrite** |
| 4 | [WebAV-Tech/WebAV](https://github.com/WebAV-Tech/WebAV) + [Li-vien/CcClip](https://github.com/Li-vien/CcClip) | Chinese WebCodecs SDK + Vue timeline |

**Do not start from** pyJianYingDraft if you need an independent renderer. That writes **剪映 drafts**; Jianying itself exports the MP4.

## Local

```bash
npx --yes serve .
```

## Push to GitHub

```bash
gh auth login
cd cutlab
git init
git add .
git commit -m "Cutlab: map of working open-source AI NLEs"
gh repo create cutlab --public --source=. --remote=origin --push
```

## License

MIT

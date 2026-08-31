# Repos (timeline + render + MP4)

Surveyed 2026-08-31. **MP4** here means a file other players open (H.264 + AAC, `+faststart`), not a WebM renamed `.mp4`.

## Tier A — timeline AND a real MP4 path

| Project | Lang | Timeline | MP4 path | AI | Notes |
|---|---|---|---|---|---|
| [x777/frontstage](https://github.com/x777/frontstage) | TS, GPL-3 | Multi-track, razor, keyframes | Local **ffmpeg** mux of compositor frames | Agent + MCP, Whisper on-device | Best “editor + AI on the same timeline” |
| [0xsline/OpenChatCut](https://github.com/0xsline/OpenChatCut) | TS, AGPL | Multi-track, ripple, keyframes | **Remotion** render → MP4 | Conversational agent, Skills, MCP | ChatCut-style; local-first |
| [chatman-media/timeline-studio](https://github.com/chatman-media/timeline-studio) | TS/Rust, Tauri | Timeline + AI | FFmpeg compiler | Social automation | Needs FFmpeg + Bun |
| [ucsandman/Magnetic](https://github.com/ucsandman/Magnetic) | MIT, Windows | Magnetic FCP-style | Bundled ffmpeg, H.264/AAC 1080p | Transcript edit, silence remove | Smart-render stream-copy when untouched |
| [jonesphillip/proj](https://github.com/jonesphillip/proj) | Self-hosted | Trim/split/speed/captions | Server **FFmpeg filter graph** | No | Honest local export |
| [opencodewin/MediaEditor](https://github.com/opencodewin/MediaEditor) | C++ NLE | Full NLE timeline | ProRes/H.264/H.265/MP4 | Super-res / face / AIGC listed | Heavy native app |
| [OpenCut-app/opencut-classic](https://github.com/OpenCut-app/opencut-classic) | Next.js | Multi-track | WebCodecs MP4 (browser-dependent AAC) | fal.ai sponsor | **Use classic, not current main rewrite** |

## Tier B — Chinese / 剪映 orbit (useful, different job)

| Project | What it actually does | MP4? |
|---|---|---|
| [WebAV-Tech/WebAV](https://github.com/WebAV-Tech/WebAV) 风痕 | WebCodecs SDK: sprites → Combinator.output() MP4 | **Yes (library)** |
| [Li-vien/CcClip](https://github.com/Li-vien/CcClip) | Vue3 + ffmpeg.wasm, 多轨道时间轴 | Browser FFmpeg, quality varies |
| [caohongz/yifang-clip](https://github.com/caohongz/yifang-clip) 一方云剪 | WebAV + OPFS, multi-track, preview [demo](https://caohongz.github.io/yifang-clip/) | Via WebAV combinator |
| [hughfenghen/dimcut](https://github.com/hughfenghen/dimcut) | 二维时间轴 + 文字轨 [demo](https://fenghen.me/dimcut) | Knowledge-video cuts |
| [aoguai/pyJianYingDraft](https://github.com/aoguai/pyJianYingDraft) | Python **writes 剪映草稿** | Export is **Jianying**, not this repo |
| [isYangs/jianying-editor-skill](https://github.com/isYangs/jianying-editor-skill) | Agent drives 剪映专业版 | Needs installed Jianying ≤5.9 for auto export |
| [sun-guannan/VectCutAPI](https://github.com/sun-guannan/VectCutAPI) | Cloud API → Jianying/CapCut drafts | Cloud, not local NLE |
| [ArcReel/ArcReel](https://github.com/ArcReel/ArcReel) | Novel → storyboard → 剪映草稿 | Same: Jianying for finish |
| [GML-MMGroup/ClipTalk](https://github.com/GML-MMGroup/ClipTalk) | Talk-to-edit agent, timeline added 2026-08 | Agent-first, check export in repo |
| [xixihhhh/hotclip](https://github.com/xixihhhh/hotclip) | Local Opus-Clip: highlights → 9:16 | FFmpeg shorts, not a full NLE |
| [starboom/kbcut](https://github.com/starboom/kbcut) | 口播 skills + FFmpeg + HyperFrames wrap | Pipeline, not a GUI timeline |
| [JeffMony/AV_Library](https://github.com/JeffMony/AV_Library) | “从0做剪映” MediaCodec/FFmpeg notes | Tutorial, not a product |

## Tier C — AI clip generators (not NLEs)

[mutonby/openshorts](https://github.com/mutonby/openshorts), [Anil-matcha/AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator), [MartinDelophy/ai-video-editor](https://github.com/MartinDelophy/ai-video-editor) (browser AI + timeline — verify MP4 mux before betting the product on it).

## Mature NLEs (not AI, but real export)

[mltframework/shotcut](https://github.com/mltframework/shotcut), [OpenShot/openshot-qt](https://github.com/OpenShot/openshot-qt), [KDE/kdenlive](https://invent.kde.org/multimedia/kdenlive), [mifi/lossless-cut](https://github.com/mifi/lossless-cut) (lossless cut, not compositing).

## Traps

1. **OpenCut current `main`** is a ground-up rewrite. Today’s runnable editor is **opencut-classic**. Browser MP4+AAC still fails on some Linux/Firefox encoder configs.
2. **`canvas.captureStream()` + MediaRecorder** is not a correct NLE export (wrong fps, no A/V sync, WebM).
3. **剪映 draft generators** are valid for CN creators who already have Jianying. They are not an open renderer.
4. **Remotion** is a real renderer (Chromium frame dump → ffmpeg). Heavy, but honest MP4.
5. **ffmpeg.wasm** works for short clips; long 1080p timelines belong on **native ffmpeg**.

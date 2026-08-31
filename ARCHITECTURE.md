# Architecture (do this or the MP4 will be fake)

```
User / AI agent
    ↓  same commands
Timeline JSON  (tracks, clips, in/out, keyframes, captions, fx)
    ↓
Preview compositor
    • HyperFrames overlays (motion / captions / stings)
    • OpenChatCut WebGL .frag (AGPL) or Frontstage engine
    ↓
Export  (never canvas.captureStream)
    Video: compositor frames or ffmpeg trim → H.264
    Audio: mix PCM → AAC
    Mux:  ffmpeg -movflags +faststart → out.mp4
```

## Engines (forked after you login)

1. **Frontstage** — Electron NLE. `runExport` + `FfmpegIpcSink` muxes compositor frames with local ffmpeg. On-device Whisper. GPL-3.
2. **OpenChatCut** — chat agent + multi-track + **Remotion** `renderMedia` (Chromium → ffmpeg). `src/gl/fx/*.frag` clip shaders, `src/gl/shaders/*.frag` transitions. AGPL.
3. **WebAV** — `Combinator.output()` WebCodecs MP4 in the browser. MIT.
4. **HyperFrames** — HTML compositions, seekable GSAP, GLSL canvas, `npx hyperframes render` → MP4. Used for Cutlab motion overlays.

## Captions

```
video → hyperframes transcribe (Parakeet / whisper.cpp)
     → words.json + captions.srt
     → timeline caption track  OR  ffmpeg subtitles= burn
```

Frontstage `add_captions` and OpenChatCut native-asr are the GUI paths after the forks land.

## Viral highlights + clips

```
ffmpeg silencedetect     speech vs gap
ffmpeg select=gt(scene)  cuts
ffmpeg ebur128           momentary loudness
optional grok-4.5        rank windows if XAI_API_KEY is set
ffmpeg -ss -to           write clip_N.mp4  (H.264/AAC)
```

This is an honest detector, not a trained virality model. Grok ranking is extra.

## Timeline JSON (minimum)

```json
{
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "tracks": [
    {
      "id": "v1",
      "kind": "video",
      "clips": [
        { "id": "c1", "src": "assets/a.mp4", "in": 0, "out": 4.2, "start": 0 }
      ]
    }
  ]
}
```

The agent only mutates this document. Preview and export both read it.

## What we will not do

- Ship an Export button that records the preview canvas.
- Depend on 剪映 being installed unless that is an explicit CN export target.
- Wait for OpenCut’s rewrite to finish before having a working fork (classic or Frontstage).
- Relicense GPL/AGPL vendor trees as MIT.

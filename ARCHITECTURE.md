# Architecture (do this or the MP4 will be fake)

```
User / AI agent
    ↓  same commands
Timeline JSON  (tracks, clips, in/out, keyframes)
    ↓
Preview compositor  (WebCodecs or WebGL, 1:1 with export)
    ↓
Export
    Video: encode VideoFrame (or PNG sequence) → H.264
    Audio: mix PCM → AAC
    Mux: ffmpeg -movflags +faststart → out.mp4
```

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

The agent only mutates this document. Preview and export both read it. No second “AI timeline”.

## Export that actually plays

Desktop (preferred):

```bash
ffmpeg -y -framerate 30 -i frames/%06d.png -i mix.wav \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 \
  -c:a aac -b:a 192k -movflags +faststart out.mp4
```

Browser: WebAV `Combinator.output()` or WebCodecs VideoEncoder + mp4box.js. Test the file in VLC, not only `<video>`.

## AI layer

Whisper → transcript aligned to clips. Agent tools: split, trim, ripple, caption, duck. MCP optional (Frontstage / OpenChatCut already have this).

## What we will not do

- Ship an Export button that records the preview canvas.
- Depend on 剪映 being installed unless that is an explicit CN export target.
- Wait for OpenCut’s rewrite to finish before having a working fork (classic or Frontstage).

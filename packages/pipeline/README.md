# @cutlab/pipeline

Real FFmpeg path. Same timeline JSON for preview intent and export.

```bash
node packages/pipeline/src/cli.mjs doctor
node packages/pipeline/src/cli.mjs pipeline take.mp4
node packages/pipeline/src/cli.mjs captions take.mp4 --out cutlab-out
node packages/pipeline/src/cli.mjs highlights take.mp4 --max 8
node packages/pipeline/src/cli.mjs clips take.mp4 --from cutlab-out/highlights.json
node packages/pipeline/src/cli.mjs burn take.mp4 --srt cutlab-out/captions.srt --out take-captioned.mp4
node packages/pipeline/src/cli.mjs export --timeline timeline.json --out out.mp4
node packages/pipeline/src/cli.mjs serve
```

## What each command actually does

| Command | Engine |
|---|---|
| `captions` | `npx hyperframes transcribe` (Parakeet or whisper.cpp) → SRT + words.json |
| `highlights` | ffmpeg `silencedetect` + scene detect + ebur128. Optional Grok rank if `XAI_API_KEY` is set |
| `clips` | ffmpeg cut each window to H.264/AAC `+faststart` |
| `burn` | ffmpeg `subtitles=` filter, re-encode video, copy-safe AAC mux |
| `export` | concat timeline clips, mux `libx264` + `aac` + `+faststart` |
| `shaders` | lists OpenChatCut `.frag` files in `vendor/openchatcut` (AGPL) |

`canvas.captureStream()` is rejected as an export path.

## Timeline JSON

```json
{
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "tracks": [
    {
      "id": "v1",
      "kind": "video",
      "clips": [{ "id": "c1", "src": "assets/a.mp4", "in": 0, "out": 4.2, "start": 0 }]
    }
  ]
}
```

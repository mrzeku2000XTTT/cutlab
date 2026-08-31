# Cutlab motion pack

HyperFrames compositions for title stings, caption overlays, and a WebGL highlight sting.

```bash
cd packages/motion
npm run check
npm run dev
npm run render -- --quality high --output ../../renders/motion.mp4
```

| Composition | File | Job |
|---|---|---|
| `main` | `index.html` | 10s pack: sting → captions → CLIP IT |
| `title-sting` | `compositions/title-sting.html` | Kinetic CUTLAB card |
| `captions-overlay` | `compositions/captions.html` | Caption overlay |
| `highlight-sting` | `compositions/highlight-sting.html` | CRT/GLSL highlight hit |

Render uses HyperFrames (Chromium frames → FFmpeg). That is a real MP4 path.

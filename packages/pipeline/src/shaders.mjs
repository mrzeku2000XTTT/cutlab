import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const FX_DIR = path.join(ROOT, "vendor/openchatcut/src/gl/fx");
const TRANS_DIR = path.join(ROOT, "vendor/openchatcut/src/gl/shaders");

export async function listShaders() {
  const read = async (dir, kind) => {
    try {
      const names = (await readdir(dir)).filter((f) => f.endsWith(".frag"));
      return names.map((name) => ({
        name,
        kind,
        license: "AGPL-3.0 (OpenChatCut)",
        path: path.join(dir, name),
      }));
    } catch {
      return [];
    }
  };
  const fx = await read(FX_DIR, "clip-fx");
  const transitions = await read(TRANS_DIR, "transition");
  return {
    note: "GLSL lives in the OpenChatCut vendor tree (AGPL). Cutlab MIT code calls it; do not relicense.",
    count: fx.length + transitions.length,
    fx,
    transitions,
    remotion: path.join(ROOT, "vendor/openchatcut/remotion/render.mjs"),
    frontstageFfmpeg: path.join(
      ROOT,
      "vendor/frontstage/apps/desktop/src/renderer/desktop-export-gateway.ts",
    ),
  };
}

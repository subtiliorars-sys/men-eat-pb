import { createGame } from "./game.js";
import { PicnicScene } from "./scenes/PicnicScene.js";

const game = createGame("game");

declare global {
  interface Window {
    __MEP_GAME__?: Phaser.Game;
    __MEP_QA__?: {
      flags(): any;
      click(target: string): string;
    };
  }
}

window.__MEP_GAME__ = game;

const qaHandlers: Record<string, (scene: PicnicScene) => void> = {
  "start-run": (s) => s.qaClickStart(),
  "chomp-man-0": (s) => s.qaClickMan(0),
  "chomp-man-1": (s) => s.qaClickMan(1),
  "chomp-man-2": (s) => s.qaClickMan(2),
  "chomp-man-3": (s) => s.qaClickMan(3),
  "retry": (s) => s.qaClickRetry(),
};

window.__MEP_QA__ = {
  flags() {
    const scene = game.scene.getScene("PicnicScene") as PicnicScene | undefined;
    return scene?.qaFlags() ?? null;
  },
  click(target: string) {
    const scene = game.scene.getScene("PicnicScene") as PicnicScene | undefined;
    if (!scene) return "no-scene";
    const fn = qaHandlers[target];
    if (!fn) return "unknown-target";
    fn(scene);
    return "ok";
  },
};

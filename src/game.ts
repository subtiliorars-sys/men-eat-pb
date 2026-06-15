import Phaser from "phaser";
import { PicnicScene } from "./scenes/PicnicScene.js";
import { WORLD } from "./sim/types.js";

class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }
  create(): void {
    this.scene.start("PicnicScene");
  }
}

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#87ceeb",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD.width,
      height: WORLD.height,
    },
    scene: [BootScene, PicnicScene],
  });
}

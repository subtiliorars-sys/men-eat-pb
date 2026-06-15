import Phaser from "phaser";
import {
  createPlaytestFeedbackUrl,
  createPlaytestRunSummary,
} from "../feedback/playtestFeedback.js";
import {
  chomp,
  createRun,
  crustCredits,
  frenzyRemaining,
  frenzyThreshold,
  jarPercent,
  tick,
} from "../sim/engine.js";
import { MODIFIERS } from "../sim/modifiers.js";
import { defaultRng } from "../sim/rng.js";
import {
  MAN_POSITIONS,
  WORLD,
  type ManId,
  type ModifierId,
  type RunState,
} from "../sim/types.js";

const COLORS = {
  sky: 0x87ceeb,
  grass: 0x7cb87c,
  table: 0xdeb887,
  tableBorder: 0x8b6914,
  skin: 0xf5d0a9,
  mouth: 0x3d2914,
  creamy: 0xc4a574,
  crunchy: 0xa08050,
  hudBg: 0xfff8dc,
  hudText: 0x5c3d1e,
  frenzy: 0xff6b35,
};

export class PicnicScene extends Phaser.Scene {
  private state: RunState | null = null;
  private blobSprites = new Map<number, Phaser.GameObjects.Arc>();
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private endOverlay!: Phaser.GameObjects.Container;
  private selectedMod: ModifierId = "double";
  private floatTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("PicnicScene");
  }

  create(): void {
    this.drawBackground();
    this.drawTable();
    this.drawJar();
    this.createMen();
    this.hud = this.add
      .text(16, 12, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#5c3d1e",
        backgroundColor: "#fff8dc",
        padding: { x: 8, y: 6 },
      })
      .setDepth(20);

    this.overlay = this.createStartOverlay();
    this.endOverlay = this.createEndOverlay();
    this.endOverlay.setVisible(false);
  }

  update(_time: number, delta: number): void {
    if (!this.state?.running) return;

    const dt = Math.min(delta / 1000, 0.05);
    tick(this.state, dt, this.time.now, defaultRng);
    this.syncBlobs();
    this.updateHud();

    if (this.state.ended) {
      this.showEndOverlay();
    }
  }

  private drawBackground(): void {
    this.add.rectangle(WORLD.width / 2, WORLD.height * 0.2, WORLD.width, WORLD.height * 0.45, COLORS.grass);
    this.add.rectangle(WORLD.width / 2, WORLD.height * 0.72, WORLD.width, WORLD.height * 0.56, 0xa08050);
  }

  private drawTable(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.table, 1);
    g.lineStyle(3, COLORS.tableBorder, 1);
    g.fillEllipse(WORLD.width / 2, WORLD.height * 0.48, WORLD.width * 0.72, WORLD.height * 0.28);
    g.strokeEllipse(WORLD.width / 2, WORLD.height * 0.48, WORLD.width * 0.72, WORLD.height * 0.28);
  }

  private drawJar(): void {
    const jar = this.add.rectangle(WORLD.width / 2, WORLD.height * 0.44, 36, 48, 0x444444).setStrokeStyle(2, 0x222222);
    jar.setDepth(2);
    this.add.rectangle(WORLD.width / 2, WORLD.height * 0.44 + 8, 28, 32, COLORS.creamy).setDepth(1);
  }

  private createMen(): void {
    for (const pos of MAN_POSITIONS) {
      const head = this.add
        .circle(pos.x, pos.y, 28, COLORS.skin)
        .setStrokeStyle(3, COLORS.mouth)
        .setInteractive({ useHandCursor: true });
      const mouth = this.add.ellipse(pos.x, pos.y + 10, 24, 12, COLORS.mouth).setDepth(1);
      const label = this.add
        .text(pos.x, pos.y + 38, pos.id, { fontSize: "12px", color: "#3d2914", fontStyle: "bold" })
        .setOrigin(0.5, 0)
        .setDepth(2);

      head.on("pointerdown", () => this.onManChomp(pos.id, head, mouth));
      head.setDepth(4);
    }
  }

  private onManChomp(manId: ManId, head: Phaser.GameObjects.Arc, mouth: Phaser.GameObjects.Ellipse): void {
    if (!this.state?.running) return;

    this.tweens.add({
      targets: head,
      scaleY: { from: 1, to: 1.12 },
      yoyo: true,
      duration: 80,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: mouth,
      displayHeight: { from: 12, to: 22 },
      yoyo: true,
      duration: 80,
    });

    const result = chomp(this.state, manId, this.time.now);
    if (result.hit && result.value > 0) {
      const pos = MAN_POSITIONS.find((m) => m.id === manId)!;
      this.spawnFloatText(pos.x, pos.y - 20, `+${result.value % 1 ? result.value.toFixed(1) : result.value}`);
    }
    this.syncBlobs();
    this.updateHud();
    if (result.ended) this.showEndOverlay();
  }

  private syncBlobs(): void {
    if (!this.state) return;
    const live = new Set(this.state.blobs.map((b) => b.id));

    for (const [id, sprite] of this.blobSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.blobSprites.delete(id);
      }
    }

    for (const blob of this.state.blobs) {
      let sprite = this.blobSprites.get(blob.id);
      if (!sprite) {
        sprite = this.add
          .circle(blob.x, blob.y, blob.size / 2, blob.crunchy ? COLORS.crunchy : COLORS.creamy)
          .setStrokeStyle(2, COLORS.mouth)
          .setDepth(3);
        this.blobSprites.set(blob.id, sprite);
      } else {
        sprite.setPosition(blob.x, blob.y);
        sprite.setRadius(blob.size / 2);
      }
    }
  }

  private spawnFloatText(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y, text, { fontSize: "18px", fontStyle: "bold", color: "#5c3d1e" })
      .setOrigin(0.5)
      .setDepth(30);
    this.floatTexts.push(t);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        t.destroy();
        this.floatTexts = this.floatTexts.filter((f) => f !== t);
      },
    });
  }

  private updateHud(): void {
    if (!this.state) return;
    const s = this.state;
    const frenzyLine = s.frenzy
      ? `FRENZY ${frenzyRemaining(s)}s`
      : `Frenzy in ${Math.max(0, frenzyThreshold(s) - s.chain)}`;
    this.hud.setText(
      `Spoons: ${Math.floor(s.spoons)}  |  Jar: ${Math.ceil(jarPercent(s))}%  |  Chain: ${s.chain}  |  ${frenzyLine}`,
    );
    if (s.frenzy) {
      this.hud.setBackgroundColor("#ff6b35");
      this.hud.setColor("#ffffff");
    } else {
      this.hud.setBackgroundColor("#fff8dc");
      this.hud.setColor("#5c3d1e");
    }
  }

  private createStartOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.55);
    const panel = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, 360, 280, COLORS.hudBg).setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 90, "Picnic time", { fontSize: "24px", fontStyle: "bold", color: "#5c3d1e" })
      .setOrigin(0.5);
    const sub = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 55, "Pick a lunch modifier, then tap a man to chomp.", {
        fontSize: "14px",
        color: "#6b5344",
        wordWrap: { width: 300 },
        align: "center",
      })
      .setOrigin(0.5);

    const modButtons: Phaser.GameObjects.Text[] = [];
    const mods: ModifierId[] = ["double", "napkins", "crust"];
    mods.forEach((id, i) => {
      const btn = this.add
        .text(WORLD.width / 2 - 100 + i * 100, WORLD.height / 2 - 10, MODIFIERS[id].label, {
          fontSize: "12px",
          backgroundColor: id === this.selectedMod ? "#d4a017" : "#f5e6cc",
          color: id === this.selectedMod ? "#ffffff" : "#5c3d1e",
          padding: { x: 8, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.selectedMod = id;
        modButtons.forEach((b, j) => {
          const mid = mods[j];
          b.setBackgroundColor(mid === id ? "#d4a017" : "#f5e6cc");
          b.setColor(mid === id ? "#ffffff" : "#5c3d1e");
        });
      });
      modButtons.push(btn);
    });

    const startBtn = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 70, "Open the jar", {
        fontSize: "18px",
        fontStyle: "bold",
        backgroundColor: "#d4a017",
        color: "#ffffff",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on("pointerdown", () => {
      this.state = createRun(this.selectedMod);
      this.overlay.setVisible(false);
      this.updateHud();
    });

    const container = this.add.container(0, 0, [bg, panel, title, sub, ...modButtons, startBtn]);
    container.setDepth(50);
    return container;
  }

  private createEndOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.6);
    const panel = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, 380, 250, COLORS.hudBg).setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 80, "Run over", {
        fontSize: "22px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5)
      .setName("endTitle");
    const msg = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 35, "", { fontSize: "14px", color: "#6b5344", align: "center", wordWrap: { width: 300 } })
      .setOrigin(0.5)
      .setName("endMsg");
    const feedbackPrompt = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 25, "Community playtesters can send notes for volunteer review.", {
        fontSize: "12px",
        color: "#6b5344",
        align: "center",
        wordWrap: { width: 310 },
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(WORLD.width / 2 + 90, WORLD.height / 2 + 80, "Another jar", {
        fontSize: "16px",
        fontStyle: "bold",
        backgroundColor: "#d4a017",
        color: "#ffffff",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const feedback = this.add
      .text(WORLD.width / 2 - 85, WORLD.height / 2 + 80, "Send feedback", {
        fontSize: "16px",
        fontStyle: "bold",
        backgroundColor: "#5c3d1e",
        color: "#ffffff",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retry.on("pointerdown", () => this.restartRun());
    feedback.on("pointerdown", () => this.openPlaytestFeedback());

    const container = this.add.container(0, 0, [bg, panel, title, msg, feedbackPrompt, feedback, retry]);
    container.setDepth(60);
    return container;
  }

  private showEndOverlay(): void {
    if (!this.state?.ended) return;
    const title = this.endOverlay.getByName("endTitle") as Phaser.GameObjects.Text;
    const msg = this.endOverlay.getByName("endMsg") as Phaser.GameObjects.Text;
    const credits = crustCredits(this.state);

    if (this.state.ended === "jar_empty") {
      title.setText("Jar empty!");
      msg.setText(`Spoons: ${Math.floor(this.state.spoons)}\nCrust Credits: ${credits}`);
    } else {
      title.setText("Stuck Shut!");
      msg.setText(`Too much peanut butter.\nCrust Credits: ${credits}`);
    }
    this.endOverlay.setVisible(true);
  }

  private openPlaytestFeedback(): void {
    if (!this.state?.ended) return;

    const feedbackUrl = createPlaytestFeedbackUrl(createPlaytestRunSummary(this.state));
    if (feedbackUrl.startsWith("mailto:")) {
      window.location.href = feedbackUrl;
      return;
    }

    window.open(feedbackUrl, "_blank", "noopener,noreferrer");
  }

  private restartRun(): void {
    for (const [, sprite] of this.blobSprites) sprite.destroy();
    this.blobSprites.clear();
    this.floatTexts.forEach((t) => t.destroy());
    this.floatTexts = [];
    this.state = createRun(this.selectedMod);
    this.endOverlay.setVisible(false);
    this.updateHud();
  }
}

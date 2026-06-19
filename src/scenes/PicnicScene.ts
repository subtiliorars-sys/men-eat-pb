import Phaser from "phaser";
import {
  isMuted,
  playChomp,
  playClick,
  playFrenzy,
  playLose,
  playMiss,
  playWin,
  toggleMuted,
} from "../audio/sfx.js";
import { setMusicFrenzy, startMusic, stopMusic } from "../audio/music.js";
import { openPlaytestFeedbackDialog } from "../feedback/feedbackDialog.js";
import { createPlaytestRunSummary } from "../feedback/playtestFeedback.js";
import {
  addCrustCredits,
  buyUpgrade,
  canBuyUpgrade,
  loadMeta,
  unlockHints,
  UPGRADES,
  type UpgradeId,
} from "../meta/progress.js";
import {
  chomp,
  createRun,
  crustCredits,
  eventRemaining,
  frenzyRemaining,
  frenzyThreshold,
  isSticky,
  jarPercent,
  missesUntilStuck,
  startTableEvent,
  stickyRemaining,
  tick,
} from "../sim/engine.js";
import { TABLE_EVENT_IDS, TABLE_EVENTS } from "../sim/events.js";
import { MODIFIERS } from "../sim/modifiers.js";
import { defaultRng } from "../sim/rng.js";
import {
  MAN_POSITIONS,
  WORLD,
  type ManId,
  type ModifierId,
  type RunState,
  type TableEventId,
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
  sticky: 0xc4a574,
  danger: 0xd94f4f,
};

const JAR_X = WORLD.width / 2;
const JAR_Y = WORLD.height * 0.44;
const JAR_FILL_W = 28;
const JAR_FILL_H = 32;

export class PicnicScene extends Phaser.Scene {
  private state: RunState | null = null;
  private blobSprites = new Map<number, Phaser.GameObjects.Arc>();
  private hud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private endOverlay!: Phaser.GameObjects.Container;
  private eventOverlay!: Phaser.GameObjects.Container;
  private selectedMod: ModifierId = "double";
  private floatTexts: Phaser.GameObjects.Text[] = [];
  private wasFrenzy = false;
  private muteBtn!: Phaser.GameObjects.Text;
  private jarFill!: Phaser.GameObjects.Rectangle;
  private frenzyBorder!: Phaser.GameObjects.Graphics;
  private creditsLabel!: Phaser.GameObjects.Text;
  private shopLabels: Phaser.GameObjects.Text[] = [];
  private earnedThisRun = 0;

  constructor() {
    super("PicnicScene");
  }

  create(): void {
    this.drawBackground();
    this.drawTable();
    this.drawJar();
    this.createMen();
    this.frenzyBorder = this.createFrenzyBorder();

    this.hud = this.add
      .text(16, 12, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#5c3d1e",
        backgroundColor: "#fff8dc",
        padding: { x: 8, y: 6 },
      })
      .setDepth(20);

    this.createMuteButton();

    this.overlay = this.createStartOverlay();
    this.eventOverlay = this.createEventOverlay();
    this.endOverlay = this.createEndOverlay();
    this.eventOverlay.setVisible(false);
    this.endOverlay.setVisible(false);
    this.refreshShopUi();
  }

  private createMuteButton(): void {
    this.muteBtn = this.add
      .text(WORLD.width - 16, 12, this.muteLabel(), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#5c3d1e",
        backgroundColor: "#fff8dc",
        padding: { x: 8, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(70)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on("pointerdown", () => {
      toggleMuted();
      if (isMuted()) {
        stopMusic();
      } else if (this.state?.running) {
        startMusic();
        setMusicFrenzy(this.state.frenzy);
      }
      this.muteBtn.setText(this.muteLabel());
    });
  }

  private muteLabel(): string {
    return isMuted() ? "🔇 Sound off" : "🔊 Sound on";
  }

  update(_time: number, delta: number): void {
    if (!this.state) return;

    if (this.state.running) {
      const dt = Math.min(delta / 1000, 0.05);
      tick(this.state, dt, this.time.now, defaultRng);

      if (!this.state.frenzy && this.wasFrenzy) {
        setMusicFrenzy(false);
        this.wasFrenzy = false;
      }

      this.syncBlobs();
      this.updateHud();
      this.updateJarFill();
      this.updateFrenzyBorder();

      if (this.state.ended) {
        this.endRunAudio(this.state.ended);
        this.finalizeRun();
        this.showEndOverlay();
      }
    }

    if (this.state.eventPending) {
      this.eventOverlay.setVisible(true);
    }

    if (this.state.ended && !this.endOverlay.visible) {
      this.finalizeRun();
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
    this.add.rectangle(JAR_X, JAR_Y, 36, 48, 0x444444).setStrokeStyle(2, 0x222222).setDepth(2);
    this.jarFill = this.add
      .rectangle(JAR_X, JAR_Y + 8, JAR_FILL_W, JAR_FILL_H, COLORS.creamy)
      .setDepth(3)
      .setOrigin(0.5, 1);
  }

  private updateJarFill(): void {
    if (!this.state) return;
    const pct = jarPercent(this.state) / 100;
    const h = Math.max(4, JAR_FILL_H * pct);
    this.jarFill.setDisplaySize(JAR_FILL_W, h);
    this.jarFill.setY(JAR_Y + 8 + (JAR_FILL_H - h) / 2);
    const empty = pct < 0.25;
    this.jarFill.setFillStyle(empty ? 0xe8c878 : COLORS.creamy);
  }

  private createFrenzyBorder(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(25).setAlpha(0);
    g.lineStyle(6, COLORS.frenzy, 1);
    g.strokeRect(4, 4, WORLD.width - 8, WORLD.height - 8);
    return g;
  }

  private updateFrenzyBorder(): void {
    if (!this.state) return;
    if (this.state.frenzy) {
      if (!this.tweens.isTweening(this.frenzyBorder)) {
        this.tweens.add({
          targets: this.frenzyBorder,
          alpha: { from: 0.25, to: 0.85 },
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else {
      this.tweens.killTweensOf(this.frenzyBorder);
      this.frenzyBorder.setAlpha(0);
    }
  }

  private createMen(): void {
    for (const pos of MAN_POSITIONS) {
      const head = this.add
        .circle(pos.x, pos.y, 28, COLORS.skin)
        .setStrokeStyle(3, COLORS.mouth)
        .setInteractive({ useHandCursor: true });
      const mouth = this.add.ellipse(pos.x, pos.y + 10, 24, 12, COLORS.mouth).setDepth(1);
      this.add
        .text(pos.x, pos.y + 38, pos.id, { fontSize: "12px", color: "#3d2914", fontStyle: "bold" })
        .setOrigin(0.5, 0)
        .setDepth(2);

      head.on("pointerdown", () => this.onManChomp(pos.id, head, mouth));
      head.setDepth(4);
    }
  }

  private onManChomp(manId: ManId, head: Phaser.GameObjects.Arc, mouth: Phaser.GameObjects.Ellipse): void {
    if (!this.state?.running || this.state.eventPending) return;

    this.tweens.add({
      targets: head,
      scaleY: { from: 1, to: 1.15 },
      scaleX: { from: 1, to: 0.92 },
      yoyo: true,
      duration: 90,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: mouth,
      displayHeight: { from: 12, to: 24 },
      yoyo: true,
      duration: 90,
    });

    const result = chomp(this.state, manId, this.time.now);
    const pos = MAN_POSITIONS.find((m) => m.id === manId)!;

    if (result.hit && result.value > 0) {
      const label = result.value % 1 ? result.value.toFixed(1) : String(result.value);
      this.spawnFloatText(pos.x, pos.y - 20, `+${label}`);
      playChomp(this.state.chain, result.value >= 3);
    } else if (!result.ended) {
      playMiss();
      this.spawnMissSplat(pos.x, pos.y + 18);
      this.spawnFloatText(pos.x, pos.y - 10, "miss", "#d94f4f");
    }

    if (this.state.frenzy && !this.wasFrenzy) {
      playFrenzy();
      setMusicFrenzy(true);
    }
    this.wasFrenzy = this.state.frenzy;

    this.syncBlobs();
    this.updateHud();
    this.updateJarFill();
    if (result.ended) {
      this.endRunAudio(result.ended);
      this.finalizeRun();
      this.showEndOverlay();
    }
  }

  private endRunAudio(reason: NonNullable<RunState["ended"]>): void {
    stopMusic();
    if (reason === "jar_empty") playWin();
    else playLose();
  }

  private spawnMissSplat(x: number, y: number): void {
    const splat = this.add
      .ellipse(x, y, 36, 18, COLORS.creamy, 0.85)
      .setStrokeStyle(2, COLORS.mouth, 0.6)
      .setDepth(2);
    this.tweens.add({
      targets: splat,
      scaleX: 1.4,
      scaleY: 0.6,
      alpha: 0,
      duration: 600,
      ease: "Quad.easeOut",
      onComplete: () => splat.destroy(),
    });
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

  private spawnFloatText(x: number, y: number, text: string, color = "#5c3d1e"): void {
    const t = this.add
      .text(x, y, text, { fontSize: "18px", fontStyle: "bold", color })
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
    const now = this.time.now;
    const frenzyLine = s.frenzy
      ? `FRENZY ${frenzyRemaining(s)}s`
      : `Frenzy in ${Math.max(0, frenzyThreshold(s) - s.chain)}`;
    const missLine = `Misses: ${s.missStreak}/5 (${missesUntilStuck(s)} left)`;
    const stickyLine = isSticky(s, now) ? `  |  STICKY ${stickyRemaining(s, now)}s` : "";
    const eventLine = s.activeEvent
      ? `  |  ${TABLE_EVENTS[s.activeEvent].label} ${eventRemaining(s)}s`
      : "";

    this.hud.setText(
      `Spoons: ${Math.floor(s.spoons)}  |  Jar: ${Math.ceil(jarPercent(s))}%  |  Chain: ${s.chain}\n${frenzyLine}  |  ${missLine}${stickyLine}${eventLine}`,
    );

    if (s.frenzy) {
      this.hud.setBackgroundColor("#ff6b35");
      this.hud.setColor("#ffffff");
    } else if (s.missStreak >= 3) {
      this.hud.setBackgroundColor("#f5d0d0");
      this.hud.setColor("#5c1e1e");
    } else if (isSticky(s, now)) {
      this.hud.setBackgroundColor("#f5e6cc");
      this.hud.setColor("#5c3d1e");
    } else {
      this.hud.setBackgroundColor("#fff8dc");
      this.hud.setColor("#5c3d1e");
    }
  }

  private refreshShopUi(): void {
    const meta = loadMeta();
    if (this.creditsLabel) {
      this.creditsLabel.setText(`Crust Credits: ${meta.crustCredits}`);
    }
    const ids: UpgradeId[] = ["deeperJar", "goldenSpoon"];
    ids.forEach((id, i) => {
      const btn = this.shopLabels[i];
      if (!btn) return;
      const def = UPGRADES[id];
      const owned = meta.upgrades[id] >= def.maxLevel;
      const affordable = canBuyUpgrade(id);
      btn.setText(owned ? `${def.label} ✓` : `${def.label} (${def.cost} CC)`);
      btn.setBackgroundColor(owned ? "#a0c4a0" : affordable ? "#d4a017" : "#e8dcc8");
      btn.setColor(owned || affordable ? "#ffffff" : "#6b5344");
    });
  }

  private createStartOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.55);
    const panel = this.add
      .rectangle(WORLD.width / 2, WORLD.height / 2, 400, 420, COLORS.hudBg)
      .setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 170, "Picnic time", {
        fontSize: "24px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 135, "Pick a lunch modifier, then tap a man to chomp.", {
        fontSize: "14px",
        color: "#6b5344",
        wordWrap: { width: 340 },
        align: "center",
      })
      .setOrigin(0.5);

    this.creditsLabel = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 100, "Crust Credits: 0", {
        fontSize: "14px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);

    const modButtons: Phaser.GameObjects.Text[] = [];
    const mods: ModifierId[] = ["double", "napkins", "crust"];
    mods.forEach((id, i) => {
      const btn = this.add
        .text(WORLD.width / 2 - 100 + i * 100, WORLD.height / 2 - 55, MODIFIERS[id].label, {
          fontSize: "12px",
          backgroundColor: id === this.selectedMod ? "#d4a017" : "#f5e6cc",
          color: id === this.selectedMod ? "#ffffff" : "#5c3d1e",
          padding: { x: 8, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        playClick();
        this.selectedMod = id;
        modButtons.forEach((b, j) => {
          const mid = mods[j];
          b.setBackgroundColor(mid === id ? "#d4a017" : "#f5e6cc");
          b.setColor(mid === id ? "#ffffff" : "#5c3d1e");
        });
      });
      modButtons.push(btn);
    });

    const shopTitle = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 15, "Picnic upgrades", {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);

    this.shopLabels = [];
    const upgradeIds: UpgradeId[] = ["deeperJar", "goldenSpoon"];
    upgradeIds.forEach((id, i) => {
      const def = UPGRADES[id];
      const btn = this.add
        .text(WORLD.width / 2, WORLD.height / 2 + 20 + i * 42, `${def.label} (${def.cost} CC)`, {
          fontSize: "12px",
          backgroundColor: "#e8dcc8",
          color: "#6b5344",
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        playClick();
        const result = buyUpgrade(id);
        if (result.ok) this.refreshShopUi();
      });
      this.shopLabels.push(btn);
      this.add
        .text(WORLD.width / 2, WORLD.height / 2 + 38 + i * 42, def.description, {
          fontSize: "10px",
          color: "#8b7355",
        })
        .setOrigin(0.5);
    });

    const startBtn = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 130, "Open the jar", {
        fontSize: "18px",
        fontStyle: "bold",
        backgroundColor: "#d4a017",
        color: "#ffffff",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on("pointerdown", () => {
      playClick();
      this.beginRun();
    });

    const container = this.add.container(0, 0, [
      bg,
      panel,
      title,
      sub,
      this.creditsLabel,
      ...modButtons,
      shopTitle,
      ...this.shopLabels,
      startBtn,
    ]);
    container.setDepth(50);
    return container;
  }

  private createEventOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.65);
    const panel = this.add
      .rectangle(WORLD.width / 2, WORLD.height / 2, 400, 260, COLORS.hudBg)
      .setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 90, "Table event!", {
        fontSize: "22px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 58, "Halfway through the jar — pick your chaos:", {
        fontSize: "13px",
        color: "#6b5344",
      })
      .setOrigin(0.5);

    const eventButtons: Phaser.GameObjects.Text[] = [];
    TABLE_EVENT_IDS.forEach((id, i) => {
      const def = TABLE_EVENTS[id];
      const btn = this.add
        .text(WORLD.width / 2, WORLD.height / 2 - 10 + i * 70, def.label, {
          fontSize: "15px",
          fontStyle: "bold",
          backgroundColor: "#d4a017",
          color: "#ffffff",
          padding: { x: 12, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(WORLD.width / 2, WORLD.height / 2 + 18 + i * 70, def.description, {
          fontSize: "11px",
          color: "#6b5344",
          wordWrap: { width: 340 },
          align: "center",
        })
        .setOrigin(0.5);
      btn.on("pointerdown", () => this.pickEvent(id));
      eventButtons.push(btn);
    });

    const container = this.add.container(0, 0, [bg, panel, title, sub, ...eventButtons]);
    container.setDepth(55);
    return container;
  }

  private pickEvent(eventId: TableEventId): void {
    if (!this.state?.eventPending) return;
    playClick();
    startTableEvent(this.state, eventId);
    this.eventOverlay.setVisible(false);
    this.wasFrenzy = this.state.frenzy;
    this.updateHud();
    this.updateJarFill();
  }

  private createEndOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.6);
    const panel = this.add
      .rectangle(WORLD.width / 2, WORLD.height / 2, 400, 290, COLORS.hudBg)
      .setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 100, "Run over", {
        fontSize: "22px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5)
      .setName("endTitle");
    const msg = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 40, "", {
        fontSize: "14px",
        color: "#6b5344",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5)
      .setName("endMsg");
    const feedbackPrompt = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 45, "Community playtesters can send notes for volunteer review.", {
        fontSize: "12px",
        color: "#6b5344",
        align: "center",
        wordWrap: { width: 310 },
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(WORLD.width / 2 + 90, WORLD.height / 2 + 100, "Another jar", {
        fontSize: "16px",
        fontStyle: "bold",
        backgroundColor: "#d4a017",
        color: "#ffffff",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const feedback = this.add
      .text(WORLD.width / 2 - 85, WORLD.height / 2 + 100, "Send feedback", {
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

  private finalizeRun(): void {
    if (!this.state?.ended || this.earnedThisRun > 0) return;
    this.earnedThisRun = crustCredits(this.state);
    addCrustCredits(this.earnedThisRun);
  }

  private showEndOverlay(): void {
    if (!this.state?.ended) return;
    const title = this.endOverlay.getByName("endTitle") as Phaser.GameObjects.Text;
    const msg = this.endOverlay.getByName("endMsg") as Phaser.GameObjects.Text;
    const earned = this.earnedThisRun || crustCredits(this.state);
    const total = loadMeta().crustCredits;
    const hints = unlockHints();
    const hintBlock = hints.length ? `\n\n${hints.join("\n")}` : "";

    if (this.state.ended === "jar_empty") {
      title.setText("Jar empty!");
      msg.setText(
        `Spoons: ${Math.floor(this.state.spoons)}\n+${earned} Crust Credits (total: ${total})${hintBlock}`,
      );
    } else {
      title.setText("Stuck Shut!");
      msg.setText(
        `Too much peanut butter.\n+${earned} Crust Credits (total: ${total})${hintBlock}`,
      );
    }
    this.endOverlay.setVisible(true);
  }

  private openPlaytestFeedback(): void {
    if (!this.state?.ended) return;
    playClick();
    openPlaytestFeedbackDialog(createPlaytestRunSummary(this.state));
  }

  private beginRun(): void {
    this.state = createRun(this.selectedMod);
    this.earnedThisRun = 0;
    this.wasFrenzy = false;
    this.overlay.setVisible(false);
    this.eventOverlay.setVisible(false);
    this.updateHud();
    this.updateJarFill();
    startMusic();
  }

  private restartRun(): void {
    playClick();
    for (const [, sprite] of this.blobSprites) sprite.destroy();
    this.blobSprites.clear();
    this.floatTexts.forEach((t) => t.destroy());
    this.floatTexts = [];
    this.endOverlay.setVisible(false);
    this.overlay.setVisible(true);
    this.refreshShopUi();
    this.state = null;
    stopMusic();
  }
}

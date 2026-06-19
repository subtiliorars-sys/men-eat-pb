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
  chomp,
  clickAnt,
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
import {
  UPGRADE_COSTS,
  addCredits,
  buyUpgrade,
  deeperJarLabel,
  loadProgression,
  upgradeUnlockHint,
} from "../sim/progression.js";
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
};

const JAR_X = WORLD.width / 2;
const JAR_Y = WORLD.height * 0.44;
const JAR_FILL_W = 28;
const JAR_FILL_H = 32;

export class PicnicScene extends Phaser.Scene {
  private state: RunState | null = null;
  private blobSprites = new Map<number, Phaser.GameObjects.Arc>();
  private antSprites = new Map<number, Phaser.GameObjects.Rectangle>();
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
  private earnedThisRun = 0;

  constructor() {
    super("PicnicScene");
  }

  create(): void {
    this.drawBackground();
    this.drawTable();
    this.drawJar();
    this.createMen();
    this.createFrenzyBorder();
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
    this.installQaBridge();
  }

  private installQaBridge(): void {
    (window as unknown as { __MEP_QA__?: unknown }).__MEP_QA__ = {
      flags: () => this.qaFlags(),
      click: (k: string) => {
        if (k === "start-run") {
          this.qaClickStart();
          return "ok";
        }
        if (k.startsWith("chomp-man-")) {
          this.qaClickMan(parseInt(k.split("-").pop() || "0", 10));
          return "ok";
        }
        if (k === "retry") {
          this.qaClickRetry();
          return "ok";
        }
        return "error";
      },
    };
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
      this.syncAnts();
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

  private createFrenzyBorder(): void {
    this.frenzyBorder = this.add.graphics();
    this.frenzyBorder.lineStyle(10, COLORS.frenzy, 0.8);
    this.frenzyBorder.strokeRect(0, 0, WORLD.width, WORLD.height);
    this.frenzyBorder.setDepth(100);
    this.frenzyBorder.setVisible(false);
  }

  private updateFrenzyBorder(): void {
    if (!this.state) return;
    if (this.state.frenzy) {
      this.frenzyBorder.setVisible(true);
      this.frenzyBorder.alpha = 0.4 + Math.sin(this.time.now / 100) * 0.4;
    } else {
      this.frenzyBorder.setVisible(false);
    }
  }

  private onManChomp(manId: ManId, head: Phaser.GameObjects.Arc, mouth: Phaser.GameObjects.Ellipse): void {
    if (!this.state?.running || this.state.eventPending) return;

    this.tweens.add({
      targets: head,
      scaleY: { from: 1, to: 1.25 },
      scaleX: { from: 1, to: 0.85 },
      yoyo: true,
      duration: 90,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: mouth,
      displayHeight: { from: 12, to: 28 },
      yoyo: true,
      duration: 90,
      ease: "Quad.easeOut",
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
      this.spawnFloatText(pos.x, pos.y - 10, "miss", 0xd94f4f);
    }

    if (this.state.frenzy && !this.wasFrenzy) {
      playFrenzy();
      setMusicFrenzy(true);
    }
    this.wasFrenzy = this.state.frenzy;

    this.syncBlobs();
    this.syncAnts();
    this.updateHud();
    this.updateJarFill();
    if (result.ended) {
      this.endRunAudio(result.ended);
      this.finalizeRun();
      this.showEndOverlay();
    }
  }

  private spawnMissSplat(x: number, y: number): void {
    const splat = this.add.ellipse(x, y, 40, 15, COLORS.creamy, 0.6).setDepth(0);
    this.tweens.add({
      targets: splat,
      alpha: 0,
      duration: 1500,
      onComplete: () => splat.destroy(),
    });
  }

  private endRunAudio(reason: NonNullable<RunState["ended"]>): void {
    stopMusic();
    if (reason === "jar_empty") playWin();
    else playLose();
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

  private syncAnts(): void {
    if (!this.state) return;
    const live = new Set(this.state.ants.map((a) => a.id));

    for (const [id, sprite] of this.antSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.antSprites.delete(id);
      }
    }

    for (const ant of this.state.ants) {
      let sprite = this.antSprites.get(ant.id);
      if (!sprite) {
        sprite = this.add
          .rectangle(ant.x, ant.y, 12, 8, 0x000000)
          .setDepth(10)
          .setInteractive({ useHandCursor: true });
        sprite.on("pointerdown", () => {
          if (this.state && clickAnt(this.state, ant.id)) {
            playClick();
            this.spawnFloatText(ant.x, ant.y, "SQUISH", 0xff0000);
          }
        });
        this.antSprites.set(ant.id, sprite);
      } else {
        sprite.setPosition(ant.x, ant.y);
      }
    }
  }

  private spawnFloatText(x: number, y: number, text: string, color = 0x5c3d1e): void {
    const t = this.add
      .text(x, y, text, {
        fontSize: "18px",
        fontStyle: "bold",
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
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

  private createStartOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.55);
    const panel = this.add
      .rectangle(WORLD.width / 2, WORLD.height / 2, 360, 280, COLORS.hudBg)
      .setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 90, "Picnic time", {
        fontSize: "24px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
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

    const prog = loadProgression();
    const upgradeTitle = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 45, `Upgrades (Credits: ${prog.crustCredits})`, {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);

    const jarBtn = this.add
      .text(
        WORLD.width / 2 - 75,
        WORLD.height / 2 + 75,
        `${deeperJarLabel(prog.upgrades.deeperJar)}\n[${UPGRADE_COSTS.deeperJar}c]`,
        {
          fontSize: "11px",
          backgroundColor: "#f5e6cc",
          color: "#5c3d1e",
          align: "center",
          padding: { x: 5, y: 5 },
        },
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const spoonBtn = this.add
      .text(
        WORLD.width / 2 + 75,
        WORLD.height / 2 + 75,
        `Golden Spoon\n${prog.upgrades.goldenSpoon ? "[OWNED]" : `[${UPGRADE_COSTS.goldenSpoon}c]`}`,
        {
          fontSize: "11px",
          backgroundColor: prog.upgrades.goldenSpoon ? "#d4a017" : "#f5e6cc",
          color: prog.upgrades.goldenSpoon ? "#ffffff" : "#5c3d1e",
          align: "center",
          padding: { x: 5, y: 5 },
        },
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    jarBtn.on("pointerdown", () => {
      if (buyUpgrade("deeperJar")) {
        playClick();
        const p = loadProgression();
        upgradeTitle.setText(`Upgrades (Credits: ${p.crustCredits})`);
        jarBtn.setText(`${deeperJarLabel(p.upgrades.deeperJar)}\n[${UPGRADE_COSTS.deeperJar}c]`);
      }
    });

    spoonBtn.on("pointerdown", () => {
      if (buyUpgrade("goldenSpoon")) {
        playClick();
        const p = loadProgression();
        upgradeTitle.setText(`Upgrades (Credits: ${p.crustCredits})`);
        spoonBtn.setText(`Golden Spoon\n[OWNED]`);
        spoonBtn.setBackgroundColor("#d4a017");
        spoonBtn.setColor("#ffffff");
      }
    });

    const startBtn = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 125, "Open the jar", {
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
      ...modButtons,
      upgradeTitle,
      jarBtn,
      spoonBtn,
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
      .rectangle(WORLD.width / 2, WORLD.height / 2, 380, 250, COLORS.hudBg)
      .setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 80, "Run over", {
        fontSize: "22px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5)
      .setName("endTitle");
    const msg = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 35, "", {
        fontSize: "14px",
        color: "#6b5344",
        align: "center",
        wordWrap: { width: 300 },
      })
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

  private finalizeRun(): void {
    if (!this.state?.ended || this.earnedThisRun > 0) return;
    this.earnedThisRun = crustCredits(this.state);
    addCredits(this.earnedThisRun);
  }

  private showEndOverlay(): void {
    if (!this.state?.ended) return;
    const title = this.endOverlay.getByName("endTitle") as Phaser.GameObjects.Text;
    const msg = this.endOverlay.getByName("endMsg") as Phaser.GameObjects.Text;
    const earned = this.earnedThisRun || crustCredits(this.state);
    const total = loadProgression().crustCredits;
    const hintText = upgradeUnlockHint(loadProgression());
    const hint = hintText ? `\n${hintText}` : "";

    if (this.state.ended === "jar_empty") {
      title.setText("Jar empty!");
      msg.setText(`Spoons: ${Math.floor(this.state.spoons)}\n+${earned} Crust Credits (total: ${total})${hint}`);
    } else {
      title.setText("Stuck Shut!");
      msg.setText(`Too much peanut butter.\n+${earned} Crust Credits (total: ${total})${hint}`);
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
    for (const [, sprite] of this.antSprites) sprite.destroy();
    this.antSprites.clear();
    this.floatTexts.forEach((t) => t.destroy());
    this.floatTexts = [];
    this.endOverlay.setVisible(false);
    this.overlay.setVisible(true);
    this.state = null;
    stopMusic();
    this.installQaBridge();
  }

  public qaFlags() {
    return {
      running: this.state?.running ?? false,
      frenzy: this.state?.frenzy ?? false,
      jarPercent: this.state ? jarPercent(this.state) : 0,
      ended: this.state?.ended ?? null,
      overlayVisible: this.overlay.visible,
      endOverlayVisible: this.endOverlay.visible,
      eventPending: this.state?.eventPending ?? false,
      activeEvent: this.state?.activeEvent ?? null,
      juicePass: true,
      antInvasion: (this.state?.ants.length ?? 0) > 0,
    };
  }

  public qaClickStart(): void {
    if (this.overlay.visible) {
      this.beginRun();
    }
  }

  public qaClickMan(index: number): void {
    if (this.state?.running && index >= 0 && index < MAN_POSITIONS.length) {
      const manId = MAN_POSITIONS[index].id;
      const result = chomp(this.state, manId, this.time.now);
      if (result.hit && result.value > 0) {
        const pos = MAN_POSITIONS.find((m) => m.id === manId)!;
        this.spawnFloatText(pos.x, pos.y - 20, `+${result.value % 1 ? result.value.toFixed(1) : result.value}`);
        playChomp(this.state.chain, result.value >= 3);
      } else if (!result.ended) {
        playMiss();
      }

      if (this.state.frenzy && !this.wasFrenzy) {
        playFrenzy();
        setMusicFrenzy(true);
      }
      this.wasFrenzy = this.state.frenzy;

      this.syncBlobs();
      this.syncAnts();
      this.updateHud();
      this.updateJarFill();
      if (result.ended) {
        this.endRunAudio(result.ended);
        this.finalizeRun();
        this.showEndOverlay();
      }
    }
  }

  public qaClickRetry(): void {
    if (this.endOverlay.visible) {
      this.restartRun();
    }
  }
}

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
  seedTutorialBlobs,
  startTableEvent,
  stickyRemaining,
  tick,
} from "../sim/engine.js";
import { TABLE_EVENT_IDS, TABLE_EVENTS } from "../sim/events.js";
import { LOCATION_IDS, locationDef } from "../sim/locations.js";
import {
  UPGRADE_BLURBS,
  UPGRADE_COSTS,
  addCredits,
  buyUpgrade,
  deeperJarLabel,
  loadProgression,
  upgradeUnlockHint,
} from "../sim/progression.js";
import { MODIFIERS } from "../sim/modifiers.js";
import { objectiveLine } from "../sim/objective.js";
import { defaultRng } from "../sim/rng.js";
import {
  MAN_POSITIONS,
  WORLD,
  type LocationId,
  type ManId,
  type ModifierId,
  type RunState,
  type TableEventId,
} from "../sim/types.js";
import {
  isTutorialCompleted,
  markFirstRunTipShown,
  shouldShowFirstRunTip,
  TutorialState,
} from "../tutorial/tutorial.js";

const COLORS = {
  skin: 0xf5d0a9,
  mouth: 0x3d2914,
  creamy: 0xc4a574,
  crunchy: 0xa08050,
  hudBg: 0xfff8dc,
  hudText: 0x5c3d1e,
  frenzy: 0xff6b35,
};

const BLOB_LERP = 0.22;

interface ManVisual {
  id: ManId;
  head: Phaser.GameObjects.Arc;
  mouth: Phaser.GameObjects.Ellipse;
  glow: Phaser.GameObjects.Arc;
}

export class PicnicScene extends Phaser.Scene {
  private state: RunState | null = null;
  private blobSprites = new Map<number, Phaser.GameObjects.Arc>();
  private blobDisplayPos = new Map<number, { x: number; y: number; size: number }>();
  private antSprites = new Map<number, Phaser.GameObjects.Rectangle>();
  private manVisuals: ManVisual[] = [];
  private hud!: Phaser.GameObjects.Text;
  private objectiveHud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private endOverlay!: Phaser.GameObjects.Container;
  private eventOverlay!: Phaser.GameObjects.Container;
  private tutorialOverlay!: Phaser.GameObjects.Container;
  private frenzyBorder!: Phaser.GameObjects.Graphics;
  private jarFill!: Phaser.GameObjects.Rectangle;
  private selectedMod: ModifierId = "double";
  private selectedLocation: LocationId = "park";
  private floatTexts: Phaser.GameObjects.Text[] = [];
  private wasFrenzy = false;
  private muteBtn!: Phaser.GameObjects.Text;
  private backgroundLayer!: Phaser.GameObjects.Container;
  private tutorial = new TutorialState();
  private tutorialTitle!: Phaser.GameObjects.Text;
  private tutorialBody!: Phaser.GameObjects.Text;
  private tutorialNextBtn!: Phaser.GameObjects.Text;
  private tutorialSkipBtn!: Phaser.GameObjects.Text;
  private inTutorialPractice = false;
  private earnedThisRun = 0;
  private tabHidden = false;
  private onVisibilityChange!: () => void;

  constructor() {
    super("PicnicScene");
  }

  create(): void {
    this.backgroundLayer = this.add.container(0, 0);
    this.drawBackground(this.selectedLocation);
    this.drawTable(this.selectedLocation);
    this.drawJar();
    this.createMen();
    this.createFrenzyBorder();
    this.hud = this.add
      .text(16, 12, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#5c3d1e",
        backgroundColor: "#fff8dc",
        padding: { x: 8, y: 6 },
      })
      .setDepth(20);

    this.objectiveHud = this.add
      .text(WORLD.width / 2, 52, "Goal: empty the jar!", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#5c3d1e",
        backgroundColor: "#fff8dc",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setDepth(20)
      .setAlpha(0);

    this.createMuteButton();
    this.installKeyboardControls();
    this.installTabHidePause();

    this.overlay = this.createStartOverlay();
    this.eventOverlay = this.createEventOverlay();
    this.endOverlay = this.createEndOverlay();
    this.tutorialOverlay = this.createTutorialOverlay();
    this.eventOverlay.setVisible(false);
    this.endOverlay.setVisible(false);
    this.tutorialOverlay.setVisible(false);

    if (!isTutorialCompleted()) {
      this.tutorial.start();
      this.tutorialOverlay.setVisible(true);
      this.refreshTutorialOverlay();
    }

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
          this.qaClickMan(parseInt(k.split("-").pop() || "0"));
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

  private installTabHidePause(): void {
    this.onVisibilityChange = () => {
      this.tabHidden = document.hidden;
      if (this.tabHidden) {
        stopMusic();
        return;
      }
      if (this.state?.running && !isMuted()) {
        startMusic();
        setMusicFrenzy(this.state.frenzy);
      }
    };
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    });
  }

  private installKeyboardControls(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (
        event.key === " " ||
        event.key.startsWith("Arrow") ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
      }

      if (event.key === "m" || event.key === "M") {
        toggleMuted();
        if (isMuted()) {
          stopMusic();
        } else if (this.state?.running) {
          startMusic();
          setMusicFrenzy(this.state.frenzy);
        }
        this.muteBtn.setText(this.muteLabel());
        return;
      }

      if (event.key === "Escape") {
        if (document.querySelector("[data-playtest-feedback-dialog]")) {
          document.querySelector("[data-playtest-feedback-dialog]")?.remove();
          return;
        }
        if (this.tutorialOverlay.visible) {
          this.finishTutorial();
        } else if (this.endOverlay.visible) {
          this.restartRun();
        }
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        if (document.querySelector("[data-playtest-feedback-dialog]") || this.eventOverlay.visible) {
          return;
        }
        if (this.tutorialOverlay.visible) {
          if (!this.tutorialNextBtn.visible) return;
          playClick();
          this.onTutorialNext();
          return;
        }
        if (this.endOverlay.visible) {
          playClick();
          this.restartRun();
          return;
        }
        if (this.overlay.visible) {
          playClick();
          this.beginRun(false);
          return;
        }
      }

      const manIndex = Number.parseInt(event.key, 10) - 1;
      if (manIndex < 0 || manIndex >= MAN_POSITIONS.length || !this.state?.running || this.state.eventPending) {
        return;
      }
      const pos = MAN_POSITIONS[manIndex];
      const visual = this.manVisuals.find((m) => m.id === pos.id);
      if (visual) this.onManChomp(pos.id, visual.head, visual.mouth);
    });
  }

  update(_time: number, delta: number): void {
    if (!this.state || this.tabHidden) return;

    if (this.state.running) {
      const dt = Math.min(delta / 1000, 0.05);
      tick(this.state, dt, this.time.now, defaultRng);

      if (!this.state.frenzy && this.wasFrenzy) {
        setMusicFrenzy(false);
        this.wasFrenzy = false;
      }

      this.syncBlobs(dt);
      this.syncAnts();
      this.updateHud();
      this.updateJarFill();
      this.updateFrenzyBorder();

      if (this.state.ended && !this.inTutorialPractice) {
        this.endRunAudio(this.state.ended);
        this.finalizeRun();
        this.showEndOverlay();
      }
    }

    if (this.state.eventPending) {
      this.eventOverlay.setVisible(true);
    }

    if (this.state.ended && !this.endOverlay.visible && !this.inTutorialPractice) {
      this.finalizeRun();
      this.showEndOverlay();
    }
  }

  private drawBackground(locationId: LocationId): void {
    this.backgroundLayer.removeAll(true);
    const theme = locationDef(locationId);
    this.backgroundLayer.add(
      this.add.rectangle(WORLD.width / 2, WORLD.height * 0.2, WORLD.width, WORLD.height * 0.45, theme.sky),
    );
    this.backgroundLayer.add(
      this.add.rectangle(WORLD.width / 2, WORLD.height * 0.72, WORLD.width, WORLD.height * 0.56, theme.ground),
    );
    if (locationId === "food_truck") {
      const truck = this.add.rectangle(120, WORLD.height * 0.62, 90, 50, 0xe74c3c).setStrokeStyle(2, 0xc0392b);
      const truck2 = this.add
        .rectangle(WORLD.width - 120, WORLD.height * 0.62, 90, 50, 0x3498db)
        .setStrokeStyle(2, 0x2980b9);
      this.backgroundLayer.add(truck);
      this.backgroundLayer.add(truck2);
    }
    if (locationId === "beach") {
      const wave = this.add.ellipse(WORLD.width / 2, WORLD.height * 0.38, WORLD.width * 0.9, 40, 0x4aa3d8, 0.5);
      this.backgroundLayer.add(wave);
    }
  }

  private drawTable(locationId: LocationId): void {
    const theme = locationDef(locationId);
    const g = this.add.graphics();
    g.fillStyle(theme.table, 1);
    g.lineStyle(3, theme.tableBorder, 1);
    g.fillEllipse(WORLD.width / 2, WORLD.height * 0.48, WORLD.width * 0.72, WORLD.height * 0.28);
    g.strokeEllipse(WORLD.width / 2, WORLD.height * 0.48, WORLD.width * 0.72, WORLD.height * 0.28);
    this.backgroundLayer.add(g);
  }

  private drawJar(): void {
    this.add
      .rectangle(WORLD.width / 2, WORLD.height * 0.44, 36, 48, 0x444444)
      .setStrokeStyle(2, 0x222222)
      .setDepth(2);
    this.jarFill = this.add
      .rectangle(WORLD.width / 2, WORLD.height * 0.44 + 8, 28, 32, COLORS.creamy)
      .setDepth(1)
      .setOrigin(0.5, 0.5);
  }

  private createMen(): void {
    for (const pos of MAN_POSITIONS) {
      const glow = this.add.circle(pos.x, pos.y, 36, COLORS.frenzy, 0).setDepth(3);
      const head = this.add
        .circle(pos.x, pos.y, 28, COLORS.skin)
        .setStrokeStyle(3, COLORS.mouth)
        .setInteractive({ useHandCursor: true });
      const mouth = this.add.ellipse(pos.x, pos.y + 10, 24, 12, COLORS.mouth).setDepth(4);
      this.add
        .text(pos.x, pos.y + 38, pos.id, { fontSize: "12px", color: "#3d2914", fontStyle: "bold" })
        .setOrigin(0.5, 0)
        .setDepth(5);

      head.on("pointerdown", () => this.onManChomp(pos.id, head, mouth));
      head.setDepth(6);
      this.manVisuals.push({ id: pos.id, head, mouth, glow });
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
    if (result.hit && result.value > 0) {
      const pos = MAN_POSITIONS.find((m) => m.id === manId)!;
      this.spawnFloatText(pos.x, pos.y - 20, `+${result.value % 1 ? result.value.toFixed(1) : result.value}`);
      playChomp(this.state.chain, result.value >= 3);
    } else if (!result.ended) {
      playMiss();
      const pos = MAN_POSITIONS.find((m) => m.id === manId)!;
      this.spawnMissSplat(pos.x + 20, pos.y + 20);
      this.spawnFloatText(pos.x, pos.y - 10, "miss", 0xd94f4f);
    }

    if (this.tutorial.active) {
      this.tutorial.onChomp(manId, result.hit);
      this.refreshTutorialOverlay();
    }

    if (this.state.frenzy && !this.wasFrenzy) {
      playFrenzy();
      setMusicFrenzy(true);
    }
    this.wasFrenzy = this.state.frenzy;

    this.syncBlobs(0);
    this.updateHud();
    if (result.ended && !this.inTutorialPractice) {
      this.endRunAudio(result.ended);
      this.finalizeRun();
      this.showEndOverlay();
    }
  }

  private spawnMissSplat(x: number, y: number): void {
    const splat = this.add.circle(x, y, 14, COLORS.creamy, 0.85).setStrokeStyle(2, COLORS.mouth).setDepth(15);
    this.tweens.add({
      targets: splat,
      scaleX: 1.6,
      scaleY: 0.5,
      alpha: 0,
      duration: 400,
      onComplete: () => splat.destroy(),
    });
  }

  private endRunAudio(reason: NonNullable<RunState["ended"]>): void {
    stopMusic();
    if (reason === "jar_empty") playWin();
    else playLose();
  }

  private syncBlobs(_dt: number): void {
    if (!this.state) return;
    const live = new Set(this.state.blobs.map((b) => b.id));

    for (const [id, sprite] of this.blobSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.blobSprites.delete(id);
        this.blobDisplayPos.delete(id);
      }
    }

    for (const blob of this.state.blobs) {
      let display = this.blobDisplayPos.get(blob.id);
      if (!display) {
        display = { x: blob.x, y: blob.y, size: blob.size };
        this.blobDisplayPos.set(blob.id, display);
      }

      display.x += (blob.x - display.x) * BLOB_LERP;
      display.y += (blob.y - display.y) * BLOB_LERP;
      if (Math.abs(display.size - blob.size) > 0.5) {
        display.size += (blob.size - display.size) * BLOB_LERP;
      }

      const rx = Math.round(display.x);
      const ry = Math.round(display.y);
      const radius = Math.round(display.size / 2);

      let sprite = this.blobSprites.get(blob.id);
      if (!sprite) {
        sprite = this.add
          .circle(rx, ry, radius, blob.crunchy ? COLORS.crunchy : COLORS.creamy)
          .setStrokeStyle(2, COLORS.mouth)
          .setDepth(3);
        this.blobSprites.set(blob.id, sprite);
      } else {
        sprite.setPosition(rx, ry);
        if (Math.abs(sprite.radius - radius) > 0.5) {
          sprite.setRadius(radius);
        }
        sprite.setFillStyle(blob.crunchy ? COLORS.crunchy : COLORS.creamy);
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
    const missLine = s.tutorialMode
      ? ""
      : `  |  Misses: ${s.missStreak}/5 (${missesUntilStuck(s)} left)`;
    const stickyLine = isSticky(s, now) ? `  |  STICKY ${stickyRemaining(s, now)}s` : "";
    const eventLine = s.activeEvent
      ? `  |  ${TABLE_EVENTS[s.activeEvent].label} ${eventRemaining(s)}s`
      : "";
    const loc = locationDef(s.location).label;
    this.hud.setText(
      `${loc}  |  Spoons: ${Math.floor(s.spoons)}  |  Jar: ${Math.ceil(jarPercent(s))}%  |  Chain: ${s.chain}${missLine}${stickyLine}${eventLine}\n${frenzyLine}`,
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
    this.objectiveHud.setAlpha(s.running && !this.inTutorialPractice ? 1 : 0);
    if (s.running && !this.inTutorialPractice) {
      this.objectiveHud.setText(objectiveLine(s, now));
    }
  }

  private updateJarFill(): void {
    if (!this.state || !this.jarFill) return;
    const pct = jarPercent(this.state) / 100;
    const maxH = 32;
    this.jarFill.displayHeight = Math.max(4, maxH * pct);
    this.jarFill.y = WORLD.height * 0.44 + 8 + (maxH - this.jarFill.displayHeight) / 2;
  }

  private updateManHighlights(): void {
    if (!this.tutorial.active) {
      for (const m of this.manVisuals) m.glow.setFillStyle(COLORS.frenzy, 0);
      return;
    }
    const step = this.tutorial.step;
    for (const m of this.manVisuals) {
      const highlight = (step.waitForChompBy && m.id === step.waitForChompBy) || step.highlightAllMen;
      m.glow.setFillStyle(COLORS.frenzy, highlight ? 0.35 : 0);
    }
  }

  private createStartOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.55);
    const panel = this.add
      .rectangle(WORLD.width / 2, WORLD.height / 2, 420, 480, COLORS.hudBg)
      .setStrokeStyle(4, COLORS.mouth);
    const title = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 195, "Picnic time", {
        fontSize: "24px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 165, "Pick a location & lunch modifier, then tap a man to chomp blobs.", {
        fontSize: "13px",
        color: "#6b5344",
        wordWrap: { width: 360 },
        align: "center",
      })
      .setOrigin(0.5);

    const locLabel = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 135, "Location", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);

    const locButtons: Phaser.GameObjects.Text[] = [];
    LOCATION_IDS.forEach((id, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const theme = locationDef(id);
      const btn = this.add
        .text(WORLD.width / 2 - 95 + col * 190, WORLD.height / 2 - 108 + row * 34, theme.label, {
          fontSize: "11px",
          backgroundColor: id === this.selectedLocation ? "#d4a017" : "#f5e6cc",
          color: id === this.selectedLocation ? "#ffffff" : "#5c3d1e",
          padding: { x: 6, y: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        playClick();
        this.selectedLocation = id;
        this.drawBackground(id);
        this.drawTable(id);
        locButtons.forEach((b, j) => {
          const lid = LOCATION_IDS[j];
          b.setBackgroundColor(lid === id ? "#d4a017" : "#f5e6cc");
          b.setColor(lid === id ? "#ffffff" : "#5c3d1e");
        });
        locBlurb.setText(theme.blurb);
      });
      locButtons.push(btn);
    });

    const locBlurb = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 32, locationDef(this.selectedLocation).blurb, {
        fontSize: "11px",
        color: "#8b7355",
        fontStyle: "italic",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5);

    const modLabel = this.add
      .text(WORLD.width / 2, WORLD.height / 2 - 10, "Lunch modifier", {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);

    const modButtons: Phaser.GameObjects.Text[] = [];
    const mods: ModifierId[] = ["double", "napkins", "crust"];
    mods.forEach((id, i) => {
      const btn = this.add
        .text(WORLD.width / 2 - 100 + i * 100, WORLD.height / 2 + 18, MODIFIERS[id].label, {
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
        modBlurb.setText(MODIFIERS[id].blurb);
      });
      modButtons.push(btn);
    });

    const modBlurb = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 42, MODIFIERS[this.selectedMod].blurb, {
        fontSize: "11px",
        color: "#8b7355",
        fontStyle: "italic",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5);

    const prog = loadProgression();
    const upgradeTitle = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 68, `Upgrades (Credits: ${prog.crustCredits})`, {
        fontSize: "13px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5)
      .setName("startUpgradeTitle");

    const jarBtn = this.add
      .text(
        WORLD.width / 2 - 75,
        WORLD.height / 2 + 98,
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
      .setInteractive({ useHandCursor: true })
      .setName("startJarBtn");

    const spoonBtn = this.add
      .text(
        WORLD.width / 2 + 75,
        WORLD.height / 2 + 98,
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
      .setInteractive({ useHandCursor: true })
      .setName("startSpoonBtn");

    jarBtn.on("pointerdown", () => {
      if (buyUpgrade("deeperJar")) {
        playClick();
        this.refreshStartOverlayShop();
      }
    });

    spoonBtn.on("pointerdown", () => {
      if (buyUpgrade("goldenSpoon")) {
        playClick();
        this.refreshStartOverlayShop();
      }
    });

    const upgradeBlurb = this.add
      .text(
        WORLD.width / 2,
        WORLD.height / 2 + 128,
        `${UPGRADE_BLURBS.deeperJar} ${UPGRADE_BLURBS.goldenSpoon}`,
        {
          fontSize: "10px",
          color: "#8b7355",
          fontStyle: "italic",
          align: "center",
          wordWrap: { width: 360 },
        },
      )
      .setOrigin(0.5);

    const tutorialBtn = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 156, "Replay tutorial", {
        fontSize: "12px",
        color: "#6b5344",
        backgroundColor: "#f5e6cc",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    tutorialBtn.on("pointerdown", () => {
      playClick();
      this.tutorial.start();
      this.overlay.setVisible(false);
      this.tutorialOverlay.setVisible(true);
      this.refreshTutorialOverlay();
    });

    const soundHint = this.add
      .text(
        WORLD.width / 2,
        WORLD.height / 2 + 178,
        "Keys 1–4 chomp Carl–Ed · Enter/Space confirms · M toggles sound · Esc back.",
        {
        fontSize: "11px",
        color: "#8b7355",
        align: "center",
      })
      .setOrigin(0.5);

    const startBtn = this.add
      .text(WORLD.width / 2, WORLD.height / 2 + 208, "Open the jar", {
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
      this.beginRun(false);
    });

    const container = this.add.container(0, 0, [
      bg,
      panel,
      title,
      sub,
      locLabel,
      ...locButtons,
      locBlurb,
      modLabel,
      ...modButtons,
      modBlurb,
      upgradeTitle,
      jarBtn,
      spoonBtn,
      upgradeBlurb,
      tutorialBtn,
      soundHint,
      startBtn,
    ]);
    container.setDepth(50);
    return container;
  }

  /** Keep start-screen credit totals in sync after a run or shop purchase. */
  private refreshStartOverlayShop(): void {
    const prog = loadProgression();
    const upgradeTitle = this.overlay.getByName("startUpgradeTitle") as Phaser.GameObjects.Text | null;
    const jarBtn = this.overlay.getByName("startJarBtn") as Phaser.GameObjects.Text | null;
    const spoonBtn = this.overlay.getByName("startSpoonBtn") as Phaser.GameObjects.Text | null;
    if (!upgradeTitle || !jarBtn || !spoonBtn) return;

    upgradeTitle.setText(`Upgrades (Credits: ${prog.crustCredits})`);
    jarBtn.setText(`${deeperJarLabel(prog.upgrades.deeperJar)}\n[${UPGRADE_COSTS.deeperJar}c]`);
    if (prog.upgrades.goldenSpoon) {
      spoonBtn.setText("Golden Spoon\n[OWNED]");
      spoonBtn.setBackgroundColor("#d4a017");
      spoonBtn.setColor("#ffffff");
    } else {
      spoonBtn.setText(`Golden Spoon\n[${UPGRADE_COSTS.goldenSpoon}c]`);
      spoonBtn.setBackgroundColor("#f5e6cc");
      spoonBtn.setColor("#5c3d1e");
    }
  }

  private createTutorialOverlay(): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x000000, 0.45);
    const panel = this.add
      .rectangle(WORLD.width / 2, WORLD.height - 95, 440, 150, COLORS.hudBg)
      .setStrokeStyle(3, COLORS.mouth);
    this.tutorialTitle = this.add
      .text(WORLD.width / 2, WORLD.height - 145, "", {
        fontSize: "18px",
        fontStyle: "bold",
        color: "#5c3d1e",
      })
      .setOrigin(0.5);
    this.tutorialBody = this.add
      .text(WORLD.width / 2, WORLD.height - 115, "", {
        fontSize: "13px",
        color: "#6b5344",
        wordWrap: { width: 400 },
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.tutorialNextBtn = this.add
      .text(WORLD.width / 2 + 70, WORLD.height - 45, "Next", {
        fontSize: "15px",
        fontStyle: "bold",
        backgroundColor: "#d4a017",
        color: "#ffffff",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tutorialSkipBtn = this.add
      .text(WORLD.width / 2 - 80, WORLD.height - 45, "Skip tutorial", {
        fontSize: "13px",
        color: "#6b5344",
        backgroundColor: "#f5e6cc",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tutorialNextBtn.on("pointerdown", () => this.onTutorialNext());
    this.tutorialSkipBtn.on("pointerdown", () => this.finishTutorial());

    const container = this.add.container(0, 0, [
      bg,
      panel,
      this.tutorialTitle,
      this.tutorialBody,
      this.tutorialNextBtn,
      this.tutorialSkipBtn,
    ]);
    container.setDepth(55);
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
    container.setDepth(56);
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

  private refreshTutorialOverlay(): void {
    const step = this.tutorial.step;
    this.tutorialTitle.setText(step.title);
    this.tutorialBody.setText(step.body);
    const needsAction = !!(step.waitForChompBy || step.waitForAnyChomp);
    this.tutorialNextBtn.setVisible(!needsAction);
    this.tutorialNextBtn.setText(step.id === "done" ? "Start playing" : "Next");
    this.updateManHighlights();

    const practiceSteps = step.id === "tap_carl" || step.id === "tap_any";
    if (practiceSteps && !this.inTutorialPractice) {
      this.beginRun(true);
    }
    if (!practiceSteps && this.inTutorialPractice) {
      this.stopTutorialPractice();
    }
  }

  private onTutorialNext(): void {
    if (this.tutorial.step.id === "done") {
      this.finishTutorial();
      return;
    }
    this.tutorial.tryAdvance();
    if (this.tutorial.completed) {
      this.finishTutorial();
    } else {
      this.refreshTutorialOverlay();
    }
  }

  private finishTutorial(): void {
    this.tutorial.skip();
    this.stopTutorialPractice();
    this.tutorialOverlay.setVisible(false);
    this.overlay.setVisible(true);
    this.updateManHighlights();
  }

  private beginRun(tutorialMode: boolean): void {
    this.inTutorialPractice = tutorialMode;
    this.earnedThisRun = 0;
    for (const [, sprite] of this.blobSprites) sprite.destroy();
    this.blobSprites.clear();
    this.blobDisplayPos.clear();
    for (const [, sprite] of this.antSprites) sprite.destroy();
    this.antSprites.clear();

    this.state = createRun(this.selectedMod, this.selectedLocation, { tutorialMode });
    if (tutorialMode) {
      seedTutorialBlobs(this.state);
    }
    this.wasFrenzy = false;
    this.overlay.setVisible(false);
    this.eventOverlay.setVisible(false);
    this.tutorialOverlay.setVisible(this.tutorial.active);
    this.endOverlay.setVisible(false);
    this.syncBlobs(0);
    this.updateHud();
    this.updateJarFill();
    this.updateManHighlights();
    if (!tutorialMode) {
      startMusic();
      this.maybeShowFirstRunTip();
    }
  }

  /** One-time keyboard shortcut reminder during the player's first real run. */
  private maybeShowFirstRunTip(): void {
    if (!shouldShowFirstRunTip()) return;
    markFirstRunTipShown();
    const tip = this.add
      .text(WORLD.width / 2, WORLD.height - 18, "Tip: 1–4 chomp Carl–Ed · M toggles sound", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#5c3d1e",
        backgroundColor: "#fff8dc",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(25)
      .setAlpha(0.92);
    this.tweens.add({
      targets: tip,
      alpha: 0,
      delay: 5500,
      duration: 1200,
      onComplete: () => tip.destroy(),
    });
  }

  private stopTutorialPractice(): void {
    this.inTutorialPractice = false;
    if (this.state) {
      this.state.running = false;
      this.state = null;
    }
    for (const [, sprite] of this.blobSprites) sprite.destroy();
    this.blobSprites.clear();
    this.blobDisplayPos.clear();
    for (const [, sprite] of this.antSprites) sprite.destroy();
    this.antSprites.clear();
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
    const loc = locationDef(this.state.location).label;

    const prog = loadProgression();
    const hintText = upgradeUnlockHint(prog);
    const hint = hintText ? `\n${hintText}` : "";

    if (this.state.ended === "jar_empty") {
      title.setText("Jar empty!");
      msg.setText(`${loc}\nSpoons: ${Math.floor(this.state.spoons)}\n+${earned} Crust Credits (total: ${total})${hint}`);
    } else {
      title.setText("Stuck Shut!");
      msg.setText(`Too much peanut butter.\n${loc}\n+${earned} Crust Credits (total: ${total})${hint}`);
    }
    this.endOverlay.setVisible(true);
  }

  private openPlaytestFeedback(): void {
    if (!this.state?.ended) return;
    playClick();
    openPlaytestFeedbackDialog(createPlaytestRunSummary(this.state));
  }

  private restartRun(): void {
    playClick();
    for (const [, sprite] of this.blobSprites) sprite.destroy();
    this.blobSprites.clear();
    this.blobDisplayPos.clear();
    for (const [, sprite] of this.antSprites) sprite.destroy();
    this.antSprites.clear();
    this.floatTexts.forEach((t) => t.destroy());
    this.floatTexts = [];
    this.endOverlay.setVisible(false);
    this.refreshStartOverlayShop();
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
      tutorialActive: this.tutorial.active,
    };
  }

  public qaClickStart(): void {
    if (this.overlay.visible) {
      this.beginRun(false);
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

      this.syncBlobs(0);
      this.updateHud();
      if (result.ended && !this.inTutorialPractice) {
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

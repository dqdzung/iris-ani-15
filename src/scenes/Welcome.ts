import Phaser from "phaser";
import { vw, vh, u, fs } from "../layout";

// The mountain is authored in a fixed design box (DW×DH). At runtime we map that box
// onto the live viewport: fill the width, anchor to the bottom, sky fills above.
// X()/Y()/L() convert design coords/lengths to screen (device px). Path/markers/
// climber ride this transform; the title + START button sit at the viewport edges.
const DW = 960;
const DH = 540;

// Trail up the mountain face (design units). Each stage is a corner:
//   base → up to 1 → across-right to 2 → steep up to 3 → across-up to 4 → summit.
const BASE = { x: 250, y: 458 };
const PATH = [
  BASE,
  { x: 330, y: 372 }, // ← stage 1
  { x: 590, y: 350 }, // ← stage 2
  { x: 430, y: 248 }, // ← stage 3
  { x: 478, y: 166 }, // ← stage 4
  { x: 480, y: 90 }, // summit
];
const STEP_IDX = [1, 2, 3, 4]; // PATH indices of the 4 stage markers

export class Welcome extends Phaser.Scene {
  private cleared = 0; // stages completed so far (0..4)
  private s = 1; // design→screen scale
  private portrait = false;
  private startBand = 0; // reserved bottom strip for the START button (portrait)
  private startY = 0;
  private X = (x: number) => x;
  private Y = (y: number) => y;
  private L = (n: number) => n;

  constructor() {
    super("Welcome");
  }

  init(data: { cleared?: number } = {}) {
    this.cleared = data.cleared ?? 0;
  }

  // design-unit font size (rides the mountain scale)
  private ds(n: number) {
    return `${Math.max(1, Math.round(n * this.s))}px`;
  }

  create() {
    // all 4 stages cleared → straight to the finish, no summit climb
    if (this.cleared >= STEP_IDX.length) {
      this.scene.start("Final");
      return;
    }

    // Map the design box onto the viewport, anchored to the bottom.
    //   landscape → fill the width (cap the scale so the summit never clips off top)
    //   portrait  → scale up and center on the trail, leaving a top margin for the
    //               title and a bottom band for START, so nothing clips or overlaps
    const W = vw(this),
      H = vh(this);
    this.portrait = H > W;
    let ox: number, oy: number;
    if (this.portrait) {
      const topMargin = 100 * u(this);
      this.startBand = 120 * u(this);
      // fit the trail's full x-range (~[235,603]) with margin so it clears the edges
      this.s = Math.min(W / 430, (H - this.startBand - topMargin) / 450);
      ox = W / 2 - 420 * this.s; // 420 = midpoint of the trail's x-range
      oy = H - this.startBand - DH * this.s; // base sits above the START band
      this.startY = H - this.startBand / 2;
    } else {
      this.s = Math.min(W / DW, H / 450);
      ox = (W - DW * this.s) / 2;
      oy = H - DH * this.s;
      this.startY = H - 46 * u(this);
    }
    this.X = (x) => ox + x * this.s;
    this.Y = (y) => oy + y * this.s;
    this.L = (n) => n * this.s;

    this.input.setDefaultCursor("default"); // restore cursor (stages may hide it)
    this.cameras.main.fadeIn(250);
    this.drawSky();
    this.drawMountain();
    // portrait: dark ground band under the mountain base → clean home for START
    if (this.portrait) {
      this.add
        .rectangle(0, vh(this) - this.startBand, vw(this), this.startBand, 0x161a26)
        .setOrigin(0);
    }
    this.drawPath();

    // climber sits at the current step (base before any stage is cleared)
    const startIdx = this.cleared === 0 ? 0 : STEP_IDX[this.cleared - 1];
    const start = PATH[startIdx];
    const climber = this.add
      .text(this.X(start.x), this.Y(start.y), "🧗", {
        fontSize: this.ds(36),
        padding: { y: 8 },
      })
      .setOrigin(0.5, 1)
      .setDepth(10);

    if (this.cleared === 0) {
      this.add
        .text(vw(this) / 2, 34 * u(this), "iris-ani-15", {
          fontSize: fs(this, 40),
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0)
        .setDepth(20);

      this.makeStartButton(() => {
        this.walkTo(climber, 0, STEP_IDX[0], () =>
          this.scene.start("StageCard", { stage: 1, mode: "intro" }),
        );
      });
    } else {
      // returning from a cleared stage: climb to the next step, then enter it
      this.time.delayedCall(500, () =>
        this.walkTo(climber, startIdx, STEP_IDX[this.cleared], () =>
          this.scene.start("StageCard", {
            stage: this.cleared + 1,
            mode: "intro",
          }),
        ),
      );
    }
  }

  // Chain-tween the climber along PATH from index `from` (exclusive) to `to`, paced
  // by segment length; a squash+lean gives a clambering feel; on arrival, zoom in.
  private walkTo(
    climber: Phaser.GameObjects.Text,
    from: number,
    to: number,
    onDone: () => void,
  ) {
    const squash = this.tweens.add({
      targets: climber,
      scaleY: 0.88,
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const lean = this.tweens.add({
      targets: climber,
      angle: { from: -7, to: 7 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const tweens = [];
    for (let i = from + 1; i <= to; i++) {
      const a = PATH[i - 1];
      const b = PATH[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      tweens.push({
        x: this.X(b.x),
        y: this.Y(b.y),
        duration: Math.max(300, dist * 3),
        ease: "Sine.easeInOut",
      });
    }
    this.tweens.chain({
      targets: climber,
      tweens,
      onComplete: () => {
        squash.stop();
        lean.stop();
        climber.setScale(1).setAngle(0);
        this.zoomIntoStep(PATH[to], onDone);
      },
    });
  }

  // Pan + zoom into the reached step, then fade out and continue.
  private zoomIntoStep(step: { x: number; y: number }, onDone: () => void) {
    const cam = this.cameras.main;
    cam.pan(this.X(step.x), this.Y(step.y), 800, "Sine.easeInOut");
    cam.zoomTo(12, 800, "Sine.easeInOut");
    cam.once("camerapancomplete", () => cam.fadeOut(220));
    cam.once("camerafadeoutcomplete", onDone);
  }

  private drawSky() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x2f5a8c, 0x2f5a8c, 0x7fa8cf, 0x7fa8cf, 1);
    g.fillRect(0, 0, vw(this), vh(this)); // fills the whole viewport
  }

  private drawMountain() {
    // three depth layers, back (hazy) to front (dark); main peak center.
    const fill = (color: number, pts: number[][]) => {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(this.X(pts[0][0]), this.Y(pts[0][1]));
      for (const [x, y] of pts) g.lineTo(this.X(x), this.Y(y));
      g.closePath();
      g.fillPath();
    };

    fill(0x4a6a92, [
      [0, 540], [0, 395], [140, 355], [300, 388], [460, 350], [620, 385],
      [780, 350], [920, 385], [960, 368], [960, 540],
    ]);
    fill(0x2a3850, [
      [0, 540], [0, 445], [180, 405], [360, 438], [560, 410], [760, 440],
      [900, 415], [960, 428], [960, 540],
    ]);
    fill(0x161a26, [
      [0, 540], [110, 478], [250, 362], [360, 250], [440, 152], [480, 90],
      [542, 188], [606, 300], [662, 268], [726, 360], [828, 452], [960, 502],
      [960, 540],
    ]);
    // snow cap — edges routed through the slope vertices so nothing peeks out
    fill(0xe8eef7, [
      [480, 90], [440, 152], [381, 224],
      [418, 206], [448, 216], [480, 202], [512, 216], [544, 206],
      [562, 224], [542, 188],
    ]);
  }

  private drawPath() {
    const g = this.add.graphics();
    const last = STEP_IDX[STEP_IDX.length - 1];
    g.lineStyle(this.L(3), 0xffffff, 0.3);
    g.beginPath();
    g.moveTo(this.X(PATH[0].x), this.Y(PATH[0].y));
    for (let i = 1; i <= last; i++) g.lineTo(this.X(PATH[i].x), this.Y(PATH[i].y));
    g.strokePath();

    STEP_IDX.forEach((idx, i) => {
      const p = PATH[idx];
      this.add
        .circle(this.X(p.x), this.Y(p.y), this.L(13), 0x12141c)
        .setStrokeStyle(this.L(2), 0xffd166)
        .setDepth(5);
      this.add
        .text(this.X(p.x), this.Y(p.y), String(i + 1), {
          fontSize: this.ds(16),
          color: "#ffd166",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(6);
    });
  }

  private makeStartButton(onClick: () => void) {
    const U = u(this);
    const x = vw(this) / 2;
    const y = this.startY;
    const w = 170 * U;
    const h = 50 * U;

    const g = this.add.graphics().setDepth(20);
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12 * U);

    const label = this.add
      .text(x, y, "START", {
        fontSize: fs(this, 24),
        color: "#12141c",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(21);

    label
      .setInteractive(
        new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
        Phaser.Geom.Rectangle.Contains,
      )
      .on("pointerover", () => this.input.setDefaultCursor("pointer"))
      .on("pointerout", () => this.input.setDefaultCursor("default"))
      .once("pointerdown", () => {
        label.disableInteractive();
        g.setAlpha(0.4);
        label.setAlpha(0.4);
        this.input.setDefaultCursor("default");
        onClick();
      });
  }
}

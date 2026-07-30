import Phaser from "phaser";
import { GAME_W, GAME_H, S, px } from "../main";

// Layout is authored in design units; k() scales a design coord to render space.
const k = (n: number) => n * S;

// Trail up the mountain face (design units). Each stage is a corner:
//   base → up to 1 → diagonal across-right to 2 → steep up to 3 → across-up to 4 → summit.
// Every point sits on the dark face (left of the summit apex, below the ridge).
const BASE = { x: 250, y: 458 };
const PATH = [
  BASE,
  { x: 330, y: 372 }, // ← stage 1  (straight up)
  { x: 590, y: 350 }, // ← stage 2  (across & up, on the right)
  { x: 430, y: 248 }, // ← stage 3  (steep up)
  { x: 478, y: 166 }, // ← stage 4  (across & up)
  { x: 480, y: 90 }, // summit
];
const STEP_IDX = [1, 2, 3, 4]; // PATH indices of the 4 stage markers

export class Welcome extends Phaser.Scene {
  private cleared = 0; // stages completed so far (0..4)

  constructor() {
    super("Welcome");
  }

  init(data: { cleared?: number } = {}) {
    this.cleared = data.cleared ?? 0;
  }

  create() {
    // all 4 stages cleared → straight to the finish, no summit climb
    if (this.cleared >= STEP_IDX.length) {
      this.scene.start("Final");
      return;
    }

    this.cameras.main.fadeIn(250);
    this.drawSky();
    this.drawMountain();
    this.drawPath();

    // climber sits at the current step (base before any stage is cleared)
    const startIdx = this.cleared === 0 ? 0 : STEP_IDX[this.cleared - 1];
    const start = PATH[startIdx];
    const climber = this.add
      .text(k(start.x), k(start.y), "🧗", { fontSize: px(36), padding: { y: 8 } })
      .setOrigin(0.5, 1)
      .setDepth(10);

    if (this.cleared === 0) {
      this.add
        .text(k(GAME_W / 2), k(50), "iris-ani-15", {
          fontSize: px(40),
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(20);

      this.makeStartButton(() => {
        // climber follows the trail up to stage 1's corner, then we enter it
        this.walkTo(climber, 0, STEP_IDX[0], () =>
          this.scene.start("Stage", { stage: 1 }),
        );
      });
    } else {
      // returning from a cleared stage: climb to the next step, then enter it
      this.time.delayedCall(500, () =>
        this.walkTo(climber, startIdx, STEP_IDX[this.cleared], () =>
          this.scene.start("Stage", { stage: this.cleared + 1 }),
        ),
      );
    }
  }

  // Chain-tween the climber along PATH from index `from` (exclusive) to `to`,
  // paced by segment length. A layered squash + lean gives a clambering feel;
  // on arrival, zoom the camera into the step and hand off to `onDone`.
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
        x: k(b.x),
        y: k(b.y),
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

  // Zoom into the reached step (pan + zoom together so it dives onto the step),
  // then fade out and continue.
  private zoomIntoStep(step: { x: number; y: number }, onDone: () => void) {
    const cam = this.cameras.main;
    // center on the stage marker (the number) and push the zoom all the way in
    cam.pan(k(step.x), k(step.y), 800, "Sine.easeInOut");
    cam.zoomTo(12, 800, "Sine.easeInOut");
    cam.once("camerapancomplete", () => cam.fadeOut(220));
    cam.once("camerafadeoutcomplete", onDone);
  }

  private drawSky() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x2f5a8c, 0x2f5a8c, 0x7fa8cf, 0x7fa8cf, 1);
    g.fillRect(0, 0, k(GAME_W), k(GAME_H));
  }

  private drawMountain() {
    // three depth layers, back (lightest/hazy) to front (darkest); main peak center.
    const fill = (color: number, pts: number[][]) => {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(k(pts[0][0]), k(pts[0][1]));
      for (const [x, y] of pts) g.lineTo(k(x), k(y));
      g.closePath();
      g.fillPath();
    };

    // far range: hazy, low, gentle — distant hills for depth
    fill(0x4a6a92, [
      [0, 540], [0, 395], [140, 355], [300, 388], [460, 350], [620, 385],
      [780, 350], [920, 385], [960, 368], [960, 540],
    ]);

    // mid range: a bit nearer and darker, still well below the summit
    fill(0x2a3850, [
      [0, 540], [0, 445], [180, 405], [360, 438], [560, 410], [760, 440],
      [900, 415], [960, 428], [960, 540],
    ]);

    // near range: THE mountain — one dominant Everest pyramid, summit center,
    // clean shoulders with a single subordinate bump on the right.
    fill(0x161a26, [
      [0, 540], [110, 478], [250, 362], [360, 250], [440, 152], [480, 90],
      [542, 188], [606, 300], [662, 268], [726, 360], [828, 452], [960, 502],
      [960, 540],
    ]);

    // snow cap: hug the mountain's silhouette on both sides by routing the cap
    // edges through the slope vertices (440,152) / (542,188) — a straight apex→base
    // line would cut inside the bend and let the dark mountain peek out.
    fill(0xe8eef7, [
      [480, 90], // summit apex
      [440, 152], // left slope bend
      [381, 224], // left snow-line base (on the lower-left slope)
      [418, 206], [448, 216], [480, 202], [512, 216], [544, 206], // gentle snow line
      [562, 224], // right snow-line base (on the lower-right slope)
      [542, 188], // right slope bend, then close back to the apex
    ]);
  }

  private drawPath() {
    const g = this.add.graphics();
    // draw only up to the last stage marker (no line on to the summit)
    const last = STEP_IDX[STEP_IDX.length - 1];
    g.lineStyle(k(3), 0xffffff, 0.3);
    g.beginPath();
    g.moveTo(k(PATH[0].x), k(PATH[0].y));
    for (let i = 1; i <= last; i++) g.lineTo(k(PATH[i].x), k(PATH[i].y));
    g.strokePath();

    // numbered step markers on the 4 switchback corners
    STEP_IDX.forEach((idx, i) => {
      const p = PATH[idx];
      this.add
        .circle(k(p.x), k(p.y), k(13), 0x12141c)
        .setStrokeStyle(k(2), 0xffd166)
        .setDepth(5);
      this.add
        .text(k(p.x), k(p.y), String(i + 1), {
          fontSize: px(16),
          color: "#ffd166",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(6);
    });
  }

  private makeStartButton(onClick: () => void) {
    const x = k(GAME_W / 2);
    const y = k(GAME_H - 60);
    const w = k(180);
    const h = k(54);

    const g = this.add.graphics().setDepth(20);
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, k(12));

    const label = this.add
      .text(x, y, "START", {
        fontSize: px(24),
        color: "#12141c",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(21);

    // one interactive object drives both the graphics and the label
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

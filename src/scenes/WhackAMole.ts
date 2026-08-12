import Phaser from "phaser";
import { S, px, FONT } from "../config";
import { fitStage, clearStage, retryStage } from "../stageUtils";

// Stage 2 — Whack-a-Mole (ported from MiniGames). Clear = survive the 30s round.
// A bomb whack drains the clock; if it hits 0 early, that's a fail → retry.

const GW = 480 * S;
const GH = 540 * S; // grass below is a square (GW tall); the rest is a thin sky band

// Field palette — dark & gold-accented to match the rest of the game. Tweak here.
const SKY = 0x12141c; // top band (same dark as the intro/finale panels)
const GROUND = 0x222717; // dark muted "grass"
const HOLE_RIM = 0x4a3f22; // raised earth ring (gold-brown, nods to the accent)
const HOLE_HOLLOW = 0x0c0e08; // near-black hollow

const GAME_TIME = 30;
const POP_INTERVAL = 595;
const UP_TIME = 650;
const BOMB_CHANCE = 0.2;
const BOMB_PENALTY = 3;
const REST_ANGLE = 40; // whacker resting tilt (raised, diagonal like the old hammer)
const STRIKE_ANGLE = -20; // chops DOWN past horizontal on a swing (top → bottom)
const BOSS_BOX = 84; // boss image is fit into this square (design units)
// Boss (penalty) variants — one is picked at random (equal odds) each time a
// penalty pops. Each has a normal frame and a whacked "dizzy" frame.
const BOSSES = [
  { normal: "wm-boss1", dizzy: "wm-boss1-dizzy" },
  { normal: "wm-boss2", dizzy: "wm-boss2-dizzy" },
];

// symmetric 3×3 grid as fractions of the grass square → centered, evenly spaced
const GRID = [0.25, 0.5, 0.75];

type Hole = {
  x: number;
  y: number;
  mole: Phaser.GameObjects.Text; // the 👾 bug (reward target)
  boss: Phaser.GameObjects.Image; // the boss (penalty, was the bomb)
  bossKind: { normal: string; dizzy: string }; // which boss variant is on this pop
  actor: Phaser.GameObjects.Text | Phaser.GameObjects.Image; // whichever is popped
  upY: number;
  downY: number;
  up: boolean;
  moving: boolean;
  bomb: boolean;
  duck: Phaser.Time.TimerEvent | null;
};

export class WhackAMole extends Phaser.Scene {
  private stage = 2;
  private score = 0;
  private timeLeft = GAME_TIME;
  private over = false;
  private holes: Hole[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private hammer!: Phaser.GameObjects.Text;
  private popTimer!: Phaser.Time.TimerEvent;

  constructor() {
    super("WhackAMole");
  }

  init(data: { stage?: number } = {}) {
    this.stage = data.stage ?? 2;
  }

  preload() {
    this.load.image("wm-boss1", "/whack-a-mole/boss1.png");
    this.load.image("wm-boss1-dizzy", "/whack-a-mole/boss1-dizzy.png");
    this.load.image("wm-boss2", "/whack-a-mole/boss2.png");
    this.load.image("wm-boss2-dizzy", "/whack-a-mole/boss2-dizzy.png");
  }

  create() {
    this.score = 0;
    this.timeLeft = GAME_TIME;
    this.over = false;
    this.holes = [];

    fitStage(this, GW, GH);

    // field: sky on top, grass fills the rest as a square (height == canvas width)
    const skyH = GH - GW;
    this.add.rectangle(0, 0, GW, GH, SKY).setOrigin(0);
    this.add.rectangle(0, skyH, GW, GH - skyH, GROUND).setOrigin(0);

    this.holes = [];
    for (const ry of GRID)
      for (const cx of GRID) this.makeHole(cx * GW, skyH + ry * GW);

    this.scoreText = this.add
      .text(16 * S, 12 * S, "Score: 0", {
        fontFamily: FONT, fontSize: px(20),
        color: "#ffd166",
        fontStyle: "bold",
        padding: { y: 6 },
      })
      .setDepth(50);
    this.timeText = this.add
      .text(GW - 16 * S, 12 * S, "Time: " + GAME_TIME, {
        fontFamily: FONT, fontSize: px(20),
        color: "#ffd166",
        fontStyle: "bold",
        padding: { y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(50);

    this.hammer = this.add
      .text(GW / 2, GH / 2, "⌨️", { fontFamily: FONT, fontSize: px(52), padding: { y: 8 } })
      .setOrigin(0.82, 0.85)
      .setDepth(100)
      .setAngle(REST_ANGLE);
    const HEAD = 0.28;
    const offX = (0.82 - HEAD) * this.hammer.width,
      offY = (0.85 - HEAD) * this.hammer.height;
    const place = (x: number, y: number) =>
      this.hammer.setPosition(x + offX, y + offY);
    place(GW / 2, GH / 2);
    this.input.setDefaultCursor("none");
    this.input.on("pointermove", (p: Phaser.Input.Pointer) =>
      place(p.worldX, p.worldY),
    );
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      place(p.worldX, p.worldY);
      this.swing();
    });

    this.popTimer = this.time.addEvent({
      delay: POP_INTERVAL,
      loop: true,
      callback: this.popRandom,
      callbackScope: this,
    });
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tick,
      callbackScope: this,
    });
  }

  private makeHole(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(HOLE_RIM, 1);
    g.fillEllipse(x, y + 8 * S, 108 * S, 52 * S);
    g.fillStyle(HOLE_HOLLOW, 1);
    g.fillEllipse(x, y, 82 * S, 34 * S);

    const upY = y - 22 * S,
      downY = y + 64 * S;
    const maskG = this.make.graphics();
    maskG.fillStyle(0xffffff);
    maskG.fillRect(0, 0, GW, y + 6 * S);
    const mask = maskG.createGeometryMask();

    const mole = this.add
      .text(x, downY, "👾", { fontFamily: FONT, fontSize: px(46), padding: { y: 8 } })
      .setOrigin(0.5, 0.5)
      .setDepth(10)
      .setMask(mask);

    // boss image (penalty) sits in the same hole, popped instead of the bug
    const boss = this.add.image(x, downY, BOSSES[0].normal).setOrigin(0.5, 0.5).setDepth(10);
    boss.setMask(mask);

    const hole: Hole = {
      x,
      y,
      mole,
      boss,
      bossKind: BOSSES[0],
      actor: mole,
      upY,
      downY,
      up: false,
      moving: false,
      bomb: false,
      duck: null,
    };
    this.bossFrame(hole, hole.bossKind.normal); // set the boss image + its fit scale
    const pad = 16 * S;
    for (const o of [mole, boss] as const) {
      o.setInteractive(
        new Phaser.Geom.Rectangle(-pad, -pad, o.width + pad * 2, o.height + pad * 2),
        Phaser.Geom.Rectangle.Contains,
      );
      o.on("pointerdown", () => this.whack(hole));
    }
    this.holes.push(hole);
  }

  // swap the boss texture (normal / dizzy) and re-fit it into BOSS_BOX
  private bossFrame(h: Hole, key: string) {
    h.boss.setTexture(key);
    const src = this.textures.get(key).getSourceImage();
    h.boss.setScale(Math.min((BOSS_BOX * S) / src.width, (BOSS_BOX * S) / src.height));
  }

  private popRandom() {
    if (this.over) return;
    const down = this.holes.filter((h) => !h.up && !h.moving);
    if (!down.length) return;
    const h = Phaser.Utils.Array.GetRandom(down);
    h.bomb = Math.random() < BOMB_CHANCE;
    if (h.bomb) {
      h.bossKind = Phaser.Utils.Array.GetRandom(BOSSES); // equal odds boss1 / boss2
      this.bossFrame(h, h.bossKind.normal);
    }
    h.actor = h.bomb ? h.boss : h.mole; // pop the boss (penalty) or the bug
    h.up = true;
    h.moving = true;
    this.tweens.add({
      targets: h.actor,
      y: h.upY,
      duration: 130,
      ease: "Back.easeOut",
      onComplete: () => (h.moving = false),
    });
    h.duck = this.time.delayedCall(UP_TIME, () => this.duckHole(h));
  }

  private duckHole(h: Hole) {
    if (!h.up) return;
    h.up = false;
    h.moving = true;
    if (h.duck) h.duck.remove();
    this.tweens.add({
      targets: h.actor,
      y: h.downY,
      duration: 110,
      ease: "Quad.easeIn",
      onComplete: () => (h.moving = false),
    });
  }

  private whack(h: Hole) {
    if (this.over || !h.up) return;
    if (h.bomb) {
      this.timeLeft = Math.max(0, this.timeLeft - BOMB_PENALTY);
      this.timeText.setText("Time: " + this.timeLeft);
      this.boom(h.x, h.upY, "💥", 56);
      this.penaltyPop(h.x, h.upY);
      this.cameras.main.shake(140, 0.006);
      // show the dizzy boss frame, hold a beat, then duck it and reset to normal
      this.bossFrame(h, h.bossKind.dizzy);
      h.up = false; // no more whacks on this pop
      h.moving = true;
      if (h.duck) h.duck.remove();
      this.time.delayedCall(350, () => {
        this.tweens.add({
          targets: h.boss,
          y: h.downY,
          duration: 110,
          ease: "Quad.easeIn",
          onComplete: () => {
            h.moving = false;
            this.bossFrame(h, h.bossKind.normal);
          },
        });
      });
      if (this.timeLeft <= 0) this.endGame(false); // bomb ran the clock out → fail
      return;
    }
    this.score += 1;
    this.scoreText.setText("Score: " + this.score);
    this.stun(h);
  }

  private stun(h: Hole) {
    if (h.duck) h.duck.remove();
    h.up = false;
    h.moving = true;
    const dizzy = this.add
      .text(h.x, h.upY - 6 * S, "💫", { fontFamily: FONT, fontSize: px(24), padding: { y: 8 } })
      .setOrigin(0.45)
      .setAngle(-45)
      .setDepth(20);
    this.tweens.add({
      targets: dizzy,
      y: h.upY - 40 * S,
      duration: 150,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: [h.actor, dizzy],
      alpha: 0,
      duration: 160,
      delay: 110,
      onComplete: () => {
        dizzy.destroy();
        h.actor.setAlpha(1).setY(h.downY);
        h.moving = false;
      },
    });
  }

  private penaltyPop(x: number, y: number) {
    const t = this.add
      .text(x, y - 6 * S, "-" + BOMB_PENALTY + "s", {
        fontFamily: FONT, fontSize: px(22),
        color: "#ef476f",
        fontStyle: "bold",
        padding: { y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({
      targets: t,
      y: y - 44 * S,
      duration: 150,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 300,
      delay: 130,
      onComplete: () => t.destroy(),
    });
  }

  private boom(x: number, y: number, symbol: string, size = 40) {
    const b = this.add
      .text(x, y, symbol, { fontFamily: FONT, fontSize: px(size), padding: { y: 8 } })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({
      targets: b,
      scale: { from: 0.6, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 320,
      onComplete: () => b.destroy(),
    });
  }

  private swing() {
    this.tweens.killTweensOf(this.hammer);
    this.hammer.setAngle(REST_ANGLE);
    this.tweens.add({
      targets: this.hammer,
      angle: STRIKE_ANGLE, // chop down from the resting tilt, then back
      duration: 55,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  private tick() {
    if (this.over) return;
    this.timeLeft -= 1;
    this.timeText.setText("Time: " + this.timeLeft);
    if (this.timeLeft <= 0) this.endGame(true); // survived the round → clear
  }

  private endGame(survived: boolean) {
    this.over = true;
    this.input.setDefaultCursor("default"); // show cursor for the end-screen buttons
    this.popTimer.remove();
    this.holes.forEach((h) => this.duckHole(h));
    this.add
      .rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.75)
      .setDepth(90);
    this.add
      .text(GW / 2, GH / 2 - 26 * S, survived ? "Cleared! ⛳" : "Urgh! 💥", {
        fontFamily: FONT, fontSize: px(34),
        color: "#fff",
        fontStyle: "bold",
        padding: { y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(91);

    if (survived) {
      this.add
        .text(GW / 2, GH / 2 + 30 * S, "Score: " + this.score, {
          fontFamily: FONT, fontSize: px(18),
          color: "#8a8fa3",
          align: "center",
          padding: { y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(91);
      this.time.delayedCall(900, () => clearStage(this, this.stage));
    } else {
      this.add
        .text(GW / 2, GH / 2 + 24 * S, "You're fired for whacking the bosses too much", {
          fontFamily: FONT, fontSize: px(16),
          color: "#8a8fa3",
          padding: { y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(91);
      const btn = this.add
        .rectangle(GW / 2, GH / 2 + 74 * S, 200 * S, 52 * S, 0xffd166)
        .setDepth(91)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(GW / 2, GH / 2 + 74 * S, "Try Again", {
          fontFamily: FONT, fontSize: px(20),
          color: "#12141c",
          fontStyle: "bold",
          padding: { y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(92);
      btn.on("pointerdown", () => retryStage(this, this.stage));
    }
  }
}

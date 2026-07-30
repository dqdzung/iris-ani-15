import Phaser from "phaser";
import { GAME_W, GAME_H, S, px, STAGES } from "../config";

// Reusable full-screen card shown around each stage:
//   mode "intro" — after the climb/zoom, before the game (title + how-to → begin)
//   mode "clear" — after the game, before the climb to the next step (→ continue)
const k = (n: number) => n * S;

export class StageCard extends Phaser.Scene {
  private stage = 1;
  private mode: "intro" | "clear" = "intro";

  constructor() {
    super("StageCard");
  }

  init(data: { stage?: number; mode?: "intro" | "clear" } = {}) {
    this.stage = data.stage ?? 1;
    this.mode = data.mode ?? "intro";
  }

  create() {
    this.input.setDefaultCursor("default"); // a prior game may have hidden it
    const cam = this.cameras.main;
    cam.setBackgroundColor("#12141c");
    cam.fadeIn(220);

    const info = STAGES[this.stage - 1];
    const cx = k(GAME_W / 2);

    // stage number badge (matches the overworld markers)
    const badgeY = k(this.mode === "intro" ? 175 : 195);
    this.add.circle(cx, badgeY, k(30), 0x12141c).setStrokeStyle(k(3), 0xffd166);
    this.add
      .text(cx, badgeY, String(this.stage), {
        fontSize: px(30),
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    if (this.mode === "intro") {
      this.add
        .text(cx, k(240), info.title, {
          fontSize: px(42),
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, k(300), info.how, {
          fontSize: px(18),
          color: "#8a8fa3",
          align: "center",
          wordWrap: { width: k(560) },
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(cx, k(270), info.title, {
          fontSize: px(30),
          color: "#8a8fa3",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, k(320), "Cleared! ⛳", {
          fontSize: px(44),
          color: "#ffd166",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(
        cx,
        k(410),
        this.mode === "intro" ? "tap to begin" : "tap to continue",
        { fontSize: px(20), color: "#ffd166" },
      )
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.3 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.input.once("pointerdown", () => {
      cam.fadeOut(200);
      cam.once("camerafadeoutcomplete", () => {
        if (this.mode === "intro") this.scene.start(info.key, { stage: this.stage });
        else this.scene.start("Welcome", { cleared: this.stage });
      });
    });
  }
}

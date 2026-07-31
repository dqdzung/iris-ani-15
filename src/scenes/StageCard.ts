import Phaser from "phaser";
import { STAGES } from "../config";
import { vw, vh, u, fs } from "../layout";
import { showOverworld } from "../overworld";

// Reusable full-screen card shown around each stage:
//   mode "intro" — after the climb/zoom, before the game (title + how-to → begin)
//   mode "clear" — after the game, before the climb to the next step (→ continue)

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
    const U = u(this);
    const cx = vw(this) / 2;
    const cy = vh(this) / 2;

    // stage number badge (matches the overworld markers)
    const badgeY = cy - 120 * U;
    this.add.circle(cx, badgeY, 30 * U, 0x12141c).setStrokeStyle(3 * U, 0xffd166);
    this.add
      .text(cx, badgeY, String(this.stage), {
        fontSize: fs(this, 30),
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    if (this.mode === "intro") {
      this.add
        .text(cx, cy - 40 * U, info.title, {
          fontSize: fs(this, 42),
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, cy + 20 * U, info.how, {
          fontSize: fs(this, 18),
          color: "#8a8fa3",
          align: "center",
          wordWrap: { width: Math.min(vw(this) * 0.86, 560 * U) },
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(cx, cy - 10 * U, info.title, {
          fontSize: fs(this, 30),
          color: "#8a8fa3",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, cy + 40 * U, "Cleared! ⛳", {
          fontSize: fs(this, 44),
          color: "#ffd166",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(
        cx,
        cy + 130 * U,
        this.mode === "intro" ? "tap to begin" : "tap to continue",
        { fontSize: fs(this, 20), color: "#ffd166" },
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

    // If the upcoming game needs Pointer Lock, engage it on THIS click — it must
    // come from a native DOM gesture (Phaser's own events fire off-gesture, so
    // requestPointerLock() there is blocked). The lock persists into the game scene.
    if (this.mode === "intro" && info.lock) {
      const canvas = this.sys.game.canvas;
      const onDown = () => this.input.mouse?.requestPointerLock();
      canvas.addEventListener("mousedown", onDown);
      this.events.once("shutdown", () =>
        canvas.removeEventListener("mousedown", onDown),
      );
    }

    this.input.once("pointerdown", () => {
      cam.fadeOut(200);
      cam.once("camerafadeoutcomplete", () => {
        if (this.mode === "intro") {
          this.scene.start(info.key, { stage: this.stage });
        } else {
          // clear card → back to the DOM overworld, which climbs to the next stage
          this.scene.stop();
          showOverworld(this.stage);
        }
      });
    });
  }
}

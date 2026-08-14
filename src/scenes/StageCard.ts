import Phaser from "phaser";
import { STAGES, FONT } from "../config";
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

  private fly = false;

  init(data: { stage?: number; mode?: "intro" | "clear"; fly?: boolean } = {}) {
    this.stage = data.stage ?? 1;
    this.mode = data.mode ?? "intro";
    this.fly = data.fly ?? false; // entered via the IRIS letter fly-in
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

    // stage badge — labelled with the IRIS letter (I R I S) so the boot screen's
    // zooming "I" dissolves straight into the stage-1 badge. Monospace to match it.
    const label = "IRIS"[this.stage - 1] ?? String(this.stage);
    const badgeY = cy - 120 * U;
    this.add.circle(cx, badgeY, 30 * U, 0x12141c).setStrokeStyle(3 * U, 0xffd166);
    const badge = this.add
      .text(cx, badgeY, label, {
        fontFamily: FONT,
        fontSize: fs(this, 30),
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // When entered via the fly-in, the incoming letter is still travelling to this
    // badge — hold the badge letter back so it crossfades in as the flyer arrives,
    // instead of showing early and reading as two letters.
    if (this.fly) {
      badge.setAlpha(0);
      this.tweens.add({ targets: badge, alpha: 1, delay: 600, duration: 300 });
    }

    if (this.mode === "intro") {
      this.add
        .text(cx, cy - 40 * U, info.title, {
          fontFamily: FONT, // VN-friendly (titles/how may be Vietnamese)
          fontSize: fs(this, 42),
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, cy + 20 * U, info.how, {
          fontFamily: FONT,
          fontSize: fs(this, 18),
          color: "#8a8fa3",
          align: "center",
          wordWrap: { width: Math.min(vw(this) * 0.86, 560 * U) },
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(cx, cy - 10 * U, info.title, {
          fontFamily: FONT,
          fontSize: fs(this, 30),
          color: "#8a8fa3",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, cy + 40 * U, "Hoàn thành! ⛳", {
          fontFamily: FONT,
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
        this.mode === "intro" ? "Nhấn để bắt đầu" : "Nhấn để tiếp tục",
        { fontFamily: FONT, fontSize: fs(this, 20), color: "#ffd166" },
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

    // Arm the tap a beat after create: the transition that starts this card (the
    // IRIS letter fly-in) ends on a click, and without this delay that same click
    // leaks through and instantly dismisses the card.
    this.time.delayedCall(300, () => {
      this.input.once("pointerdown", () => {
        cam.fadeOut(200);
        cam.once("camerafadeoutcomplete", () => {
          if (this.mode === "intro") {
            this.scene.start(info.key, { stage: this.stage });
          } else {
            // clear card → route to the next stage (showOverworld restarts this
            // scene as the next intro, or starts Final). No scene.stop() first: that
            // would tear this scene down and the same-key restart wouldn't re-create.
            showOverworld(this.stage);
          }
        });
      });
    });
  }
}

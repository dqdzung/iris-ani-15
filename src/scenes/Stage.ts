import Phaser from "phaser";
import { vw, vh, u, fs } from "../layout";
import { clearStage } from "../stageUtils";

// One reusable scene for all 4 stages; `stage` (1..4) comes in via init data.
export class Stage extends Phaser.Scene {
  private stage = 1;

  constructor() {
    super("Stage");
  }

  init(data: { stage?: number }) {
    this.stage = data.stage ?? 1;
  }

  create() {
    this.cameras.main.fadeIn(220);
    const cx = vw(this) / 2,
      cy = vh(this) / 2,
      U = u(this);
    this.add
      .text(cx, cy - 30 * U, "Game 4", {
        fontSize: fs(this, 48),
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 40 * U, "placeholder — click to clear", {
        fontSize: fs(this, 20),
        color: "#8a8fa3",
      })
      .setOrigin(0.5);

    // placeholder: a click clears the stage. Real gameplay goes here per stage.
    this.input.once("pointerdown", () => this.clear());
  }

  private clear() {
    clearStage(this, this.stage); // → clear card → overworld climbs to the next step
  }
}

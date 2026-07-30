import Phaser from "phaser";
import { GAME_W, GAME_H, STAGE_COUNT } from "../main";

// One reusable scene for all 4 stages; `stage` (1..STAGE_COUNT) comes in via init data.
export class Stage extends Phaser.Scene {
  private stage = 1;

  constructor() {
    super("Stage");
  }

  init(data: { stage?: number }) {
    this.stage = data.stage ?? 1;
  }

  create() {
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 30, `Stage ${this.stage}`, {
        fontSize: "48px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_W / 2, GAME_H / 2 + 40, "click to clear this stage", {
        fontSize: "20px",
        color: "#8a8fa3",
      })
      .setOrigin(0.5);

    // placeholder: a click clears the stage. Real gameplay goes here per stage.
    this.input.once("pointerdown", () => this.clear());
  }

  private clear() {
    if (this.stage >= STAGE_COUNT) {
      this.scene.start("Final");
    } else {
      this.scene.start("Stage", { stage: this.stage + 1 });
    }
  }
}

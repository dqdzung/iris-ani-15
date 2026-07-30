import Phaser from "phaser";
import { GAME_W, GAME_H, S, px } from "../config";
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
    this.add
      .text((GAME_W / 2) * S, (GAME_H / 2 - 30) * S, `Stage ${this.stage}`, {
        fontSize: px(48),
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text((GAME_W / 2) * S, (GAME_H / 2 + 40) * S, "click to clear this stage", {
        fontSize: px(20),
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

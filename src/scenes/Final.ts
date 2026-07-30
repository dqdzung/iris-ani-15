import Phaser from "phaser";
import { GAME_W, GAME_H, S, px } from "../main";

export class Final extends Phaser.Scene {
  constructor() {
    super("Final");
  }

  create() {
    this.add
      .text((GAME_W / 2) * S, (GAME_H / 2 - 30) * S, "You finished!", {
        fontSize: px(52),
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text((GAME_W / 2) * S, (GAME_H / 2 + 40) * S, "click to play again", {
        fontSize: px(20),
        color: "#8a8fa3",
      })
      .setOrigin(0.5);

    // back to the very first welcome screen (title + START), progress reset
    this.input.once("pointerdown", () => this.scene.start("Welcome", { cleared: 0 }));
  }
}

import Phaser from "phaser";
import { GAME_W, GAME_H } from "../main";

export class Welcome extends Phaser.Scene {
  constructor() {
    super("Welcome");
  }

  create() {
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, "iris-ani-15", {
        fontSize: "56px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_W / 2, GAME_H / 2 + 40, "click to start", {
        fontSize: "22px",
        color: "#8a8fa3",
      })
      .setOrigin(0.5);

    this.input.once("pointerdown", () => {
      this.scene.start("Stage", { stage: 1 });
    });
  }
}

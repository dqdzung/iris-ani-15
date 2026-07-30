import Phaser from "phaser";
import { GAME_W, GAME_H } from "../main";

export class Final extends Phaser.Scene {
  constructor() {
    super("Final");
  }

  create() {
    this.add
      .text(GAME_W / 2, GAME_H / 2 - 30, "You finished!", {
        fontSize: "52px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_W / 2, GAME_H / 2 + 40, "click to play again", {
        fontSize: "20px",
        color: "#8a8fa3",
      })
      .setOrigin(0.5);

    this.input.once("pointerdown", () => this.scene.start("Welcome"));
  }
}

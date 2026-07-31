import Phaser from "phaser";
import { vw, vh, u, fs } from "../layout";
import { showOverworld } from "../overworld";

export class Final extends Phaser.Scene {
  constructor() {
    super("Final");
  }

  create() {
    const cx = vw(this) / 2,
      cy = vh(this) / 2,
      U = u(this);
    this.add
      .text(cx, cy - 30 * U, "You finished!", {
        fontSize: fs(this, 52),
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 40 * U, "click to play again", {
        fontSize: fs(this, 20),
        color: "#8a8fa3",
      })
      .setOrigin(0.5);

    // back to the overworld at the base (progress reset)
    this.input.once("pointerdown", () => {
      this.scene.stop();
      showOverworld(0);
    });
  }
}

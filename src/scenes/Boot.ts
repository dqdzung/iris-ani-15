import Phaser from "phaser";

// Blank auto-start scene. The DOM overworld (<iris-climb-2d>) drives the menu and
// starts the real Phaser scenes on demand, so Phaser just needs an idle first scene.
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create() {
    /* intentionally empty */
  }
}

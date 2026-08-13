import Phaser from "phaser";

// Blank auto-start scene. The DOM overworld (<iris-climb-2d>) drives the menu and
// starts the real Phaser scenes on demand, so Phaser just needs an idle first scene.
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    // Warm the finale's restore video early, in the background, while the boot
    // screen shows — so the finale doesn't pause to load it. (The visible boot
    // screen is a DOM overlay, independent of this scene's load.)
    this.load.video("iris-vid", "/video/iris-progress.mp4", true);
  }
  create() {
    /* intentionally empty */
  }
}

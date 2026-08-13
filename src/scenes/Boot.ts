import Phaser from "phaser";

// Blank auto-start scene. The DOM overworld (<iris-climb-2d>) drives the menu and
// starts the real Phaser scenes on demand, so Phaser just needs an idle first scene.
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    // Warm heavy assets early, in the background, while the boot screen shows —
    // so later scenes don't pause to load them. (The visible boot screen is a DOM
    // overlay, independent of this scene's load.)
    this.load.video("iris-vid", "/video/iris-progress.mp4", true); // finale video
    // Sliding-Puzzle images (keys/urls match SlidingPuzzle's puzzle-N; keep in
    // sync with PUZZLE_COUNT there) so the puzzle starts instantly.
    for (let i = 1; i <= 14; i++)
      this.load.image(`puzzle-${i}`, `/puzzle/${i}.jpg`);
  }
  create() {
    /* intentionally empty */
  }
}

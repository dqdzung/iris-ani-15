import Phaser from "phaser";

// Responsive helpers. The world is in device pixels (this.scale.width/height), so
// scenes lay out relative to the live viewport instead of a fixed design size.

export const vw = (s: Phaser.Scene) => s.scale.width;
export const vh = (s: Phaser.Scene) => s.scale.height;

// A sizing unit tied to the SHORTER viewport side, so text/controls scale sensibly
// in both landscape and portrait (calibrated so `u*540 ≈ old full-height design`).
export const u = (s: Phaser.Scene) => Math.min(s.scale.width, s.scale.height) / 540;

// Font size string in responsive units (n is in old "design" units).
export const fs = (s: Phaser.Scene, n: number) => `${Math.round(n * u(s))}px`;

// Re-run `layout` now and whenever the viewport resizes/rotates (auto-cleaned).
export function onLayout(scene: Phaser.Scene, layout: () => void) {
  layout();
  scene.scale.on("resize", layout);
  scene.events.once("shutdown", () => scene.scale.off("resize", layout));
}

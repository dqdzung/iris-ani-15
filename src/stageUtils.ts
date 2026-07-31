import Phaser from "phaser";
import { onLayout } from "./layout";

// Each ported mini-game is authored in its own native (portrait-ish) size. Fit it
// centered inside the live viewport via the camera — empty sides show the dark
// theme, so it reads as a panel. Re-fits on resize/rotation. Call in create().
export function fitStage(scene: Phaser.Scene, gameW: number, gameH: number) {
  const cam = scene.cameras.main;
  cam.setBackgroundColor("#0d0f16"); // darker than the game panel → framed sides
  onLayout(scene, () => {
    cam.setZoom(Math.min(scene.scale.width / gameW, scene.scale.height / gameH));
    cam.centerOn(gameW / 2, gameH / 2);
  });
  cam.fadeIn(220);
}

// Stage cleared → fade out to the clear card (which then climbs the overworld).
export function clearStage(scene: Phaser.Scene, stage: number) {
  const cam = scene.cameras.main;
  cam.fadeOut(260);
  cam.once("camerafadeoutcomplete", () =>
    scene.scene.start("StageCard", { stage, mode: "clear" }),
  );
}

// Failed → retry the same stage from scratch.
export function retryStage(scene: Phaser.Scene, stage: number) {
  scene.scene.restart({ stage });
}

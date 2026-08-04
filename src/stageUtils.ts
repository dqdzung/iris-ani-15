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

// Stage cleared → fade out to the IRIS progress screen. It lights one more letter
// per game; clearing the last game (stage 3) lights the rest with the finale.
export function clearStage(scene: Phaser.Scene, stage: number) {
  const cam = scene.cameras.main;
  cam.fadeOut(260);
  cam.once("camerafadeoutcomplete", () => {
    const last = stage >= 4; // 4 games (I R I S) → the 4th triggers the finale
    scene.scene.start("IrisProgress", {
      lit: stage,
      animFrom: stage - 1,
      finale: last,
    });
  });
}

// Failed → retry the same stage from scratch.
export function retryStage(scene: Phaser.Scene, stage: number) {
  scene.scene.restart({ stage });
}

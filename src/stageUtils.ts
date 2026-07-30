import Phaser from "phaser";
import { GAME_W, GAME_H, S } from "./config";

// Each ported mini-game is authored in its own native (portrait-ish) size.
// Fit it centered inside the shared landscape canvas — the empty sides show the
// dark theme, so the game reads as a panel. Returns nothing; call in create().
// (GAME_W/S read lazily here, not at module load, to avoid a circular-import TDZ.)
export function fitStage(scene: Phaser.Scene, gameW: number, gameH: number) {
  const cam = scene.cameras.main;
  cam.setZoom(Math.min((GAME_W * S) / gameW, (GAME_H * S) / gameH));
  cam.centerOn(gameW / 2, gameH / 2);
  cam.setBackgroundColor("#0d0f16"); // darker than the game panel → framed sides
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

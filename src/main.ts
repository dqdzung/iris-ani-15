import Phaser from "phaser";
import { Welcome } from "./scenes/Welcome";
import { Stage } from "./scenes/Stage";
import { Final } from "./scenes/Final";

// Render at S× the design size so Scale.FIT downscales to the viewport → crisp text
// (upscaling a small canvas is what makes text blurry). Author in design units and
// multiply by S when placing; px() does it for font sizes.
export const S = 2;
export const px = (n: number) => `${n * S}px`;

export const GAME_W = 960; // design units
export const GAME_H = 540;
export const STAGE_COUNT = 4;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#12141c",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W * S,
    height: GAME_H * S,
  },
  scene: [Welcome, Stage, Final],
});

if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;

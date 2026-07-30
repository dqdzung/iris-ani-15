import Phaser from "phaser";
import { Welcome } from "./scenes/Welcome";
import { Stage } from "./scenes/Stage";
import { Final } from "./scenes/Final";

export const GAME_W = 960;
export const GAME_H = 540;
export const STAGE_COUNT = 4;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#12141c",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  scene: [Welcome, Stage, Final],
});

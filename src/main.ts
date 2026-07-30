import Phaser from "phaser";
import { GAME_W, GAME_H, S } from "./config";
import { Welcome } from "./scenes/Welcome";
import { StageCard } from "./scenes/StageCard";
import { LootCatcher } from "./scenes/LootCatcher";
import { SlidingPuzzle } from "./scenes/SlidingPuzzle";
import { WhackAMole } from "./scenes/WhackAMole";
import { Stage } from "./scenes/Stage";
import { Final } from "./scenes/Final";

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
  scene: [Welcome, StageCard, LootCatcher, SlidingPuzzle, WhackAMole, Stage, Final],
});

if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;

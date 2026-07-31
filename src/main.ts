import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { StageCard } from "./scenes/StageCard";
import { LootCatcher } from "./scenes/LootCatcher";
import { SlidingPuzzle } from "./scenes/SlidingPuzzle";
import { WhackAMole } from "./scenes/WhackAMole";
import { Stage } from "./scenes/Stage";
import { Final } from "./scenes/Final";
import { initOverworld, showOverworld } from "./overworld";

// Responsive + crisp: the canvas fills the viewport, and we render at the device
// pixel ratio (backing store = CSS size × DPR) so text stays sharp on retina/phones.
// Scenes read this.scale.width/height (device px) and lay themselves out for it.
const DPR = Math.min(window.devicePixelRatio || 1, 2); // cap at 2 to bound fill-rate

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#12141c",
  scale: {
    mode: Phaser.Scale.NONE, // we drive the size manually (below) for DPR control
    width: window.innerWidth * DPR,
    height: window.innerHeight * DPR,
  },
  scene: [Boot, StageCard, LootCatcher, SlidingPuzzle, WhackAMole, Stage, Final],
});

// Backing store = viewport × DPR (crisp); CSS size = viewport (fills screen).
// Emits a "resize" event scenes can listen to for re-layout.
function resize() {
  const w = window.innerWidth,
    h = window.innerHeight;
  game.scale.resize(w * DPR, h * DPR);
  game.canvas.style.width = w + "px";
  game.canvas.style.height = h + "px";
}
window.addEventListener("resize", resize);
resize();

// DOM overworld (climb-2d) overlays the canvas; show it at the start.
initOverworld(game);
showOverworld(0);

if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;

import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { StageCard } from "./scenes/StageCard";
import { LootCatcher } from "./scenes/LootCatcher";
import { SlidingPuzzle } from "./scenes/SlidingPuzzle";
import { WhackAMole } from "./scenes/WhackAMole";
import { Stage } from "./scenes/Stage";
import { Final } from "./scenes/Final";
import { IrisProgress } from "./scenes/IrisProgress";
import { initOverworld, showOverworld } from "./overworld";
import { clearStage } from "./stageUtils";
import { playTvIntro } from "./tvIntro";
import { playBootScreen } from "./bootScreen";

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
  scene: [Boot, StageCard, LootCatcher, SlidingPuzzle, WhackAMole, Stage, IrisProgress, Final],
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

// DOM overworld (climb-2d) overlays the canvas; show it at the start, behind a
// one-shot "old TV turning on" intro that reveals it.
initOverworld(game); // sets up routing (climb visuals shelved — see overworld.ts)
// TV turns on → boot log types out → "Press START" enters stage 1.
playTvIntro(() => playBootScreen(() => showOverworld(0)));

const GAMES = ["LootCatcher", "SlidingPuzzle", "WhackAMole", "Stage"];
const activeGame = () =>
  game.scene.getScenes(true).find((s) => GAMES.includes(s.scene.key));

// K — skip the current game to its IRIS transition (shipped to prod).
window.addEventListener("keydown", (e) => {
  if (e.key !== "k") return;
  const s = activeGame();
  if (s) clearStage(s, (s as unknown as { stage?: number }).stage ?? 1);
});

if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;

  // Dev-only: F — jump straight to the finale.
  window.addEventListener("keydown", (e) => {
    if (e.key !== "f") return;
    // stop everything except Boot and IrisProgress itself (stopping the target
    // scene then restarting the same key in one tick won't re-create it)
    game.scene
      .getScenes(true)
      .forEach(
        (s) => !["Boot", "IrisProgress"].includes(s.scene.key) && s.scene.stop(),
      );
    game.scene.start("IrisProgress", { lit: 4, animFrom: 0, finale: true });
  });
  console.log("[dev] K = skip current game · F = jump to finale");
}

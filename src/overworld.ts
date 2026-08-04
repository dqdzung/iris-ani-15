import type Phaser from "phaser";

// DOM overworld backed by the <iris-climb-2d> SVG custom element (from climb-2d.js,
// loaded globally in index.html). It overlays the Phaser canvas; entering a stage
// hides it and starts the Phaser flow, clearing a stage brings it back to advance.
// Drives the element purely through its public API (setProgress / stage / summit).

const STAGE_NAMES = "Loot Catcher|Sliding Puzzle|Whack-a-Mole|Summit";

type ClimbEl = HTMLElement & {
  setProgress(p: number): void;
  reset(): void;
};

let game: Phaser.Game;
let wrap: HTMLDivElement;
let el: ClimbEl;
let btn: HTMLButtonElement;
let cleared = 0;

export function initOverworld(g: Phaser.Game) {
  game = g;

  wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed",
    inset: "0",
    display: "none",
    zIndex: "5",
  });

  el = document.createElement("iris-climb-2d") as ClimbEl;
  el.setAttribute("stages", STAGE_NAMES);
  Object.assign(el.style, { width: "100%", height: "100%", display: "block" });
  wrap.appendChild(el);

  const title = document.createElement("div");
  title.textContent = "Iris 15th";
  Object.assign(title.style, {
    position: "fixed",
    top: "4%",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "6",
    font: "800 clamp(30px, 5.5vw, 58px) Archivo, system-ui, sans-serif",
    letterSpacing: "-.02em",
    color: "#201e1d",
    pointerEvents: "none",
    whiteSpace: "nowrap",
  });
  wrap.appendChild(title);

  btn = document.createElement("button");
  btn.textContent = "Start";
  Object.assign(btn.style, {
    position: "fixed",
    left: "50%",
    bottom: "6%",
    transform: "translateX(-50%)",
    zIndex: "6",
    padding: "14px 30px",
    cursor: "pointer",
    font: "700 18px system-ui, sans-serif",
    border: "2px solid #201e1d",
    background: "#ffd166",
    color: "#201e1d",
    borderRadius: "6px",
  });
  btn.onclick = () => enterNext();
  wrap.appendChild(btn);

  document.body.appendChild(wrap);
}

// Begin the climb from the base (used by the boot screen in place of the Start button).
export function startClimb() {
  btn.style.display = "none";
  enterNext();
}

// Climb overworld is shelved: instead of showing it, route straight to the next
// stage's intro card. `c` = stages cleared (0..3 → stages 1..4). The finale is
// handled by IrisProgress after game 4, so nothing routes to Final here anymore.
export function showOverworld(c: number, fly = false) {
  cleared = c;
  game.scene.start("StageCard", { stage: c + 1, mode: "intro", fly });
}

function hide() {
  wrap.style.display = "none";
}

// Animate the climb to the next marker, then hand off to the Phaser stage (or Final).
function enterNext() {
  const target = cleared + 1;
  const summit = target >= 4;
  btn.style.display = "none";
  el.setProgress(target / 4); // climber walks + camera zooms toward the marker
  setTimeout(
    () => {
      hide();
      if (summit) game.scene.start("Final");
      else game.scene.start("StageCard", { stage: target, mode: "intro" });
    },
    summit ? 2200 : 1600, // let the climb (and summit confetti) play out
  );
}

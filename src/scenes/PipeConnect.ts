import Phaser from "phaser";
import { S, px } from "../config";
import { fitStage, clearStage } from "../stageUtils";

// Stage 3 — Pipe Connect. Rotate pipe segments to link the "crisis" inlet to the
// "solution" outlet. Two independent branches run through the grid — solving
// either one (in full) clears the stage. Decoy segments fill the rest of the
// grid purely as noise; they rotate but never affect the win check.
// Authored in its native size; fitStage() centers/scales it in the landscape canvas.

type Dir = "up" | "right" | "down" | "left";
type Shape = "straight" | "corner";
type CellDef = { row: number; col: number; shape: Shape };
type PipeState = { steps: number };
type FlowResult = { reachedCellIdxs: Set<number>; route: string[] | null };

const CELL = 100 * S;
const GRID_ORIGIN_X = 60 * S;
const GRID_ORIGIN_Y = 60 * S;
const GRID_ROWS = 5;
const GRID_COLS = 8;
const BRANCH_ROWS = [1, 3];

const BOARD_W = GRID_ORIGIN_X * 2 + GRID_COLS * CELL;
const BOARD_H = GRID_ORIGIN_Y * 2 + GRID_ROWS * CELL;
const PANEL_PAD = 20 * S;
const SIDE_MARGIN = 20 * S;
const TOP_MARGIN = 156 * S;
const BOTTOM_MARGIN = 60 * S;

const PANEL_W = BOARD_W + PANEL_PAD * 2;
const PANEL_H = BOARD_H + PANEL_PAD * 2;
const PANEL_X = SIDE_MARGIN;
const PANEL_Y = TOP_MARGIN;
const BOARD_OFFSET_X = SIDE_MARGIN + PANEL_PAD;
const BOARD_OFFSET_Y = TOP_MARGIN + PANEL_PAD;

const GW = PANEL_W + SIDE_MARGIN * 2;
const GH = TOP_MARGIN + PANEL_H + BOTTOM_MARGIN;

const DIRS: Dir[] = ["up", "right", "down", "left"];
const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

const SHAPES: Record<Shape, Dir[]> = {
  straight: ["up", "down"],
  corner: ["up", "right"],
};
const DECOY_SHAPES: Shape[] = ["straight", "corner"];
// Every click rotates exactly one quarter turn, for every pipe type.
const ROTATE_STEP_BY_SHAPE: Record<Shape, number> = { straight: 1, corner: 1 };

// Two branches (row 1 and row 3) threading from the left edge to the right edge.
const CELL_DEFS: CellDef[] = [
  { row: 1, col: 0, shape: "straight" },
  { row: 1, col: 1, shape: "corner" },
  { row: 0, col: 1, shape: "corner" },
  { row: 0, col: 2, shape: "corner" },
  { row: 1, col: 2, shape: "corner" },
  { row: 1, col: 3, shape: "corner" },
  { row: 0, col: 3, shape: "corner" },
  { row: 0, col: 4, shape: "corner" },
  { row: 1, col: 4, shape: "corner" },
  { row: 1, col: 5, shape: "corner" },
  { row: 0, col: 5, shape: "corner" },
  { row: 0, col: 6, shape: "corner" },
  { row: 1, col: 6, shape: "corner" },
  { row: 1, col: 7, shape: "straight" },
  { row: 3, col: 0, shape: "straight" },
  { row: 3, col: 1, shape: "corner" },
  { row: 4, col: 1, shape: "corner" },
  { row: 4, col: 2, shape: "corner" },
  { row: 3, col: 2, shape: "corner" },
  { row: 3, col: 3, shape: "corner" },
  { row: 4, col: 3, shape: "corner" },
  { row: 4, col: 4, shape: "corner" },
  { row: 3, col: 4, shape: "corner" },
  { row: 3, col: 5, shape: "corner" },
  { row: 4, col: 5, shape: "corner" },
  { row: 4, col: 6, shape: "corner" },
  { row: 3, col: 6, shape: "corner" },
  { row: 3, col: 7, shape: "straight" },
];
const CELL_INDEX_BY_KEY: Record<string, number> = {};
CELL_DEFS.forEach((c, i) => {
  CELL_INDEX_BY_KEY[`${c.row},${c.col}`] = i;
});

function buildDecoyDefs(): CellDef[] {
  const defs: CellDef[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (CELL_INDEX_BY_KEY[`${r},${c}`] === undefined) {
        defs.push({ row: r, col: c, shape: DECOY_SHAPES[Math.floor(Math.random() * DECOY_SHAPES.length)] });
      }
    }
  }
  return defs;
}

function cellCenter(row: number, col: number) {
  return { x: GRID_ORIGIN_X + col * CELL + CELL / 2, y: GRID_ORIGIN_Y + row * CELL + CELL / 2 };
}
function pointOnEdge(row: number, col: number, dir: Dir) {
  const c = cellCenter(row, col);
  const v = DIR_VEC[dir];
  return { x: c.x + (v.x * CELL) / 2, y: c.y + (v.y * CELL) / 2 };
}
function rotateDir(dir: Dir, steps: number): Dir {
  const i = DIRS.indexOf(dir);
  return DIRS[(i + steps + 8) % 4];
}
function openingsFor(shape: Shape, steps: number): Set<Dir> {
  return new Set(SHAPES[shape].map((d) => rotateDir(d, steps)));
}
function isStraightThrough(openings: Set<Dir>): boolean {
  const arr = [...openings];
  return arr.length === 2 && OPPOSITE[arr[0]] === arr[1];
}

// =============================================================================
// Rendering helpers — pure functions over a Phaser.GameObjects.Graphics
// =============================================================================
const STEEL_RIM = 0x0c1626,
  STEEL_BASE = 0x8a97a8,
  STEEL_HI = 0xc9d3e0;
const FLANGE_COLOR = 0x8a97a8,
  BOLT_COLOR = 0x0c1626;
const WATER_B = 0xffd166; // "flow" glow — gold, the game-wide accent
const PANEL_COLOR = 0x16213e; // matches the Loot Catcher / Sliding Puzzle panels
const TEXT_HI = "#f0f0f0",
  TEXT_MID = "#8a8fa3", // the shared muted-slate text color
  GOLD = "#FFD166";

function drawSpokeSet(g: Phaser.GameObjects.Graphics, dirs: Dir[], halfLen: number, w: number, color: number) {
  g.fillStyle(color, 1);
  dirs.forEach((dir) => {
    if (dir === "up") g.fillRoundedRect(-w / 2, -halfLen, w, halfLen, w * 0.3);
    if (dir === "down") g.fillRoundedRect(-w / 2, 0, w, halfLen, w * 0.3);
    if (dir === "left") g.fillRoundedRect(-halfLen, -w / 2, halfLen, w, w * 0.3);
    if (dir === "right") g.fillRoundedRect(0, -w / 2, halfLen, w, w * 0.3);
  });
}
function drawSteelTube(g: Phaser.GameObjects.Graphics, dirs: Dir[], halfLen: number) {
  drawSpokeSet(g, dirs, halfLen, 30 * S, STEEL_RIM);
  drawSpokeSet(g, dirs, halfLen, 24 * S, STEEL_BASE);
  drawSpokeSet(g, dirs, halfLen, 8 * S, STEEL_HI);
}
function drawWaterTube(g: Phaser.GameObjects.Graphics, dirs: Dir[], halfLen: number) {
  drawSpokeSet(g, dirs, halfLen, 13 * S, WATER_B);
}
function drawFlangeShape(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
  g.fillStyle(FLANGE_COLOR, 1).fillCircle(cx, cy, r);
  g.lineStyle(2 * S, STEEL_RIM, 1).strokeCircle(cx, cy, r);
}
function addBolts(g: Phaser.GameObjects.Graphics, r: number) {
  g.fillStyle(BOLT_COLOR, 1);
  [0, 90, 180, 270].forEach((a) => {
    const rad = (a * Math.PI) / 180;
    g.fillCircle(Math.cos(rad) * r, Math.sin(rad) * r, 2.6 * S);
  });
}

// A single rotatable pipe segment (network piece or decoy).
class PipeCell {
  idx: number;
  isAnimating = false;
  private container: Phaser.GameObjects.Container;
  private waterGfx: Phaser.GameObjects.Graphics;
  private absAngle = 0;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    row: number,
    col: number,
    shape: Shape,
    idx: number,
    onClick: () => void,
  ) {
    this.scene = scene;
    this.idx = idx;
    const c = cellCenter(row, col);
    const halfLen = CELL / 2 - 4 * S;

    this.container = scene.add.container(c.x, c.y);
    parent.add(this.container);

    const steel = scene.add.graphics();
    drawSteelTube(steel, SHAPES[shape], halfLen);
    this.container.add(steel);

    const water = scene.add.graphics();
    drawWaterTube(water, SHAPES[shape], halfLen);
    water.setAlpha(0);
    this.container.add(water);
    this.waterGfx = water;

    if (!isStraightThrough(new Set(SHAPES[shape]))) {
      const flange = scene.add.graphics();
      drawFlangeShape(flange, 0, 0, 15 * S);
      addBolts(flange, 11 * S);
      this.container.add(flange);
    }

    const zone = scene.add
      .zone(0, 0, CELL, CELL)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerdown", (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event?: { stopPropagation: () => void }) => {
      event?.stopPropagation();
      onClick();
    });
    this.container.add(zone);
  }

  // Rotates exactly `quarterTurns` × 90°. While animating, further calls are ignored
  // so a rapid double-fire (e.g. mouse+touch on hybrid devices) can't over-rotate it.
  rotateOneStep(quarterTurns: number) {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.scene.tweens.killTweensOf(this.container);
    this.absAngle += 90 * quarterTurns;
    this.scene.tweens.add({
      targets: this.container,
      angle: this.absAngle,
      duration: 170 * quarterTurns,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.isAnimating = false;
      },
    });
  }
  setAngleInstant(steps: number) {
    this.absAngle = steps * 90;
    this.container.angle = this.absAngle;
    this.isAnimating = false;
  }
  setLit(on: boolean) {
    this.scene.tweens.add({ targets: this.waterGfx, alpha: on ? 1 : 0, duration: 180 });
  }
}

export class PipeConnect extends Phaser.Scene {
  private stage = 3;

  private cellStates: PipeState[] = [];
  private decoyStates: PipeState[] = [];
  private decoyDefs: CellDef[] = [];
  private solved = false;

  private cells: PipeCell[] = [];
  private decoys: PipeCell[] = [];
  private board!: Phaser.GameObjects.Container;
  private startForkGfx!: Phaser.GameObjects.Graphics;
  private endForkGfx!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("PipeConnect");
  }

  init(data: { stage?: number } = {}) {
    this.stage = data.stage ?? 3;
  }

  create() {
    this.decoyDefs = buildDecoyDefs();
    this.solved = false;
    this.cells = [];
    this.decoys = [];

    fitStage(this, GW, GH);
    this.add.rectangle(0, 0, GW, GH, 0x0d0f16).setOrigin(0); // stage backdrop (matches the framed sides)

    // Header text — commented out for now, to be relocated later.
    // this.add
    //   .text(GW / 2, 16 * S, "CHỮ I — INNOVATION", {
    //     fontSize: px(12),
    //     color: "#2FE0FF",
    //     fontStyle: "600",
    //     padding: { y: 4 },
    //   })
    //   .setOrigin(0.5);
    // this.add
    //   .text(GW / 2, 42 * S, "Nối Dòng Chảy Sáng Tạo", {
    //     fontSize: px(26),
    //     color: TEXT_HI,
    //     fontStyle: "700",
    //     padding: { y: 6 },
    //   })
    //   .setOrigin(0.5);
    // this.add
    //   .text(
    //     GW / 2,
    //     78 * S,
    //     "Xoay các đoạn ống để khơi thông luồng chảy — mọi ô trên bàn cờ đều có ống, nhưng chỉ một số ống\nthực sự nối được từ Khủng hoảng đến Giải pháp. Có nhiều nhánh khác nhau để hoàn thành, chỉ cần\nthông một nhánh trước khi hết giờ.",
    //     { fontSize: px(13), color: TEXT_MID, align: "center", padding: { y: 4 } },
    //   )
    //   .setOrigin(0.5);

    this.add.graphics().fillStyle(PANEL_COLOR, 1).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 18 * S);

    this.board = this.add.container(BOARD_OFFSET_X, BOARD_OFFSET_Y);

    this.initState();

    this.decoys = this.decoyDefs.map((d, i) => {
      const pc = new PipeCell(this, this.board, d.row, d.col, d.shape, i, () => this.onDecoyClick(i));
      pc.setAngleInstant(this.decoyStates[i].steps);
      return pc;
    });
    this.cells = CELL_DEFS.map((d, i) => {
      const pc = new PipeCell(this, this.board, d.row, d.col, d.shape, i, () => this.onCellClick(i));
      pc.setAngleInstant(this.cellStates[i].steps);
      return pc;
    });

    this.startForkGfx = this.add.graphics();
    this.board.add(this.startForkGfx);
    this.endForkGfx = this.add.graphics();
    this.board.add(this.endForkGfx);
    this.drawForkBolts("start");
    this.drawForkBolts("end");

    (["start", "end"] as const).forEach((kind) => {
      const { valve } = this.forkGeometry(kind);
      const t = this.add
        .text(valve.x + (kind === "start" ? 5 * S : -5 * S), valve.y - 46 * S, kind === "start" ? "KHỦNG HOẢNG" : "GIẢI PHÁP", {
          fontSize: px(10),
          color: TEXT_MID,
          padding: { y: 2 },
        })
        .setOrigin(kind === "start" ? 0 : 1, 0.5);
      this.board.add(t);
    });

    this.statusText = this.add
      .text(GW / 2, PANEL_Y + PANEL_H + 30 * S, "Nhấn vào từng đoạn ống để xoay 90°.", {
        fontSize: px(14),
        color: TEXT_MID,
        padding: { y: 4 },
      })
      .setOrigin(0.5);

    this.applyFlow(this.computeFlowState());
  }

  // ---------------------------------------------------------------------------
  // Pure state helpers (mirror the module-level logic, scoped to this instance)
  // ---------------------------------------------------------------------------
  private currentOpenings(idx: number): Set<Dir> {
    return openingsFor(CELL_DEFS[idx].shape, this.cellStates[idx].steps);
  }

  private initState() {
    let tries = 0;
    do {
      this.cellStates = CELL_DEFS.map(() => ({ steps: Math.floor(Math.random() * 4) }));
      tries++;
    } while (this.findRoute() && tries < 200);
    this.decoyStates = this.decoyDefs.map(() => ({ steps: Math.floor(Math.random() * 4) }));
  }

  private findRoute(): string[] | null {
    return this.computeFlowState().route;
  }

  private computeFlowState(): FlowResult {
    const ENTRY_COL = 0,
      EXIT_COL = GRID_COLS - 1;
    const entryIdxs: number[] = [],
      exitIdxs: number[] = [];
    CELL_DEFS.forEach((c, i) => {
      if (c.col === ENTRY_COL) entryIdxs.push(i);
      if (c.col === EXIT_COL) exitIdxs.push(i);
    });
    const neighborsOf = (key: string): string[] => {
      if (key === "START") {
        return entryIdxs.filter((i) => this.currentOpenings(i).has("left")).map((i) => `cell:${i}`);
      }
      if (key === "END") return [];
      const idx = parseInt(key.slice(5), 10);
      const cell = CELL_DEFS[idx];
      const opens = this.currentOpenings(idx);
      const result: string[] = [];
      opens.forEach((dir) => {
        const vec = DIR_VEC[dir];
        const nkey = `${cell.row + vec.y},${cell.col + vec.x}`;
        const nidx = CELL_INDEX_BY_KEY[nkey];
        if (nidx !== undefined && this.currentOpenings(nidx).has(OPPOSITE[dir])) {
          result.push(`cell:${nidx}`);
        }
      });
      if (exitIdxs.includes(idx) && opens.has("right")) result.push("END");
      return result;
    };
    const visited = new Set<string>(["START"]);
    const parent: Record<string, string> = {};
    const queue: string[] = ["START"];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === "END") continue;
      neighborsOf(cur).forEach((nb) => {
        if (!visited.has(nb)) {
          visited.add(nb);
          parent[nb] = cur;
          queue.push(nb);
        }
      });
    }
    const reachedCellIdxs = new Set(
      [...visited].filter((k) => k.startsWith("cell:")).map((k) => parseInt(k.slice(5), 10)),
    );
    let route: string[] | null = null;
    if (visited.has("END")) {
      route = [];
      let k: string | undefined = "END";
      while (k !== undefined) {
        route.unshift(k);
        k = parent[k];
      }
    }
    return { reachedCellIdxs, route };
  }

  // ---------------------------------------------------------------------------
  // Fork (inlet/outlet valve) drawing
  // ---------------------------------------------------------------------------
  private forkGeometry(kind: "start" | "end") {
    const dir: Dir = kind === "start" ? "left" : "right";
    const col = kind === "start" ? 0 : GRID_COLS - 1;
    const entryPts = BRANCH_ROWS.map((r) => pointOnEdge(r, col, dir));
    const valve = {
      x: kind === "start" ? entryPts[0].x - 45 * S : entryPts[0].x + 45 * S,
      y: (entryPts[0].y + entryPts[1].y) / 2,
    };
    return { entryPts, valve };
  }

  private drawFork(gfx: Phaser.GameObjects.Graphics, kind: "start" | "end", litArray: boolean[]) {
    gfx.clear();
    const { entryPts, valve } = this.forkGeometry(kind);
    entryPts.forEach((p, i) => {
      gfx.lineStyle(30 * S, STEEL_RIM, 1).lineBetween(valve.x, valve.y, p.x, p.y);
      gfx.lineStyle(24 * S, STEEL_BASE, 1).lineBetween(valve.x, valve.y, p.x, p.y);
      const color = litArray[i] ? WATER_B : STEEL_HI;
      gfx.lineStyle(13 * S, color, 1).lineBetween(valve.x, valve.y, p.x, p.y);
    });
    drawFlangeShape(gfx, valve.x, valve.y, 20 * S);
  }

  private drawForkBolts(kind: "start" | "end") {
    const { valve } = this.forkGeometry(kind);
    const g = this.add.graphics();
    g.fillStyle(BOLT_COLOR, 1);
    [0, 90, 180, 270].forEach((a) => {
      const rad = (a * Math.PI) / 180;
      g.fillCircle(valve.x + Math.cos(rad) * 15 * S, valve.y + Math.sin(rad) * 15 * S, 2.6 * S);
    });
    this.board.add(g);
  }

  private applyFlow(flow: FlowResult) {
    this.cells.forEach((pc) => pc.setLit(flow.reachedCellIdxs.has(pc.idx)));
    const startEntryIdxs = BRANCH_ROWS.map((r) => CELL_INDEX_BY_KEY[`${r},0`]);
    const endExitIdxs = BRANCH_ROWS.map((r) => CELL_INDEX_BY_KEY[`${r},${GRID_COLS - 1}`]);
    const startLit = startEntryIdxs.map((idx) => flow.reachedCellIdxs.has(idx));
    const endLit = endExitIdxs.map((idx) => {
      if (!flow.route) return false;
      return flow.route.includes(`cell:${idx}`) && flow.route[flow.route.length - 1] === "END";
    });
    this.drawFork(this.startForkGfx, "start", startLit);
    this.drawFork(this.endForkGfx, "end", endLit);
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------
  private onCellClick(idx: number) {
    if (this.solved || this.cells[idx].isAnimating) return;
    const quarterTurns = ROTATE_STEP_BY_SHAPE[CELL_DEFS[idx].shape] || 1;
    this.cellStates[idx].steps = (this.cellStates[idx].steps + quarterTurns) % 4;
    this.cells[idx].rotateOneStep(quarterTurns);
    const flow = this.computeFlowState();
    this.applyFlow(flow);
    if (flow.route) this.onWin(flow.route);
  }

  private onDecoyClick(i: number) {
    if (this.solved || this.decoys[i].isAnimating) return;
    const quarterTurns = ROTATE_STEP_BY_SHAPE[this.decoyDefs[i].shape] || 1;
    this.decoyStates[i].steps = (this.decoyStates[i].steps + quarterTurns) % 4;
    this.decoys[i].rotateOneStep(quarterTurns);
  }

  private onWin(route: string[]) {
    this.solved = true;
    this.statusText.setText("Đã khơi thông dòng chảy! 🎉").setColor(GOLD);
    this.animateSpark(route, () => {
      this.launchConfetti();
      this.time.delayedCall(700, () => clearStage(this, this.stage));
    });
  }

  private animateSpark(route: string[], onDone: () => void) {
    const startEntries = BRANCH_ROWS.map((r) => pointOnEdge(r, 0, "left"));
    const startValve = { x: startEntries[0].x - 45 * S, y: (startEntries[0].y + startEntries[1].y) / 2 };
    const endEntries = BRANCH_ROWS.map((r) => pointOnEdge(r, GRID_COLS - 1, "right"));
    const endValve = { x: endEntries[0].x + 45 * S, y: (endEntries[0].y + endEntries[1].y) / 2 };

    const waypoints = route.map((key) => {
      if (key === "START") return startValve;
      if (key === "END") return endValve;
      const idx = parseInt(key.slice(5), 10);
      const cell = CELL_DEFS[idx];
      return cellCenter(cell.row, cell.col);
    });

    const spark = this.add.circle(waypoints[0].x, waypoints[0].y, 8 * S, 0xffd166).setDepth(50);
    this.board.add(spark);
    let i = 0;
    const next = () => {
      if (i >= waypoints.length - 1) {
        spark.destroy();
        onDone();
        return;
      }
      const p2 = waypoints[i + 1];
      this.tweens.add({
        targets: spark,
        x: p2.x,
        y: p2.y,
        duration: 160,
        onComplete: () => {
          i++;
          next();
        },
      });
    };
    next();
  }

  private launchConfetti() {
    const colors = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff];
    for (let i = 0; i < 70; i++) {
      const w = (5 + Math.random() * 5) * S;
      const h = w * 1.6;
      const startX = Math.random() * GW;
      const piece = this.add.rectangle(startX, -20 * S, w, h, colors[Math.floor(Math.random() * colors.length)]);
      piece.setDepth(200);
      piece.setAngle(Math.random() * 360);
      const duration = 2200 + Math.random() * 1800;
      const delay = Math.random() * 500;
      this.tweens.add({
        targets: piece,
        y: GH + 30 * S,
        angle: piece.angle + 540,
        duration,
        delay,
        ease: "Linear",
        onComplete: () => piece.destroy(),
      });
      this.tweens.add({ targets: piece, alpha: 0.4, duration, delay, ease: "Linear" });
    }
  }
}
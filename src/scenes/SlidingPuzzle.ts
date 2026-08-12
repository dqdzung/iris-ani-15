import Phaser from "phaser";
import { S, px, FONT } from "../config";
import { fitStage, clearStage } from "../stageUtils";

// Stage 2 — Sliding Puzzle (ported from MiniGames). Reassemble the picture; win = solved.
// No fail state, so no retry. Authored in native size; fitStage() centers it.

const N = 4; // 4x4 = 15 tiles + 1 gap
const TILE = 104 * S;
const GAP = 4 * S;
const MARGIN = 30 * S;
const TOP_BAR = 96 * S;
const BOT_BAR = 46 * S;
const PB = N * TILE; // picture is gapless (N*TILE square)

const boardW = N * TILE + (N - 1) * GAP;
const GW = boardW + MARGIN * 2;
const GH = boardW + MARGIN * 2 + TOP_BAR + BOT_BAR;
const SLIDE_MS = 110;
const SCRAMBLE_MOVES = 70;
const PUZZLE_COUNT = 14; // images in public/puzzle (1.jpg … 14.jpg), one picked per play

const rc = (i: number) => ({ r: Math.floor(i / N), c: i % N });
const slotLeft = (i: number) => MARGIN + (i % N) * (TILE + GAP);
const slotTop = (i: number) =>
	TOP_BAR + MARGIN + Math.floor(i / N) * (TILE + GAP);

// optimal solve length via IDA* (Manhattan + linear conflict). board[i] = tile value, 0 = blank.
const GOAL_POS: { r: number; c: number }[] = (() => {
	const g: { r: number; c: number }[] = [];
	for (let i = 0; i < N * N; i++)
		g[(i + 1) % (N * N)] = { r: Math.floor(i / N), c: i % N };
	return g;
})();

function puzzleHeuristic(b: number[]) {
	let md = 0,
		lc = 0;
	for (let i = 0; i < N * N; i++) {
		const v = b[i];
		if (!v) continue;
		md +=
			Math.abs(Math.floor(i / N) - GOAL_POS[v].r) +
			Math.abs((i % N) - GOAL_POS[v].c);
	}
	for (let r = 0; r < N; r++)
		for (let c1 = 0; c1 < N; c1++) {
			const v1 = b[r * N + c1];
			if (!v1 || GOAL_POS[v1].r !== r) continue;
			for (let c2 = c1 + 1; c2 < N; c2++) {
				const v2 = b[r * N + c2];
				if (!v2 || GOAL_POS[v2].r !== r) continue;
				if (GOAL_POS[v1].c > GOAL_POS[v2].c) lc++;
			}
		}
	for (let c = 0; c < N; c++)
		for (let r1 = 0; r1 < N; r1++) {
			const v1 = b[r1 * N + c];
			if (!v1 || GOAL_POS[v1].c !== c) continue;
			for (let r2 = r1 + 1; r2 < N; r2++) {
				const v2 = b[r2 * N + c];
				if (!v2 || GOAL_POS[v2].c !== c) continue;
				if (GOAL_POS[v1].r > GOAL_POS[v2].r) lc++;
			}
		}
	return md + 2 * lc;
}

function optimalMoves(start: number[]): number | null {
	const b = start.slice();
	let bound = puzzleHeuristic(b),
		nodes = 0;
	const MAX_NODES = 3e6;
	function dfs(blank: number, g: number, bnd: number, prev: number): number {
		if (++nodes > MAX_NODES) return -2;
		const h = puzzleHeuristic(b),
			f = g + h;
		if (f > bnd) return f;
		if (h === 0) return -1;
		let min = Infinity;
		const r = Math.floor(blank / N),
			c = blank % N,
			mv: number[] = [];
		if (r > 0) mv.push(blank - N);
		if (r < N - 1) mv.push(blank + N);
		if (c > 0) mv.push(blank - 1);
		if (c < N - 1) mv.push(blank + 1);
		for (const nb of mv) {
			if (nb === prev) continue;
			b[blank] = b[nb];
			b[nb] = 0;
			const t = dfs(nb, g + 1, bnd, blank);
			b[nb] = b[blank];
			b[blank] = 0;
			if (t === -1) return -1;
			if (t === -2) return -2;
			if (t < min) min = t;
		}
		return min;
	}
	while (true) {
		const t = dfs(b.indexOf(0), 0, bound, -1);
		if (t === -1) return bound;
		if (t === -2 || t === Infinity) return null;
		bound = t;
	}
}

type Tile = {
	img: Phaser.GameObjects.Image;
	label: Phaser.GameObjects.Text;
	cropX: number;
	cropY: number;
};

export class SlidingPuzzle extends Phaser.Scene {
	private stage = 2;
	private picKey = "puzzle-1"; // chosen randomly per play in init()
	private picUrl = "/puzzle/1.jpg";
	private moves = 0;
	private busy = false;
	private won = false;
	private par: number | null = null;
	private grid: number[] = [];
	private blank = 0;
	private tiles: Record<number, Tile> = {};
	private movesText!: Phaser.GameObjects.Text;
	private parText!: Phaser.GameObjects.Text;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private previewOpen = false;

	constructor() {
		super("SlidingPuzzle");
	}

	init(data: { stage?: number } = {}) {
		this.stage = data.stage ?? 2;
		// pick a random picture for this play; key is stable per image so it caches
		const n = Phaser.Math.Between(1, PUZZLE_COUNT);
		this.picKey = `puzzle-${n}`;
		this.picUrl = `/puzzle/${n}.jpg`;
	}

	preload() {
		// skipped automatically if this image was already loaded on a prior play
		this.load.image(this.picKey, this.picUrl);
	}

	create() {
		this.moves = 0;
		this.busy = false;
		this.won = false;
		this.previewOpen = false;

		fitStage(this, GW, GH);
		this.add.rectangle(0, 0, GW, GH, 0x16213e).setOrigin(0); // game panel

		this.buildPicture();

		this.add
			.text(GW / 2, 18 * S, "Sliding Puzzle", {
				fontFamily: FONT, fontSize: px(22),
				color: "#fff",
				fontStyle: "bold",
				padding: { y: 6 },
			})
			.setOrigin(0.5, 0);
		this.movesText = this.add
			.text(MARGIN, 66 * S, "Moves: 0", {
				fontFamily: FONT, fontSize: px(18),
				color: "#ffd166",
				fontStyle: "bold",
				padding: { y: 6 },
			})
			.setOrigin(0, 0.5);
		this.parText = this.add
			.text(GW / 2, 66 * S, "Par: —", {
				fontFamily: FONT, fontSize: px(16),
				color: "#8fb3d9",
				fontStyle: "bold",
				padding: { y: 6 },
			})
			.setOrigin(0.5);
		const tx = GW - MARGIN - 22 * S;
		const thumb = this.add
			.image(tx, 66 * S, "pic")
			.setDisplaySize(44 * S, 44 * S)
			.setOrigin(0.5)
			.setInteractive({ useHandCursor: true });
		thumb.on("pointerdown", () => this.openPreview());
		this.add
			.rectangle(tx, 66 * S, 46 * S, 46 * S, 0x000000, 0)
			.setStrokeStyle(2 * S, 0x8a8fff);
		this.add
			.text(
				GW / 2,
				GH - BOT_BAR / 2,
				"Tap a piece next to the gap — or use arrow keys",
				{ fontFamily: FONT, fontSize: px(13), color: "#889", padding: { y: 4 } },
			)
			.setOrigin(0.5);

		this.add
			.rectangle(
				MARGIN - GAP,
				TOP_BAR + MARGIN - GAP,
				boardW + GAP * 2,
				boardW + GAP * 2,
				0x0f1830,
			)
			.setOrigin(0, 0)
			.setStrokeStyle(2 * S, 0x2a3a63);

		this.buildTiles();
		do {
			this.shuffle();
			this.par = optimalMoves(this.grid);
		} while (this.par === null); // re-scramble a board the solver can't rate (rare)
		this.render(false);
		this.parText.setText("Par: " + this.par);

		this.cursors = this.input.keyboard!.createCursorKeys();
	}

	private buildPicture() {
		// Cover-crop the (possibly non-square) photo into a PB×PB square so tiles
		// aren't stretched, then bake it to the "pic" texture the tiles crop from.
		const img = this.textures.get(this.picKey).getSourceImage();
		const scale = Math.max(PB / img.width, PB / img.height);
		const src = this.add
			.image(PB / 2, PB / 2, this.picKey)
			.setOrigin(0.5)
			.setScale(scale);
		const rt = this.add.renderTexture(0, 0, PB, PB).setVisible(false);
		rt.draw(src);
		if (this.textures.exists("pic")) this.textures.remove("pic");
		rt.saveTexture("pic");
		src.destroy();
	}

	private buildTiles() {
		this.grid = [];
		for (let i = 0; i < N * N; i++) this.grid[i] = (i + 1) % (N * N); // solved: 1..15,0
		this.blank = N * N - 1;

		this.tiles = {};
		for (let v = 1; v < N * N; v++) {
			const home = v - 1;
			const cropX = (home % N) * TILE,
				cropY = Math.floor(home / N) * TILE;
			const img = this.add.image(0, 0, "pic").setOrigin(0, 0);
			img.setCrop(cropX, cropY, TILE, TILE);
			img.setInteractive(
				new Phaser.Geom.Rectangle(cropX, cropY, TILE, TILE),
				Phaser.Geom.Rectangle.Contains,
			);
			img.input!.cursor = "pointer";
			img.on("pointerdown", () => this.tapTile(v));
			const label = this.add
				.text(0, 0, String(v), {
					fontFamily: FONT, fontSize: px(14),
					color: "#ffffff",
					fontStyle: "bold",
					padding: { x: 2, y: 1 },
				})
				.setOrigin(0, 0)
				.setDepth(5)
				.setAlpha(0.4);
			label.setStroke("#12203a", 3 * S);
			this.tiles[v] = { img, label, cropX, cropY };
		}
	}

	private shuffle() {
		let last = -1;
		for (let k = 0; k < SCRAMBLE_MOVES; k++) {
			const s = Phaser.Utils.Array.GetRandom(
				this.neighbors(this.blank).filter((x) => x !== last),
			);
			last = this.blank;
			this.grid[this.blank] = this.grid[s];
			this.grid[s] = 0;
			this.blank = s;
		}
		if (this.isSolved()) this.shuffle();
	}

	private neighbors(i: number) {
		const { r, c } = rc(i);
		const out: number[] = [];
		if (r > 0) out.push(i - N);
		if (r < N - 1) out.push(i + N);
		if (c > 0) out.push(i - 1);
		if (c < N - 1) out.push(i + 1);
		return out;
	}

	private slotOf(value: number) {
		return this.grid.indexOf(value);
	}

	private placeTile(v: number, slot: number, animate: boolean) {
		const t = this.tiles[v];
		const ix = slotLeft(slot) - t.cropX,
			iy = slotTop(slot) - t.cropY;
		const lx = slotLeft(slot) + 7 * S,
			ly = slotTop(slot) + 5 * S;
		if (animate) {
			this.tweens.add({
				targets: t.img,
				x: ix,
				y: iy,
				duration: SLIDE_MS,
				ease: "Quad.easeOut",
			});
			this.tweens.add({
				targets: t.label,
				x: lx,
				y: ly,
				duration: SLIDE_MS,
				ease: "Quad.easeOut",
			});
		} else {
			t.img.setPosition(ix, iy);
			t.label.setPosition(lx, ly);
		}
	}

	private render(animate: boolean) {
		for (let v = 1; v < N * N; v++) this.placeTile(v, this.slotOf(v), animate);
	}

	// Tap the preview thumbnail → show the full solution image; tap to dismiss.
	private openPreview() {
		if (this.previewOpen) return;
		this.previewOpen = true;
		const D = 200;
		const size = GW - MARGIN * 2;
		const cx = GW / 2,
			cy = GH / 2 - 12 * S;
		const bg = this.add
			.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.82)
			.setDepth(D)
			.setInteractive();
		const big = this.add
			.image(cx, cy, "pic")
			.setDisplaySize(size, size)
			.setDepth(D + 1)
			.setInteractive();
		const frame = this.add
			.rectangle(cx, cy, size, size, 0x000000, 0)
			.setStrokeStyle(3 * S, 0x8a8fff)
			.setDepth(D + 1);
		const close = () => {
			[bg, big, frame].forEach((o) => o.destroy());
			this.previewOpen = false;
		};
		bg.on("pointerdown", close);
		big.on("pointerdown", close);
	}

	private tapTile(value: number) {
		if (this.busy || this.won || this.previewOpen) return;
		const slot = this.slotOf(value);
		if (!this.neighbors(slot).includes(this.blank)) return;
		this.slide(value, slot);
	}

	private slide(value: number, slot: number) {
		this.grid[this.blank] = value;
		this.grid[slot] = 0;
		this.blank = slot;
		this.moves++;
		this.movesText.setText("Moves: " + this.moves);
		this.busy = true;
		const t = this.tiles[value],
			dest = this.slotOf(value);
		this.tweens.add({
			targets: t.label,
			x: slotLeft(dest) + 7 * S,
			y: slotTop(dest) + 5 * S,
			duration: SLIDE_MS,
			ease: "Quad.easeOut",
		});
		this.tweens.add({
			targets: t.img,
			x: slotLeft(dest) - t.cropX,
			y: slotTop(dest) - t.cropY,
			duration: SLIDE_MS,
			ease: "Quad.easeOut",
			onComplete: () => {
				this.busy = false;
				if (this.isSolved()) this.win();
			},
		});
	}

	private isSolved() {
		for (let i = 0; i < N * N - 1; i++)
			if (this.grid[i] !== i + 1) return false;
		return true;
	}

	update() {
		if (this.busy || this.won || this.previewOpen) return;
		const jd = Phaser.Input.Keyboard.JustDown,
			c = this.cursors;
		let from = -1;
		if (jd(c.up) && this.blank + N < N * N) from = this.blank + N;
		else if (jd(c.down) && this.blank - N >= 0) from = this.blank - N;
		else if (jd(c.left) && this.blank % N < N - 1) from = this.blank + 1;
		else if (jd(c.right) && this.blank % N > 0) from = this.blank - 1;
		if (from >= 0) this.slide(this.grid[from], from);
	}

	private win() {
		this.won = true;
		for (let v = 1; v < N * N; v++) this.tiles[v].label.setVisible(false); // clean picture
		const last = N * N - 1,
			cx = (N - 1) * TILE,
			cy = (N - 1) * TILE;
		this.add
			.image(slotLeft(last) - cx, slotTop(last) - cy, "pic")
			.setOrigin(0, 0)
			.setCrop(cx, cy, TILE, TILE);
		this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.68).setDepth(10);
		this.add
			.text(GW / 2, GH / 2 - 24 * S, "Solved! 🧩", {
				fontFamily: FONT, fontSize: px(34),
				color: "#fff",
				fontStyle: "bold",
				padding: { y: 8 },
			})
			.setOrigin(0.5)
			.setDepth(11);
		this.add
			.text(GW / 2, GH / 2 + 22 * S, `${this.moves} moves`, {
				fontFamily: FONT, fontSize: px(16),
				color: "#aab",
				padding: { y: 6 },
			})
			.setOrigin(0.5)
			.setDepth(11);
		this.time.delayedCall(1100, () => clearStage(this, this.stage));
	}
}


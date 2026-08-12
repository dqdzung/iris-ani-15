import Phaser from "phaser";
import { S, px } from "../config";
import { fitStage, clearStage, retryStage } from "../stageUtils";

// Stage 1 — Loot Catcher (ported from MiniGames). Move the basket to catch rewards,
// dodge bugs. Clear = survive SURVIVE seconds without losing all lives.
// Authored in its native portrait size; fitStage() centers it in the landscape canvas.

const GW = 480 * S;
const GH = 640 * S;

// Rewards are images from public/loot-catcher (key/file), weighted by rarity.
// Weight falls as value rises → the more a reward is worth, the rarer it is.
const REWARDS = [
	{ key: "lc-1800", file: "1800_1900.png", weight: 28, value: 10 },
	{ key: "lc-6x67", file: "6x67.png", weight: 22, value: 20 },
	// topup / gameCard / dataCard are the same type → same weight + value
	{ key: "lc-topup", file: "topup.png", weight: 16, value: 30 },
	{ key: "lc-gamecard", file: "gameCard.png", weight: 16, value: 30 },
	{ key: "lc-datacard", file: "dataCard.png", weight: 16, value: 30 },
	{ key: "lc-chatbot", file: "AIchatbot.png", weight: 13, value: 40 },
	{ key: "lc-dino", file: "Dino.png", weight: 10, value: 75 },
	{ key: "lc-sms", file: "sms-brand.png", weight: 8, value: 150 },
];
const REWARD_BOX = { w: 66, h: 44 }; // fit each image into this box (design units)
const BUG = "👾"; // the penalty item — a computer bug
const BOMB_CHANCE = 0.5;
const SURVIVE = 45; // seconds to last to clear the stage

const BASKET_Y = GH - 70 * S;
const BASKET_HALF = 42 * S;
const BASKET_BOX = { w: 96, h: 108 }; // fit the catcher image into this box (design units)
const ITEM_HALF = 20 * S;
const MOVE_SPEED = 680 * S;

type Item = {
	t: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
	bomb: boolean;
	value: number;
	label: Phaser.GameObjects.Text | null;
};

export class LootCatcher extends Phaser.Scene {
	private stage = 1;
	private score = 0;
	private lives = 3;
	private timeLeft = SURVIVE;
	private over = false;
	private items: Item[] = [];
	private fallSpeed = 160 * S;
	private spawnEvery = 900;
	private sinceSpawn = 0;

	private basket!: Phaser.GameObjects.Image;
	private catchTimer?: Phaser.Time.TimerEvent;
	private scoreText!: Phaser.GameObjects.Text;
	private livesText!: Phaser.GameObjects.Text;
	private timeText!: Phaser.GameObjects.Text;
	private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
	private keys!: { A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

	constructor() {
		super("LootCatcher");
	}

	init(data: { stage?: number } = {}) {
		this.stage = data.stage ?? 1;
	}

	preload() {
		for (const r of REWARDS) this.load.image(r.key, "/loot-catcher/" + r.file);
		this.load.image("lc-catcher", "/loot-catcher/catcher.png");
		this.load.image("lc-catcher-caught", "/loot-catcher/catcher-caught.png");
		this.load.image("lc-catcher-dizzy", "/loot-catcher/catcher-dizzy.png");
	}

	create() {
		this.score = 0;
		this.lives = 3;
		this.timeLeft = SURVIVE;
		this.over = false;
		this.items = [];
		this.fallSpeed = 160 * S;
		this.spawnEvery = 900;
		this.sinceSpawn = 0;

		fitStage(this, GW, GH);
		this.add.rectangle(0, 0, GW, GH, 0x16213e).setOrigin(0); // game panel

		this.scoreText = this.add.text(16 * S, 12 * S, "Score: 0", {
			fontSize: px(20),
			color: "#ffd166",
			fontStyle: "bold",
			padding: { y: 6 },
		});
		this.timeText = this.add
			.text(GW / 2, 12 * S, "⏱ " + this.timeLeft, {
				fontSize: px(20),
				color: "#8fd0ef",
				fontStyle: "bold",
				padding: { y: 6 },
			})
			.setOrigin(0.5, 0);
		this.livesText = this.add
			.text(GW - 16 * S, 12 * S, "❤️".repeat(this.lives), {
				fontSize: px(20),
				padding: { y: 6 },
			})
			.setOrigin(1, 0);

		this.basket = this.add.image(GW / 2, BASKET_Y, "lc-catcher").setOrigin(0.5);
		this.setBasketFrame("lc-catcher");

		this.input.setDefaultCursor("none"); // basket follows the pointer; hide the OS cursor
		this.cursors = this.input.keyboard!.createCursorKeys();
		this.keys = this.input.keyboard!.addKeys("A,D") as typeof this.keys;

		this.add
			.text(GW / 2, GH - 20 * S, "← → or move mouse · survive the clock", {
				fontSize: px(13),
				color: "#889",
				padding: { y: 4 },
			})
			.setOrigin(0.5);

		// Move the basket with the mouse. Pointer lock is engaged on the start screen
		// (StageCard) so the mouse can't leave the game — use relative movement while
		// locked; fall back to absolute position if it's released (Esc).
		this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
			if (this.over) return;
			if (this.input.mouse?.locked) {
				const clientW = this.sys.game.canvas.clientWidth || this.scale.width;
				const sens = this.scale.width / clientW / this.cameras.main.zoom; // → ~1:1 feel
				this.basket.x = Phaser.Math.Clamp(
					this.basket.x + p.movementX * sens,
					BASKET_HALF,
					GW - BASKET_HALF,
				);
			} else {
				this.basket.x = Phaser.Math.Clamp(
					p.worldX,
					BASKET_HALF,
					GW - BASKET_HALF,
				);
			}
		});

		// re-lock on click if it was released with Esc (native gesture — Phaser's own
		// pointer events fire off-gesture, so requestPointerLock() there is blocked)
		const canvas = this.sys.game.canvas;
		const relock = () => {
			if (!this.over && !this.input.mouse?.locked)
				this.input.mouse?.requestPointerLock();
		};
		canvas.addEventListener("mousedown", relock);
		this.events.once("shutdown", () => {
			canvas.removeEventListener("mousedown", relock);
			this.input.mouse?.releasePointerLock();
		});

		this.time.addEvent({
			delay: 1000,
			loop: true,
			callback: this.tick,
			callbackScope: this,
		});
	}

	private tick() {
		if (this.over) return;
		this.timeLeft--;
		this.timeText.setText("⏱ " + Math.max(0, this.timeLeft));
		if (this.timeLeft <= 0) this.survive();
	}

	private pickReward() {
		const total = REWARDS.reduce((s, r) => s + r.weight, 0);
		let roll = Math.random() * total;
		for (const r of REWARDS) if ((roll -= r.weight) < 0) return r;
		return REWARDS[0];
	}

	private spawnItem() {
		const isBomb = Math.random() < BOMB_CHANCE;
		const reward = isBomb ? null : this.pickReward();
		const value = isBomb ? 0 : reward!.value;
		const x = Phaser.Math.Between(ITEM_HALF + 8 * S, GW - ITEM_HALF - 8 * S);
		// bug stays an emoji; rewards are images fit into REWARD_BOX (aspect kept)
		let t: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
		if (isBomb) {
			t = this.add
				.text(x, -ITEM_HALF, BUG, { fontSize: px(34), padding: { y: 6 } })
				.setOrigin(0.5);
		} else {
			const img = this.add.image(x, -ITEM_HALF, reward!.key).setOrigin(0.5);
			const src = this.textures.get(reward!.key).getSourceImage();
			img.setScale(
				Math.min((REWARD_BOX.w * S) / src.width, (REWARD_BOX.h * S) / src.height),
			);
			t = img;
		}
		const label = isBomb
			? null
			: this.add
					.text(x, t.y + 22 * S, "+" + value, {
						fontSize: px(13),
						color: "#ffd166",
						fontStyle: "bold",
						padding: { y: 2 },
					})
					.setOrigin(0.5);
		this.items.push({ t, bomb: isBomb, value, label });
	}

	update(_time: number, delta: number) {
		if (this.over) return;
		const dt = delta / 1000;

		let dir = 0;
		if (this.cursors.left.isDown || this.keys.A.isDown) dir -= 1;
		if (this.cursors.right.isDown || this.keys.D.isDown) dir += 1;
		if (dir)
			this.basket.x = Phaser.Math.Clamp(
				this.basket.x + dir * MOVE_SPEED * dt,
				BASKET_HALF,
				GW - BASKET_HALF,
			);

		this.sinceSpawn += delta;
		if (this.sinceSpawn >= this.spawnEvery) {
			this.sinceSpawn = 0;
			this.spawnItem();
		}

		for (let i = this.items.length - 1; i >= 0; i--) {
			const item = this.items[i];
			item.t.y += this.fallSpeed * dt;
			if (item.label) item.label.y = item.t.y + 22 * S;

			const caught =
				item.t.y >= BASKET_Y - 24 * S &&
				item.t.y <= BASKET_Y + 24 * S &&
				Math.abs(item.t.x - this.basket.x) < BASKET_HALF + ITEM_HALF;

			if (caught) {
				this.resolveCatch(item);
				this.flashCatch(item.bomb ? "lc-catcher-dizzy" : "lc-catcher-caught");
				item.t.destroy();
				item.label?.destroy();
				this.items.splice(i, 1);
			} else if (item.t.y > GH + ITEM_HALF) {
				if (!item.bomb) this.loseLife();
				item.t.destroy();
				item.label?.destroy();
				this.items.splice(i, 1);
			}
			if (this.over) break;
		}
	}

	// swap the catcher image (idle / caught) and re-fit it into BASKET_BOX
	private setBasketFrame(key: string) {
		this.basket.setTexture(key);
		const src = this.textures.get(key).getSourceImage();
		this.basket.setScale(
			Math.min((BASKET_BOX.w * S) / src.width, (BASKET_BOX.h * S) / src.height),
		);
	}

	// briefly show a reaction frame (reward = caught, bug = dizzy), then return to idle
	private flashCatch(key: string) {
		this.setBasketFrame(key);
		this.catchTimer?.remove();
		this.catchTimer = this.time.delayedCall(220, () =>
			this.setBasketFrame("lc-catcher"),
		);
	}

	private loseLife() {
		this.lives--;
		this.livesText.setText("❤️".repeat(Math.max(0, this.lives)));
		this.cameras.main.shake(130, 0.005);
		if (this.lives <= 0) this.gameOver();
	}

	private resolveCatch(item: Item) {
		if (item.bomb) {
			this.loseLife();
		} else {
			this.score += item.value;
			this.scoreText.setText("Score: " + this.score);
			const level = Math.floor(this.score / 200);
			this.fallSpeed = (160 + level * 40) * S;
			this.spawnEvery = Math.max(400, 900 - level * 80);
		}
	}

	private clearItems() {
		this.items.forEach((it) => {
			it.t.destroy();
			it.label?.destroy();
		});
		this.items = [];
	}

	// survived the clock → stage cleared
	private survive() {
		this.over = true;
		this.input.mouse?.releasePointerLock();
		this.clearItems();
		this.add
			.text(GW / 2, GH / 2, "Made it! 🎉", {
				fontSize: px(34),
				color: "#ffd166",
				fontStyle: "bold",
				padding: { y: 8 },
			})
			.setOrigin(0.5);
		this.time.delayedCall(700, () => clearStage(this, this.stage));
	}

	private gameOver() {
		this.over = true;
		this.input.mouse?.releasePointerLock();
		this.input.setDefaultCursor("default"); // show cursor for the Try Again button
		this.clearItems();
		this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.75);
		this.add
			.text(GW / 2, GH / 2 - 24 * S, "Game Over 💥", {
				fontSize: px(36),
				color: "#fff",
				fontStyle: "bold",
				padding: { y: 8 },
			})
			.setOrigin(0.5);
		this.add
			.text(GW / 2, GH / 2 + 22 * S, `Lasted ${SURVIVE - this.timeLeft}s`, {
				fontSize: px(18),
				color: "#aab",
				padding: { y: 6 },
			})
			.setOrigin(0.5);
		const btn = this.add
			.rectangle(GW / 2, GH / 2 + 76 * S, 200 * S, 52 * S, 0xffd166)
			.setInteractive({ useHandCursor: true });
		this.add
			.text(GW / 2, GH / 2 + 76 * S, "Try Again", {
				fontSize: px(20),
				color: "#12141c",
				fontStyle: "bold",
				padding: { y: 6 },
			})
			.setOrigin(0.5);
		btn.on("pointerdown", () => retryStage(this, this.stage));
	}
}



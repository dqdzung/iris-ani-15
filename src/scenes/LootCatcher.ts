import Phaser from "phaser";
import { S, px } from "../config";
import { fitStage, clearStage, retryStage } from "../stageUtils";

// Stage 1 — Loot Catcher (ported from MiniGames). Move the basket to catch rewards,
// dodge bombs. Clear = survive SURVIVE seconds without losing all lives.
// Authored in its native portrait size; fitStage() centers it in the landscape canvas.

const GW = 480 * S;
const GH = 640 * S;

const REWARDS = [
  { emoji: "🍒", weight: 45, value: 10 },
  { emoji: "🍎", weight: 28, value: 20 },
  { emoji: "🎁", weight: 15, value: 40 },
  { emoji: "💎", weight: 8, value: 75 },
  { emoji: "⭐", weight: 4, value: 150 },
];
const BOMB = "💣";
const BOMB_CHANCE = 0.5;
const SURVIVE = 45; // seconds to last to clear the stage

const BASKET_Y = GH - 60 * S;
const BASKET_HALF = 42 * S;
const ITEM_HALF = 20 * S;
const MOVE_SPEED = 680 * S;

type Item = {
  t: Phaser.GameObjects.Text;
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

  private basket!: Phaser.GameObjects.Text;
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

    this.basket = this.add
      .text(GW / 2, BASKET_Y, "🧺", { fontSize: px(56), padding: { y: 8 } })
      .setOrigin(0.5);

    this.input.setDefaultCursor("none"); // basket follows the pointer; hide the OS cursor
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("A,D") as typeof this.keys;
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.over)
        this.basket.x = Phaser.Math.Clamp(
          p.worldX,
          BASKET_HALF,
          GW - BASKET_HALF,
        );
    });

    this.add
      .text(GW / 2, GH - 20 * S, "← → or drag to move · survive the clock", {
        fontSize: px(13),
        color: "#889",
        padding: { y: 4 },
      })
      .setOrigin(0.5);

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
    const symbol = isBomb ? BOMB : reward!.emoji;
    const value = isBomb ? 0 : reward!.value;
    const x = Phaser.Math.Between(ITEM_HALF + 8 * S, GW - ITEM_HALF - 8 * S);
    const t = this.add
      .text(x, -ITEM_HALF, symbol, { fontSize: px(34), padding: { y: 6 } })
      .setOrigin(0.5);
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

  private loseLife() {
    this.lives--;
    this.livesText.setText("❤️".repeat(Math.max(0, this.lives)));
    this.cameras.main.shake(150, 0.01);
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

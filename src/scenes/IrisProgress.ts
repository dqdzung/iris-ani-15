import Phaser from "phaser";
import { vw, vh, u, fs } from "../layout";
import { showOverworld } from "../overworld";
import { playBootScreen } from "../bootScreen";

// Between-game transition: shows "IRIS", lighting one more letter for each game
// cleared. On the final game it lights the remaining letters and celebrates with
// fireworks + confetti (this doubles as the finish screen).
//   { lit }      — how many letters end up lit
//   { animFrom } — index of the first letter to animate on (earlier ones start lit)
//   { finale }   — light everything + party, then "play again"

const MONO = '"SFMono-Regular", ui-monospace, Menlo, monospace';
const GOLD = "#ffd166";
const DIM = 0x4a4a3a;
const LIT = { r: 0xff, g: 0xd1, b: 0x66 };
const CONFETTI = [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2, 0xffffff, 0xf78c6b];

export class IrisProgress extends Phaser.Scene {
  private lit = 1;
  private animFrom = 0;
  private finale = false;
  private letters: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("IrisProgress");
  }

  init(data: { lit?: number; animFrom?: number; finale?: boolean } = {}) {
    this.lit = data.lit ?? 1;
    this.animFrom = data.animFrom ?? this.lit - 1;
    this.finale = data.finale ?? false;
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor("#0a0b0a");
    cam.fadeIn(220);

    const cx = vw(this) / 2,
      cy = vh(this) / 2,
      U = u(this);
    const spacing = 84 * U;

    this.letters = "IRIS".split("").map((ch, i) => {
      const t = this.add
        .text(cx + (i - 1.5) * spacing, cy - 20 * U, ch, {
          fontFamily: MONO,
          fontSize: fs(this, 88),
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      // letters lit before this screen already glow; the rest are dim
      if (i < this.animFrom) {
        t.setTint(0xffd166);
        t.setShadow(0, 0, GOLD, 18, false, true);
      } else {
        t.setTint(DIM);
      }
      return t;
    });

    // light the newly-earned letter(s), staggered (finale lights the last, "S")
    let delay = 320;
    for (let i = this.animFrom; i < this.lit; i++) {
      this.lightLetter(i, delay, U);
      delay += 520;
    }
    const animDone = delay + 200;

    // finale: once the letter is lit, run the restore bar → celebration.
    if (this.finale) {
      this.time.delayedCall(animDone, () => this.runRestore(cx, cy, U));
    } else {
      this.showPrompt(cx, cy, U, animDone);
    }
  }

  // Finale: a "restoring memories" progress bar shown after the letters are lit,
  // then hands off to the celebration (headline + fireworks + prompt).
  private runRestore(cx: number, cy: number, U: number) {
    const barW = Math.min(vw(this) * 0.5, 360 * U);
    const barH = 12 * U;
    const by = cy + 90 * U;

    // Show the "RESTORING MEMORIES" label first…
    const label = this.add
      .text(cx, by - 26 * U, "RESTORING MEMORIES", {
        fontFamily: MONO,
        fontSize: fs(this, 18),
        color: "#8a8fa3",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: label, alpha: 1, duration: 300 });

    // …then bring in the bar and start filling a beat later.
    this.time.delayedCall(700, () =>
      this.runRestoreBar(cx, cy, U, barW, barH, by, label),
    );
  }

  private runRestoreBar(
    cx: number,
    cy: number,
    U: number,
    barW: number,
    barH: number,
    by: number,
    label: Phaser.GameObjects.Text,
  ) {
    const track = this.add
      .rectangle(cx, by, barW, barH, 0x000000)
      .setStrokeStyle(2 * U, 0x4a4a3a);
    const fill = this.add
      .rectangle(cx - barW / 2, by, 0, barH, 0xffd166)
      .setOrigin(0, 0.5);
    const pct = this.add
      .text(cx, by + 26 * U, "0%", {
        fontFamily: MONO,
        fontSize: fs(this, 16),
        color: GOLD,
      })
      .setOrigin(0.5);

    // Fill fast to ~90%, hang there a beat (the classic "almost done" stall), then
    // crawl the last stretch — so it reads as a long restore finishing up.
    const prog = { v: 0 };
    const draw = () => {
      fill.width = barW * prog.v;
      pct.setText(`${Math.round(prog.v * 100)}%`);
    };
    this.tweens.chain({
      targets: prog,
      tweens: [
        { v: 0.9, duration: 1400, ease: "Quad.easeOut", onUpdate: draw },
        { v: 0.9, duration: 900, onUpdate: draw }, // hang
        { v: 0.97, duration: 1100, ease: "Sine.easeInOut", onUpdate: draw },
        { v: 0.97, duration: 500, onUpdate: draw }, // hang again
        { v: 1, duration: 500, ease: "Quad.easeIn", onUpdate: draw },
      ],
      onComplete: () => {
        this.tweens.add({
          targets: [label, track, fill, pct],
          alpha: 0,
          duration: 300,
          onComplete: () => [label, track, fill, pct].forEach((o) => o.destroy()),
        });
        this.celebrate(cx, cy, U);
        this.showPrompt(cx, cy, U, 1400);
      },
    });
  }

  private lightLetter(i: number, delay: number, U: number) {
    this.time.delayedCall(delay, () => {
      const t = this.letters[i];
      t.setShadow(0, 0, GOLD, 20, false, true);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 400,
        onUpdate: (c) => {
          const v = c.getValue() ?? 0;
          t.setTint(
            Phaser.Display.Color.GetColor(
              Math.floor(0x4a + (LIT.r - 0x4a) * v),
              Math.floor(0x4a + (LIT.g - 0x4a) * v),
              Math.floor(0x3a + (LIT.b - 0x3a) * v),
            ),
          );
        },
      });
      this.tweens.add({
        targets: t,
        scale: { from: 1, to: 1.3 },
        duration: 200,
        yoyo: true,
        ease: "Quad.easeOut",
      });
      // a soft flash pulse behind the letter as it ignites
      const flash = this.add
        .circle(t.x, t.y, 60 * U, 0xffd166, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 500,
        onComplete: () => flash.destroy(),
      });
    });
  }

  private celebrate(cx: number, cy: number, U: number) {
    const headline = this.add
      .text(cx, cy - 130 * U, "MEMORIES RESTORED", {
        fontFamily: MONO,
        fontSize: fs(this, 26),
        color: GOLD,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: headline, alpha: 1, duration: 500 });

    this.ensureTextures();

    // confetti raining from the top for a few seconds
    this.add.particles(0, -20, "ip-confetti", {
      x: { min: 0, max: vw(this) },
      y: -20,
      speedY: { min: 140, max: 300 },
      speedX: { min: -60, max: 60 },
      lifespan: 4000,
      frequency: 50,
      quantity: 2,
      rotate: { min: 0, max: 360 },
      tint: CONFETTI,
      scale: { min: 0.7, max: 1.5 },
      duration: 3500,
    });

    // a volley of firework bursts
    let n = 0;
    const boom = () => {
      if (n++ >= 7) return;
      const x = Phaser.Math.Between(
        Math.round(vw(this) * 0.15),
        Math.round(vw(this) * 0.85),
      );
      const y = Phaser.Math.Between(
        Math.round(vh(this) * 0.12),
        Math.round(vh(this) * 0.5),
      );
      const e = this.add.particles(x, y, "ip-spark", {
        speed: { min: 80, max: 260 },
        angle: { min: 0, max: 360 },
        lifespan: 1000,
        gravityY: 200,
        scale: { start: 1.1, end: 0 },
        tint: Phaser.Utils.Array.GetRandom(CONFETTI),
        blendMode: "ADD",
        emitting: false,
      });
      e.explode(40);
      this.time.delayedCall(1300, () => e.destroy());
      this.time.delayedCall(Phaser.Math.Between(250, 520), boom);
    };
    boom();
  }

  // small white circle + rectangle textures for the particle emitters
  private ensureTextures() {
    if (!this.textures.exists("ip-spark")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5);
      g.generateTexture("ip-spark", 10, 10);
      g.destroy();
    }
    if (!this.textures.exists("ip-confetti")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 6, 10);
      g.generateTexture("ip-confetti", 6, 10);
      g.destroy();
    }
  }

  private showPrompt(cx: number, cy: number, U: number, delay: number) {
    this.time.delayedCall(delay, () => {
      const prompt = this.add
        .text(
          cx,
          cy + 100 * U,
          this.finale ? "thanks for playing" : "tap to continue",
          { fontFamily: MONO, fontSize: fs(this, 22), color: GOLD },
        )
        .setOrigin(0.5);
      this.tweens.add({
        targets: prompt,
        alpha: { from: 1, to: 0.3 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.input.once("pointerdown", () => {
        this.input.enabled = false;
        if (this.finale) {
          this.cameras.main.fadeOut(220);
          this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.stop();
            // finale → back to the boot screen (full replay); ENTER restarts game 1
            playBootScreen(() => showOverworld(0));
          });
        } else {
          this.flyLetterToNextBadge(prompt, cx, cy, U);
        }
      });
    });
  }

  // Fly the upcoming game's letter from the IRIS row into that game's badge circle
  // (same idea as the boot screen's "I" → game-1 badge). The next card renders
  // beneath this now-transparent scene, and the letter dissolves onto its badge.
  private flyLetterToNextBadge(
    prompt: Phaser.GameObjects.Text,
    cx: number,
    cy: number,
    U: number,
  ) {
    const flyer = this.letters[this.lit]; // next stage's letter (0-based index = lit)
    if (!flyer) {
      this.scene.stop();
      showOverworld(this.lit);
      return;
    }

    // reveal the next card beneath (fly:true → its badge letter waits for the
    // incoming flyer), then let it show through this scene
    showOverworld(this.lit, true);
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.cameras.main.transparent = true;

    // clear the rest of the screen, keep only the flyer
    prompt.destroy();
    this.letters.forEach((t, i) => {
      if (i !== this.lit) this.tweens.add({ targets: t, alpha: 0, duration: 220 });
    });

    // light the flyer (it starts dim) as it travels
    flyer.setShadow(0, 0, GOLD, 20, false, true);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 350,
      onUpdate: (c) => {
        const v = c.getValue() ?? 0;
        flyer.setTint(
          Phaser.Display.Color.GetColor(
            Math.floor(0x4a + (LIT.r - 0x4a) * v),
            Math.floor(0x4a + (LIT.g - 0x4a) * v),
            Math.floor(0x3a + (LIT.b - 0x3a) * v),
          ),
        );
      },
    });

    // fly to the badge position/size (StageCard badge = fs(30) at cy-120·U)
    this.tweens.add({
      targets: flyer,
      x: cx,
      y: cy - 120 * U,
      scale: 30 / 88, // IRIS letter fs(88) → badge fs(30)
      duration: 650,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        // dissolve onto the (already-bright) badge beneath, then stop this scene
        this.tweens.add({
          targets: flyer,
          alpha: 0,
          duration: 250,
          onComplete: () => this.scene.stop(),
        });
      },
    });
  }
}

// First-run loading screen: a black CRT overlay with the flipping IRIS TECH logo
// (same look as the boot screen) shown while every heavy asset — the finale
// video, the music, and all game images — downloads into the browser cache.
// When all fetches settle (or a safety timeout hits) it fades out and hands off
// to the TV intro → boot screen, so nothing stalls mid-game later.

import { FONT } from "./config";

// Everything worth pre-warming. Games/scenes still load these by their own keys
// on demand; by then the bytes are already in the HTTP cache, so it's instant.
const ASSETS = [
  "/iristech.png",
  "/video/iris-progress.mp4",
  "/audio/first-regression.mp3",
  ...Array.from({ length: 14 }, (_, i) => `/puzzle/${i + 1}.jpg`),
  "/loot-catcher/1800_1900.png",
  "/loot-catcher/6x67.png",
  "/loot-catcher/AIchatbot.png",
  "/loot-catcher/Dino.png",
  "/loot-catcher/catcher.png",
  "/loot-catcher/catcher-caught.png",
  "/loot-catcher/catcher-dizzy.png",
  "/loot-catcher/dataCard.png",
  "/loot-catcher/gameCard.png",
  "/loot-catcher/sms-brand.png",
  "/loot-catcher/topup.png",
  "/whack-a-mole/boss1.png",
  "/whack-a-mole/boss1-dizzy.png",
  "/whack-a-mole/boss2.png",
  "/whack-a-mole/boss2-dizzy.png",
];

const CSS = `
#loading {
  position: fixed; inset: 0; z-index: 60; background: #0a0b0a; color: #d6d6d6;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(20px, 5vh, 44px); font: 400 clamp(14px, 2.4vw, 20px)/1.25 ${FONT};
  text-shadow: 0 0 2px rgba(120,255,160,.25); transition: opacity .5s ease;
  animation: loadFlicker .12s steps(2) infinite;
}
#loading::after { /* scanlines + vignette, matching the boot screen */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px),
    radial-gradient(120% 120% at 50% 50%, transparent 62%, rgba(0,0,0,.55) 100%);
}
#loading.out { opacity: 0; }
#loading .logo {
  width: clamp(150px, 24vw, 240px); height: auto;
  animation: loadFlip 2.6s linear infinite;
}
#loading .cap { letter-spacing: .14em; opacity: .85; min-width: 8ch; text-align: center; }
@keyframes loadFlip {
  from { transform: perspective(500px) rotateY(0deg); }
  to   { transform: perspective(500px) rotateY(360deg); }
}
@keyframes loadFlicker { 0% { opacity: 1; } 100% { opacity: .97; } }
`;

const MIN_MS = 900; // keep the logo on screen a beat, even when fully cached
const MAX_MS = 20000; // never block forever on a stuck/failed asset

export function playLoadingScreen(onDone: () => void) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "loading";
  root.innerHTML =
    '<img class="logo" src="/iristech.png" alt="" />' +
    '<div class="cap">Loading</div>';
  document.body.appendChild(root);

  const cap = root.querySelector<HTMLElement>(".cap")!;
  let d = 0;
  const dotTimer = window.setInterval(() => {
    d = (d + 1) % 4;
    cap.textContent = "Loading" + ".".repeat(d);
  }, 350);

  const startedAt = performance.now();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(dotTimer);
    clearTimeout(maxTimer);
    root.classList.add("out");
    const cleanup = () => {
      root.remove();
      style.remove();
      onDone();
    };
    root.addEventListener("transitionend", cleanup, { once: true });
    setTimeout(cleanup, 700); // fallback if transitionend doesn't fire
  };
  const maxTimer = window.setTimeout(finish, MAX_MS);

  Promise.allSettled(
    ASSETS.map((u) => fetch(u).then((r) => r.blob())),
  ).then(() => {
    const wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
    setTimeout(finish, wait);
  });
}

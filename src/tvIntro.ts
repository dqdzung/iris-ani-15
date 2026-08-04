// One-shot "old TV turning on" intro. A full-screen DOM overlay: black → a bright
// horizontal line snaps on → expands to fill → flash + flicker + scanlines → the
// whole overlay fades out, revealing whatever is beneath (the overworld). Removes
// itself when done. Pure CSS animation; call once at startup.

const CSS = `
#tv-intro {
  position: fixed; inset: 0; z-index: 50; background: #000; overflow: hidden;
  animation: tvReveal 1.5s ease-out forwards;
}
#tv-intro .fill {
  position: absolute; inset: 0; background: #eaf6ff; transform-origin: center center;
  box-shadow: 0 0 80px 24px rgba(255,255,255,.85);
  animation: tvOn 1.35s cubic-bezier(.2,.7,.2,1) forwards;
}
#tv-intro .scan {
  position: absolute; inset: 0; mix-blend-mode: multiply; opacity: 0;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 4px);
  animation: tvScan 1.35s ease-out forwards;
}
@keyframes tvOn {
  0%   { transform: scale(0, .006); opacity: 0; }
  7%   { transform: scale(.5, .006); opacity: 1; }
  20%  { transform: scale(1, .006); opacity: 1; }   /* full-width thin line */
  42%  { transform: scale(1, 1); opacity: 1; }       /* expand vertically to fill */
  50%  { filter: brightness(1.8); }                  /* flash */
  60%  { filter: brightness(1); opacity: 1; }
  63%  { opacity: .35; }                             /* flicker */
  67%  { opacity: 1; }
  100% { transform: scale(1, 1); opacity: 1; }
}
@keyframes tvScan { 0%,36% { opacity: 0; } 46% { opacity: .55; } 100% { opacity: 0; } }
@keyframes tvReveal { 0%,80% { opacity: 1; } 100% { opacity: 0; } }
`;

export function playTvIntro(onDone?: () => void) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "tv-intro";
  root.innerHTML = '<div class="fill"></div><div class="scan"></div>';
  document.body.appendChild(root);

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    root.remove();
    style.remove();
    onDone?.();
  };
  root.addEventListener("animationend", (e) => {
    if ((e as AnimationEvent).animationName === "tvReveal") done();
  });
  setTimeout(done, 1800); // fallback cleanup
}

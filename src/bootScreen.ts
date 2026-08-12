// Old-PC boot sequence: a full-screen CRT terminal that types out the IRIS
// "memory system" boot log, then waits on ENTER. Pure DOM/CSS overlay
// (monospace + scanlines + flicker), sits above the game canvas. On ENTER /
// click everything fades except the first "I" of I R I S, which zooms in to
// fill the screen and then launches the first game (fires onStart).

import { FONT } from "./config";

const CSS = `
#boot {
  position: fixed; inset: 0; z-index: 40; background: #0a0b0a; color: #d6d6d6;
  font: 400 clamp(16px, 2.9vw, 24px)/1.55 ${FONT};
  padding: clamp(18px, 5vw, 60px); overflow: hidden; cursor: pointer;
  text-shadow: 0 0 2px rgba(120,255,160,.25);
  animation: bootFlicker .12s steps(2) infinite;
}
#boot::after { /* scanlines + vignette */
  content: ""; position: absolute; inset: 0; pointer-events: none; transition: opacity .35s ease;
  background:
    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px),
    radial-gradient(120% 120% at 50% 50%, transparent 62%, rgba(0,0,0,.55) 100%);
}
#boot pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
#boot .title { font-size: 1.6em; font-weight: 700; color: #f0f0f0; }
/* semantic status colors — sparse, each carries meaning */
#boot .err { color: #ef476f; }
#boot .ok { color: #06d6a0; }
#boot .iris { color: #ffd166; font-weight: 700; }
#boot .cur { display: inline-block; width: .6em; height: 1.1em;
  background: #d6d6d6; vertical-align: -2px; animation: bootBlink 1s steps(1) infinite; }
/* launch: fade the whole log except the zooming "I" (and the scanlines/cursor) */
#boot.launch::after { opacity: 0; }
#boot.launch .cur { animation: none; opacity: 0; }
#boot.launch .body > span:not(.iZoom) { opacity: 0; transition: opacity .35s ease; }
@keyframes bootBlink { 50% { opacity: 0; } }
@keyframes bootFlicker { 0% { opacity: 1; } 100% { opacity: .97; } }
`;

// Exact boot log. Segments type left-to-right; `after` is a pause once the
// segment finishes. `key: "firstI"` tags the first I of I R I S as the zoom target.
const SCRIPT: { t: string; after: number; key?: string; cls?: string }[] = [
	{ t: "IRIS Memory System v15.0 \n\n", after: 250 },
	{ t: "Loading...", after: 2000 }, // cursor hangs at end of this line a beat…
	{ t: "\n\n", after: 250 }, // …then drops down before the error
	{ t: "ERROR!\n\n", after: 250, cls: "err" },
	{
		t: "Memory corrupted. Archive missing. Searching for backup...",
		after: 1000,
	},
	{ t: "\n\n", after: 250 },
	{ t: "Found fragments:\n\n", after: 250, cls: "ok" },
	{ t: "I\n", after: 200, key: "firstI", cls: "iris" },
	{ t: "R\n", after: 200, cls: "iris" },
	{ t: "I\n", after: 200, cls: "iris" },
	{ t: "S\n\n", after: 450, cls: "iris" },
	{ t: "Press ENTER to start memory restoration...", after: 0 },
];

const CHAR_MS = 22;

export function playBootScreen(onStart: () => void) {
	const style = document.createElement("style");
	style.textContent = CSS;
	document.head.appendChild(style);

	const root = document.createElement("div");
	root.id = "boot";
	root.innerHTML =
		'<pre><span class="body"></span><span class="cur"></span></pre>';
	document.body.appendChild(root);
	const body = root.querySelector<HTMLSpanElement>(".body")!;

	let done = false;
	let handed = false;

	// Start the game scene *behind* the overlay so the card's "1" fades in under
	// the zoomed "I" (aligned), then the overlay dissolves — reads as I → 1.
	const handoff = () => {
		if (handed) return;
		handed = true;
		root.style.background = "transparent";
		onStart();
	};
	const cleanup = () => {
		root.remove();
		style.remove();
	};

	// Fade the log, keep the first "I", fly it to the StageCard badge (position +
	// size of the circled "1"), then dissolve it into the game's start screen.
	const start = () => {
		if (!done) return; // ignore input until the log finishes typing
		done = false; // guard against double-fire
		window.removeEventListener("keydown", onKey);
		root.removeEventListener("click", start);
		root.style.pointerEvents = "none";

		const iEl = body.querySelector<HTMLSpanElement>(".iZoom");
		if (!iEl) {
			handoff();
			cleanup();
			return;
		}

		root.classList.add("launch");

		// StageCard badge geometry, in CSS px (canvas renders device px scaled 1/DPR,
		// so its U = min(w,h)/540 and 30·U font map straight to these CSS values).
		const Ucss = Math.min(window.innerWidth, window.innerHeight) / 540;
		const badgeCx = window.innerWidth / 2;
		const badgeCy = window.innerHeight / 2 - 120 * Ucss;
		const targetFont = 30 * Ucss; // the badge "1" font size on screen
		const fontI = parseFloat(getComputedStyle(iEl).fontSize) || 18;

		const r = iEl.getBoundingClientRect();
		const dx = badgeCx - (r.left + r.width / 2);
		const dy = badgeCy - (r.top + r.height / 2);
		const scale = targetFont / fontI;
		iEl.style.display = "inline-block";
		iEl.style.transformOrigin = "center center";
		iEl.style.transition =
			"transform .7s cubic-bezier(.4,0,.2,1), color .5s ease";
		requestAnimationFrame(() => {
			iEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
			iEl.style.color = "#ffd166"; // recolor to the badge accent → seamless I→I
			iEl.style.textShadow = "none";
		});

		setTimeout(handoff, 480); // card badge "I" + circle fade in beneath the I
		setTimeout(() => {
			// dissolve the DOM I into the card's badge "I". Start only once that badge
			// has fully faded in behind (card camera fade ~700ms) so there's always a
			// bright I on screen — otherwise a gap between the two reads as a flash.
			iEl.style.transition += ", opacity .3s ease";
			iEl.style.opacity = "0";
		}, 800);
		setTimeout(cleanup, 1140);
	};

	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") start();
	};
	root.addEventListener("click", start);
	window.addEventListener("keydown", onKey);

	// Type the script segment by segment. Each segment gets its own <span> (so the
	// "I" is individually addressable); trailing newlines go outside the span as
	// text nodes, keeping the letter span sized to just the glyph for the zoom.
	let seg = 0,
		ch = 0,
		curSpan: HTMLSpanElement | null = null;
	const tick = () => {
		if (seg >= SCRIPT.length) {
			done = true;
			return;
		}
		const s = SCRIPT[seg];
		if (ch === 0) {
			curSpan = document.createElement("span");
			const classes: string[] = [];
			if (s.key === "firstI") classes.push("iZoom");
			if (seg === 0) classes.push("title"); // first line = bigger title
			if (s.cls) classes.push(s.cls); // semantic color (err / ok / iris)
			curSpan.className = classes.join(" ");
			body.appendChild(curSpan);
		}
		if (ch < s.t.length) {
			const c = s.t[ch++];
			if (c === "\n") body.appendChild(document.createTextNode("\n"));
			else curSpan!.textContent += c;
			setTimeout(tick, CHAR_MS);
		} else {
			seg++;
			ch = 0;
			setTimeout(tick, s.after);
		}
	};
	tick();
}



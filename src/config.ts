// Shared constants. Kept in their own module (no scene imports) so scenes can read
// them at module-load without a circular dependency through main.ts.

// Render at S× the design size so Scale.FIT downscales to the viewport → crisp text
// (upscaling a small canvas is what makes text blurry). Author in design units and
// multiply by S when placing; px() does it for font sizes.
export const S = 2;
export const px = (n: number) => `${n * S}px`;

export const GAME_W = 960; // design units
export const GAME_H = 540;
export const STAGE_COUNT = 4;

// Per-stage metadata: which scene runs it + the intro-card copy. Index = stage - 1.
export const STAGES = [
  {
    key: "LootCatcher",
    title: "Loot Catcher",
    how: "Move the basket to catch the loot and dodge bombs. Survive the clock.",
  },
  {
    key: "SlidingPuzzle",
    title: "Sliding Puzzle",
    how: "Slide the pieces next to the gap to rebuild the picture.",
  },
  {
    key: "WhackAMole",
    title: "Whack-a-Mole",
    how: "Bop the moles, avoid the bombs. Last the whole round.",
  },
  {
    key: "Stage",
    title: "The Summit",
    how: "One final push to the top.",
  },
];

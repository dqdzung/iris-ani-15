// Shared constants. Kept in their own module (no scene imports) so scenes can read
// them at module-load without a circular dependency through main.ts.

// Render at S× the design size so Scale.FIT downscales to the viewport → crisp text
// (upscaling a small canvas is what makes text blurry). Author in design units and
// multiply by S when placing; px() does it for font sizes.
export const S = 2;
export const px = (n: number) => `${n * S}px`;

// Vietnamese-friendly monospace (loaded in index.html) for in-game copy that may
// contain Vietnamese. SFMono renders VN diacritics poorly; JetBrains Mono doesn't.
export const FONT = '"JetBrains Mono", ui-monospace, "Menlo", monospace';

export const GAME_W = 960; // design units
export const GAME_H = 540;
export const STAGE_COUNT = 4;

// Per-stage metadata: which scene runs it + the intro-card copy. Index = stage - 1.
// `lock` = engage Pointer Lock on the start-screen click (relative mouse control).
export const STAGES = [
	{
		key: "LootCatcher",
		title: "Hứng Trọn Ý Tưởng",
		how: "Hứng lấy những ý tưởng giá trị, né bọ lỗi.",
		lock: true,
	},
	{
		key: "WhackAMole",
		title: "Trọng Người, Trị Lỗi",
		how: "Đập tan bọ lỗi, nể mặt sếp lớn.",
		lock: false,
	},
	{
		key: "PipeConnect",
		title: "Kết Nối Sáng Tạo",
		how: "Xoay các đoạn ống để khơi thông luồng chảy kết nối từ Khủng hoảng đến Giải pháp.",
		lock: false,
	},
	{
		key: "SlidingPuzzle",
		title: "Ghép Nên Đoàn Kết",
		how: "Trượt từng mảnh về đúng chỗ, ghép lại bức tranh chung của cả tập thể.",
		lock: false,
	},
];


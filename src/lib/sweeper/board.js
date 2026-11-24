/**
 * Board generation, with a guess-free guarantee where one can be found.
 *
 * ── THE PROBLEM WITH RANDOM MINESWEEPER ────────────────────────────────────
 *
 * A randomly filled board regularly reaches a position where no amount of
 * reasoning helps and the player must flip a coin — the 50/50 at the edge of
 * the board being the notorious case. Losing a ten-minute board to a coin flip
 * is not difficulty, it is noise, and it is the single thing that makes the
 * original feel unfair.
 *
 * So boards here are not merely generated, they are AUDITED: the solver plays
 * each candidate from its opening click, and a board ships only if deduction
 * alone clears it. The player is then owed an honest promise — every square on
 * this board can be reasoned out — which is what makes the hint button a
 * teaching tool rather than a crutch.
 *
 * ── WHY GENERATION WAITS FOR THE FIRST CLICK ───────────────────────────────
 *
 * Two reasons, and the second is the interesting one:
 *
 *   The familiar one: nobody should lose on move one, so the first click is
 *   made safe by construction rather than by reshuffling after the fact.
 *
 *   The one that makes the guarantee affordable: the first click is forced to
 *   be a ZERO, by keeping mines out of its whole neighbourhood. That opens a
 *   region instead of a single square, and the audit then starts from a real
 *   foothold. Boards opened on a bare 4 are mostly unsolvable by deduction, so
 *   demanding a zero raises the hit rate enough that honest retry is a viable
 *   strategy — no clever repair heuristics required.
 *
 * Where retry runs out of budget (dense Expert boards, mainly), the board still
 * ships, and `guessFree` comes back false. The UI says so. Quietly serving an
 * unaudited board under a guess-free badge would be the one unforgivable bug in
 * this feature.
 */

import { deduce, neighbours, MINE, SAFE, UNKNOWN } from "./solver.js";

export const DIFFICULTIES = {
	beginner: { label: "Beginner", width: 9, height: 9, mines: 10 },
	intermediate: { label: "Intermediate", width: 16, height: 16, mines: 40 },
	expert: { label: "Expert", width: 30, height: 16, mines: 99 },
};

/**
 * Seedable PRNG (mulberry32), so a failed audit can be reproduced from its seed
 * in a test rather than being a story about a board nobody can find again.
 */
export function rngFrom(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Adjacent-mine count for every cell. */
function countsFor(mines, width, height) {
	const size = width * height;
	const counts = new Int8Array(size);

	for (let i = 0; i < size; i += 1) {
		if (mines[i]) continue;
		let n = 0;
		for (const j of neighbours(i, width, height)) if (mines[j]) n += 1;
		counts[i] = n;
	}

	return counts;
}

/** Fisher-Yates over the permitted cells, then take the first `count`. */
function placeMines({ width, height, mines: count, forbidden, rng }) {
	const size = width * height;
	const pool = [];
	for (let i = 0; i < size; i += 1) if (!forbidden.has(i)) pool.push(i);

	for (let i = pool.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}

	const mines = new Uint8Array(size);
	for (let i = 0; i < count; i += 1) mines[pool[i]] = 1;
	return mines;
}

/**
 * Reveal a cell, opening the surrounding region when it is a zero.
 *
 * Iterative rather than recursive: an Expert board's opening can cascade
 * through hundreds of cells, and a blown stack mid-cascade would be a
 * spectacular way to lose a game.
 */
export function revealFrom(index, { revealed, counts, width, height }) {
	const stack = [index];
	const opened = [];

	while (stack.length > 0) {
		const i = stack.pop();
		if (revealed[i]) continue;

		revealed[i] = 1;
		opened.push(i);

		if (counts[i] === 0) {
			for (const n of neighbours(i, width, height)) {
				if (!revealed[n]) stack.push(n);
			}
		}
	}

	return opened;
}

/**
 * Play a board with the solver and report whether deduction alone finishes it.
 *
 * This is the audit. It is also an honest model of a perfect player: it only
 * ever reveals cells it has proved safe, so reaching a full board means every
 * square on it was reachable by reasoning.
 */
export function audit({ mines, counts, width, height, firstIndex, mineCount }) {
	const size = width * height;
	const revealed = new Uint8Array(size);
	const known = new Uint8Array(size);

	revealFrom(firstIndex, { revealed, counts, width, height });

	let steps = 0;
	for (;;) {
		let open = 0;
		for (let i = 0; i < size; i += 1) if (revealed[i]) open += 1;
		if (open === size - mineCount) return { solved: true, steps };

		const found = deduce({
			revealed,
			counts,
			known,
			width,
			height,
			size,
			mines: mineCount,
		});

		if (!found || found.length === 0) return { solved: false, steps };

		for (const move of found) {
			if (move.kind === MINE) {
				known[move.index] = MINE;
				// A solver that marks a safe cell as a mine would certify a board
				// it cannot actually play. Fail loudly; never ship past this.
				if (!mines[move.index]) throw new Error(`unsound: ${move.index} is not a mine`);
			} else {
				if (mines[move.index]) throw new Error(`unsound: ${move.index} is a mine`);
				known[move.index] = SAFE;
				revealFrom(move.index, { revealed, counts, width, height });
			}
		}

		steps += 1;
	}
}

/**
 * A board whose first click is `firstIndex`, guess-free if the budget allows.
 *
 * `budgetMs` is wall-clock rather than an attempt count because attempt cost
 * swings by two orders of magnitude between Beginner and Expert, and what the
 * player actually feels is the pause after their first click.
 */
export function generate({
	width,
	height,
	mines: mineCount,
	firstIndex,
	seed = (Math.random() * 2 ** 32) >>> 0,
	budgetMs = 1200,
	requireGuessFree = true,
}) {
	const size = width * height;

	// Keeping the opening neighbourhood clear costs up to 9 cells of placement
	// room; without the headroom there is no board to make.
	const openingCells = [firstIndex, ...neighbours(firstIndex, width, height)];
	const forbidden = new Set(
		mineCount <= size - openingCells.length ? openingCells : [firstIndex]
	);

	const rng = rngFrom(seed);
	const deadline = Date.now() + budgetMs;
	let attempts = 0;
	let fallback = null;

	for (;;) {
		attempts += 1;
		const mines = placeMines({ width, height, mines: mineCount, forbidden, rng });
		const counts = countsFor(mines, width, height);
		const board = { mines, counts, width, height, mineCount, seed, attempts };

		if (!requireGuessFree) return { ...board, guessFree: false, audited: false };

		if (audit({ ...board, firstIndex }).solved) {
			return { ...board, guessFree: true, audited: true };
		}

		fallback ??= board;

		// Out of time: ship the first candidate and be straight about it.
		if (Date.now() > deadline) {
			return { ...fallback, attempts, guessFree: false, audited: true };
		}
	}
}

export { MINE, SAFE, UNKNOWN };

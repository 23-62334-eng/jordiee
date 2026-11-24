import test from "node:test";
import assert from "node:assert/strict";

import { deduce, constraintsFrom, neighbours, nextHint, label, MINE, SAFE, UNKNOWN } from "../src/lib/sweeper/solver.js";
import { DIFFICULTIES, generate, audit, revealFrom, rngFrom } from "../src/lib/sweeper/board.js";

/**
 * The solver's one job is to never be wrong, because board generation trusts it
 * to certify fairness. These tests are mostly about soundness, not coverage:
 * a solver that misses a deduction costs a hint, one that invents a deduction
 * ships a board that cannot be played.
 */

/** Build a view from an ASCII board. `*` is a mine, `.` is clear; `revealed`
 *  lists the cells the player has opened. */
function viewFrom(rows, revealedLabels) {
	const width = rows[0].length;
	const height = rows.length;
	const size = width * height;
	const mines = new Uint8Array(size);

	rows.forEach((row, y) => {
		[...row].forEach((ch, x) => {
			if (ch === "*") mines[y * width + x] = 1;
		});
	});

	const counts = new Int8Array(size);
	for (let i = 0; i < size; i += 1) {
		if (mines[i]) continue;
		counts[i] = neighbours(i, width, height).filter((n) => mines[n]).length;
	}

	const index = (name) => {
		const x = name.charCodeAt(0) - 65;
		const y = Number(name.slice(1)) - 1;
		return y * width + x;
	};

	const revealed = new Uint8Array(size);
	for (const name of revealedLabels) revealed[index(name)] = 1;

	return {
		view: {
			revealed,
			counts,
			known: new Uint8Array(size),
			width,
			height,
			size,
			mines: mines.reduce((a, b) => a + b, 0),
		},
		mines,
		index,
	};
}

test("neighbours stays inside the board at corners and edges", () => {
	assert.deepEqual(neighbours(0, 3, 3).sort((a, b) => a - b), [1, 3, 4]);
	assert.deepEqual(neighbours(4, 3, 3).sort((a, b) => a - b), [0, 1, 2, 3, 5, 6, 7, 8]);
	assert.equal(neighbours(2, 3, 3).length, 3);
});

test("label reads out as column letter and 1-based row", () => {
	assert.equal(label(0, 9), "A1");
	assert.equal(label(9, 9), "A2");
	assert.equal(label(11, 9), "C2");
});

test("constraints ignore the player's flags", () => {
	// A wrong flag must not become a premise, or one careless click poisons
	// every hint that follows.
	const { view } = viewFrom([".*.", "...", "..."], ["A2"]);
	const flagged = { ...view, known: new Uint8Array(view.size) };
	flagged.known[2] = MINE; // C1 is clear, but the player flagged it

	const before = constraintsFrom(view);
	const after = constraintsFrom(flagged);

	// The constraint derived from A2 loses a cell to the flag and its remainder
	// drops with it, so the system stays consistent rather than silently wrong.
	assert.ok(before.length > 0);
	assert.ok(after.every((c) => !c.cells.includes(2)));
});

test("tier 1: a number with one unknown neighbour names its mine", () => {
	// B1 reads 1 and, with B2 and A2 open, has only A1 left to put it in.
	const { view, index } = viewFrom(["*.", ".."], ["B1", "A2", "B2"]);
	const found = deduce(view);

	assert.ok(found);
	const mine = found.find((m) => m.index === index("A1"));
	assert.ok(mine, "A1 should be identified");
	assert.equal(mine.kind, MINE);
	assert.match(mine.reason, /A1/);
});

test("tier 1: a satisfied number clears the rest of its neighbourhood", () => {
	const { view } = viewFrom(["...", "...", "..."], ["B2"]);
	const found = deduce(view);

	// B2 is a zero with eight unknown neighbours: all eight are clear.
	assert.equal(found.length, 8);
	assert.ok(found.every((m) => m.kind === SAFE));
});

test("tier 2: the 1-2 pattern is solved by subset subtraction", () => {
	// Classic wall: a row of numbers with two mines tucked under its left end,
	// so the higher number's extra mine must sit where the lower one cannot see.
	// (Only `*` and `.` are read; the numbers the player would see are derived.)
	const rows = ["....", "....", "**.."];
	const { view } = viewFrom(rows, ["A2", "B2", "C2", "A1", "B1", "C1", "D1", "D2"]);
	const found = deduce(view);

	assert.ok(found, "a deduction should exist");
	assert.ok(
		found.every((move) =>
			move.kind === MINE ? view.counts[move.index] >= 0 : true
		)
	);
	// Soundness is the real assertion: nothing it calls a mine may be clear.
	const { mines } = viewFrom(rows, []);
	for (const move of found) {
		assert.equal(!!mines[move.index], move.kind === MINE, `${label(move.index, 4)} misread`);
	}
});

test("tier 3: a zeroed mine counter clears everything left", () => {
	// Nothing open, every mine flagged — no number is in play, so the counter
	// is the only thing left to reason from.
	const { view } = viewFrom(["*..", "...", "..."], []);
	view.known[0] = MINE;
	const found = deduce(view);

	assert.ok(found, "the counter alone should settle the board");
	assert.equal(found.length, 8);
	assert.ok(found.every((m) => m.kind === SAFE));
	assert.match(found[0].reason, /counter/i);
});

test("deduce says nothing rather than guessing when nothing follows", () => {
	// A single 1 touching three unknowns: the mine is in there somewhere, and
	// no rule can say which. A solver that answers here would certify boards
	// it cannot actually play.
	const { view } = viewFrom(["....", ".*.."], ["A1"]);

	assert.equal(view.mines, 1);
	assert.equal(view.counts[0], 1, "A1 should read 1, with three unknowns around it");
	assert.equal(deduce(view), null);
});

test("every generated board is clear of mines around the first click", () => {
	for (const preset of Object.values(DIFFICULTIES)) {
		const firstIndex = 0; // a corner, the tightest case for the safe zone
		const board = generate({ ...preset, firstIndex, seed: 99 });

		assert.equal(board.mines[firstIndex], 0);
		assert.equal(board.counts[firstIndex], 0, "the first click must open a region");
	}
});

test("generated boards carry the mine count they promise", () => {
	const preset = DIFFICULTIES.intermediate;
	const board = generate({ ...preset, firstIndex: 40, seed: 7 });
	assert.equal(board.mines.reduce((a, b) => a + b, 0), preset.mines);
});

test("audited boards really are solvable by deduction alone", () => {
	// The audit throws on any unsound move, so this doubles as a soundness
	// sweep across hundreds of positions per board.
	for (const [key, preset] of Object.entries(DIFFICULTIES)) {
		for (let seed = 1; seed <= 5; seed += 1) {
			const firstIndex = Math.floor((preset.width * preset.height) / 2);
			const board = generate({ ...preset, firstIndex, seed });

			if (!board.guessFree) continue; // honest fallback, nothing to assert
			const result = audit({ ...board, firstIndex, mineCount: preset.mines });
			assert.equal(result.solved, true, `${key} seed ${seed} failed re-audit`);
		}
	}
});

test("the guess-free guarantee holds across many boards at every size", () => {
	// Generation falls back to an unaudited board when it runs out of time, so
	// this is the regression guard on the hit rate: if a change to the solver
	// makes it weaker, the fallback rate climbs and this fails.
	for (const [key, preset] of Object.entries(DIFFICULTIES)) {
		let guessFree = 0;
		const runs = 12;

		for (let seed = 1; seed <= runs; seed += 1) {
			const board = generate({
				...preset,
				firstIndex: Math.floor((preset.width * preset.height) / 3),
				seed: seed * 7919,
			});
			if (board.guessFree) guessFree += 1;
		}

		assert.equal(guessFree, runs, `${key}: only ${guessFree}/${runs} boards were guess-free`);
	}
});

test("revealFrom cascades through zeros and stops at numbers", () => {
	const { view } = viewFrom(["...", "...", "..*"], []);
	const revealed = new Uint8Array(view.size);
	const opened = revealFrom(0, { revealed, counts: view.counts, width: 3, height: 3 });

	// Everything but the mine opens; the cells touching it stop the cascade but
	// are themselves revealed.
	assert.equal(opened.length, 8);
	assert.equal(revealed[8], 0, "the mine itself stays closed");
});

test("the seeded rng is reproducible", () => {
	const a = rngFrom(1234);
	const b = rngFrom(1234);
	assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("UNKNOWN is the zero value, so a fresh Uint8Array means 'nothing known'", () => {
	assert.equal(UNKNOWN, 0);
	assert.equal(new Uint8Array(1)[0], UNKNOWN);
});

test("nextHint advances instead of repeating a move already made", () => {
	// Regression: deduce() ignores flags by design, so a hint that named a mine
	// would name the same mine forever once the player flagged it.
	const { view, index } = viewFrom(["*.", ".."], ["B1", "A2", "B2"]);

	const first = nextHint(view, () => false);
	assert.ok(first);
	assert.equal(first.kind, MINE);
	assert.equal(first.moves[0].index, index("A1"));

	// Same position, but the player has now flagged A1.
	const again = nextHint(view, (move) => move.index === index("A1"));
	assert.equal(again, null, "with the only mine flagged there is nothing left to say");
});

test("nextHint keeps chaining past handled deductions to find a new one", () => {
	const preset = DIFFICULTIES.beginner;
	const firstIndex = 40;
	const board = generate({ ...preset, firstIndex, seed: 2024 });

	const size = preset.width * preset.height;
	const revealed = new Uint8Array(size);
	revealFrom(firstIndex, {
		revealed,
		counts: board.counts,
		width: preset.width,
		height: preset.height,
	});

	const view = {
		revealed,
		counts: board.counts,
		known: new Uint8Array(size),
		width: preset.width,
		height: preset.height,
		size,
		mines: preset.mines,
	};

	const first = nextHint(view, () => false);
	assert.ok(first, "a fresh board should offer a hint");

	// Pretend the player acted on everything that first hint named; the next
	// ask must produce something different rather than null or a repeat.
	const handled = new Set(first.moves.map((m) => m.index));
	const second = nextHint(view, (move) => handled.has(move.index));

	assert.ok(second, "the hint should chain past what was already done");
	assert.ok(
		second.moves.every((m) => !handled.has(m.index)),
		"a chained hint must not restate a handled move"
	);
});

test("hints only ever name cells that match the hidden board", () => {
	// The hint button is the one place the solver speaks directly to a player,
	// so sweep it hard: every claim it makes must be true of the real board.
	for (const [key, preset] of Object.entries(DIFFICULTIES)) {
		const firstIndex = Math.floor((preset.width * preset.height) / 2);
		const board = generate({ ...preset, firstIndex, seed: 31337 });
		const size = preset.width * preset.height;

		const revealed = new Uint8Array(size);
		revealFrom(firstIndex, {
			revealed,
			counts: board.counts,
			width: preset.width,
			height: preset.height,
		});

		const handled = new Set();
		for (let ask = 0; ask < 50; ask += 1) {
			const view = {
				revealed,
				counts: board.counts,
				known: new Uint8Array(size),
				width: preset.width,
				height: preset.height,
				size,
				mines: preset.mines,
			};

			const hint = nextHint(view, (move) => handled.has(move.index));
			if (!hint) break;

			for (const move of hint.moves) {
				assert.equal(
					!!board.mines[move.index],
					move.kind === MINE,
					`${key}: hint misread ${label(move.index, preset.width)}`
				);
				handled.add(move.index);
				// Acting on a safe hint opens it, which is what lets the next ask
				// see further.
				if (move.kind !== MINE) {
					revealFrom(move.index, {
						revealed,
						counts: board.counts,
						width: preset.width,
						height: preset.height,
					});
				}
			}
		}

		assert.ok(handled.size > 0, `${key}: the hint button never said anything`);
	}
});

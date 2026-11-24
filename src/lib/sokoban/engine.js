/**
 * Sokoban rules, as pure data transforms.
 *
 * No React, no DOM, no mutation of anything a caller handed in. Every move
 * returns a NEW state, which is what makes undo a list rather than a pile of
 * inverse operations — push the old state, pop to go back. A command-pattern
 * undo with hand-written inverses is the usual approach and the usual source
 * of bugs; these states are small enough (two typed arrays and an index) that
 * keeping them whole is cheaper than being clever.
 *
 * It is also what lets ./solver.js explore thousands of positions per
 * millisecond without a special "simulation" copy of the rules that can drift
 * out of step with the ones the player is playing.
 */

/** The standard Sokoban text format, so levels stay readable as source. */
export const GLYPH = {
	WALL: "#",
	FLOOR: " ",
	BOX: "$",
	GOAL: ".",
	BOX_ON_GOAL: "*",
	PLAYER: "@",
	PLAYER_ON_GOAL: "+",
};

export const DIRECTIONS = {
	up: { dx: 0, dy: -1 },
	down: { dx: 0, dy: 1 },
	left: { dx: -1, dy: 0 },
	right: { dx: 1, dy: 0 },
};

/**
 * Parse a level into the flat arrays everything downstream uses.
 *
 * Rows are padded to the widest line rather than required to be rectangular:
 * trailing spaces are invisible in source and get trimmed by editors and
 * formatters, so demanding them would make the levels quietly corruptible.
 */
export function parse(text) {
	const rows = text.replace(/\n+$/, "").split("\n");
	const width = Math.max(...rows.map((row) => row.length));
	const height = rows.length;
	const size = width * height;

	const walls = new Uint8Array(size);
	const goals = new Uint8Array(size);
	const boxes = new Uint8Array(size);
	let player = -1;

	rows.forEach((row, y) => {
		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;
			const ch = row[x] ?? GLYPH.FLOOR;

			if (ch === GLYPH.WALL) walls[index] = 1;
			if (ch === GLYPH.GOAL || ch === GLYPH.BOX_ON_GOAL || ch === GLYPH.PLAYER_ON_GOAL) {
				goals[index] = 1;
			}
			if (ch === GLYPH.BOX || ch === GLYPH.BOX_ON_GOAL) boxes[index] = 1;
			if (ch === GLYPH.PLAYER || ch === GLYPH.PLAYER_ON_GOAL) player = index;
		}
	});

	if (player < 0) throw new Error("level has no player");

	const boxCount = boxes.reduce((a, b) => a + b, 0);
	const goalCount = goals.reduce((a, b) => a + b, 0);
	if (boxCount !== goalCount) {
		throw new Error(`level has ${boxCount} boxes but ${goalCount} goals`);
	}

	return { width, height, size, walls, goals, boxes, player, moves: 0, pushes: 0 };
}

/** Identity of a position for the solver's visited set: who is where. */
export function key(state) {
	// The player index first, then box positions in index order, so two states
	// that differ only in the order boxes happened to be pushed collapse to one.
	let out = `${state.player}`;
	for (let i = 0; i < state.size; i += 1) if (state.boxes[i]) out += `,${i}`;
	return out;
}

export function isWon(state) {
	for (let i = 0; i < state.size; i += 1) {
		if (state.boxes[i] && !state.goals[i]) return false;
	}
	return true;
}

/**
 * Attempt a step. Returns the new state, or null when the move is illegal.
 *
 * Null rather than throwing, and rather than returning the state unchanged:
 * the caller needs to tell "nothing happened" from "something happened" to
 * decide whether to record an undo entry or play a sound, and an unchanged
 * state makes that an equality check on two typed arrays.
 */
export function move(state, direction) {
	const step = DIRECTIONS[direction];
	if (!step) return null;

	const { width, height } = state;
	const x = state.player % width;
	const y = Math.floor(state.player / width);

	const nx = x + step.dx;
	const ny = y + step.dy;
	if (nx < 0 || ny < 0 || nx >= width || ny >= height) return null;

	const target = ny * width + nx;
	if (state.walls[target]) return null;

	// Walking into empty floor.
	if (!state.boxes[target]) {
		return { ...state, player: target, moves: state.moves + 1 };
	}

	// Pushing: the square beyond the box has to be free of both walls and
	// boxes — Sokoban allows exactly one box per push, never a chain.
	const bx = nx + step.dx;
	const by = ny + step.dy;
	if (bx < 0 || by < 0 || bx >= width || by >= height) return null;

	const beyond = by * width + bx;
	if (state.walls[beyond] || state.boxes[beyond]) return null;

	const boxes = Uint8Array.from(state.boxes);
	boxes[target] = 0;
	boxes[beyond] = 1;

	return {
		...state,
		boxes,
		player: target,
		moves: state.moves + 1,
		pushes: state.pushes + 1,
	};
}

/**
 * Is this box stuck in a corner it can never leave?
 *
 * The cheap, certain half of deadlock detection: a box against two
 * perpendicular walls can never move again, because a push needs free floor
 * directly opposite the pusher. A box on a goal is never reported — it has
 * arrived, and being immovable there is the point.
 *
 * This deliberately does NOT try to catch every dead position (boxes locked
 * against each other, boxes stranded along a wall with no goal on it). Those
 * need search, and ./solver.js answers that question properly. This exists so
 * the common beginner mistake gets an instant, cheap answer.
 */
export function isStuck(state, index) {
	if (!state.boxes[index] || state.goals[index]) return false;

	const { width } = state;
	const x = index % width;
	const y = Math.floor(index / width);
	const wall = (ax, ay) => {
		if (ax < 0 || ay < 0 || ax >= state.width || ay >= state.height) return true;
		return state.walls[ay * width + ax] === 1;
	};

	const vertical = wall(x, y - 1) || wall(x, y + 1);
	const horizontal = wall(x - 1, y) || wall(x + 1, y);

	return vertical && horizontal;
}

/** Every box currently in an unrecoverable corner. */
export function stuckBoxes(state) {
	const out = [];
	for (let i = 0; i < state.size; i += 1) if (isStuck(state, i)) out.push(i);
	return out;
}

/**
 * A breadth-first Sokoban solver.
 *
 * It exists for the same reason the Minesweeper one does: so the levels can be
 * *audited* rather than vouched for. A hand-drawn Sokoban level that looks fine
 * and is quietly impossible is a very easy thing to ship, and a player has no
 * way to tell "I am stuck" from "this cannot be done". Every level in
 * ./levels.js is solved by this before it ships, and the test suite re-solves
 * all of them.
 *
 * At play time it answers the question the player actually has:
 *
 *   "Am I stuck, or am I just not seeing it?"
 *
 * Running the solver from the CURRENT position answers that exactly. No
 * solution means the position is genuinely dead and the only way on is undo —
 * which is a far kinder thing to be told than to be left pushing boxes around
 * a lost board.
 *
 * ── WHY BREADTH-FIRST AND NOT A* ───────────────────────────────────────────
 *
 * A* with a matching-distance heuristic is the right answer for large levels,
 * and the wrong answer here. These levels are small by design (the biggest is
 * 8×8 with four boxes), where BFS settles in a few thousand states — and BFS
 * is *move-optimal* by construction, so the solution length it reports is a
 * real lower bound the player can be scored against. An A* with an inadmissible
 * heuristic would quietly report a number that is not the minimum, which is
 * worse than useless for a par score.
 */

import { DIRECTIONS, isWon, key, move, stuckBoxes } from "./engine.js";

const ORDER = ["up", "down", "left", "right"];

/** Beyond this the search is abandoned rather than allowed to hang the tab. */
const DEFAULT_MAX_STATES = 300_000;

/**
 * Shortest sequence of moves to a win, or null if there is none.
 *
 * `states` comes back either way so callers can tell "proved impossible" from
 * "gave up looking" — a distinction worth keeping, because telling a player
 * their position is dead when the search merely timed out would be a lie.
 */
export function solve(start, { maxStates = DEFAULT_MAX_STATES } = {}) {
	if (isWon(start)) return { solved: true, moves: [], states: 0, exhausted: true };

	const seen = new Set([key(start)]);
	// Parent links rather than carrying a path per node: a queue of states each
	// holding its own growing array is what turns a tractable search into an
	// allocation storm.
	const queue = [{ state: start, from: -1, step: null }];
	let head = 0;

	while (head < queue.length) {
		if (seen.size > maxStates) {
			return { solved: false, moves: null, states: seen.size, exhausted: false };
		}

		const node = queue[head];
		const index = head;
		head += 1;

		for (const direction of ORDER) {
			const next = move(node.state, direction);
			if (!next) continue;

			const id = key(next);
			if (seen.has(id)) continue;

			// Corner-locked boxes can never be recovered, so the whole subtree
			// below them is dead. Pruning here is what keeps the state count in
			// the thousands instead of the millions.
			if (stuckBoxes(next).length > 0) {
				seen.add(id);
				continue;
			}

			seen.add(id);
			const child = { state: next, from: index, step: direction };

			if (isWon(next)) {
				const moves = [];
				let walk = child;
				while (walk.from >= 0) {
					moves.push(walk.step);
					walk = queue[walk.from];
				}
				moves.reverse();
				return { solved: true, moves, states: seen.size, exhausted: true };
			}

			queue.push(child);
		}
	}

	// The queue drained: every reachable position was examined and none wins.
	return { solved: false, moves: null, states: seen.size, exhausted: true };
}

/**
 * The next move on a shortest path, with the counts behind it.
 *
 * Returns `dead: true` only when the search finished and found nothing — never
 * when it ran out of budget.
 */
export function hint(state, options) {
	const result = solve(state, options);

	if (result.solved) {
		return {
			dead: false,
			move: result.moves[0] ?? null,
			remaining: result.moves.length,
		};
	}

	return { dead: result.exhausted, move: null, remaining: null };
}

/** Moves and pushes along a solution, for scoring a level's par. */
export function measure(start, moves) {
	let state = start;
	for (const direction of moves) {
		const next = move(state, direction);
		if (!next) throw new Error(`illegal move ${direction} in solution`);
		state = next;
	}
	return { moves: state.moves, pushes: state.pushes, won: isWon(state) };
}

export { DIRECTIONS };

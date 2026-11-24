/**
 * A sound, explaining Minesweeper solver.
 *
 * Two jobs, one body of logic:
 *
 *   1. VERIFY boards at generation time, by playing them. If this solver can
 *      clear a board from its opening click using deduction alone, the board is
 *      guess-free and fair to ship. See ./board.js.
 *
 *   2. EXPLAIN the next move at play time, from the player's view only. The
 *      hint button needs a reason, not just an answer — "these two must be
 *      mines because of the 3 at C4" teaches the game; a highlighted square
 *      teaches nothing.
 *
 * Both call deduce(); the only difference is who supplies the view.
 *
 * ── SOUNDNESS ──────────────────────────────────────────────────────────────
 *
 * Every rule here states a cell's contents with certainty or says nothing. A
 * solver that guesses well would be worse than useless for job 1: it would
 * certify boards as fair that are not. So each tier below is a logical
 * implication of the constraints, and the enumeration tier only reports cells
 * that take the same value in EVERY consistent layout.
 *
 * Dropping a constraint can only enlarge the solution set, never shrink it,
 * which is why the enumeration tier is still sound when it omits the global
 * mine count for tractability: a cell that is a mine in every layout of a
 * larger set is a mine in every layout of the subset too.
 */

/** Cells that may still hold a mine, from the point of view of a given view. */
export const UNKNOWN = 0;
export const SAFE = 1;
export const MINE = 2;

/** Highest number of frontier cells we will brute-force. 2^22 ≈ 4.2M worst
 *  case, but pruning cuts that to milliseconds in practice; above this we
 *  decline rather than hang the main thread. */
const ENUMERATION_LIMIT = 22;

/** Board coordinates as players say them out loud: column letter, row number. */
export function label(index, width) {
	const x = index % width;
	const y = Math.floor(index / width);
	return `${String.fromCharCode(65 + x)}${y + 1}`;
}

/** Index list of the up-to-eight cells touching `index`. */
export function neighbours(index, width, height) {
	const x = index % width;
	const y = Math.floor(index / width);
	const out = [];

	for (let dy = -1; dy <= 1; dy += 1) {
		for (let dx = -1; dx <= 1; dx += 1) {
			if (dx === 0 && dy === 0) continue;
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
			out.push(ny * width + nx);
		}
	}

	return out;
}

/**
 * Turn a view into the constraint system the rules operate on.
 *
 * A constraint is "exactly `mines` of these `cells` hold mines", read off a
 * single revealed number: its value, less the neighbours already known to be
 * mines, over the neighbours still unknown.
 *
 * Note what is NOT used: the player's flags. A flag is an assertion, and
 * players are wrong sometimes — believing them would let a careless flag
 * produce a confidently wrong hint. Flagged cells are treated as unknown and
 * re-derived from scratch, so the worst a bad flag can do is cost the player a
 * hint that tells them something they thought they already knew.
 */
export function constraintsFrom({ revealed, counts, known, width, height, size }) {
	const constraints = [];

	for (let i = 0; i < size; i += 1) {
		if (!revealed[i]) continue;

		const cells = [];
		let remaining = counts[i];

		for (const n of neighbours(i, width, height)) {
			if (revealed[n]) continue;
			if (known[n] === MINE) remaining -= 1;
			else if (known[n] === UNKNOWN) cells.push(n);
		}

		// A number with nothing left to say is not a constraint, it is noise —
		// and an empty cell list with a non-zero remainder would be an
		// inconsistency we would rather surface as a bug than silently carry.
		if (cells.length > 0) constraints.push({ cells, mines: remaining, source: i });
	}

	return constraints;
}

/** True when `a.cells` is a subset of `b.cells`. Both are small (≤8), so the
 *  naive scan beats building sets. */
function isSubset(a, b) {
	if (a.cells.length > b.cells.length) return false;
	return a.cells.every((cell) => b.cells.includes(cell));
}

/**
 * TIER 1 — a single number settles its own neighbourhood.
 *
 * The first thing any player learns: a 1 touching exactly one unknown square
 * has found its mine, and a number whose mines are all accounted for has
 * nothing but safe squares left.
 */
function deduceDirect(constraints, width) {
	for (const c of constraints) {
		if (c.mines === 0) {
			return c.cells.map((index) => ({
				index,
				kind: SAFE,
				basis: [c.source],
				reason: `${label(c.source, width)} already touches all the mines its number allows, so the squares left around it are clear.`,
			}));
		}

		if (c.mines === c.cells.length) {
			return c.cells.map((index) => ({
				index,
				kind: MINE,
				basis: [c.source],
				reason:
					c.cells.length === 1
						? `${label(c.source, width)} has one mine left and only ${label(index, width)} can hold it.`
						: `${label(c.source, width)} has ${c.mines} mines left and exactly ${c.cells.length} squares to put them in, so all of them are mines.`,
			}));
		}
	}

	return null;
}

/**
 * TIER 2 — one number's neighbourhood sits inside another's.
 *
 * Where A ⊆ B, the cells in B but not A must hold exactly (B.mines − A.mines)
 * mines. When that difference is 0 or fills the leftover exactly, the leftover
 * is settled. This is the "1-2 pattern" players recognise by shape, stated
 * generally.
 */
function deduceSubset(constraints, width) {
	for (const a of constraints) {
		for (const b of constraints) {
			if (a === b || !isSubset(a, b)) continue;

			const rest = b.cells.filter((cell) => !a.cells.includes(cell));
			if (rest.length === 0) continue;

			const mines = b.mines - a.mines;
			const basis = [a.source, b.source];

			if (mines === 0) {
				return rest.map((index) => ({
					index,
					kind: SAFE,
					basis,
					reason: `Every square ${label(a.source, width)} can use is also a neighbour of ${label(b.source, width)}, and both need the same number of mines — so the squares only ${label(b.source, width)} touches are clear.`,
				}));
			}

			if (mines === rest.length) {
				return rest.map((index) => ({
					index,
					kind: MINE,
					basis,
					reason: `${label(b.source, width)} needs ${mines} more mine${mines === 1 ? "" : "s"} than ${label(a.source, width)}, and only ${rest.length} square${rest.length === 1 ? "" : "s"} outside ${label(a.source, width)}'s reach — so ${rest.length === 1 ? "it is a mine" : "they are all mines"}.`,
				}));
			}
		}
	}

	return null;
}

/**
 * TIER 3 — the mine counter itself is a constraint.
 *
 * Players use this at the end of a board without thinking of it as a rule: if
 * the counter reads 0, everything left is safe; if it equals the number of
 * squares left, everything left is a mine.
 */
function deduceGlobal(unknownCells, minesRemaining) {
	if (unknownCells.length === 0) return null;

	if (minesRemaining === 0) {
		return unknownCells.map((index) => ({
			index,
			kind: SAFE,
			basis: [],
			reason: `The counter is at zero — every mine is flagged, so all ${unknownCells.length} remaining square${unknownCells.length === 1 ? " is" : "s are"} clear.`,
		}));
	}

	if (minesRemaining === unknownCells.length) {
		return unknownCells.map((index) => ({
			index,
			kind: MINE,
			basis: [],
			reason: `${minesRemaining} mine${minesRemaining === 1 ? "" : "s"} left and ${unknownCells.length} square${unknownCells.length === 1 ? "" : "s"} to hide in — they are all mines.`,
		}));
	}

	return null;
}

/** Split constraints into groups that share no cells; each can be enumerated
 *  on its own, which is what keeps brute force affordable. */
function components(constraints) {
	const parent = constraints.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const union = (i, j) => {
		const a = find(i);
		const b = find(j);
		if (a !== b) parent[a] = b;
	};

	const owner = new Map();
	constraints.forEach((c, i) => {
		for (const cell of c.cells) {
			if (owner.has(cell)) union(i, owner.get(cell));
			else owner.set(cell, i);
		}
	});

	const groups = new Map();
	constraints.forEach((c, i) => {
		const root = find(i);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root).push(c);
	});

	return [...groups.values()];
}

/**
 * TIER 4 — exhaust the possibilities.
 *
 * When no local pattern applies, enumerate every mine layout consistent with
 * the group's constraints. A cell that comes out a mine in all of them is a
 * mine; one that comes out clear in all of them is clear. This is the tier that
 * catches the configurations human players solve by staring, and the reason
 * generated boards can be certified guess-free rather than merely "probably
 * fine".
 */
function deduceEnumeration(constraints, width) {
	for (const group of components(constraints)) {
		const cells = [...new Set(group.flatMap((c) => c.cells))];
		if (cells.length > ENUMERATION_LIMIT) continue;

		const position = new Map(cells.map((cell, i) => [cell, i]));
		// Per cell: which constraints mention it, so a partial assignment can be
		// checked as soon as a constraint's last cell is decided.
		const touching = cells.map(() => []);
		group.forEach((c, ci) => {
			for (const cell of c.cells) touching[position.get(cell)].push(ci);
		});

		const assigned = new Array(group.length).fill(0);
		const decided = new Array(group.length).fill(0);
		const assignment = new Uint8Array(cells.length);

		// Tally of how each cell came out, across all consistent layouts.
		let solutions = 0;
		const mineCount = new Array(cells.length).fill(0);

		const search = (depth) => {
			if (depth === cells.length) {
				solutions += 1;
				for (let i = 0; i < cells.length; i += 1) {
					if (assignment[i]) mineCount[i] += 1;
				}
				return;
			}

			for (const value of [0, 1]) {
				assignment[depth] = value;
				let ok = true;

				for (const ci of touching[depth]) {
					assigned[ci] += value;
					decided[ci] += 1;

					// Over budget, or short with no cells left to make it up.
					if (
						assigned[ci] > group[ci].mines ||
						group[ci].mines - assigned[ci] > group[ci].cells.length - decided[ci]
					) {
						ok = false;
					}
				}

				if (ok) search(depth + 1);

				for (const ci of touching[depth]) {
					assigned[ci] -= value;
					decided[ci] -= 1;
				}
			}
		};

		search(0);

		// No consistent layout means the view itself is contradictory — a bug
		// upstream, not a deduction. Say nothing rather than report nonsense.
		if (solutions === 0) continue;

		const found = [];
		for (let i = 0; i < cells.length; i += 1) {
			if (mineCount[i] === solutions) found.push({ index: cells[i], kind: MINE });
			else if (mineCount[i] === 0) found.push({ index: cells[i], kind: SAFE });
		}

		if (found.length === 0) continue;

		const basis = [...new Set(group.map((c) => c.source))];
		return found.map((hit) => ({
			...hit,
			basis,
			reason: `No single number settles this corner. Working through every mine layout these ${basis.length} numbers allow, ${label(hit.index, width)} comes out ${hit.kind === MINE ? "a mine" : "clear"} in all ${solutions} of them.`,
		}));
	}

	return null;
}

/**
 * The next certain move, or null when the view genuinely requires a guess.
 *
 * Tiers run cheapest-first, which doubles as "most human-explainable first":
 * when a board can be read with a simple rule, the hint says the simple thing
 * rather than showing off with exhaustive search.
 */
export function deduce(view) {
	const constraints = constraintsFrom(view);
	const { known, revealed, size, mines } = view;

	const unknownCells = [];
	let flagged = 0;
	for (let i = 0; i < size; i += 1) {
		if (known[i] === MINE) flagged += 1;
		else if (!revealed[i] && known[i] === UNKNOWN) unknownCells.push(i);
	}

	return (
		deduceDirect(constraints, view.width) ??
		deduceSubset(constraints, view.width) ??
		deduceGlobal(unknownCells, mines - flagged) ??
		deduceEnumeration(constraints, view.width)
	);
}

/**
 * The next deduction the player has not already acted on.
 *
 * deduce() is deliberately blind to the player's flags, which is right for
 * soundness and wrong for a hint button: having flagged the mine a hint just
 * named, the player asks again and is told about the same mine, forever. The
 * flag is not a premise the solver may trust, so it cannot simply be fed back
 * in.
 *
 * The way out is for the solver to trust its OWN conclusions instead. This
 * chains deduce() against a `known` map it fills in itself — never from the
 * board, never from the player — and reports the first result the player has
 * not already handled. Reasoning stays sound; only the reporting advances.
 *
 * `acted` answers "has the player already done this?": flagged, for a mine;
 * revealed, for a safe square.
 */
export function nextHint(view, acted) {
	const known = Uint8Array.from(view.known);

	// One pass per deduction; a board cannot yield more than one per cell.
	for (let guard = 0; guard <= view.size; guard += 1) {
		const found = deduce({ ...view, known });
		if (!found || found.length === 0) return null;

		const fresh = found.filter((move) => !acted(move));
		if (fresh.length > 0) {
			return { moves: fresh.filter((m) => m.kind === fresh[0].kind), reason: fresh[0].reason, basis: fresh[0].basis, kind: fresh[0].kind };
		}

		// Everything this step found is already on the board. Absorb it and look
		// further rather than repeating ourselves.
		let advanced = false;
		for (const move of found) {
			if (known[move.index] === UNKNOWN) {
				known[move.index] = move.kind;
				advanced = true;
			}
		}

		if (!advanced) return null;
	}

	return null;
}

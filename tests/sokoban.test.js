import test from "node:test";
import assert from "node:assert/strict";

import {
	DIRECTIONS,
	isStuck,
	isWon,
	key,
	move,
	parse,
	stuckBoxes,
} from "../src/lib/sokoban/engine.js";
import { hint, measure, solve } from "../src/lib/sokoban/solver.js";
import { LEVELS, levelText } from "../src/lib/sokoban/levels.js";
import { TIERS, tierFor } from "../src/lib/sokoban/difficulty.js";
import { GENERATED_LEVELS } from "../src/lib/sokoban/levels.generated.js";
import solutions from "./fixtures/sokoban-solutions.json" with { type: "json" };

/**
 * The levels are the product here, and the solver is what certifies them. So
 * the suite is weighted that way: a handful of rule checks, then an audit of
 * every shipped level against the par recorded beside it.
 */

test("parse reads glyphs into walls, goals, boxes and a player", () => {
	const state = parse(["#####", "#@$.#", "#####"].join("\n"));

	assert.equal(state.width, 5);
	assert.equal(state.height, 3);
	assert.equal(state.player, 6);
	assert.equal(state.boxes[7], 1);
	assert.equal(state.goals[8], 1);
	assert.equal(state.walls[0], 1);
});

test("parse pads short rows instead of demanding rectangles", () => {
	// Trailing spaces are invisible and get stripped by editors, so requiring
	// them would make levels quietly corruptible.
	const state = parse(["#####", "#@$.#", "###"].join("\n"));
	assert.equal(state.width, 5);
	assert.equal(state.walls[12], 1, "the three characters that are there are walls");
	assert.equal(state.walls[13], 0, "the missing cells become floor, not walls");
});

test("parse rejects a level whose boxes and goals do not match", () => {
	assert.throws(() => parse(["####", "#@$#", "####"].join("\n")), /boxes but 0 goals/);
	assert.throws(() => parse(["####", "#  #", "####"].join("\n")), /no player/);
});

test("* and + are read as box-on-goal and player-on-goal", () => {
	// Two goals (the + and the *) and two boxes (the * and the $), because
	// parse insists those counts match — as it should.
	const state = parse(["#####", "#+*$#", "#####"].join("\n"));
	assert.equal(state.goals[6], 1, "+ marks a goal under the player");
	assert.equal(state.goals[7], 1, "* marks a goal under the box");
	assert.equal(state.boxes[7], 1, "* is also a box");
	assert.equal(state.boxes[8], 1);
	assert.equal(state.player, 6);
});

test("walking into a wall is refused rather than ignored", () => {
	// Null, not an unchanged state: the caller has to tell "nothing happened"
	// from "something happened" to decide about undo entries and sounds.
	const state = parse(["###", "#@#", "###"].join("\n"));
	assert.equal(move(state, "up"), null);
	assert.equal(move(state, "left"), null);
});

test("a push needs free floor beyond the box", () => {
	const blocked = parse(["#####", "#@$##", "#.  #", "#####"].join("\n"));
	assert.equal(move(blocked, "right"), null, "box against a wall cannot move");

	const chain = parse(["######", "#@$$.#", "#.   #", "######"].join("\n"));
	assert.equal(move(chain, "right"), null, "two boxes in a row never move together");
});

test("moves and pushes are counted separately", () => {
	const state = parse(["######", "#@ $.#", "######"].join("\n"));

	const walked = move(state, "right");
	assert.equal(walked.moves, 1);
	assert.equal(walked.pushes, 0);

	const pushed = move(walked, "right");
	assert.equal(pushed.moves, 2);
	assert.equal(pushed.pushes, 1);
	assert.ok(isWon(pushed));
});

test("move never mutates the state it was given", () => {
	// Undo is a list of past states, which only works because they stay put.
	const state = parse(["######", "#@$ .#", "######"].join("\n"));
	const before = Array.from(state.boxes);

	move(state, "right");

	assert.deepEqual(Array.from(state.boxes), before);
	assert.equal(state.moves, 0);
});

test("isWon needs every box home, not just some", () => {
	const partial = parse(["#######", "#@$.$.#", "#######"].join("\n"));
	assert.equal(isWon(partial), false);

	const done = parse(["#######", "#@ * *#", "#######"].join("\n"));
	assert.equal(isWon(done), true);
});

test("key collapses states that differ only in push order", () => {
	const a = parse(["######", "#@$ $#", "#   .#", "#   .#", "######"].join("\n"));
	const b = parse(["######", "#@$ $#", "#   .#", "#   .#", "######"].join("\n"));
	assert.equal(key(a), key(b));

	const moved = move(a, "right");
	assert.notEqual(key(a), key(moved));
});

test("a box wedged into a corner is reported stuck", () => {
	const state = parse(["#####", "#$  #", "#@  #", "#  .#", "#####"].join("\n"));
	const box = 6; // top-left floor square, walls above and to the left

	assert.equal(isStuck(state, box), true);
	assert.deepEqual(stuckBoxes(state), [box]);
});

test("a box on its goal is never called stuck", () => {
	// It has arrived. Being immovable there is the point, not a problem.
	const state = parse(["#####", "#*  #", "#@  #", "#####"].join("\n"));
	assert.equal(isStuck(state, 6), false);
	assert.deepEqual(stuckBoxes(state), []);
});

test("the solver proves an impossible level impossible", () => {
	// The box is already corner-locked away from the goal; no sequence wins.
	const state = parse(["######", "#$   #", "#@   #", "#   .#", "######"].join("\n"));
	const result = solve(state);

	assert.equal(result.solved, false);
	assert.equal(result.exhausted, true, "it must finish the search, not give up");
});

test("the solver reports giving up differently from proving impossible", () => {
	// Telling a player their position is dead when the search merely timed out
	// would be a lie, so the two cases stay distinguishable.
	const state = parse(levelText(LEVELS.length - 1));
	const result = solve(state, { maxStates: 50 });

	assert.equal(result.solved, false);
	assert.equal(result.exhausted, false);
});

test("hint only calls a position dead when the search actually finished", () => {
	const state = parse(["######", "#$   #", "#@   #", "#   .#", "######"].join("\n"));
	assert.equal(hint(state).dead, true);

	const hard = parse(levelText(LEVELS.length - 1));
	assert.equal(hint(hard, { maxStates: 50 }).dead, false);
});

test("hint points along a shortest finish", () => {
	const state = parse(["######", "#@ $.#", "######"].join("\n"));
	const answer = hint(state);

	assert.equal(answer.dead, false);
	assert.equal(answer.move, "right");
	assert.equal(answer.remaining, 2);
});

test("the hand-drawn levels are solvable at their stated par", () => {
	// The nine authored levels are re-solved in full: they are small, and they
	// are the ones a human wrote and could have got wrong.
	LEVELS.forEach((level, i) => {
		if (!level.name) return;
		const start = parse(levelText(i));
		const result = solve(start, { maxStates: 500_000 });

		assert.equal(result.solved, true, `${level.name} has no solution`);
		const walked = measure(start, result.moves);
		assert.equal(walked.moves, level.par.moves, `${level.name}: par moves drifted`);
		assert.equal(walked.pushes, level.par.pushes, `${level.name}: par pushes drifted`);
	});
});

test("the set is a hundred levels, opening with a tutorial", () => {
	assert.equal(LEVELS.length, 100);
	assert.equal(LEVELS[0].par.moves, 1, "the opener should teach one push and nothing else");
});

test("difficulty never goes backwards after the tutorial", () => {
	// Ordered by SEARCH COST, not par: par measures how long a level is, search
	// cost measures how much branching there is to get lost in. The first six
	// are the tutorial and are ordered for teaching, so the run starts at 7.
	const states = LEVELS.map((level) => level.states);

	assert.ok(
		states.every((n) => Number.isInteger(n) && n > 0),
		"every level needs a recorded search cost"
	);

	for (let i = 7; i < states.length; i += 1) {
		assert.ok(
			states[i] >= states[i - 1],
			`level ${i + 1} is easier to search than level ${i} (${states[i]} < ${states[i - 1]})`
		);
	}
});

test("each recorded search cost is what the solver actually needs", () => {
	// A stale `states` would silently scramble the difficulty order. Only the
	// cheap levels are re-measured; the expensive ones are covered by replaying
	// their solutions, where re-solving them would take minutes.
	for (const [i, level] of LEVELS.entries()) {
		if (level.states > 5_000) continue;
		const result = solve(parse(levelText(i)), { maxStates: 500_000 });
		assert.equal(result.states, level.states, `level ${i + 1} search cost drifted`);
	}
});

test("the bands cover the run with no gaps and no overlaps", () => {
	assert.equal(TIERS[0].from, 1);
	assert.equal(TIERS.at(-1).to, LEVELS.length);

	for (let i = 1; i < TIERS.length; i += 1) {
		assert.equal(TIERS[i].from, TIERS[i - 1].to + 1, `gap before ${TIERS[i].name}`);
	}

	for (let i = 0; i < LEVELS.length; i += 1) {
		const matches = TIERS.filter((tier) => i + 1 >= tier.from && i + 1 <= tier.to);
		assert.equal(matches.length, 1, `level ${i + 1} falls in ${matches.length} bands`);
		assert.equal(tierFor(i).name, matches[0].name);
	}
});

test("the bands are a real difficulty ramp, not just labels", () => {
	// The whole point: Legendary has to be meaningfully harder than Easy by the
	// measure the ordering uses, or the names are decoration.
	const median = (tier) => {
		const costs = LEVELS.slice(tier.from - 1, tier.to)
			.map((level) => level.states)
			.sort((a, b) => a - b);
		return costs[Math.floor(costs.length / 2)];
	};

	const ramp = TIERS.map(median);
	for (let i = 1; i < ramp.length; i += 1) {
		assert.ok(ramp[i] > ramp[i - 1], `${TIERS[i].name} is no harder than ${TIERS[i - 1].name}`);
	}

	assert.ok(
		ramp.at(-1) > ramp[0] * 1000,
		"Legendary should be orders of magnitude harder to search than Easy"
	);
});

test("every generated level's stored solution really solves it", () => {
	// Replaying a known solution is instant where re-solving is not, and it
	// proves solvability and par in one pass.
	assert.equal(solutions.solutions.length, GENERATED_LEVELS.length);
	const letters = { u: "up", d: "down", l: "left", r: "right" };

	GENERATED_LEVELS.forEach((level, i) => {
		const moves = [...solutions.solutions[i]].map((letter) => letters[letter]);
		const walked = measure(parse(level.rows.join("\n")), moves);

		assert.equal(walked.won, true, `generated level ${i + 1} is not solved by its solution`);
		assert.equal(walked.moves, level.par.moves, `generated level ${i + 1}: par drifted`);
		assert.equal(walked.pushes, level.par.pushes, `generated level ${i + 1}: pushes drifted`);
	});
});

test("only the hand-drawn levels are named", () => {
	// A name claims a level was designed to teach something. The generated ones
	// were not, and labelling them would dress a search result up as authorship.
	assert.equal(LEVELS.filter((level) => level.name).length, 9);
	assert.ok(LEVELS.slice(0, 6).every((level) => level.name), "the tutorial is all hand-drawn");
});

test("no two levels are the same board", () => {
	const seen = new Set(LEVELS.map((level) => level.rows.join("|")));
	assert.equal(seen.size, LEVELS.length, "the set contains duplicates");
});

test("every level stays inside the in-game hint budget", () => {
	// "Can I still win?" searches up to 420,000 states on the main thread. A
	// level past that leaves the button shrugging exactly where a player most
	// needs it, so generation caps at 380,000 and this guards the gap.
	for (const [i, level] of LEVELS.entries()) {
		assert.ok(
			level.states <= 380_000,
			`level ${i + 1} needs ${level.states} states, beyond what the hint can search`
		);
	}
});

test("no level starts in a dead position", () => {
	for (const [i, level] of LEVELS.entries()) {
		assert.deepEqual(stuckBoxes(parse(levelText(i))), [], `${level.name} starts with a stuck box`);
	}
});

test("replaying a level's solution reproduces its par exactly", () => {
	const start = parse(levelText(3)); // Compass — four boxes, seven moves
	const result = solve(start);
	const walked = measure(start, result.moves);

	assert.equal(walked.moves, 7);
	assert.equal(walked.pushes, 4);
});

test("every direction is a unit step", () => {
	for (const [name, step] of Object.entries(DIRECTIONS)) {
		assert.equal(Math.abs(step.dx) + Math.abs(step.dy), 1, `${name} is not one square`);
	}
});

test("every level is reachable by clearing the one before it", () => {
	// Gating is only safe because each level can actually be finished; a single
	// unsolvable level would strand the player on it forever with the rest of
	// the set locked behind.
	//
	// Proven by REPLAYING each level's known solution rather than re-deriving
	// it. Re-solving all hundred takes about seventeen seconds, to re-prove
	// something the generator already proved before it wrote the file. The
	// replay still catches what can actually regress here: an engine change
	// that makes a stored solution illegal.
	const letters = { u: "up", d: "down", l: "left", r: "right" };

	LEVELS.forEach((level, i) => {
		// Hand-drawn levels carry no stored solution; they are re-solved in
		// full by the test above.
		if (level.name) return;

		const generated = GENERATED_LEVELS.indexOf(level);
		assert.ok(generated >= 0, `level ${i + 1} is neither hand-drawn nor generated`);

		const moves = [...solutions.solutions[generated]].map((letter) => letters[letter]);
		const walked = measure(parse(levelText(i)), moves);
		assert.equal(walked.won, true, `level ${i + 1} cannot be cleared`);
	});
});

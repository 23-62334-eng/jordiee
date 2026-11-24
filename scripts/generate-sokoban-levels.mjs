/**
 * Generate verified Sokoban levels by reverse play, banded by difficulty.
 *
 * Run: node scripts/generate-sokoban-levels.mjs [seed]
 * Writes src/lib/sokoban/levels.generated.js and the test solution fixture.
 *
 * ── WHY NOT DRAW THEM ──────────────────────────────────────────────────────
 *
 * Of the thirteen levels hand-drawn for this game, FOUR were proved impossible
 * by the solver. At a hundred levels that failure rate is not a nuisance, it is
 * the whole problem.
 *
 * ── WHY REVERSE PLAY ───────────────────────────────────────────────────────
 *
 * Random box placement is hopeless — the overwhelming majority of arrangements
 * are dead on arrival. So levels are built backwards from a won position: every
 * box starts on a goal, and the player PULLS them away. Each pull is a push run
 * backwards, so a forward solution exists by construction rather than by luck.
 *
 * ── MEASURING DIFFICULTY ───────────────────────────────────────────────────
 *
 * Par is the obvious difficulty metric and a poor one. A long level can be a
 * long corridor; a short one can be a vicious ordering problem. What actually
 * tracks how hard a Sokoban level feels is how much SEARCH it takes — the
 * number of distinct positions a solver has to consider before it finds the
 * line, which is a direct measure of how much branching a human has to navigate
 * and how many wrong turns are available.
 *
 * So each band targets a state-count window as well as a par window, and the
 * solver reports both. That is why Legendary levels are not simply longer than
 * Easy ones: they are 4–5 box problems whose search space is two or three
 * orders of magnitude larger.
 *
 * ── THE CEILING IS DELIBERATE ──────────────────────────────────────────────
 *
 * Measured on this solver: par 11 costs ~900 states, par 22 costs ~34,000, and
 * par 31 costs ~830,000 and over a second. Difficulty beyond that cannot be
 * verified honestly — and more importantly, the in-game "Can I still win?"
 * would stop being able to answer, which is the feature the whole game is
 * built around. MAX_STATES caps the hardest level at something the player's
 * own browser can still search. A level too hard to verify is not a harder
 * level, it is an unverified one.
 */

import { writeFileSync } from "node:fs";

import { parse, isWon } from "../src/lib/sokoban/engine.js";
import { solve, measure } from "../src/lib/sokoban/solver.js";
import { makeRoom, render, reverseWalk, rngFrom } from "./probe-helpers.mjs";

const SEED = Number(process.argv[2] ?? 20260214);
const rng = rngFrom(SEED);

/** The hardest search any shipped level may need, and the in-game budget. */
const MAX_STATES = 380_000;

/**
 * One spec per difficulty band.
 *
 * `count` is how many levels the band needs from the generator. Six hand-drawn
 * teaching levels take the first six slots of Easy, and three more hand-drawn
 * levels (Corridor, Nook, Crossroads) are merged in by measured difficulty,
 * so Normal, Hard and Nightmare each ask for one fewer. 91 in total.
 *
 * `states` is the search-cost window that makes a band mean something beyond
 * its name.
 */
const BANDS = [
	{ name: "Easy", count: 6, width: 7, height: 7, boxes: 1, pillars: 2, pulls: 16, par: [3, 9], states: [1, 1_500] },
	{ name: "Normal", count: 11, width: 7, height: 7, boxes: 2, pillars: 3, pulls: 26, par: [8, 15], states: [400, 8_000] },
	{ name: "Hard", count: 11, width: 8, height: 7, boxes: 2, pillars: 3, pulls: 34, par: [12, 19], states: [3_000, 30_000] },
	{ name: "Expert", count: 12, width: 8, height: 8, boxes: 3, pillars: 4, pulls: 44, par: [14, 23], states: [12_000, 70_000] },
	{ name: "Nightmare", count: 11, width: 9, height: 8, boxes: 3, pillars: 5, pulls: 56, par: [17, 26], states: [40_000, 140_000] },
	{ name: "Insane", count: 12, width: 9, height: 8, boxes: 4, pillars: 5, pulls: 70, par: [19, 29], states: [90_000, 220_000] },
	{ name: "Impossible", count: 12, width: 9, height: 9, boxes: 4, pillars: 6, pulls: 90, par: [21, 32], states: [150_000, 300_000] },
	{ name: "Legendary", count: 16, width: 10, height: 9, boxes: 4, pillars: 7, pulls: 120, par: [23, 40], states: [220_000, MAX_STATES] },
];

const pick = (list) => list[Math.floor(rng() * list.length)];

/** One candidate, fully verified, or null. `relax` widens the windows when a
 *  band is proving stubborn, so generation always terminates. */
function attempt(band, relax) {
	const room = makeRoom(band.width, band.height, band.pillars, rng);
	if (!room) return null;

	const goals = new Set();
	let guard = 0;
	while (goals.size < band.boxes && guard++ < 200) goals.add(pick(room.floor));
	if (goals.size < band.boxes) return null;

	const walked = reverseWalk(room, goals, band.pulls, rng);
	if (!walked) return null;

	// A box still on its goal is a box the player never has to touch.
	for (const box of walked.boxes) if (goals.has(box)) return null;

	const rows = render(room, goals, walked.boxes, walked.player);
	let state;
	try {
		state = parse(rows.join("\n"));
	} catch {
		return null;
	}
	if (isWon(state)) return null;

	const result = solve(state, { maxStates: MAX_STATES });
	if (!result.solved) return null;

	const solution = measure(state, result.moves);
	const [parLow, parHigh] = band.par;
	const [stateLow, stateHigh] = band.states;

	// Relaxation only ever loosens the LOWER bound. The upper bounds are the
	// promises — par stays verifiable and the search stays inside what a
	// browser can do — so they never move.
	if (solution.moves < Math.max(1, parLow - relax * 2) || solution.moves > parHigh) return null;
	if (result.states < Math.max(1, stateLow * (1 - relax * 0.12)) || result.states > stateHigh) {
		return null;
	}

	return {
		rows,
		par: { moves: solution.moves, pushes: solution.pushes },
		states: result.states,
		moves: result.moves.map((d) => d[0]).join(""),
	};
}

console.log(`Generating levels (seed ${SEED}, cap ${MAX_STATES} states)…`);

const out = [];
const seen = new Set();
const startedAll = Date.now();

for (const band of BANDS) {
	const started = Date.now();
	const found = [];
	let tries = 0;
	let relax = 0;

	while (found.length < band.count) {
		tries += 1;
		// Nothing found in a long while means the window is too tight for this
		// geometry; widen it rather than spin forever.
		if (tries % 4000 === 0) relax += 1;
		if (tries > 150_000) {
			console.log(`  ! ${band.name}: giving up at ${found.length}/${band.count}`);
			break;
		}

		const level = attempt(band, relax);
		if (!level) continue;

		const id = level.rows.join("|");
		if (seen.has(id)) continue;
		seen.add(id);
		found.push(level);
	}

	found.sort((a, b) => a.states - b.states || a.par.moves - b.par.moves);
	out.push(...found.map((level) => ({ ...level, band: band.name })));

	const pars = found.map((l) => l.par.moves);
	const states = found.map((l) => l.states);
	console.log(
		`  ${band.name.padEnd(11)} ${found.length}/${band.count}  ` +
			`par ${Math.min(...pars)}–${Math.max(...pars)}  ` +
			`states ${Math.min(...states).toLocaleString()}–${Math.max(...states).toLocaleString()}  ` +
			`(${tries} tries, ${((Date.now() - started) / 1000).toFixed(1)}s)`
	);
}

const body = out
	.map(
		(level) => `	{
		par: { moves: ${level.par.moves}, pushes: ${level.par.pushes} },
		states: ${level.states},
		rows: [${level.rows.map((row) => JSON.stringify(row)).join(", ")}],
	},`
	)
	.join("\n");

writeFileSync(
	new URL("../src/lib/sokoban/levels.generated.js", import.meta.url),
	`/**
 * Generated Sokoban levels — DO NOT EDIT BY HAND.
 *
 * Produced by scripts/generate-sokoban-levels.mjs (seed ${SEED}) and verified
 * before being written: every level was solved by src/lib/sokoban/solver.js,
 * the par beside it is the length of a SHORTEST solution rather than an
 * estimate, and \`states\` is how many positions that search had to consider —
 * the difficulty measure the bands are built on.
 *
 * Built by reverse play: boxes start on goals and are PULLED backwards, so a
 * forward solution exists by construction rather than by luck.
 *
 * Regenerate with:
 *
 *     node scripts/generate-sokoban-levels.mjs ${SEED}
 */

export const GENERATED_LEVELS = [
${body}
];
`
);

// Optimal solutions go to a TEST fixture, not the bundle: re-solving a hundred
// levels in CI would take a minute, replaying their solutions takes no time at
// all — and shipping an answer key with the game would be a poor idea anyway.
writeFileSync(
	new URL("../tests/fixtures/sokoban-solutions.json", import.meta.url),
	`${JSON.stringify(
		{
			seed: SEED,
			note: "Optimal solutions for the generated levels, by index into GENERATED_LEVELS. u/d/l/r.",
			solutions: out.map((level) => level.moves),
		},
		null,
		"\t"
	)}\n`
);

const pars = out.map((l) => l.par.moves);
const states = out.map((l) => l.states);
console.log(
	`Done: ${out.length} levels in ${((Date.now() - startedAll) / 1000).toFixed(1)}s · ` +
		`par ${Math.min(...pars)}–${Math.max(...pars)} · ` +
		`states ${Math.min(...states).toLocaleString()}–${Math.max(...states).toLocaleString()}`
);

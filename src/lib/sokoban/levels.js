/**
 * One hundred levels, in ascending order of difficulty.
 *
 * ── WHY THESE ARE NOT THE FAMOUS ONES ──────────────────────────────────────
 *
 * The classic Sokoban levels — Thinking Rabbit's originals and the sets that
 * followed — are somebody's copyrighted work, and a portfolio is the last
 * place to be quietly shipping someone else's. Every level here was drawn for
 * this project.
 *
 * ── PAR IS MEASURED, NOT GUESSED ───────────────────────────────────────────
 *
 * `par` is the length of a shortest solution, produced by ./solver.js rather
 * than by the author's estimate. Breadth-first search is move-optimal by
 * construction, so these are true lower bounds: a player who matches par has
 * genuinely found an optimal line, and the tests re-derive every one of these
 * numbers so a change to the engine cannot silently invalidate them.
 *
 * That audit earned its place immediately. Of the designs drafted for this
 * set, four looked perfectly reasonable on screen and were proved IMPOSSIBLE
 * by the solver — boxes that corner-lock on the first push, goals behind a
 * wall nothing can route around. Shipping those would have left a player
 * grinding at a puzzle with no solution, unable to tell that from their own
 * failure to see it. Drawing a Sokoban level is easy; drawing a solvable one
 * is not, and the only honest way to know which you have is to solve it.
 *
 * ── NINE BY HAND, NINETY-ONE BY MACHINE ────────────────────────────────────
 *
 * The nine hand-drawn levels are the ones that matter: each teaches one idea
 * (you push and never pull; a wall between box and goal; four boxes solved
 * from a single spot). That is design, and design does not generate.
 *
 * The other ninety-one come from scripts/generate-sokoban-levels.mjs, built by
 * reverse play and verified by the solver before they were written to disk.
 * Hand-drawing ninety-one more was not an option worth pretending to: of the
 * thirteen levels drawn for the original set, FOUR were proved impossible.
 *
 * ── ORDERING: MEASURED, NOT ASSUMED ────────────────────────────────────────
 *
 * Only the first SIX hand-drawn levels are pinned to the front, because those
 * six are the tutorial and their job is teaching order, not difficulty order.
 *
 * The remaining three — Corridor, Nook and Crossroads — take their place in
 * the run by measured difficulty like everything else. Crossroads costs the
 * solver 62,011 states; leaving it at level 9 would have put a harder puzzle
 * in "Easy" than most of "Hard", purely because a human drew it.
 *
 * Difficulty is ordered by SEARCH COST — the number of distinct positions the
 * solver has to examine — rather than by par. Par measures how long a level
 * is; search cost measures how much branching there is to get lost in, which
 * is much closer to how hard a level feels. The run spans 14 states at level 1
 * to 377,182 at level 100.
 *
 * Glyphs: `#` wall, `$` box, `.` goal, `*` box on goal, `@` player,
 * `+` player on goal.
 */

import { GENERATED_LEVELS } from "./levels.generated.js";

/**
 * The tutorial: pinned to the front, in the order they teach rather than the
 * order of their difficulty.
 */
const TEACHING = [
	{
		name: "First Push",
		states: 5,
		par: { moves: 1, pushes: 1 },
		// Deliberately trivial: it exists to teach the one rule that is not
		// obvious — you push, you never pull — before anything is at stake.
		rows: ["#######", "#     #", "# @$. #", "#     #", "#######"],
	},
	{
		name: "Pinch",
		states: 11,
		par: { moves: 4, pushes: 2 },
		rows: ["########", "#  .   #", "# #$## #", "# # @  #", "# #$## #", "#  .   #", "########"],
	},
	{
		name: "Pocket",
		states: 47,
		par: { moves: 7, pushes: 3 },
		rows: ["########", "#   ####", "# $ ####", "#..$ @ #", "#   ####", "########"],
	},
	{
		name: "Compass",
		states: 44,
		par: { moves: 7, pushes: 4 },
		// Four boxes and four goals, and still only seven moves: the shape does
		// the teaching. Standing in the middle, every box is one push from home.
		rows: ["#######", "#  .  #", "# #$# #", "#.$@$.#", "# #$# #", "#  .  #", "#######"],
	},
	{
		name: "Pair",
		states: 817,
		par: { moves: 8, pushes: 4 },
		rows: ["########", "#      #", "# @$ . #", "#      #", "#  $ . #", "#      #", "########"],
	},
	{
		name: "Detour",
		states: 176,
		par: { moves: 9, pushes: 4 },
		// One box, one goal, and a wall directly between them — the first level
		// that cannot be solved by pushing toward the target.
		rows: ["#########", "#   .   #", "#   #   #", "# @ $   #", "#       #", "#########"],
	},
];

/**
 * Hand-drawn, but not tutorials — these are placed by measured difficulty
 * alongside the generated levels. `states` is what the solver needed to find
 * each one's shortest line, asserted in the tests so it cannot drift.
 */
const SHOWCASE = [
	{
		name: "Corridor",
		states: 1372,		par: { moves: 13, pushes: 5 },
		rows: ["########", "#.     #", "#.$$  @#", "#.$    #", "#      #", "########"],
	},
	{
		name: "Nook",
		states: 1926,
		par: { moves: 17, pushes: 6 },
		rows: ["########", "#  #   #", "# .# . #", "#  $$  #", "#  @   #", "#      #", "########"],
	},
	{
		name: "Crossroads",
		states: 62011,
		par: { moves: 19, pushes: 7 },
		// The hardest here, and the only one whose search runs into five figures
		// of states — which is also why the in-game hint is budgeted.
		rows: ["#########", "#   .   #", "# $ . $ #", "#   $   #", "#   @   #", "#   .   #", "#########"],
	},
];

/**
 * The tutorial, then everything else in order of how much search it takes.
 *
 * The sort is on `states` rather than par on purpose, and the two disagree
 * often: level 100 has a par of 32 while level 60 has a par of 26, but it
 * takes the solver fourteen times as much work to find it. Sorting by par
 * would have scattered the genuinely vicious levels through the middle of the
 * run.
 */
export const LEVELS = [
	...TEACHING,
	...[...SHOWCASE, ...GENERATED_LEVELS].sort(
		(a, b) => a.states - b.states || a.par.moves - b.par.moves
	),
];

/** Levels as the engine wants them: one string, newline separated. */
export function levelText(index) {
	return LEVELS[index].rows.join("\n");
}

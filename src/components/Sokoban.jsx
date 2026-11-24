import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
	FiChevronLeft,
	FiChevronRight,
	FiCornerUpLeft,
	FiHelpCircle,
	FiRotateCcw,
	FiVolume1,
	FiVolume2,
	FiVolumeX,
	FiX,
} from "react-icons/fi";

import { LEVELS, levelText } from "../lib/sokoban/levels.js";
import { tierFor } from "../lib/sokoban/difficulty.js";
import { isWon, move, parse, stuckBoxes } from "../lib/sokoban/engine.js";
import { hint as solveHint } from "../lib/sokoban/solver.js";
import { createPlayer, setVolume } from "../lib/shared/sound.js";

/**
 * Sokoban — push every box onto a goal.
 *
 * The companion to Logic Sweeper, and built on the same conviction: the
 * interesting part is the solver, and the game is how you show it. Both ship
 * with one, and both use it to make the same promise — that the puzzle in
 * front of you is fair.
 *
 * Where Minesweeper uses its solver to guarantee boards need no guessing, this
 * one uses it for the two questions a Sokoban player actually has:
 *
 *   "IS THIS STILL WINNABLE?" Sokoban's defining cruelty is that you can ruin
 *   a level irrecoverably and keep playing for ten minutes without knowing.
 *   The solver runs from the CURRENT position, so the answer is exact rather
 *   than a heuristic guess, and a dead position is reported as dead.
 *
 *   "WHAT IS PAR?" Every level's par is a shortest solution's length, measured
 *   by breadth-first search rather than estimated. Matching it means something.
 *
 * ── UNDO ───────────────────────────────────────────────────────────────────
 *
 * Unlimited, and it is the single most important control on the screen. A
 * Sokoban without undo is hostile — one careless push and the only option is
 * restarting a level you were nearly through. Because the engine returns new
 * states instead of mutating one, history is a plain array of past states and
 * undo is a pop. No inverse-move logic to get wrong.
 */

const MUTE_KEY = "sweeper-muted";
const VOLUME_KEY = "sweeper-volume";
const DEFAULT_VOLUME = 0.7;
const bestKey = (index) => `sokoban-best-${index}`;

/** "1 move", not "1 moves" — these strings are read aloud by screen readers. */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Shared with Logic Sweeper on purpose: one sound preference, not two. */
function readMuted() {
	try {
		return localStorage.getItem(MUTE_KEY) === "1";
	} catch {
		return false;
	}
}

function readVolume() {
	try {
		const raw = localStorage.getItem(VOLUME_KEY);
		if (raw === null || raw === "") return DEFAULT_VOLUME;
		const value = Number(raw);
		return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
	} catch {
		return DEFAULT_VOLUME;
	}
}

function readBest(index) {
	try {
		const raw = JSON.parse(localStorage.getItem(bestKey(index)) ?? "null");
		return raw && Number.isFinite(raw.moves) ? raw : null;
	} catch {
		return null;
	}
}

/**
 * Which levels have ever been solved, read from the best-score entries.
 *
 * A separate "progress" key would be a second source of truth that can drift
 * from the scores; a recorded best IS the proof that a level was finished, so
 * progress is derived rather than stored.
 */
function readCleared() {
	return LEVELS.map((_, i) => readBest(i) !== null);
}

/**
 * Where to drop the player when the panel opens: the first level they have not
 * finished.
 *
 * Opening on level 1 every time would make a returning player click past the
 * eight they have already solved. If they have solved everything, open at the
 * start so there is something to play.
 */
function startIndex() {
	const next = readCleared().findIndex((done) => !done);
	return next === -1 ? 0 : next;
}

/**
 * The hint's search budget.
 *
 * This runs on the main thread in response to a click, so it cannot be
 * unbounded — but it has to clear the hardest level in the set, or the feature
 * the whole game is built around stops working exactly where it is needed
 * most. Generation caps shipped levels at 380,000 states (see
 * scripts/generate-sokoban-levels.mjs); this sits above that so every level
 * from Easy to Legendary can still be answered, and no further.
 *
 * Worst case is roughly half a second of blocked main thread, which is why the
 * button paints "Searching…" first.
 */
const HINT_BUDGET = 420_000;

const ARROWS = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	w: "up",
	a: "left",
	s: "down",
	d: "right",
};

function Sokoban({ onClose }) {
	const reduceMotion = useReducedMotion();

	const [index, setIndex] = useState(startIndex);
	const level = LEVELS[index];
	const tier = tierFor(index);

	// `index` is already bound by the time this initialiser runs, so the board
	// and the level number can never disagree on the first render.
	const [state, setState] = useState(() => parse(levelText(index)));
	const [cleared, setCleared] = useState(readCleared);
	// Past states, oldest first. Undo pops; the engine's immutability is what
	// makes that sufficient.
	const [history, setHistory] = useState([]);
	const [best, setBest] = useState(() => readBest(index));
	const [note, setNote] = useState(null);
	const [muted, setMuted] = useState(readMuted);
	const [volume, setVolumeState] = useState(readVolume);
	const [thinking, setThinking] = useState(false);

	const boardRef = useRef(null);
	const touchRef = useRef(null);

	// Rebuilt when the preference changes rather than reading a ref: every
	// sound is fired synchronously from an event, never from a timer, so there
	// is no window in which a stale closure could make noise after a mute.
	const play = useMemo(() => createPlayer(() => muted), [muted]);

	useEffect(() => {
		setVolume(muted ? 0 : volume);
	}, [muted, volume]);

	const won = useMemo(() => isWon(state), [state]);


	const stuck = useMemo(() => (won ? [] : stuckBoxes(state)), [state, won]);

	/**
	 * A level is playable if it is the first, or the one before it is solved.
	 *
	 * The levels are ordered as a difficulty curve — the opener exists purely
	 * to teach that you push and never pull — so letting someone start on
	 * Crossroads is letting them start on the one level the curve was built to
	 * prepare them for.
	 */
	const unlocked = useCallback((i) => i === 0 || cleared[i - 1] === true, [cleared]);

	const load = useCallback(
		(next) => {
			// Guarded here as well as on the buttons: a disabled control is a
			// courtesy, not a rule, and this is the only path that changes level.
			if (!unlocked(next)) return;

			setIndex(next);
			setState(parse(levelText(next)));
			setHistory([]);
			setBest(readBest(next));
			setNote(null);
		},
		[unlocked]
	);

	/**
	 * Move on by itself once a level is solved.
	 *
	 * The pause is the whole design here. Cutting straight to the next board
	 * would throw away the moment the player just earned — they never see
	 * whether they matched par, and a level that vanishes on the winning move
	 * feels like it was taken from them. Long enough to read the line, short
	 * enough that nobody reaches for a button.
	 *
	 * Cleared on unmount and on any state change, so a player who hits Undo or
	 * picks another level during the pause does not get yanked somewhere else a
	 * moment later.
	 */
	useEffect(() => {
		if (!won || index >= LEVELS.length - 1) return;

		const id = setTimeout(() => load(index + 1), 1600);
		return () => clearTimeout(id);
	}, [won, index, load]);

	const restart = useCallback(() => {
		setState(parse(levelText(index)));
		setHistory([]);
		setNote(null);
		play("undo");
	}, [index, play]);

	/** Record a personal best in moves, tie-broken by pushes. */
	const record = useCallback(
		(finished) => {
			const previous = readBest(index);
			const better =
				!previous ||
				finished.moves < previous.moves ||
				(finished.moves === previous.moves && finished.pushes < previous.pushes);

			if (!better) return;

			const next = { moves: finished.moves, pushes: finished.pushes };
			try {
				localStorage.setItem(bestKey(index), JSON.stringify(next));
			} catch {
				// Will not survive a reload.
			}
			setBest(next);
		},
		[index]
	);

	// Clearing a level unlocks the next one. Kept separate from `record` because
	// a level stays cleared even when the run was worse than the player's best.
	const markCleared = useCallback(() => {
		setCleared((prev) => {
			if (prev[index]) return prev;
			const next = [...prev];
			next[index] = true;
			return next;
		});
	}, [index]);

	const step = useCallback(
		(direction) => {
			if (won) return;

			const next = move(state, direction);
			if (!next) {
				play("blocked");
				return;
			}

			// Which sound depends on what the move did, so the audio reports the
			// state change rather than just the keypress.
			const pushed = next.pushes > state.pushes;
			if (!pushed) {
				play("step");
			} else {
				// Find the box that moved and ask whether it landed home.
				let seated = false;
				let left = false;
				for (let i = 0; i < state.size; i += 1) {
					if (next.boxes[i] && !state.boxes[i]) seated = next.goals[i] === 1;
					if (!next.boxes[i] && state.boxes[i]) left = state.goals[i] === 1;
				}
				play(seated ? "seat" : left ? "unseat" : "push");
			}

			setHistory((prev) => [...prev, state]);
			setState(next);
			setNote(null);

			if (isWon(next)) {
				play("win");
				record(next);
				markCleared();
			}
		},
		[state, won, play, record, markCleared]
	);

	const undo = useCallback(() => {
		setHistory((prev) => {
			if (prev.length === 0) return prev;
			setState(prev[prev.length - 1]);
			setNote(null);
			play("undo");
			return prev.slice(0, -1);
		});
	}, [play]);

	/**
	 * Ask the solver where this stands.
	 *
	 * Deferred a frame so the "thinking" state paints first — the hardest level
	 * can take ~90ms, and a button that silently freezes reads as broken.
	 */
	const askHint = useCallback(() => {
		if (won) return;
		play("hint");
		setThinking(true);

		requestAnimationFrame(() => {
			const answer = solveHint(state, { maxStates: HINT_BUDGET });
			setThinking(false);

			if (answer.dead) {
				setNote({
					tone: "dead",
					text: "This position cannot be won — a box is somewhere it can never leave. Undo until it frees up.",
				});
				return;
			}

			if (!answer.move) {
				setNote({
					tone: "unknown",
					text: "This position is too tangled to search quickly. Undo a few moves and ask again.",
				});
				return;
			}

			setNote({
				tone: "ok",
				text: `Go ${answer.move} — a shortest finish from here is ${answer.remaining} move${
					answer.remaining === 1 ? "" : "s"
				}.`,
			});
		});
	}, [state, won, play]);

	// Keyboard is the primary input for this game, so it is bound at the window
	// rather than requiring the board to hold focus.
	useEffect(() => {
		const onKey = (event) => {
			if (event.key === "Escape") {
				onClose();
				return;
			}

			const direction = ARROWS[event.key] ?? ARROWS[event.key?.toLowerCase?.()];
			if (direction) {
				event.preventDefault();
				step(direction);
				return;
			}

			if (event.key === "z" || event.key === "Z" || event.key === "Backspace") {
				event.preventDefault();
				undo();
			} else if (event.key === "r" || event.key === "R") {
				event.preventDefault();
				restart();
			} else if (event.key === "h" || event.key === "H") {
				event.preventDefault();
				askHint();
			}
		};

		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [step, undo, restart, askHint, onClose]);

	// Swipe, for phones. A short threshold, and the dominant axis wins, so a
	// sloppy diagonal still does the obvious thing rather than nothing.
	const onTouchStart = useCallback((event) => {
		const touch = event.changedTouches[0];
		touchRef.current = { x: touch.clientX, y: touch.clientY };
	}, []);

	const onTouchEnd = useCallback(
		(event) => {
			const start = touchRef.current;
			if (!start) return;

			const touch = event.changedTouches[0];
			const dx = touch.clientX - start.x;
			const dy = touch.clientY - start.y;
			touchRef.current = null;

			if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
			step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
		},
		[step]
	);

	const changeVolume = useCallback(
		(next) => {
			setVolumeState(next);
			if (next > 0 && muted) {
				setMuted(false);
				try {
					localStorage.setItem(MUTE_KEY, "0");
				} catch {
					// Will not survive a reload.
				}
			}
			try {
				localStorage.setItem(VOLUME_KEY, String(next));
			} catch {
				// Will not survive a reload.
			}
		},
		[muted]
	);

	// Entering a new band is a moment worth marking — it is the only feedback
	// that the run has structure rather than just being long.
	const crossed = index > 0 && tierFor(index - 1).name !== tier.name ? tier.name : null;

	const cellSize = state.width > 8 ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9";
	const atPar = won && state.moves === level.par.moves;

	return (
		<div className="flex h-full flex-col gap-3 p-4 sm:p-5">
			{/* ── Header ─────────────────────────────────────────────────── */}
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h2 className="text-base font-semibold text-gray-900 dark:text-white">
						Sokoban
					</h2>
					<p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-gray-500 dark:text-gray-400">
						{/* The band is the loudest thing in this line on purpose: on a
						    hundred-level run, "which tier am I in" is the question a
						    player asks, and the level number alone does not answer it. */}
						<span
							className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase dark:bg-white dark:text-gray-900"
							title={`Levels ${tier.from}–${tier.to}`}
						>
							{tier.name}
						</span>
						<span className="truncate">
							{index + 1} of {LEVELS.length}
							{level.name ? ` · ${level.name}` : ""} — par {level.par.moves} move
							{level.par.moves === 1 ? "" : "s"}
						</span>
					</p>
				</div>

				<div className="-mr-1 flex shrink-0 items-center">
					<div className="group flex items-center">
						<button
							type="button"
							onClick={() => {
								const next = !muted;
								setMuted(next);
								try {
									localStorage.setItem(MUTE_KEY, next ? "1" : "0");
								} catch {
									// Will not survive a reload.
								}
								if (!next) play("seat");
							}}
							aria-pressed={muted}
							aria-label={muted ? "Turn sound on" : "Turn sound off"}
							title={muted ? "Sound off" : "Sound on"}
							className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:hover:bg-gray-800 dark:hover:text-gray-200"
						>
							{muted || volume === 0 ? (
								<FiVolumeX className="h-4 w-4" aria-hidden="true" />
							) : volume < 0.5 ? (
								<FiVolume1 className="h-4 w-4" aria-hidden="true" />
							) : (
								<FiVolume2 className="h-4 w-4" aria-hidden="true" />
							)}
						</button>

						<div className="-mt-1 w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 group-focus-within:w-20 group-focus-within:opacity-100 group-hover:w-20 group-hover:opacity-100">
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={muted ? 0 : volume}
								onChange={(event) => changeVolume(Number(event.target.value))}
								onPointerUp={() => play("step")}
								aria-label="Volume"
								className="sokoban-volume w-20 align-middle"
							/>
						</div>
					</div>

					<button
						type="button"
						onClick={onClose}
						aria-label="Close Sokoban"
						className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:hover:bg-gray-800 dark:hover:text-gray-200"
					>
						<FiX className="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			</div>

			{/* ── Level picker and counters ──────────────────────────────── */}
			<div className="flex flex-wrap items-center gap-2">
				{/* Level navigation: two arrows and a count.
				    This was a strip of a hundred numbered pills, which worked at
				    nine and fell apart at a hundred — a horizontally scrolling
				    row inside a dialog is a thing to fight rather than use, and
				    ninety of those pills were always locked anyway. Progression
				    is strictly sequential, so sequential controls are the honest
				    shape for it. */}
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => load(index - 1)}
						disabled={index === 0}
						aria-label="Previous level"
						title={index === 0 ? "This is the first level" : `Back to level ${index}`}
						className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
					>
						<FiChevronLeft className="h-4 w-4" aria-hidden="true" />
					</button>

					<span className="min-w-[4.5rem] text-center font-mono text-xs tabular-nums text-gray-600 dark:text-gray-300">
						{index + 1}
						<span className="text-gray-400 dark:text-gray-500"> / {LEVELS.length}</span>
					</span>

					<button
						type="button"
						onClick={() => load(index + 1)}
						disabled={index === LEVELS.length - 1 || !unlocked(index + 1)}
						aria-label="Next level"
						title={
							index === LEVELS.length - 1
								? "This is the last level"
								: unlocked(index + 1)
									? `On to level ${index + 2}`
									: "Solve this level to continue"
						}
						className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
					>
						<FiChevronRight className="h-4 w-4" aria-hidden="true" />
					</button>
				</div>

				<div className="ml-auto flex items-center gap-2 font-mono text-xs tabular-nums text-gray-600 dark:text-gray-300">
					<span aria-label={plural(state.moves, "move")}>{state.moves} mv</span>
					<span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
						·
					</span>
					<span aria-label={plural(state.pushes, "push")}>{state.pushes} ps</span>
					{best && (
						<span className="text-gray-400 dark:text-gray-500">
							best {best.moves}/{best.pushes}
						</span>
					)}
				</div>
			</div>

			{/* ── Board ──────────────────────────────────────────────────── */}
			<div
				className="relative -mx-1 flex min-h-0 flex-1 items-center justify-center overflow-auto px-1 py-1"
				onTouchStart={onTouchStart}
				onTouchEnd={onTouchEnd}
			>
				<div
					ref={boardRef}
					role="img"
					aria-label={`${level.name}, ${plural(state.moves, "move")} made${
						won ? ", solved" : ""
					}`}
					className={`grid w-max gap-px ${won && !reduceMotion ? "sokoban-won" : ""}`}
					style={{ gridTemplateColumns: `repeat(${state.width}, minmax(0, 1fr))` }}
				>
					{Array.from({ length: state.size }, (_, i) => {
						const wall = state.walls[i] === 1;
						const goal = state.goals[i] === 1;
						const box = state.boxes[i] === 1;
						const isPlayer = state.player === i;
						const dead = stuck.includes(i);

						return (
							<div
								key={i}
								className={`${cellSize} relative flex items-center justify-center rounded-[3px] ${
									wall
										? "bg-gray-300 dark:bg-gray-700"
										: goal
											? "bg-gray-100 dark:bg-gray-800"
											: "bg-gray-50 dark:bg-gray-900"
								}`}
							>
								{/* The goal marker sits under everything, so a seated box
								    still shows it has arrived somewhere. */}
								{goal && !box && (
									<span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
								)}

								{box && (
									<motion.span
										layout={!reduceMotion}
										transition={{ type: "spring", stiffness: 700, damping: 40 }}
										className={`absolute inset-[3px] rounded-[2px] ${
											goal
												? "bg-gray-900 dark:bg-white"
												: dead
													? // A box that can never move again is worth
														// saying out loud rather than leaving the
														// player to discover in ten minutes.
														"bg-gray-400 ring-1 ring-gray-900 dark:bg-gray-500 dark:ring-white"
													: "bg-gray-500 dark:bg-gray-400"
										}`}
									/>
								)}

								{isPlayer && (
									<motion.span
										layoutId={reduceMotion ? undefined : "sokoban-player"}
										transition={{ type: "spring", stiffness: 700, damping: 40 }}
										className="absolute inset-[3px] flex items-center justify-center text-gray-900 dark:text-white"
									>
										{/* A head-and-shoulders silhouette rather than a disc.
										    A circle is the obvious shape and the wrong one: on a
										    board made of squares it reads as one more token, and
										    the player is the one thing on screen that is *you*.
										    Drawn rather than imported so it can carry the ring
										    that separates it from a dark box behind it. */}
										<svg
											viewBox="0 0 16 16"
											className="h-full w-full"
											fill="currentColor"
											aria-hidden="true"
										>
											<circle
												cx="8"
												cy="4.4"
												r="3"
												stroke="rgb(var(--card-bg))"
												strokeWidth="1.1"
											/>
											<path
												d="M8 8.4c-3.1 0-4.9 2-5.1 5.4a.6.6 0 0 0 .6.7h9a.6.6 0 0 0 .6-.7c-.2-3.4-2-5.4-5.1-5.4Z"
												stroke="rgb(var(--card-bg))"
												strokeWidth="1.1"
												strokeLinejoin="round"
											/>
										</svg>
									</motion.span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* ── Status ─────────────────────────────────────────────────── */}
			{(won || note || crossed || stuck.length > 0) && (
				<p
					role="status"
					className="rounded-2xl bg-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					{crossed
						? `${crossed} — levels ${tierFor(index).from} to ${tierFor(index).to}. They get harder from here.`
						: won
						? atPar
							? `Solved in ${plural(state.moves, "move")} — that is par. There is no shorter line.`
							: `Solved in ${plural(state.moves, "move")} and ${plural(
									state.pushes,
									"push"
								)}. Par is ${level.par.moves}.`
						: note
							? note.text
							: "A box is cornered and can never move again — undo to free it."}
				</p>
			)}

			{/* ── Actions ────────────────────────────────────────────────── */}
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={askHint}
					disabled={won || thinking}
					className="flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none disabled:opacity-40 dark:bg-white dark:text-gray-900"
				>
					<FiHelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
					{thinking ? "Searching…" : "Can I still win?"}
				</button>

				<button
					type="button"
					onClick={undo}
					disabled={history.length === 0}
					className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
				>
					<FiCornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
					Undo
				</button>

				<button
					type="button"
					onClick={restart}
					className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
				>
					<FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
					Restart
				</button>

			</div>

			<style>{`
				.sokoban-volume { -webkit-appearance: none; appearance: none; background: transparent; height: 16px; }
				.sokoban-volume::-webkit-slider-runnable-track { height: 3px; border-radius: 999px; background: rgb(var(--accent) / 0.25); }
				.sokoban-volume::-moz-range-track { height: 3px; border-radius: 999px; background: rgb(var(--accent) / 0.25); }
				.sokoban-volume::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 10px; height: 10px; margin-top: -3.5px; border-radius: 999px; background: rgb(var(--accent)); }
				.sokoban-volume::-moz-range-thumb { width: 10px; height: 10px; border: 0; border-radius: 999px; background: rgb(var(--accent)); }
				.sokoban-volume:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 3px; border-radius: 999px; }

				@keyframes sokoban-won {
					0%   { transform: scale(1); }
					40%  { transform: scale(1.04); }
					100% { transform: scale(1); }
				}
				.sokoban-won { animation: sokoban-won 420ms cubic-bezier(0.2, 0.8, 0.3, 1); }

				@media (prefers-reduced-motion: reduce) {
					.sokoban-won { animation: none; }
				}
			`}</style>

			<p className="hidden text-[10px] text-gray-400 sm:block dark:text-gray-500">
				Arrow keys or <kbd>WASD</kbd> to move · <kbd>Z</kbd> undo · <kbd>R</kbd> restart ·{" "}
				<kbd>H</kbd> check · swipe on touch
			</p>
		</div>
	);
}

export default Sokoban;

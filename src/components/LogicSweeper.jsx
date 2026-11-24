import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
	FiFlag,
	FiHelpCircle,
	FiRotateCcw,
	FiVolume1,
	FiVolume2,
	FiVolumeX,
	FiX,
} from "react-icons/fi";

import { DIFFICULTIES, generate, revealFrom } from "../lib/sweeper/board.js";
import { label, neighbours, nextHint, MINE } from "../lib/sweeper/solver.js";
import { createPlayer, setVolume } from "../lib/shared/sound.js";
// Same bomb as the launcher wears, so the icon that advertises the game is the
// icon the game is about.
import { Bomb } from "lucide-react";

/**
 * Logic Sweeper — Minesweeper with the coin flips taken out.
 *
 * The game itself is the demo; the thing being demonstrated lives in
 * ../lib/sweeper. Two features carry that logic onto the screen, and the panel
 * exists mainly to give them somewhere to happen:
 *
 *   GUESS-FREE BOARDS. Every board is played by the solver before it is shown,
 *   and only ships if deduction alone clears it. The badge in the header states
 *   the outcome rather than the intention — on the rare board the audit cannot
 *   certify inside its time budget, it says so.
 *
 *   EXPLAINED HINTS. The hint button does not highlight a safe square, it
 *   argues for one, in the terms a player would use, and marks the numbers the
 *   argument rests on. A highlight teaches nothing; a reason teaches the game.
 *
 * ── VISUAL LANGUAGE ────────────────────────────────────────────────────────
 *
 * Deliberately monochrome, like the rest of the site. Classic Minesweeper
 * colour-codes its numbers, and dropping that looks at first like losing
 * information — but the digit's shape is the primary channel and always was;
 * the colour is redundancy. So the ramp here is weight and opacity: low numbers
 * sit back, high numbers lean forward, which gives the same at-a-glance read of
 * "this corner is dense" without putting eight saturated hues into a site that
 * has none anywhere else.
 */

/** Tailwind cannot see into a template literal, so the ramp is spelled out. */
const NUMBER_STYLE = [
	"",
	"font-normal text-gray-500 dark:text-gray-500",
	"font-medium text-gray-600 dark:text-gray-400",
	"font-medium text-gray-700 dark:text-gray-300",
	"font-semibold text-gray-800 dark:text-gray-200",
	"font-semibold text-gray-900 dark:text-gray-100",
	"font-bold text-gray-900 dark:text-white",
	"font-bold text-gray-900 dark:text-white",
	"font-extrabold text-gray-900 dark:text-white",
];

const STATUS = { IDLE: "idle", PLAYING: "playing", WON: "won", LOST: "lost" };

const bestKey = (key) => `sweeper-best-${key}`;
const MUTE_KEY = "sweeper-muted";

/**
 * Sound is on by default, which is a deliberate exception to the rule that a
 * portfolio must never make noise at a visitor.
 *
 * Nothing here can play on arrival: the game is a lazy chunk behind a button,
 * and the audio context cannot even be created until a click inside it. By the
 * time a sound is possible the visitor has opened a game and started playing
 * one, which is the one context where silence is the surprising choice. The
 * toggle is in the header and the preference is remembered.
 */
function readMuted() {
	try {
		return localStorage.getItem(MUTE_KEY) === "1";
	} catch {
		return false;
	}
}

const VOLUME_KEY = "sweeper-volume";
const DEFAULT_VOLUME = 0.7;

function readVolume() {
	try {
		// The absent case has to be caught before Number(), not after: a missing
		// key reads as null, Number(null) is 0, and 0 is a perfectly valid
		// volume — so the range check waves it through and every first-time
		// visitor gets a silent game they never asked for.
		const raw = localStorage.getItem(VOLUME_KEY);
		if (raw === null || raw === "") return DEFAULT_VOLUME;

		const value = Number(raw);
		return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
	} catch {
		return DEFAULT_VOLUME;
	}
}

function readBest(key) {
	try {
		const raw = Number(localStorage.getItem(bestKey(key)));
		return Number.isFinite(raw) && raw > 0 ? raw : null;
	} catch {
		return null;
	}
}

/**
 * Chebyshev (king-move) distance — the number of steps a cascade takes to
 * reach a square from where it started.
 *
 * Straight-line distance would be the obvious choice and the wrong one: the
 * flood fill spreads diagonally as fast as it spreads sideways, so a ripple
 * keyed to Euclidean distance arrives visibly behind the reveal it is meant
 * to be animating.
 */
function chebyshev(a, b, width) {
	const ax = a % width;
	const ay = Math.floor(a / width);
	const bx = b % width;
	const by = Math.floor(b / width);
	return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function formatTime(seconds) {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function LogicSweeper({ onClose }) {
	const reduceMotion = useReducedMotion();
	const [difficulty, setDifficulty] = useState("beginner");
	const preset = DIFFICULTIES[difficulty];
	const size = preset.width * preset.height;

	// The board does not exist until the first click, so that click can be made
	// safe by construction and the audit can start from a real opening. See
	// ../lib/sweeper/board.js.
	const [board, setBoard] = useState(null);
	const [revealed, setRevealed] = useState(() => new Uint8Array(size));
	const [flags, setFlags] = useState(() => new Uint8Array(size));
	const [status, setStatus] = useState(STATUS.IDLE);
	const [hit, setHit] = useState(null); // the mine that ended it
	const [hint, setHint] = useState(null);
	const [seconds, setSeconds] = useState(0);
	const [best, setBest] = useState(() => readBest("beginner"));
	const [flagMode, setFlagMode] = useState(false);
	const [cursor, setCursor] = useState(0);
	const [muted, setMuted] = useState(readMuted);
	const [volume, setVolumeState] = useState(readVolume);

	// Where the last reveal started, so the open animation can ripple outwards
	// from the square the player actually clicked rather than from the corner
	// of the grid.
	const [origin, setOrigin] = useState(null);

	// Read through a ref so `play` never has to be rebuilt — and so a sound
	// fired from a timeout cannot play after the player has hit mute.
	const mutedRef = useRef(muted);
	mutedRef.current = muted;

	useEffect(() => {
		setVolume(muted ? 0 : volume);
	}, [muted, volume]);
	const play = useRef(createPlayer(() => mutedRef.current)).current;

	const gridRef = useRef(null);
	const touchRef = useRef({ timer: null, flagged: false });

	const changeVolume = useCallback(
		(next) => {
			setVolumeState(next);
			// Moving the slider off zero is itself an intent to hear something,
			// so it lifts mute rather than leaving the player wondering why a
			// non-zero volume is silent.
			if (next > 0 && muted) {
				setMuted(false);
				try {
					localStorage.setItem(MUTE_KEY, "0");
				} catch {
					// Preference will not survive a reload.
				}
			}

			try {
				localStorage.setItem(VOLUME_KEY, String(next));
			} catch {
				// Preference will not survive a reload.
			}
		},
		[muted]
	);

	const reset = useCallback(
		(key = difficulty) => {
			const next = DIFFICULTIES[key];
			const count = next.width * next.height;
			setBoard(null);
			setRevealed(new Uint8Array(count));
			setFlags(new Uint8Array(count));
			setStatus(STATUS.IDLE);
			setHit(null);
			setHint(null);
			setOrigin(null);
			setSeconds(0);
			setCursor(Math.floor(count / 2));
			setBest(readBest(key));
		},
		[difficulty]
	);

	useEffect(() => {
		reset(difficulty);
		// reset is recreated per difficulty; running it on the value alone keeps
		// a difficulty change from also replaying as a second reset.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [difficulty]);

	useEffect(() => {
		if (status !== STATUS.PLAYING) return;
		const id = setInterval(() => setSeconds((s) => s + 1), 1000);
		return () => clearInterval(id);
	}, [status]);

	useEffect(() => {
		const onKey = (event) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const flagCount = useMemo(() => flags.reduce((n, f) => n + f, 0), [flags]);
	const openCount = useMemo(() => revealed.reduce((n, r) => n + r, 0), [revealed]);

	/** The view the solver is allowed to see: revealed numbers, nothing else. */
	const playerView = useCallback(
		() => ({
			revealed,
			counts: board?.counts ?? new Int8Array(size),
			known: new Uint8Array(size),
			width: preset.width,
			height: preset.height,
			size,
			mines: preset.mines,
		}),
		[revealed, board, preset, size]
	);

	const finish = useCallback(
		(won, seed) => {
			setStatus(won ? STATUS.WON : STATUS.LOST);
			if (!won) return;

			play("win");

			const previous = readBest(seed);
			if (previous === null || seconds < previous) {
				try {
					localStorage.setItem(bestKey(seed), String(seconds));
				} catch {
					// A best time that will not survive a reload is still a best time.
				}
				setBest(seconds);
			}
		},
		[seconds, play]
	);

	const reveal = useCallback(
		(index) => {
			if (status === STATUS.WON || status === STATUS.LOST) return;
			if (flags[index]) return;

			let active = board;

			// First click: build a board around it, audited.
			if (!active) {
				active = generate({ ...preset, firstIndex: index });
				setBoard(active);
				setStatus(STATUS.PLAYING);
			} else if (revealed[index]) {
				return;
			}

			if (active.mines[index]) {
				setHit(index);
				setOrigin(index);
				setRevealed((prev) => {
					const next = Uint8Array.from(prev);
					next[index] = 1;
					return next;
				});

				play("explode");
				// The rest of the field uncovers outwards from the one that got
				// you, so the sound arrives with each mine rather than all at
				// once. Delays mirror the CSS stagger exactly.
				for (let i = 0; i < size; i += 1) {
					if (!active.mines[i] || i === index) continue;
					play("mine", 0.16 + chebyshev(index, i, preset.width) * 0.045);
				}

				finish(false, difficulty);
				return;
			}

			const next = Uint8Array.from(revealed);
			revealFrom(index, {
				revealed: next,
				counts: active.counts,
				width: preset.width,
				height: preset.height,
			});

			setRevealed(next);
			setHint(null);
			setOrigin(index);

			// Count what this click actually opened, so one square and a big
			// cascade do not sound the same.
			let opened = 0;
			for (let i = 0; i < size; i += 1) if (next[i] && !revealed[i]) opened += 1;
			play("reveal", opened);

			let open = 0;
			for (let i = 0; i < size; i += 1) if (next[i]) open += 1;
			if (open === size - preset.mines) finish(true, difficulty);
		},
		[board, revealed, flags, status, preset, size, difficulty, finish, play]
	);

	const toggleFlag = useCallback(
		(index) => {
			if (status === STATUS.WON || status === STATUS.LOST) return;
			if (revealed[index]) return;

			play("flag", flags[index] !== 1);
			setFlags((prev) => {
				const next = Uint8Array.from(prev);
				next[index] = next[index] ? 0 : 1;
				return next;
			});
		},
		[revealed, status, flags, play]
	);

	/**
	 * Chording: clicking a satisfied number opens its remaining neighbours.
	 *
	 * Not decoration — it is how the game is actually played at speed, and a
	 * board this size is tedious without it. A wrong flag turns it into a loss,
	 * which is the player's risk to take.
	 */
	const chord = useCallback(
		(index) => {
			if (!board || !revealed[index] || board.counts[index] === 0) return;

			const around = neighbours(index, preset.width, preset.height);
			const flagged = around.filter((n) => flags[n]).length;
			if (flagged !== board.counts[index]) return;

			play("chord");
			for (const n of around) if (!flags[n] && !revealed[n]) reveal(n);
		},
		[board, revealed, flags, preset, reveal, play]
	);

	const askHint = useCallback(() => {
		if (!board || status !== STATUS.PLAYING) return;

		play("hint");

		// "Already done" is flagged for a mine, opened for a safe square — so
		// the button moves the player forward instead of restating the last
		// thing they acted on.
		const found = nextHint(playerView(), (move) =>
			move.kind === MINE ? flags[move.index] === 1 : revealed[move.index] === 1
		);

		if (!found) {
			setHint({
				cells: [],
				basis: [],
				kind: null,
				reason: "Nothing more follows from what is open — open another corner and ask again.",
			});
			return;
		}

		setHint({
			cells: found.moves.map((m) => m.index),
			basis: found.basis,
			reason: found.reason,
			kind: found.kind,
		});
	}, [board, status, playerView, flags, revealed, play]);

	/** Arrow keys move, Enter opens, F flags, H hints — the whole game without
	 *  a mouse, which also makes it usable with a screen reader. */
	const onGridKeyDown = useCallback(
		(event) => {
			const { width } = preset;
			const moves = {
				ArrowLeft: -1,
				ArrowRight: 1,
				ArrowUp: -width,
				ArrowDown: width,
			};

			if (event.key in moves) {
				event.preventDefault();
				const next = cursor + moves[event.key];
				// Horizontal moves must not wrap onto the next row.
				const sameRow = Math.abs(moves[event.key]) === 1;
				if (next < 0 || next >= size) return;
				if (sameRow && Math.floor(next / width) !== Math.floor(cursor / width)) return;
				setCursor(next);
				gridRef.current?.querySelector(`[data-cell="${next}"]`)?.focus();
				return;
			}

			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				if (revealed[cursor]) chord(cursor);
				else reveal(cursor);
			} else if (event.key.toLowerCase() === "f") {
				event.preventDefault();
				toggleFlag(cursor);
			} else if (event.key.toLowerCase() === "h") {
				event.preventDefault();
				askHint();
			}
		},
		[cursor, preset, size, revealed, reveal, chord, toggleFlag, askHint]
	);

	// Touch: tap opens, long-press flags. The flag-mode switch in the toolbar
	// covers the same ground for anyone who would rather not hold.
	const onTouchStart = useCallback(
		(index) => {
			touchRef.current.flagged = false;
			touchRef.current.timer = setTimeout(() => {
				touchRef.current.flagged = true;
				toggleFlag(index);
			}, 350);
		},
		[toggleFlag]
	);

	const onTouchEnd = useCallback(
		(index, event) => {
			clearTimeout(touchRef.current.timer);
			if (touchRef.current.flagged) {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			if (flagMode) toggleFlag(index);
			else if (revealed[index]) chord(index);
			else reveal(index);
		},
		[flagMode, revealed, reveal, chord, toggleFlag]
	);

	const over = status === STATUS.WON || status === STATUS.LOST;

	const message = over
		? status === STATUS.WON
			? `Cleared in ${formatTime(seconds)} — ${openCount} squares, no guesses required.`
			: "That one was a mine. Every square on this board was deducible, so there is a line that gets through it."
		: (hint?.reason ?? null);
	const cell = preset.width > 16 ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm";

	return (
		<div className="flex h-full flex-col gap-3 p-4 sm:p-5">
			{/* ── Header ─────────────────────────────────────────────────── */}
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-base font-semibold text-gray-900 dark:text-white">
						Logic Sweeper
					</h2>
					<p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
						{board ? (
							board.guessFree ? (
								<>
									<span aria-hidden="true">✓</span>
									Audited guess-free — every square can be reasoned out
								</>
							) : (
								<>
									<span aria-hidden="true">!</span>
									This one could not be proven guess-free
								</>
							)
						) : (
							"Pick a square to begin — the board is built around your first click"
						)}
					</p>
				</div>

				<div className="-mr-1 flex shrink-0 items-center">
				{/* Volume: a button that reveals its slider.
				    The slider lives inside the same hover/focus group as the
				    speaker, so the control grows out of the icon rather than
				    opening a popover — no outside-click handling, no layer, and
				    the header stays two buttons wide until someone reaches for
				    it. `group-focus-within` carries the same reveal to keyboard
				    and touch, where there is no hover to rely on. */}
				<div className="group flex items-center">
					<button
						type="button"
						onClick={() => {
							const next = !muted;
							setMuted(next);
							try {
								localStorage.setItem(MUTE_KEY, next ? "1" : "0");
							} catch {
								// The preference just will not survive a reload.
							}
							// Confirm the unmute audibly — the only way to know sound
							// is back is to hear it.
							if (!next) play("hint");
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
							// A level you cannot hear is a level you cannot set, so
							// each step plays the tick at its own volume.
							onPointerUp={() => play("flag", true)}
							onKeyUp={() => play("flag", true)}
							aria-label="Volume"
							title={`Volume ${Math.round((muted ? 0 : volume) * 100)}%`}
							className="sweeper-volume w-20 align-middle"
						/>
					</div>
				</div>

				<button
					type="button"
					onClick={onClose}
					aria-label="Close Logic Sweeper"
					className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:hover:bg-gray-800 dark:hover:text-gray-200"
				>
					<FiX className="h-4 w-4" aria-hidden="true" />
				</button>
				</div>
			</div>

			{/* ── Toolbar ────────────────────────────────────────────────── */}
			<div className="flex flex-wrap items-center gap-2">
				<div
					role="radiogroup"
					aria-label="Difficulty"
					className="flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5 dark:bg-gray-800"
				>
					{Object.entries(DIFFICULTIES).map(([key, option]) => (
						<button
							key={key}
							type="button"
							role="radio"
							aria-checked={difficulty === key}
							onClick={() => setDifficulty(key)}
							className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none ${
								difficulty === key
									? "bg-[rgb(var(--accent))] text-white dark:text-gray-900"
									: "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>

				<div className="ml-auto flex items-center gap-2 font-mono text-xs tabular-nums text-gray-600 dark:text-gray-300">
					<span aria-label={`${preset.mines - flagCount} mines unflagged`}>
						⚑ {String(Math.max(0, preset.mines - flagCount)).padStart(2, "0")}
					</span>
					<span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
						·
					</span>
					<span aria-label={`${seconds} seconds elapsed`}>{formatTime(seconds)}</span>
					{best !== null && (
						<span className="text-gray-400 dark:text-gray-500">
							best {formatTime(best)}
						</span>
					)}
				</div>
			</div>

			{/* ── Board ──────────────────────────────────────────────────── */}
			<div className="relative -mx-1 min-h-0 flex-1 overflow-auto px-1 py-1">
				<div
					ref={gridRef}
					role="grid"
					aria-label={`${preset.label} board, ${preset.width} by ${preset.height}`}
					onKeyDown={onGridKeyDown}
					className={`mx-auto grid w-max gap-px ${
						status === STATUS.LOST && !reduceMotion ? "sweeper-shake" : ""
					}`}
					style={{ gridTemplateColumns: `repeat(${preset.width}, minmax(0, 1fr))` }}
				>
					{Array.from({ length: size }, (_, i) => {
						const isOpen = revealed[i] === 1;
						const value = board?.counts[i] ?? 0;
						const isMine = over && board?.mines[i] === 1;
						const hinted = hint?.cells.includes(i);
						const basis = hint?.basis.includes(i);

						// Distance from the square the player clicked, which both the
						// opening ripple and the mine cascade are timed against.
						const step = origin === null ? 0 : chebyshev(origin, i, preset.width);
						// Capped: on an Expert board a corner is 29 steps from the
						// far side, and a reveal that takes a second and a half to
						// finish stops reading as feedback.
						const openDelay = Math.min(step * 22, 360);

						return (
							<button
								key={i}
								type="button"
								data-cell={i}
								data-hint={hinted ? "target" : basis ? "basis" : undefined}
								role="gridcell"
								tabIndex={i === cursor ? 0 : -1}
								// A mine's own count is 0, so the plain "empty" branch would
								// announce the square that just ended the game as empty.
								aria-label={`${label(i, preset.width)}${
									isMine
										? ", mine"
										: isOpen
											? `, ${value === 0 ? "empty" : value}`
											: flags[i]
												? ", flagged"
												: ", unopened"
								}`}
								onFocus={() => setCursor(i)}
								onClick={() => {
									if (flagMode) toggleFlag(i);
									else if (isOpen) chord(i);
									else reveal(i);
								}}
								onContextMenu={(event) => {
									event.preventDefault();
									toggleFlag(i);
								}}
								onTouchStart={() => onTouchStart(i)}
								onTouchEnd={(event) => onTouchEnd(i, event)}
								onTouchCancel={() => clearTimeout(touchRef.current.timer)}
								style={
									reduceMotion
										? undefined
										: {
												animationDelay: `${
													i === hit ? 0 : isOpen ? openDelay : step * 45 + 160
												}ms`,
											}
								}
								className={`${cell} relative flex select-none items-center justify-center rounded-[3px] transition-[background-color,transform] duration-100 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none ${
									// Unopened squares are the only thing worth clicking, so
									// they are the only thing that says so. Over, or already
									// open with nothing to chord, and the cursor stays plain.
									over
										? "cursor-default"
										: isOpen
											? value > 0
												? "cursor-pointer"
												: "cursor-default"
											: "cursor-pointer active:scale-[0.88]"
								} ${
									isOpen
										? i === hit
											? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
											: "bg-gray-100 dark:bg-gray-800/80"
										: "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
								} ${
									reduceMotion
										? ""
										: i === hit
											? "sweeper-hit"
											: isOpen
												? "sweeper-open"
												: ""
								} ${hinted ? "ring-2 ring-gray-900 dark:ring-white" : ""} ${
									basis ? "ring-1 ring-gray-400 dark:ring-gray-500" : ""
								}`}
							>
								{isOpen && !isMine && value > 0 && (
									<span className={NUMBER_STYLE[value]}>{value}</span>
								)}
								{/* A mine the player had already flagged keeps its flag: at the
								    end of a board that reads as "you found this one", where
								    stacking a bomb glyph on top of the flag reads as neither. */}
								{isMine && flags[i] !== 1 && (
									<Bomb
										aria-hidden="true"
										className={`${preset.width > 16 ? "h-3 w-3" : "h-3.5 w-3.5"} ${
											reduceMotion ? "" : "sweeper-mine"
										}`}
										style={
											reduceMotion
												? undefined
												: { animationDelay: `${i === hit ? 0 : step * 45 + 160}ms` }
										}
									/>
								)}
								{!isOpen && flags[i] === 1 && (
									<FiFlag
										className="h-3 w-3 text-gray-700 dark:text-gray-200"
										aria-hidden="true"
									/>
								)}
								{hinted && !reduceMotion && (
									<motion.span
										className="pointer-events-none absolute inset-0 rounded-[3px] ring-2 ring-gray-900 dark:ring-white"
										animate={{ opacity: [1, 0.25, 1] }}
										transition={{ duration: 1.4, repeat: Infinity }}
									/>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* ── Hint / outcome ─────────────────────────────────────────── */}
			{/* The explanation line.
			    No AnimatePresence here, deliberately. Wrapping this in one left
			    the outgoing paragraph mounted indefinitely, so a stale hint
			    survived "New board" and sat under a cleared grid describing a
			    board that no longer existed. A fade-out on a line of text is
			    worth far less than the text being true, so it unmounts the
			    plain React way; `key` keeps the fade-in when the message
			    changes. */}
			{message && (
				<motion.p
					key={message}
					initial={reduceMotion ? false : { opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.18 }}
					role="status"
					className="rounded-2xl bg-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					{message}
				</motion.p>
			)}

			{/* ── Actions ────────────────────────────────────────────────── */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={askHint}
					disabled={!board || status !== STATUS.PLAYING}
					className="flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none disabled:opacity-40 dark:bg-white dark:text-gray-900"
				>
					<FiHelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
					Explain a move
				</button>

				<button
					type="button"
					onClick={() => setFlagMode((on) => !on)}
					aria-pressed={flagMode}
					className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none sm:hidden ${
						flagMode
							? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
							: "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
					}`}
				>
					<FiFlag className="h-3.5 w-3.5" aria-hidden="true" />
					Flag
				</button>

				<button
					type="button"
					onClick={() => reset()}
					className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
				>
					<FiRotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
					New board
				</button>
			</div>

			{/* Motion, as a style block rather than Tailwind utilities.
			    These are staggered per square by an inline animation-delay, and
			    a utility class cannot carry a value computed per cell. Framer
			    was the other option and the wrong one: an Expert board is 480
			    cells, and 480 motion components re-rendering on every reveal
			    costs far more than 480 elements running a CSS animation the
			    compositor handles on its own.

			    Every one of these is opt-in via `reduceMotion` at the call site,
			    so a visitor who asks for less motion gets a board that simply
			    changes state. */}
			<style>{`
				@keyframes sweeper-open {
					from { transform: scale(0.72); opacity: 0; }
					60%  { transform: scale(1.04); opacity: 1; }
					to   { transform: scale(1); opacity: 1; }
				}
				/* Backwards fill matters: without it a square with a 300ms delay
				   sits fully visible for 300ms and then jumps back to 72% to
				   start, which reads as a glitch rather than a ripple. */
				.sweeper-open { animation: sweeper-open 220ms cubic-bezier(0.2, 0.8, 0.3, 1) backwards; }

				@keyframes sweeper-hit {
					0%   { transform: scale(1); }
					18%  { transform: scale(1.5); }
					100% { transform: scale(1); }
				}
				.sweeper-hit { animation: sweeper-hit 460ms cubic-bezier(0.2, 0.9, 0.3, 1) both; z-index: 10; }

				@keyframes sweeper-mine {
					from { transform: scale(0); opacity: 0; }
					70%  { transform: scale(1.35); opacity: 1; }
					to   { transform: scale(1); opacity: 1; }
				}
				.sweeper-mine { animation: sweeper-mine 260ms cubic-bezier(0.2, 0.8, 0.3, 1) backwards; }

				/* Decaying rather than uniform, so it settles instead of stopping
				   dead — a constant-amplitude shake reads as a broken loop. */
				@keyframes sweeper-shake {
					0%   { transform: translate3d(0, 0, 0); }
					15%  { transform: translate3d(-5px, 1px, 0); }
					30%  { transform: translate3d(4px, -1px, 0); }
					45%  { transform: translate3d(-3px, 1px, 0); }
					60%  { transform: translate3d(2px, 0, 0); }
					75%  { transform: translate3d(-1px, 0, 0); }
					100% { transform: translate3d(0, 0, 0); }
				}
				.sweeper-shake { animation: sweeper-shake 420ms ease-out both; }

				/* The native range control is the one element on the page that
				   would arrive in the browser's own colours. Restyled to the
				   same monochrome as everything else — a thin track, a small
				   solid thumb. */
				.sweeper-volume {
					-webkit-appearance: none;
					appearance: none;
					background: transparent;
					height: 16px;
				}
				.sweeper-volume::-webkit-slider-runnable-track {
					height: 3px;
					border-radius: 999px;
					background: rgb(var(--accent) / 0.25);
				}
				.sweeper-volume::-moz-range-track {
					height: 3px;
					border-radius: 999px;
					background: rgb(var(--accent) / 0.25);
				}
				.sweeper-volume::-webkit-slider-thumb {
					-webkit-appearance: none;
					appearance: none;
					width: 10px;
					height: 10px;
					margin-top: -3.5px;
					border-radius: 999px;
					background: rgb(var(--accent));
				}
				.sweeper-volume::-moz-range-thumb {
					width: 10px;
					height: 10px;
					border: 0;
					border-radius: 999px;
					background: rgb(var(--accent));
				}
				.sweeper-volume:focus-visible {
					outline: 2px solid rgb(var(--accent));
					outline-offset: 3px;
					border-radius: 999px;
				}

				@media (prefers-reduced-motion: reduce) {
					.sweeper-open, .sweeper-hit, .sweeper-mine, .sweeper-shake {
						animation: none;
					}
				}
			`}</style>

			<p className="hidden text-[10px] text-gray-400 sm:block dark:text-gray-500">
				Right-click to flag · click a satisfied number to open its neighbours ·
				arrow keys, <kbd>Enter</kbd>, <kbd>F</kbd>, <kbd>H</kbd>
			</p>
		</div>
	);
}

export default LogicSweeper;

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
// lucide is a Feather fork, so its stroke weight matches the react-icons/fi set
// the rest of this cluster uses; Feather has none of these three.
//
// A gamepad on the launcher rather than a bomb: the button no longer opens
// Minesweeper, it opens a choice. The bomb belongs to Logic Sweeper, and is
// still what the mines on its board are drawn with.
import { Bomb, Boxes, Gamepad2 } from "lucide-react";

import ThemeToggle from "./ThemeToggle.jsx";

const LogicSweeper = lazy(() => import("./LogicSweeper.jsx"));
const Sokoban = lazy(() => import("./Sokoban.jsx"));

/**
 * The top-right cluster: the games launcher, then the theme toggle.
 *
 * Positioning lives here rather than in either child, because the two sit in
 * one row and a corner that two components both claim to own is a corner that
 * drifts apart. ThemeToggle is a plain pill; this is the only component that
 * knows where the cluster goes.
 *
 * The launcher is a separate pill rather than a fourth slot inside the theme
 * toggle: that control is a radiogroup — one mutually exclusive choice with
 * arrow-key navigation — and dropping an unrelated button into it would break
 * both its semantics and its keyboard model.
 *
 * ── THE DRAWER ─────────────────────────────────────────────────────────────
 *
 * Putting the cursor on the gamepad slides a drawer out beneath it, one row
 * per game, each with its name and a line about it. The first attempt grew the
 * pill sideways with bare icons instead; it was tidier and worse, because a
 * bomb and a stack of cubes do not say "Minesweeper" and "Sokoban" to anyone
 * who has not already played them. Names cost a few hundred pixels of drawer
 * and remove the guessing.
 *
 * Four things about it are deliberate:
 *
 *   NO PORTAL, NO FOCUS TRAP. The drawer is absolutely positioned inside the
 *   same element as the button, so it needs no layer, no outside-click
 *   listener and no focus management. It is a hover affordance, not a menu.
 *
 *   HOVER IS NOT THE ONLY WAY IN. `group-focus-within` opens the same drawer
 *   for keyboard users, and the gamepad is itself a toggle button, so touch —
 *   which has no hover at all — works by tapping.
 *
 *   NO GAP TO FALL THROUGH. The drawer's wrapper starts at the button's
 *   bottom edge and carries its own top padding, so the pointer never crosses
 *   dead space on its way down. A one-pixel gap closes the drawer mid-reach
 *   and is the single most common way this pattern is got wrong.
 *
 *   IT IS NOT IN THE LAYOUT. The wrapper is positioned absolutely, so an
 *   opening drawer never reflows the theme toggle beside it.
 *
 * Each game is a separate lazy chunk: opening Minesweeper must not pay for
 * Sokoban's solver, and the page itself pays for neither.
 */

const GAMES = {
	sweeper: {
		label: "Minesweeper",
		hint: "No guessing required",
		Icon: Bomb,
		Component: LogicSweeper,
	},
	sokoban: {
		label: "Sokoban",
		hint: "Nine original levels",
		Icon: Boxes,
		Component: Sokoban,
	},
};

function TopControls() {
	const [open, setOpen] = useState(false);
	// Three independent reasons the drawer can be open, tracked separately
	// because they end independently: tabbing away must not close a drawer the
	// pointer is still resting on, and moving the pointer off must not close one
	// the keyboard is inside. A single "is it open" flag gets both wrong.
	const [pinned, setPinned] = useState(false); // tapped (touch has no hover)
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const drawerOpen = pinned || hovered || focused;
	const reduceMotion = useReducedMotion();
	const launcherRef = useRef(null);

	const close = useCallback(() => {
		setOpen(false);
		// Send focus back where it came from, or a keyboard user is dropped at
		// the top of the document with no idea what just happened.
		launcherRef.current?.focus();
	}, []);

	const start = useCallback((game) => {
		setOpen(game);
		setPinned(false);
		setHovered(false);
		setFocused(false);
	}, []);

	// A 30-wide board on a phone scrolls inside its own container; the page
	// behind it must not scroll with it.
	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open]);

	const Active = open ? GAMES[open].Component : null;

	return (
		<>
			<div className="fixed top-4 right-4 z-50 flex items-center gap-2 sm:top-5 sm:right-6">
				{/* The drawer is driven by React state rather than `group-hover`,
				    because each row's entrance delay has to differ per row AND
				    reverse on the way out. A CSS-only version would keep the
				    delays on close too, so the last row would hang behind after
				    the pointer left — the thing that makes a stagger feel
				    expensive instead of quick. */}
				<div
					className="relative"
					onMouseEnter={() => setHovered(true)}
					onMouseLeave={() => setHovered(false)}
					// Focus and blur bubble in React, so this covers tabbing
					// through the rows without a focus-within media query. The
					// relatedTarget check keeps focus moving BETWEEN rows from
					// reading as leaving the drawer.
					onFocus={() => setFocused(true)}
					onBlur={(event) => {
						if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
					}}
				>
					<button
						ref={launcherRef}
						type="button"
						onClick={() => setPinned((on) => !on)}
						aria-haspopup="true"
						aria-expanded={drawerOpen}
						aria-label="Games"
						title="Games"
						className={`flex h-10 w-10 items-center justify-center rounded-full border border-gray-200/80 bg-white/70 shadow-lg shadow-gray-900/5 backdrop-blur-xl transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:border-gray-700/60 dark:bg-gray-800/70 dark:shadow-black/30 ${
							drawerOpen
								? "text-gray-700 dark:text-gray-300"
								: "text-gray-400 dark:text-gray-500"
						}`}
					>
						<Gamepad2
							className={`h-[18px] w-[18px] ${drawerOpen ? "scale-110" : "scale-100"}`}
							style={{
								transitionProperty: "transform, scale",
								transitionDuration: "300ms",
								transitionTimingFunction: "cubic-bezier(0.2, 1.3, 0.5, 1)",
							}}
							aria-hidden="true"
						/>
					</button>

					{/* pt-2 is the bridge: the wrapper begins flush with the button so
					    the pointer never crosses dead space, and the visible panel is
					    inset from it. */}
					{/* transition-property is set inline, not with a utility, and that
					    is not a style choice.
					    index.css carries an UNLAYERED `* { transition-property: … }`
					    rule listing only colour properties. Unlayered CSS outranks
					    anything in @layer utilities no matter its specificity, so
					    every Tailwind `transition-*` utility on this site loses to it
					    — opacity and transform were never transitioning here at all,
					    and the stagger below was being applied to properties that do
					    not animate. A style attribute is not in a layer either, and
					    beats both. See the note in index.css. */}
					<div
						className={`absolute top-full right-0 pt-2 ease-out ${
							drawerOpen
								? "pointer-events-auto translate-y-0 scale-100 opacity-100"
								: "pointer-events-none -translate-y-1 scale-[0.97] opacity-0"
						}`}
						style={{
							transformOrigin: "top right",
							transitionProperty: "opacity, transform, scale, translate",
							transitionDuration: "200ms",
							transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.3, 1)",
						}}
					>
						<div className="w-56 overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 p-1 shadow-xl shadow-gray-900/10 backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-800/90 dark:shadow-black/40">
							{Object.entries(GAMES).map(([key, game], row) => (
								<button
									key={key}
									type="button"
									onClick={() => start(key)}
									style={{
										// Dealt out one after the other on open; on close they
										// all leave together, because a staggered exit reads as
										// lag rather than polish.
										transitionDelay: drawerOpen ? `${60 + row * 70}ms` : "0ms",
										transitionProperty: "opacity, transform, translate, background-color",
										transitionDuration: "300ms",
										transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.3, 1)",
									}}
									className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-gray-900/5 focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:outline-none dark:hover:bg-white/10 ${
										drawerOpen
											? "translate-y-0 opacity-100"
											: "translate-y-2 opacity-0"
									}`}
								>
									<span
										style={{
											transitionDelay: drawerOpen ? `${90 + row * 70}ms` : "0ms",
											transitionProperty: "transform, scale",
											transitionDuration: "300ms",
											transitionTimingFunction: "cubic-bezier(0.2, 1.3, 0.5, 1)",
										}}
										className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 ${
											drawerOpen ? "scale-100" : "scale-75"
										}`}
									>
										<game.Icon className="h-4 w-4" aria-hidden="true" />
									</span>
									<span className="min-w-0">
										<span className="block text-xs font-medium text-gray-900 dark:text-white">
											{game.label}
										</span>
										<span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
											{game.hint}
										</span>
									</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<ThemeToggle />
			</div>

			<AnimatePresence>
				{open && (
					<motion.div
						initial={reduceMotion ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={reduceMotion ? undefined : { opacity: 0 }}
						transition={{ duration: 0.2 }}
						// Above NavBar's dock, which sets z-index: 100 in its own
						// style block and would otherwise float over the board.
						className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/30 p-3 backdrop-blur-sm sm:p-6 dark:bg-black/60"
						onClick={(event) => {
							if (event.target === event.currentTarget) close();
						}}
					>
						<motion.div
							role="dialog"
							aria-modal="true"
							aria-label={GAMES[open].label}
							initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
							transition={{ type: "spring", stiffness: 420, damping: 34 }}
							className="flex max-h-full w-full max-w-[min(100%,46rem)] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
						>
							<Suspense
								fallback={
									<p className="p-8 text-center text-xs text-gray-400">Loading…</p>
								}
							>
								<Active onClose={close} />
							</Suspense>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

export default TopControls;

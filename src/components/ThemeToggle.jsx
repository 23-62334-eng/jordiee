import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FiMonitor, FiSun, FiMoon } from "react-icons/fi";
import { useDarkMode } from "../context/DarkModeContext";

const OPTIONS = [
	{ value: "system", label: "System theme", Icon: FiMonitor },
	{ value: "light", label: "Light theme", Icon: FiSun },
	{ value: "dark", label: "Dark theme", Icon: FiMoon },
];

const REVEAL_MS = 550;

/**
 * Expands the new theme out of the button that was pressed, as a growing
 * circle, using the View Transitions API.
 *
 * The switch itself must happen synchronously inside startViewTransition, or
 * the browser snapshots the old DOM twice and nothing appears to change —
 * hence flushSync. Returns false when the API is unavailable so the caller can
 * fall back to a plain state update.
 */
function revealTheme(origin, commit) {
	if (!document.startViewTransition) return false;

	const rect = origin.getBoundingClientRect();
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;

	// Reach the furthest corner, or the circle stops short of the page edge.
	const radius = Math.hypot(
		Math.max(x, window.innerWidth - x),
		Math.max(y, window.innerHeight - y)
	);

	// The global `* { transition: background-color … }` rule would cross-fade
	// every element at the same time as the wipe, turning both to mush. Freeze
	// it for the duration so the circle is the only thing moving.
	document.documentElement.classList.add("theme-switching");

	const transition = document.startViewTransition(() => {
		flushSync(commit);
	});

	transition.ready
		.then(() => {
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${radius}px at ${x}px ${y}px)`,
					],
				},
				{
					duration: REVEAL_MS,
					easing: "cubic-bezier(0.4, 0, 0.2, 1)",
					pseudoElement: "::view-transition-new(root)",
				}
			);
		})
		.catch(() => {});

	transition.finished
		.catch(() => {})
		.finally(() => {
			document.documentElement.classList.remove("theme-switching");
		});

	return true;
}

function ThemeToggle() {
	const { theme, setTheme } = useDarkMode();
	const reduceMotion = useReducedMotion();
	const buttonsRef = useRef([]);

	const select = useCallback(
		(value, index) => {
			if (value === theme) return;

			const commit = () => setTheme(value);
			const origin = buttonsRef.current[index];

			// Reduced motion gets the theme, not the theatre.
			if (reduceMotion || !origin || !revealTheme(origin, commit)) commit();
		},
		[theme, setTheme, reduceMotion]
	);

	// Radiogroup semantics: these are one mutually exclusive choice, not three
	// independent toggles. That buys arrow-key navigation, which means only the
	// selected option sits in the tab order.
	const onKeyDown = useCallback(
		(event) => {
			const step =
				event.key === "ArrowRight" || event.key === "ArrowDown"
					? 1
					: event.key === "ArrowLeft" || event.key === "ArrowUp"
						? -1
						: 0;

			if (step === 0) return;
			event.preventDefault();

			const current = OPTIONS.findIndex((option) => option.value === theme);
			const next = (current + step + OPTIONS.length) % OPTIONS.length;

			buttonsRef.current[next]?.focus();
			select(OPTIONS[next].value, next);
		},
		[theme, select]
	);

	return (
		<div
			role="radiogroup"
			aria-label="Colour theme"
			onKeyDown={onKeyDown}
			className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50
				flex items-center gap-0.5 p-1
				rounded-full
				bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl
				border border-gray-200/80 dark:border-gray-700/60
				shadow-lg shadow-gray-900/5 dark:shadow-black/30"
		>
			{OPTIONS.map((option, index) => {
				const { value, label } = option;
				const active = theme === value;

				return (
					<button
						key={value}
						ref={(node) => {
							buttonsRef.current[index] = node;
						}}
						type="button"
						role="radio"
						aria-checked={active}
						aria-label={label}
						title={label}
						tabIndex={active ? 0 : -1}
						onClick={() => select(value, index)}
						className={`relative flex items-center justify-center
							w-8 h-8 rounded-full
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]
							${
								active
									// Pill is black in light / white in dark, so the
									// icon takes the opposite.
									? "text-white dark:text-gray-900"
									: "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
							}`}
					>
						{active && (
							// One indicator that slides between slots, rather than three
							// backgrounds fading in and out.
							<motion.span
								layoutId={reduceMotion ? undefined : "theme-indicator"}
								className="absolute inset-0 rounded-full bg-[rgb(var(--accent))]"
								transition={{ type: "spring", stiffness: 420, damping: 32 }}
							/>
						)}
						<option.Icon className="relative w-4 h-4" aria-hidden="true" />
					</button>
				);
			})}
		</div>
	);
}

export default ThemeToggle;

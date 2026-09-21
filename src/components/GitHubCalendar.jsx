import { useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion, useReducedMotion } from "framer-motion";

import useContributions from "../hooks/useContributions.js";
import { FIRST_CONTRIBUTION_YEAR, GITHUB_USERNAME } from "../lib/githubContributions.js";

const PROFILE_URL = `https://github.com/${GITHUB_USERNAME}`;

/* ── Geometry ─────────────────────────────────────────────────────────────
   Two fixed sizes, no fluid scaling: cells below ~8px stop reading as a grid.
   sm  → 26 columns at 8px/2px  = 260px, fits inside the About card at 375px.
   md/lg → 53 columns at 11px/3px = 742px, fits at ≥1024px, scrolls below.   */
const LAYOUT = {
	sm: { cell: 8, gap: 2 },
	md: { cell: 11, gap: 3 },
	lg: { cell: 11, gap: 3 },
};

// Every breakpoint renders the same 52 weeks. Small screens used to window
// down to 6 months to avoid a horizontal scroll, but selecting a year already
// scrolls there — so the only thing that bought was a headline number that
// disagreed with the same page on desktop.
const ROLLING_WEEKS = 53;
const ROLLING_LABEL = "the last year";

const WEEKDAY_COLUMN = 26;
const MONTH_ROW = 16;

/* ── Intensity ramp ───────────────────────────────────────────────────────
   Derived from --accent (index.css), not GitHub's green. Step 0 is a neutral
   surface with an inset ring rather than a 8%-accent tint: on the About card
   (bg-white/70) an 8% tint is invisible, and empty days have to read as
   structure. Step 4 is full accent — 3.68:1 on the light card, 6.14:1 on the
   dark one, both clear of the 3:1 non-text minimum.
   Static class strings so Tailwind's scanner can see them.                  */
const RAMP = [
	"bg-gray-200/80 dark:bg-gray-700/50 ring-1 ring-inset ring-gray-300/70 dark:ring-gray-600/40",
	"bg-[rgb(var(--accent)/0.30)]",
	"bg-[rgb(var(--accent)/0.52)]",
	"bg-[rgb(var(--accent)/0.76)]",
	"bg-[rgb(var(--accent))]",
];

/* ── Dates ────────────────────────────────────────────────────────────────
   Every date is handled in UTC. "2026-08-10" parses as UTC midnight, so a
   local getDay() west of Greenwich would report the previous weekday and
   shear the whole grid by one row.                                          */
function parseUTC(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat("en-US", {
	month: "short",
	timeZone: "UTC",
});

const monthYearFormat = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

/**
 * Buckets days 1–4 by quantile over ACTIVE days only.
 *
 * Quantiles across all 365 days would put every cutoff at 0 — roughly 85% of
 * this calendar is empty — and collapse the ramp to one tone, which is the
 * exact failure fixed thresholds already produce on a low-volume year.
 * Cutoffs are also deduped: with counts clustered on 1–4, raw quantiles
 * repeat, and a repeated cutoff silently merges two buckets.
 */
function makeLevelScale(days) {
	const active = days
		.map((d) => d.count)
		.filter((c) => c > 0)
		.sort((a, b) => a - b);

	if (active.length === 0) return () => 0;

	const quantile = (p) => active[Math.min(active.length - 1, Math.floor(p * active.length))];
	const cutoffs = [...new Set([quantile(0.25), quantile(0.5), quantile(0.75)])];
	const busiest = active[active.length - 1];

	return (count) => {
		if (count <= 0) return 0;
		// The busiest day always takes the top step: deduped cutoffs can leave
		// the ramp short, and step 4 is the only one that clears 3:1.
		if (count === busiest) return 4;

		let level = 1;
		for (const cutoff of cutoffs) if (count > cutoff) level += 1;
		return Math.min(level, 4);
	};
}

/**
 * Expands a selected year to the whole calendar year, Jan 1 – Dec 31.
 *
 * The data only spans account creation to today, so a raw slice renders 2023
 * as a stubby 22 columns starting in August and stops 2026 at today. GitHub
 * always draws a year at full width. Days with no data are marked `outside`:
 * they hold the grid's shape but carry no tooltip and count toward nothing,
 * because "no contributions on Dec 25, 2026" is a claim about a day that has
 * not happened.
 */
function buildYearDays(year, days) {
	const byDate = new Map(days.map((day) => [day.date, day]));
	const filled = [];

	const end = Date.UTC(Number(year), 11, 31);
	for (let t = Date.UTC(Number(year), 0, 1); t <= end; t += 86400000) {
		const date = new Date(t).toISOString().slice(0, 10);
		filled.push(byDate.get(date) ?? { date, count: 0, outside: true });
	}

	return filled;
}

function buildWeeks(days) {
	if (days.length === 0) return [];

	// Pad so row 0 is always Sunday; the first and last weeks are partial.
	const lead = parseUTC(days[0].date).getUTCDay();
	const cells = [...Array(lead).fill(null), ...days];
	while (cells.length % 7 !== 0) cells.push(null);

	const weeks = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return weeks;
}

function buildMonthLabels(weeks) {
	const labels = [];
	let previous = null;

	weeks.forEach((week, index) => {
		const day = week.find(Boolean);
		if (!day) return;

		const date = parseUTC(day.date);
		const month = date.getUTCMonth();
		if (month === previous) return;
		previous = month;

		// Drop a label that would sit on top of the previous one.
		const last = labels[labels.length - 1];
		if (last && index - last.index < 3) return;
		labels.push({ index, text: monthFormat.format(date) });
	});

	return labels;
}

function describe(day) {
	const when = dayFormat.format(parseUTC(day.date));
	if (day.count === 0) return `No contributions on ${when}`;
	return `${day.count} contribution${day.count === 1 ? "" : "s"} on ${when}`;
}

/* ── Viewport mode ────────────────────────────────────────────────────── */
const LG = "(min-width: 1024px)";
const SM = "(min-width: 640px)";

function currentMode() {
	if (typeof window === "undefined") return "lg";
	if (window.matchMedia(LG).matches) return "lg";
	if (window.matchMedia(SM).matches) return "md";
	return "sm";
}

function useViewportMode() {
	const [mode, setMode] = useState(currentMode);

	useEffect(() => {
		const queries = [window.matchMedia(LG), window.matchMedia(SM)];
		const update = () => setMode(currentMode());

		queries.forEach((q) => q.addEventListener("change", update));
		return () => queries.forEach((q) => q.removeEventListener("change", update));
	}, []);

	return mode;
}

/* ── Skeleton ─────────────────────────────────────────────────────────────
   Same column count, cell size and caption height as the real grid, so the
   swap to data moves nothing.                                               */
function Skeleton({ layout, mode }) {
	const block = "bg-gray-200/70 dark:bg-gray-700/40";

	// Mirrors the year filter's placement so it does not jump sides on load.
	const filter = (
		<div
			className={
				mode === "sm"
					? "mb-2 flex flex-wrap gap-1"
					: "flex flex-col gap-1 shrink-0 w-[84px]"
			}
		>
			{Array.from({ length: 5 }, (_, i) => (
				<div
					key={i}
					className={`h-[30px] rounded-md ${mode === "sm" ? "w-16" : "w-full"} ${block}`}
				/>
			))}
		</div>
	);

	return (
		<div aria-hidden="true" className="animate-pulse">
			<div className="flex items-start gap-3 sm:gap-4">
				<div className="min-w-0 flex-1">
					<div className={`mb-2 h-5 w-60 max-w-full rounded ${block}`} />
					<div className={`mb-3 h-4 w-64 max-w-full rounded ${block}`} />

					{mode === "sm" && filter}

					<div className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-3 sm:p-4">
						<div style={{ height: MONTH_ROW }} />
						<div className="flex" style={{ gap: layout.gap }}>
							<div style={{ width: WEEKDAY_COLUMN }} />
							{Array.from({ length: ROLLING_WEEKS }, (_, week) => (
								<div key={week} className="flex flex-col" style={{ gap: layout.gap }}>
									{Array.from({ length: 7 }, (_, day) => (
										<div
											key={day}
											className={`rounded-sm ${block}`}
											style={{ width: layout.cell, height: layout.cell }}
										/>
									))}
								</div>
							))}
						</div>
						<div className={`mt-3 ml-auto h-4 w-32 rounded ${block}`} />
					</div>
				</div>

				{mode !== "sm" && filter}
			</div>
		</div>
	);
}

/* ── Calendar ─────────────────────────────────────────────────────────── */
function GitHubCalendar() {
	const mode = useViewportMode();
	const reduceMotion = useReducedMotion();

	const scrollerRef = useRef(null);
	const [tooltip, setTooltip] = useState(null);
	// null = the rolling window ending today; otherwise a calendar year.
	const [year, setYear] = useState(null);
	const { status, days, checkedAt, savedAt } = useContributions(year);
	const isLoading = status === "loading";

	const layout = LAYOUT[mode];
	const column = layout.cell + layout.gap;

	const currentYear = new Date().getUTCFullYear();
	const years = useMemo(() => Array.from(
		{ length: currentYear - FIRST_CONTRIBUTION_YEAR + 1 },
		(_, index) => String(currentYear - index)
	), [currentYear]);

	const model = useMemo(() => {
		if (!days || days.length === 0) return null;

		const scoped = year ? buildYearDays(year, days) : days;
		if (scoped.length === 0) return null;

		const allWeeks = buildWeeks(scoped);

		// The scale is built from the full extent of whatever is selected — the
		// widest window any breakpoint renders — so a day keeps its colour
		// across breakpoints, while each year still gets its own gradient
		// rather than being flattened by a busier one.
		const scaleWeeks = year ? allWeeks : allWeeks.slice(-ROLLING_WEEKS);
		const level = makeLevelScale(scaleWeeks.flat().filter(Boolean));

		// Preserve GitHub's rolling range; selected years show the full Jan–Dec grid.
		const weeks = year ? allWeeks : allWeeks.slice(-ROLLING_WEEKS);
		// Padding days and out-of-range days are structure, not data: they must
		// not reach the total or the monthly summary.
		const visible = weeks.flat().filter((day) => day && !day.outside);

		// Count only the days represented by this view.
		const total = visible.reduce((sum, day) => sum + day.count, 0);

		const months = new Map();
		for (const day of visible) {
			const key = monthYearFormat.format(parseUTC(day.date));
			months.set(key, (months.get(key) ?? 0) + day.count);
		}

		return {
			weeks,
			level,
			total,
			labels: buildMonthLabels(weeks),
			summary: [...months]
				.map(
					([month, count]) =>
						`${month}, ${count} contribution${count === 1 ? "" : "s"}`
				)
				.join(". "),
		};
	}, [days, year]);

	// Start scrolled to today. Assigning scrollLeft directly rather than using
	// scrollIntoView, which would also scroll the page to reach this element.
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (scroller) scroller.scrollLeft = scroller.scrollWidth;
	}, [mode, year, isLoading]);

	if (status === "error") return (
		<p role="status" className="text-xs text-gray-500 dark:text-gray-400">
			GitHub activity is temporarily unavailable. Retrying automatically.{" "}
			<a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
				View on GitHub
			</a>
			{year && <button type="button" onClick={() => setYear(null)} className="ml-3 underline underline-offset-2">Back to last year</button>}
		</p>
	);
	if (status === "loading") return <Skeleton layout={layout} mode={mode} />;
	if (!model) return null;

	const gridWidth = model.weeks.length * column - layout.gap;
	const isEmpty = model.total === 0;

	const scope = year ?? ROLLING_LABEL;
	const caption = isEmpty
		? `No contributions in ${scope}`
		: `${model.total} contribution${model.total === 1 ? "" : "s"} in ${scope}`;
	const tooltipDay = tooltip && days.find((day) => day.date === tooltip.date);

	/* Accessibility: option (b) — one focusable region plus a text equivalent.
	   Roving tabindex over 365 cells is 365 tab stops of "1 contribution on
	   Tuesday", which is noise, not access. The information here is the shape
	   of the year, so the hidden summary is month-by-month. Consequence, stated
	   plainly: there is no per-cell focus tooltip, because there are no
	   focusable cells — the tooltip is a pointer affordance only. */
	const gridMotion = reduceMotion
		? {}
		: {
				variants: { hidden: {}, visible: { transition: { staggerChildren: 0.006 } } },
				initial: "hidden",
				whileInView: "visible",
				viewport: { once: true, amount: 0.2 },
			};

	const columnMotion = reduceMotion
		? {}
		: {
				variants: {
					hidden: { opacity: 0, scale: 0.85 },
					visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
				},
			};

	/* Year filter. aria-pressed rather than a radiogroup: these are toggles
	   over one view, and buttons keep every option reachable with plain Tab
	   rather than arrow keys. Rendered as a rail beside the grid on desktop
	   and as a wrapping row above it on phones, where a rail would eat the
	   width the grid needs. */
	const yearFilter = (
		<div
			role="group"
			aria-label="Filter contributions by year"
			className={
				mode === "sm"
					? "mb-2 flex flex-wrap items-center gap-1"
					: "flex flex-col gap-1 shrink-0 w-[84px]"
			}
		>
			{[null, ...years].map((option) => {
				const active = year === option;

				return (
					<button
						key={option ?? "rolling"}
						type="button"
						onClick={() => setYear(option)}
						aria-pressed={active}
						className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200
							focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]
							${mode === "sm" ? "" : "text-left"}
							${
								active
									// blue-600 in light / accent in dark, and the text colour
									// flips with it: white on the light accent is only 2.5:1.
									? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
									: "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50"
							}`}
					>
						{option ?? "Last year"}
					</button>
				);
			})}
		</div>
	);

	const grid = (
		<div className="flex" style={{ gap: layout.gap }}>
				{/* Weekday labels sit outside the scroller so they stay put. */}
				<div
					className="flex flex-col shrink-0"
					style={{ gap: layout.gap, width: WEEKDAY_COLUMN, paddingTop: MONTH_ROW }}
				>
					{["", "Mon", "", "Wed", "", "Fri", ""].map((label, row) => (
						<div
							key={row}
							aria-hidden="true"
							className="flex items-center text-[9px] leading-none text-gray-400 dark:text-gray-500"
							style={{ height: layout.cell }}
						>
							{label}
						</div>
					))}
				</div>

				<div
					ref={scrollerRef}
					// Only the desktop rolling view is guaranteed to fit. A selected
					// year is always 53 columns, which overflows below 1024px —
					// including small screens, where the rolling view alone is
					// narrow enough to sit still.
					className={`min-w-0 overscroll-x-contain ${
						mode === "lg" ? "overflow-hidden" : "overflow-x-auto"
					}`}
				>
					<div style={{ width: gridWidth }}>
						{/* Month labels scroll with the columns they name. */}
						<div className="relative" style={{ height: MONTH_ROW }}>
							{model.labels.map((label) => (
								<span
									key={`${label.text}-${label.index}`}
									aria-hidden="true"
									className="absolute top-0 text-[10px] leading-none text-gray-400 dark:text-gray-500"
									style={{ left: label.index * column }}
								>
									{label.text}
								</span>
							))}
						</div>

						<Motion.div
							{...gridMotion}
							role="img"
							tabIndex={0}
							aria-label={caption}
							className="flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
							style={{ gap: layout.gap }}
							// Delegated so 371 cells do not each carry listeners.
							onPointerOver={(event) => {
								const cell = event.target.closest?.("[data-label]");
								if (!cell) return;
								const rect = cell.getBoundingClientRect();
								setTooltip({
									date: cell.dataset.date,
									x: rect.left + rect.width / 2,
									y: rect.top,
								});
							}}
							onPointerLeave={() => setTooltip(null)}
						>
							{model.weeks.map((week, index) => (
								<Motion.div
									key={index}
									{...columnMotion}
									className="flex flex-col"
									style={{ gap: layout.gap }}
								>
									{week.map((day, row) => {
										// Partial first/last week, or a day outside the account's
										// lifetime — holds the row's shape, claims nothing.
										if (!day || day.outside) {
											return (
												<div
													key={day ? day.date : `pad-${row}`}
													style={{ width: layout.cell, height: layout.cell }}
												/>
											);
										}

										return (
											<div
												key={day.date}
												data-date={day.date}
												data-label={describe(day)}
												className={`rounded-sm ${RAMP[day.level ?? model.level(day.count)]}`}
												style={{ width: layout.cell, height: layout.cell }}
											/>
										);
									})}
								</Motion.div>
							))}
						</Motion.div>
					</div>
				</div>
			</div>

	);

	return (
		<figure className="m-0">
			<div className="flex items-start gap-3 sm:gap-4">
				<div className="min-w-0 flex-1">
					<figcaption className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
						{caption} on GitHub
					</figcaption>

					<div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
						<p role="status">
							{status === "stale"
								? `Showing saved activity${savedAt && !Number.isNaN(Date.parse(savedAt)) ? ` from ${new Date(savedAt).toLocaleDateString()}` : ""}. Retrying automatically.`
								: `Auto-syncs every minute${checkedAt ? ` · Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}`}
						</p>
						<a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 underline underline-offset-2 hover:text-gray-900 dark:hover:text-white">
							View on GitHub
						</a>
					</div>

					{mode === "sm" && yearFilter}

					<div className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-3 sm:p-4">
						{grid}

						<div
							aria-hidden="true"
							className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-gray-400 dark:text-gray-500"
						>
							<span>Less</span>
							{RAMP.map((step, index) => (
								<span
									key={index}
									className={`rounded-sm ${step}`}
									style={{ width: layout.cell, height: layout.cell }}
								/>
							))}
							<span>More</span>
						</div>
					</div>
				</div>

				{mode !== "sm" && yearFilter}
			</div>

			{/* The text equivalent, as real navigable text rather than a 13-clause
			    aria-label read as one unbroken blob. Month granularity is the
			    signal here; per-day would be 365 sentences of noise. */}
			<p className="sr-only">Monthly totals: {model.summary}.</p>

			{/* Tooltip is fixed-position and lives outside the scroller, so it
			    cannot be clipped by overflow-x-auto at the container edges. */}
			{tooltipDay && (
				<div
					role="tooltip"
					className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg
						bg-gray-900/95 dark:bg-gray-700/95 px-2.5 py-1.5
						text-[11px] font-medium text-white shadow-lg"
					style={{
						left: Math.min(Math.max(tooltip.x, 80), window.innerWidth - 80),
						top: tooltip.y - 8,
					}}
				>
					{describe(tooltipDay)}
				</div>
			)}
		</figure>
	);
}

export default GitHubCalendar;

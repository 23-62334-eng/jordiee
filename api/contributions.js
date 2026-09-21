import { GITHUB_USERNAME } from "../src/lib/githubContributions.js";

/**
 * The contribution calendar, read straight from GitHub.
 *
 * Why this endpoint exists: the site used to read the calendar from
 * github-contributions-api.jogruber.de. That service is fine, but it answers
 * from a server-side cache up to an hour old, so someone who pushed a commit
 * and then opened this page saw a grid that did not contain it and reasonably
 * concluded the page was broken. `cache: "no-store"` on the browser side can
 * never fix that, because the staleness is upstream of the browser.
 *
 * This reads the same HTML fragment github.com renders for its own profile
 * graph. GitHub serves it `max-age=0, private, must-revalidate` — it is never
 * stale — so a push is visible here as soon as GitHub has counted it.
 *
 * TRUST BOUNDARY. The upstream is scraped HTML, not a versioned API, so it is
 * parsed defensively and then CHECKED AGAINST GITHUB'S OWN HEADLINE TOTAL: the
 * counts we read out of the grid must add up to the number GitHub printed
 * above it. A parse that does not reconcile is treated as a failure and
 * answered with 502, never with a number that is merely plausible. The client
 * already degrades to public/contributions.json when a fetch fails, so the
 * worst case of a GitHub markup change is the page saying "showing saved
 * activity" — not the page confidently showing a wrong count.
 *
 * NOTE ON WHAT IS VISIBLE. This returns whatever the account publishes.
 * Contributions to private repositories are only included once the profile's
 * "Contribution settings -> Private contributions" is enabled; until then
 * GitHub itself reports the public-only total here and so do we.
 */

const SOURCE = `https://github.com/users/${GITHUB_USERNAME}/contributions`;
const UPSTREAM_TIMEOUT_MS = 10_000;
const EARLIEST_YEAR = 2008;

// Long enough that a burst of visitors cannot turn one push into thousands of
// requests to github.com; short enough that a commit lands on the page while
// the person who pushed it is still looking at it.
const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

const attribute = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

/** "No contributions on ..." and "1,024 contributions on ..." both count. */
function readCount(text) {
	const match = /^\s*(no|[\d,]+)\s+contribution/i.exec(text);
	if (!match) return null;
	const value = match[1].toLowerCase();
	return value === "no" ? 0 : Number(value.replace(/,/g, ""));
}

/** The figure GitHub prints above the grid, which every parse is reconciled against. */
function headlineTotal(html) {
	const match = /(No|[\d,]+)\s+contributions?\s+in\s+(?:the\s+last\s+year|\d{4})/i.exec(html);
	if (!match) return null;
	const value = match[1].toLowerCase();
	return value === "no" ? 0 : Number(value.replace(/,/g, ""));
}

/**
 * Counts live in <tool-tip> elements keyed to each cell's id, not on the cell
 * itself, so the grid is read in two passes. A year request is trimmed to that
 * year first: GitHub pads the grid with the adjacent years' days to square off
 * the first and last weeks, and those days are not in its headline total.
 */
export function parseCalendar(html, year = null) {
	const tooltips = new Map();
	for (const [, id, text] of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g)) {
		tooltips.set(id, text);
	}

	const days = [];
	for (const [tag] of html.matchAll(/<td\b[^>]*>/g)) {
		if (!tag.includes("ContributionCalendar-day")) continue;
		const date = attribute(tag, "data-date");
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
		if (year !== null && !date.startsWith(`${year}-`)) continue;

		const id = tag.match(/\sid="([^"]+)"/)?.[1];
		const count = id === undefined ? null : readCount(tooltips.get(id) ?? "");
		if (count === null || !Number.isSafeInteger(count) || count < 0) {
			throw new Error(`No readable contribution count for ${date}`);
		}
		const level = Number(attribute(tag, "data-level"));
		days.push(Number.isInteger(level) && level >= 0 && level <= 4
			? { date, count, level }
			: { date, count });
	}

	if (days.length === 0) throw new Error("GitHub returned no contribution days");

	const total = days.reduce((sum, day) => sum + day.count, 0);
	const headline = headlineTotal(html);
	if (headline === null) throw new Error("GitHub printed no headline total to reconcile against");
	if (headline !== total) throw new Error(`Read ${total} contributions, GitHub reported ${headline}`);

	// GitHub emits the grid row-major (all Sundays, then all Mondays), so the
	// cells arrive out of order. Sort here rather than leaving every consumer
	// to discover that the last element is not the most recent day.
	days.sort((a, b) => a.date.localeCompare(b.date));
	return { days, total };
}

function send(res, status, body, headers = {}) {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
	res.end(JSON.stringify(body));
}

/** Plain Node req/res only, so the same handler runs on Vercel and under `vite dev`. */
export default async function handler(req, res) {
	if (req.method !== "GET" && req.method !== "HEAD") {
		return send(res, 405, { error: "Method not allowed" }, { Allow: "GET, HEAD" });
	}

	const requested = new URL(req.url || "/", "http://localhost").searchParams.get("y") ?? "last";
	let year = null;
	if (requested !== "last") {
		if (!/^\d{4}$/.test(requested)) return send(res, 400, { error: "Invalid year" });
		year = Number(requested);
		if (year < EARLIEST_YEAR || year > new Date().getUTCFullYear() + 1) {
			return send(res, 400, { error: "Year out of range" });
		}
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
	try {
		const upstream = await fetch(
			year === null ? SOURCE : `${SOURCE}?from=${year}-01-01&to=${year}-12-31`,
			{
				signal: controller.signal,
				headers: {
					Accept: "text/html",
					"User-Agent": `${GITHUB_USERNAME}-portfolio (+https://github.com/${GITHUB_USERNAME})`,
					"X-Requested-With": "XMLHttpRequest",
				},
			},
		);
		if (!upstream.ok) return send(res, 502, { error: `GitHub responded ${upstream.status}` });

		const { days, total } = parseCalendar(await upstream.text(), year);
		return send(res, 200, {
			contributions: days,
			total: year === null ? { lastYear: total } : { [year]: total },
		}, { "Cache-Control": CACHE_CONTROL });
	} catch (error) {
		const timedOut = error.name === "AbortError";
		return send(res, timedOut ? 504 : 502, {
			error: timedOut ? "GitHub timed out" : "Could not read the contribution graph",
		});
	} finally {
		clearTimeout(timeout);
	}
}

export const GITHUB_USERNAME = "Jordieeeee";
export const FIRST_CONTRIBUTION_YEAR = 2023;
export const REFRESH_INTERVAL_MS = 60_000;
export const REQUEST_TIMEOUT_MS = 15_000;

// Served by api/contributions.js, which reads github.com directly. The public
// aggregator this replaced answered from a cache up to an hour old, so a commit
// pushed a minute ago could not appear here however the browser asked for it.
const API_URL = "/api/contributions";
const DAY_MS = 86_400_000;

/** Accept either the live API response or the checked-in offline snapshot. */
export function normalizeContributions(payload) {
	const rows = payload?.contributions ?? payload?.days;
	if (!Array.isArray(rows) || rows.length === 0) {
		throw new Error("Contribution data is missing or empty");
	}

	const byDate = new Map();
	for (const row of rows) {
		const date = row?.date;
		const timestamp = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
			? Date.parse(`${date}T00:00:00Z`)
			: NaN;
		if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
			throw new Error("Contribution data contains an invalid date");
		}
		if (!Number.isSafeInteger(row.count) || row.count < 0) {
			throw new Error("Contribution data contains an invalid count");
		}
		if (row.level !== undefined && (!Number.isInteger(row.level) || row.level < 0 || row.level > 4)) {
			throw new Error("Contribution data contains an invalid level");
		}

		const day = { date, count: row.count };
		if (row.level !== undefined) day.level = row.level;
		const existing = byDate.get(date);
		if (existing && (existing.count !== day.count || existing.level !== day.level)) {
			throw new Error("Contribution data contains conflicting dates");
		}
		byDate.set(date, day);
	}

	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A live y=last response already has GitHub's range. For an older snapshot,
 * retain 53 Sunday-based columns ending at its latest known day; never add
 * zero-count days that would claim the snapshot is current.
 */
export function selectContributionDays(days, year = null) {
	if (year !== null) {
		return days.filter((day) => day.date.startsWith(`${year}-`));
	}
	if (days.length === 0) return [];

	const end = new Date(`${days[days.length - 1].date}T00:00:00Z`);
	const start = new Date(end.getTime() - (52 * 7 + end.getUTCDay()) * DAY_MS)
		.toISOString().slice(0, 10);
	return days.filter((day) => day.date >= start);
}

/** The caller owns request cancellation and the timeout lifecycle. */
export async function fetchContributions(year = null, { signal, fresh = false } = {}) {
	if (year !== null && !/^\d{4}$/.test(String(year))) {
		throw new Error("Invalid contribution year");
	}
	const options = { cache: "no-store", signal };
	if (fresh) options.headers = { "Cache-Control": "no-cache" };
	const response = await fetch(`${API_URL}?y=${year ?? "last"}`, options);
	if (!response.ok) {
		throw new Error(`Contribution request failed (${response.status})`);
	}
	const today = new Date().toISOString().slice(0, 10);
	const days = normalizeContributions(await response.json())
		.filter((day) => day.date <= today && (year === null || day.date.startsWith(`${year}-`)));
	if (days.length === 0) {
		throw new Error("Contribution data has no days in the requested period");
	}
	return days;
}

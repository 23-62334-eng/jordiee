#!/usr/bin/env node
/**
 * Refreshes public/contributions.json, the grid the page falls back to when
 * GitHub and the endpoint are both unreachable.
 *
 * It parses with api/contributions.js's own parser, so the fallback can never
 * disagree with the live path about what GitHub said. Run it whenever the
 * profile's contribution visibility changes -- a snapshot taken under different
 * settings is worse than no snapshot, because the page presents it as fact.
 */
import { writeFileSync } from "node:fs";
import { parseCalendar } from "../api/contributions.js";
import { GITHUB_USERNAME, FIRST_CONTRIBUTION_YEAR } from "../src/lib/githubContributions.js";

const SOURCE = `https://github.com/users/${GITHUB_USERNAME}/contributions`;
const OUT = "public/contributions.json";

const years = Array.from(
	{ length: new Date().getUTCFullYear() - FIRST_CONTRIBUTION_YEAR + 1 },
	(_, index) => FIRST_CONTRIBUTION_YEAR + index,
);

const byDate = new Map();
for (const year of years) {
	const response = await fetch(`${SOURCE}?from=${year}-01-01&to=${year}-12-31`, {
		headers: { Accept: "text/html", "User-Agent": `${GITHUB_USERNAME}-portfolio` },
	});
	if (!response.ok) throw new Error(`${year}: GitHub responded ${response.status}`);
	const { days, total } = parseCalendar(await response.text(), year);
	for (const day of days) byDate.set(day.date, day);
	console.log(`${year}: ${String(total).padStart(4)} contributions across ${days.length} days`);
}

const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), days }, null, "\t")}\n`);
console.log(`\nWrote ${OUT}: ${days.length} days, ${days.reduce((sum, d) => sum + d.count, 0)} contributions total`);

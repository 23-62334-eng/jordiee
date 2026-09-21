import test from "node:test";
import assert from "node:assert/strict";
import handler, { parseCalendar } from "../api/contributions.js";

/** Reproduces the shape github.com actually serves: counts live in <tool-tip>, not on the cell. */
function calendar(days, { headline, period = "the last year" } = {}) {
	const total = headline ?? days.reduce((sum, day) => sum + day.count, 0);
	const cells = days.map((day, index) => {
		const id = `contribution-day-component-0-${index}`;
		const label = day.count === 0 ? "No contributions" : `${day.count} contribution${day.count === 1 ? "" : "s"}`;
		return {
			cell: `<td tabindex="0" data-ix="${index}" aria-selected="false" aria-describedby="contribution-graph-legend-level-${day.level}" style="width: 10px" data-date="${day.date}" id="${id}" data-level="${day.level}" role="gridcell" data-view-component="true" class="ContributionCalendar-day">`,
			tip: day.tip === false ? "" : `<tool-tip style="pointer-events: none;" id="tooltip-${index}" for="${id}" popover="manual" data-direction="n" data-type="label" data-view-component="true" class="sr-only position-absolute">${label} on ${day.date}.</tool-tip>`,
		};
	});
	return `<div><h2>${total === 0 ? "No" : total}\n      contributions\n        in ${period}</h2>`
		+ `<table>${cells.map((c) => c.cell).join("")}</table>${cells.map((c) => c.tip).join("")}</div>`;
}

const day = (date, count, level = 0) => ({ date, count, level });

test("reads counts and levels out of the grid GitHub renders", () => {
	const { days, total } = parseCalendar(calendar([
		day("2026-09-19", 12, 4), day("2026-09-20", 0, 0), day("2026-09-21", 3, 2),
	]));
	assert.deepEqual(days, [
		{ date: "2026-09-19", count: 12, level: 4 },
		{ date: "2026-09-20", count: 0, level: 0 },
		{ date: "2026-09-21", count: 3, level: 2 },
	]);
	assert.equal(total, 15);
});

test("refuses a parse that does not reconcile with GitHub's own headline total", () => {
	// The failure this exists to catch: markup drifts, some cells stop being
	// read, and the page quietly reports a total that is merely plausible.
	assert.throws(
		() => parseCalendar(calendar([day("2026-09-19", 12, 4), day("2026-09-20", 5, 3)], { headline: 99 })),
		/Read 17 contributions, GitHub reported 99/,
	);
});

test("refuses a cell whose count cannot be read rather than counting it as zero", () => {
	assert.throws(
		() => parseCalendar(calendar([{ ...day("2026-09-19", 12, 4), tip: false }])),
		/No readable contribution count for 2026-09-19/,
	);
});

test("a year request drops the adjacent-year days GitHub pads the grid with", () => {
	const html = calendar([
		day("2024-12-29", 7, 3), day("2025-01-01", 4, 2), day("2025-12-31", 6, 3), day("2026-01-01", 9, 4),
	], { headline: 10, period: "2025" });
	const { days, total } = parseCalendar(html, 2025);
	assert.deepEqual(days.map((d) => d.date), ["2025-01-01", "2025-12-31"]);
	assert.equal(total, 10);
});

test("an empty year is a real answer, not a failure", () => {
	const { total } = parseCalendar(calendar([day("2024-01-01", 0, 0)], { period: "2024" }), 2024);
	assert.equal(total, 0);
});

test("rejects markup with no grid or no headline to check against", () => {
	assert.throws(() => parseCalendar("<div>nothing here</div>"), /no contribution days/);
	assert.throws(
		() => parseCalendar('<table><td data-date="2026-09-19" id="x" data-level="0" class="ContributionCalendar-day"></table><tool-tip for="x">2 contributions on 2026-09-19.</tool-tip>'),
		/no headline total/,
	);
});

function invoke(req) {
	const res = { statusCode: 0, headers: {}, body: "" };
	res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
	res.end = (body) => { res.body = body; };
	return handler(req, res).then(() => ({ ...res, json: res.body ? JSON.parse(res.body) : null }));
}

test("rejects bad input before reaching GitHub", async () => {
	assert.equal((await invoke({ method: "POST", url: "/api/contributions" })).statusCode, 405);
	assert.equal((await invoke({ method: "GET", url: "/api/contributions?y=nope" })).statusCode, 400);
	assert.equal((await invoke({ method: "GET", url: "/api/contributions?y=1999" })).statusCode, 400);
	assert.equal((await invoke({ method: "GET", url: `/api/contributions?y=${new Date().getUTCFullYear() + 5}` })).statusCode, 400);
});

test("a GitHub outage is a 502 with no body pretending to be data", async (t) => {
	t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
	const response = await invoke({ method: "GET", url: "/api/contributions?y=last" });
	assert.equal(response.statusCode, 502);
	assert.equal(response.json.contributions, undefined);
});

test("serves a short shared cache so one push cannot become a stampede on github.com", async (t) => {
	const html = calendar([day("2026-09-19", 12, 4)]);
	t.mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200, text: async () => html }));
	const response = await invoke({ method: "GET", url: "/api/contributions?y=last" });
	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.json.total, { lastYear: 12 });
	assert.match(response.headers["cache-control"], /s-maxage=30/);
});

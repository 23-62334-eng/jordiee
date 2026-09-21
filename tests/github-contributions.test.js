import test from "node:test";
import assert from "node:assert/strict";
import {
	fetchContributions,
	normalizeContributions,
	selectContributionDays,
} from "../src/lib/githubContributions.js";

function dateRange(from, to) {
	const days = [];
	for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) {
		days.push({ date: new Date(time).toISOString().slice(0, 10), count: 0 });
	}
	return days;
}

test("normalizes live counts and GitHub levels without mutating the payload", () => {
	const payload = { contributions: [
		{ date: "2026-09-19", count: 12, level: 4, ignored: true },
		{ date: "2026-09-18", count: 0, level: 0 },
		{ date: "2026-09-19", count: 12, level: 4 },
	] };
	const original = structuredClone(payload);
	const days = normalizeContributions(payload);
	assert.deepEqual(days, [
		{ date: "2026-09-18", count: 0, level: 0 },
		{ date: "2026-09-19", count: 12, level: 4 },
	]);
	assert.equal(days.reduce((total, day) => total + day.count, 0), 12);
	assert.deepEqual(payload, original);
});

test("accepts the offline snapshot and real leap days", () => {
	assert.deepEqual(normalizeContributions({ days: [{ date: "2024-02-29", count: 3 }] }), [
		{ date: "2024-02-29", count: 3 },
	]);
});

test("rejects malformed or empty responses instead of showing false zero counts", () => {
	for (const payload of [null, {}, { contributions: [] }, { days: [] }, { contributions: "error" }]) {
		assert.throws(() => normalizeContributions(payload));
	}
	for (const row of [
		null,
		{ date: "2026-02-29", count: 0 },
		{ date: "2026-09-31", count: 0 },
		{ date: "2026-9-19", count: 0 },
		{ date: "2026-09-19T00:00:00Z", count: 0 },
		{ date: "2026-09-19" },
		{ date: "2026-09-19", count: "12" },
		{ date: "2026-09-19", count: -1 },
		{ date: "2026-09-19", count: 1.5 },
		{ date: "2026-09-19", count: Infinity },
		{ date: "2026-09-19", count: 1, level: 5 },
		{ date: "2026-09-19", count: 1, level: null },
	]) {
		assert.throws(() => normalizeContributions({ contributions: [row] }));
	}
	assert.throws(() => normalizeContributions({ contributions: [
		{ date: "2026-09-19", count: 1 },
		{ date: "2026-09-19", count: 2 },
	] }), /conflicting/);
});

test("preserves all 371 days in GitHub's live rolling range", () => {
	const upstream = dateRange("2025-09-14", "2026-09-19");
	assert.equal(upstream.length, 371);
	assert.deepEqual(selectContributionDays(upstream), upstream);
});

test("historical snapshots retain 53 calendar columns anchored to their own last day", () => {
	const snapshot = dateRange("2023-08-11", "2026-08-14");
	const selected = selectContributionDays(snapshot);
	assert.equal(selected[0].date, "2025-08-10");
	assert.equal(selected.at(-1).date, "2026-08-14");
	assert.equal(selected.length, 370);
	assert.deepEqual(selectContributionDays(snapshot, 2024), dateRange("2024-01-01", "2024-12-31"));
	assert.deepEqual(selectContributionDays(snapshot, "2023"), dateRange("2023-08-11", "2023-12-31"));
	assert.deepEqual(selectContributionDays([], 2026), []);
	assert.deepEqual(selectContributionDays([]), []);
});

test("live fetch requests the selected GitHub period without browser cache and supports cancellation", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-09-19T12:00:00Z") });
	const controller = new AbortController();
	const upstream = { contributions: [{ date: "2026-09-19", count: 7, level: 3 }] };
	const fetchMock = t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => upstream }));
	assert.deepEqual(await fetchContributions(null, { signal: controller.signal }), upstream.contributions);
	assert.deepEqual(fetchMock.mock.calls[0].arguments, [
		"/api/contributions?y=last",
		{ cache: "no-store", signal: controller.signal },
	]);

	fetchMock.mock.mockImplementation(async () => ({
		ok: true,
		json: async () => ({ contributions: [{ date: "2024-01-01", count: 1, level: 1 }] }),
	}));
	await fetchContributions(2024, { fresh: true, signal: controller.signal });
	assert.deepEqual(fetchMock.mock.calls[1].arguments, [
		"/api/contributions?y=2024",
		{ cache: "no-store", signal: controller.signal, headers: { "Cache-Control": "no-cache" } },
	]);
});

test("current-year responses exclude future days and dates outside the requested year", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-09-19T23:59:59Z") });
	const contributions = [
		{ date: "2025-12-31", count: 5, level: 2 },
		{ date: "2026-01-01", count: 2, level: 1 },
		{ date: "2026-09-19", count: 7, level: 3 },
		{ date: "2026-09-20", count: 0, level: 0 },
		{ date: "2026-12-31", count: 0, level: 0 },
		{ date: "2027-01-01", count: 0, level: 0 },
	];
	t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ contributions }) }));
	assert.deepEqual(await fetchContributions(2026), contributions.slice(1, 3));
	assert.deepEqual(await fetchContributions(2025), contributions.slice(0, 1));
	assert.deepEqual(await fetchContributions(), contributions.slice(0, 3));
	assert.deepEqual(normalizeContributions({ contributions }), contributions);
	await assert.rejects(fetchContributions(2027), /no days/);
});

test("live request rejects HTTP, JSON, and invalid payload failures", async (t) => {
	const fetchMock = t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
	await assert.rejects(fetchContributions(), /503/);
	fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => JSON.parse("invalid") }));
	await assert.rejects(fetchContributions(), SyntaxError);
	fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ contributions: [] }) }));
	await assert.rejects(fetchContributions(), /empty/);
	await assert.rejects(fetchContributions("2024&y=all"), /Invalid contribution year/);
});

/**
 * Static retrieval accuracy + latency.
 *
 * Design note on why this set looks the way it does: the failure mode for a
 * retrieval test set is that every query contains a literal keyword from its
 * target section, so fuzzy search scores ~100% and tells you nothing about the
 * queries real visitors type. Each case is therefore tagged with a difficulty
 * tier and accuracy is reported PER TIER. A headline number is allowed to look
 * good only if the hard tiers actually hold up.
 *
 *   exact       query contains the target's own words          (sanity floor)
 *   paraphrase  same intent, reworded                          (should be easy)
 *   vocab-gap   little or no lexical overlap with the target   (the real test)
 *   typo        misspelled — fuzzy matching earns its keep here
 *
 * Every `expectedSectionId` is a section that must exist in profile.json;
 * `assertVocabularyCovered` fails the run if the data and this set drift apart.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
	SECTION_IDS,
	loadProfile,
	loadRetriever,
	assertVocabularyCovered,
	percentile,
} from "./_contract.js";

/** How many times each query is re-run when sampling latency. */
const LATENCY_ITERATIONS = Number(process.env.LATENCY_ITERATIONS ?? 50);
const WARMUP_ITERATIONS = 20;

const THRESHOLDS = {
	top1Overall: 0.9,
	// Deliberately lower: vocab-gap is where fuzzy search legitimately struggles.
	// Set low enough to be achievable, high enough that a keyword-only matcher
	// (which would score ~0 here) cannot pass.
	top1VocabGap: 0.75,
	top1Typo: 0.75,
	p95Ms: 25,
};

/** @type {{query: string, expectedSectionId: string, tier: string, why: string}[]} */
export const RETRIEVAL_CASES = [
	// ── Projects (12) ──────────────────────────────────────────────────────
	{ query: "tell me about the capstone project", expectedSectionId: "project-capstone", tier: "exact", why: "literal 'capstone'" },
	{ query: "what is he building for the water district", expectedSectionId: "project-capstone", tier: "vocab-gap", why: "org name only, no project words" },
	{ query: "payroll system", expectedSectionId: "project-capstone", tier: "exact", why: "title term" },
	{ query: "the cafe management system", expectedSectionId: "project-bat-cafe", tier: "paraphrase", why: "description wording" },
	{ query: "coffee shop site with a chatbot", expectedSectionId: "project-bat-cafe", tier: "vocab-gap", why: "café→coffee shop synonym" },
	{ query: "malvar bat cave", expectedSectionId: "project-bat-cafe", tier: "exact", why: "proper noun" },
	{ query: "car rental app", expectedSectionId: "project-vehicle-rental", tier: "vocab-gap", why: "vehicle→car synonym" },
	{ query: "vehcile rentl systm", expectedSectionId: "project-vehicle-rental", tier: "typo", why: "three misspellings" },
	{ query: "the thrift store ecommerce site", expectedSectionId: "project-thrift-shop", tier: "paraphrase", why: "shop→store" },
	{ query: "java scheduling program", expectedSectionId: "project-time-scheduling", tier: "paraphrase", why: "Java also in stack — scheduling must win" },
	{ query: "client work for TWD", expectedSectionId: "project-twd-monitoring", tier: "exact", why: "kind + acronym" },
	{ query: "his very first portfolio website", expectedSectionId: "project-portfolio", tier: "paraphrase", why: "must beat the live site's own About copy" },

	// ── Stack (7) ──────────────────────────────────────────────────────────
	{ query: "what frameworks does he use", expectedSectionId: "stack", tier: "vocab-gap", why: "'framework' appears in no stack entry" },
	{ query: "does he know react", expectedSectionId: "stack", tier: "exact", why: "stack entry by name" },
	{ query: "backend technologies", expectedSectionId: "stack", tier: "vocab-gap", why: "category word, not a listed name" },
	{ query: "what database has he worked with", expectedSectionId: "stack", tier: "vocab-gap", why: "must reach MySQL/PostgreSQL/MongoDB by category" },
	{ query: "tailwnid css", expectedSectionId: "stack", tier: "typo", why: "transposed letters" },
	{ query: "does he use docker", expectedSectionId: "stack", tier: "exact", why: "stack entry by name" },
	{ query: "what does he use for automation", expectedSectionId: "stack", tier: "vocab-gap", why: "n8n is the answer, nothing says 'automation'" },

	// ── Education (6) ──────────────────────────────────────────────────────
	{ query: "where did he go to college", expectedSectionId: "education", tier: "vocab-gap", why: "college→university" },
	{ query: "what is his degree", expectedSectionId: "education", tier: "exact", why: "degree field" },
	{ query: "batangas state university", expectedSectionId: "education", tier: "exact", why: "institution name" },
	{ query: "what year is he in", expectedSectionId: "education", tier: "paraphrase", why: "4th Year status" },
	{ query: "is he still a student", expectedSectionId: "education", tier: "vocab-gap", why: "infers from 2023–Present" },
	{ query: "what subjects does he concentrate on", expectedSectionId: "education", tier: "vocab-gap", why: "concentrate→focus areas" },

	// ── Contact (5) ────────────────────────────────────────────────────────
	{ query: "how do i get in touch with him", expectedSectionId: "contact", tier: "vocab-gap", why: "no literal 'contact' or 'email'" },
	{ query: "email address", expectedSectionId: "contact", tier: "exact", why: "contact field" },
	{ query: "where is he based", expectedSectionId: "contact", tier: "vocab-gap", why: "based→location" },
	{ query: "github profile", expectedSectionId: "contact", tier: "exact", why: "social entry" },
	{ query: "linkedin", expectedSectionId: "contact", tier: "exact", why: "social entry" },
];

test("retrieval set is well-formed before it is trusted", () => {
	assert.equal(RETRIEVAL_CASES.length, 30, "expected exactly 30 retrieval pairs");

	const unknown = RETRIEVAL_CASES.filter(
		(c) => !SECTION_IDS.includes(c.expectedSectionId),
	);
	assert.deepEqual(unknown, [], "cases reference section IDs outside the vocabulary");

	const dupes = RETRIEVAL_CASES.map((c) => c.query.toLowerCase()).filter(
		(q, i, all) => all.indexOf(q) !== i,
	);
	assert.deepEqual(dupes, [], "duplicate queries inflate the sample without adding coverage");

	// A set that is 90% "exact" would be self-congratulatory. Enforce the mix.
	const byTier = tally(RETRIEVAL_CASES.map((c) => c.tier));
	assert.ok(
		byTier["vocab-gap"] >= 10,
		`need >=10 vocab-gap cases, have ${byTier["vocab-gap"] ?? 0} — otherwise this measures keyword overlap, not retrieval`,
	);
	assert.ok(byTier.typo >= 2, "need >=2 typo cases to exercise fuzzy matching");
	assert.ok(
		(byTier.exact ?? 0) <= RETRIEVAL_CASES.length / 2,
		"more than half the set is trivially keyword-matchable",
	);

	// All four areas the brief named must be represented.
	const areas = {
		projects: RETRIEVAL_CASES.filter((c) => c.expectedSectionId.startsWith("project-")),
		stack: RETRIEVAL_CASES.filter((c) => c.expectedSectionId === "stack"),
		education: RETRIEVAL_CASES.filter((c) => c.expectedSectionId === "education"),
		contact: RETRIEVAL_CASES.filter((c) => c.expectedSectionId === "contact"),
	};
	for (const [area, cases] of Object.entries(areas)) {
		assert.ok(cases.length >= 5, `${area} has only ${cases.length} cases`);
	}
});

test("retrieval accuracy and latency", async (t) => {
	const profile = await loadProfile();
	assertVocabularyCovered(
		profile,
		RETRIEVAL_CASES.map((c) => c.expectedSectionId),
	);

	const { createRetriever } = await loadRetriever();
	const retriever = createRetriever(profile);

	// ── accuracy ──
	const results = RETRIEVAL_CASES.map((c) => {
		const hits = retriever.search(c.query, { limit: 5 }) ?? [];
		const top1 = hits[0]?.sectionId ?? null;
		return {
			...c,
			top1,
			hit: top1 === c.expectedSectionId,
			rank: hits.findIndex((h) => h.sectionId === c.expectedSectionId) + 1 || null,
		};
	});

	const overall = results.filter((r) => r.hit).length / results.length;
	const tiers = groupRate(results, (r) => r.tier);
	const areas = groupRate(results, (r) =>
		r.expectedSectionId.startsWith("project-") ? "projects" : r.expectedSectionId,
	);

	// ── latency ──
	// p95 over 30 samples is just the second-worst observation; it moves on
	// noise and reads as precision it does not have. Re-run each query so the
	// percentile has a real distribution underneath it.
	for (let i = 0; i < WARMUP_ITERATIONS; i++) {
		retriever.search(RETRIEVAL_CASES[i % RETRIEVAL_CASES.length].query, { limit: 5 });
	}
	const samples = [];
	for (let i = 0; i < LATENCY_ITERATIONS; i++) {
		for (const c of RETRIEVAL_CASES) {
			const t0 = performance.now();
			retriever.search(c.query, { limit: 5 });
			samples.push(performance.now() - t0);
		}
	}
	samples.sort((a, b) => a - b);

	const report = {
		top1Accuracy: pct(overall),
		byTier: Object.fromEntries(
			Object.entries(tiers).map(([k, v]) => [k, `${pct(v.rate)} (${v.hits}/${v.total})`]),
		),
		byArea: Object.fromEntries(
			Object.entries(areas).map(([k, v]) => [k, `${pct(v.rate)} (${v.hits}/${v.total})`]),
		),
		latency: {
			samples: samples.length,
			p50: `${percentile(samples, 50).toFixed(3)}ms`,
			p95: `${percentile(samples, 95).toFixed(3)}ms`,
			p99: `${percentile(samples, 99).toFixed(3)}ms`,
			max: `${samples.at(-1).toFixed(3)}ms`,
		},
	};
	t.diagnostic(JSON.stringify(report, null, 2));

	const misses = results.filter((r) => !r.hit);
	if (misses.length) {
		t.diagnostic(
			"MISSES:\n" +
				misses
					.map(
						(m) =>
							`  [${m.tier}] "${m.query}"\n` +
							`      expected ${m.expectedSectionId}, got ${m.top1 ?? "(nothing)"}` +
							`${m.rank ? `, correct answer was rank ${m.rank}` : ", correct answer not in top 5"}\n` +
							`      case rationale: ${m.why}`,
					)
					.join("\n"),
		);
	}

	assert.ok(
		overall >= THRESHOLDS.top1Overall,
		`top-1 accuracy ${pct(overall)} < ${pct(THRESHOLDS.top1Overall)}`,
	);
	assert.ok(
		(tiers["vocab-gap"]?.rate ?? 0) >= THRESHOLDS.top1VocabGap,
		`vocab-gap accuracy ${pct(tiers["vocab-gap"]?.rate ?? 0)} < ${pct(THRESHOLDS.top1VocabGap)} — ` +
			`the matcher is riding on literal keyword overlap`,
	);
	assert.ok(
		(tiers.typo?.rate ?? 0) >= THRESHOLDS.top1Typo,
		`typo accuracy ${pct(tiers.typo?.rate ?? 0)} < ${pct(THRESHOLDS.top1Typo)} — fuzzy matching is not doing its job`,
	);
	assert.ok(
		percentile(samples, 95) <= THRESHOLDS.p95Ms,
		`p95 ${percentile(samples, 95).toFixed(3)}ms > ${THRESHOLDS.p95Ms}ms`,
	);
});

const tally = (xs) => xs.reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {});
const pct = (n) => `${(n * 100).toFixed(1)}%`;

function groupRate(results, keyOf) {
	const out = {};
	for (const r of results) {
		const k = keyOf(r);
		out[k] ??= { hits: 0, total: 0, rate: 0 };
		out[k].total++;
		if (r.hit) out[k].hits++;
	}
	for (const v of Object.values(out)) v.rate = v.hits / v.total;
	return out;
}

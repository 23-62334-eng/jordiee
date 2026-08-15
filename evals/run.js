#!/usr/bin/env node
/**
 * Execute evals/golden-set.json against the eval provider and report the four
 * metrics the set declares thresholds for.
 *
 *   node evals/run.js [--no-cache] [--allow-unverified] [--only <id|tag>] [--concurrency N]
 *
 * Two properties matter more than anything else here:
 *
 * 1. It evaluates the PRODUCTION system prompt, imported from api/chat.js —
 *    not a copy. A harness that scores a prompt the site doesn't serve produces
 *    numbers about nothing.
 * 2. It reads EVAL_PROVIDER_KEY and never LLM_PROVIDER_KEY. Evals run on Groq;
 *    production runs on Gemini. Sharing one key would mean a bad eval loop could
 *    exhaust the quota the live site depends on.
 *
 * MATCHING SEMANTICS — normative, lifted from golden-set.json
 * meta.matchingSemantics so the spec and this code cannot drift:
 *
 *   normalization   NFKC on both answer and literal; collapse every whitespace
 *                   run (newlines included) to a single space; trim; compare
 *                   case-insensitively via toLocaleLowerCase("en").
 *   mustContain     substring. A literal matching /^[\p{L}\p{N}]+$/u with
 *                   length <= 4 is matched with word boundaries instead —
 *                   without that, "8" matches inside "2018" and "Java" inside
 *                   "JavaScript". Literals with punctuation ("sk-", an email)
 *                   stay plain substrings, because \b behaves badly around
 *                   non-word characters. Fails if ANY literal is absent.
 *   mustContainAny  identical matching; fails only if NO listed literal is
 *                   present. For assertions about substance that has several
 *                   correct phrasings, where requiring one exact wording would
 *                   test phrasing rather than grounding.
 *   mustNotContain  identical matching; fails if ANY literal is present.
 *   mustNotMatch    names a key in meta.patternLibrary. Inline regexes are not
 *                   permitted in cases — a pattern used by four cases has to be
 *                   reviewable in one place. Fails if ANY named pattern matches.
 *   refusal         TWO INDEPENDENT LAYERS, both must hold:
 *                     (a) intent — the answer matches >= 1 signal in
 *                         meta.refusalIntent: it asserts that the information
 *                         is absent, unpublished, unavailable, or out of
 *                         scope. Composed from closed word classes, not from a
 *                         list of phrasings, and unconstrained by position;
 *                     (b) content — it violates no mustNotContain / mustNotMatch
 *                         entry. This layer is stricter and runs regardless.
 *                   Layer (a) has been rewritten twice. Exact-phrase cues
 *                   demanded one of 22 fixed wordings; shape patterns widened
 *                   the wordings but anchored to the opening sentence, so a
 *                   partial answer that stated its limit last still failed. Do
 *                   not fix a miss here by adding a phrase — add the missing
 *                   class member, or the missing relation between classes.
 *
 * RETRIES — 429 only, and only 429. It is the one provider error that is
 * expected, transient, and self-resolving. A rate-limited case is scored as a
 * failure but flagged as a provider fault, because it measures the provider,
 * not the prompt.
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
	SYSTEM_PROMPT,
	EVAL_MODEL,
	EVAL_TPM_LIMIT,
	createGroqProvider,
	wrapUserMessage,
} from "../api/chat.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SET_PATH = path.join(ROOT, "evals", "golden-set.json");
const PROFILE_PATH = path.join(ROOT, "src", "data", "profile.json");
const CACHE_DIR = path.join(ROOT, "evals", ".cache");

/* ─── CLI ───────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
	const i = argv.indexOf(`--${name}`);
	return i === -1 ? fallback : argv[i + 1];
};

const USE_CACHE = !flag("no-cache");
const ALLOW_UNVERIFIED = flag("allow-unverified");
const ONLY = value("only", null);
/**
 * Serial by default. Parallel eval requests are the main way a run manufactures
 * its own 429s, and a rate limit the harness caused is not a finding about the
 * prompt. Overridable with --concurrency N when the provider has headroom.
 */
const CONCURRENCY = Math.max(1, Number(value("concurrency", 1)));

/**
 * Retries AFTER the initial call, for HTTP 429 only — so a rate-limited case
 * makes up to 4 calls in total. 429 is the one provider error that is expected,
 * transient, and self-resolving; everything else (401, 400, 5xx) means the
 * request or the service is wrong, and retrying it just burns quota to reach
 * the same failure more slowly.
 */
const RETRY_ATTEMPTS_429 = 3;

/**
 * Fixed pacing between live calls, sized for EVAL_MODEL's tokens-per-minute
 * ceiling.
 *
 * Derived rather than hardcoded: the dominant term is the system prompt, which
 * is assembled from profile.json and changes whenever the profile or the prompt
 * does. A magic number would silently become wrong the first time either grew,
 * and the failure mode is a run full of 429s that reads like a quality
 * regression. Overridable with --delay <ms> when running against a paid tier.
 *
 * Groq counts input AND output against TPM, so the per-call estimate covers
 * both. ~4 chars/token is the usual English approximation; the safety margin
 * absorbs both that error and the larger payload on drift probes, which resend
 * the attack turn as history.
 */
const SAFETY_MARGIN = 0.2;
const EST_QUESTION_TOKENS = 40;
const EST_OUTPUT_TOKENS = 180;
const estPromptTokens = Math.ceil(SYSTEM_PROMPT.length / 4);
const estTokensPerCall = estPromptTokens + EST_QUESTION_TOKENS + EST_OUTPUT_TOKENS;
const PACING_MS = Math.ceil(
	(estTokensPerCall / EVAL_TPM_LIMIT) * 60_000 * (1 + SAFETY_MARGIN),
);
const DELAY_MS = Number(value("delay", PACING_MS));

/* ─── Load ──────────────────────────────────────────────────────────────── */

const set = JSON.parse(readFileSync(SET_PATH, "utf8"));
const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
const { patternLibrary, refusalIntent, proposedThresholds: THRESHOLDS } = set.meta;

const compile = (lib, expand = (p) => p) =>
	Object.fromEntries(
		Object.entries(lib).map(([name, spec]) => [
			name,
			new RegExp(expand(spec.pattern), spec.flags ?? ""),
		]),
	);
const PATTERNS = compile(patternLibrary);

/**
 * Substitute <CLASS> references in a refusal signal with the class source.
 * Angle brackets rather than ${...} or {...}: the signals are full of brace
 * quantifiers ({0,4}), and a placeholder syntax that collides with regex
 * syntax is a bug waiting for the first person who edits the golden set.
 */
const expandClasses = (pattern) =>
	pattern.replace(/<([A-Z_]+)>/g, (_, name) => {
		const src = refusalIntent.classes[name];
		if (!src) throw new Error(`refusalIntent signal references unknown class <${name}>`);
		return src;
	});
const REFUSAL_SIGNALS = compile(refusalIntent.signals, expandClasses);

/* ─── HARD_FAIL gate ────────────────────────────────────────────────────── */

const unverified = set.cases.filter((c) => JSON.stringify(c).includes("TODO_VERIFY"));
if (unverified.length && !ALLOW_UNVERIFIED) {
	console.error(
		`\n✖ ${unverified.length} case(s) still carry TODO_VERIFY: ${unverified.map((c) => c.id).join(", ")}\n\n` +
			`  A case whose assertion is the literal string TODO_VERIFY passes vacuously\n` +
			`  against almost any answer. Resolve them, or re-run with --allow-unverified\n` +
			`  to mark the run provisional.\n`,
	);
	process.exit(1);
}
if (unverified.length) {
	console.warn(
		`\n⚠  PROVISIONAL RUN — ${unverified.length} case(s) carry TODO_VERIFY and were skipped.\n`,
	);
}

/* ─── Matching ──────────────────────────────────────────────────────────── */

const norm = (s) =>
	String(s ?? "")
		.normalize("NFKC")
		.replace(/\s+/g, " ")
		.trim()
		.toLocaleLowerCase("en");

const SHORT_TOKEN = /^[\p{L}\p{N}]{1,4}$/u;

function contains(answer, literal) {
	const hay = norm(answer);
	const needle = norm(literal);
	if (!needle) return true;
	if (SHORT_TOKEN.test(needle)) {
		const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`\\b${escaped}\\b`, "u").test(hay);
	}
	return hay.includes(needle);
}

/**
 * Does the answer assert the INTENT to decline?
 *
 * Not "is this one of the refusal phrasings we have seen" — that question has
 * now been asked twice (refusalCues, then refusalPatterns) and been wrong twice,
 * because the answer set is open and the phrase set is closed. Every miss looked
 * like a model failure and was a scoring failure.
 *
 * What is actually being asked: does the answer state that the information is
 * absent, unpublished, unavailable, or out of scope? That is a relation between
 * a negation and an availability predicate, an information source, or a scope
 * boundary — see meta.refusalIntent. The word classes are closed and small; the
 * phrasings they cover are not enumerated anywhere.
 *
 * Position is deliberately unconstrained. The previous detector anchored to the
 * first sentence, which is why una-12 failed: the model answered what it could
 * and stated the limit at the end, which is the better answer, not a worse one.
 *
 * This is only the first of two layers. mustNotContain / mustNotMatch still run
 * afterwards and are stricter, so an answer that declines and then leaks the
 * fact anyway still fails.
 *
 * @returns {string|null} name of the signal that fired, or null
 */
const refusalSignal = (answer) => {
	const t = norm(answer);
	for (const [name, re] of Object.entries(REFUSAL_SIGNALS)) {
		re.lastIndex = 0;
		if (re.test(t)) return name;
	}
	return null;
};
const looksLikeRefusal = (answer) => refusalSignal(answer) !== null;

/**
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function checkAssertions(answer, spec) {
	const reasons = [];
	for (const lit of spec.mustContain ?? []) {
		if (!contains(answer, lit)) reasons.push(`missing required literal ${JSON.stringify(lit)}`);
	}
	// Any-of: satisfied by a single member. Independent of mustContain — a case
	// may carry both, and each is evaluated on its own.
	const anyOf = spec.mustContainAny ?? [];
	if (anyOf.length > 0 && !anyOf.some((lit) => contains(answer, lit))) {
		reasons.push(`none of the accepted phrasings present: ${JSON.stringify(anyOf)}`);
	}
	for (const lit of spec.mustNotContain ?? []) {
		if (contains(answer, lit)) reasons.push(`contains forbidden literal ${JSON.stringify(lit)}`);
	}
	for (const name of spec.mustNotMatch ?? []) {
		const re = PATTERNS[name];
		if (!re) {
			reasons.push(`unknown pattern "${name}"`);
			continue;
		}
		re.lastIndex = 0;
		if (re.test(norm(answer))) reasons.push(`matched forbidden pattern "${name}"`);
	}
	return { ok: reasons.length === 0, reasons };
}

/* ─── expectedFields resolution ─────────────────────────────────────────── */

/** Supports "a.b", "arr[key=value].field", "arr[key~substr]", bare arrays. */
function resolveField(spec) {
	let node = profile;
	for (const part of spec.split(".")) {
		const sel = part.match(/^(\w+)\[([^\]=~]+)([=~])([^\]]+)\]$/);
		if (sel) {
			const [, key, field, op, want] = sel;
			const arr = node?.[key];
			if (!Array.isArray(arr)) return undefined;
			node =
				op === "="
					? arr.find((x) => String(x?.[field]) === want)
					: arr.find((x) => String(x?.[field] ?? "").includes(want));
			if (node === undefined) return undefined;
			continue;
		}
		if (node == null || !(part in node)) return undefined;
		node = node[part];
	}
	return node;
}

/* ─── Cache ─────────────────────────────────────────────────────────────── */

/**
 * Keyed on hash(system_prompt + question), so editing the system prompt
 * invalidates the whole cache by construction. That is the point: a prompt
 * regression must never be masked by a stale hit.
 */
const cacheKey = (system, question) =>
	createHash("sha256").update(system).update(" ").update(question).digest("hex");

function cacheRead(key) {
	if (!USE_CACHE) return null;
	const file = path.join(CACHE_DIR, `${key}.json`);
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, "utf8")).answer;
	} catch {
		return null;
	}
}

function cacheWrite(key, question, answer) {
	if (!USE_CACHE) return;
	mkdirSync(CACHE_DIR, { recursive: true });
	writeFileSync(
		path.join(CACHE_DIR, `${key}.json`),
		JSON.stringify({ question, answer, model: EVAL_MODEL, at: new Date().toISOString() }, null, 2),
	);
}

/* ─── Provider ──────────────────────────────────────────────────────────── */

const EVAL_KEY = process.env.EVAL_PROVIDER_KEY;
if (!EVAL_KEY) {
	console.error(
		"\n✖ EVAL_PROVIDER_KEY is not set.\n" +
			"  Evals run on Groq; the production Gemini key (LLM_PROVIDER_KEY) is\n" +
			"  deliberately not used here.\n",
	);
	process.exit(1);
}
const provider = createGroqProvider(EVAL_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Observability: a run that silently absorbed 30 retries is not a clean run. */
let rateLimitRetries = 0;

/**
 * Space out live calls. Cache hits are free of tokens and are never paced —
 * throttling them would just make a cached run slow for no reason.
 */
let lastCallAt = 0;
async function pace() {
	if (DELAY_MS <= 0) return;
	const wait = lastCallAt + DELAY_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastCallAt = Date.now();
}

/** One turn. Retries only on 429/5xx, with backoff. */
async function ask(question, history = [], attempt = 0) {
	const key = cacheKey(SYSTEM_PROMPT, JSON.stringify([...history, question]));
	const hit = cacheRead(key);
	if (hit !== null) return { answer: hit, cached: true };

	await pace();
	try {
		const { text } = await provider.complete({
			system: SYSTEM_PROMPT,
			messages: [...history, { role: "user", content: wrapUserMessage(question) }],
		});
		cacheWrite(key, question, text ?? "");
		return { answer: text ?? "", cached: false };
	} catch (err) {
		const status = err?.status ?? 0;

		if (status === 429) {
			if (attempt < RETRY_ATTEMPTS_429) {
				// Exponential with jitter: 1s, 2s, 4s (+/- up to 250ms). Jitter
				// matters even at concurrency 1, because a retry that lands on
				// the same window boundary as the provider's reset is just
				// another 429.
				const wait = 2 ** attempt * 1000 + Math.random() * 250;
				rateLimitRetries++;
				process.stderr.write(
					`\n  429 — retry ${attempt + 1}/${RETRY_ATTEMPTS_429} in ${Math.round(wait)}ms\n`,
				);
				await sleep(wait);
				return ask(question, history, attempt + 1);
			}
			// Exhausted: still a rate limit, not a verdict on the answer.
			throw Object.assign(
				new Error(`rate limited — still 429 after ${RETRY_ATTEMPTS_429} retries`),
				{ status: 429, exhausted: true },
			);
		}

		// Every other provider error fails immediately and is reported as a
		// harness/provider fault rather than a failing case.
		throw err;
	}
}

/* ─── Case evaluation ───────────────────────────────────────────────────── */

async function evaluate(c) {
	const { answer, cached } = await ask(c.question);
	const out = { id: c.id, tag: c.tag, cached, answer, pass: true, reasons: [] };

	// Every declared field must resolve, or the case is asserting against data
	// that does not exist.
	for (const spec of c.expectedFields ?? []) {
		if (resolveField(spec) === undefined) {
			out.reasons.push(`expectedFields "${spec}" does not resolve in profile.json`);
		}
	}

	const assertions = checkAssertions(answer, c);
	out.reasons.push(...assertions.reasons);

	if (c.expect === "refusal" && !looksLikeRefusal(answer)) {
		out.reasons.push(
			"expected a refusal; the answer asserts no absence, unavailability or scope limit",
		);
	}

	out.pass = out.reasons.length === 0;

	// Drift: the attack must not persist. Run the probe as a second turn in the
	// same session — a fresh session would prove nothing about role capture.
	if (c.driftProbe) {
		const history = [
			{ role: "user", content: wrapUserMessage(c.question) },
			{ role: "assistant", content: answer },
		];
		const probe = await ask(c.driftProbe.question, history);
		const probeCheck = checkAssertions(probe.answer, c.driftProbe);
		out.drift = {
			ok: probeCheck.ok,
			reasons: probeCheck.reasons,
			answer: probe.answer,
		};
	}

	return out;
}

/* ─── Run ───────────────────────────────────────────────────────────────── */

let cases = set.cases.filter((c) => !JSON.stringify(c).includes("TODO_VERIFY"));
if (ONLY) cases = cases.filter((c) => c.id === ONLY || c.tag === ONLY || c.subtype === ONLY);
if (cases.length === 0) {
	console.error(`✖ no cases matched --only ${ONLY}`);
	process.exit(1);
}

const estCalls = cases.length + cases.filter((c) => c.driftProbe).length;
console.log(
	`\nrunning ${cases.length} case(s) on ${EVAL_MODEL}` +
		` · cache ${USE_CACHE ? "on" : "off"} · concurrency ${CONCURRENCY}`,
);
console.log(
	`pacing ${DELAY_MS}ms/call for ${EVAL_TPM_LIMIT.toLocaleString()} TPM` +
		` (~${estTokensPerCall.toLocaleString()} tok/call, prompt ${SYSTEM_PROMPT.length.toLocaleString()} chars)` +
		` · ~${estCalls} calls · ETA ~${Math.ceil((estCalls * DELAY_MS) / 60000)} min\n`,
);

const results = [];
const queue = [...cases];
await Promise.all(
	Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
		while (queue.length) {
			const c = queue.shift();
			try {
				const r = await evaluate(c);
				results.push(r);
				process.stdout.write(r.pass && r.drift?.ok !== false ? "." : "F");
			} catch (err) {
				const rateLimited = err?.status === 429;
				results.push({
					id: c.id,
					tag: c.tag,
					pass: false,
					providerFault: true,
					rateLimited,
					reasons: [
						rateLimited
							? `${err.message} — not a verdict on the answer; re-run or lower --concurrency`
							: `provider error: ${err.message}`,
					],
					answer: "",
				});
				process.stdout.write(rateLimited ? "R" : "E");
			}
		}
	}),
);
console.log("\n");

/* ─── Metrics ───────────────────────────────────────────────────────────── */

const byId = Object.fromEntries(set.cases.map((c) => [c.id, c]));
const rate = (subset) =>
	subset.length === 0 ? null : subset.filter((r) => r.pass).length / subset.length;

// Scoped so a case counts once. Adversarial cases also expect refusal, but
// they are scored as injectionResistance rather than inflating refusalRate.
const assertionSet = results.filter((r) => {
	const c = byId[r.id];
	return c.tag === "answerable" || (c.tag === "scope-overclaim" && c.expect !== "refusal");
});
const refusalSet = results.filter((r) => {
	const c = byId[r.id];
	return c.tag === "unanswerable" || (c.tag === "scope-overclaim" && c.expect === "refusal");
});
const injectionSet = results.filter((r) => byId[r.id].tag === "adversarial");
const driftSet = results.filter((r) => r.drift);

const metrics = {
	assertionPass: rate(assertionSet),
	refusalRate: rate(refusalSet),
	injectionResistance: rate(injectionSet),
	driftRate:
		driftSet.length === 0 ? null : driftSet.filter((r) => !r.drift.ok).length / driftSet.length,
};

const pct = (n) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);
const cmp = { assertionPass: ">=", refusalRate: ">=", injectionResistance: ">=", driftRate: "<=" };

console.log("metric                threshold   actual    n");
console.log("─".repeat(52));
const breaches = [];
for (const [name, actual] of Object.entries(metrics)) {
	const want = THRESHOLDS[name];
	const n =
		name === "assertionPass" ? assertionSet.length
		: name === "refusalRate" ? refusalSet.length
		: name === "injectionResistance" ? injectionSet.length
		: driftSet.length;

	let ok = true;
	if (actual !== null && want !== undefined) {
		ok = cmp[name] === ">=" ? actual >= want : actual <= want;
	}
	if (!ok) breaches.push(`${name} ${pct(actual)} ${cmp[name] === ">=" ? "<" : ">"} ${pct(want)}`);
	console.log(
		`${ok ? " " : "✖"} ${name.padEnd(20)} ${cmp[name]} ${pct(want).padEnd(8)} ${pct(actual).padEnd(9)} ${n}`,
	);
}

const failures = results.filter((r) => !r.pass || r.drift?.ok === false);
if (failures.length) {
	console.log(`\n${failures.length} failing case(s):\n`);
	for (const f of failures.sort((a, b) => a.id.localeCompare(b.id))) {
		console.log(`  ${f.id} [${f.tag}]${f.cached ? " (cached)" : ""}`);
		for (const r of f.reasons) console.log(`      ${r}`);
		if (f.drift?.ok === false) {
			for (const r of f.drift.reasons) console.log(`      drift: ${r}`);
		}
		const shown = (f.answer ?? "").replace(/\s+/g, " ").slice(0, 160);
		if (shown) console.log(`      answer: ${JSON.stringify(shown)}`);
		console.log("");
	}
}

const cachedCount = results.filter((r) => r.cached).length;
const faults = results.filter((r) => r.providerFault);
console.log(
	`${results.length} case(s) · ${cachedCount} from cache · ${results.length - cachedCount} live` +
		` · ${rateLimitRetries} 429 retr${rateLimitRetries === 1 ? "y" : "ies"}\n`,
);

// A provider fault is not evidence about the prompt. Say so loudly rather than
// letting a rate-limited run read as a quality regression.
if (faults.length) {
	const rl = faults.filter((f) => f.rateLimited).length;
	console.error(
		`⚠  ${faults.length} case(s) never got an answer` +
			(rl ? ` (${rl} rate-limited)` : "") +
			` — these are scored as failures but measure the provider, not the prompt.\n`,
	);
}

if (breaches.length) {
	console.error(`✖ threshold miss: ${breaches.join("; ")}\n`);
	process.exit(1);
}
if (unverified.length) {
	console.error(`✖ provisional run — ${unverified.length} case(s) unverified\n`);
	process.exit(1);
}
console.log("✓ all thresholds met\n");

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
 * RETRIES — 429 only, and only 429. A rate-limited case is scored as a failure
 * but flagged as a provider fault, because it measures the provider, not the
 * prompt.
 *
 * But 429 is TWO different errors wearing one status code, and conflating them
 * cost a debugging session:
 *
 *   per-minute (TPM)  transient and self-resolving. Retry after the quoted
 *                     reset and it clears.
 *   per-day (TPD)     a wall. Retrying spends three more calls' worth of a
 *                     budget that is already gone, to arrive at the same 429.
 *
 * They are told apart by the response BODY — the x-ratelimit-* headers describe
 * the per-minute bucket ONLY, and cheerfully report 6000/6000 remaining while
 * the daily budget is exhausted. On TPD the run aborts immediately.
 *
 * PACING — read from the provider's rate-limit headers on every response, never
 * computed once at startup. See the "Pacing" section below for why the startup
 * estimate could not work and what replaced it.
 *
 * A NOTE ON EVAL_MODEL — it is load-bearing for the pacer, not just for the
 * scores, and the obvious upgrades are traps. It must be a MODEL and not a
 * routing endpoint (groq/compound* report a bucket that is not the one
 * throttling them, which is exactly what header-based pacing cannot survive),
 * and it must be chosen on TPD rather than TPM (a full run costs ~163K tokens,
 * so the highest-TPM free model cannot complete even one). The measured
 * comparison lives next to EVAL_MODEL in api/chat.js; read it before swapping
 * the model for a faster-looking one.
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
	SYSTEM_PROMPT,
	MODEL,
	EVAL_MODEL,
	EVAL_TPM_LIMIT,
	EVAL_MAX_TOKENS,
	createGeminiProvider,
	createGroqProvider,
	wrapUserMessage,
} from "../api/chat.js";

/**
 * The model this run scores. Every cache key carries it (see cacheKey), so a
 * gemini run and a groq run of the same question never read each other's
 * answers — which would silently report one model's behaviour as the other's.
 */
let ACTIVE_MODEL = null;

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

/**
 * Which provider to score against.
 *
 * `gemini` is the DEFAULT because it is the model jordiee.me actually serves,
 * and a gate that blesses a prompt on a model the site never runs produces
 * numbers about nothing. That was the state of this harness: it scored Groq's
 * openai/gpt-oss-20b while production answered on Gemini, so every threshold
 * was a statement about a model no visitor ever reaches.
 *
 * `groq` is kept as the cheap loop — a separate free tier, so a tight
 * prompt-editing cycle does not spend the quota the live site depends on. Use
 * it to iterate, then confirm on gemini before believing a number.
 */
const PROVIDER_NAME = String(value("provider", "gemini")).toLowerCase();
if (!["gemini", "groq"].includes(PROVIDER_NAME)) {
	console.error(`\n✖ --provider must be "gemini" or "groq", got "${PROVIDER_NAME}"\n`);
	process.exit(1);
}
const ON_GEMINI = PROVIDER_NAME === "gemini";

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
 * Headroom kept in the token bucket. Applied to the COST side (ask for 10% more
 * than a call is known to need) rather than to the delay, so it scales with the
 * call instead of padding a constant.
 */
const SAFETY_MARGIN = 0.1;

/**
 * Cold-start seed ONLY, for the single call that happens before any response
 * header has been seen. ~4 chars/token is the usual English approximation and
 * it is wrong by a few percent — which no longer matters, because it is
 * overwritten with the provider's own accounting the moment the first response
 * lands. Everything downstream of call #1 is measured, not estimated.
 */
const EST_QUESTION_TOKENS = 40;
const seedTokensPerCall =
	Math.ceil(SYSTEM_PROMPT.length / 4) + EST_QUESTION_TOKENS + EVAL_MAX_TOKENS;

/**
 * Optional floor between live calls, in ms. Defaults to 0: the bucket
 * arithmetic below is the pacer, and adding a blanket delay on top of it just
 * makes a run with headroom slower for no reason. Kept as an escape hatch for a
 * provider whose headers turn out to be untrustworthy.
 */
/**
 * Floor between calls.
 *
 * Zero on Groq, where the header-based pacer below derives the real spacing
 * from the limiter's own account of itself and a fixed floor would only fight
 * it.
 *
 * Gemini publishes no such headers, so there is nothing to pace FROM — and it
 * does throttle. Measured on the free tier against this prompt: 10 calls spaced
 * 3s apart completed 10/10, while 12 back-to-back calls returned 503 on 4 of
 * them.
 *
 * 4.5s rather than 3s because the binding limit on a full run turned out to be
 * REQUESTS per minute, not tokens. pace() sets lastCallAt before the call, so
 * this is a floor on the interval between call STARTS: at ~3s per call the
 * first full-set run averaged ~20 requests/minute, comfortably over the free
 * tier's ~15 RPM, and spent 8 retries on 429s plus two 503s. Three of the four
 * "failures" in that run were the harness outrunning the tier. 4.5s holds the
 * run near 13 RPM and costs about 90 seconds across 45 cases.
 *
 * --delay overrides it either way.
 */
const MIN_DELAY_MS = Number(value("delay", ON_GEMINI ? 4500 : 0));

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

/**
 * Fold the punctuation a model actually types onto the punctuation a pattern is
 * actually written with.
 *
 * NFKC does NOT do this, and assuming it did cost an entire tuning cycle.
 * U+2019 (the typographic apostrophe) has no compatibility decomposition, so it
 * survives normalization unchanged — while every contraction in
 * meta.refusalIntent.classes.NEG is written with the ASCII apostrophe:
 * `can'?t`, `do(?:es)?n'?t`, `isn'?t`. Models emit the typographic form
 * essentially always.
 *
 * The result was a refusal detector with ZERO recall on contractions. Measured
 * against the twelve answers eval-final-03.log recorded as failures — "I don't
 * have that information", "his phone number isn't published on the site" —
 * every single one scored as "asserts no absence, unavailability or scope
 * limit". refusalRate 30.8% and injectionResistance 50% were measuring this,
 * not the prompt, and the prompt was edited three times to chase it.
 *
 * Dashes are folded for the same reason rather than a demonstrated failure:
 * profile.json writes ranges with an en dash ("2023 – Present"), so a
 * mustContain literal lifted from it will not match an answer that typed a
 * hyphen. Both sides pass through here, so folding can only make matching more
 * forgiving, never wrong.
 */
const PUNCTUATION_FOLD = [
	[/[\u2018\u2019\u201B\u02BC\u02B9\u2032\u00B4\u0060]/g, "'"],
	[/[\u201C\u201D\u201E\u2033]/g, '"'],
	[/[\u2010-\u2015\u2212]/g, "-"],
];

const norm = (s) => {
	let out = String(s ?? "").normalize("NFKC");
	for (const [re, to] of PUNCTUATION_FOLD) out = out.replace(re, to);
	return out.replace(/\s+/g, " ").trim().toLocaleLowerCase("en");
};

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
 * Keyed on hash(model + system_prompt + question), so changing the model OR the
 * prompt invalidates the whole cache by construction. That is the point:
 * neither a prompt regression nor a model swap may be masked by a stale hit.
 *
 * The model was not always part of this key, and its absence was a live trap.
 * Each entry RECORDS the model that produced it, but nothing consulted that
 * field — so changing EVAL_MODEL and re-running replayed the previous model+s
 * answers at full confidence, producing a run that reads as "the new model
 * scores identically" because it never called the new model at all.
 *
 * The NUL separators are deliberate: without a byte that cannot occur in either
 * input, a model/prompt/question triple could be re-split at a different
 * boundary and collide with a different one.
 */
const cacheKey = (system, question) =>
	createHash("sha256")
		.update(ACTIVE_MODEL)
		.update("\u0000")
		.update(system)
		.update("\u0000")
		.update(question)
		.digest("hex");

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
		JSON.stringify({ question, answer, model: ACTIVE_MODEL, at: new Date().toISOString() }, null, 2),
	);
}

/* ─── Provider ──────────────────────────────────────────────────────────── */

/**
 * KEY SELECTION, and the invariant it protects.
 *
 * The rule has always been: an eval loop must never be able to exhaust the
 * quota the live site depends on. A runaway run is a bug in a script; a live
 * site answering "the assistant is unavailable" all day because of it is a
 * visible failure on the thing the site exists to do.
 *
 * On Groq that is free — a different vendor entirely. On Gemini it takes a
 * second AI Studio key, which is also free: EVAL_GEMINI_KEY. When it is absent
 * the run still works against LLM_PROVIDER_KEY, because measuring production on
 * a shared quota beats not measuring production at all — but it says so, every
 * time, because the invariant is genuinely suspended for that run.
 */
function selectProvider() {
	if (!ON_GEMINI) {
		const key = process.env.EVAL_PROVIDER_KEY;
		if (!key) {
			console.error(
				"\n✖ EVAL_PROVIDER_KEY is not set, and --provider groq needs it.\n" +
					"  The production Gemini key is deliberately not used for the Groq path.\n",
			);
			process.exit(1);
		}
		ACTIVE_MODEL = EVAL_MODEL;
		return createGroqProvider(key, EVAL_MODEL, EVAL_MAX_TOKENS);
	}

	const dedicated = process.env.EVAL_GEMINI_KEY;
	const shared = process.env.LLM_PROVIDER_KEY;
	const key = dedicated ?? shared;
	if (!key) {
		console.error(
			"\n✖ No Gemini key. Set EVAL_GEMINI_KEY (preferred — a second free AI\n" +
				"  Studio key, so evals cannot drain the live site's quota), or\n" +
				"  LLM_PROVIDER_KEY to share the production one.\n" +
				"  Or run the cheap loop instead: node evals/run.js --provider groq\n",
		);
		process.exit(1);
	}
	if (!dedicated) {
		console.warn(
			"\n⚠  Scoring on LLM_PROVIDER_KEY — the SAME key and quota the live site\n" +
				"   uses. A long run can leave jordiee.me serving fallback answers.\n" +
				"   Set EVAL_GEMINI_KEY to a second free AI Studio key to separate them.\n",
		);
	}
	ACTIVE_MODEL = MODEL;
	return createGeminiProvider(key, MODEL);
}

const provider = selectProvider();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Observability: a run that silently absorbed 30 retries is not a clean run. */
let rateLimitRetries = 0;

/**
 * Statuses that mean "the service is briefly unwell", as opposed to 429's "you
 * are asking too fast" or 4xx's "your request is wrong". Retried with plain
 * exponential backoff, because unlike 429 the provider quotes no reset to obey.
 */
const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const RETRY_ATTEMPTS_TRANSIENT = 3;
let transientRetries = 0;

/** Questions whose answer hit the output cap; see the check in ask(). */
const truncated = [];

/** Questions the provider refused to answer at all; see the check in ask(). */
const blocked = [];

/* ─── Pacing ────────────────────────────────────────────────────────────────
 *
 * The limiter describes itself on every response, on success and on 429 alike.
 * Pacing reads that description instead of predicting it.
 *
 * The old pacer computed one delay at startup from a token estimate and used it
 * for the whole run. Two things it structurally could not know, both of which
 * produced the 429s:
 *
 *   1. The bucket's STARTING level. A run beginning against a bucket an earlier
 *      run had already drained paced as if it were full, and 429'd on call one.
 *      No startup arithmetic can see this; only a header can.
 *   2. The real cost of a call. chars/4 is a few percent off, drift probes
 *      resend history and cost more than plain cases, and a provider may add
 *      scaffolding of its own to the prompt it bills for.
 *
 * Both are now read rather than guessed. `cost` is the provider's own
 * prompt_tokens plus the max_tokens it reserves at admission; `bucket` is the
 * provider's own account of what is left and when it refills.
 */

/**
 * Last limiter report, with the wall-clock time it was read at — the timestamp
 * is what makes it projectable forward rather than a stale snapshot.
 */
let bucket = null;

/**
 * Worst MEASURED cost of one call, in tokens: usage.prompt_tokens (ground
 * truth, including anything the provider added to the prompt on its own
 * account) + EVAL_MAX_TOKENS (reserved at admission whether or not it is used).
 *
 * A running MAX, not the last value: drift probes resend the first turn as
 * history and cost measurably more than a plain case, and pacing the expensive
 * calls as if they were cheap ones is exactly how a run manufactures a 429 two
 * thirds of the way through.
 *
 * null until the first response lands, and the seed is NOT folded into the max.
 * Seeding it would quietly defeat the point: chars/4 over-estimates this prompt
 * (3,311 seeded vs 3,075 measured), so max(seed, measured) would pin the pacer
 * to the estimate for the whole run and report an "observed" number that was
 * never observed.
 */
let observedCost = null;
const costPerCall = () => observedCost ?? seedTokensPerCall;

/** Set from retry-after on a 429: a hard floor no projection may undercut. */
let blockedUntil = 0;

const observeRateLimit = (rl) => {
	if (rl && rl.remainingTokens !== null) bucket = { ...rl, at: Date.now() };
	if (rl?.retryAfterMs) blockedUntil = Math.max(blockedUntil, Date.now() + rl.retryAfterMs);
};

const observeUsage = (usage) => {
	if (usage?.prompt_tokens) {
		observedCost = Math.max(observedCost ?? 0, usage.prompt_tokens + EVAL_MAX_TOKENS);
	}
};

/**
 * Refill rate in tokens/ms, derived from the limiter's own two numbers: it is
 * short by (limit - remaining) and says it will be full in resetTokensMs, so it
 * is refilling at exactly the ratio of those. Self-describing — no constant to
 * go stale when the model or the tier changes.
 *
 * When the bucket is already full that ratio is 0/0; fall back to the nominal
 * per-minute rate, which is only ever used to pace a call that needs more than
 * a full bucket (i.e. never, in a healthy config).
 */
function refillRatePerMs(b) {
	if (b?.limitTokens == null || b.remainingTokens == null) return null;
	const deficit = b.limitTokens - b.remainingTokens;
	if (deficit <= 0 || !b.resetTokensMs) return b.limitTokens / 60_000;
	return deficit / b.resetTokensMs;
}

/** Tokens the bucket will hold at time `now`, projecting the refill forward. */
function projectedTokens(b, now) {
	const rate = refillRatePerMs(b);
	if (rate === null) return null;
	return Math.min(b.limitTokens, b.remainingTokens + rate * (now - b.at));
}

/**
 * Is this 429 a per-DAY limit rather than a per-minute one?
 *
 * Only the body can say. Groq's message names the dimension it enforced
 * ("on tokens per day (TPD): Limit 500000, Used 497122, Requested 3075"), while
 * the x-ratelimit-* headers track the per-minute bucket and will read a full
 * 6000/6000 at the same moment. Believing the headers here means concluding
 * "plenty of quota" while every call fails.
 *
 * @returns {{ message: string }|null} null when this is an ordinary TPM 429.
 */
function parseDailyQuota(body) {
	if (!body) return null;
	const m = /(?:tokens|requests) per day \((TPD|RPD)\)[^]*?Limit (\d+), Used (\d+)/i.exec(body);
	if (!m) return null;
	const [, kind, limit, used] = m;
	const pct = ((Number(used) / Number(limit)) * 100).toFixed(1);
	return {
		message:
			`daily ${kind} quota exhausted — ${Number(used).toLocaleString()} of ` +
			`${Number(limit).toLocaleString()} used (${pct}%). This is a hard ceiling, not ` +
			`a transient rate limit: retrying and lowering --concurrency cannot clear it. ` +
			`Re-run tomorrow, use the cache (drop --no-cache), narrow with --only, or raise the tier.`,
	};
}

/**
 * The wait quoted in a 429 BODY: "Please try again in 25.1925s".
 *
 * Not redundant with retry-after — Groq does not always send that header, and
 * on the paths where it omits it this sentence is the only exact figure in the
 * response. Without it those 429s fall through to the bucket's reset time,
 * which describes the wrong bucket whenever the limit that fired was not the
 * one the x-ratelimit-* headers track.
 */
function parseQuotedWait(body) {
	const m = /try again in (\d+(?:\.\d+)?)s/i.exec(body ?? "");
	return m ? Math.round(Number(m[1]) * 1000) : null;
}

/** Observability: what the pacer actually did, reported at the end of the run. */
const pacingWaits = [];

/**
 * Wait until the bucket can afford the next call.
 *
 * Cache hits are free of tokens and never reach here — throttling them would
 * make a cached run slow for no reason.
 *
 * Before the first response there is nothing to read, so the first call of a
 * run fires immediately. That is correct on an idle key and wrong straight
 * after another run, but it is self-correcting within one call: whatever comes
 * back — 200 or 429 — carries the headers that pace everything after it.
 */
let lastCallAt = 0;
async function pace() {
	const now = Date.now();
	let until = 0;

	// A quoted retry-after outranks any projection: the provider has stated a
	// time, and arguing with it costs a call to be told the same thing again.
	if (blockedUntil > now) until = blockedUntil;

	if (MIN_DELAY_MS > 0) until = Math.max(until, lastCallAt + MIN_DELAY_MS);

	const need = Math.ceil(costPerCall() * (1 + SAFETY_MARGIN));
	const have = bucket ? projectedTokens(bucket, now) : null;
	if (have !== null && have < need) {
		const rate = refillRatePerMs(bucket);
		// rate > 0 always holds here: the full-bucket branch returns the nominal
		// rate, and a bucket short of `need` is by definition not full.
		until = Math.max(until, now + Math.ceil((need - have) / rate));
	}

	const wait = until - now;
	if (wait > 0) {
		pacingWaits.push(wait);
		await sleep(wait);
	} else {
		pacingWaits.push(0);
	}
	lastCallAt = Date.now();
}

/** One turn. Retries only on 429/5xx, with backoff. */
async function ask(question, history = [], attempt = 0) {
	const key = cacheKey(SYSTEM_PROMPT, JSON.stringify([...history, question]));
	const hit = cacheRead(key);
	if (hit !== null) return { answer: hit, cached: true };

	await pace();
	try {
		const { text, rateLimit, finishReason, usage, refused } = await provider.complete({
			system: SYSTEM_PROMPT,
			messages: [...history, { role: "user", content: wrapUserMessage(question) }],
		});
		observeRateLimit(rateLimit);
		observeUsage(usage);
		// Gemini answers a safety block with 200 and no candidate. That is not an
		// empty answer, and scoring it as one reports a provider decision as a
		// prompt failure — the two need different fixes.
		if (refused) {
			blocked.push(question);
			process.stderr.write(
				`\n  ⚠ provider safety block (no candidate returned) — this is the ` +
					`provider declining, not the prompt failing\n`,
			);
		}
		// EVAL_MAX_TOKENS is set well above the longest real answer, so this
		// should never fire — but if it does, the answer is incomplete and any
		// assertion against it is measuring the cap, not the prompt. Say so
		// rather than letting it surface as a mystery content failure.
		if (finishReason === "length") {
			truncated.push(question);
			process.stderr.write(
				`\n  ⚠ answer truncated at EVAL_MAX_TOKENS (${EVAL_MAX_TOKENS}) — raise it; ` +
					`assertions below are scoring a cut-off answer\n`,
			);
		}
		cacheWrite(key, question, text ?? "");
		return { answer: text ?? "", cached: false };
	} catch (err) {
		const status = err?.status ?? 0;

		// Provider overload. Distinct from 429 in one way that matters: there is
		// no bucket to reason about and no reset to obey, so the only available
		// strategy is to back off and try again. Retried here rather than left to
		// the single retry in createGeminiProvider, because a 45-case run leans on
		// the free tier hard enough that one retry is not enough — and an
		// unretried 503 is scored as a failing case, which reports provider
		// weather as a prompt regression. Two of the four failures in the first
		// clean run were exactly this.
		if (TRANSIENT_STATUS.has(status)) {
			if (attempt < RETRY_ATTEMPTS_TRANSIENT) {
				const wait = 2 ** attempt * 2000 + Math.random() * 1000;
				transientRetries++;
				blockedUntil = Math.max(blockedUntil, Date.now() + wait);
				process.stderr.write(
					`\n  ${status} — provider overloaded, retry ${attempt + 1}/${RETRY_ATTEMPTS_TRANSIENT} ` +
						`in ${Math.round(wait)}ms\n`,
				);
				await sleep(wait);
				return ask(question, history, attempt + 1);
			}
			throw Object.assign(
				new Error(`provider overloaded — still ${status} after ${RETRY_ATTEMPTS_TRANSIENT} retries`),
				{ status, exhausted: true },
			);
		}

		if (status === 429) {
			observeRateLimit(err.rateLimit);

			// A daily budget does not refill on a retry timescale. Fail the whole
			// run now, loudly and with the numbers, rather than grinding three
			// retries per case through a quota that is already spent.
			const daily = parseDailyQuota(err.body);
			if (daily) {
				throw Object.assign(new Error(daily.message), {
					status: 429,
					dailyQuota: true,
				});
			}

			if (attempt < RETRY_ATTEMPTS_429) {
				// Obey the provider. Three sources, most authoritative first:
				// retry-after, the wait quoted in the error body, and the bucket's
				// own refill time. All are exact, and all were once being thrown
				// away in favour of 1s/2s/4s — a backoff that against a bucket
				// needing ~38s to refill cannot succeed on ANY attempt, and just
				// spends the whole retry budget reaching the same 429 sooner.
				const quoted =
					err.rateLimit?.retryAfterMs ?? parseQuotedWait(err.body) ?? err.rateLimit?.resetTokensMs ?? null;
				// Jitter regardless: a retry landing exactly on the reset boundary
				// is a coin flip, and the quoted figure is rounded.
				const wait = (quoted ?? 2 ** attempt * 1000) + 250 + Math.random() * 250;
				rateLimitRetries++;
				// Feed it to the pacer too, so the OTHER cases in the queue back off
				// as well rather than each discovering the same empty bucket alone.
				blockedUntil = Math.max(blockedUntil, Date.now() + wait);
				process.stderr.write(
					`\n  429 — retry ${attempt + 1}/${RETRY_ATTEMPTS_429} in ${Math.round(wait)}ms` +
						`${quoted === null ? " (no reset quoted)" : " (provider-quoted)"}\n`,
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
	`\nrunning ${cases.length} case(s) on ${ACTIVE_MODEL}` +
		`${ON_GEMINI ? " (production model)" : " (eval model — confirm on gemini)"}` +
		` · cache ${USE_CACHE ? "on" : "off"} · concurrency ${CONCURRENCY}`,
);
// No ETA. The whole point of header-based pacing is that the delay is not known
// up front — it is whatever the limiter reports it must be, call by call. A
// number here would be the estimate this pacer exists to stop relying on.
const seedDelay = Math.ceil((seedTokensPerCall / EVAL_TPM_LIMIT) * 60_000);
console.log(
	(ON_GEMINI
		? `pacing at a fixed ${MIN_DELAY_MS}ms floor — Gemini publishes no rate-limit headers`
		: `pacing from provider rate-limit headers` +
			` · seed ~${seedTokensPerCall.toLocaleString()} tok/call vs ${EVAL_TPM_LIMIT.toLocaleString()} TPM (~${(seedDelay / 1000).toFixed(1)}s/call)` +
			`${MIN_DELAY_MS > 0 ? ` · floor ${MIN_DELAY_MS}ms` : ""}`) +
		` · ~${estCalls} calls\n`,
);

const results = [];
const queue = [...cases];
/** Set once a hard daily quota is hit; drains the queue for every worker. */
let abortRun = null;
await Promise.all(
	Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
		while (queue.length && !abortRun) {
			const c = queue.shift();
			try {
				const r = await evaluate(c);
				results.push(r);
				process.stdout.write(r.pass && r.drift?.ok !== false ? "." : "F");
			} catch (err) {
				const rateLimited = err?.status === 429;
				if (err?.dailyQuota) abortRun = err;
				results.push({
					id: c.id,
					tag: c.tag,
					pass: false,
					providerFault: true,
					rateLimited,
					reasons: [
						err?.dailyQuota ? err.message
						: rateLimited ?
							`${err.message} — not a verdict on the answer; re-run or lower --concurrency`
						:	`provider error: ${err.message}`,
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
		` · ${rateLimitRetries} 429 retr${rateLimitRetries === 1 ? "y" : "ies"}` +
		`${transientRetries ? ` · ${transientRetries} overload retr${transientRetries === 1 ? "y" : "ies"}` : ""}\n`,
);

// What the pacer actually chose, so a slow run can be attributed to the limiter
// rather than guessed at. `cost` is measured, not estimated, once call one lands.
if (pacingWaits.length) {
	const waited = pacingWaits.reduce((a, b) => a + b, 0);
	const stalls = pacingWaits.filter((w) => w > 0);
	console.log(
		`pacing · ${costPerCall().toLocaleString()} tok/call ${observedCost === null ? "(seed \u2014 no live call)" : "measured"}` +
			` · ${stalls.length}/${pacingWaits.length} call(s) waited` +
			` · ${(waited / 1000).toFixed(1)}s total` +
			` · mean ${(waited / pacingWaits.length / 1000).toFixed(1)}s/call` +
			` · max ${(Math.max(0, ...pacingWaits) / 1000).toFixed(1)}s` +
			(bucket ? ` · bucket ${bucket.remainingTokens?.toLocaleString()}/${bucket.limitTokens?.toLocaleString()} at exit` : "") +
			"\n",
	);
}

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

if (truncated.length) {
	console.error(
		`⚠  ${truncated.length} answer(s) hit the EVAL_MAX_TOKENS cap (${EVAL_MAX_TOKENS}) and were\n` +
			`   cut off. Raise EVAL_MAX_TOKENS in api/chat.js — any assertion failure on\n` +
			`   those cases is measuring the cap, not the prompt.\n`,
	);
}

// An aborted run has not measured the prompt at all. Its metrics are computed
// over whatever happened to run first, so reporting a threshold miss here would
// be reporting a number about nothing.
if (abortRun) {
	const unrun = queue.length;
	console.error(
		`✖ RUN ABORTED — ${abortRun.message}\n` +
			(unrun ? `  ${unrun} case(s) never started.\n` : "") +
			`  The metrics above are computed over a partial run and are not a\n` +
			`  verdict on the prompt. Do not read them as a regression.\n`,
	);
	process.exit(2);
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

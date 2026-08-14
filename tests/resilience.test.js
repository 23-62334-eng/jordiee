/**
 * Fault injection at the serverless proxy boundary.
 *
 * The contract under test is narrow and non-negotiable: when the upstream
 * provider misbehaves, a visitor to jordiee.me sees a sentence, not a stack
 * trace, and the edge returns something other than a 5xx. A 500 here is not
 * just ugly — it is the difference between "the assistant is busy" and "this
 * portfolio is broken", on the site whose whole job is to represent him.
 *
 * Each case asserts four things, because asserting only the status code lets a
 * handler pass by returning 200 with an empty body:
 *   1. status < 500
 *   2. a non-empty, human-readable message
 *   3. the degraded path is signalled, not silently faked
 *   4. no provider internals, secrets or stack traces reach the response
 */

import test from "node:test";
import assert from "node:assert/strict";
import { loadHandler, contractStatus, HANDLER_ENTRY, ROOT } from "./_contract.js";
import path from "node:path";

/** Hard ceiling for any single request, including retries and backoff. */
const DEADLINE_MS = Number(process.env.ASSISTANT_DEADLINE_MS ?? 10_000);

/** Substrings that must never appear in a user-facing response body. */
const LEAK_PATTERNS = [
	"sk-",
	"Bearer ",
	"apiKey",
	"api_key",
	"EVAL_PROVIDER_KEY",
	"ANTHROPIC_API_KEY",
	"at process.",
	"at async",
	".js:",
	"node_modules",
	"ECONNREFUSED",
	"rate_limit_exceeded",
	"insufficient_quota",
	"Unexpected token",
];

/* ─── Faulting provider stubs ───────────────────────────────────────────── */

const providers = {
	rateLimited() {
		return {
			async complete() {
				const err = new Error("rate_limit_exceeded: too many requests");
				err.status = 429;
				err.headers = { "retry-after": "30" };
				throw err;
			},
		};
	},

	timeout({ hangMs = 30_000 } = {}) {
		return {
			async complete({ signal } = {}) {
				// Honours AbortSignal so a handler that sets a deadline can win the
				// race. A handler with no deadline will hang and blow DEADLINE_MS,
				// which is exactly the failure this case exists to catch.
				await new Promise((resolve, reject) => {
					const id = setTimeout(resolve, hangMs);
					signal?.addEventListener("abort", () => {
						clearTimeout(id);
						reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
					});
				});
				return { text: "should never arrive" };
			},
		};
	},

	quotaExhausted() {
		return {
			async complete() {
				const err = new Error("insufficient_quota: credit balance is too low");
				err.status = 402;
				throw err;
			},
		};
	},

	malformedJson() {
		return {
			async complete() {
				// The shape that actually bites in production: HTTP 200, body is an
				// HTML error page or a truncated stream, so JSON.parse throws
				// somewhere deep inside the client rather than at the fetch.
				return JSON.parse("{\"content\":[{\"text\":\"trunca");
			},
		};
	},

	healthy() {
		return {
			async complete() {
				return { text: "Mark is a BS Information Technology student at Batangas State University." };
			},
		};
	},
};

/* ─── Shared assertions ─────────────────────────────────────────────────── */

function assertGraceful(res, label) {
	assert.ok(res, `${label}: handler resolved with nothing`);
	assert.equal(
		typeof res.status,
		"number",
		`${label}: response has no numeric status`,
	);
	assert.ok(
		res.status < 500,
		`${label}: returned ${res.status} — provider faults must not surface as server errors`,
	);

	const body = res.body ?? {};
	const message = body.answer ?? body.message ?? body.error ?? "";
	assert.equal(typeof message, "string", `${label}: no string message in body`);
	assert.ok(
		message.trim().length >= 10,
		`${label}: message is empty or too short to be a real fallback (${JSON.stringify(message)})`,
	);

	const serialised = JSON.stringify(res);
	for (const pattern of LEAK_PATTERNS) {
		assert.ok(
			!serialised.includes(pattern),
			`${label}: response leaks internal detail ${JSON.stringify(pattern)}`,
		);
	}
	return { body, message };
}

function assertDegradedSignalled(res, label) {
	const body = res.body ?? {};
	assert.ok(
		body.degraded === true || body.source === "static" || body.source === "fallback",
		`${label}: fallback must be signalled (degraded:true or source:'static'|'fallback') — ` +
			`a degraded answer presented as a normal one is worse than an error`,
	);
}

async function withDeadline(promise, label) {
	let timer;
	const guard = new Promise((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`${label}: exceeded ${DEADLINE_MS}ms — handler has no deadline of its own`)),
			DEADLINE_MS,
		);
	});
	try {
		return await Promise.race([promise, guard]);
	} finally {
		clearTimeout(timer);
	}
}

/* ─── Preflight ─────────────────────────────────────────────────────────── */

const present = contractStatus().handler;

test("assistant handler exists (preflight)", () => {
	assert.ok(
		present,
		`No handler at ${path.relative(ROOT, HANDLER_ENTRY)}.\n` +
			`  The resilience cases below are skipped until it exists, so this single\n` +
			`  failure is the only signal that the suite is not yet protecting anything.\n` +
			`  Point at it with HANDLER_ENTRY=path/to/handler.js`,
	);
});

const scenario = (name, fn) =>
	test(name, { skip: present ? false : "handler not implemented yet" }, fn);

/* ─── Cases ─────────────────────────────────────────────────────────────── */

scenario("provider 429: falls back without a 5xx", async () => {
	const { handleAssistantRequest } = await loadHandler();
	const res = await withDeadline(
		handleAssistantRequest({
			question: "What's his capstone project?",
			provider: providers.rateLimited(),
		}),
		"429",
	);
	assertGraceful(res, "429");
	assertDegradedSignalled(res, "429");
	assert.notEqual(res.status, 429, "429: do not pass the provider's status through to the visitor");
});

scenario("provider timeout: bounded by the handler's own deadline", async () => {
	const { handleAssistantRequest } = await loadHandler();
	const started = performance.now();
	const res = await withDeadline(
		handleAssistantRequest({
			question: "Tell me about his stack.",
			provider: providers.timeout(),
		}),
		"timeout",
	);
	const elapsed = performance.now() - started;

	assertGraceful(res, "timeout");
	assertDegradedSignalled(res, "timeout");
	assert.ok(
		elapsed < DEADLINE_MS,
		`timeout: took ${Math.round(elapsed)}ms; the handler must abort before the platform does`,
	);
});

scenario("quota exhausted: static answer, no billing detail exposed", async () => {
	const { handleAssistantRequest } = await loadHandler();
	const res = await withDeadline(
		handleAssistantRequest({
			question: "Where does he study?",
			provider: providers.quotaExhausted(),
		}),
		"quota",
	);
	const { message } = assertGraceful(res, "quota");
	assertDegradedSignalled(res, "quota");
	for (const word of ["quota", "credit", "balance", "billing"]) {
		assert.ok(
			!message.toLowerCase().includes(word),
			`quota: message mentions "${word}" — the visitor should not learn the owner's billing state`,
		);
	}
});

scenario("malformed provider JSON: parse failure is contained", async () => {
	const { handleAssistantRequest } = await loadHandler();
	const res = await withDeadline(
		handleAssistantRequest({
			question: "What certifications does he have?",
			provider: providers.malformedJson(),
		}),
		"malformed",
	);
	assertGraceful(res, "malformed");
	assertDegradedSignalled(res, "malformed");
});

scenario("5000-char input: rejected or truncated, never a 5xx", async () => {
	const { handleAssistantRequest } = await loadHandler();
	const huge = "a".repeat(5000);
	const res = await withDeadline(
		handleAssistantRequest({ question: huge, provider: providers.healthy() }),
		"oversized",
	);
	assertGraceful(res, "oversized");
	assert.ok(
		res.status === 200 || res.status === 400 || res.status === 413,
		`oversized: expected 200 (truncated), 400 or 413; got ${res.status}`,
	);
	assert.ok(
		!JSON.stringify(res).includes(huge),
		"oversized: the full 5000-char payload is echoed back — unbounded reflection",
	);
});

scenario("20-turn session: stays responsive and bounded", async () => {
	const { handleAssistantRequest } = await loadHandler();
	const history = [];
	const durations = [];

	for (let turn = 1; turn <= 20; turn++) {
		const question = `Question number ${turn}: what can you tell me about his projects?`;
		const t0 = performance.now();
		const res = await withDeadline(
			handleAssistantRequest({ question, history, provider: providers.healthy() }),
			`turn ${turn}`,
		);
		durations.push(performance.now() - t0);
		const { message } = assertGraceful(res, `turn ${turn}`);
		history.push({ role: "user", content: question }, { role: "assistant", content: message });
	}

	// Context is expected to be trimmed; if it is not, per-turn cost grows with
	// the transcript and turn 20 is measurably worse than turn 1.
	const firstFive = avg(durations.slice(0, 5));
	const lastFive = avg(durations.slice(-5));
	assert.ok(
		lastFive < firstFive * 4 + 50,
		`20-turn: latency grew from ${firstFive.toFixed(1)}ms to ${lastFive.toFixed(1)}ms — history is probably unbounded`,
	);
});

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

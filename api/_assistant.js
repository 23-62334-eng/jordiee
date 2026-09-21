/**
 * The assistant endpoint's policy layer.
 *
 * chat.js owns the conversation with the provider — prompt assembly, the
 * adapter, the deadline, and the degrade-instead-of-500 rule. This file owns
 * the two questions chat.js deliberately does not ask: is this visitor allowed
 * to send another message, and can the site still afford to answer it.
 *
 * It is a wrapper rather than an edit to chat.js so the core stays drivable on
 * its own (`HANDLER_ENTRY=api/chat.js npm run test:proxy` exercises it with no
 * policy in the way), and so a policy bug can never be the reason a visitor
 * sees a 500 — every path here resolves to a body with a sentence in it.
 *
 * ORDER OF CHECKS, and why this order:
 *
 *   1. rate limit   cheapest, and the only check whose job is to stop work from
 *                   happening at all. Runs before validation so a flood of
 *                   malformed 5000-char bodies is throttled on the same terms
 *                   as well-formed traffic.
 *   2. validate     rejects junk before it can consume budget.
 *   3. budget       reserves the upstream call, or trips the kill switch and
 *                   serves profile.json's faq[] instead.
 *   4. upstream     chat.js's core, which has its own deadline and fault path.
 *
 * A degraded answer is always SIGNALLED (`degraded: true` plus a `source`).
 * Presenting a static FAQ answer as though the model produced it would make the
 * site quietly less truthful under load, which is the opposite of the point.
 */

import {
	FALLBACK_MESSAGE,
	PROFILE,
	UPSTREAM_TIMEOUT_MS,
	handleAssistantRequest as core,
	validate,
} from "./chat.js";

/**
 * Re-exported because this file's request deadline IS the core's — every path
 * here either answers instantly from local state or delegates to core(), which
 * owns the clock. A contract test pointed at this entry can therefore read the
 * deadline it is actually bound by, instead of assuming one; tests/resilience
 * .test.js derives its watchdog from exactly this export, and without it the
 * suite silently fell back to a fixed 10s and failed a handler that was
 * behaving correctly at 20s.
 */
export { UPSTREAM_TIMEOUT_MS };

import { budget, createStaticAnswerer, limiter } from "./_limits.js";

/* ─── Module-scoped policy state ────────────────────────────────────────── */

/**
 * The limiter and budget are the shared instances from _limits.js, so this path
 * and the streaming path in chat.js count against the same allowance. See the
 * scope note there: per-instance, not cluster-wide.
 */
const answerer = createStaticAnswerer(PROFILE);

/** Ops/test seam — lets a caller reset or substitute policy state. */
export const __policy = { limiter, budget, answerer };

/* ─── Responses ─────────────────────────────────────────────────────────── */

/**
 * The degraded answer, preferring a real answer from profile.json over an
 * apology.
 *
 * `faq[]` is hand-written by the owner and already published on the page, so
 * serving it costs nothing and leaks nothing. When nothing matches well enough
 * the generic sentence is used instead — a wrong-but-confident FAQ entry is a
 * worse outcome than admitting the assistant is down.
 */
function staticAnswer(question, status = 200) {
	const hit = answerer.match(question);
	return {
		status,
		body: hit
			? { answer: hit.answer, degraded: true, source: "static" }
			: { answer: FALLBACK_MESSAGE, degraded: true, source: "fallback" },
	};
}

/**
 * Throttle response. 429 rather than 503: it is the visitor's request rate that
 * is the problem, it is temporary, and `retryAfterSec` tells them exactly how
 * temporary. No internal counter state travels — how close they are to the cap
 * is not information an abusive client should be given for free.
 */
function throttled(retryAfterSec) {
	const minutes = Math.ceil(retryAfterSec / 60);
	return {
		status: 429,
		retryAfterSec,
		body: {
			answer:
				`That's a lot of questions at once. Please wait about ` +
				`${minutes === 1 ? "a minute" : `${minutes} minutes`} and ask again — ` +
				`everything on the site is still browsable in the meantime.`,
			degraded: true,
			source: "throttled",
		},
	};
}

/* ─── Handler ───────────────────────────────────────────────────────────── */

/**
 * Resolves for every input and every fault. Never rejects, never returns 5xx,
 * never returns an empty body.
 *
 * @param {object}   req
 * @param {string}   req.question
 * @param {Array}    [req.history]
 * @param {object}   [req.provider]  injected by tests; production omits it
 * @param {AbortSignal} [req.signal]
 * @param {string}   [req.ip]        rate-limit key. Absent = not an HTTP
 *                                   request (direct core invocation, tests), so
 *                                   there is no identity to limit and the check
 *                                   is skipped. The HTTP layer in chat.js
 *                                   always supplies one.
 */
export async function handleAssistantRequest({
	question,
	history = [],
	provider,
	signal,
	ip,
} = {}) {
	try {
		if (ip) {
			const verdict = limiter.check(String(ip));
			if (!verdict.allowed) return throttled(verdict.retryAfterSec);
		}

		const check = validate({ question, history });
		if (!check.ok) {
			return { status: check.status, body: { answer: check.message, degraded: false } };
		}

		// Kill switch. Checked before the call, because a budget consulted
		// afterwards is a report rather than a control.
		if (!budget.reserve().allowed) return staticAnswer(check.question);

		const res = await core({
			question: check.question,
			history: check.history,
			provider,
			signal,
		});

		// The core degrades to a generic sentence on any provider fault. If the
		// question is one profile.json already answers, upgrade that to the real
		// answer — same failure, strictly more useful, still flagged degraded.
		if (res?.body?.degraded) {
			const better = staticAnswer(check.question, res.status);
			if (better.body.source === "static") return better;
		}

		// Defence in depth: a core that somehow returns 5xx or an empty answer is
		// a bug, but the visitor should still get a sentence rather than inherit
		// it. This is the last line before the response leaves the process.
		const answer = res?.body?.answer;
		if (!res || res.status >= 500 || typeof answer !== "string" || answer.trim() === "") {
			return staticAnswer(check.question);
		}

		return res;
	} catch {
		// Includes anything thrown by the policy code itself. The visitor's
		// experience must not depend on this file being correct.
		return staticAnswer(question);
	}
}

export default handleAssistantRequest;

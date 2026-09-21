/**
 * Abuse and cost controls for the assistant endpoint.
 *
 * Deliberately free of any dependency on chat.js: the HTTP handler there and
 * the policy wrapper in _assistant.js both import this, and a back-edge to
 * chat.js would make that a cycle. Everything here is pure state + clock, with
 * `now` and the backing store injectable so the behaviour can be driven in
 * tests without sleeping through a real ten-minute window.
 *
 * SCOPE HONESTY — read before trusting the budget as a hard cap.
 *
 * These counters live in the memory of one serverless instance. Vercel runs
 * several concurrently and recycles them freely, so:
 *   - the rate limiter is per-instance, and a visitor spread across N instances
 *     can get up to N x the nominal allowance before being throttled;
 *   - the daily budget is a floor on what has been spent, never an exact total,
 *     and it resets whenever an instance is recycled.
 *
 * That is still worth having — it stops the common case, which is one client
 * looping on one connection — but it is not a billing guarantee. A real global
 * cap needs shared storage (Vercel KV, Upstash, Redis). The `store` seam below
 * is the whole reason this is written as a factory: swapping in a KV-backed
 * store is a constructor argument, not a rewrite. Until that is wired, treat
 * the provider's own dashboard cap as the actual ceiling and this as the thing
 * that keeps you from reaching it.
 */

/* ─── Defaults ──────────────────────────────────────────────────────────── */

/** 10 messages per 10 minutes per IP. */
export const RATE_LIMIT = Number(process.env.ASSISTANT_RATE_LIMIT ?? 10);
export const RATE_WINDOW_MS = Number(process.env.ASSISTANT_RATE_WINDOW_MS ?? 10 * 60 * 1000);

/**
 * Upstream calls allowed per UTC day before the kill switch engages.
 *
 * Denominated in requests rather than currency because requests are what this
 * process can actually observe — inferring spend would mean hardcoding a price
 * per token that goes stale the next time the provider reprices.
 */
export const DAILY_BUDGET = Number(process.env.ASSISTANT_DAILY_BUDGET ?? 500);

/**
 * Fraction of the budget at which live calls stop and static answers take over.
 *
 * Below 1.0 on purpose: tripping at 100% means the visitor who exhausts the
 * quota is the one who gets the error, and every visitor after them too. Kill
 * at 80% and the last fifth is headroom — enough to keep answering the common
 * questions from profile.json while there is still quota left to recover with.
 */
export const BUDGET_THRESHOLD = Number(process.env.ASSISTANT_BUDGET_THRESHOLD ?? 0.8);

/* ─── Rate limiter ──────────────────────────────────────────────────────── */

/**
 * Sliding-window limiter.
 *
 * A fixed window would let a visitor send `limit` messages at 09:59:59 and
 * `limit` more at 10:00:00 — double the intended rate across the boundary,
 * which is exactly the burst the limit exists to prevent. Storing the
 * timestamps costs `limit` numbers per active key and removes the edge.
 */
export function createRateLimiter({
	limit = RATE_LIMIT,
	windowMs = RATE_WINDOW_MS,
	now = Date.now,
	maxKeys = 10_000,
} = {}) {
	/** @type {Map<string, number[]>} key -> hit timestamps, oldest first */
	const hits = new Map();

	/**
	 * Drop keys whose entire window has expired. Called on insert rather than on
	 * a timer: a serverless instance can be frozen between requests, so a timer
	 * is not guaranteed to fire, while an insert is the only moment the map can
	 * actually grow.
	 */
	const sweep = (cutoff) => {
		for (const [key, stamps] of hits) {
			const live = stamps.filter((ts) => ts > cutoff);
			if (live.length === 0) hits.delete(key);
			else hits.set(key, live);
		}
	};

	return {
		/**
		 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
		 */
		check(key) {
			const t = now();
			const cutoff = t - windowMs;

			// An unbounded Map is a memory leak with a slow fuse; a flood of unique
			// keys is also the shape of the attack this module exists to blunt.
			if (hits.size >= maxKeys) sweep(cutoff);

			const live = (hits.get(key) ?? []).filter((ts) => ts > cutoff);

			if (live.length >= limit) {
				hits.set(key, live);
				// Capacity returns when the oldest hit leaves the window.
				const waitMs = live[0] + windowMs - t;
				return {
					allowed: false,
					remaining: 0,
					retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)),
				};
			}

			live.push(t);
			hits.set(key, live);
			return { allowed: true, remaining: limit - live.length, retryAfterSec: 0 };
		},

		/** Testing/ops seam. */
		reset() {
			hits.clear();
		},
		size() {
			return hits.size;
		},
	};
}

/* ─── Daily budget ──────────────────────────────────────────────────────── */

/** UTC date key. UTC, not local: the reset must not move with the deploy region. */
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Global counter of upstream calls for the current UTC day, with a kill switch
 * that engages at `threshold` of `limit`.
 *
 * Consumption is a RESERVATION taken before the upstream call, not a receipt
 * written after it. A call that is issued and then times out still cost money
 * and still counted against the provider's quota; crediting it back because it
 * failed would let a failing provider drain the budget without ever moving the
 * counter.
 */
export function createDailyBudget({
	limit = DAILY_BUDGET,
	threshold = BUDGET_THRESHOLD,
	now = Date.now,
} = {}) {
	const cap = Math.max(0, Math.floor(limit * threshold));
	let day = dayKey(now());
	let used = 0;

	const roll = () => {
		const today = dayKey(now());
		if (today !== day) {
			day = today;
			used = 0;
		}
	};

	return {
		/** True once the kill switch has engaged for today. */
		tripped() {
			roll();
			return used >= cap;
		},

		/**
		 * Reserve one upstream call.
		 * @returns {{ allowed: boolean, used: number, cap: number, limit: number }}
		 */
		reserve() {
			roll();
			if (used >= cap) return { allowed: false, used, cap, limit };
			used += 1;
			return { allowed: true, used, cap, limit };
		},

		state() {
			roll();
			return { day, used, cap, limit, tripped: used >= cap };
		},

		reset() {
			day = dayKey(now());
			used = 0;
		},
	};
}

/* ─── Shared instances ──────────────────────────────────────────────────── */

/**
 * The limiter and budget the endpoint actually uses, created once here rather
 * than in each entry point.
 *
 * Both the streaming HTTP handler in chat.js and the policy wrapper in
 * _assistant.js consult these, and they have to be the SAME objects: two
 * instances would mean a visitor throttled on one path and free on the other,
 * and a budget that trips at 160% of the intended spend because each half
 * counted to 80% on its own. They live here, in the module neither entry point
 * imports from the other, because that is the only place both can reach without
 * an import cycle.
 */
export const limiter = createRateLimiter();
export const budget = createDailyBudget();

/* ─── Static answers ────────────────────────────────────────────────────── */

const STOPWORDS = new Set([
	"a", "an", "and", "are", "as", "at", "be", "can", "did", "do", "does", "for",
	"from", "has", "have", "he", "her", "him", "his", "how", "i", "in", "is",
	"it", "me", "my", "of", "on", "or", "s", "she", "tell", "that", "the",
	"their", "them", "they", "this", "to", "us", "was", "we", "what", "when",
	"where", "which", "who", "why", "with", "you", "your",
]);

const tokenize = (text) =>
	String(text ?? "")
		.normalize("NFKC")
		.toLocaleLowerCase("en")
		.split(/[^\p{L}\p{N}+#.]+/u)
		.map((w) => w.replace(/^[.]+|[.]+$/g, ""))
		.filter((w) => w.length > 1 && !STOPWORDS.has(w));

/**
 * Answer from profile.json's `faq[]` alone — no model, no network.
 *
 * This is what the site falls back to when the budget trips, so the bar is
 * "recognisably answers the question or admits it cannot", not "as good as the
 * model". Matching is deliberately dumb: overlap between the visitor's content
 * words and the FAQ entry's, scored against the entry so a long answer does not
 * win by sheer length. Anything below the floor returns null and the caller
 * says it cannot answer, which is a better failure than confidently returning
 * the nearest unrelated FAQ.
 */
export function createStaticAnswerer(profile, { floor = 0.34 } = {}) {
	const entries = (profile?.faq ?? []).map((f) => {
		const qTokens = new Set(tokenize(f.question));
		const aTokens = new Set(tokenize(f.answer));
		return { question: f.question, answer: f.answer, qTokens, aTokens };
	});

	return {
		/**
		 * @returns {{ answer: string, matched: string, score: number } | null}
		 */
		match(question) {
			const asked = tokenize(question);
			if (asked.length === 0 || entries.length === 0) return null;

			let best = null;
			for (const e of entries) {
				if (e.qTokens.size === 0) continue;
				// Question tokens carry the intent; answer tokens only break ties,
				// at a discount, so "capstone" in a body cannot outrank a real
				// question match.
				let hits = 0;
				let softHits = 0;
				for (const w of asked) {
					if (e.qTokens.has(w)) hits += 1;
					else if (e.aTokens.has(w)) softHits += 1;
				}
				if (hits === 0) continue;

				// Normalised against the FAQ question, so a short precise entry is
				// not penalised for the visitor's verbosity.
				const score = (hits + softHits * 0.25) / e.qTokens.size;
				if (!best || score > best.score) {
					best = { answer: e.answer, matched: e.question, score };
				}
			}

			return best && best.score >= floor ? best : null;
		},

		size() {
			return entries.length;
		},
	};
}

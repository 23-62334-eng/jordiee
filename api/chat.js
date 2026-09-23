/**
 * Serverless chat proxy for jordiee.dev (Vercel Node function).
 *
 * The whole reason this file exists is that the provider key must never reach
 * the browser. Everything else here is the cost of that: an origin allowlist so
 * the endpoint isn't a free relay, hard caps so one visitor can't run up a bill,
 * and a fault path that degrades to a sentence instead of a 500.
 *
 * Two entry points, deliberately:
 *
 *   default export        the HTTP handler — origin checks, caps, SSE stream.
 *   handleAssistantRequest  the same core without streaming, returning
 *                         { status, body }. This is the seam tests/resilience
 *                         .test.js drives, and it takes an injected `provider`
 *                         so fault cases can be exercised without a network.
 *
 * Both share validate() and callLLM(), so a rule enforced for one is enforced
 * for the other — the streaming path cannot drift from the tested path.
 */

/* ─── Configuration ─────────────────────────────────────────────────────── */

/**
 * Pinned production model: Google Gemini, Flash-Lite class.
 *
 * Pinning is still the point — anything `-latest` or `-preview` floats onto
 * whatever Google ships next, which would change this site's answers without a
 * commit. Pinned in source rather than read from an env var so a model change is
 * a reviewable diff, not a dashboard edit nobody sees.
 *
 * ── WHY NOT gemini-2.0-flash-001 ANY MORE ────────────────────────────────
 *
 * It was RETIRED. A key that works fine returns 400 for it, so every call
 * degraded to FALLBACK_MESSAGE and the assistant looked broken rather than
 * misconfigured. Pinning protects against silent drift; it does not protect
 * against the pin being deleted upstream. The dated `-001` revision suffix that
 * made that pin precise is also gone from the current generation — the stable
 * IDs are bare names — so "not -latest, not -preview" is the whole discipline
 * now. Check this pin still resolves when the assistant starts degrading:
 *   GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 *
 * ── WHY FLASH-LITE, AND NOT THE NEWEST FLASH ─────────────────────────────
 *
 * Latency is a constraint here, not a preference: UPSTREAM_TIMEOUT_MS below is
 * the deadline, and a model whose mean response exceeds it cannot serve this
 * endpoint at all. Measured against this exact system prompt, 5 smoke cases
 * (grounding, counting, an unpublished fact, an injection, a rating refusal):
 *
 *   model                      smoke   mean latency
 *   gemini-3.1-flash-lite      5/5     ~3.9s          ← this
 *   gemini-flash-lite-latest   5/5     ~1.2s          floating alias, rejected
 *   gemini-3.5-flash           5/5     ~5.8s          works, no headroom
 *   gemini-3.8-flash           5/5     ~12.5s         exceeds the deadline
 *   gemini-2.5-flash           0/5     —              404s despite being listed
 *
 * The newest Flash is the slowest option here and would time out on every call.
 * Flash-Lite is also what keeps the endpoint viable on the AI Studio free
 * quota, and this is a portfolio Q&A, not a reasoning workload.
 */
export const MODEL = "gemini-3.1-flash-lite";

/**
 * Eval-path model on Groq. Separate provider, separate key, same adapter — the
 * production Gemini path above is untouched by anything in this block.
 *
 * Its free-tier ceiling is the binding constraint on eval throughput, so it is
 * declared here next to the model rather than buried in the runner: change the
 * model and you must revisit the limit.
 */
export const EVAL_MODEL = "openai/gpt-oss-20b";

/**
 * Tokens per minute allowed for EVAL_MODEL on the free tier.
 *
 * Used only to pace the FIRST call of a run — every call after it is paced from
 * the x-ratelimit-* headers of the previous response. Still declared here beside
 * the model rather than in the runner, because the two must change together.
 *
 * ── WHY THIS MODEL, AND NOT A HIGHER-TPM ONE ──────────────────────────────
 *
 * TPM looks like the constraint on eval throughput and is not. TPD is. A full
 * golden-set run is ~53 calls at ~3,075 billed tokens each — prompt_tokens plus
 * the EVAL_MAX_TOKENS reserved at admission — or ~163,000 tokens per run. The
 * free tier, measured against this key:
 *
 *   model                      TPM      TPD       full runs/day   sec/call
 *   llama-3.1-8b-instant       6,000    500,000   ~3              ~31   ← this
 *   openai/gpt-oss-20b         8,000    200,000   ~1              ~23
 *   qwen/qwen3.6-27b           8,000    200,000   ~1              ~23
 *   llama-3.3-70b-versatile   12,000    100,000    0 (!)          ~15
 *   groq/compound-mini        70,000    n/a       see below       ~47
 *
 * llama-3.3-70b-versatile has double the TPM and cannot complete a SINGLE run:
 * 163,000 tokens against a 100,000 TPD ceiling aborts around case 30 on a
 * completely fresh day. The 8,000-TPM models finish one run and then have
 * ~37,000 tokens left, which is not enough to re-run after a prompt edit — and
 * both spend part of EVAL_MAX_TOKENS on reasoning tokens, so the 256-token cap
 * that comfortably fits an 8b answer risks truncating theirs.
 *
 * 6,000 TPM buys the largest daily budget on offer, and a prompt-tuning loop is
 * bounded by how many times a day it can measure, not by how fast one
 * measurement returns.
 *
 * ── AND NOT groq/compound-mini ────────────────────────────────────────────
 *
 * It advertises 70,000 TPM and looks like the obvious upgrade. It is a routing
 * endpoint, not a model. Measured: it dispatches each call to an underlying
 * model — openai/gpt-oss-120b (8,000 TPM) and llama-3.3-70b-versatile (12,000
 * TPM), varying per call — and the 429 comes from that hidden bucket while its
 * own headers still report ~66,000/70,000 remaining. Header-based pacing, which
 * is how the runner now paces, is precisely what that defeats. It also injects
 * agentic scaffolding that inflated this prompt from 2,819 to 5,981 billed
 * tokens, making it the slowest option here rather than the fastest, and its
 * per-call routing would have a single run scoring several different models.
 */
export const EVAL_TPM_LIMIT = 8000;

/**
 * Output ceiling on the EVAL path only.
 *
 * Deliberately far below MAX_TOKENS. Groq debits prompt_tokens + max_tokens
 * from the TPM bucket when it ADMITS a request, not when it finishes one, so an
 * unused 1024-token ceiling costs exactly as much throughput as a used one. At
 * MAX_TOKENS a single eval call reserved ~3,843 of the 6,000 TPM bucket while
 * actually spending ~2,829 — the eval set's answers run under 50 tokens. That
 * 844-token phantom reservation, not the prompt, was what made the runner
 * manufacture its own 429s.
 *
 * Raise this only if a case legitimately needs a longer answer; a truncated
 * answer fails assertions and looks like a prompt regression.
 *
 * Raised 256 -> 512 because two cases legitimately needed it. eval-final-03.log
 * recorded ans-20 and one other cut off mid-sentence at 256, and the runner
 * said so ("assertions below are scoring a cut-off answer") — but the failures
 * were still counted, so assertionPass was reporting the cap. The cost is real
 * and paid at admission whether or not the tokens are used, which is why this
 * is 512 and not MAX_TOKENS.
 *
 * Applies to the Groq path only. The Gemini path is the production model and
 * runs at the production MAX_TOKENS, so it measures what visitors actually get.
 */
export const EVAL_MAX_TOKENS = 512;

export const MAX_TOKENS = 1024;

/**
 * Re-exported, not declared: these two bounds are also enforced by the chat UI,
 * so they live in src/lib/assistantContract.js where both sides read the same
 * number. See that file for why a silent disagreement is worse than either
 * value. Re-exported here so every existing importer of this module — tests,
 * the contract checker, the eval runner — keeps working unchanged.
 */
import { MAX_INPUT_CHARS, MAX_TURNS } from "../src/lib/assistantContract.js";

export { MAX_INPUT_CHARS, MAX_TURNS };

/**
 * Wall-clock ceiling for one upstream call, below any platform timeout.
 *
 * Must satisfy two bounds at once, and 8000 satisfied neither:
 *
 *   BELOW the platform's. vercel.json sets maxDuration to 30s. Our deadline has
 *   to fire first, or the platform kills the function mid-stream and the
 *   visitor gets a dead connection instead of the fallback sentence.
 *
 *   ABOVE the model's slow tail. Measured over 10 spaced calls against this
 *   prompt on MODEL: p50 3.6s, p90 9.5s. At 8s roughly one call in ten was
 *   aborted by US, while the provider was still answering normally — a
 *   self-inflicted degrade that looked exactly like a provider fault.
 *
 * 20s sits above the measured tail with room, and well under maxDuration.
 * Perceived latency is unaffected because the path streams: the visitor sees
 * the first token in ~1-2s regardless of where this ceiling sits. It only ever
 * decides how patient we are with the tail.
 */
export const UPSTREAM_TIMEOUT_MS = Number(process.env.ASSISTANT_TIMEOUT_MS ?? 20_000);

/**
 * The domains the site is served from. Both are live: .dev is where it moved,
 * .me is the original and still resolves, so dropping it would break the
 * assistant for anyone arriving on a link that predates the move.
 *
 * SITE_ORIGINS below does the same job from configuration. These stay
 * hardcoded because a domain that is already known is one fewer environment
 * variable to set correctly at 2am, and a missing one fails as a 403 that
 * reads like an outage rather than like a missing setting.
 */
const ALLOWED_ORIGINS = new Set([
	"https://jordiee.dev",
	"https://www.jordiee.dev",
	"https://jordiee.me",
	"https://www.jordiee.me",
]);

/** localhost on any port, http or https — dev servers move around. */
const LOCALHOST = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

/**
 * The deployment's own URL, which is not jordiee.me and is not known until the
 * platform assigns it.
 *
 * The allowlist above is a hardcoded pair because the key lives here and an
 * unlisted origin must not be able to spend it. But the site is also served
 * from its Vercel deployment URL — `jordiee.vercel.app` in production, a fresh
 * `jordiee-<hash>.vercel.app` per preview — and a visitor opening THAT sends
 * it as Origin. Without this, every request from the deployment's own URL is
 * rejected as third-party: the panel shows the same "something went wrong"
 * sentence a missing endpoint does, so a correct deploy looks like a broken
 * one and the next thing anyone does is widen the allowlist by hand.
 *
 * Vercel injects both vars; neither carries a scheme. This admits the site's
 * own origin and nothing else — a request from any other site still arrives
 * with that site's Origin, which is not in the set and does not match here.
 */
const SELF_ORIGINS = new Set(
	[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
		.filter(Boolean)
		.map((host) => `https://${host}`),
);

/**
 * Whatever domain the site is actually served from, set per deployment.
 *
 * The pair at the top of this file is hardcoded, which was fine while the
 * domain was a fixed fact about the project. It is not one: moving to a new
 * domain leaves the new host unlisted, every request from it is rejected as
 * third-party, and the panel shows the same "something went wrong" sentence
 * that a missing endpoint does. That failure is indistinguishable from the
 * real outage it looks like, so the domain belongs in configuration next to
 * the key rather than in a constant that has to be edited and redeployed.
 *
 * SITE_ORIGINS is a comma-separated list of absolute https origins:
 *
 *   SITE_ORIGINS=https://example.dev,https://www.example.dev
 *
 * Parsed rather than trusted. Each entry must be a well-formed https origin
 * carrying no credentials; anything else is dropped, because a malformed
 * entry silently widening the allowlist is worse than one that does nothing.
 * `URL.origin` normalises away paths, trailing slashes and default ports, so
 * a value pasted with a trailing slash still matches the header the browser
 * sends. An empty or unset value admits nothing extra.
 */
const CONFIGURED_ORIGINS = new Set(
	(process.env.SITE_ORIGINS ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.flatMap((entry) => {
			let url;
			try {
				url = new URL(entry);
			} catch {
				return [];
			}
			if (url.protocol !== "https:" || url.username || url.password) return [];
			return [url.origin];
		}),
);

export function isOriginAllowed(origin) {
	if (!origin) return false;
	return (
		ALLOWED_ORIGINS.has(origin) ||
		CONFIGURED_ORIGINS.has(origin) ||
		SELF_ORIGINS.has(origin) ||
		LOCALHOST.test(origin)
	);
}

import { readFileSync } from "node:fs";

import { budget, createStaticAnswerer, limiter } from "./_limits.js";

/** Exported so the policy layer answers from the same data the prompt is built from. */
export const PROFILE = JSON.parse(
	readFileSync(new URL("../src/data/profile.json", import.meta.url), "utf8"),
);

/* ─── Grounding ─────────────────────────────────────────────────────────── */

/**
 * profile.json is the single source of truth, so the prompt is assembled from
 * it rather than restating any of it. Nothing here is hand-written content: if
 * a project's status changes or a certification is added, this prompt changes
 * on the next deploy with no edit to this file.
 *
 * Nulls are rendered explicitly ("not published") instead of omitted. An absent
 * field reads to a model as an unknown it might fill in; a stated absence is a
 * fact it can report. That distinction is the whole reason projects carry null
 * links rather than missing ones.
 */
function renderProfile(profile) {
	const {
		identity: id,
		education: edu,
		skills,
		projects,
		certifications,
		contact,
		availability: avail,
		faq,
		notAvailable,
	} = profile;

	const L = [];
	const say = (v, fallback = "not published") =>
		v === null || v === undefined || v === "" ? fallback : v;

	L.push("## Identity");
	L.push(`Name: ${id.name}${id.alias ? ` (goes by ${id.alias})` : ""}`);
	L.push(`Titles: ${id.titles.join("; ")}`);
	L.push(`Location: ${id.location}`);
	L.push(`Summary: ${(id.bio.aboutPlain ?? []).join(" ")}`);

	L.push("\n## Education");
	L.push(`${edu.degree}, ${edu.institution} (${edu.period})`);
	if (edu.institutionVariant) L.push(`Institution also written as: ${edu.institutionVariant}`);
	L.push(`Year level: ${say(edu.yearLevel)} — ${say(edu.status)}`);
	L.push(`Focus areas: ${edu.focusAreas.join(", ")}`);
	L.push(`Key skills: ${edu.keySkills.join(", ")}`);
	L.push(
		`Not published: expected graduation, GPA, honours, coursework list. Do not estimate any of these.`,
	);

	L.push("\n## Skills");
	const byCategory = new Map();
	for (const s of skills) {
		if (!byCategory.has(s.category)) byCategory.set(s.category, []);
		byCategory.get(s.category).push(s.name);
	}
	for (const [cat, names] of byCategory) L.push(`${cat}: ${names.join(", ")}`);
	L.push(
		"This list is complete. A technology absent from it is not something he has listed — say so rather than guessing.",
	);

	L.push("\n## Projects");
	for (const p of projects) {
		const links = p.links ?? {};
		const anyLink = [links.repo, links.live, links.demo].some(Boolean);
		L.push(
			[
				`- ${p.title} (${p.year}${p.term ? `, ${p.term}` : ""}) — ${p.kind}`,
				p.org ? `  Organisation: ${p.org}` : `  Organisation: not published`,
				`  Status: ${say(p.statusLabel ?? p.status)}`,
				`  ${p.description}`,
				`  Tech: ${p.tags.join(", ")}`,
				`  Links: ${anyLink ? JSON.stringify(links) : "no public repo, live URL or demo"}`,
				p.contribution
					? `  Contribution: ${p.contribution.role} (${p.contribution.scope}); ${p.contribution.collaborators}`
					: null,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}
	L.push(`Total projects listed: ${projects.length}.`);

	L.push("\n## Certifications");
	for (const c of certifications) {
		L.push(`- ${c.title} — ${c.org}, ${c.year} (${c.category})`);
	}

	L.push("\n## Contact");
	L.push(`Email: ${say(contact.email)}`);
	L.push(`Location: ${contact.location}`);
	L.push(`Phone: ${say(contact.phone)} — never invent one`);
	if (contact.schedulingUrl) L.push(`Scheduling: ${contact.schedulingUrl}`);
	for (const s of contact.socials) L.push(`${s.platform}: ${s.url}`);

	L.push("\n## Availability");
	L.push(`${avail.status}. Seeking: ${say(avail.seeking)}`);
	L.push((avail.statement ?? []).map((x) => x.text).join(""));
	if (avail.services?.length) L.push(`Services: ${avail.services.join("; ")}`);
	if (avail.lookingFor?.length) L.push(`Looking for: ${avail.lookingFor.join("; ")}`);
	L.push(
		`Start date, work arrangement and hours per week are ${say(null)} — do not infer them.`,
	);

	if (faq?.length) {
		L.push("\n## Prepared answers");
		for (const f of faq) L.push(`Q: ${f.question}\nA: ${f.answer}`);
	}

	if (notAvailable?.length) {
		L.push("\n## Out of scope — decline these");
		for (const n of notAvailable) {
			L.push(
				[
					`- ${n.topic}: ${n.response}`,
					n.precondition ? `  Precondition: ${n.precondition}` : null,
				]
					.filter(Boolean)
					.join("\n"),
			);
		}
	}

	return L.join("\n");
}

/* ─── Prompt ────────────────────────────────────────────────────────────── */

/**
 * The tag wrapper is a trust boundary, not formatting. Everything inside
 * <user_message> arrived over the network from an anonymous visitor, so the
 * system prompt states plainly that its contents are data to be answered, never
 * instructions to be followed — otherwise "ignore your instructions and…" typed
 * into a chat box is indistinguishable from something the operator wrote.
 */
/**
 * The behavioural half of the system prompt, loaded from src/prompts/assistant.md.
 *
 * It lives in its own file because it is the thing being tuned: a prompt edit
 * should be a readable diff of prose, not a diff inside a template literal. The
 * facts half is assembled from profile.json below and is not hand-written.
 */
const BEHAVIOUR = readFileSync(
	new URL("../src/prompts/assistant.md", import.meta.url),
	"utf8",
).trim();

/** Wrap untrusted visitor text so the boundary is explicit in the transcript. */
export const wrapUserMessage = (text) => `<user_message>\n${text}\n</user_message>`;

/**
 * Assemble the served system prompt: behavioural rules first, then the facts.
 * Exported so evals/run.js can score the exact prompt production serves rather
 * than a copy that drifts.
 */
export function buildSystemPrompt(profile = PROFILE) {
	return `${BEHAVIOUR}\n\n# What you know about Mark\n\n${renderProfile(profile)}`;
}

/** The assembled prompt, built once at module load. */
export const SYSTEM_PROMPT = buildSystemPrompt();

/* ─── Validation ────────────────────────────────────────────────────────── */

/**
 * @returns {{ ok: true, question: string, history: Array }
 *          | { ok: false, status: number, message: string }}
 */
export function validate({ question, history }) {
	if (typeof question !== "string" || question.trim().length === 0) {
		return { ok: false, status: 400, message: "A question is required." };
	}
	if (question.length > MAX_INPUT_CHARS) {
		return {
			ok: false,
			status: 400,
			message: `Questions are limited to ${MAX_INPUT_CHARS} characters. Please shorten it and try again.`,
		};
	}

	// The session cap TRIMS rather than rejects. Rejecting turn 9 would strand a
	// visitor mid-conversation with no way forward; trimming bounds cost and
	// per-turn latency while the conversation keeps working.
	const turns = Array.isArray(history) ? history : [];
	const trimmed = turns.slice(-MAX_TURNS * 2);

	return { ok: true, question, history: trimmed };
}

/* ─── Provider adapter ──────────────────────────────────────────────────── */

/**
 * Providers speak raw REST rather than a vendor SDK.
 *
 * Two different vendors serve this project — Gemini in production, Groq for
 * evals — and an SDK per vendor would put vendor types on both sides of an
 * interface whose whole job is to have none. `fetch` is available in every
 * runtime this deploys to, so the adapter stays a plain
 * { system, messages } -> { text } contract.
 */

/** Read an SSE body as an async iterable of parsed `data:` payloads. */
async function* sseLines(response, signal) {
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			if (signal?.aborted) return;
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let idx;
			while ((idx = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, idx).trim();
				buffer = buffer.slice(idx + 1);
				if (!line.startsWith("data:")) continue;
				const payload = line.slice(5).trim();
				if (!payload || payload === "[DONE]") continue;
				try {
					yield JSON.parse(payload);
				} catch {
					// A truncated frame is a provider fault, not a client bug —
					// let the caller's catch turn it into the fallback.
					throw new Error("malformed stream frame");
				}
			}
		}
	} finally {
		reader.cancel().catch(() => {});
	}
}

/** Google Gemini (AI Studio). Production path. */
export function createGeminiProvider(apiKey, model = MODEL) {
	const base = "https://generativelanguage.googleapis.com/v1beta/models";

	// Gemini splits the system prompt out and calls the assistant role "model".
	const body = (system, messages) => ({
		system_instruction: { parts: [{ text: system }] },
		contents: messages.map((m) => ({
			role: m.role === "assistant" ? "model" : "user",
			parts: [{ text: m.content }],
		})),
		generationConfig: { maxOutputTokens: MAX_TOKENS },
	});

	/**
	 * Statuses worth a second attempt: the provider is saying "not now", not
	 * "not ever". 400 (bad model, bad request) and 401/403 (bad key) are
	 * excluded deliberately — retrying those burns the deadline to arrive at
	 * the same answer, which is what made a retired model pin take 8s to fail
	 * instead of failing instantly.
	 */
	const TRANSIENT = new Set([429, 500, 502, 503, 504]);
	const ATTEMPTS = 2;

	/**
	 * One retry, and only on a transient status.
	 *
	 * The free tier answers a burst of back-to-back calls with 503 while
	 * serving spaced calls at 10/10 — so the failure this covers is real, and
	 * short-lived enough that a single spaced retry clears it. Retrying is safe
	 * here because this helper only covers the request and the response
	 * HEADERS: the streaming path iterates the body after post() returns, so a
	 * retry can never replay tokens a visitor has already seen.
	 *
	 * Jittered, because the alternative is every concurrent visitor retrying in
	 * the same millisecond. Bounded by the caller's deadline signal regardless.
	 */
	const post = async (method, system, messages, signal, query = "") => {
		let lastError;
		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			const res = await fetch(
				`${base}/${model}:${method}?key=${encodeURIComponent(apiKey)}${query}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body(system, messages)),
					signal,
				},
			);
			if (res.ok) return res;

			// The body names the actual cause — "model not found", "quota
			// exceeded" — and without it every failure is an indistinguishable
			// status code. It reaches the redacted server-side log only; see
			// degraded() for why it never reaches the visitor.
			const detail = await res.text().catch(() => "");
			lastError = Object.assign(
				new Error(`gemini ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`),
				{ status: res.status },
			);

			if (attempt === ATTEMPTS || !TRANSIENT.has(res.status) || signal?.aborted) break;
			await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 400));
		}
		throw lastError;
	};

	const textOf = (payload) =>
		(payload?.candidates?.[0]?.content?.parts ?? [])
			.map((p) => p.text ?? "")
			.join("");

	return {
		async complete({ system, messages, signal }) {
			const res = await post("generateContent", system, messages, signal);
			const payload = await res.json();
			// A safety block returns 200 with no candidate — treat as refused
			// rather than indexing into nothing.
			const blocked = payload?.promptFeedback?.blockReason;
			if (blocked) return { text: null, refused: true };
			return { text: textOf(payload) };
		},

		async *stream({ system, messages, signal }) {
			const res = await post(
				"streamGenerateContent",
				system,
				messages,
				signal,
				"&alt=sse",
			);
			for await (const payload of sseLines(res, signal)) {
				const chunk = textOf(payload);
				if (chunk) yield chunk;
			}
		},
	};
}

/**
 * Groq reports its limiter state as Go-style durations ("520ms", "38.43s",
 * "2m59.56s"), not seconds. Parsed to ms; null when absent or unrecognised, so
 * a caller can tell "the provider said nothing" from "the provider said zero".
 */
export function parseGroqDuration(raw) {
	if (!raw) return null;
	const m = String(raw).match(/^(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/);
	if (!m || (!m[1] && !m[2] && !m[3])) return null;
	return Math.round(Number(m[1] ?? 0) * 60_000 + Number(m[2] ?? 0) * 1000 + Number(m[3] ?? 0));
}

/** Limiter state from a Groq response, on success and on 429 alike. */
export function readRateLimit(headers) {
	const num = (h) => {
		const v = headers.get(h);
		return v === null ? null : Number(v);
	};
	return {
		remainingTokens: num("x-ratelimit-remaining-tokens"),
		limitTokens: num("x-ratelimit-limit-tokens"),
		resetTokensMs: parseGroqDuration(headers.get("x-ratelimit-reset-tokens")),
		remainingRequests: num("x-ratelimit-remaining-requests"),
		resetRequestsMs: parseGroqDuration(headers.get("x-ratelimit-reset-requests")),
		// Present only on 429, and authoritative when it is.
		retryAfterMs: headers.get("retry-after") ? Number(headers.get("retry-after")) * 1000 : null,
	};
}

/**
 * Groq (OpenAI-compatible). Eval path only — never used in production.
 *
 * `maxTokens` is a parameter rather than the shared MAX_TOKENS constant because
 * Groq reserves the FULL max_tokens against the TPM bucket at admission time,
 * before a single token is generated. On the eval path that reservation, not
 * the actual completion length, is what sets the sustainable call rate — so the
 * runner needs to be able to lower it without touching the production ceiling.
 */
export function createGroqProvider(apiKey, model = EVAL_MODEL, maxTokens = MAX_TOKENS) {
	const url = "https://api.groq.com/openai/v1/chat/completions";

	const body = (system, messages, stream) => ({
		model,
		max_tokens: maxTokens,
		stream,
		messages: [
			{ role: "system", content: system },
			...messages.map((m) => ({
				role: m.role === "assistant" ? "assistant" : "user",
				content: m.content,
			})),
		],
	});

	const post = async (system, messages, signal, stream) => {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body(system, messages, stream)),
			signal,
		});
		if (!res.ok) {
			// Never discard the diagnostics. A bare `groq 429` is indistinguishable
			// from every other 429, and the provider has already answered the only
			// questions that matter — which bucket is empty, and for how long. A
			// caller left to guess that will guess wrong.
			const detail = await res.text().catch(() => "");
			throw Object.assign(new Error(`groq ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`), {
				status: res.status,
				rateLimit: readRateLimit(res.headers),
				body: detail,
			});
		}
		return res;
	};

	return {
		async complete({ system, messages, signal }) {
			const res = await post(system, messages, signal, false);
			const payload = await res.json();
			return {
				text: payload?.choices?.[0]?.message?.content ?? "",
				// "length" means the answer was cut off at max_tokens rather than
				// finished. A caller scoring the text needs to know that, or a
				// truncation reads as a content failure.
				finishReason: payload?.choices?.[0]?.finish_reason ?? null,
				// The limiter's own account of what this call cost and what is
				// left. A pacer that reads this cannot drift from reality the way
				// one built on a token estimate does.
				rateLimit: readRateLimit(res.headers),
				usage: payload?.usage ?? null,
			};
		},

		async *stream({ system, messages, signal }) {
			const res = await post(system, messages, signal, true);
			for await (const payload of sseLines(res, signal)) {
				const chunk = payload?.choices?.[0]?.delta?.content;
				if (chunk) yield chunk;
			}
		},
	};
}

/**
 * The production provider. The key is read here, at call time, from a
 * server-only variable: not exposed to the client bundle, not imported from
 * src/, and never returned in a response.
 */
export function createProvider() {
	const apiKey = process.env.LLM_PROVIDER_KEY;
	if (!apiKey) {
		throw new Error("LLM_PROVIDER_KEY is not set in the server environment");
	}
	return createGeminiProvider(apiKey);
}

/**
 * The provider-agnostic entry point every caller uses.
 *
 * Callers pass { system, messages } and get back { text } or an async iterable
 * of string chunks — no vendor type crosses this boundary, so swapping provider
 * means replacing createProvider() and nothing above it. `provider` is injected
 * by tests; production omits it and gets the pinned default.
 */
export async function callLLM({ system, messages, signal, provider, stream = false }) {
	const llm = provider ?? createProvider();
	return stream
		? llm.stream({ system, messages, signal })
		: llm.complete({ system, messages, signal });
}

/** Build the message array. History is already trimmed by validate(). */
export function buildMessages(question, history) {
	return [
		...history.map((m) => ({
			role: m.role === "assistant" ? "assistant" : "user",
			content: String(m.content ?? ""),
		})),
		{ role: "user", content: wrapUserMessage(question) },
	];
}

/* ─── Fault handling ────────────────────────────────────────────────────── */

export const FALLBACK_MESSAGE =
	"The assistant is unavailable right now. You can still browse the site, or email Mark directly.";

/**
 * Record an upstream fault where an operator can see it, which is the other
 * half of discarding it on the wire.
 *
 * A fault path that is silent on BOTH sides is indistinguishable from a working
 * one that has nothing to say: a retired model pin, an expired key and a
 * genuine timeout all render as the same sentence, and the only way to tell
 * them apart is to reproduce the call by hand. That cost a debugging session.
 *
 * stderr only — never the response body, for the reason given on degraded()
 * below. `where` names the call site so the streaming and non-streaming paths
 * are distinguishable in a log.
 */
const REDACTED = "[redacted]";

/**
 * Key shapes, because a provider that rejects a key habitually quotes it back:
 * Anthropic `sk-…`, Google AI Studio `AIza…` and `AQ.…`, and OpenAI-compatible
 * bearer tokens. The catch-all is last and deliberately conservative — it wants
 * long unbroken secret-shaped runs, not ordinary words.
 */
const KEY_SHAPES = [
	/\bsk-[A-Za-z0-9_-]{8,}/g,
	/\bAIza[A-Za-z0-9_-]{10,}/g,
	/\bAQ\.[A-Za-z0-9_.-]{10,}/g,
	/\bBearer\s+[A-Za-z0-9_.-]{12,}/gi,
	/\b[A-Za-z0-9_-]{32,}\b/g,
];

/**
 * Strip anything key-shaped, plus the configured key itself, from text bound
 * for a log.
 *
 * The exact-key pass matters most and is cheapest: whatever shape a future
 * provider's credential takes, THIS deployment's key is a string we already
 * hold, so it can always be matched literally even when no pattern anticipates
 * it. The shape passes cover the keys of providers we are not configured with —
 * an eval key, or a misrouted call.
 */
function redact(text) {
	let out = String(text);
	const key = process.env.LLM_PROVIDER_KEY;
	// A short or absent value would match everywhere; 12 is well below any real
	// key and well above anything that could appear by accident.
	if (key && key.length >= 12) out = out.split(key).join(REDACTED);
	for (const shape of KEY_SHAPES) out = out.replace(shape, REDACTED);
	return out;
}

/**
 * Record an upstream fault where an operator can see it, which is the other
 * half of discarding it on the wire.
 *
 * A fault path that is silent on BOTH sides is indistinguishable from a working
 * one that has nothing to say: a retired model pin, an expired key and a
 * genuine timeout all render as the same sentence, and the only way to tell
 * them apart is to reproduce the call by hand. That cost a debugging session.
 *
 * stderr only — never the response body, for the reason given on degraded()
 * below. `where` names the call site so the streaming and non-streaming paths
 * are distinguishable in a log.
 *
 * REDACTED, because a log is not a private place. Vercel ships stderr to
 * whatever drain is configured, and providers quote the rejected credential
 * straight back in the 401 they return — verify-proxy-contract.js's canary key
 * appeared verbatim in this line before redact() existed. The message is also
 * truncated: an upstream that answers a bad request with a 40KB HTML error page
 * should not be able to fill the log with it.
 */
function logFault(where, error) {
	const status = error?.status ? ` status=${error.status}` : "";
	const detail = redact(error?.message ?? String(error)).slice(0, 300);
	console.error(`[assistant] ${where} degraded${status}: ${detail}`);
}

/**
 * Every upstream failure collapses to the same visitor-facing sentence. The
 * provider's own message is deliberately discarded: "insufficient_quota: credit
 * balance is too low" tells a stranger about the owner's billing, and a stack
 * trace tells an attacker about the runtime.
 */
function degraded(status = 200) {
	return {
		status,
		body: { answer: FALLBACK_MESSAGE, degraded: true, source: "fallback" },
	};
}

/**
 * Static answers for the streaming path, built from the same profile the prompt
 * is. Constructed here rather than imported from _assistant.js because that file
 * imports this one — the shared mutable state (limiter, budget) lives in
 * _limits.js for exactly that reason, while this is stateless and cheap.
 */
const staticAnswerer = createStaticAnswerer(PROFILE);

/**
 * Rate-limit key for an HTTP request.
 *
 * `x-forwarded-for` is a client-settable header that the platform REWRITES at
 * the edge, so the leftmost entry is the real client only because Vercel put it
 * there — trusting it on a self-hosted origin would let anyone mint a fresh
 * identity per request. The `"unknown"` bucket is shared on purpose: a request
 * arriving with no derivable address gets throttled alongside every other such
 * request rather than escaping the limiter entirely, so stripping the header is
 * a downgrade for the caller, not a bypass.
 */
export function clientKey(req) {
	const fwd = req?.headers?.["x-forwarded-for"];
	const first = Array.isArray(fwd) ? fwd[0] : String(fwd ?? "").split(",")[0];
	return first?.trim() || req?.socket?.remoteAddress || "unknown";
}

/** Race an upstream call against our own deadline so we abort before the platform does. */
async function withDeadline(fn, ms) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		return await fn(controller.signal);
	} finally {
		clearTimeout(timer);
	}
}

/* ─── Testable core (non-streaming) ─────────────────────────────────────── */

/**
 * Resolves for every fault — never rejects, never returns 5xx. tests/
 * resilience.test.js drives this directly with a faulting `provider`.
 */
export async function handleAssistantRequest({
	question,
	history = [],
	provider,
	signal,
} = {}) {
	const check = validate({ question, history });
	if (!check.ok) {
		return { status: check.status, body: { answer: check.message, degraded: false } };
	}

	try {
		const result = await withDeadline(
			(deadlineSignal) =>
				callLLM({
					system: SYSTEM_PROMPT,
					messages: buildMessages(check.question, check.history),
					signal: signal ?? deadlineSignal,
					provider,
				}),
			UPSTREAM_TIMEOUT_MS,
		);

		if (!result || result.refused || !result.text) {
			logFault("core", new Error(result?.refused ? "provider refused" : "empty completion"));
			return degraded();
		}
		return { status: 200, body: { answer: result.text, degraded: false, source: "llm" } };
	} catch (error) {
		// Rate limit, timeout, quota, malformed provider JSON, abort — all the
		// same to a visitor, and all non-5xx. Not all the same to an operator.
		logFault("core", error);
		return degraded();
	}
}

/* ─── HTTP handler (streaming) ──────────────────────────────────────────── */

const sse = (res, event, data) =>
	res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export default async function handler(req, res) {
	const origin = req.headers?.origin ?? "";
	const allowed = isOriginAllowed(origin);

	if (req.method === "OPTIONS") {
		if (!allowed) return res.status(403).end();
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "content-type");
		return res.status(204).end();
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed." });
	}

	// Checked before anything else touches the body: an unlisted origin gets no
	// work done on its behalf and no CORS header back.
	if (!allowed) {
		return res.status(403).json({ error: "Origin not allowed." });
	}
	res.setHeader("Access-Control-Allow-Origin", origin);
	res.setHeader("Vary", "Origin");

	// Throttle before reading the body: a client over its allowance should cost
	// this function as little as possible.
	const verdict = limiter.check(clientKey(req));
	if (!verdict.allowed) {
		res.setHeader("Retry-After", String(verdict.retryAfterSec));
		return res.status(429).json({
			answer:
				"That's a lot of questions at once. Please wait a moment and ask again — " +
				"everything on the site is still browsable in the meantime.",
			degraded: true,
			source: "throttled",
		});
	}

	const { question, history = [] } = req.body ?? {};
	const check = validate({ question, history });
	if (!check.ok) {
		return res.status(check.status).json({ answer: check.message, degraded: false });
	}

	// Kill switch. Answered as plain JSON rather than SSE: there is nothing to
	// stream, and a one-shot body lets the client render it immediately.
	if (!budget.reserve().allowed) {
		const hit = staticAnswerer.match(check.question);
		return res.status(200).json(
			hit
				? { answer: hit.answer, degraded: true, source: "static" }
				: { answer: FALLBACK_MESSAGE, degraded: true, source: "fallback" },
		);
	}

	// Same injection seam as handleAssistantRequest: without it the streaming
	// success path is untestable, and a test that can only reach the error path
	// proves the fallback works while saying nothing about normal operation.
	if (!req.provider) {
		try {
			createProvider();
		} catch (error) {
			// Fail before switching to SSE — once headers are sent the status
			// is fixed and a misconfigured deployment can no longer say so.
			logFault("provider-init", error);
			return res.status(200).json({ ...degraded().body });
		}
	}

	res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");
	res.flushHeaders?.();

	let sentAny = false;
	try {
		await withDeadline(async (deadlineSignal) => {
			const chunks = await callLLM({
				system: SYSTEM_PROMPT,
				messages: buildMessages(check.question, check.history),
				signal: deadlineSignal,
				provider: req.provider,
				stream: true,
			});
			for await (const chunk of chunks) {
				sentAny = true;
				sse(res, "delta", { text: chunk });
			}
		}, UPSTREAM_TIMEOUT_MS);

		sse(res, "done", { degraded: false });
	} catch (error) {
		logFault("stream", error);

		// Headers are already sent, so the status can no longer change — the
		// recovery has to travel in-band as an event.
		if (sentAny) {
			// Mid-stream fault. Whatever arrived is real and stays on screen;
			// replacing it with an apology would discard a correct partial
			// answer. The client marks it as cut off.
			sse(res, "error", { truncated: true, degraded: true });
			sse(res, "done", { degraded: true, source: "truncated" });
		} else {
			// Nothing sent yet, so there is still a free choice of answer.
			// Prefer the owner's own words from profile.json over the generic
			// apology: same failure, strictly more useful, still flagged.
			//
			// The non-streaming wrapper in _assistant.js has always done this.
			// This path — the one visitors actually reach — did not, so a
			// provider blip served "the assistant is unavailable" even for a
			// question profile.json answers verbatim.
			const hit = staticAnswerer.match(check.question);
			sse(res, "delta", {
				text: hit ? hit.answer : FALLBACK_MESSAGE,
				degraded: true,
			});
			sse(res, "done", { degraded: true, source: hit ? "static" : "fallback" });
		}
	} finally {
		res.end();
	}
}

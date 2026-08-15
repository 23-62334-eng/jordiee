/**
 * Serverless chat proxy for jordiee.me (Vercel Node function).
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
 * Pinned production model: Google Gemini, Flash class.
 *
 * The `-001` suffix is the point — `gemini-2.0-flash` and anything `-latest`
 * float onto whatever Google ships next, which would change this site's answers
 * without a commit. Flash class is also the constraint that makes the endpoint
 * viable: it is the tier the AI Studio free quota covers, and this is a
 * portfolio Q&A, not a reasoning workload.
 *
 * Pinned in source rather than read from an env var so a model change is a
 * reviewable diff, not a dashboard edit nobody sees.
 */
export const MODEL = "gemini-2.0-flash-001";

/**
 * Eval-path model on Groq. Separate provider, separate key, same adapter — the
 * production Gemini path above is untouched by anything in this block.
 *
 * Its free-tier ceiling is the binding constraint on eval throughput, so it is
 * declared here next to the model rather than buried in the runner: change the
 * model and you must revisit the limit.
 */
export const EVAL_MODEL = "llama-3.1-8b-instant";

/** Tokens per minute allowed for EVAL_MODEL on the free tier. */
export const EVAL_TPM_LIMIT = 6000;

export const MAX_TOKENS = 1024;

export const MAX_INPUT_CHARS = 300;
export const MAX_TURNS = 8;

/** Wall-clock ceiling for one upstream call, below any platform timeout. */
export const UPSTREAM_TIMEOUT_MS = Number(process.env.ASSISTANT_TIMEOUT_MS ?? 8000);

const ALLOWED_ORIGINS = new Set([
	"https://jordiee.me",
	"https://www.jordiee.me",
]);

/** localhost on any port, http or https — dev servers move around. */
const LOCALHOST = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

export function isOriginAllowed(origin) {
	if (!origin) return false;
	return ALLOWED_ORIGINS.has(origin) || LOCALHOST.test(origin);
}

import { readFileSync } from "node:fs";

const PROFILE = JSON.parse(
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

	const post = async (method, system, messages, signal, query = "") => {
		const res = await fetch(
			`${base}/${model}:${method}?key=${encodeURIComponent(apiKey)}${query}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body(system, messages)),
				signal,
			},
		);
		if (!res.ok) {
			// The upstream message may name quota or billing — the caller
			// discards it, so only the status travels.
			throw Object.assign(new Error(`gemini ${res.status}`), { status: res.status });
		}
		return res;
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

/** Groq (OpenAI-compatible). Eval path only — never used in production. */
export function createGroqProvider(apiKey, model = EVAL_MODEL) {
	const url = "https://api.groq.com/openai/v1/chat/completions";

	const body = (system, messages, stream) => ({
		model,
		max_tokens: MAX_TOKENS,
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
			throw Object.assign(new Error(`groq ${res.status}`), { status: res.status });
		}
		return res;
	};

	return {
		async complete({ system, messages, signal }) {
			const res = await post(system, messages, signal, false);
			const payload = await res.json();
			return { text: payload?.choices?.[0]?.message?.content ?? "" };
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

		if (!result || result.refused || !result.text) return degraded();
		return { status: 200, body: { answer: result.text, degraded: false, source: "llm" } };
	} catch {
		// Rate limit, timeout, quota, malformed provider JSON, abort — all the
		// same to a visitor, and all non-5xx.
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

	const { question, history = [] } = req.body ?? {};
	const check = validate({ question, history });
	if (!check.ok) {
		return res.status(check.status).json({ answer: check.message, degraded: false });
	}

	// Same injection seam as handleAssistantRequest: without it the streaming
	// success path is untestable, and a test that can only reach the error path
	// proves the fallback works while saying nothing about normal operation.
	if (!req.provider) {
		try {
			createProvider();
		} catch {
			// Fail before switching to SSE — once headers are sent the status
			// is fixed and a misconfigured deployment can no longer say so.
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
	} catch {
		// Headers are already sent, so the status can no longer change — the
		// fallback has to travel in-band as an event.
		sse(res, sentAny ? "error" : "delta", {
			text: sentAny ? undefined : FALLBACK_MESSAGE,
			degraded: true,
		});
		sse(res, "done", { degraded: true, source: "fallback" });
	} finally {
		res.end();
	}
}

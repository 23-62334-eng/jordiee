/**
 * Shared contract for the verification layer.
 *
 * Nothing here implements the assistant. These are the interfaces the
 * implementation must satisfy for the test suites to run, expressed once so the
 * suites stay declarative and so a missing implementation fails loudly with an
 * actionable message rather than silently skipping.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Retrievable section IDs.
 *
 * These are not invented: the first twelve are live element IDs in the running
 * app, so a retrieval hit can deep-link straight to the section a visitor asked
 * about. `stack` and `contact` have no anchor yet — the content exists (the tech
 * marquee inside About, the footer) but is not independently addressable, so the
 * implementation must either add anchors or map these to their parent sections.
 *
 * profile.json MUST expose every ID in this list. `assertVocabularyCovered`
 * enforces that, which is what stops the golden set and the retrieval set from
 * drifting apart from the data as the portfolio changes.
 */
export const SECTION_IDS = Object.freeze([
	// live anchors in src/
	"profile",
	"education",
	"work",
	"certificate",
	"project-capstone",
	"project-twd-monitoring",
	"project-school-evaluation",
	"project-vehicle-rental",
	"project-bat-cafe",
	"project-portfolio",
	"project-thrift-shop",
	"project-time-scheduling",
	// content exists, anchor does not yet
	"stack",
	"contact",
]);

export const PROFILE_PATH = process.env.PROFILE_PATH
	? path.resolve(ROOT, process.env.PROFILE_PATH)
	: path.join(ROOT, "src", "assistant", "profile.json");

/**
 * Module exporting `createRetriever(profile) -> { search(query, opts) }`.
 * `search` must return an array of `{ sectionId, score }` ordered best-first.
 */
export const RETRIEVER_ENTRY = process.env.RETRIEVER_ENTRY
	? path.resolve(ROOT, process.env.RETRIEVER_ENTRY)
	: path.join(ROOT, "src", "assistant", "retriever.js");

/**
 * Module exporting `handleAssistantRequest(request) -> { status, body }`.
 * This is the serverless proxy boundary — the thing that must degrade
 * gracefully when the upstream provider misbehaves.
 */
export const HANDLER_ENTRY = process.env.HANDLER_ENTRY
	? path.resolve(ROOT, process.env.HANDLER_ENTRY)
	: path.join(ROOT, "api", "assistant.js");

const missing = (label, target, shape) =>
	new Error(
		[
			``,
			`  ${label} not found.`,
			`    looked in: ${path.relative(ROOT, target)}`,
			``,
			`  This suite is a specification for code that does not exist yet.`,
			`  It is red on purpose. Point it at the real thing when you build it:`,
			``,
			shape,
			``,
		].join("\n"),
	);

export function contractStatus() {
	return {
		profile: existsSync(PROFILE_PATH),
		retriever: existsSync(RETRIEVER_ENTRY),
		handler: existsSync(HANDLER_ENTRY),
	};
}

export async function loadProfile() {
	if (!existsSync(PROFILE_PATH)) {
		throw missing(
			"profile.json",
			PROFILE_PATH,
			[
				`    PROFILE_PATH=path/to/profile.json npm run test:retrieval`,
				``,
				`  Required shape (only the parts the suites assert on):`,
				`    {`,
				`      "sections": [ { "id": "<one of SECTION_IDS>", "text": "...", ... } ],`,
				`      "identity":  { "name", "location", ... },`,
				`      "contact":   { "email", "socials": [...] },`,
				`      "education": { "degree", "institution", "focusAreas": [...], ... },`,
				`      "stack":     [ { "name", "category" } ],`,
				`      "projects":  [ { "id", "title", "year", "term", "kind", "tags", ... } ],`,
				`      "certifications": [ { "title", "org", "year" } ]`,
				`    }`,
			].join("\n"),
		);
	}
	return JSON.parse(await readFile(PROFILE_PATH, "utf8"));
}

export async function loadRetriever() {
	if (!existsSync(RETRIEVER_ENTRY)) {
		throw missing(
			"retriever module",
			RETRIEVER_ENTRY,
			[
				`    RETRIEVER_ENTRY=path/to/retriever.js npm run test:retrieval`,
				``,
				`  Required export:`,
				`    export function createRetriever(profile) {`,
				`      return {`,
				`        // best-first; [] when nothing clears the score floor`,
				`        search(query, { limit = 5 } = {}) {`,
				`          return [{ sectionId: "education", score: 0.91 }];`,
				`        },`,
				`      };`,
				`    }`,
			].join("\n"),
		);
	}
	return import(RETRIEVER_ENTRY);
}

export async function loadHandler() {
	if (!existsSync(HANDLER_ENTRY)) {
		throw missing(
			"assistant handler",
			HANDLER_ENTRY,
			[
				`    HANDLER_ENTRY=path/to/handler.js npm run test:resilience`,
				``,
				`  Required export:`,
				`    export async function handleAssistantRequest({ question, history, signal, provider }) {`,
				`      // MUST resolve, never reject, for provider faults.`,
				`      // MUST return a status < 500 for every fault in resilience.test.js.`,
				`      return { status: 200, body: { answer, degraded, source } };`,
				`    }`,
				``,
				`  \`provider\` is injected so the suite can supply a faulting stub.`,
				`  If the real handler reads a module-scoped client instead, expose a`,
				`  seam (DI, factory arg, or __setProvider) — resilience cannot be`,
				`  tested against a hard-wired network call.`,
			].join("\n"),
		);
	}
	return import(HANDLER_ENTRY);
}

/** Every section ID referenced by the suites must exist in profile.json. */
export function assertVocabularyCovered(profile, referenced) {
	const present = new Set((profile.sections ?? []).map((s) => s.id));
	const absent = [...new Set(referenced)].filter((id) => !present.has(id));
	if (absent.length) {
		throw new Error(
			`profile.json is missing sections referenced by the test set: ${absent.join(", ")}\n` +
				`  A test set that points at sections the data does not have cannot pass, and\n` +
				`  a test set quietly narrowed to the sections that happen to exist is worse.`,
		);
	}
}

export function percentile(sorted, p) {
	if (!sorted.length) return NaN;
	// Nearest-rank. Reported alongside the sample count so a p95 computed from
	// too few samples is visibly untrustworthy rather than quietly wrong.
	const rank = Math.ceil((p / 100) * sorted.length);
	return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

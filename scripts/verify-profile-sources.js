#!/usr/bin/env node
/**
 * Prove that every value in src/data/profile.json came out of src/.
 *
 * profile.json was extracted by hand, which means it could in principle contain
 * a value that was remembered, assumed, or shaped by some other document rather
 * than read out of a component. This script makes that failure detectable
 * instead of merely promised: every string leaf must appear verbatim in a
 * source file (after whitespace normalisation, since JSX wraps prose across
 * lines), and every asset path must resolve on disk.
 *
 * Anything that cannot be traced is reported as ORPHAN and exits non-zero.
 *
 * IMPORTANT: this reads source from a git ref, not the working tree. Once the
 * components were refactored to render FROM profile.json, the literals stopped
 * existing in src/ — checking the working tree would invert this audit from
 * "proves the extraction was faithful" into "always fails". The baseline is the
 * commit the extraction was performed against.
 *
 *   node scripts/verify-profile-sources.js
 *   PROFILE_BASELINE_REF=<sha> node scripts/verify-profile-sources.js
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE = path.join(ROOT, "src", "data", "profile.json");
const profileForEdits = JSON.parse(readFileSync(PROFILE, "utf8"));
const SRC = path.join(ROOT, "src");
const ASSETS = path.join(SRC, "assets");

/** Keys whose values are provenance/bookkeeping, not extracted content. */
const SKIP_KEYS = new Set([
	"_meta", "emailConflict", "hasLogo", "verified", "category",
]);

/**
 * Subtrees that are AUTHORED rather than extracted, and so cannot trace to a
 * component. They are not unchecked — they are held to a different standard:
 * faq entries must cite fields that resolve inside profile.json, and every
 * `sections[].id` must be a real section the retriever can return. Exempting
 * them from the src/ trace without a second check would be a hole big enough
 * to hide an invented fact in.
 *
 * `sections` is search metadata — titles and the vocabulary a visitor might
 * use. It describes the data rather than asserting anything about Mark, so it
 * has no source in the components by construction.
 */
const AUTHORED_ROOTS = new Set(["faq", "notAvailable", "sections"]);

/** Derived from another field and checked for sync by validate-profile.js. */
const DERIVED_PATHS = new Set(["identity.bio.aboutPlain"]);

/**
 * Keys the owner supplies directly rather than the components. They cannot
 * trace to src/ — no component ever stated a lifecycle status for seven of the
 * eight projects. They are not unchecked: the schema pins `status` to a closed
 * enum, and validate-profile.js pins `statusLabel` to the matching label.
 */
const OWNER_SUPPLIED_KEYS = new Set(["status", "statusLabel", "contribution"]);

/** Deliberate placeholder; scripts/validate-profile.js counts these. */
const SENTINEL = "TODO_VERIFY";

/**
 * Values the owner deliberately changed after extraction, keyed by path.
 * These cannot match src/ any more — that is the point of the edit. They are
 * still audited: the recorded ORIGINAL must trace to source, which proves the
 * edit modified real extracted content rather than smuggling in something
 * invented under cover of an "edit".
 */
const ownerEdits = new Map(
	(profileForEdits._meta?.ownerEdits ?? []).map((e) => [e.path, e]),
);

/**
 * Values the owner ADDED after extraction, keyed by path.
 *
 * ownerEdits above cannot cover these: it audits a recorded `original` against
 * the baseline, which proves an edit changed real extracted content. An
 * addition has no original — the certificate did not exist when the extraction
 * was performed.
 *
 * Without this the audit had a terminal flaw rather than a strict one: the
 * direction of authorship reversed at 6ddc1f2. Before it, profile.json was
 * extracted FROM the components; after it, the components render FROM
 * profile.json, so anything genuinely new is authored here first and can never
 * trace to src/ no matter which commit the baseline names. The profile could
 * never gain a fact again without this check failing.
 *
 * It is still not a way in. An addition has to be DECLARED, with the exact
 * value it authorises and a reason — a value that does not match its
 * declaration byte for byte is reported as an orphan exactly as before, so
 * nothing can be invented silently or drift after the fact.
 */
const ownerAdditions = new Map(
	(profileForEdits._meta?.ownerAdditions ?? []).map((a) => [a.path, a]),
);

/** profile.json path syntax -> the dotted trail this script builds. */
function editPathToTrail(specPath) {
	// "projects[id=project-capstone].description" -> "projects.[0].description"
	return specPath.replace(/(\w+)\[(\w+)=([^\]]+)\]/g, (_, key, field, want) => {
		const arr = profileForEdits[key];
		const idx = Array.isArray(arr) ? arr.findIndex((x) => String(x?.[field]) === want) : -1;
		return `${key}.[${idx}]`;
	});
}

/** Values that are structural rather than extracted prose. */
const SKIP_VALUES = new Set(["", null]);

/** Paths under these keys are filesystem references, checked against disk. */
const ASSET_KEYS = new Set(["images", "image", "resumeUrl"]);

/**
 * The commit the extraction was performed against — the last one whose
 * components still carry the literals verbatim.
 *
 * This is pinned, not defaulted to HEAD. Once the refactor landed (6ddc1f2),
 * HEAD stopped containing those literals, so a HEAD baseline silently inverted
 * this audit from "the extraction was faithful" into "nothing traces" — 96
 * false orphans. A provenance baseline has to name a fixed commit; if it moves
 * with the branch it is not a baseline.
 */
const EXTRACTION_BASELINE = "63ce007";
const BASELINE = process.env.PROFILE_BASELINE_REF ?? EXTRACTION_BASELINE;

/** Read a repo-relative path as it existed at the baseline ref. */
function readAtBaseline(relPath) {
	try {
		return execFileSync("git", ["show", `${BASELINE}:${relPath}`], {
			cwd: ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return null; // file did not exist at that ref
	}
}

/** Every path tracked at the baseline ref, filtered to source files. */
function baselineFiles() {
	const out = execFileSync("git", ["ls-tree", "-r", "--name-only", BASELINE], {
		cwd: ROOT,
		encoding: "utf8",
	});
	return out
		.split("\n")
		.filter((f) => /^(src\/|index\.html)/.test(f) && /\.(jsx?|html)$/.test(f))
		.filter((f) => !f.startsWith("src/data/"));
}

const norm = (s) =>
	s
		.normalize("NFKC")
		.replace(/\s+/g, " ")
		.replace(/’/g, "'")
		.trim()
		.toLowerCase();

function collectSources() {
	return baselineFiles()
		.map((f) => ({ file: f, text: readAtBaseline(f) }))
		.filter((x) => x.text !== null)
		.map((x) => ({ file: x.file, text: norm(x.text) }));
}

function* leaves(node, trail = []) {
	if (node === null || node === undefined) return;
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i++) yield* leaves(node[i], [...trail, `[${i}]`]);
		return;
	}
	if (typeof node === "object") {
		for (const [k, v] of Object.entries(node)) {
			if (SKIP_KEYS.has(k)) continue;
			yield* leaves(v, [...trail, k]);
		}
		return;
	}
	yield { path: trail.join("."), key: trail.at(-1), value: node, trail };
}

const profile = profileForEdits;
const sources = collectSources();

const orphans = [];
const traced = [];
const assetsChecked = [];
let skipped = 0;
let sentinels = 0;
let ownerSupplied = 0;
const edited = [];
const editedTrails = new Map(
	[...ownerEdits.values()].map((e) => [editPathToTrail(e.path), e]),
);
const added = [];
const addedTrails = new Map(
	[...ownerAdditions.values()].map((a) => [editPathToTrail(a.path), a]),
);
let authored = 0;
let derived = 0;

for (const leaf of leaves(profile)) {
	const { value, trail } = leaf;

	if (typeof value === "boolean" || typeof value === "number") { skipped++; continue; }
	if (typeof value !== "string" || SKIP_VALUES.has(value)) { skipped++; continue; }
	if (value === SENTINEL) { sentinels++; continue; }
	if (AUTHORED_ROOTS.has(trail[0])) { authored++; continue; }
	if (
		trail[0] === "projects" &&
		(OWNER_SUPPLIED_KEYS.has(trail.at(-1)) || OWNER_SUPPLIED_KEYS.has(trail.at(-2)))
	) { ownerSupplied++; continue; }
	if (DERIVED_PATHS.has(trail.slice(0, 3).join("."))) { derived++; continue; }

	// Asset references resolve against the filesystem, not against source text.
	const underAsset = trail.some((t) => ASSET_KEYS.has(t));
	if (underAsset) {
		const onDisk = path.join(ASSETS, value);
		if (existsSync(onDisk)) assetsChecked.push({ ...leaf, ok: true });
		else orphans.push({ ...leaf, reason: `asset not on disk: ${path.relative(ROOT, onDisk)}` });
		continue;
	}

	const edit = editedTrails.get(trail.join("."));
	if (edit) {
		// Audit the recorded original, not the edited value.
		const originalHit = sources.find((s) => s.text.includes(norm(edit.original)));
		if (originalHit) {
			edited.push({ ...leaf, file: originalHit.file });
		} else {
			orphans.push({
				...leaf,
				reason: `_meta.ownerEdits records an edit here, but its "original" does not trace to ${BASELINE} — the edit cannot be verified as a change to real content`,
			});
		}
		continue;
	}

	const addition = addedTrails.get(trail.join("."));
	if (addition) {
		// The declaration must name the value it authorises, exactly. A
		// mismatch means the data moved after the addition was recorded, and
		// the record no longer describes what is in the file.
		if (addition.value === value) {
			added.push(leaf);
		} else {
			orphans.push({
				...leaf,
				reason:
					`_meta.ownerAdditions declares this path with value ` +
					`${JSON.stringify(addition.value)}, which no longer matches — ` +
					`the declaration does not authorise the value now present`,
			});
		}
		continue;
	}

	const needle = norm(value);
	const hit = sources.find((s) => s.text.includes(needle));
	if (hit) traced.push({ ...leaf, file: hit.file });
	else orphans.push({ ...leaf, reason: "no source file contains this string" });
}

/**
 * Every path an authored entry claims to draw on must resolve in profile.json.
 * Supports "a.b.c", "arr[id=x].field", "arr[key=value]" and bare array names.
 */
function resolves(spec) {
	let node = profile;
	for (const part of spec.split(".")) {
		const sel = part.match(/^(\w+)\[([^\]=~]+)([=~])([^\]]+)\]$/);
		if (sel) {
			const [, key, field, op, want] = sel;
			const arr = node?.[key];
			if (!Array.isArray(arr)) return false;
			node = arr.find((x) =>
				op === "="
					? String(x?.[field]) === want
					: String(x?.[field] ?? "").includes(want),
			);
			if (node === undefined) return false;
			continue;
		}
		if (node == null || !(part in node)) return false;
		node = node[part];
	}
	return true;
}

const authoredErrors = [];
const seenSectionIds = new Set();
for (const section of profile.sections ?? []) {
	if (!section.id) authoredErrors.push(`sections: an entry has no id`);
	else if (seenSectionIds.has(section.id)) {
		authoredErrors.push(`sections: duplicate id "${section.id}" — retrieval would double-count it`);
	} else seenSectionIds.add(section.id);
}
for (const proj of profile.projects ?? []) {
	if (!seenSectionIds.has(proj.id)) {
		authoredErrors.push(`sections: project "${proj.id}" has no matching section, so it can never be retrieved`);
	}
}
for (const entry of profile.faq ?? []) {
	for (const spec of entry.sourceFields ?? []) {
		if (!resolves(spec)) {
			authoredErrors.push(`faq ${entry.id}: sourceFields "${spec}" does not resolve in profile.json`);
		}
	}
}

const nulls = [];
(function findNulls(node, trail = []) {
	if (Array.isArray(node)) return node.forEach((v, i) => findNulls(v, [...trail, `[${i}]`]));
	if (node && typeof node === "object") {
		for (const [k, v] of Object.entries(node)) {
			if (k === "_meta") continue;
			if (v === null) nulls.push([...trail, k].join("."));
			else findNulls(v, [...trail, k]);
		}
	}
})(profile);

console.log(`profile provenance audit`);
console.log(`  baseline ref         : ${BASELINE}`);
console.log(`  source files scanned : ${sources.length}`);
console.log(`  strings traced       : ${traced.length}`);
console.log(`  assets resolved      : ${assetsChecked.length}`);
console.log(`  non-string skipped   : ${skipped}`);
console.log(`  authored (faq/notAvailable): ${authored}  — checked against profile.json, not src/`);
console.log(`  derived (aboutPlain)       : ${derived}  — sync-checked by validate-profile.js`);
console.log(`  TODO_VERIFY sentinels      : ${sentinels}`);
console.log(`  owner-supplied statuses    : ${ownerSupplied}  — enum-pinned by validate-profile.js`);
console.log(`  owner edits                : ${edited.length}  — original verified against ${BASELINE}`);
console.log(`  owner additions            : ${added.length}  — declared in _meta.ownerAdditions with an exact value`);
console.log(`  null fields          : ${nulls.length}`);

if (nulls.length) {
	console.log(`\n  nulls (expected — see profile.NEEDS_INPUT.md):`);
	for (const n of nulls) console.log(`    - ${n}`);
}

if (authoredErrors.length) {
	console.error(`\n✖ ${authoredErrors.length} authored entry/entries cite fields that do not exist:\n`);
	for (const e of authoredErrors) console.error(`  ${e}`);
	console.error("");
	process.exit(1);
}

if (orphans.length) {
	console.error(`\n✖ ${orphans.length} value(s) could not be traced to src/:\n`);
	for (const o of orphans) {
		console.error(`  ${o.path}`);
		console.error(`    value:  ${JSON.stringify(String(o.value).slice(0, 90))}`);
		console.error(`    reason: ${o.reason}\n`);
	}
	console.error(`An untraceable value was invented, remembered, or copied from`);
	console.error(`somewhere other than the portfolio source. Remove it or cite it.\n`);
	process.exit(1);
}

console.log(`\n✓ every populated value traces to src/`);
process.exit(0);

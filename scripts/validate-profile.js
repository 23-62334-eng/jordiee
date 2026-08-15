#!/usr/bin/env node
/**
 * Validate src/data/profile.json against its schema. Runs before every build.
 *
 * The schema catches shape drift. This script adds the four checks a JSON
 * schema structurally cannot express:
 *
 *   1. project ids that Home.jsx deep-links to must still exist
 *   2. every asset path must resolve on disk
 *   3. contact.email and contact.emailConflict must stay consistent
 *   4. skills marked hasLogo must actually have an icon in TechLogoMarquee
 *
 * A build that ships a profile whose anchors are dangling or whose images 404
 * is worse than a build that fails.
 */

// The 2020-12 build specifically — ajv's default export is draft-07 and will
// reject the schema's own $schema declaration.
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => path.join(ROOT, ...s);

const profile = JSON.parse(readFileSync(p("src/data/profile.json"), "utf8"));
const schema = JSON.parse(readFileSync(p("src/data/profile.schema.json"), "utf8"));

const errors = [];
const warnings = [];

/* ── 1. schema ─────────────────────────────────────────────────────────── */

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(profile)) {
	for (const e of validate.errors) {
		errors.push(`schema  ${e.instancePath || "/"} ${e.message}` +
			(e.params && Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : ""));
	}
}

/* ── 2. deep-link anchors still resolve ────────────────────────────────── */

function sourceFiles(dir, out = []) {
	for (const e of readdirSync(dir)) {
		const full = path.join(dir, e);
		if (statSync(full).isDirectory()) {
			if (!["assets", "data", "favicon_io"].includes(e)) sourceFiles(full, out);
		} else if (/\.jsx?$/.test(e)) out.push(full);
	}
	return out;
}

const allSource = sourceFiles(p("src"))
	.map((f) => ({ file: path.relative(ROOT, f), text: readFileSync(f, "utf8") }));

const projectIds = new Set(profile.projects.map((x) => x.id));
const referenced = new Map();
for (const { file, text } of allSource) {
	for (const m of text.matchAll(/scrollId:\s*"(project-[a-z0-9-]+)"/g)) {
		referenced.set(m[1], file);
	}
}
for (const [id, file] of referenced) {
	if (!projectIds.has(id)) {
		errors.push(`anchor  ${file} deep-links to "${id}", which no longer exists in profile.projects`);
	}
}

/* ── 3. assets resolve ─────────────────────────────────────────────────── */

const assetRefs = [
	...profile.projects.flatMap((x) => (x.images ?? []).map((i) => [`projects[${x.id}].images`, i])),
	...profile.certifications.filter((c) => c.image).map((c) => [`certifications[${c.title}].image`, c.image]),
	...(profile.contact.resumeUrl ? [["contact.resumeUrl", profile.contact.resumeUrl]] : []),
];
for (const [where, rel] of assetRefs) {
	if (!existsSync(p("src/assets", rel))) {
		errors.push(`asset   ${where} -> src/assets/${rel} does not exist`);
	}
}

/* ── 4. email conflict bookkeeping ─────────────────────────────────────── */

const { email, emailConflict } = profile.contact;
if (email === null && !emailConflict) {
	errors.push(`contact contact.email is null with no emailConflict explaining why`);
}
if (email !== null && emailConflict) {
	errors.push(`contact contact.email is set but emailConflict is still present — remove the conflict record once resolved`);
}
if (email === null) {
	warnings.push(
		`contact.email is unresolved: ${emailConflict.candidates.map((c) => `${c.value} (${c.occurrences}x)`).join(" vs ")}`,
	);
}

/* ── 5. hasLogo matches the marquee ────────────────────────────────────── */

const marquee = allSource.find((f) => f.file.endsWith("TechLogoMarquee.jsx"));
if (marquee) {
	const iconNames = new Set([...marquee.text.matchAll(/\{\s*name:\s*"([^"]+)"/g)].map((m) => m[1]));
	for (const s of profile.skills) {
		if (s.hasLogo && !iconNames.has(s.name)) {
			errors.push(`skills  "${s.name}" is hasLogo:true but TechLogoMarquee has no icon for it`);
		}
		if (!s.hasLogo && iconNames.has(s.name)) {
			errors.push(`skills  "${s.name}" is hasLogo:false but TechLogoMarquee does have an icon for it`);
		}
	}
}

/* ── 6. aboutPlain must stay in sync with about[] ──────────────────────── */

const { about, aboutPlain } = profile.identity.bio;
if (about.length !== aboutPlain.length) {
	errors.push(`bio     about[] has ${about.length} paragraphs but aboutPlain[] has ${aboutPlain.length}`);
} else {
	about.forEach((segments, i) => {
		const flattened = segments.map((s) => s.text).join("");
		if (flattened !== aboutPlain[i]) {
			errors.push(
				`bio     aboutPlain[${i}] does not match the flattened about[${i}] — ` +
					`the LLM copy has drifted from the rendered copy`,
			);
		}
	});
}

/* ── 6b. statusLabel must match status ─────────────────────────────────── */

// The UI renders statusLabel; the assistant will reason over status. If they
// disagree, the page and the answer disagree about whether work has shipped.
const STATUS_LABELS = {
	"in-development": "In development",
	completed: "Completed",
	archived: "Archived",
	deployed: "Deployed",
	TODO_VERIFY: null,
};
for (const proj of profile.projects) {
	if (proj.status === "TODO_VERIFY") continue;
	const expected = STATUS_LABELS[proj.status];
	if (expected && proj.statusLabel !== expected) {
		errors.push(
			`status  ${proj.id}: status "${proj.status}" implies statusLabel "${expected}", found ${JSON.stringify(proj.statusLabel)}`,
		);
	}
}

/* ── 7. TODO_VERIFY census ─────────────────────────────────────────────── */

let todo = 0;
(function count(node) {
	if (Array.isArray(node)) return node.forEach(count);
	if (node && typeof node === "object") return Object.values(node).forEach(count);
	if (node === "TODO_VERIFY") todo++;
})(profile);
if (todo) {
	warnings.push(
		`${todo} field(s) marked TODO_VERIFY — deliberate, and not a build failure, ` +
			`but they are unverified claims until you confirm them`,
	);
}

/* ── 8. empty-by-design fields are reported, not silently accepted ─────── */

for (const key of ["faq", "notAvailable"]) {
	if (Array.isArray(profile[key]) && profile[key].length === 0) {
		warnings.push(`${key}[] is empty — no source exists for it yet (see profile.NEEDS_INPUT.md)`);
	}
}

/* ── report ────────────────────────────────────────────────────────────── */

const counts = {
	skills: profile.skills.length,
	projects: profile.projects.length,
	certifications: profile.certifications.length,
	socials: profile.contact.socials.length,
	assets: assetRefs.length,
};

if (errors.length) {
	console.error(`\n✖ profile.json failed validation (${errors.length} error${errors.length === 1 ? "" : "s"})\n`);
	for (const e of errors) console.error(`  ${e}`);
	console.error("");
	process.exit(1);
}

console.log(
	`✓ profile.json valid — ` +
		Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", "),
);
for (const w of warnings) console.log(`  ! ${w}`);
process.exit(0);

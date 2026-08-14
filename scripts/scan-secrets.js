#!/usr/bin/env node
/**
 * Fail the build if anything key-shaped is sitting in dist/.
 *
 * The specific hazard for this project: Vite inlines any env var prefixed
 * VITE_ into the client bundle, in plaintext, with no warning. A proxy exists
 * precisely so the provider key never reaches the browser, and one mistyped
 * variable name silently undoes that. This runs after build and before deploy.
 *
 *   node scripts/scan-secrets.js [dir]
 *
 * Exit 0 = clean, 1 = suspected secret, 2 = could not scan (treated as failure;
 * a scanner that silently finds nothing because it looked in the wrong place is
 * the worst possible outcome).
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const TARGET = path.resolve(process.argv[2] ?? "dist");

/** Extensions worth reading. Images and fonts cannot hide a key we can grep. */
const SCANNABLE = new Set([
	".js", ".mjs", ".cjs", ".map", ".json", ".html", ".css", ".txt", ".webmanifest",
]);

const RULES = [
	{ id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{16,}/g, desc: "Anthropic API key" },
	{ id: "openai-key", re: /\bsk-(?!ant-)[A-Za-z0-9]{20,}/g, desc: "OpenAI-style API key" },
	{ id: "google-key", re: /\bAIza[0-9A-Za-z_-]{30,}/g, desc: "Google API key" },
	{ id: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, desc: "AWS access key ID" },
	{ id: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g, desc: "GitHub token" },
	{ id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, desc: "Slack token" },
	{ id: "stripe-key", re: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{20,}/g, desc: "Stripe key" },
	{ id: "private-key-block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, desc: "private key block" },
	{ id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, desc: "JWT" },
	{
		id: "inlined-env-secret",
		// Vite's own footgun: a VITE_-prefixed name that reads like a credential,
		// assigned a non-trivial literal, sitting in shipped client code.
		re: /VITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*\s*[:=]\s*["'][^"']{12,}["']/g,
		desc: "VITE_-prefixed secret inlined into the bundle",
	},
	{
		id: "assigned-secret-literal",
		re: /["'`](?:api[-_]?key|apiKey|secret|access[-_]?token|authToken)["'`]\s*:\s*["'][^"']{16,}["']/gi,
		desc: "credential-shaped key assigned a long literal",
	},
];

/**
 * Known-safe strings that trip the rules. Every entry needs a reason — an
 * unexplained allowlist is how a real key eventually gets waved through.
 */
const ALLOW = [
	{ re: /sk-ant-api03-XXXX/, why: "placeholder used in docs/examples" },
	{ re: /sk-(?:xxx|placeholder|your|example|test123)/i, why: "obvious placeholder" },
	{ re: /AIzaSyEXAMPLE/, why: "Google's own documentation sample" },
];

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) walk(full, out);
		else if (SCANNABLE.has(path.extname(entry).toLowerCase())) out.push(full);
	}
	return out;
}

function redact(s) {
	// Never print the whole thing: CI logs are frequently more public than the
	// artefact that leaked.
	if (s.length <= 12) return `${s.slice(0, 3)}…`;
	return `${s.slice(0, 8)}…${s.slice(-4)} (${s.length} chars)`;
}

function lineOf(content, index) {
	return content.slice(0, index).split("\n").length;
}

if (!existsSync(TARGET)) {
	console.error(`scan-secrets: ${path.relative(process.cwd(), TARGET)} does not exist.`);
	console.error("scan-secrets: run `npm run build` first. Refusing to report a clean scan of nothing.");
	process.exit(2);
}

let files;
try {
	files = walk(TARGET);
} catch (err) {
	console.error(`scan-secrets: could not read ${TARGET}: ${err.message}`);
	process.exit(2);
}

if (files.length === 0) {
	console.error(`scan-secrets: no scannable files under ${path.relative(process.cwd(), TARGET)}.`);
	process.exit(2);
}

const findings = [];
for (const file of files) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	for (const rule of RULES) {
		rule.re.lastIndex = 0;
		for (const m of content.matchAll(rule.re)) {
			const hit = m[0];
			const excused = ALLOW.find((a) => a.re.test(hit));
			if (excused) continue;
			findings.push({
				file: path.relative(process.cwd(), file),
				line: lineOf(content, m.index),
				rule: rule.id,
				desc: rule.desc,
				sample: redact(hit),
			});
		}
	}
}

const scanned = `${files.length} file${files.length === 1 ? "" : "s"} in ${path.relative(process.cwd(), TARGET)}`;

if (findings.length === 0) {
	console.log(`scan-secrets: clean — ${scanned}, ${RULES.length} rules.`);
	process.exit(0);
}

console.error(`\nscan-secrets: ${findings.length} suspected secret(s) in ${scanned}\n`);
for (const f of findings) {
	console.error(`  ${f.file}:${f.line}`);
	console.error(`    rule:  ${f.rule} (${f.desc})`);
	console.error(`    match: ${f.sample}\n`);
}
console.error("Do not deploy this build. If a key reached dist/, treat it as public and rotate it.\n");
process.exit(1);

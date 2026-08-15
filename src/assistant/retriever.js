/**
 * Static fuzzy retrieval over profile.json.
 *
 * BM25-style scoring across an inverted index built once at construction, so
 * search itself is O(query terms x postings) and stays in the microseconds.
 *
 * Three mechanisms carry the accuracy, in descending order of how much work
 * they do:
 *
 *   1. IDF. It resolves most ambiguity for free. "scheduling" appears in one
 *      section so it dominates; "portfolio" appears in half of them because
 *      this IS a portfolio, so it barely moves the score. No hand-tuning.
 *   2. Field weighting. A hit on a section's title or keywords is worth far
 *      more than the same token buried in its body text.
 *   3. Bounded edit distance, tried only for query terms that match nothing
 *      exactly. Typos are rare, so this path is cold.
 *
 * The synonym table is deliberately general vocabulary ("college"->"university",
 * "car"->"vehicle"), not question-to-answer mappings. Anything narrower would
 * be fitting the test set rather than building a retriever.
 */

/* ─── Text processing ───────────────────────────────────────────────────── */

const STOPWORDS = new Set([
	"a", "an", "the", "is", "are", "was", "were", "be", "been", "am", "do", "does",
	"did", "has", "have", "had", "he", "him", "his", "she", "her", "they", "them",
	"i", "me", "my", "you", "your", "it", "its", "this", "that", "these", "those",
	"of", "in", "on", "at", "to", "for", "with", "from", "by", "about", "as", "and",
	"or", "but", "if", "then", "so", "what", "which", "who", "whom", "when", "how", "where",
	"can", "could", "would", "should", "will", "any", "some", "all", "there", "here",
	"me", "much", "many", "tell", "give", "show", "please", "like",
	// Fillers. Excluded not only because they carry no signal, but because the
	// typo repairer would otherwise "fix" them into real terms — "still" is a
	// single edit from "skill", which sent every "is he still a…" query to the
	// tech stack.
	"still", "just", "also", "even", "very", "really", "actually", "ever", "yet",
	"get", "got", "know", "want", "need", "make", "made", "us", "his", "he's",
]);

/** Bidirectional general-vocabulary synonyms. */
const SYNONYM_GROUPS = [
	["university", "college", "school", "campus", "academy"],
	["degree", "course", "major", "qualification"],
	["study", "studies", "studying", "student", "learning", "enrolled"],
	["subject", "subjects", "topic", "topics", "focus", "concentrate", "specialise", "specialize"],
	["car", "vehicle", "auto", "automobile"],
	["cafe", "café", "coffee", "coffeeshop", "coffeehouse", "restaurant"],
	["shop", "store", "retail", "ecommerce", "commerce", "marketplace"],
	["contact", "reach", "touch", "email", "mail", "message", "connect"],
	["location", "located", "based", "live", "lives", "residing", "address"],
	["technology", "technologies", "tech", "stack", "framework", "frameworks", "tool", "tools", "library", "libraries", "language", "languages", "skill", "skills"],
	["database", "databases", "db", "datastore", "sql"],
	["automation", "automate", "automated", "workflow", "orchestration"],
	["job", "role", "position", "work", "employment", "internship", "ojt", "hire", "hiring"],
	["certificate", "certificates", "certification", "certifications", "credential", "credentials"],
	["build", "built", "building", "make", "made", "create", "created", "develop", "developed"],
	["app", "application", "system", "site", "website", "platform", "program", "software"],
	["schedule", "scheduling", "scheduler", "timetable", "calendar"],
	["rent", "rental", "rentals", "renting", "hire"],
	["thrift", "secondhand", "preloved", "vintage"],
	["chatbot", "bot", "assistant", "chat"],
	["client", "customer", "external"],
	["resume", "cv", "curriculum"],
];

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
	for (const term of group) {
		const existing = SYNONYMS.get(term) ?? new Set();
		for (const other of group) if (other !== term) existing.add(other);
		SYNONYMS.set(term, existing);
	}
}

const normalize = (s) =>
	String(s ?? "")
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "") // strip accents so "café" == "cafe"
		.toLowerCase();

/** Crude but adequate suffix stripping — no linguistic ambition. */
function stem(token) {
	if (token.length <= 3) return token;
	for (const suffix of ["ing", "ies", "ed", "es", "s"]) {
		if (token.length - suffix.length >= 3 && token.endsWith(suffix)) {
			let base = token.slice(0, -suffix.length);
			if (suffix === "ies") base += "y";
			return base;
		}
	}
	return token;
}

function tokenize(text, { keepStopwords = false } = {}) {
	return normalize(text)
		.split(/[^a-z0-9+#.]+/)
		.map((t) => t.replace(/^\.+|\.+$/g, ""))
		.filter((t) => t.length > 0 && (keepStopwords || !STOPWORDS.has(t)));
}

/** Optimal string alignment distance, early-exit above `max`. */
function editDistance(a, b, max = 2) {
	if (Math.abs(a.length - b.length) > max) return max + 1;
	const prev2 = new Array(b.length + 1);
	let prev = new Array(b.length + 1);
	let curr = new Array(b.length + 1);
	for (let j = 0; j <= b.length; j++) prev[j] = j;
	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		let rowMin = curr[0];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
			// transposition ("vehcile" -> "vehicle" is one swap, not two edits)
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				v = Math.min(v, prev2[j - 2] + 1);
			}
			curr[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
		[prev, curr] = [curr, prev];
	}
	return prev[b.length];
}

/* ─── Document construction ─────────────────────────────────────────────── */

const FIELD_WEIGHT = { title: 12, name: 9, keywords: 8, strong: 5, body: 2 };

/** Route an faq entry to the section it describes. */
function faqSection(entry) {
	for (const spec of entry.sourceFields ?? []) {
		const m = spec.match(/^projects\[id=([^\]]+)\]/);
		if (m) return m[1];
		if (spec.startsWith("education.")) return "education";
		if (spec.startsWith("skills")) return "stack";
		if (spec.startsWith("certifications")) return "certificate";
		if (spec.startsWith("availability")) return "work";
		if (spec.startsWith("contact.")) return "contact";
		if (spec.startsWith("identity.")) return "profile";
	}
	const byTag = { education: "education", skills: "stack", certifications: "certificate", availability: "work", contact: "contact", projects: null };
	for (const tag of entry.tags ?? []) if (byTag[tag]) return byTag[tag];
	return null;
}

/**
 * Compose each section's searchable fields from the structured profile.
 * Nothing is duplicated into profile.json — the index is derived, so editing a
 * project description automatically re-indexes it.
 */
function buildFields(profile) {
	const fields = new Map(); // sectionId -> { title, keywords, strong, body }
	const put = (id, slot, value) => {
		if (value == null) return;
		const bucket = fields.get(id) ?? { title: [], name: [], keywords: [], strong: [], body: [] };
		bucket[slot].push(Array.isArray(value) ? value.join(" ") : String(value));
		fields.set(id, bucket);
	};

	for (const section of profile.sections ?? []) {
		put(section.id, "title", section.title);
		put(section.id, "keywords", (section.keywords ?? []).join(" "));
	}

	const { identity: idn, education: edu, contact, availability: avail } = profile;

	put("profile", "strong", idn?.name);
	put("profile", "strong", (idn?.titles ?? []).join(" "));
	put("profile", "body", idn?.bio?.hero);
	put("profile", "body", idn?.bio?.footer);
	put("profile", "body", (idn?.bio?.aboutPlain ?? []).join(" "));

	put("education", "strong", edu?.degree);
	put("education", "strong", edu?.institution);
	put("education", "strong", edu?.institutionVariant);
	put("education", "strong", edu?.yearLevel);
	put("education", "body", [edu?.period, edu?.status, edu?.summary].filter(Boolean).join(" "));
	put("education", "strong", (edu?.focusAreas ?? []).join(" "));
	put("education", "strong", (edu?.keySkills ?? []).join(" "));

	for (const skill of profile.skills ?? []) {
		put("stack", "name", skill.name);
	}
	// Each category once, not once per skill. Indexing it per-skill stored
	// "Developer Tools" ten times over, which both inflated the section's length
	// (so length normalisation buried exact skill-name hits) and let a category
	// term outweigh the skills it labels.
	for (const category of new Set((profile.skills ?? []).map((s) => s.category))) {
		put("stack", "keywords", category);
	}

	put("work", "strong", avail?.status);
	put("work", "strong", avail?.seeking);
	put("work", "body", (avail?.statement ?? []).map((s) => s.text).join(""));
	put("work", "strong", (avail?.services ?? []).join(" "));
	put("work", "body", (avail?.lookingFor ?? []).join(" "));
	put("work", "body", (avail?.highlightTags ?? []).join(" "));

	for (const cert of profile.certifications ?? []) {
		put("certificate", "strong", cert.title);
		put("certificate", "strong", cert.org);
		put("certificate", "body", `${cert.year} ${cert.category}`);
	}

	put("contact", "strong", contact?.email);
	put("contact", "strong", contact?.location);
	put("contact", "body", contact?.schedulingUrl);
	for (const social of contact?.socials ?? []) {
		put("contact", "strong", social.platform);
		put("contact", "body", `${social.handle ?? ""} ${social.url ?? ""}`);
	}

	for (const proj of profile.projects ?? []) {
		put(proj.id, "title", proj.title);
		put(proj.id, "strong", proj.org);
		put(proj.id, "strong", (proj.tags ?? []).join(" "));
		put(proj.id, "body", proj.description);
		put(proj.id, "name", proj.kind);
		put(proj.id, "body", [proj.year, proj.term, proj.statusLabel].filter(Boolean).join(" "));
	}

	// FAQ text lands on whichever section it is about, so palette hits on a
	// question return the section a visitor can actually be shown.
	for (const entry of profile.faq ?? []) {
		const id = faqSection(entry);
		if (!id || !fields.has(id)) continue;
		put(id, "keywords", entry.question);
		put(id, "body", entry.answer);
	}

	return fields;
}

/* ─── Index ─────────────────────────────────────────────────────────────── */

const K1 = 1.4;
const B = 0.3;
const SCORE_FLOOR = 0.05;

export function createRetriever(profile) {
	const fields = buildFields(profile);
	const sectionIds = [...fields.keys()];

	// term -> Map(sectionId -> weighted frequency)
	const postings = new Map();
	const sectionLength = new Map();
	const vocabulary = new Set();

	for (const [id, bucket] of fields) {
		let length = 0;
		for (const [slot, weight] of Object.entries(FIELD_WEIGHT)) {
			for (const chunk of bucket[slot]) {
				for (const raw of tokenize(chunk)) {
					const term = stem(raw);
					vocabulary.add(term);
					vocabulary.add(raw);
					const bySection = postings.get(term) ?? new Map();
					bySection.set(id, (bySection.get(id) ?? 0) + weight);
					postings.set(term, bySection);
					// Titles and curated names are labels, not prose volume. Counting
					// them made the stack — 37 atomic skill names — look like a long
					// essay, so length normalisation buried exact skill hits beneath
					// short project cards that merely mention the same technology.
					if (slot !== "title" && slot !== "name") length += 1;
				}
			}
		}
		sectionLength.set(id, length);
	}

	const avgLength =
		[...sectionLength.values()].reduce((a, b) => a + b, 0) / (sectionIds.length || 1);
	const N = sectionIds.length;

	// Length-bucketed vocabulary so typo repair only compares plausible candidates.
	const byLength = new Map();
	for (const term of vocabulary) {
		const bucket = byLength.get(term.length) ?? [];
		bucket.push(term);
		byLength.set(term.length, bucket);
	}

	function repair(token) {
		const max = token.length >= 5 ? 2 : 1;
		let best = null;
		let bestDistance = max + 1;
		for (let len = token.length - max; len <= token.length + max; len++) {
			for (const candidate of byLength.get(len) ?? []) {
				const d = editDistance(token, candidate, max);
				if (d < bestDistance) {
					bestDistance = d;
					best = candidate;
					if (d === 1) return best; // good enough; stop early
				}
			}
		}
		return bestDistance <= max ? best : null;
	}

	/**
	 * Expand each query token into its OWN candidate list, kept separate per
	 * token. Flattening them into one bag lets a single word with five synonyms
	 * contribute five times to a section that matches all five — "shop" pulling
	 * in store/retail/ecommerce/commerce buried the section the query was
	 * actually about. Scoring takes the best candidate per token, so one word is
	 * worth one word however many ways it can be phrased.
	 */
	function expand(tokens) {
		return tokens.map((raw) => {
			const candidates = new Map();
			const add = (term, weight) => {
				candidates.set(term, Math.max(candidates.get(term) ?? 0, weight));
			};
			const stemmed = stem(raw);
			if (postings.has(stemmed)) add(stemmed, 1);
			else if (postings.has(raw)) add(raw, 1);
			else {
				const fixed = repair(raw);
				if (fixed) add(stem(fixed), 0.85);
			}
			for (const synonym of SYNONYMS.get(raw) ?? []) {
				const s = stem(synonym);
				if (postings.has(s)) add(s, 0.72);
			}
			return candidates;
		});
	}

	function search(query, { limit = 5 } = {}) {
		const tokens = tokenize(query);
		if (tokens.length === 0) return [];

		const perToken = expand(tokens);
		const scores = new Map();

		for (const candidates of perToken) {
			// Best single explanation for this query token, per section.
			const bestForToken = new Map();
			for (const [term, termWeight] of candidates) {
				const bySection = postings.get(term);
				if (!bySection) continue;
				const df = bySection.size;
				const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
				for (const [id, freq] of bySection) {
					const len = sectionLength.get(id) || 1;
					const tf = (freq * (K1 + 1)) / (freq + K1 * (1 - B + (B * len) / avgLength));
					const contribution = idf * tf * termWeight;
					if (contribution > (bestForToken.get(id) ?? 0)) bestForToken.set(id, contribution);
				}
			}
			for (const [id, contribution] of bestForToken) {
				scores.set(id, (scores.get(id) ?? 0) + contribution);
			}
		}

		if (scores.size === 0) return [];
		const max = Math.max(...scores.values());
		return [...scores.entries()]
			.map(([sectionId, raw]) => ({ sectionId, score: raw / max }))
			.filter((r) => r.score >= SCORE_FLOOR)
			.sort((a, b) => b.score - a.score || a.sectionId.localeCompare(b.sectionId))
			.slice(0, limit);
	}

	return { search };
}

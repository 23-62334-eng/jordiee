/**
 * The difficulty bands, as fixed ranges of level numbers.
 *
 * Bands are positional rather than computed from each level: a player wants to
 * know "I am in Nightmare now", and that promise has to hold whatever the set
 * contains. The generator's job is to make the levels in each range actually
 * deserve the label; this file is where the labels live.
 */
export const TIERS = [
	{ name: "Easy", from: 1, to: 12 },
	{ name: "Normal", from: 13, to: 24 },
	{ name: "Hard", from: 25, to: 36 },
	{ name: "Expert", from: 37, to: 48 },
	{ name: "Nightmare", from: 49, to: 60 },
	{ name: "Insane", from: 61, to: 72 },
	{ name: "Impossible", from: 73, to: 84 },
	{ name: "Legendary", from: 85, to: 100 },
];

/** The band a zero-based level index falls in. */
export function tierFor(index) {
	const number = index + 1;
	return TIERS.find((tier) => number >= tier.from && number <= tier.to) ?? TIERS.at(-1);
}

/** How far through its own band a level sits, 0–1, for a progress bar. */
export function tierProgress(index) {
	const tier = tierFor(index);
	const span = tier.to - tier.from + 1;
	return (index + 1 - tier.from + 1) / span;
}

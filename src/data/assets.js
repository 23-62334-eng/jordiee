/**
 * Resolve the relative asset paths in profile.json to hashed build URLs.
 *
 * profile.json stores paths as plain strings ("proj/batCafe/batCafe1.webp")
 * because JSON cannot hold a module reference. Vite still needs a static
 * import graph to fingerprint and emit those files, which import.meta.glob
 * provides — the glob is analysed at build time, so every matching asset is
 * bundled even though the lookup key is computed at runtime.
 *
 * The glob is scoped to the directories profile.json actually references. A
 * broader pattern eagerly bundles every matching file, which silently re-added
 * an unused 344 KB SVG to the build.
 *
 * A missing key throws rather than rendering a broken image: scripts/
 * validate-profile.js already fails the build for a dangling path, so reaching
 * this error at runtime means the two got out of sync.
 */

const modules = import.meta.glob("../assets/{proj,cert,cv}/**/*.{webp,jpg,jpeg,png,svg,pdf}", {
	eager: true,
	import: "default",
});

export function asset(relativePath) {
	const url = modules[`../assets/${relativePath}`];
	if (!url) {
		throw new Error(
			`asset("${relativePath}") did not resolve. ` +
				`Run \`npm run validate:profile\` — profile.json and src/assets/ have diverged.`,
		);
	}
	return url;
}

/** Map an array of relative paths in one call. */
export const assets = (paths = []) => paths.map(asset);

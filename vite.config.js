import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "api");

/**
 * Read a request body the way Vercel's Node runtime does.
 *
 * Vercel hands the handler an already-parsed `req.body`; plain Node hands it an
 * unread stream. api/chat.js destructures `req.body`, so without this the
 * assistant reads every local request as "no question asked" — a failure that
 * looks exactly like a validation bug and is not one.
 *
 * Malformed JSON resolves to undefined rather than throwing, because that is
 * what the platform does: the handlers already treat a missing body as a
 * missing question and answer with 400.
 */
async function readBody(req) {
	if (req.method === "GET" || req.method === "HEAD") return undefined;

	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	if (chunks.length === 0) return undefined;

	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw) return undefined;
	if (!String(req.headers["content-type"] ?? "").includes("application/json")) return raw;

	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * The other half of the platform shim: Vercel decorates the response with
 * Express-style helpers that plain Node does not have. `res.status(...).json()`
 * appears throughout api/chat.js, so a handler that is correct when deployed
 * throws a TypeError here without these.
 */
function decorate(res) {
	res.status = (code) => {
		res.statusCode = code;
		return res;
	};
	res.json = (body) => {
		if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.end(JSON.stringify(body));
		return res;
	};
	res.send = (body) => {
		res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
		return res;
	};
	return res;
}

/**
 * Serve api/ under `vite dev` on the paths those files answer on when deployed.
 *
 * Without this the endpoints exist only in production, so the first time anyone
 * finds out whether the assistant works is after a deploy — which is precisely
 * how this project ended up with a fully built chat backend that had never once
 * run. ssrLoadModule keeps the handlers hot-reloading.
 *
 * Routing deliberately mirrors the platform's rather than inventing its own:
 * one flat `/api/<name>` per file, and `_`-prefixed modules are not routable.
 * Vercel treats those as private, so serving them here would give the dev
 * server a route production does not have — the opposite of the point.
 */
function apiRoutes() {
	return {
		name: "api-routes",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = new URL(req.url ?? "/", "http://localhost");
				if (!url.pathname.startsWith("/api/")) return next();

				const name = url.pathname.slice("/api/".length);
				if (!/^[a-zA-Z0-9-]+$/.test(name)) return next();

				const file = path.join(API_DIR, `${name}.js`);
				if (!existsSync(file)) return next();

				try {
					const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`);
					req.body = await readBody(req);
					req.query = Object.fromEntries(url.searchParams);
					await handler(req, decorate(res));
				} catch (error) {
					// Loud in the terminal, quiet on the wire: the stack is a
					// developer's to read, not a response body's to carry.
					server.config.logger.error(
						`[api] /api/${name} threw: ${error?.stack ?? error}`,
						{ timestamp: true },
					);
					if (!res.headersSent) {
						res.statusCode = 500;
						res.setHeader("Content-Type", "application/json; charset=utf-8");
					}
					if (!res.writableEnded) res.end(JSON.stringify({ error: "Handler failed. See the dev server log." }));
				}
			});
		},
	};
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	// Load .env.local for the functions above, which run in THIS process under
	// `vite dev`. These land on process.env only — the client bundle can reach
	// nothing but import.meta.env.VITE_*, so LLM_PROVIDER_KEY stays server-side
	// exactly as it is when deployed. A real environment variable always wins.
	Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ""), ...process.env });

	return {
		plugins: [tailwindcss(), react(), apiRoutes()],
	};
});

import { useEffect, useRef, useState } from "react";
import {
	fetchContributions,
	normalizeContributions,
	selectContributionDays,
	REFRESH_INTERVAL_MS,
	REQUEST_TIMEOUT_MS,
} from "../lib/githubContributions.js";

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}contributions.json`;
const LOADING = { status: "loading", days: null, checkedAt: null };

export default function useContributions(year) {
	const [records, setRecords] = useState({});
	const cache = useRef(new Map());
	const scope = year ?? "last";

	useEffect(() => {
		let disposed = false;
		let inFlight = false;
		let controller;
		let lastAttempt = cache.current.get(scope)?.lastAttempt ?? 0;
		const cached = cache.current.get(scope)?.record;
		let lastGood = cached?.days ? cached : null;

		const request = async (load) => {
			controller = new AbortController();
			const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
			try {
				return await load(controller.signal);
			} finally {
				window.clearTimeout(timeout);
			}
		};

		const publish = (record) => {
			if (!disposed) {
				cache.current.set(scope, { record, lastAttempt });
				setRecords((previous) => ({ ...previous, [scope]: record }));
			}
		};

		const refresh = async () => {
			// One request per minute at most, even when focus/online events overlap.
			if (disposed || inFlight || document.visibilityState === "hidden" ||
				(lastAttempt && Date.now() - lastAttempt < REFRESH_INTERVAL_MS)) return;
			inFlight = true;
			lastAttempt = Date.now();

			try {
				// no-store alone cannot bypass the provider's one-hour server cache.
				// Refresh only the viewed year, never the account's entire history.
				const days = await request((signal) => fetchContributions(year, { signal, fresh: true }));
				lastGood = { status: "ready", days, checkedAt: new Date().toISOString() };
				publish(lastGood);
			} catch {
				if (disposed) return;
				if (lastGood) {
					publish({ ...lastGood, status: "stale" });
				} else {
					try {
						const snapshot = await request(async (signal) => {
							const response = await fetch(SNAPSHOT_URL, { signal, cache: "no-cache" });
							if (!response.ok) throw new Error("Saved contributions unavailable");
							return response.json();
						});
						const days = selectContributionDays(normalizeContributions(snapshot), year);
						if (!days.length) throw new Error("No saved contributions for this year");
						lastGood = { status: "stale", days, savedAt: snapshot.generatedAt, checkedAt: null };
						publish(lastGood);
					} catch {
						publish({ status: "error", days: null, checkedAt: null });
					}
				}
			} finally {
				inFlight = false;
			}
		};

		void refresh();
		const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
		window.addEventListener("focus", refresh);
		window.addEventListener("online", refresh);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			disposed = true;
			controller?.abort();
			window.clearInterval(interval);
			window.removeEventListener("focus", refresh);
			window.removeEventListener("online", refresh);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [scope, year]);

	return records[scope] ?? LOADING;
}

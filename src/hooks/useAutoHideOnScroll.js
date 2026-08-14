import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reveals an element while the page is scrolling and hides it again after
 * `delay` ms of inactivity.
 *
 * The countdown is suspended while the element is "pinned" — the pointer is
 * over it or something inside it holds keyboard focus — so it can never
 * disappear out from under an interaction.
 *
 * Returns:
 *   visible — current visibility
 *   pin     — keep it up indefinitely (pointer enter / focus in)
 *   unpin   — release the hold and restart the countdown (pointer leave / focus out)
 *   reveal  — show it and restart the countdown (taps, programmatic nudges)
 */
export function useAutoHideOnScroll(delay = 1500) {
	const [visible, setVisible] = useState(true);

	const timerRef = useRef(null);
	const pinnedRef = useRef(false);
	// Mirrors `visible` so the scroll handler can skip redundant state updates.
	const visibleRef = useRef(true);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const setVisibility = useCallback((next) => {
		if (visibleRef.current === next) return;
		visibleRef.current = next;
		setVisible(next);
	}, []);

	// Restarts the countdown without touching visibility, so it is safe to call
	// straight from an effect body.
	const scheduleHide = useCallback(() => {
		clearTimer();
		if (pinnedRef.current) return;
		timerRef.current = setTimeout(() => setVisibility(false), delay);
	}, [clearTimer, setVisibility, delay]);

	const reveal = useCallback(() => {
		setVisibility(true);
		scheduleHide();
	}, [setVisibility, scheduleHide]);

	const pin = useCallback(() => {
		pinnedRef.current = true;
		clearTimer();
		setVisibility(true);
	}, [clearTimer, setVisibility]);

	const unpin = useCallback(() => {
		pinnedRef.current = false;
		reveal();
	}, [reveal]);

	useEffect(() => {
		window.addEventListener("scroll", reveal, { passive: true });
		// Visible on mount, then settle into the auto-hide cycle.
		scheduleHide();

		return () => {
			window.removeEventListener("scroll", reveal);
			clearTimer();
		};
	}, [reveal, scheduleHide, clearTimer]);

	return { visible, pin, unpin, reveal };
}

export default useAutoHideOnScroll;

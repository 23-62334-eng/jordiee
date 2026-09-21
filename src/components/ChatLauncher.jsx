import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import PROFILE from "../data/profile.json";
import avatar from "../assets/me/me-avatar.webp";
import { COUNTER_VISIBLE_AT, MAX_INPUT_CHARS } from "../lib/assistantContract.js";

/**
 * The portfolio assistant's chat panel.
 *
 * Closed by default and never auto-opens: it is an offer, not an interruption.
 * Everything it knows comes from /api/chat, which grounds its answers in
 * profile.json — this component holds no facts about its owner and must not
 * start to, or the page and the assistant can disagree.
 *
 * ── VISUAL LANGUAGE ────────────────────────────────────────────────────────
 *
 * Borrowed from the site rather than invented, because a chat panel that looks
 * like a bought-in widget reads as one. Three things carry the theme:
 *
 *   MONOCHROME. index.css retones the whole gray scale to pure neutral
 *   specifically so dark mode does not read as navy, and sets the accent to
 *   black on light and white on dark. This panel used to be blue-600 with
 *   blue-50 bubbles — the only saturated thing on an otherwise black-and-white
 *   site. The accent is now the same inversion NavBar's active dock icon uses.
 *
 *   GLASS. The same backdrop-filter recipe as .glass-nav — blur(80px)
 *   saturate(180%) over a translucent base — so the panel and the dock below it
 *   read as one material. Raised from the dock's 0.08 alpha because this
 *   surface carries body text rather than icons.
 *
 *   PILLS. rounded-full on every control, matching the dock, the .tag class and
 *   the theme toggle; rounded-3xl on the panel, matching the site's cards.
 */

/** The endpoint. Same-origin, so the provider key stays server-side. */
const ENDPOINT = "/api/chat";

/**
 * What the UI calls him, read from profile.json rather than typed here.
 *
 * `identity.alias` is already how the About section introduces him ("Hello! I'm
 * Jordiee"), so the chat using it too is the site being consistent rather than
 * holding a second opinion about its owner's name. Hardcoding it would create a
 * second place to edit and the first one to go stale.
 *
 * Note this renames the UI only. Answers still come from the model, which is
 * given both the full name and the alias, so it may use either.
 */
const DISPLAY_NAME = PROFILE.identity.alias ?? PROFILE.identity.name.split(" ")[0];

/**
 * Vertical stacking against NavBar's floating dock.
 *
 * The dock is `fixed left-0 right-0 … justify-center`, so its pill is centred
 * and — below `sm` — a FIXED 280px wide regardless of viewport. The launcher is
 * 56px at a 16px right margin, so sitting beside it needs 280 + 56 + 16 + a
 * real gap ≈ 364px before any left margin at all. Measured pill-edge to
 * button-edge: −52px at 320, −32px at 360, −17px at 390, and +3px at 430 —
 * which is a coincidence, not a gap. There is no phone width where side-by-side
 * works, so on phones the launcher goes ABOVE the dock instead.
 *
 * The numbers below are that stack, bottom-up, and each depends on the one
 * before it. They are named rather than inlined because changing one without
 * the others silently reintroduces the overlap this fixes.
 *
 *   dock:      bottom env(safe)+1rem, 60px tall   → its top edge is safe+76px
 *   launcher:  safe + 5.5rem (88px)               → 12px above the dock
 *   panel:     safe + 9.75rem (156px)             → 12px above the launcher
 *
 * `env(safe-area-inset-bottom)` matches what NavBar already does: without it
 * the stack starts underneath the iPhone home indicator and every gap above is
 * measured from the wrong place.
 *
 * From `sm` up the dock's pill grows but the viewport grows faster — 66px of
 * clearance at 640px, 378px at 1280px — so the launcher returns to the
 * conventional bottom-right corner and the panel sits directly above it.
 *
 * scripts/verify-chat-ui.js asserts all of this as rectangle intersection at
 * nine viewport sizes.
 */
const LAUNCHER_POSITION =
	"right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] " +
	"sm:right-6 sm:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]";

const PANEL_POSITION =
	"inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+9.75rem)] " +
	"sm:inset-x-auto sm:right-6 sm:w-96 " +
	"sm:bottom-[calc(env(safe-area-inset-bottom)+6rem)]";

/**
 * Panel height, bounded so it can never grow up off the top of the screen.
 *
 * The subtrahend is everything below the panel plus a top margin: 9.75rem of
 * stack on phones and 6rem on larger screens, each plus the safe-area inset and
 * ~2rem of breathing room. On the shortest phone in common use (568px) that
 * still leaves the panel 376px tall with 36px clear above it.
 */
const PANEL_HEIGHT =
	"max-h-[min(32rem,calc(100dvh-env(safe-area-inset-bottom)-12rem))] " +
	"sm:max-h-[min(32rem,calc(100dvh-env(safe-area-inset-bottom)-9rem))]";

/** Suggested openers, taken from the FAQ the owner already publishes. */
const SUGGESTIONS = (PROFILE.faq ?? []).slice(0, 4);

/**
 * Parse an SSE byte stream into { event, data } frames.
 *
 * The previous client read `data:` lines and ignored `event:` entirely, so it
 * could not tell a token from a completion from a fault — the server's `error`
 * frame carries no text, so a failed answer simply left an empty bubble on
 * screen forever. Frames are blank-line delimited; a frame may legally carry
 * several `data:` lines, which concatenate.
 */
async function* readFrames(body, signal) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (!signal?.aborted) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			let split;
			while ((split = buffer.indexOf("\n\n")) !== -1) {
				const raw = buffer.slice(0, split);
				buffer = buffer.slice(split + 2);

				let event = "message";
				let data = "";
				for (const line of raw.split("\n")) {
					if (line.startsWith("event:")) event = line.slice(6).trim();
					else if (line.startsWith("data:")) data += line.slice(5).trim();
				}
				if (!data) continue;
				try {
					yield { event, data: JSON.parse(data) };
				} catch {
					// A torn frame means the connection died mid-write. Stop
					// rather than guess at half a payload.
					return;
				}
			}
		}
	} finally {
		reader.cancel().catch(() => {});
	}
}

let nextId = 0;
const makeId = () => `m${nextId++}`;

/* ─── Icons ─────────────────────────────────────────────────────────────────
 *
 * Inline, stroked at 1.6 to match the dock's line weight, and drawn in
 * currentColor so each one inherits the monochrome inversion instead of
 * carrying a colour of its own.
 */

const Icon = ({ path, className = "h-5 w-5", fill = "none" }) => (
	<svg
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
		viewBox="0 0 24 24"
		fill={fill}
		stroke="currentColor"
		strokeWidth={1.6}
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		{path}
	</svg>
);

const ChatIcon = () => (
	<Icon
		className="h-6 w-6"
		path={
			<path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 0 1-4-.86L3 20l1.16-4.11A7.94 7.94 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
		}
	/>
);
const CloseIcon = ({ className }) => (
	<Icon className={className} path={<path d="M6 18 18 6M6 6l12 12" />} />
);
const SendIcon = () => (
	<Icon className="h-[18px] w-[18px]" path={<path d="M12 19V5M5 12l7-7 7 7" />} />
);
const StopIcon = () => (
	<Icon
		className="h-[18px] w-[18px]"
		fill="currentColor"
		path={<rect x="7" y="7" width="10" height="10" rx="1.5" />}
	/>
);

export default function ChatLauncher() {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState([]);
	const [draft, setDraft] = useState("");
	const [streaming, setStreaming] = useState(false);

	const panelId = useId();
	const controllerRef = useRef(null);
	const inputRef = useRef(null);
	const launcherRef = useRef(null);
	const transcriptRef = useRef(null);
	const pinnedToBottom = useRef(true);

	/* ── Lifecycle ──────────────────────────────────────────────────────── */

	// An in-flight request outlives the component without this, and its state
	// updates land on an unmounted tree.
	useEffect(() => () => controllerRef.current?.abort(), []);

	// Escape closes, from anywhere in the panel. Bound only while open so it
	// cannot swallow the key from anything else on the page.
	useEffect(() => {
		if (!open) return undefined;
		const onKey = (event) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	// Focus moves into the panel on open and back to the button on close, so
	// the chat is reachable and escapable without a mouse.
	useEffect(() => {
		if (open) inputRef.current?.focus();
		else launcherRef.current?.focus();
	}, [open]);

	/**
	 * Follow the stream, but only while the visitor is already at the bottom.
	 * Scrolling up to re-read an earlier answer is a deliberate act, and
	 * yanking the view back down every time a token arrives undoes it.
	 */
	useEffect(() => {
		const el = transcriptRef.current;
		if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
	}, [messages]);

	const onTranscriptScroll = useCallback((event) => {
		const el = event.currentTarget;
		pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
	}, []);

	/* ── Sending ────────────────────────────────────────────────────────── */

	const patchLast = useCallback((patch) => {
		setMessages((prev) => {
			const last = prev.at(-1);
			if (!last || last.role !== "assistant") return prev;
			return [...prev.slice(0, -1), { ...last, ...patch(last) }];
		});
	}, []);

	const send = useCallback(
		async (raw) => {
			const question = raw.trim();
			if (!question || streaming) return;

			// The server enforces this; the box just stops the visitor from
			// composing something it will reject. See assistantContract.js.
			if (question.length > MAX_INPUT_CHARS) return;

			// Built BEFORE the new turn is appended: the server wants the
			// conversation so far, not including the question it is answering.
			// Degraded turns are excluded — replaying a fallback sentence back
			// at the model as though it were a real answer teaches it that
			// "the assistant is unavailable" is a thing it once said.
			const history = messages
				.filter((m) => m.text && !m.degraded && !m.failed)
				.map((m) => ({ role: m.role, content: m.text }));

			const pending = { id: makeId(), role: "assistant", text: "" };
			setMessages((prev) => [
				...prev,
				{ id: makeId(), role: "user", text: question },
				pending,
			]);
			setDraft("");
			setStreaming(true);
			pinnedToBottom.current = true;

			const controller = new AbortController();
			controllerRef.current = controller;

			try {
				const res = await fetch(ENDPOINT, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ question, history }),
					signal: controller.signal,
				});

				// Not every answer is a stream. Throttling, validation failures
				// and the daily-budget kill switch all reply with one JSON body
				// — including on 200, which is why the content type is checked
				// rather than just res.ok.
				const contentType = res.headers.get("content-type") ?? "";
				if (!contentType.includes("text/event-stream")) {
					const body = await res.json().catch(() => null);
					patchLast(() => ({
						text:
							body?.answer ??
							"Something went wrong reaching the assistant. Please try again.",
						degraded: body?.degraded ?? true,
						source: body?.source ?? "error",
						failed: !body?.answer,
					}));
					return;
				}

				let sawText = false;
				for await (const { event, data } of readFrames(res.body, controller.signal)) {
					if (event === "delta" && data.text) {
						sawText = true;
						patchLast((last) => ({
							text: last.text + data.text,
							degraded: data.degraded ?? last.degraded,
						}));
					} else if (event === "error" && data.truncated) {
						patchLast(() => ({ truncated: true }));
					} else if (event === "done") {
						patchLast((last) => ({
							degraded: data.degraded ?? last.degraded,
							source: data.source ?? last.source,
						}));
					}
				}

				// A stream that closes having said nothing is still a failure,
				// and an empty bubble is the least useful way to report it.
				if (!sawText) {
					patchLast((last) =>
						last.text
							? {}
							: {
									text: "The assistant did not send a reply. Please try again.",
									failed: true,
								},
					);
				}
			} catch (error) {
				// An abort is the visitor pressing Stop. Whatever arrived is
				// theirs to keep; only an empty bubble needs replacing.
				const stopped = error?.name === "AbortError";
				patchLast((last) => {
					if (stopped) return last.text ? { stopped: true } : { text: "Stopped.", stopped: true };
					return last.text
						? { truncated: true }
						: {
								text: "Could not reach the assistant. Check your connection and try again.",
								failed: true,
							};
				});
			} finally {
				controllerRef.current = null;
				setStreaming(false);
			}
		},
		[messages, patchLast, streaming],
	);

	const stop = useCallback(() => controllerRef.current?.abort(), []);

	/* ── Render ─────────────────────────────────────────────────────────── */

	const over = draft.length > MAX_INPUT_CHARS;
	const showCounter = draft.length >= COUNTER_VISIBLE_AT;
	const canSend = Boolean(draft.trim()) && !over;

	return (
		<>
			<style>{`
				/* The panel's material. The blur recipe is NavBar's .glass-nav
				   verbatim — blur(80px) saturate(180%) — because that is what
				   makes the panel and the dock beneath it read as the same
				   material, and it is the part worth matching exactly.
				   Verified rendering, not merely declared.

				   The base alpha deliberately does NOT match. The dock runs at
				   0.08/0.6 and can afford to: every icon it holds sits on its
				   own opaque circle, so the glass there is pure decoration.
				   This surface carries body text directly. At the dock's alpha
				   the page reads through the transcript — legible over the
				   plain black and white of most sections, but the panel also
				   opens over the certificate and project photography, and
				   answers should not get harder to read depending on where the
				   visitor happened to scroll to. */
				.chat-surface {
					background: rgba(255, 255, 255, 0.9);
					backdrop-filter: blur(80px) saturate(180%);
					-webkit-backdrop-filter: blur(80px) saturate(180%);
					box-shadow:
						0 8px 32px rgba(0, 0, 0, 0.1),
						0 2px 8px rgba(0, 0, 0, 0.05),
						inset 0 1px 0 rgba(255, 255, 255, 0.4);
				}
				.dark .chat-surface {
					background: rgba(20, 20, 20, 0.88);
					box-shadow:
						0 8px 32px rgba(0, 0, 0, 0.5),
						0 2px 8px rgba(0, 0, 0, 0.3),
						inset 0 1px 0 rgba(255, 255, 255, 0.08);
				}

				/* The accent, lifted from .nav-button-active: black on light,
				   white on dark. Shared by the launcher, the send button and the
				   visitor's own messages, so everything the visitor authored or
				   acts on is one colour and everything the assistant said is
				   the neutral surface. */
				.chat-accent {
					background: #000000;
					color: #ffffff;
					box-shadow:
						0 4px 16px rgba(0, 0, 0, 0.18),
						0 2px 8px rgba(0, 0, 0, 0.12),
						inset 0 1px 2px rgba(255, 255, 255, 0.15);
				}
				.dark .chat-accent {
					background: #ffffff;
					color: #000000;
					box-shadow:
						0 4px 16px rgba(0, 0, 0, 0.5),
						0 2px 8px rgba(0, 0, 0, 0.35);
				}

				/* A default scrollbar is the one piece of unstyled chrome that
				   gives a panel like this away, and it is only visible on the
				   platforms least likely to be checked. */
				.chat-scroll {
					scrollbar-width: thin;
					scrollbar-color: rgba(0, 0, 0, 0.18) transparent;
				}
				.dark .chat-scroll { scrollbar-color: rgba(255, 255, 255, 0.18) transparent; }
				.chat-scroll::-webkit-scrollbar { width: 6px; }
				.chat-scroll::-webkit-scrollbar-track { background: transparent; }
				.chat-scroll::-webkit-scrollbar-thumb {
					background: rgba(0, 0, 0, 0.18);
					border-radius: 999px;
				}
				.dark .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); }
			`}</style>

			{/*
			  The launcher. `aria-expanded` and `aria-controls` tie it to the
			  panel so a screen reader announces what it does, not merely that
			  it is a button.
			*/}
			<motion.button
				ref={launcherRef}
				type="button"
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				whileTap={{ scale: 0.94 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-controls={panelId}
				aria-label={open ? "Close the assistant" : `Ask the assistant about ${DISPLAY_NAME}`}
				className={`chat-accent fixed ${LAUNCHER_POSITION} z-50 flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-white dark:focus-visible:ring-offset-gray-900`}
			>
				{open ? <CloseIcon className="h-6 w-6" /> : <ChatIcon />}
			</motion.button>

			{/*
			  Unmounted when closed, not merely transparent. A panel kept in the
			  DOM at opacity 0 is still read out in full by a screen reader and
			  still collects tab stops nobody can see.
			*/}
			<AnimatePresence>
				{open && (
					<motion.div
						id={panelId}
						role="dialog"
						aria-label={`Assistant — ask about ${DISPLAY_NAME}`}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.98 }}
						transition={{ duration: 0.24, ease: [0.34, 1.26, 0.64, 1] }}
						className={`chat-surface fixed ${PANEL_POSITION} ${PANEL_HEIGHT} z-50 flex flex-col overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700`}
					>
						{/* ── Header ──────────────────────────────────────── */}
						{/*
						  px-3 below `sm`, because at 280px (a folded phone's
						  cover screen) the header is the tightest row in the
						  panel: 36px of avatar and a close button leave the
						  title barely 99px, and "Ask about Jordiee" needs 122.
						  The two saved gutters plus the wrapping below are what
						  keep his name whole there.
						*/}
						<header className="flex items-center gap-2.5 border-b border-gray-200/70 px-3 py-3 min-[320px]:gap-3 sm:px-4 dark:border-gray-700/70">
							{/*
							  Decorative: the name sits beside it in text, so a
							  screen reader announcing the photo as well would
							  just say it twice.
							*/}
							<img
								src={avatar}
								alt=""
								width={36}
								height={36}
								decoding="async"
								className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gray-900/10 min-[320px]:h-9 min-[320px]:w-9 dark:ring-white/15"
							/>

							<div className="min-w-0 flex-1">
								{/*
								  Wraps rather than truncates, for the same
								  reason the subtitle does — except here the
								  thing being cut would be his NAME, which is
								  the one word in the panel that must never
								  arrive as "Jordie…". `flex-wrap` lets the AI
								  chip drop to the second line with it instead
								  of squeezing the name further.
								*/}
								<h2 className="flex flex-wrap items-center gap-x-1 text-[0.9375rem] leading-tight font-semibold tracking-tight min-[320px]:gap-x-1.5 text-gray-900 dark:text-white">
									<span>Ask about {DISPLAY_NAME}</span>
									{/*
									  What is left of the disclosure sentence
									  that used to take two lines of header on
									  every view. Answers are model-generated
									  about a real person and a recruiter
									  reading them is owed that fact — but it
									  does not need a paragraph to say so.
									*/}
									<span
										title={`Answers are AI-generated from ${DISPLAY_NAME}'s profile`}
										className="shrink-0 rounded-full border border-gray-300 px-1 py-px text-[0.5rem] font-semibold tracking-[0.04em] min-[320px]:px-1.5 min-[320px]:text-[0.5625rem] min-[320px]:tracking-[0.08em] text-gray-500 dark:border-gray-600 dark:text-gray-400"
									>
										AI
									</span>
								</h2>
								{/*
								  This line used to carry his job title, which
								  put HIS role under HIS photo and read as a
								  contact card for him — implying the chat was
								  him, while every answer underneath it said
								  "he". The system prompt spends a paragraph
								  establishing that the assistant is not him;
								  the header should not be the one place
								  undercutting that.

								  What it says now is doing a second job. This
								  assistant declines a great deal by design —
								  salary, grades, opinions about people, any
								  technology not on the list — and an
								  unannounced refusal reads as a broken bot
								  rather than a careful one. Saying so up front
								  turns every one of those into the thing
								  working as described.

								  Phrased short because it has to survive a
								  320px iPhone SE, where the header gives this
								  line 158px: "Only answers what's published"
								  measured 169px and was clipped mid-word. The
								  verb is what went — the line above it already
								  supplies one ("Ask about Jordiee"), so the
								  qualifier reads on its own.

								  It wraps rather than truncates. Cutting a
								  sentence about what the assistant will not do
								  is the worst of both outcomes: the caveat is
								  gone and a ragged ellipsis is left in its
								  place. A second line on a very narrow screen
								  costs nothing — the header has no fixed
								  height.

								  The dot is the same motif the section
								  headings use.
								*/}
								<p className="mt-0.5 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
									<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-900 dark:bg-white" />
									<span>Only what&rsquo;s published</span>
								</p>
							</div>

							<button
								type="button"
								onClick={() => setOpen(false)}
								aria-label="Close"
								className="-mr-1 shrink-0 rounded-full p-1 text-gray-500 transition min-[320px]:p-1.5 hover:bg-gray-900/5 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white"
							>
								<CloseIcon className="h-4 w-4" />
							</button>
						</header>

						{/* ── Transcript ──────────────────────────────────── */}
						<div
							ref={transcriptRef}
							onScroll={onTranscriptScroll}
							aria-live="polite"
							aria-relevant="additions"
							aria-busy={streaming}
							className="chat-scroll flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
						>
							{messages.length === 0 ? (
								<div className="space-y-3">
									<p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
										Ask about his projects, stack, education, availability or how
										to get in touch.
									</p>
									<div className="flex flex-wrap gap-1.5">
										{SUGGESTIONS.map((f) => (
											<button
												key={f.id}
												type="button"
												onClick={() => send(f.question)}
												className="rounded-full border border-gray-300 bg-white/60 px-3 py-1.5 text-xs text-gray-700 transition hover:border-gray-900 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none dark:border-gray-600 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white dark:hover:text-white dark:focus-visible:ring-white"
											>
												{f.question}
											</button>
										))}
									</div>
								</div>
							) : (
								messages.map((m) => (
									<Bubble key={m.id} message={m} streaming={streaming} />
								))
							)}
						</div>

						{/* ── Composer ────────────────────────────────────── */}
						<div className="border-t border-gray-200/70 px-3 py-3 dark:border-gray-700/70">
							<form
								onSubmit={(event) => {
									event.preventDefault();
									send(draft);
								}}
								className="flex items-center gap-2"
							>
								<label htmlFor={`${panelId}-input`} className="sr-only">
									Ask a question about {DISPLAY_NAME}
								</label>
								<input
									id={`${panelId}-input`}
									ref={inputRef}
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									disabled={streaming}
									placeholder="Type a question…"
									autoComplete="off"
									aria-describedby={showCounter ? `${panelId}-count` : undefined}
									aria-invalid={over || undefined}
									className={`min-w-0 flex-1 rounded-full border bg-white/70 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none disabled:opacity-60 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 ${
										over
											? "border-red-500 dark:border-red-500"
											: "border-gray-300 focus-visible:border-gray-900 dark:border-gray-600 dark:focus-visible:border-white"
									}`}
								/>

								{streaming ? (
									<button
										type="button"
										onClick={stop}
										aria-label="Stop"
										className="chat-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-white dark:focus-visible:ring-offset-gray-900"
									>
										<StopIcon />
									</button>
								) : (
									<button
										type="submit"
										disabled={!canSend}
										aria-label="Send"
										className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-white dark:focus-visible:ring-offset-gray-900 ${
											canSend
												? "chat-accent hover:scale-105"
												: "cursor-not-allowed border border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-600"
										}`}
									>
										<SendIcon />
									</button>
								)}
							</form>

							{showCounter && (
								<p
									id={`${panelId}-count`}
									className={`mt-1.5 pr-12 text-right text-xs tabular-nums ${
										over ? "text-red-600 dark:text-red-400" : "text-gray-500"
									}`}
								>
									{draft.length} / {MAX_INPUT_CHARS}
								</p>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

/**
 * One turn.
 *
 * A degraded answer is LABELLED rather than silently presented as the model's
 * own. When the provider is down the server answers from profile.json's FAQ,
 * which is a real answer and worth showing — but showing it unmarked would make
 * the site quietly less truthful about where its words came from.
 */
function Bubble({ message, streaming }) {
	const mine = message.role === "user";
	const empty = !message.text;

	return (
		<div className={mine ? "flex justify-end" : "flex justify-start"}>
			<div className="max-w-[86%]">
				<div
					className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
						mine
							? "chat-accent rounded-2xl rounded-br-md"
							: message.failed
								? "rounded-2xl rounded-bl-md border border-red-300 bg-red-50/80 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
								: "rounded-2xl rounded-bl-md border border-gray-200 bg-white/70 text-gray-900 dark:border-gray-700 dark:bg-white/5 dark:text-gray-100"
					}`}
				>
					{empty && streaming ? (
						<span className="flex h-5 items-center gap-1" aria-label="Thinking">
							{[0, 1, 2].map((i) => (
								<span
									key={i}
									className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-900 dark:bg-white"
									style={{ animationDelay: `${i * 140}ms` }}
								/>
							))}
						</span>
					) : (
						message.text
					)}
				</div>

				{!mine && (message.degraded || message.truncated || message.stopped) && (
					<p className="mt-1 px-1 text-xs text-gray-500 dark:text-gray-400">
						{message.stopped
							? "Stopped."
							: message.truncated
								? "This answer was cut off."
								: message.source === "throttled"
									? "Too many questions at once."
									: "Saved answer — the live assistant is unavailable."}
					</p>
				)}
			</div>
		</div>
	);
}

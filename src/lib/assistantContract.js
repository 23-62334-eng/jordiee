/**
 * The parts of the assistant's request contract that BOTH sides need.
 *
 * The server is the only enforcer — a client-side cap is a courtesy, never a
 * control, because anything in the browser can be edited. But when the two
 * disagree the visitor pays for it: a box that accepts 400 characters against a
 * server that rejects at 300 turns a typo into a round trip and an error
 * message, and a box that stops at 200 quietly removes capacity the server was
 * willing to give.
 *
 * So the numbers live here, imported by api/chat.js and by the chat UI, on the
 * same footing as src/lib/githubContributions.js — which api/contributions.js
 * already imports for exactly this reason. Nothing server-only belongs in this
 * file: it is reachable from the client bundle by construction.
 */

/** Longest question the endpoint will accept, in characters. */
export const MAX_INPUT_CHARS = 300;

/** Conversation turns kept per session. The server trims rather than rejects. */
export const MAX_TURNS = 8;

/**
 * Point at which the character counter becomes visible.
 *
 * A counter that is always on reads as a warning about a limit nobody was near.
 * At 80% it appears while there is still room to act on it.
 */
export const COUNTER_VISIBLE_AT = Math.floor(MAX_INPUT_CHARS * 0.8);

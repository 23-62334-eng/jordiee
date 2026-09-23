# jordiee.me

Mark Jordan Javier's portfolio, plus a grounded assistant that answers visitors'
questions about him.

## The assistant

A visitor asks a question in the chat panel; a serverless function answers it
with a model, grounded in `src/data/profile.json`. There is no retrieval step
and no vector store — the whole profile is about 3,400 tokens, so it is cheaper
and far more reliable to put all of it in the system prompt than to retrieve
part of it and risk answering from a fragment that left out the relevant
section.

```
ChatLauncher.jsx  ──POST /api/chat──▶  api/chat.js
                                          │
                                          ├─ origin allowlist        reject anything not jordiee.dev/.me/localhost
                                          ├─ rate limit              api/_limits.js, per IP
                                          ├─ validate                300 chars, 8 turns
                                          ├─ daily budget            kill switch → static FAQ answers
                                          ├─ system prompt           src/prompts/assistant.md + profile.json
                                          └─ provider                Gemini, streamed back as SSE
```

| File | Role |
|---|---|
| `src/prompts/assistant.md` | The behavioural half of the prompt. Prose, so a tuning change is a readable diff. |
| `src/data/profile.json` | The factual half, and the single source of truth. The prompt is assembled from it. |
| `api/chat.js` | The endpoint: caps, provider adapter, deadline, SSE, fault path. |
| `api/_limits.js` | Rate limiter, daily budget, static answerer. `_` prefix = not a route. |
| `api/_assistant.js` | Non-streaming policy wrapper. Driven by tests; not served. |
| `src/lib/assistantContract.js` | Limits both the client and the server must agree on. |
| `evals/golden-set.json` | 45 scored cases and the thresholds they must meet. |

### Why answers never 500

Every upstream failure — timeout, rate limit, quota, malformed response, safety
block — collapses to a normal 200 with a readable sentence. A visitor should
never be told the portfolio is broken because a model provider is having a bad
minute.

The fallback is tiered. If the question is one `profile.json` already answers,
the owner's own FAQ text is served (`source: "static"`); otherwise a generic
sentence (`source: "fallback"`). Either way the response carries
`degraded: true` and the UI labels it, because presenting a canned answer as the
model's own would make the site quietly less truthful under load.

Provider faults are logged server-side with their real cause, redacted — see
`logFault` in `api/chat.js`. A fault path silent on both sides is
indistinguishable from a working one.

### Running it locally

```bash
npm run dev          # http://localhost:5173 — serves api/ too
```

`vite dev` does not run serverless functions, so `vite.config.js` mounts every
non-`_` file in `api/` on the path it answers on when deployed, with the
`req.body` parsing and `res.status().json()` helpers the platform provides.
Without that the endpoints exist only in production, which is how this project
once had a fully built chat backend that had never run.

Needs `.env.local`:

```
LLM_PROVIDER_KEY="..."     # Google AI Studio. Server-side only, never bundled.
EVAL_PROVIDER_KEY="..."    # Groq. Only for `--provider groq` evals.
EVAL_GEMINI_KEY="..."      # Optional second AI Studio key, for evals. See below.
```

Smoke test the endpoint directly:

```bash
curl -N -X POST localhost:5173/api/chat \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  -d '{"question":"What is his capstone project?"}'
```

The `origin` header is required — the allowlist rejects requests without one, so
the endpoint cannot be used as a free relay.

### Evals

```bash
npm run eval                        # production model (gemini), the gate
npm run eval -- --provider groq     # cheap loop, separate free tier
npm run eval -- --only adv-03       # one case or one tag
```

The runner scores the **exact** system prompt `api/chat.js` serves, imported
rather than copied, and defaults to the model production actually uses. It
previously scored a different model on a different vendor, which made every
threshold a statement about a model no visitor ever reaches.

Prefer `EVAL_GEMINI_KEY` — a second free AI Studio key — so an eval run cannot
exhaust the quota the live site depends on. Without it the run still works
against `LLM_PROVIDER_KEY` and warns every time.

Four thresholds, all of which must pass: `assertionPass`, `refusalRate`,
`injectionResistance`, `driftRate`.

> **Grader bugs read as prompt regressions.** `refusalRate` once sat at 30.8%
> and `injectionResistance` at 50%, and the prompt was edited three times to
> chase them. The cause was `norm()`: NFKC does not fold `’` (U+2019) to `'`,
> while every contraction in `meta.refusalIntent.classes.NEG` is written with the
> ASCII apostrophe — so `I don’t have that information` matched no refusal
> signal at all. Recall was zero. Before editing the prompt because a number
> moved, check the grader agrees with you about what the answer said.

When a refusal is missed, add the missing **relation between word classes** in
`meta.refusalIntent`, never another phrasing. The phrase set is closed; the
answer set is not. That mistake has been made twice.

### Deploying

The site and its functions deploy together to Vercel, so `/api/*` is same-origin
and there is no CORS surface. `vercel.json` sets `maxDuration`; it must stay
above `UPSTREAM_TIMEOUT_MS` in `api/chat.js`, or the platform kills the function
before the handler can degrade. `verify-proxy-contract.js` asserts that
relationship, because the two numbers live in different files and are only
correct relative to each other.

`LLM_PROVIDER_KEY` must be set in the Vercel project environment. Model pins are
in source, not env: a model change should be a reviewable diff.

> **Model pins get retired.** `gemini-2.0-flash-001` was pinned, then withdrawn
> upstream. A valid key returned 400 for it and every answer degraded to the
> fallback sentence, so the assistant looked broken rather than misconfigured.
> When answers start degrading, check the pin still resolves:
> `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`

### Verification

```bash
npm run verify        # lint, profile schema, sources, build, secret scan, tests, proxy contract
npm test              # retrieval + resilience
npm run test:proxy    # 16 contract checks against the real module
npm run scan:secrets  # no key may appear in dist/
```

## GitHub contribution activity

The About Me calendar loads `Jordieeeee`'s public GitHub graph at runtime through
[GitHub Contributions API](https://github.com/grubersjoe/github-contributions-api).
It refreshes the selected range once per minute while the tab is visible and
checks again when the tab regains focus or the connection returns, subject to the
same one-minute limit. Each request is bounded by a 15-second timeout and is
cancelled when the range changes or the component unmounts.

Fresh requests explicitly send `Cache-Control: no-cache`, because the provider's
default server cache lasts one hour; browser cache settings alone do not bypass
it. Only the selected year (or GitHub's exact rolling `last` range) is requested,
and revisiting a year within the refresh interval reuses its in-memory result.
Counts and intensity levels come from GitHub's public graph. Private contribution
counts match only when they are visible on that public profile; no GitHub token is
sent to the browser. GitHub's own processing delay still applies.

If a refresh fails, the calendar retains its last successful data and shows a
saved-data notice. On an initial failure, `public/contributions.json` is an offline
fallback, labelled with its snapshot date. The daily contributions workflow keeps
that fallback up to date; normal live updates require neither a build nor a
deployment. A total outage shows a link to the GitHub profile and retries
automatically.

Contribution data regression tests: `node --test tests/github-contributions.test.js`.
Browser regression checks: start Vite on port 5176, then run
`node scripts/verify-contributions.js` (uses Playwright and an installed Chrome).

## Vite

React + Vite with the Tailwind v4 plugin. `@vitejs/plugin-react` (Babel) for Fast
Refresh. The React Compiler is not enabled.

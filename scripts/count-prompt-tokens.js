#!/usr/bin/env node
/**
 * Report the token count of the assembled system prompt.
 *
 * With LLM_PROVIDER_KEY set this asks Gemini's countTokens endpoint for the
 * real number. Without it, it prints a character count and a clearly-labelled
 * estimate — an estimate is useful, an estimate presented as a measurement is
 * not, so the two are never conflated in the output.
 */
import process from "node:process";
import { SYSTEM_PROMPT, MODEL } from "../api/chat.js";

const chars = SYSTEM_PROMPT.length;
const words = SYSTEM_PROMPT.trim().split(/\s+/).length;
const lines = SYSTEM_PROMPT.split("\n").length;

console.log(`\nassembled system prompt (${MODEL})`);
console.log(`  characters : ${chars.toLocaleString()}`);
console.log(`  words      : ${words.toLocaleString()}`);
console.log(`  lines      : ${lines.toLocaleString()}`);

const key = process.env.LLM_PROVIDER_KEY;
if (!key) {
  // ~4 chars/token is the usual English rule of thumb; this prompt is
  // structured text with many proper nouns, which tokenizes slightly worse.
  const low = Math.round(chars / 4.2);
  const high = Math.round(chars / 3.4);
  console.log(`  tokens     : ESTIMATED ${low.toLocaleString()}–${high.toLocaleString()}`);
  console.log(`               (chars/4.2 .. chars/3.4 — NOT a measurement)`);
  console.log(`\n  Set LLM_PROVIDER_KEY to measure exactly via countTokens.\n`);
  process.exit(0);
}

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:countTokens?key=${encodeURIComponent(key)}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }] }),
  },
);
if (!res.ok) {
  console.error(`  tokens     : countTokens failed (${res.status})\n`);
  process.exit(1);
}
const { totalTokens } = await res.json();
console.log(`  tokens     : ${totalTokens.toLocaleString()}  (measured via countTokens)\n`);

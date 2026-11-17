#!/usr/bin/env node
// Creates a collection token for config.js. No dependencies, just Node 18+.
//
//   MAVE_API_KEY=your-read-only-key node scripts/make-token.mjs <collection-id> [days-valid]
//
// The token is a JWT signed with your API key (HS256) with the collection ID as
// `sub`. It only lets someone list that collection, the same as the token for
// <mave-list>. Run this on your own machine or server: the API key itself must
// never end up in the browser or in git.

import { createHmac } from "node:crypto";

const [collectionId, days] = process.argv.slice(2);
const apiKey = process.env.MAVE_API_KEY;

if (!collectionId || !apiKey) {
  console.error("Usage: MAVE_API_KEY=... node scripts/make-token.mjs <collection-id> [days-valid]");
  process.exit(1);
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const claims = { sub: collectionId };
// Without an expiry the token works until you revoke the API key, which suits a
// public library that should simply stay online. Pass a number of days to have
// it expire, and renew it from a scheduled job.
if (days) claims.exp = Math.floor(Date.now() / 1000) + Number(days) * 24 * 60 * 60;

const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
const signature = createHmac("sha256", apiKey).update(unsigned).digest("base64url");

console.log(`${unsigned}.${signature}`);

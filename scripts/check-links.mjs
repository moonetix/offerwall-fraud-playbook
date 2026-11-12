#!/usr/bin/env node
// Checks every external link in README.md and chapters/*.md, one request per
// second. Node 22, no dependencies.
//
//   node scripts/check-links.mjs [--delay=1000] [--report=broken.md]
//
// ok    2xx, directly or after redirects
// warn  401, 403, 429, 999 or a timeout: the site turns away automated clients
// fail  404, 410, other 4xx, 5xx, DNS errors, refused connections, redirect loops
//
// Exits with 1 when a link fails. --report writes the body of the "Broken
// links" issue, or deletes the file when nothing failed.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeReport } from './link-report.mjs';
import { runUrl } from './github-issue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const delayArg = args.find((a) => a.startsWith('--delay='));
const delayMs = delayArg ? Number(delayArg.slice(8)) : 1000;
const reportArg = args.find((a) => a.startsWith('--report='));

const USER_AGENT = 'Mozilla/5.0 (compatible; offerwall-fraud-playbook-link-check; +https://github.com/moonetix/offerwall-fraud-playbook)';
const TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 8;
const WARN = new Set([401, 403, 429, 999]);
// The CI badge points back at this repository's own workflow runs.
const SELF = 'https://github.com/moonetix/offerwall-fraud-playbook/actions/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequest = 0;
async function get(url) {
  const wait = lastRequest + delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.8' },
  });
  // Only the status matters. Some targets are large data files, so skip the body.
  await res.body?.cancel().catch(() => {});
  return res;
}

async function check(url) {
  const chain = [];
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await get(current);
      chain.push(res.status);
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).href;
        continue;
      }
      const result = res.status < 300 ? 'ok' : WARN.has(res.status) ? 'warn' : 'fail';
      return { result, status: String(res.status), chain };
    }
    return { result: 'fail', status: 'too many redirects', chain };
  } catch (err) {
    if (err.name === 'TimeoutError') return { result: 'warn', status: 'timeout', chain };
    return { result: 'fail', status: err.cause?.code ?? err.message, chain };
  }
}

const files = ['README.md', ...(await readdir(join(ROOT, 'chapters'))).filter((f) => f.endsWith('.md')).sort().map((f) => `chapters/${f}`)];
const where = new Map();
for (const file of files) {
  const text = await readFile(join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g)) {
    const url = m[1] ?? m[2];
    if (url.startsWith(SELF)) continue;
    if (!where.has(url)) where.set(url, []);
    if (!where.get(url).includes(file)) where.get(url).push(file);
  }
}

const results = [];
for (const [url, found] of where) {
  let r = await check(url);
  if (r.result === 'fail') {
    await sleep(5000);
    r = await check(url);
  }
  results.push({ url, files: found, ...r });
  const via = r.chain.length > 1 ? ` (${r.chain.join(' > ')})` : '';
  console.log(`${r.result.padEnd(4)}  ${r.status}  ${url}${via}`);
}

const of = (kind) => results.filter((r) => r.result === kind);
console.log(`\n${results.length} links in ${files.length} files: ${of('ok').length} ok, ${of('warn').length} warn, ${of('fail').length} fail`);

if (reportArg) writeReport(reportArg.slice(9), results, { run: runUrl() });
process.exit(of('fail').length ? 1 : 0);

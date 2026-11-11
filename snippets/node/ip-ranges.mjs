// Match IPv4 and IPv6 addresses against CIDR lists: hosting ranges, Tor exit
// relays, iCloud Private Relay egress ranges, your own blocklist.
// Lookup cost depends on the number of distinct prefix lengths, not list size.

import { isIP } from 'node:net';

function toBigInt(ip) {
  const family = isIP(ip);
  if (family === 4) {
    return { family, bits: 32, value: ip.split('.').reduce((acc, part) => (acc << 8n) | BigInt(Number(part)), 0n) };
  }
  if (family === 6) {
    let text = ip.toLowerCase();
    const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
    if (v4) {
      const n = toBigInt(v4[1]).value;
      text = text.slice(0, -v4[1].length) + `${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
    }
    const [head, tail] = text.split('::');
    const left = head ? head.split(':') : [];
    const right = tail !== undefined && tail !== '' ? tail.split(':') : [];
    const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
    return { family, bits: 128, value: groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n) };
  }
  return null;
}

function mask(value, bits, prefix) {
  return prefix === 0 ? 0n : (value >> BigInt(bits - prefix)) << BigInt(bits - prefix);
}

export function createMatcher(entries) {
  const tables = { 4: new Map(), 6: new Map() };
  for (const entry of entries) {
    const [addr, len] = String(entry.cidr ?? entry).trim().split('/');
    const ip = toBigInt(addr);
    if (!ip) continue;
    const prefix = len === undefined ? ip.bits : Number(len);
    if (!(prefix >= 0 && prefix <= ip.bits)) continue;
    const byLen = tables[ip.family];
    if (!byLen.has(prefix)) byLen.set(prefix, new Map());
    byLen.get(prefix).set(mask(ip.value, ip.bits, prefix), entry.label ?? true);
  }
  for (const family of [4, 6]) {
    tables[family] = new Map([...tables[family]].sort((a, b) => b[0] - a[0]));
  }
  return function match(address) {
    const ip = toBigInt(String(address).trim());
    if (!ip) return null;
    for (const [prefix, nets] of tables[ip.family]) {
      const hit = nets.get(mask(ip.value, ip.bits, prefix));
      if (hit !== undefined) return hit;
    }
    return null;
  };
}

// https://check.torproject.org/torbulkexitlist: one address per line.
export function parseTorExitList(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && isIP(l))
    .map((cidr) => ({ cidr, label: 'tor_exit' }));
}

// https://mask-api.icloud.com/egress-ip-ranges.csv: prefix,country,region,city,
export function parsePrivateRelayCsv(text) {
  return text.split('\n').map((l) => l.split(',')[0].trim()).filter((c) => c.includes('/'))
    .map((cidr) => ({ cidr, label: 'icloud_private_relay' }));
}

// The /24 (IPv4) or /48 (IPv6) an address belongs to. Store it at sign-up so
// bursts from one network can be grouped without keeping every full address.
export function networkOf(address) {
  const ip = toBigInt(String(address).trim());
  if (!ip) return null;
  if (ip.family === 4) {
    const n = mask(ip.value, 32, 24);
    return `${[24n, 16n, 8n, 0n].map((s) => (n >> s) & 255n).join('.')}/24`;
  }
  const n = mask(ip.value, 128, 48) >> 80n;
  return `${[32n, 16n, 0n].map((s) => ((n >> s) & 0xffffn).toString(16)).join(':')}::/48`;
}

// Group accounts that share devices, payout destinations or sign-up networks.
// Shared values are weighted, and values shared by very many accounts (carrier
// NAT, a campus network, a popular phone model) are skipped as too weak.

export const DEFAULT_WEIGHTS = { payout: 3, device: 2, network: 1 };

export function linkAccounts(accounts, { weights = DEFAULT_WEIGHTS, linkAt = 3, maxShare = 20 } = {}) {
  const byValue = new Map();
  for (const acc of accounts) {
    for (const [kind, values] of Object.entries(acc.signals || {})) {
      if (!weights[kind]) continue;
      for (const v of new Set(values)) {
        const key = `${kind}\u0000${v}`;
        if (!byValue.has(key)) byValue.set(key, []);
        byValue.get(key).push(acc.id);
      }
    }
  }

  const pairs = new Map();
  for (const [key, ids] of byValue) {
    if (ids.length < 2 || ids.length > maxShare) continue;
    const kind = key.split('\u0000')[0];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pk = ids[i] < ids[j] ? `${ids[i]}\u0000${ids[j]}` : `${ids[j]}\u0000${ids[i]}`;
        const p = pairs.get(pk) || { score: 0, kinds: new Set() };
        p.score += weights[kind];
        p.kinds.add(kind);
        pairs.set(pk, p);
      }
    }
  }

  const parent = new Map(accounts.map((a) => [a.id, a.id]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const evidence = new Map();
  for (const [pk, p] of pairs) {
    if (p.score < linkAt) continue;
    const [a, b] = pk.split('\u0000');
    parent.set(find(a), find(b));
    evidence.set(pk, p);
  }

  const groups = new Map();
  for (const a of accounts) {
    const root = find(a.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(a.id);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((members) => {
    const kinds = new Set();
    for (const [pk, p] of evidence) {
      const [a] = pk.split('\u0000');
      if (members.includes(a)) p.kinds.forEach((k) => kinds.add(k));
    }
    return { members: members.sort(), sharedKinds: [...kinds].sort() };
  });
}

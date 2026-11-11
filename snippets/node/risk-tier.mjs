// Turn signals into one of four responses. The weights are an example to tune
// from your own review outcomes, not a benchmark. Only confirmed facts deny;
// soft signals can at most send an account to review.

export const EXAMPLE_WEIGHTS = {
  datacenterIp: 3,
  vpnOrProxy: 3,
  torExit: 3,
  countryMismatch: 1,
  noDeviceIntegrity: 2,
  sharedPayoutDestination: 4,
  sharedDevice: 2,
  velocity: 2,
  newAccount: 1,
  highReversalRate: 3,
};

const HARD = new Set(['confirmedFarm', 'tamperedApp', 'blockedDestination']);

export function riskTier(signals, { weights = EXAMPLE_WEIGHTS, limitAt = 2, reviewAt = 5 } = {}) {
  const active = Object.entries(signals).filter(([, on]) => on).map(([name]) => name);
  const hard = active.filter((s) => HARD.has(s));
  if (hard.length) return { tier: 'deny', score: null, reasons: hard };
  const score = active.reduce((sum, s) => sum + (weights[s] || 0), 0);
  const reasons = active.filter((s) => weights[s]);
  if (score >= reviewAt) return { tier: 'review', score, reasons };
  if (score >= limitAt) return { tier: 'limit', score, reasons };
  return { tier: 'allow', score, reasons };
}

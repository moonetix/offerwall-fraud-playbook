# 3. VPN, proxy, datacenter and residential proxy traffic

Offers are bought per country. A user in one country who appears to be in another reaches offers that the advertiser will not pay for, and the result is reversed later. Hosted servers and proxies are also how scripted traffic reaches your sign-up form and earn page.

## Kinds of traffic

| Kind | What the address belongs to | What it looks like to you |
| --- | --- | --- |
| Datacenter | A hosting or cloud provider | Address registered to a hosting network; often many accounts per range |
| Commercial VPN | A VPN provider's servers | Often a hosting range; country differs from the device's time zone and language |
| Tor | The Tor network | Address on the published exit list |
| Residential proxy | Someone else's home connection | Looks like an ordinary home address; behavior and device do not fit the location |
| Mobile proxy | A mobile carrier address | Same as above, on a carrier network shared by many honest users |
| Privacy relay | For example iCloud Private Relay | A known relay range that keeps the user's real region |

## Signals

- The address is on a hosting, VPN, proxy or Tor list.
- IP country differs from the account country, the device language, the time zone, or the payout details.
- Many accounts or sign-ups per address range in a short time.
- An account's country changes often, or jumps between distant countries faster than travel allows.
- High reversal rate on traffic from one network or one sub ID.

## Detection logic

**Check at the points where it matters:** sign-up, opening the offerwall, and every cash-out. A user who signs up at home and cashes out through a proxy is the case you care about.

**Use published lists where they exist.** [ip-ranges.mjs](../snippets/node/ip-ranges.mjs) matches IPv4 and IPv6 addresses against any CIDR list in constant time per prefix length, with loaders for two public sources:

- The Tor Project publishes a bulk list of exit relay addresses at [check.torproject.org/torbulkexitlist](https://check.torproject.org/torbulkexitlist), and notes that exit policies and the relay list change, so refresh it ([Tor support](https://support.torproject.org/abuse/ban-tor/), checked November 2026).
- Apple publishes iCloud Private Relay egress ranges at [mask-api.icloud.com/egress-ip-ranges.csv](https://mask-api.icloud.com/egress-ip-ranges.csv). Apple says the relay address keeps the user's region, and advises treating these addresses like carrier-grade NAT, since many users can share one relay address ([Prepare your network for iCloud Private Relay](https://developer.apple.com/support/prepare-your-network-for-icloud-private-relay/), checked November 2026).

```js
import { createMatcher, parseTorExitList, parsePrivateRelayCsv } from './snippets/node/ip-ranges.mjs';

const match = createMatcher([
  ...parseTorExitList(torText),
  ...parsePrivateRelayCsv(relayCsv),
  ...hostingRanges.map((cidr) => ({ cidr, label: 'hosting' })),
]);
match('171.25.193.25'); // 'tor_exit'
```

Hosting, VPN and residential proxy classification needs an IP intelligence source. Whichever you use, keep its verdict as one input, store what it said and when, and re-check at cash-out rather than trusting a verdict from sign-up.

**Treat relays differently from proxies.** Private Relay hides the address but keeps the region, so it does not enable country spoofing. Blocking it blocks paying iPhone users for no gain. Count it as shared address space, not as a proxy.

**Store the network, not only the address.** Saving the /24 or /48 at sign-up (`networkOf` in `ip-ranges.mjs`) lets you group bursts without keeping every full address forever.

## Responding

- **Block earning while the connection is flagged**, and tell the user what to change: turn off the VPN, use mobile data. Check whether your offerwall already refuses them; Moonetix documents that its wall blocks VPN, proxy, Tor and data center connections ([docs.moonetix.com/testing](https://docs.moonetix.com/testing#vpn)).
- **Keep earned rewards** that were credited before a flag, unless other evidence says they were not earned honestly.
- **Escalate repeats.** A user flagged once is probably testing a VPN. A user flagged at every cash-out goes to review.

## False positives

- Office, school and hotel networks route through shared gateways and sometimes hosting ranges.
- Some mobile carriers route traffic through central gateways, so the IP country can lag the user's real location near borders.
- Travelers legitimately change country.
- Privacy tools are common and legal. Explain the rule, do not accuse.
- IP intelligence is probabilistic, especially for residential and mobile ranges. Never close an account on one IP verdict.

## Further reading

- [VPN or proxy detected on the offerwall](https://moonetix.com/academy/traffic-quality/vpn-proxy-detected-offerwall)
- [What is a residential proxy?](https://moonetix.com/academy/glossary/what-is-a-residential-proxy)
- [What is IP reputation?](https://moonetix.com/academy/glossary/what-is-ip-reputation)
- [Geo-targeting](https://moonetix.com/academy/glossary/what-is-geo-targeting)

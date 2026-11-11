# 4. Emulators and device farms

Three setups get grouped as device fraud. They need different checks.

| Setup | What it is | First signal |
| --- | --- | --- |
| Emulator | Android running as software, often many copies on one machine | Platform attestation fails |
| Modified device or app | A rooted phone or a repackaged copy of your app | Attestation reports an unrecognized app or a compromised device |
| Phone farm | Racks of real, unmodified phones run by one operator | Attestation passes; only server-side patterns show it |

The third row is the important one. Attestation proves the device and app are genuine. It does not prove each device belongs to a different person.

## Platform attestation on Android

The Play Integrity API returns a verdict your server decrypts and reads. The facts below are from Google's verdict reference ([developer.android.com/google/play/integrity/verdicts](https://developer.android.com/google/play/integrity/verdicts), checked November 2026):

- Check `requestDetails` first: the package name, the request hash (standard requests) or nonce (classic requests), and the timestamp must match the request you made. This stops a token minted for one request being reused for another.
- `appRecognitionVerdict`: `PLAY_RECOGNIZED` means the app and certificate match what Google Play distributes; `UNRECOGNIZED_VERSION` means the certificate or package name does not match Play records.
- `deviceRecognitionVerdict`: `MEETS_DEVICE_INTEGRITY` means a genuine, certified Android device. An empty value means signs of attack or system compromise, or not a physical device, such as an emulator that does not pass Google Play integrity checks. `MEETS_BASIC_INTEGRITY` and `MEETS_STRONG_INTEGRITY` are opt-in labels.
- `appLicensingVerdict`: `LICENSED` means the user installed or updated the app from Google Play.
- Optional `recentDeviceActivity` reports how many integrity tokens your app requested on that device in the last hour, in levels `LEVEL_1` to `LEVEL_4`, to help spot hyperactive devices.
- Optional device recall stores three bits per device that you can read back when the app is installed again on that device.

## Platform attestation on iOS

App Attest, part of Apple's DeviceCheck framework, according to Apple's documentation (checked November 2026):

- A compromised app can falsify its own checks, so the attestation result goes to your server for verification ([Establishing your app's integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)).
- Not every device supports the service. The app checks `isSupported`, and your server must handle devices that cannot attest.
- Keys survive app updates but not reinstallation, device migration, or restore from backup.
- The fraud-risk receipt reports the number of attested keys associated with a device over the past 30 days, and Apple says to look for this value to be low ([Assessing fraud risk](https://developer.apple.com/documentation/devicecheck/assessing-fraud-risk)). A device that keeps minting keys may be serving many app instances.

## Server-side signals that catch farms

Real phones pass attestation, so the evidence of a farm is in your own data:

| Signal | Query or code |
| --- | --- |
| Accounts per device ID | `accounts_per_device.sql` |
| Accounts sharing a payout destination | `shared_payout_destinations.sql` |
| Same offers in the same order | `identical_offer_sequences.sql` |
| Sign-up bursts per network | `signup_bursts.sql` |
| Hyperactive devices | Play Integrity `recentDeviceActivity`; App Attest key count |
| Earn to the minimum, cash out, go quiet | `earn_and_exit.sql` |

## Detection logic

**Verify on the server, at the moments money moves:** sign-up bonus, opening the earn screen, and cash-out. Do not cache a verdict for days; request a fresh one for each sensitive action.

**Respond in tiers.** [risk-tier.mjs](../snippets/node/risk-tier.mjs) maps signals to allow, limit, review or deny. Only confirmed facts, such as an unrecognized app version, deny. Soft signals, however many, stop at review.

```js
import { riskTier } from './snippets/node/risk-tier.mjs';

riskTier({ noDeviceIntegrity: true });                          // { tier: 'limit', ... }
riskTier({ sharedPayoutDestination: true, velocity: true });    // { tier: 'review', ... }
riskTier({ tamperedApp: true });                                // { tier: 'deny', ... }
```

A useful mapping:

- **Allow:** device integrity, licensed app, no linked accounts. Normal hold.
- **Limit:** basic integrity only, or a device that cannot attest. No welcome bonus, longer hold.
- **Review:** several independent signals. Pause cash-out until a person looks.
- **Deny:** an unrecognized app, or a device you already confirmed as part of a farm. Record it with device recall so it survives a reinstall.

**Websites have weaker device evidence.** A page cannot call Play Integrity or App Attest. Browser signals can show a desktop pretending to be a phone, or many accounts with one setup, but they are probabilities. If you run both an app and a site, consider routing cash-outs through the app.

## False positives

- Older phones, custom ROMs and devices without Google Play services return weaker verdicts without any fraud.
- A failed check is often "could not check", not "fraud". Technical failures happen.
- Families share devices; people reinstall apps.
- Never tell a flagged user exactly which check fired. Tell them what to do next.

## Further reading

- [Emulator and device farm detection for rewards apps](https://moonetix.com/academy/traffic-quality/emulator-device-farm-detection)
- [Click injection and SDK spoofing](https://moonetix.com/academy/glossary/click-injection-sdk-spoofing)
- [Play Integrity API overview](https://developer.android.com/google/play/integrity/overview)

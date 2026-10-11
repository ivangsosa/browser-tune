# browser-tune

Open-source Chrome + Firefox extension (Manifest V3): performance/memory profiles, declarative domain blocking and safe tab discarding. Local-first, zero telemetry.

## Features

- **Optimization profiles**: Balanced, Low Resource, Privacy and Custom.
- **Declarative domain blocking** via `declarativeNetRequest` — no host permissions, two small hand-curated bundled lists (conservative + extended trackers/ads, opt-in), up to 5,000 user domains, optional per-resource-type blocking.
- **Per-site controls** from the popup: don't block this site, never discard this site, or pause blocking on it for 15 min / 1 h / 4 h.
- **Safe tab discarding** of inactive tabs with protections (pinned, active, audible, internal pages and user-excluded domains are never discarded), plus a "Discard inactive tabs now" button and a discarded-tabs counter.
- **Local settings** with versioning, migrations and JSON import/export (clipboard or file).
- **Interface in English, Spanish, Portuguese, French and German** — follows the browser language by default, or pick one manually. Light and dark theme.
- **Browser settings tips** with links (Memory Saver, tracking protection…). Extensions can't change those settings; they are suggestions only.
- **Honest by design**: no telemetry, no account, no remote code, no performance claims without reproducible benchmarks.

## Requirements

- Chrome ≥121 or Firefox ≥140 (desktop) / ≥142 (Android).

## Install

Download the latest package from [Releases](../../releases), or build from source:

```bash
npm install
npm run build        # produces dist/chrome and dist/firefox
```

Then load the unpacked directory per [docs/development.md](docs/development.md).

## Overlap with built-in protections

Brave Shields and Firefox Enhanced Tracking Protection already block most ads and trackers. browser-tune's blocking is a small, transparent complement (and a way to add your own domains and exceptions), not a replacement — in those browsers the benefit of its bundled lists is expected to be small. Its distinctive parts are the profiles, per-site controls and configurable tab discarding.

## Limitations

See [docs/limitations.md](docs/limitations.md) — e.g. extensions cannot measure per-tab RAM, and a discarded tab reloads when selected.

## Development & contributing

- [docs/development.md](docs/development.md) — commands and dev loading
- Tests: `npm test` (unit + package checks), `npm run test:e2e` (real Chromium with the extension loaded) and `npm run test:e2e:firefox` (real Firefox through geckodriver)
- [docs/benchmarks.md](docs/benchmarks.md) — reproducible benchmark methodology
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [PRIVACY.md](PRIVACY.md)

## License

[MPL-2.0](LICENSE)

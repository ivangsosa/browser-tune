# browser-tune

Open-source Chrome + Firefox extension (Manifest V3): performance/memory profiles, declarative domain blocking and safe tab discarding. Local-first, zero telemetry.

## Features

- **Optimization profiles**: Balanced, Low Resource, Privacy and Custom.
- **Declarative domain blocking** via `declarativeNetRequest` — no host permissions, conservative bundled ruleset, up to 5,000 user domains.
- **Safe tab discarding** of inactive tabs with protections (pinned, active, audible, internal pages and user-excluded domains are never discarded).
- **Local settings** with versioning, migrations and JSON import/export.
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

## Limitations

See [docs/limitations.md](docs/limitations.md) — e.g. extensions cannot measure per-tab RAM, and a discarded tab reloads when selected.

## Development & contributing

- [docs/development.md](docs/development.md) — commands and dev loading
- [docs/benchmarks.md](docs/benchmarks.md) — reproducible benchmark methodology
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [PRIVACY.md](PRIVACY.md)

## License

[MPL-2.0](LICENSE)

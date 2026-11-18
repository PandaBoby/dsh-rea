# dsh-rea

[中文](./README.zh.md) · English

![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![node](https://img.shields.io/badge/node-%5E22.23.4%20%7C%7C%20%5E24.22.1%20%7C%7C%20%3E%3D26.12.1-informational)
![validate](https://github.com/PandaBoby/dsh-rea/actions/workflows/validate.yml/badge.svg)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin bundle
that mounts the **REA (Reverse Engineer Anything)** MCP server as the `rea` tool
namespace, behind one switch in the **Plugins** page.

- **What it is** — one MCP bridge row, packaged so the Plugins page can show it as a card.
- **What it is not** — no analysis engine, no tool implementation, no model code. Every
  REA tool comes from the `rea-agents` npm package at run time.

## Why a bundle instead of a YAML snippet

Dropping the same six lines into `~/.dsh/cordis.patch.yml` works, but that row is
invisible to the Plugins page — the page lists **bundles** (packages that carry a
`dsh.bundle.patch`), not free-standing rows. Wrapping the row in a bundle is what
turns it into a switch you can click, and click back off after the investigation.

The switch matters because the `rea` namespace is expensive while it is on: 255
tool schemas travel in **every** request (`rea-agents@6.9.0`).

| State | Tools sent | Tool-definition context |
| --- | --- | --- |
| dsh-rea off | built-in tools only | ~2K–8K tokens |
| dsh-rea on | built-in + 255 | **~200K+ tokens** |

Measured against `rea-agents@6.5.0` on a 1M-token window: the schemas serialize to
~790 KB, which the harness prices at ~207K tokens, roughly 20% of the window. The
figure moves with the REA release: at 6.9.0 the same list holds 255 tools and its
raw `tools/list` JSON weighs 4.44 MB, against 207 tools and 2.94 MB at 6.5.0.
Re-measure after an upgrade; it is never zero while the bundle is on.

## Requirements

- DeepSeek Harness with a Plugins page (Desktop and Web profiles both have one).
- **Node `^22.23.4 || ^24.22.1 || >=26.12.1`.** `rea-agents` 6.8.0 and later refuse
  to start on anything older: the server prints the requirement and exits, so the
  bridge ends up with zero tools instead of an error.
- Network access the first time the switch is turned on, so `npx` can fetch the
  newest `rea-agents` release. Later starts reuse the npm cache.

Check the runtime before you rely on it:

```sh
npx -y rea-agents@latest --version   # prints 6.9.0 or newer on a supported runtime
```

## Install

From GitHub:

```sh
dsh plugin add github:PandaBoby/dsh-rea
```

Or from a local checkout, which is the form to use while developing this package:

```sh
dsh plugin add /absolute/path/to/dsh-rea
```

`dsh plugin add` also selects the bundle, so `rea` tools appear right away. If you
instead add `dsh-rea` to a profile as a plain dependency, add it to that profile's
`dsh.profile.bundles` list as well — a bundle that is only a dependency is never
composed, and the `rea` namespace never appears.

Installation does not download the REA server. The bridge runs
`npx -y rea-agents@latest mcp`, so npm fetches the newest release on the first tool
sync after the switch is on, and reuses its cache afterwards.

Grab the matching skill from `rea-agents` (or from the
[REA repository](https://github.com/morluto/rea)) if you want the model to have REA's
own procedure guidance; this package deliberately does not duplicate it.

## Turn it off and on

**Plugins page → Installed plugins → dsh-rea** — flip the switch.

- **On** — the MCP bridge starts, lists REA's tools, and registers them under
  `mcp__rea__*`.
- **Off** — the row is withdrawn, the child process is disposed, and the tool
  schemas stop being sent. Later requests are ~200K tokens lighter (more at 6.9.0).

The switch is a profile-level setting: it applies to every session of the profile,
including sessions that are already open. Turning it off while a REA call is running
cancels that call.

No restart is needed when HMR is enabled (the default in Desktop and Web profiles).
Without HMR, the change applies on the next start.

## Configuration

Defaults live in [`cordis.patch.yml`](./cordis.patch.yml). Override the `rea-mcp`
row from your profile patch when you need to pin a REA version, raise the call
timeout for slow decompilation, or make startup failures loud:

```yaml
- id: rea-mcp
  config:
    serverName: rea
    transport: stdio
    command: npx
    args: ["-y", "rea-agents@6.9.0", "mcp"]
    toolCallTimeoutMs: 600000
    failOnStartupError: false
```

A patch **replaces** a row's whole `config` rather than merging into it, so restate
every key you want to keep.

| Key | Default | Meaning |
| --- | --- | --- |
| `serverName` | `rea` | Namespace of the tool names (`mcp__rea__<tool>`); max 32 chars |
| `command` / `args` | `npx` + `-y rea-agents@latest mcp` | The stdio server to launch |
| `toolCallTimeoutMs` | `60000` | Per-call budget; raise it for long analyses |
| `failOnStartupError` | `false` | When `true`, a failed start raises instead of silently yielding no tools |
| `reconnect` | built-in policy | Retry and backoff when the child process drops |

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| No `rea` namespace at all | Bundle not selected in the profile | Turn the switch on; if you added it as a dependency, add it to `dsh.profile.bundles` |
| Namespace exists, zero tools | The engine refused to start — usually an unsupported Node, or `npx` could not reach the registry on first sync | Run `npx -y rea-agents@latest --version` in the same environment; set `failOnStartupError: true` to surface the next failure |
| Tools appear, calls time out | Default 60 s per-call budget | Raise `toolCallTimeoutMs` |
| You need a fixed engine | `@latest` drifts with every release | Pin `rea-agents@x.y.z` in `args` |

## Measuring the cost

The context gauge above the composer splits usage into system prompt, tool
definitions and messages. Compare the tool-definition line with the switch on and
off; the difference is this bundle's footprint. Alternatively read the newest
`request/header` in `~/.dsh/sessions/` and count the `mcp__rea__*` entries.

## Development

```sh
npm ci
npm run validate
```

`npm run validate` checks everything that can rot without anyone noticing: required
manifest fields and the paths they point at; that `cordis.patch.yml` parses as one
`insert` of the `rea-mcp` row using an `npx … mcp` command; that the `en` and `zh`
locale cards expose the same keys; that the icon is a real SVG; and that the newest
`CHANGELOG.md` entry matches `package.json`. CI runs the same check on Node 22 and 24.

There is no source code to test here: the engine lives in `rea-agents`, and this
repository only declares how to reach it. Bug reports about analysis behaviour belong
to the [REA repository](https://github.com/morluto/rea).

## Uninstall

Plugins page → dsh-rea → **Remove**. Removal withdraws the row and allows deleting the
package. `npx` caches live outside the profile and stay until npm or `npx` cleans them
up.

## License

MIT — see [LICENSE](./LICENSE). REA itself is a separate project under its own license;
this package only declares how to connect to it.

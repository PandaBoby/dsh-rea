# dsh-rea

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin bundle
that mounts the **REA (Reverse Engineer Anything)** MCP server as the `rea` tool
namespace — and gives it an ordinary on/off switch in the **Plugins** page.

This package ships **no analysis engine, no tool implementation, and no model
code**. It is a declaration: one MCP bridge row, plus the display metadata that
makes it a card in the plugin list. Every actual REA tool is discovered from the
`rea-agents` package at run time.

## Why a bundle instead of a YAML snippet

Dropping the same six lines into `~/.dsh/cordis.patch.yml` works, but that row is
invisible to the Plugins page — the page lists **bundles** (packages that carry a
`dsh.bundle.patch`), not free-standing rows. Wrapping the row in a bundle is what
turns it into a switch you can click, or click back off after the investigation.

The switch matters because the `rea` namespace is expensive while it is on: about
200 tool schemas travel in **every** request.

| State | Tools sent | Tool-definition context |
| --- | --- | --- |
| dsh-rea off | ~40 built-in | ~2K–8K tokens |
| dsh-rea on | ~40 + ~207 | **~200K tokens** |

Measured against `rea-agents@6.5.0` on a 1M-token window: the schemas serialize to
~790 KB, which the harness prices at ~207K tokens, roughly 20% of the window. The
figure moves with the REA release; it is never zero while the bundle is on.

## Install

From GitHub:

```
dsh plugin add github:PandaBoby/dsh-rea
```

Or from a local checkout, which is the form to use while developing this package:

```
dsh plugin add /absolute/path/to/dsh-rea
```

Installation also **selects** the bundle, so `rea` tools appear right away; switch it
off in the Plugins page when you are done. Grab the
matching skill from `rea-agents` (or from the REA repository) if you want the
model to have REA's own procedure guidance; this package deliberately does not
duplicate it.

The REA server itself is not downloaded at install time. The bridge runs
`npx -y rea-agents@latest mcp`, so npm fetches the newest release on the first
tool sync after the switch is turned on (and reuses its cache afterwards).

## Turn it off and on

**Plugins page → Installed plugins → dsh-rea** — flip the switch.

- **On** — the MCP bridge starts, lists REA's tools, and registers them under
  `mcp__rea__*`.
- **Off** — the row is withdrawn, the child process is disposed, and the tool
  schemas stop being sent. Later requests are ~200K tokens lighter.

The switch is a profile-level setting: it applies to every session of the profile,
including sessions that are already open. Turning it off while a REA call is
running cancels that call.

No restart is needed when HMR is enabled (the default in Desktop and Web
profiles). Without HMR, the change applies on the next start.

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
    args: ["-y", "rea-agents@6.5.0", "mcp"]
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
| `failOnStartupError` | `false` | `true` fails the plugin instead of silently exposing no tools |
| `reconnect` | built-in policy | Retry/backoff when the child process drops |

## Verify what it costs

The context meter above the composer breaks usage into system prompt, tool
definitions, and messages. Toggle the bundle and compare the **tool definitions**
row — that delta is what this plugin costs. Alternatively, read the latest
`request/header` from a session log under `~/.dsh/sessions/` and count the
`mcp__rea__*` entries.

## Uninstall

Plugins page → dsh-rea → **Remove**. Removing the bundle unregisters the row and
lets you delete the package; the `npx` cache is outside the profile and stays
until npm or `npx` clears it.

## Layout

```
package.json        name, description, icon, dsh.bundle.patch
cordis.patch.yml    the one insert row: mcp-client connected to `rea mcp`
icon.svg            card artwork
locale/en.json      card title + description
locale/zh.json      same, Chinese
```

## Licence

MIT. REA itself is a separate project with its own licence; this package only
declares how to reach it.

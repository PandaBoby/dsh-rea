# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-19

### Added

- Published to npm as `@panda-boby/dsh-rea` with `publishConfig.access = public`; the package
  name moved from the unscoped `dsh-rea`, which belongs to an unrelated publisher
  (`dushudou/dsh-rea`), to the `@panda-boby` scope.
- A 1280×640 banner (`docs/assets/banner.png`, SVG source beside it) used as the README hero and
  as the repository social preview, plus `docs/assets/how-it-connects.png`, a figure showing how
  the Plugins-page switch reaches the `rea` namespace through the `rea-mcp` row.
- `npm run validate` now also resolves every `<img src>` in the READMEs, and the assets ship in
  the tarball via a `docs/assets/*` entry in `files`.
- `npm run validate` now resolves every in-page anchor against the heading slugs, so a
  table-of-contents link cannot rot unnoticed.

### Changed

- Both READMEs restructured after the upstream REA documentation design: a centered hero
  with badges, in-page navigation and the single install command; an `[!IMPORTANT]` cost
  warning above the fold; a quick start of three named steps; troubleshooting followed by
  a collapsible FAQ; and a fixed closing order (further reading → contributing → license).
- Install commands in both READMEs now carry the `--profile <name>` flag `dsh plugin` requires,
  and lead with the registry install; the GitHub and local-checkout forms stay documented.
- A `[!NOTE]` callout states that the unscoped `dsh-rea` on npm is not this repository.

## [0.1.1] - 2026-11-18

### Added

- `npm run validate` (`scripts/validate.mjs`): checks the required manifest fields
  and every path they point at, that `cordis.patch.yml` is one `insert` of the
  `rea-mcp` row using an `npx … mcp` command, that the `en` and `zh` locale cards
  expose the same keys, that the icon is an SVG, and that the newest changelog
  entry matches the manifest version.
- A GitHub Actions workflow running that check on Node 22 and 24.
- A `Requirements` and a `Troubleshooting` section, and a note on adding the bundle
  to `dsh.profile.bundles` when it was installed as a plain dependency.

### Changed

- `engines.node` is now `^22.23.4 || ^24.22.1 || >=26.12.1`, the range
  `rea-agents` 6.8.0 and later accept. Older runtimes make the engine exit without
  serving tools, so the old `>=20` advertised a runtime that could not work.
- Documentation and both locale cards measure `rea-agents@6.9.0`: 255 tools, 4.44 MB
  of raw `tools/list` JSON, up from 207 tools and 2.94 MB at 6.5.0.
- The pinned-version example in the `cordis.patch.yml` comment moved from 6.5.0
  to 6.9.0.

### Fixed

- The English and Chinese READMEs had drifted apart — different sections, different
  numbers — and now carry the same structure, measurements and troubleshooting table.

## [0.1.0] - 2026-10-19

### Added

- Initial bundle: one `@deepseek-ai/dsh-mcp-client` row connected to
  `npx -y rea-agents@latest mcp`, addressed as `rea-mcp` so the Plugins page can
  switch the whole `rea` tool namespace on and off.
- Locale cards for `en` and `zh`, and a custom icon.

[0.1.1]: https://github.com/PandaBoby/dsh-rea/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/PandaBoby/dsh-rea/releases/tag/v0.1.0

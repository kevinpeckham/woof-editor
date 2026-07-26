# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in `@kevinpeckham/woof-editor`, please
report it privately so it can be fixed before disclosure.

- **Email:** kevin@lightningjar.com
- **GitHub Security Advisory:** open a [private advisory](https://github.com/kevinpeckham/woof-editor/security/advisories/new) on this repo

Please include:

- A description of the issue and its impact
- Steps to reproduce or proof-of-concept code
- Whether you've disclosed it elsewhere

You'll get an acknowledgement within three business days. Critical
findings (XSS via editor output, sanitizer bypass, prototype pollution)
target a fix within seven days; lower-severity findings within thirty.

## Supported versions

Pre-1.0 package — only the latest published version on npm (`main`
branch) is supported. Forks are responsible for their own version
policy after diverging.

## Threat model

`woof-editor` is a contenteditable markdown WYSIWYG component. It
accepts pasted/typed HTML and markdown content and must not let that
content execute script or otherwise escape the editor surface:

- **Sanitization:** pasted HTML is run through `isomorphic-dompurify`
  before insertion into the DOM (see the `sanitize` prop for
  consumer-side overrides). A regression that imports plain
  `dompurify` (browser-only) instead of `isomorphic-dompurify` would
  be a security bug, not just a portability one.
- **Round-trip integrity:** the DOM ⇄ markdown serializer
  (`@kevinpeckham/barkdown`) is property-tested to invert `marked`'s
  parse, so consumers storing the serialized markdown aren't exposed
  to drift-induced injection between what was rendered and what gets
  saved.
- **Static analysis:** Biome runs in CI on every PR. Renovate keeps
  dependencies (including `isomorphic-dompurify` and `marked`) current
  against upstream CVE fixes.
- **Supply-chain:** this package is published to npm via GitHub
  Actions OIDC + provenance (no long-lived `NPM_TOKEN`), so a
  published tarball is cryptographically tied to the commit and
  workflow run that built it.

## Out of scope

- Issues in third-party dependencies — report upstream
- Issues in a consumer's own usage — e.g. widening the allowlist via the
  `sanitize` prop to admit dangerous markup, or re-rendering the editor's
  serialized markdown elsewhere without sanitizing at that boundary.
  (Sanitization inside the editor is always on; the `sanitize` prop only
  adjusts the allowlist and cannot turn it off.)
- Theoretical issues requiring an already-compromised build pipeline

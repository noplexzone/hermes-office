# Selectable World Themes Implementation Plan

> **For Hermes:** Use Claude Code for implementation, then independent review and Jarvis verification.

**Goal:** Make Hermes Office world identity selectable and extensible, preserving the current village as a complete theme and adding an original eldritch-archive theme named **The Infinite Index**.

**Architecture:** Add a dependency-free theme registry and runtime service that owns selection, persistence, CSS variables, world palette, semantic building presentation, atmosphere/scenery vocabulary, and optional sprite-manifest/profile-visual overrides. Apply the selected package before world and dynamically imported renderer construction. Theme changes persist and trigger a controlled page reload so module-level render constants, decoded assets, terrain caches, and GPU resources rebuild coherently.

**Tech Stack:** Vanilla ES modules, Canvas 2D/WebGL, CSS custom properties, localStorage, node:test, Playwright, Docker/GitHub Actions.

## Global Constraints

- Work only in `/mnt/user/appdata/dev/hermes-office` on `feat/selectable-world-themes`.
- Preserve Hermes/profile data as read-only; runtime remains zero-build and dependency-free.
- Desktop-only: viewports are at least 1280px; no mobile breakpoints.
- Preserve status colors and meanings across themes.
- Existing village remains visually and behaviorally unchanged as default theme `keep-at-night`.
- New IP-safe theme is **The Infinite Index**. Ship no third-party franchise terminology, symbols, designs, or copied asset references.
- A theme is a coherent package, not a CSS-only skin. The registry must allow future per-theme asset manifests and profile sprite/equipment overrides without core theme-name conditionals.
- Switching persists, survives reload, tolerates unavailable localStorage, rejects unknown IDs, and coherently rebuilds renderer/assets.
- No container restart or production deployment. Publish only `noplexzone/hermes-office:develop` and immutable `sha-<commit>` through CI after verification.
- Update `CHANGELOG.md` under `Unreleased`; preserve package/version surfaces.

---

### Task 1: Theme registry and persistence contract

Create `claudeville/src/config/worldThemes.js`, `claudeville/src/application/WorldThemeManager.js`, and `scripts/tests/world-theme-manager.test.mjs`.

Expose `DEFAULT_WORLD_THEME_ID`, `WORLD_THEMES`, `getWorldTheme(id)`, `listWorldThemes()`, `resolveStoredWorldTheme(storage)`, and `WorldThemeManager`. Package fields cover identity/copy, chrome CSS vars, world palette, building presentation, atmosphere vocabulary, asset manifest path, and optional profile overrides. TDD default selection, persistence, unknown-ID fallback, storage failure, DOM application, and reload-on-change.

### Task 2: Boot integration and accessible selector

Modify `claudeville/index.html`, `App.js`, `TopBar.js`, and narrow CSS. Apply the theme before World, AssetManager, and renderer creation. Add a compact keyboard-accessible selector to World controls. Reselecting the active theme is a no-op; changing persists and reloads once.

### Task 3: Theme-aware semantic world and render palette

Make actual building labels, short labels, terrain/water palette, and renderer presentation derive from the selected package while preserving geometry, routing, and status semantics.

Infinite Index terminology:

- command → `THE GREAT INDEX` / `INDEX`
- taskboard → `THE LIVING LEDGER` / `LEDGER`
- archive → `THE DEEP STACKS` / `STACKS`
- mine → `THE MEMORY WELL` / `WELL`
- forge → `THE SCRIPTORIUM` / `SCRIPTORIUM`
- harbor → `THE INKWELL DOCKS` / `INK DOCKS`
- watchtower → `THE VIGILANT LENS` / `LENS`
- observatory → `ORRERY OF PATHS` / `ORRERY`
- portal → `THE SEALED CODEX` / `CODEX`

Run world building/terrain validators and focused tests.

### Task 4: Infinite Index visual treatment and future asset seam

Deliver a visibly distinct black-green, parchment, olive, bone, and tarnished-brass World/chrome treatment. Preserve Jarvis/Sol, Light/Luna, and L/Terra recognition. Theme profile overrides must be generic package data, not theme-name branches. Add original procedural pixel motifs where useful. Keep an explicit optional asset-manifest seam; compatible village assets may be fallback during the first pass, documented honestly.

### Task 5: Documentation, review, verification, and publication

Create `docs/world-themes.md`; update `docs/README.md`, `CHANGELOG.md`, and only DESIGN claims made obsolete by multi-theme support. Document package fields, adding themes, fallback behavior, storage/reload policy, and IP-safe asset rules.

Gates:

1. Focused tests and `npm run validate:quick`.
2. `npm run world:validate-buildings` and `npm run world:validate-terrain`.
3. `npx --yes impeccable detect claudeville/src claudeville/css` with relevant findings resolved.
4. 1440×900 browser checks for both themes with `?sim=1`: World, Dashboard, selector keyboard flow, agent selection, persistence, console/network.
5. Independent specification and quality review; fix and re-review critical/important findings.
6. Conventional commits, clean tree, push/integrate to `develop` only after gates.
7. Verify CI-published `develop` and immutable SHA image digest; update `CONTAINERS.md`.

## Acceptance Criteria

- Existing users remain on the current village unless they choose another theme.
- World controls list `Keep at Night` and `The Infinite Index`.
- Selection persists and safely falls back when storage or stored data is invalid.
- Infinite Index changes chrome, world palette, and all nine landmark names; it is not merely a recolored dashboard.
- Future themes are added by registering a package rather than scattering conditional branches.
- No copied third-party franchise terminology or assets ship.
- Both themes pass automated and bounded visual verification.
- A verified `noplexzone/hermes-office:develop` image is published with an immutable SHA tag and digest.

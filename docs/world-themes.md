# World themes

Hermes Office packages World identity in `claudeville/src/config/worldThemes.js`. **Keep at Night** is the default and preserves the existing village. **The Infinite Index** is an original archive-world first pass with distinct black-green water, parchment, olive, bone, tarnished-brass chrome, and nine semantic landmark names.

## Package contract

Each immutable registry entry contains:

- `id`, `name`, and `description` for selection and accessible copy;
- `chrome`, a map of CSS custom properties applied at boot;
- `world`, renderer palette data such as region-specific water tokens and atmosphere colors;
- `buildings`, semantic `label` and `shortLabel` overrides keyed by stable building type;
- `atmosphere.place`, the accessible name used by the live World summary;
- `assets.manifestPath` plus `fallbackThemeId`, resolved as a cycle-safe fallback chain;
- `profileOverrides`, presentation-only sprite/equipment/palette overrides keyed by normalized Hermes profile. Identity labels and model semantics cannot be overridden.

Add a future theme by registering one complete package. Core code consumes package fields and must not branch on a theme name. Theme CSS is limited to custom properties and cannot overwrite the canonical `--cv-status-*` ramp.

## Selection and boot policy

The World controls popover contains a native keyboard-accessible selector. Selection is stored under `hermes-office.world-theme`, then the page reloads once. Boot resolves and applies the package before building creation, sprite manifest loading, and renderer construction. Missing storage, blocked storage, missing values, and unknown IDs safely resolve to Keep at Night. A failed write leaves the current theme active and does not reload.

## Assets and first-pass fallback

A package may point at another compatible sprite manifest. Manifest candidates follow `fallbackThemeId`; failed managers are disposed before the next candidate loads. The Infinite Index currently uses the established village sprites while palette, chrome, terminology, and profile trim establish the first-pass identity; it does not claim nine new building sprite sets. Jarvis/Sol, Light/Luna, and L/Terra retain their existing sheets, tools, silhouettes, model labels, and provider/status semantics.

Only original or properly licensed theme names, terminology, motifs, and assets may ship. Do not copy another game's names, symbols, characters, or art direction-specific assets.

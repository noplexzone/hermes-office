# World themes

Hermes Office packages World identity in `claudeville/src/config/worldThemes.js`. **Keep at Night** is the default and preserves the existing village. **The Infinite Index** is an original archive-world first pass with distinct black-green water, parchment, olive, bone, tarnished-brass chrome, and nine semantic landmark names.

## Package contract

Each immutable registry entry contains:

- `id`, `name`, and `description` for selection and accessible copy;
- `chrome`, a map of CSS custom properties applied at boot;
- `world`, generic renderer data: region-specific `waterTokens`, phase `multiplyGrade`, semantic `terrain` palettes, procedural `atmosphere.motifs`, and `landmarks` tint/frame/ornament treatments;
- `buildings`, semantic `label` and `shortLabel` overrides keyed by stable building type;
- `atmosphere.place`, the accessible name used by the live World summary;
- `assets.manifestPath` plus `fallbackThemeId`, resolved as a cycle-safe fallback chain;
- `profileOverrides`, presentation-only sprite/equipment/palette overrides keyed by normalized Hermes profile. Identity labels and model semantics cannot be overridden.

Add a future theme by registering one complete package. Core code consumes package fields and must not branch on a theme name. Theme CSS is limited to custom properties and cannot overwrite the canonical `--cv-status-*` ramp.

## Selection and boot policy

The World controls popover contains a native keyboard-accessible selector. Selection is stored under `hermes-office.world-theme`, then the page reloads once. Boot resolves and applies the package before building creation, sprite manifest loading, and renderer construction. Missing storage, blocked storage, missing values, and unknown IDs safely resolve to Keep at Night. A failed write leaves the current theme active and does not reload.

## Assets and procedural world treatment

A package may point at another compatible sprite manifest. Manifest candidates follow `fallbackThemeId`; failed managers are disposed before the next candidate loads. The Infinite Index deliberately reuses the established village sprite silhouettes, then applies generic package-driven procedural rendering rather than shipping duplicate binary art:

- strong black-green and olive ground masses, parchment paths, bone shores, near-black water depth, and tarnished-brass edge tones;
- phase-aware archive water and distance haze plus immense ledger rulings and scattered folio marks baked into the terrain cache;
- a same-size tinted landmark composite with tarnished-brass corner frames, bone sigils, and one package-specified ornament key for each of the nine stable building types.

The composites preserve every source dimension, anchor, split-occlusion horizon, hit mask, world position, and pathing footprint. Both Canvas and GPU scene builders consume the same decorated source. A package with null visual fields—including Keep at Night—takes the original renderer paths and values, so the default remains pixel-for-pixel unchanged. Jarvis/Sol, Light/Luna, and L/Terra retain their existing sheets, tools, silhouettes, model labels, and provider/status semantics. Theme visual colors never replace the canonical status ramp.

Only original or properly licensed theme names, terminology, motifs, and assets may ship. Do not copy another game's names, symbols, characters, or art direction-specific assets.

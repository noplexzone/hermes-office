# World themes

Hermes Office packages World identity in `claudeville/src/config/worldThemes.js`. **Keep at Night** is the default and preserves the existing village. **The Infinite Index** is an original archive-world first pass with distinct black-green water, parchment, olive, bone, tarnished-brass chrome, and nine semantic landmark names.

## Package contract

Each immutable registry entry contains:

- `id`, `name`, and `description` for selection and accessible copy;
- `chrome`, a map of CSS custom properties applied at boot;
- `world`, generic renderer data: region-specific `waterTokens`, phase `multiplyGrade`, optional `scenery` policy, semantic `terrain` palettes, procedural `atmosphere.motifs`, and `landmarks` tint/frame/ornament treatments;
- `buildings`, semantic `label` and `shortLabel` overrides keyed by stable building type;
- `atmosphere.place`, the accessible name used by the live World summary;
- `assets.manifestPath` plus `fallbackThemeId`, resolved as a cycle-safe fallback chain;
- `profileOverrides`, presentation-only sprite/equipment/palette overrides keyed by normalized Hermes profile. Identity labels and model semantics cannot be overridden.

Add a future theme by registering one complete package. Core code consumes package fields and must not branch on a theme name. Theme CSS is limited to custom properties and cannot overwrite the canonical `--cv-status-*` ramp.

## Selection and boot policy

The World controls popover contains a native keyboard-accessible selector. Selection is stored under `hermes-office.world-theme`, then the page reloads once. Boot resolves and applies the package before building creation, sprite manifest loading, and renderer construction. Missing storage, blocked storage, missing values, and unknown IDs safely resolve to Keep at Night. A failed write leaves the current theme active and does not reload.

## Assets and procedural world treatment

A package may point at another compatible sprite manifest. Manifest candidates follow `fallbackThemeId`; failed managers are disposed before the next candidate loads. The Infinite Index first tries `local-assets/infinite-index/manifest.yaml`, then falls back to the bundled sprite manifest when no private pack is mounted. Set `HERMES_OFFICE_LOCAL_ASSET_ROOT` to an existing absolute directory to expose that directory read-only at `/local-assets/`; the server validates the opened file against the configured real root before reading it.

Regardless of which compatible manifest loads, the package applies generic rendering treatments:

- strong black-green and olive ground masses, parchment paths, bone shores, near-black water depth, and tarnished-brass edge tones;
- phase-aware archive water and distance haze plus immense ledger rulings and scattered folio marks baked into the terrain cache;
- same-size landmark composites with tarnished-brass corner frames, bone sigils, and one package-specified ornament key for each stable building type.

The treatment preserves source dimensions, anchors, split-occlusion horizons, hit masks, world positions, and pathing footprints. Both Canvas and GPU scene builders consume the same themed sources. A package with null visual fields—including Keep at Night—takes the original renderer paths and values, so the default remains pixel-for-pixel unchanged. Jarvis retains his model label and provider/status semantics; the private manifest may replace presentation art only. Theme visual colors never replace the canonical status ramp.

Only original or properly licensed theme names, terminology, motifs, and assets may ship. Do not copy another game's names, symbols, characters, or art direction-specific assets.

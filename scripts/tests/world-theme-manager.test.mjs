import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILDING_DEFS } from '../../claudeville/src/config/buildings.js';
import { DEFAULT_WORLD_THEME_ID, WORLD_THEMES, applyWorldThemeProfileOverride, getThemedBuildingDefs, getWorldTheme, getWorldThemeAssetManifestPaths, isThemeCssVariableAllowed, isWorldThemeId, listWorldThemes, mergeWorldThemeTable, resolveStoredWorldTheme, setActiveWorldTheme } from '../../claudeville/src/config/worldThemes.js';
import { WORLD_THEME_STORAGE_KEY, WorldThemeManager } from '../../claudeville/src/application/WorldThemeManager.js';
import { loadWorldThemeAssets } from '../../claudeville/src/application/WorldThemeAssetLoader.js';
import { getModelVisualIdentity } from '../../claudeville/src/presentation/shared/ModelVisualIdentity.js';

test('world theme registry preserves Keep at Night as the immutable default', () => {
  assert.equal(DEFAULT_WORLD_THEME_ID, 'keep-at-night');
  assert.deepEqual(listWorldThemes().map(({ id, name }) => ({ id, name })), [{ id: 'keep-at-night', name: 'Keep at Night' }, { id: 'infinite-index', name: 'The Infinite Index' }]);
  assert.strictEqual(getWorldTheme('missing'), WORLD_THEMES[DEFAULT_WORLD_THEME_ID]);
  assert.ok(Object.isFrozen(WORLD_THEMES));
  assert.ok(Object.isFrozen(getWorldTheme('infinite-index').buildings));
});

test('Infinite Index applies all nine exact labels without mutating base definitions', () => {
  const before = structuredClone(BUILDING_DEFS);
  const themed = getThemedBuildingDefs(BUILDING_DEFS, getWorldTheme('infinite-index'));
  assert.deepEqual(Object.fromEntries(themed.map(({ type, label, shortLabel }) => [type, [label, shortLabel]])), {
    command: ['THE GREAT INDEX', 'INDEX'], taskboard: ['THE LIVING LEDGER', 'LEDGER'], forge: ['THE SCRIPTORIUM', 'SCRIPTORIUM'], mine: ['THE MEMORY WELL', 'WELL'], archive: ['THE DEEP STACKS', 'STACKS'], observatory: ['ORRERY OF PATHS', 'ORRERY'], portal: ['THE SEALED CODEX', 'CODEX'], watchtower: ['THE VIGILANT LENS', 'LENS'], harbor: ['THE INKWELL DOCKS', 'INK DOCKS'],
  });
  assert.deepEqual(BUILDING_DEFS, before);
  assert.notStrictEqual(themed[0], BUILDING_DEFS[0]);
});

test('stored theme resolution falls back for invalid or unavailable storage', () => {
  assert.equal(resolveStoredWorldTheme(null).id, DEFAULT_WORLD_THEME_ID);
  assert.equal(resolveStoredWorldTheme({ getItem: () => 'unknown' }).id, DEFAULT_WORLD_THEME_ID);
  for (const inheritedId of ['constructor', 'toString', '__proto__']) {
    assert.equal(isWorldThemeId(inheritedId), false);
    assert.equal(getWorldTheme(inheritedId).id, DEFAULT_WORLD_THEME_ID);
    assert.equal(resolveStoredWorldTheme({ getItem: () => inheritedId }).id, DEFAULT_WORLD_THEME_ID);
  }
  assert.equal(resolveStoredWorldTheme({ getItem: () => 'infinite-index' }).id, 'infinite-index');
  assert.equal(resolveStoredWorldTheme({ getItem: () => { throw new Error('blocked'); } }).id, DEFAULT_WORLD_THEME_ID);
});

test('WorldThemeManager applies DOM package and reloads once only after valid changes', () => {
  const properties = new Map(); const attributes = new Map(); let reloads = 0;
  const storage = { value: null, getItem(key) { assert.equal(key, WORLD_THEME_STORAGE_KEY); return this.value; }, setItem(key, value) { assert.equal(key, WORLD_THEME_STORAGE_KEY); this.value = value; } };
  const manager = new WorldThemeManager({ storage, document: { documentElement: { style: { setProperty: (key, value) => properties.set(key, value) } }, body: { setAttribute: (key, value) => attributes.set(key, value) } }, reload: () => { reloads++; } });
  assert.equal(manager.apply().id, DEFAULT_WORLD_THEME_ID);
  assert.equal(attributes.get('data-world-theme'), DEFAULT_WORLD_THEME_ID);
  assert.equal(properties.get('--world-chrome-bg'), getWorldTheme(DEFAULT_WORLD_THEME_ID).chrome['--world-chrome-bg']);
  assert.equal(manager.select(DEFAULT_WORLD_THEME_ID), false);
  assert.equal(manager.select('unknown'), false);
  assert.equal(manager.select('constructor'), false);
  assert.equal(manager.select('toString'), false);
  assert.equal(manager.select('__proto__'), false);
  assert.equal(manager.select('infinite-index'), true);
  assert.equal(storage.value, 'infinite-index'); assert.equal(reloads, 1);
});

test('WorldThemeManager tolerates failed persistence', () => {
  const manager = new WorldThemeManager({ storage: { getItem: () => 'infinite-index', setItem: () => { throw new Error('quota'); } }, document: null, reload: () => { throw new Error('must not reload'); } });
  assert.equal(manager.apply().id, 'infinite-index');
  assert.equal(manager.select('keep-at-night'), false);
  assert.equal(manager.current.id, 'infinite-index');
});


test('theme chrome cannot override canonical status variables', () => {
  assert.equal(isThemeCssVariableAllowed('--cv-status-working'), false);
  assert.equal(isThemeCssVariableAllowed('--cv-status-waiting-user'), false);
  assert.equal(isThemeCssVariableAllowed('--cv-panel'), true);
  assert.ok(listWorldThemes().every(theme => Object.keys(theme.chrome).every(isThemeCssVariableAllowed)));
});

test('partial renderer palettes merge against every canonical region and phase', () => {
  const base = { day: { base: 'day', edge: 'edge', edgeAlpha: 0.2 }, night: { base: 'night', edge: 'night-edge', edgeAlpha: 0.4 } };
  const merged = mergeWorldThemeTable(base, { day: { base: 'archive-day' } });
  assert.deepEqual(merged.day, { base: 'archive-day', edge: 'edge', edgeAlpha: 0.2 });
  assert.deepEqual(merged.night, base.night);
  assert.strictEqual(mergeWorldThemeTable(base, null), base);
});

test('manifest candidates are ordered, deduplicated, and fall back to the default package', () => {
  const custom = { id: 'custom', assets: { manifestPath: 'assets/custom.yaml', fallbackThemeId: DEFAULT_WORLD_THEME_ID } };
  assert.deepEqual(getWorldThemeAssetManifestPaths(custom), ['assets/custom.yaml', 'assets/sprites/manifest.yaml']);
  assert.deepEqual(getWorldThemeAssetManifestPaths(getWorldTheme('infinite-index')), ['assets/sprites/manifest.yaml']);
});

test('asset loading disposes a failed primary manager and returns the fallback manager', async () => {
  const attempts = []; const disposed = [];
  class FakeAssetManager {
    constructor({ manifestPath }) { this.manifestPath = manifestPath; attempts.push(manifestPath); }
    async load() { if (this.manifestPath === 'assets/custom.yaml') throw new Error('missing'); return true; }
    dispose() { disposed.push(this.manifestPath); }
  }
  const custom = { id: 'custom', assets: { manifestPath: 'assets/custom.yaml', fallbackThemeId: DEFAULT_WORLD_THEME_ID } };
  const notices = [];
  const assets = await loadWorldThemeAssets(custom, { AssetManagerClass: FakeAssetManager, onFallback: event => notices.push(event) });
  assert.equal(assets.manifestPath, 'assets/sprites/manifest.yaml');
  assert.deepEqual(attempts, ['assets/custom.yaml', 'assets/sprites/manifest.yaml']);
  assert.deepEqual(disposed, ['assets/custom.yaml']);
  assert.equal(notices.length, 1);
});

test('asset loading disposes a false-returning primary manager exactly once before fallback', async () => {
  const disposed = [];
  class FakeAssetManager {
    constructor({ manifestPath }) { this.manifestPath = manifestPath; }
    async load() { return this.manifestPath !== 'assets/custom.yaml'; }
    dispose() {
      if (disposed.includes(this.manifestPath)) throw new Error('double dispose');
      disposed.push(this.manifestPath);
    }
  }
  const custom = { id: 'custom', assets: { manifestPath: 'assets/custom.yaml', fallbackThemeId: DEFAULT_WORLD_THEME_ID } };
  const assets = await loadWorldThemeAssets(custom, { AssetManagerClass: FakeAssetManager });
  assert.equal(assets.manifestPath, 'assets/sprites/manifest.yaml');
  assert.deepEqual(disposed, ['assets/custom.yaml']);
});

test('profile overrides alter presentation only and are consumed by model identity', () => {
  const protectedIdentity = applyWorldThemeProfileOverride(
    { label: 'Truth', shortLabel: 'Truth', spriteId: 'old' },
    'Jarvis',
    { profileOverrides: { jarvis: { label: 'False', shortLabel: 'False', spriteId: 'new', trim: ['#fff'] } } },
  );
  assert.equal(protectedIdentity.label, 'Truth');
  assert.equal(protectedIdentity.shortLabel, 'Truth');
  assert.equal(protectedIdentity.spriteId, 'new');
  try {
    setActiveWorldTheme(getWorldTheme('infinite-index'));
    const identity = getModelVisualIdentity('gpt-5.6-sol', 'high', 'hermes', 'Jarvis');
    assert.equal(identity.spriteId, 'agent.codex.gpt56sol');
    assert.deepEqual(identity.trim, ['#d8c98f', '#f0dfaa', '#89a867']);
  } finally {
    setActiveWorldTheme(getWorldTheme(DEFAULT_WORLD_THEME_ID));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { BuildingSprite } from '../../claudeville/src/presentation/character-mode/BuildingSprite.js';
import { buildGpuWorldRecords } from '../../claudeville/src/presentation/character-mode/gpu/GpuSceneBuilder.js';
import { DEFAULT_WORLD_THEME_ID, getWorldTheme } from '../../claudeville/src/config/worldThemes.js';

function fakeCanvas() {
  const calls = [];
  const context = {
    calls,
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    stroke() { calls.push(['stroke']); },
  };
  return {
    width: 0,
    height: 0,
    context,
    getContext() { return context; },
  };
}

function fixture(theme) {
  const source = { id: 'base-command', width: 64, height: 80 };
  const spriteCalls = [];
  const assets = {
    assetVersion: 'fixture-v1',
    get: id => id === 'building.command' ? source : null,
    getDims: () => ({ w: 64, h: 80 }),
    getAnchor: () => [32, 72],
  };
  const sprites = {
    drawSprite(...args) { spriteCalls.push(args); },
    drawOutline() {},
  };
  const renderer = new BuildingSprite(assets, sprites, null, { theme });
  renderer._drawAnimatedOverlays = () => {};
  renderer._buildingOccupancyInfo = () => ({ state: 'idle' });
  const drawable = {
    kind: 'building',
    building: { type: 'command' },
    entry: { id: 'building.command' },
    wx: 100,
    wy: 90,
  };
  return { source, spriteCalls, assets, renderer, drawable };
}

test('Infinite Index uses the same themed source in Canvas and GPU without moving geometry', () => {
  const previousDocument = globalThis.document;
  const created = [];
  globalThis.document = { createElement: () => { const canvas = fakeCanvas(); created.push(canvas); return canvas; } };
  const { source, assets, renderer, drawable } = fixture(getWorldTheme('infinite-index'));
  try {
    const themed = renderer.getThemedBuildingSource(drawable);
    assert.notStrictEqual(themed, source);
    assert.equal(themed.width, 64);
    assert.equal(themed.height, 80);
    assert.strictEqual(renderer.getThemedBuildingSource(drawable), themed, 'treated source is cached');
    assert.deepEqual(created[0].context.calls[0], ['drawImage', source, 0, 0, 64, 80]);
    assert.ok(created[0].context.calls.some(([kind]) => kind === 'fillRect'));
    assert.ok(created[0].context.calls.some(([kind]) => kind === 'stroke'));

    const target = fakeCanvas().context;
    renderer.drawDrawable(target, drawable);
    assert.deepEqual(target.calls[0], ['drawImage', themed, 68, 18, 64, 80]);

    const records = buildGpuWorldRecords({
      assets,
      buildingRenderer: renderer,
      camera: { zoom: 1 },
      _getTerrainCache: () => null,
    }, { drawables: [{ kind: 'building', payload: drawable }] });
    assert.equal(records.length, 1);
    assert.strictEqual(records[0].source, themed);
    assert.equal(records[0].textureKey, 'building.command:archive-landmarks-v1');
    assert.deepEqual(
      { x: records[0].x, y: records[0].y, width: records[0].width, height: records[0].height },
      { x: 68, y: 18, width: 64, height: 80 },
    );
  } finally {
    renderer.dispose();
    globalThis.document = previousDocument;
  }
});

test('themed split occlusion keeps the original horizon and anchor in both GPU records', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => fakeCanvas() };
  const { assets, renderer, drawable } = fixture(getWorldTheme('infinite-index'));
  try {
    const back = { ...drawable, kind: 'building-back', horizonY: 31 };
    const front = { ...drawable, kind: 'building-front', horizonY: 31 };
    const themed = renderer.getThemedBuildingSource(back);
    const target = fakeCanvas().context;
    renderer.drawDrawable(target, back);
    renderer.drawDrawable(target, front);
    assert.deepEqual(target.calls.filter(([kind]) => kind === 'drawImage'), [
      ['drawImage', themed, 0, 0, 64, 31, 68, 18, 64, 31],
      ['drawImage', themed, 0, 31, 64, 49, 68, 49, 64, 49],
    ]);

    const records = buildGpuWorldRecords({
      assets,
      buildingRenderer: renderer,
      camera: { zoom: 1 },
      _getTerrainCache: () => null,
    }, { drawables: [{ kind: 'building-back', payload: back }, { kind: 'building-front', payload: front }] });
    assert.deepEqual(records.map(({ sy, sh, x, y }) => ({ sy, sh, x, y })), [
      { sy: 0, sh: 31, x: 68, y: 18 },
      { sy: 31, sh: 49, x: 68, y: 49 },
    ]);
    assert.strictEqual(records[0].source, records[1].source);
  } finally {
    renderer.dispose();
    globalThis.document = previousDocument;
  }
});

test('Keep at Night retains the untouched Canvas and GPU source paths', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => { throw new Error('default theme must not allocate treatment canvases'); } };
  const { source, spriteCalls, assets, renderer, drawable } = fixture(getWorldTheme(DEFAULT_WORLD_THEME_ID));
  try {
    assert.equal(renderer.getThemedBuildingSource(drawable), null);
    renderer.drawDrawable(fakeCanvas().context, drawable);
    assert.equal(spriteCalls.length, 1);
    assert.equal(spriteCalls[0][1], 'building.command');
    assert.equal(spriteCalls[0][2], 100);
    assert.equal(spriteCalls[0][3], 90);

    const records = buildGpuWorldRecords({
      assets,
      buildingRenderer: renderer,
      camera: { zoom: 1 },
      _getTerrainCache: () => null,
    }, { drawables: [{ kind: 'building', payload: drawable }] });
    assert.strictEqual(records[0].source, source);
    assert.equal(records[0].textureKey, 'building.command');
    assert.deepEqual(
      { x: records[0].x, y: records[0].y, width: records[0].width, height: records[0].height },
      { x: 68, y: 18, width: 64, height: 80 },
    );
  } finally {
    renderer.dispose();
    globalThis.document = previousDocument;
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { BuildingSprite } from '../../claudeville/src/presentation/character-mode/BuildingSprite.js';
import { IsometricRenderer } from '../../claudeville/src/presentation/character-mode/IsometricRenderer.js';
import { buildGpuWorldRecords } from '../../claudeville/src/presentation/character-mode/gpu/GpuSceneBuilder.js';
import { GpuWorldRenderer } from '../../claudeville/src/presentation/character-mode/gpu/GpuWorldRenderer.js';
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

function fakeWebGl() {
  const calls = [];
  let nextTexture = 0;
  const gl = {
    calls,
    ARRAY_BUFFER: 'ARRAY_BUFFER',
    BACK: 'BACK',
    BLEND: 'BLEND',
    CLAMP_TO_EDGE: 'CLAMP_TO_EDGE',
    COLOR_ATTACHMENT0: 'COLOR_ATTACHMENT0',
    COLOR_BUFFER_BIT: 'COLOR_BUFFER_BIT',
    CULL_FACE: 'CULL_FACE',
    DEPTH_TEST: 'DEPTH_TEST',
    DYNAMIC_DRAW: 'DYNAMIC_DRAW',
    FRAMEBUFFER: 'FRAMEBUFFER',
    NEAREST: 'NEAREST',
    ONE: 'ONE',
    ONE_MINUS_SRC_ALPHA: 'ONE_MINUS_SRC_ALPHA',
    RGBA: 'RGBA',
    TEXTURE0: 'TEXTURE0',
    TEXTURE1: 'TEXTURE1',
    TEXTURE2: 'TEXTURE2',
    TEXTURE_2D: 'TEXTURE_2D',
    TEXTURE_MAG_FILTER: 'TEXTURE_MAG_FILTER',
    TEXTURE_MIN_FILTER: 'TEXTURE_MIN_FILTER',
    TEXTURE_WRAP_S: 'TEXTURE_WRAP_S',
    TEXTURE_WRAP_T: 'TEXTURE_WRAP_T',
    TRIANGLES: 'TRIANGLES',
    UNPACK_FLIP_Y_WEBGL: 'UNPACK_FLIP_Y_WEBGL',
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    UNSIGNED_BYTE: 'UNSIGNED_BYTE',
  };
  for (const method of [
    'activeTexture', 'bindBuffer', 'bindFramebuffer', 'bindTexture', 'bindVertexArray',
    'blendFunc', 'bufferData', 'clear', 'clearColor', 'disable', 'drawArrays',
    'drawBuffers', 'enable', 'pixelStorei', 'texImage2D', 'texParameteri',
    'uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform3fv',
    'uniform4f', 'uniform4fv', 'useProgram', 'viewport',
  ]) {
    gl[method] = (...args) => calls.push([method, ...args]);
  }
  gl.createTexture = () => {
    const texture = { id: `texture-${++nextTexture}` };
    calls.push(['createTexture', texture]);
    return texture;
  };
  gl.deleteTexture = texture => calls.push(['deleteTexture', texture]);
  return gl;
}

function gpuRenderHarness(gl) {
  const renderer = Object.create(GpuWorldRenderer.prototype);
  Object.assign(renderer, {
    enabled: true,
    supported: true,
    contextHealthy: true,
    disposed: false,
    suspended: false,
    gl,
    width: 320,
    height: 180,
    vao: { id: 'vao' },
    vertexBuffer: { id: 'vertex-buffer' },
    sceneProgram: { id: 'scene-program' },
    compositeProgram: { id: 'composite-program' },
    sceneUniforms: {
      u_camera: 'u_camera',
      u_resolution: 'u_resolution',
      u_occlusionResolution: 'u_occlusionResolution',
      u_gradeBase: 'u_gradeBase',
      u_gradeEdge: 'u_gradeEdge',
      u_edgeAlpha: 'u_edgeAlpha',
      u_fogColor: 'u_fogColor',
      u_weather: 'u_weather',
      u_sun: 'u_sun',
      u_time: 'u_time',
      u_motionScale: 'u_motionScale',
      u_occlusion: 'u_occlusion',
      u_lightCount: 'u_lightCount',
      'u_lights[0]': 'u_lights[0]',
      'u_lightColors[0]': 'u_lightColors[0]',
      u_albedo: 'u_albedo',
      u_materialMap: 'u_materialMap',
      u_hasMaterialMap: 'u_hasMaterialMap',
    },
    compositeUniforms: {
      u_scene: 'u_scene',
      u_bloom: 'u_bloom',
      u_bloomStrength: 'u_bloomStrength',
    },
    sceneTarget: {
      framebuffer: { id: 'scene-framebuffer' },
      textures: [{ id: 'scene-color' }, { id: 'scene-emission' }],
      width: 320,
      height: 180,
    },
    occlusionTarget: {
      framebuffer: { id: 'occlusion-framebuffer' },
      textures: [{ id: 'occlusion-texture' }],
      width: 120,
      height: 68,
    },
    bloomB: {
      textures: [{ id: 'bloom-texture' }],
      width: 120,
      height: 68,
    },
    emptyMaterialTexture: { id: 'empty-material' },
    qualityLadder: {
      getLevel: () => 2,
      update: () => ({ effectiveLevel: 2 }),
    },
    _textureEntries: new Map(),
    _lastRenderAtMs: null,
    _frameUploadMs: 0,
    uploads: 0,
    uploadBytes: 0,
    uploadMs: 0,
    cpuMs: 0,
    shaderCpuMs: 0,
    frameGapMs: 0,
    textureBytes: 0,
    textureEvictions: 0,
    vertexBufferBytes: 0,
    records: 0,
    batches: 0,
    frames: 0,
    lightCount: 0,
    localLightPhase: 0,
    emissivePhase: 0,
    _renderErrorLogged: false,
  });
  renderer._ensureTargets = () => {};
  return renderer;
}

test('GpuWorldRenderer.render uploads and draws the Infinite Index themed split source', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => fakeCanvas() };
  const { assets, renderer: buildingRenderer, drawable } = fixture(getWorldTheme('infinite-index'));
  try {
    const front = { ...drawable, kind: 'building-front', horizonY: 31 };
    const themed = buildingRenderer.getThemedBuildingSource(front);
    const records = buildGpuWorldRecords({
      assets,
      buildingRenderer,
      camera: { zoom: 1 },
      _getTerrainCache: () => null,
    }, { drawables: [{ kind: 'building-front', payload: front }] });
    assert.equal(records.length, 1);
    assert.equal(records[0].textureKey, 'building.command:archive-landmarks-v1');
    assert.equal(records[0].textureRevision, 'archive-landmarks-v1');

    const gl = fakeWebGl();
    const gpuRenderer = gpuRenderHarness(gl);
    assert.equal(gpuRenderer.render({
      records,
      camera: { x: 0, y: 0, zoom: 1, _dpr: () => 1 },
      feed: { lighting: { ambientLight: 1 }, motionScale: 1, reducedMotion: false, timeMs: 1 },
    }), true);

    const upload = gl.calls.find(([method]) => method === 'texImage2D');
    assert.ok(upload, 'the public render path uploads a source texture');
    assert.strictEqual(upload.at(-1), themed, 'the uploaded source is the treated Infinite Index canvas');
    const cacheEntry = gpuRenderer._textureEntries.get(records[0].textureKey);
    assert.ok(cacheEntry);
    assert.strictEqual(cacheEntry.source, themed);
    assert.equal(cacheEntry.revision, records[0].textureRevision);

    const vertexUpload = gl.calls.find(([method]) => method === 'bufferData');
    assert.ok(vertexUpload?.[2] instanceof Float32Array);
    const vertices = vertexUpload[2];
    assert.deepEqual(Array.from(vertices.slice(0, 3)), [68, 49, 0]);
    assert.ok(Math.abs(vertices[3] - 31 / 80) < 1e-6);
    assert.deepEqual(Array.from(vertices.slice(4, 6)), [1, records[0].material]);
    assert.ok(Math.abs(vertices[6] - records[0].elevation) < 1e-6);
    assert.equal(vertices[7], 0);
    assert.deepEqual(Array.from(vertices.slice(8, 11)), [132, 49, 1]);
    assert.ok(Math.abs(vertices[11] - 31 / 80) < 1e-6);
    assert.ok(gl.calls.some(([method, mode, , count]) => method === 'drawArrays' && mode === gl.TRIANGLES && count === 6));
    assert.equal(gpuRenderer.uploads, 1);
    assert.equal(gpuRenderer.frames, 1);
  } finally {
    buildingRenderer.dispose();
    globalThis.document = previousDocument;
  }
});


test('theme scenery policy replaces authored fantasy trees and can omit the village enclosure', () => {
  const infinite = getWorldTheme('infinite-index');
  const renderer = Object.create(IsometricRenderer.prototype);
  renderer.theme = infinite;
  assert.equal(renderer._useFantasyTreeRenderer({ tropical: true }), false);
  assert.equal(renderer._useFantasyTreeRenderer({ canopy: true }), false);

  renderer.sprites = {};
  renderer._buildVillageWallSprites = () => { throw new Error('village wall must be omitted'); };
  renderer._buildVillageWallTerminalSprites = () => { throw new Error('wall terminals must be omitted'); };
  renderer._buildWatchtowerBeaconBuoySprites = () => [];
  renderer.scenery = { isBlockedForTallScenery: () => true };
  renderer.pathTiles = new Set();
  renderer.bridgeTiles = new Set();
  assert.deepEqual(renderer._buildDistrictPropSprites(), []);
  assert.deepEqual(renderer._villageGateLightSources(), []);

  renderer.theme = getWorldTheme(DEFAULT_WORLD_THEME_ID);
  renderer._buildVillageWallSprites = () => ['wall'];
  renderer._buildVillageWallTerminalSprites = () => ['terminal'];
  assert.equal(renderer._useFantasyTreeRenderer({ tropical: true }), true);
  assert.equal(renderer._buildDistrictPropSprites().length, 3);
});

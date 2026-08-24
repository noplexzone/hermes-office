import assert from 'node:assert/strict';
import test from 'node:test';

import { PROVIDER_HUES } from '../../claudeville/src/config/theme.js';
import { modelPresentation, providerPresentation } from '../../claudeville/src/presentation/shared/AgentPresentation.js';
import { getModelVisualIdentity } from '../../claudeville/src/presentation/shared/ModelVisualIdentity.js';

test('Hermes sessions render a Hermes provider identity instead of falling back to Claude', () => {
  const presentation = providerPresentation('hermes', { minimapColor: '#ffffff' });
  assert.equal(presentation.key, 'hermes');
  assert.equal(presentation.icon, 'H');
  assert.equal(presentation.badge.label, 'Hermes');
  assert.equal(presentation.badge.color, PROVIDER_HUES.hermes.badge);
  assert.equal(presentation.color, PROVIDER_HUES.hermes.badge);
});


test('Hermes profiles receive stable profile-specific character sprites', () => {
  assert.equal(getModelVisualIdentity('gpt-5.6-sol', null, 'hermes', 'jarvis').spriteId, 'agent.codex.gpt56sol');
  assert.equal(getModelVisualIdentity('gpt-5.6-sol', null, 'hermes', 'light').spriteId, 'agent.codex.gpt56luna');
  assert.equal(getModelVisualIdentity('gpt-5.6-sol', null, 'hermes', 'l').spriteId, 'agent.codex.gpt56terra');
});

test('profile overrides do not change real model labels or unrelated identities', () => {
  const light = getModelVisualIdentity('gpt-5.6-sol', null, 'hermes', 'light');
  assert.equal(light.shortLabel, '5.6 Sol');
  assert.equal(modelPresentation({ model: 'gpt-5.6-sol', provider: 'hermes', profile: 'light' }).identity.spriteId, 'agent.codex.gpt56luna');
  assert.equal(getModelVisualIdentity('gpt-5.6-sol', null, 'hermes', 'unknown').spriteId, 'agent.codex.gpt56sol');
  assert.equal(getModelVisualIdentity('gpt-5.6-sol', null, 'codex', 'light').spriteId, 'agent.codex.gpt56sol');
});

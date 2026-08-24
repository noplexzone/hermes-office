import assert from 'node:assert/strict';
import test from 'node:test';

import { PROVIDER_HUES } from '../../claudeville/src/config/theme.js';
import { providerPresentation } from '../../claudeville/src/presentation/shared/AgentPresentation.js';

test('Hermes sessions render a Hermes provider identity instead of falling back to Claude', () => {
  const presentation = providerPresentation('hermes', { minimapColor: '#ffffff' });
  assert.equal(presentation.key, 'hermes');
  assert.equal(presentation.icon, 'H');
  assert.equal(presentation.badge.label, 'Hermes');
  assert.equal(presentation.badge.color, PROVIDER_HUES.hermes.badge);
  assert.equal(presentation.color, PROVIDER_HUES.hermes.badge);
});

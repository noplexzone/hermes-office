import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const {
  HermesAdapter,
  attemptWriteForTest,
  normalizedSessionId,
} = require('../../claudeville/adapters/hermes.js');

function createStateDb(root, profile, rows = {}) {
  const dir = profile === 'default' ? root : path.join(root, 'profiles', profile);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'state.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, model TEXT, parent_session_id TEXT, started_at REAL,
      ended_at REAL, message_count INTEGER, tool_call_count INTEGER,
      input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER,
      cache_write_tokens INTEGER, reasoning_tokens INTEGER, api_call_count INTEGER,
      title TEXT, cwd TEXT, git_branch TEXT, git_repo_root TEXT, profile_name TEXT,
      origin_json TEXT, last_activity_at REAL, archived INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, content TEXT,
      tool_call_id TEXT, tool_calls TEXT, tool_name TEXT, timestamp REAL,
      finish_reason TEXT, reasoning TEXT
    );
    CREATE INDEX idx_messages_session_id ON messages(session_id);
    CREATE TABLE session_model_usage (
      session_id TEXT, model TEXT, api_call_count INTEGER,
      input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER,
      cache_write_tokens INTEGER, reasoning_tokens INTEGER,
      first_seen REAL, last_seen REAL
    );
    CREATE INDEX idx_session_model_usage_session ON session_model_usage(session_id);
  `);
  const insertSession = db.prepare(`INSERT INTO sessions
    (id, model, parent_session_id, started_at, ended_at, message_count, tool_call_count,
     input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
     api_call_count, title, cwd, git_branch, git_repo_root, profile_name, last_activity_at,
     archived, hidden)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const row of rows.sessions || []) insertSession.run(...row);
  const updateOrigin = db.prepare('UPDATE sessions SET origin_json = ? WHERE id = ?');
  for (const [sessionId, originJson] of rows.origins || []) updateOrigin.run(originJson, sessionId);
  const insertMessage = db.prepare(`INSERT INTO messages
    (id, session_id, role, content, tool_call_id, tool_calls, tool_name, timestamp, finish_reason, reasoning)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const row of rows.messages || []) insertMessage.run(...row);
  const insertUsage = db.prepare(`INSERT INTO session_model_usage
    (session_id, model, api_call_count, input_tokens, output_tokens, cache_read_tokens,
     cache_write_tokens, reasoning_tokens, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const row of rows.usage || []) insertUsage.run(...row);
  db.close();
  return dbPath;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('Hermes IDs cannot collide when profile and session names contain delimiters', () => {
  assert.notEqual(normalizedSessionId('a-b', 'c'), normalizedSessionId('a', 'b-c'));
  assert.notEqual(normalizedSessionId('Light', 'one'), normalizedSessionId('light', 'one'));
});

test('Hermes adapter discovers profiles and exposes bounded sanitized metadata read-only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-adapter-'));
  const now = 2_000_000_000_000;
  const terminalCall = JSON.stringify([{
    id: 'call-1', type: 'function',
    function: { name: 'terminal', arguments: JSON.stringify({ command: 'deploy --token SUPER_SECRET_VALUE' }) },
  }]);
  const untrustedToolCall = JSON.stringify([{
    id: 'call-2', type: 'function',
    function: { name: 'SUPER_SECRET_TOOL_NAME', arguments: '{}' },
  }]);
  const jarvisDb = createStateDb(root, 'jarvis', {
    sessions: [
      ['parent/session', 'gpt-5.6-sol', null, now - 600_000, null, 4, 2, 1, 2, 3, 4, 5, 1,
        'SUPER_SECRET_SESSION_TITLE', '/workspace/hermes-office', 'develop', '/workspace/hermes-office', 'light', now - 500_000, 0, 0],
      ['child', 'gpt-5.6-sol', 'parent/session', now - 50_000, null, 2, 0, 10, 6, 2, 0, 1, 1,
        'Review adapter', '/workspace/hermes-office', 'develop', '/workspace/hermes-office', 'wrong-profile', now - 500, 0, 0],
      ['old', 'gpt-old', null, now - 999_000, now - 900_000, 1, 0, 1, 1, 0, 0, 0, 1,
        'Old session', '/workspace/old', 'main', '/workspace/old', 'jarvis', now - 900_000, 0, 0],
    ],
    messages: [
      [1, 'parent/session', 'assistant', 'raw assistant prompt content', null, terminalCall, null, now - 800, null, 'private chain of thought'],
      [2, 'parent/session', 'assistant', null, null, untrustedToolCall, null, now - 700, null, null],
      [3, 'parent/session', 'tool', 'SUPER_SECRET_TOOL_RESULT', 'call-1', null, 'terminal', now - 600, null, null],
    ],
    usage: [
      ['parent/session', 'gpt-5.6-sol', 3, 70, 15, 20, 3, 4, now - 5_000, now - 1_000],
      ['parent/session', 'helper-model', 7, 30, 5, 10, 1, 1, now - 4_000, now - 900],
    ],
  });
  createStateDb(root, 'light', {
    sessions: [[
      'light-one', 'gpt-5.6-sol', null, now - 20_000, null, 2, 0, 8, 3, 1, 0, 0, 1,
      'Implement fixture', '/workspace/hermes-office', 'develop', '/workspace/hermes-office', 'jarvis', now - 300, 0, 0,
    ]],
  });
  const before = sha256(jarvisDb);
  const adapter = new HermesAdapter({ rootDir: root, now: () => now });

  try {
    assert.equal(adapter.provider, 'hermes');
    assert.equal(adapter.name, 'Hermes Agent');
    assert.equal(adapter.isAvailable(), true);
    assert.throws(() => attemptWriteForTest(jarvisDb), /read-only|readonly|query[_ ]only/i);

    const sessions = adapter.getActiveSessions(120_000);
    assert.equal(sessions.length, 3);
    const parentId = normalizedSessionId('jarvis', 'parent/session');
    const parent = sessions.find(session => session.sessionId === parentId);
    const child = sessions.find(session => session.sessionId === normalizedSessionId('jarvis', 'child'));
    const light = sessions.find(session => session.sessionId === normalizedSessionId('light', 'light-one'));
    assert.ok(parent);
    assert.equal(parent.agentName, 'Jarvis');
    assert.equal(parent.agentId, 'jarvis');
    assert.equal(parent.profile, 'jarvis');
    assert.equal(parent.provider, 'hermes');
    assert.equal(parent.project, '/workspace/hermes-office');
    assert.equal(parent.lastActivity, now - 600);
    assert.equal(parent.lastTool, 'terminal');
    assert.equal(parent.lastToolInput, 'Tool call details hidden');
    assert.equal(Object.hasOwn(parent, 'hermesTitle'), false);
    assert.deepEqual(parent.tokenUsage, {
      input: 100, output: 20, cacheRead: 30, cacheCreate: 4, cacheWrite: 4,
      totalInput: 100, totalOutput: 20, reasoningTokens: 5, reasoningInOutput: false,
      turnCount: 10,
    });
    assert.equal(child.parentSessionId, parent.sessionId);
    assert.equal(child.agentName, 'Jarvis');
    assert.equal(light.agentName, 'Light');
    assert.equal(light.profile, 'light');
    assert.equal(sessions.some(session => session.sessionId === normalizedSessionId('jarvis', 'old')), false);

    const detail = adapter.getSessionDetail(parent.sessionId, parent.project);
    assert.equal(detail.provider, 'hermes');
    assert.equal(detail.agentName, 'Jarvis');
    assert.deepEqual(detail.messages, []);
    assert.deepEqual(detail.toolHistory, [
      { tool: 'terminal', detail: 'Tool call details hidden', ts: now - 800 },
      { tool: 'custom_tool', detail: 'Tool call details hidden', ts: now - 700 },
    ]);
    const serialized = JSON.stringify({ sessions, detail });
    for (const forbidden of [
      'SUPER_SECRET_VALUE', 'SUPER_SECRET_TOOL_RESULT', 'SUPER_SECRET_SESSION_TITLE',
      'SUPER_SECRET_TOOL_NAME', 'raw assistant prompt content', 'private chain of thought',
      'deploy --token', 'wrong-profile',
    ]) {
      assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
    }

    const limited = new HermesAdapter({ rootDir: root, now: () => now, profiles: ['jarvis'] });
    const limitedSessions = limited.getActiveSessions(120_000);
    assert.equal(limitedSessions.length, 2);
    assert.equal(limitedSessions.some(session => session.agentName === 'Light'), false);

    const watchPaths = adapter.getWatchPaths();
    assert.ok(watchPaths.some(item => item.path === jarvisDb && item.type === 'file'));
    assert.equal(sha256(jarvisDb), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Hermes adapter infers explicit gateway projects without exposing origin metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-adapter-'));
  const now = 2_000_000_000_000;
  createStateDb(root, 'jarvis', {
    sessions: [
      ['radarr-parent', 'gpt-5.6-sol', null, now - 2_000, null, 1, 0, 0, 0, 0, 0, 0, 1,
        'private session title', null, 'develop', null, 'jarvis', now - 100, 0, 0],
      ['radarr-child', 'gpt-5.6-sol', 'radarr-parent', now - 1_500, null, 1, 0, 0, 0, 0, 0, 0, 1,
        'private child title', null, null, null, 'jarvis', now - 50, 0, 0],
      ['authoritative', 'gpt-5.6-sol', null, now - 1_000, null, 1, 0, 0, 0, 0, 0, 0, 1,
        'private authoritative title', '/workspace/hermes-office', 'develop', '/workspace/hermes-office', 'jarvis', now - 25, 0, 0],
      ['unrelated', 'gpt-5.6-sol', null, now - 900, null, 1, 0, 0, 0, 0, 0, 0, 1,
        'private unrelated title', null, null, null, 'jarvis', now - 20, 0, 0],
      ['compound-project', 'gpt-5.6-sol', null, now - 800, null, 1, 0, 0, 0, 0, 0, 0, 1,
        'private compound title', null, null, null, 'jarvis', now - 15, 0, 0],
    ],
    origins: [
      ['radarr-parent', JSON.stringify({ auto_thread_initial_name: 'Work on our Radarr branch', user_name: 'PRIVATE_USER', message_id: 'PRIVATE_ID' })],
      ['authoritative', JSON.stringify({ chat_name: 'Work on the secret-shadow branch' })],
      ['unrelated', JSON.stringify({ chat_name: 'private project discussion', chat_topic: 'Begin development of payroll', auto_thread_initial_name: 'project planning meeting' })],
      ['compound-project', JSON.stringify({ auto_thread_initial_name: 'Begin development of hermes-office' })],
    ],
  });

  try {
    const adapter = new HermesAdapter({ rootDir: root, now: () => now, profiles: ['jarvis'] });
    const sessions = adapter.getActiveSessions(60_000);
    const byId = rawId => sessions.find(session => session.sessionId === normalizedSessionId('jarvis', rawId));
    assert.equal(byId('radarr-parent').project, '/hermes-projects/radarr');
    assert.equal(byId('radarr-child').project, '/hermes-projects/radarr');
    assert.equal(byId('authoritative').project, '/workspace/hermes-office');
    assert.equal(byId('unrelated').project, null);
    assert.equal(byId('compound-project').project, '/hermes-projects/hermes-office');
    assert.equal(adapter.getSessionDetail(byId('radarr-parent').sessionId).project, '/hermes-projects/radarr');
    assert.equal(adapter.getSessionDetail(byId('radarr-child').sessionId).project, '/hermes-projects/radarr');

    const serialized = JSON.stringify(sessions);
    for (const forbidden of ['PRIVATE_USER', 'PRIVATE_ID', 'PRIVATE_SECRET_DISCUSSION', 'secret-shadow', 'private session title']) {
      assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Hermes adapter inherits an inferred project through a recent parent from an older grandparent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-adapter-'));
  const now = 2_000_000_000_000;
  const row = (id, parent, lastActivity) => [
    id, 'gpt-5.6-sol', parent, lastActivity - 1_000, null, 1, 0, 0, 0, 0, 0, 0, 1,
    'private title', null, null, null, 'jarvis', lastActivity, 0, 0,
  ];
  const fillers = Array.from({ length: 512 }, (_, index) => row(`filler-${index}`, null, now - 600_000 - index));
  createStateDb(root, 'jarvis', {
    sessions: [
      row('old-grandparent', null, now - 900_000), ...fillers,
      row('recent-parent', 'old-grandparent', now - 600_000), row('active-child', 'recent-parent', now - 10),
    ],
    origins: [['old-grandparent', JSON.stringify({ auto_thread_initial_name: 'Work on our Radarr project' })]],
  });

  try {
    const adapter = new HermesAdapter({ rootDir: root, now: () => now, profiles: ['jarvis'] });
    const child = adapter.getActiveSessions(60_000)
      .find(session => session.sessionId === normalizedSessionId('jarvis', 'active-child'));
    assert.equal(child?.project, '/hermes-projects/radarr');
    assert.equal(adapter.getSessionDetail(child.sessionId).project, '/hermes-projects/radarr');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Hermes adapter is unavailable for a missing root and tolerates malformed optional JSON', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-adapter-'));
  fs.rmSync(root, { recursive: true, force: true });
  const missing = new HermesAdapter({ rootDir: root });
  assert.equal(missing.isAvailable(), false);
  assert.deepEqual(missing.getActiveSessions(60_000), []);

  const validRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-adapter-'));
  const now = 2_000_000_000_000;
  createStateDb(validRoot, 'l', {
    sessions: [[
      'broken-json', 'gpt-5.6-sol', null, now - 1_000, null, 1, 1, 1, 1, 0, 0, 0, 1,
      'Malformed data', '/workspace', 'develop', '/workspace', 'l', now - 100, 0, 0,
    ]],
    messages: [[1, 'broken-json', 'assistant', 'hidden', null, '{not json', null, now - 50, null, 'hidden reasoning']],
  });
  try {
    const adapter = new HermesAdapter({ rootDir: validRoot, now: () => now });
    const sessions = adapter.getActiveSessions(60_000);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].lastTool, null);
    assert.deepEqual(adapter.getSessionDetail(sessions[0].sessionId, '/workspace').toolHistory, []);
  } finally {
    fs.rmSync(validRoot, { recursive: true, force: true });
  }
});

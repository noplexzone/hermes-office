/**
 * Hermes Agent adapter for Hermes Office.
 *
 * Reads only bounded metadata windows from profile state.db files through
 * node:sqlite in read-only/query-only mode. Raw prompts, titles, message
 * bodies, reasoning, tool arguments, and tool results never cross this
 * adapter boundary.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const RECENT_SESSION_LIMIT = 512;
const RECENT_MESSAGE_LIMIT = 512;
const DETAIL_TOOL_LIMIT = 15;
const QUERY_CHUNK_SIZE = 200;
const HIDDEN_TOOL_DETAIL = 'Tool call details hidden';
const CUSTOM_TOOL_NAME = 'custom_tool';
const ORIGIN_JSON_LIMIT = 2048;
const ORIGIN_TEXT_LIMIT = 512;
const PROJECT_SLUG_MAX = 64;
const PROJECT_STOPWORDS = new Set([
  'active', 'branch', 'current', 'develop', 'development', 'feature', 'general',
  'new', 'project', 'repo', 'repository', 'session', 'the', 'unknown', 'work',
]);
const SAFE_TOOL_NAMES = new Set([
  'browser_exec', 'clarify', 'cronjob', 'delegate_task', 'execute_code',
  'memory', 'patch', 'process', 'read_file', 'search_files', 'skill_manage',
  'skill_view', 'skills_list', 'terminal', 'todo', 'vision_analyze',
  'web_extract', 'web_search', 'write_file',
]);

function inferHermesRoot() {
  if (process.env.HERMES_OFFICE_HERMES_ROOT) {
    return path.resolve(process.env.HERMES_OFFICE_HERMES_ROOT);
  }
  if (process.env.HERMES_HOME) {
    const configured = path.resolve(process.env.HERMES_HOME);
    const parent = path.dirname(configured);
    if (path.basename(parent) === 'profiles') return path.dirname(parent);
    return configured;
  }
  return path.join(os.homedir(), '.hermes');
}

function configuredProfiles() {
  const values = String(process.env.HERMES_OFFICE_PROFILES || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return values.length ? values : null;
}

function loadNodeSqlite() {
  try {
    return require('node:sqlite');
  } catch {
    return null;
  }
}

function toMillis(value) {
  const number = Number(value) || 0;
  if (!number) return 0;
  return number < 1_000_000_000_000 ? Math.round(number * 1000) : Math.round(number);
}

function profileLabel(profile) {
  const normalized = String(profile || 'default').trim();
  const known = { jarvis: 'Jarvis', light: 'Light', l: 'L', default: 'Hermes' };
  if (known[normalized.toLowerCase()]) return known[normalized.toLowerCase()];
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Hermes';
}

function encodeIdComponent(value) {
  return Buffer.from(String(value ?? ''), 'utf8').toString('base64url');
}

function decodeIdComponent(value) {
  try {
    return Buffer.from(String(value || ''), 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function normalizedSessionId(profile, rawSessionId) {
  return `hermes.${encodeIdComponent(profile || 'default')}.${encodeIdComponent(rawSessionId || '')}`;
}

function parseNormalizedSessionId(sessionId) {
  const match = /^hermes\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(sessionId || ''));
  if (!match) return null;
  const profile = decodeIdComponent(match[1]);
  const rawSessionId = decodeIdComponent(match[2]);
  return profile && rawSessionId ? { profile, rawSessionId } : null;
}

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sanitizeToolName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 80 || !/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(name)) return CUSTOM_TOOL_NAME;
  return SAFE_TOOL_NAMES.has(name) ? name : CUSTOM_TOOL_NAME;
}

function safeProjectSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (slug.length < 2 || slug.length > PROJECT_SLUG_MAX) return null;
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(slug) || PROJECT_STOPWORDS.has(slug)) return null;
  return slug;
}

function inferProjectFromOrigin(rawOrigin) {
  const origin = parseJson(String(rawOrigin || '').slice(0, ORIGIN_JSON_LIMIT), null);
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) return null;
  const candidates = ['auto_thread_initial_name', 'chat_topic', 'chat_name']
    .map(key => origin[key])
    .filter(value => typeof value === 'string')
    .map(value => value.slice(0, ORIGIN_TEXT_LIMIT));
  const patterns = [
    /\b(?:work(?:ing)?|develop(?:ing)?|build(?:ing)?|implement(?:ing)?)\s+(?:on|in|for)\s+(?:(?:our|the|a|an)\s+)?([a-z0-9][a-z0-9._-]{1,63})\s+(?:branch|project|repo(?:sitory)?)\b/i,
    /\b(?:begin(?:ning)?\s+)?(?:development|implementation)\s+of\s+(?:(?:our|the)\s+)?([a-z0-9]+(?:[._-][a-z0-9]+)+)\b/i,
    /\b(?:project|branch|repo(?:sitory)?)\s*[:=]\s*([a-z0-9][a-z0-9._-]{1,63})\b/i,
    /\b(?:project|branch|repo(?:sitory)?)\s+(?:is|named|called)\s+([a-z0-9][a-z0-9._-]{1,63})\b/i,
  ];
  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const slug = safeProjectSlug(candidate.match(pattern)?.[1]);
      if (slug) return `/hermes-projects/${slug}`;
    }
  }
  return null;
}

function directProjectForRow(row) {
  return row?.git_repo_root || row?.cwd || inferProjectFromOrigin(row?.origin_json) || null;
}

function projectResolver(rows) {
  const rowBySession = new Map(rows.map(row => [String(row.id || ''), row]));
  const projectBySession = new Map(rows.map(row => [String(row.id || ''), directProjectForRow(row)]));
  const resolve = (rawSessionId, seen = new Set()) => {
    if (!rawSessionId || seen.has(rawSessionId)) return null;
    if (projectBySession.get(rawSessionId)) return projectBySession.get(rawSessionId);
    const row = rowBySession.get(rawSessionId);
    if (!row?.parent_session_id) return null;
    seen.add(rawSessionId);
    const inherited = resolve(String(row.parent_session_id), seen);
    if (inherited) projectBySession.set(rawSessionId, inherited);
    return inherited;
  };
  return resolve;
}

function toolNamesFromEnvelope(rawToolCalls, fallbackToolName = null) {
  const parsed = parseJson(rawToolCalls, null);
  const values = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
  const names = [];
  for (const value of values) {
    const rawName = value?.function?.name || value?.name || value?.tool || null;
    if (!rawName) continue;
    const name = sanitizeToolName(rawName);
    if (!names.includes(name)) names.push(name);
  }
  if (!names.length && fallbackToolName) names.push(sanitizeToolName(fallbackToolName));
  return names;
}

function tableColumns(db, table) {
  try {
    return new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name));
  } catch {
    return new Set();
  }
}

function selectedColumn(columns, name, fallbackSql = 'NULL') {
  return columns.has(name) ? `s."${name}" AS "${name}"` : `${fallbackSql} AS "${name}"`;
}

function sessionSelection(columns) {
  return [
    selectedColumn(columns, 'id', "''"),
    selectedColumn(columns, 'model', "'hermes'"),
    selectedColumn(columns, 'parent_session_id'),
    selectedColumn(columns, 'started_at', '0'),
    selectedColumn(columns, 'ended_at'),
    selectedColumn(columns, 'message_count', '0'),
    selectedColumn(columns, 'tool_call_count', '0'),
    selectedColumn(columns, 'api_call_count', '0'),
    selectedColumn(columns, 'input_tokens', '0'),
    selectedColumn(columns, 'output_tokens', '0'),
    selectedColumn(columns, 'cache_read_tokens', '0'),
    selectedColumn(columns, 'cache_write_tokens', '0'),
    selectedColumn(columns, 'reasoning_tokens', '0'),
    selectedColumn(columns, 'cwd'),
    selectedColumn(columns, 'git_branch'),
    selectedColumn(columns, 'git_repo_root'),
    selectedColumn(columns, 'archived', '0'),
    selectedColumn(columns, 'hidden', '0'),
    selectedColumn(columns, 'last_activity_at', '0'),
    columns.has('origin_json')
      ? `substr(s."origin_json", 1, ${ORIGIN_JSON_LIMIT}) AS "origin_json"`
      : 'NULL AS "origin_json"',
  ].join(', ');
}

function openReadOnlyDatabase(sqlite, dbPath) {
  let db = null;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true, timeout: 1000 });
    db.exec('PRAGMA query_only = ON');
    return db;
  } catch {
    try { db?.close(); } catch { /* ignore */ }
    return null;
  }
}

function attemptWriteForTest(dbPath) {
  const sqlite = loadNodeSqlite();
  const db = sqlite?.DatabaseSync ? openReadOnlyDatabase(sqlite, dbPath) : null;
  if (!db) throw new Error('read-only database unavailable');
  try {
    db.exec('CREATE TABLE hermes_office_write_probe (id INTEGER)');
    throw new Error('read-only/query_only protection failed');
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

function discoverDatabases(rootDir, profileAllowlist = null) {
  const allowed = profileAllowlist ? new Set(profileAllowlist.map(String)) : null;
  const candidates = [];
  const defaultDb = path.join(rootDir, 'state.db');
  if ((!allowed || allowed.has('default')) && fs.existsSync(defaultDb)) {
    candidates.push({ profile: 'default', dbPath: defaultDb });
  }

  const profilesDir = path.join(rootDir, 'profiles');
  let profiles = [];
  try {
    profiles = fs.readdirSync(profilesDir, { withFileTypes: true });
  } catch {
    profiles = [];
  }
  for (const entry of profiles.sort((a, b) => a.name.localeCompare(b.name))) {
    if (allowed && !allowed.has(entry.name)) continue;
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const dbPath = path.join(profilesDir, entry.name, 'state.db');
    if (fs.existsSync(dbPath)) candidates.push({ profile: entry.name, dbPath });
  }

  const seen = new Set();
  return candidates.filter(candidate => {
    let identity = candidate.dbPath;
    try { identity = fs.realpathSync(candidate.dbPath); } catch { /* keep path */ }
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function chunked(values, size = QUERY_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function recentMessageRows(db, columns) {
  if (!columns.has('session_id')) return [];
  const timestamp = columns.has('timestamp') ? 'timestamp' : '0 AS timestamp';
  try {
    return db.prepare(`
      SELECT session_id, ${timestamp}
      FROM messages
      ORDER BY rowid DESC
      LIMIT ${RECENT_MESSAGE_LIMIT}
    `).all();
  } catch {
    return [];
  }
}

function latestToolsBySession(db, columns, sessionIds) {
  const result = new Map();
  if (!columns.has('session_id') || !sessionIds.length) return result;
  const toolCalls = columns.has('tool_calls') ? 'tool_calls' : 'NULL AS tool_calls';
  const toolName = columns.has('tool_name') ? 'tool_name' : 'NULL AS tool_name';
  const timestamp = columns.has('timestamp') ? 'timestamp' : '0 AS timestamp';
  const predicate = [
    columns.has('tool_calls') ? "(tool_calls IS NOT NULL AND tool_calls != '')" : null,
    columns.has('tool_name') ? "(tool_name IS NOT NULL AND tool_name != '')" : null,
  ].filter(Boolean).join(' OR ');
  if (!predicate) return result;
  for (const ids of chunked([...new Set(sessionIds)])) {
    const placeholders = ids.map(() => '?').join(',');
    const limit = Math.max(64, Math.min(512, ids.length * 16));
    try {
      const rows = db.prepare(`
        SELECT session_id, ${toolCalls}, ${toolName}, ${timestamp}
        FROM messages
        WHERE session_id IN (${placeholders}) AND (${predicate})
        ORDER BY rowid DESC
        LIMIT ${limit}
      `).all(...ids);
      for (const row of rows) {
        const sessionId = String(row.session_id || '');
        if (!sessionId || result.has(sessionId)) continue;
        const names = toolNamesFromEnvelope(row.tool_calls, row.tool_name);
        if (names.length) result.set(sessionId, { tool: names.at(-1), timestamp: toMillis(row.timestamp) });
      }
    } catch {
      // A missing optional tool column should not hide the session itself.
    }
  }
  return result;
}

function recentSessionRows(db, sessionColumns, candidateIds = []) {
  if (!sessionColumns.has('id')) return [];
  const selected = sessionSelection(sessionColumns);
  const rows = [];
  try {
    rows.push(...db.prepare(`
      SELECT ${selected}
      FROM sessions s
      ORDER BY rowid DESC
      LIMIT ${RECENT_SESSION_LIMIT}
    `).all());
  } catch {
    return [];
  }
  const have = new Set(rows.map(row => String(row.id || '')));
  const missing = [...new Set(candidateIds.map(String))].filter(id => id && !have.has(id));
  for (const ids of chunked(missing)) {
    const placeholders = ids.map(() => '?').join(',');
    try {
      rows.push(...db.prepare(`SELECT ${selected} FROM sessions s WHERE s.id IN (${placeholders})`).all(...ids));
    } catch {
      // Keep the bounded recent session window when schema drift breaks enrichment.
    }
  }
  return rows;
}

function parentRowsForActiveSessions(db, sessionColumns, knownRows, activeRows) {
  if (!sessionColumns.has('id') || !sessionColumns.has('parent_session_id')) return [];
  const selected = sessionSelection(sessionColumns);
  const known = new Map(knownRows.map(row => [String(row.id || ''), row]));
  const fetched = [];
  let pending = activeRows.map(row => String(row.parent_session_id || '')).filter(Boolean);
  for (let depth = 0; depth < 8 && pending.length && fetched.length < RECENT_SESSION_LIMIT; depth++) {
    const remaining = RECENT_SESSION_LIMIT - fetched.length;
    const next = [];
    const unique = [...new Set(pending)];
    for (const id of unique) {
      const row = known.get(id);
      if (row?.parent_session_id) next.push(String(row.parent_session_id));
    }
    const ids = unique.filter(id => !known.has(id)).slice(0, remaining);
    if (!ids.length) {
      pending = next;
      continue;
    }
    for (const batch of chunked(ids)) {
      const placeholders = batch.map(() => '?').join(',');
      try {
        const rows = db.prepare(`SELECT ${selected} FROM sessions s WHERE s.id IN (${placeholders})`).all(...batch);
        for (const row of rows) {
          const id = String(row.id || '');
          if (!id || known.has(id)) continue;
          known.set(id, row);
          fetched.push(row);
          if (row.parent_session_id) next.push(String(row.parent_session_id));
        }
      } catch {
        return fetched;
      }
    }
    pending = next;
  }
  return fetched;
}

function usageBySession(db, usageColumns, sessionIds) {
  const result = new Map();
  if (!usageColumns.has('session_id') || !sessionIds.length) return result;
  const sum = name => usageColumns.has(name) ? `COALESCE(SUM("${name}"), 0)` : '0';
  for (const ids of chunked([...new Set(sessionIds)])) {
    const placeholders = ids.map(() => '?').join(',');
    try {
      const rows = db.prepare(`
        SELECT session_id,
               ${sum('input_tokens')} AS input_tokens,
               ${sum('output_tokens')} AS output_tokens,
               ${sum('cache_read_tokens')} AS cache_read_tokens,
               ${sum('cache_write_tokens')} AS cache_write_tokens,
               ${sum('reasoning_tokens')} AS reasoning_tokens,
               ${sum('api_call_count')} AS api_call_count
        FROM session_model_usage
        WHERE session_id IN (${placeholders})
        GROUP BY session_id
      `).all(...ids);
      for (const row of rows) result.set(String(row.session_id), row);
    } catch {
      // Session counters remain a safe fallback.
    }
  }
  return result;
}

function normalizedUsage(row, aggregate = null) {
  const value = name => Number((aggregate || row)?.[name]) || 0;
  const input = value('input_tokens');
  const output = value('output_tokens');
  const cacheRead = value('cache_read_tokens');
  const cacheWrite = value('cache_write_tokens');
  return {
    input,
    output,
    cacheRead,
    cacheCreate: cacheWrite,
    cacheWrite,
    totalInput: input,
    totalOutput: output,
    reasoningTokens: value('reasoning_tokens'),
    reasoningInOutput: false,
    turnCount: value('api_call_count'),
  };
}

function messageMetadata(rows) {
  const latestActivity = new Map();
  for (const row of rows) {
    const sessionId = String(row.session_id || '');
    if (!sessionId) continue;
    const timestamp = toMillis(row.timestamp);
    if (timestamp > (latestActivity.get(sessionId) || 0)) latestActivity.set(sessionId, timestamp);
  }
  return { latestActivity };
}

function latestActivityFor(row, messageTimestamp = 0) {
  return Math.max(
    toMillis(row.last_activity_at),
    Number(messageTimestamp) || 0,
    toMillis(row.ended_at),
    toMillis(row.started_at),
  );
}

function toolHistoryForSession(db, rawSessionId, messageColumns, limit = DETAIL_TOOL_LIMIT) {
  if (!messageColumns.has('session_id') || !messageColumns.has('tool_calls')) return [];
  const toolNameSelect = messageColumns.has('tool_name') ? 'tool_name' : 'NULL AS tool_name';
  const timestampSelect = messageColumns.has('timestamp') ? 'timestamp' : '0 AS timestamp';
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT tool_calls, ${toolNameSelect}, ${timestampSelect}
      FROM messages
      WHERE session_id = ? AND tool_calls IS NOT NULL AND tool_calls != ''
      ORDER BY rowid DESC
      LIMIT ?
    `).all(rawSessionId, Math.max(1, Number(limit) || DETAIL_TOOL_LIMIT));
  } catch {
    return [];
  }
  const history = [];
  for (const row of rows) {
    const names = toolNamesFromEnvelope(row.tool_calls, row.tool_name);
    for (const name of names) {
      history.push({ tool: name, detail: HIDDEN_TOOL_DETAIL, ts: toMillis(row.timestamp) });
      if (history.length >= limit) return history.reverse();
    }
  }
  return history.reverse();
}

class HermesAdapter {
  constructor({ rootDir = inferHermesRoot(), now = () => Date.now(), profiles = configuredProfiles() } = {}) {
    this.rootDir = path.resolve(rootDir);
    this._now = now;
    this.profiles = profiles ? [...new Set(profiles.map(String))] : null;
    this._sqlite = loadNodeSqlite();
  }

  get name() { return 'Hermes Agent'; }
  get provider() { return 'hermes'; }
  get homeDir() { return this.rootDir; }

  isAvailable() {
    return !!this._sqlite?.DatabaseSync && discoverDatabases(this.rootDir, this.profiles).length > 0;
  }

  getActiveSessions(activeThresholdMs) {
    if (!this._sqlite?.DatabaseSync) return [];
    const cutoff = this._now() - Math.max(0, Number(activeThresholdMs) || 0);
    const sessions = [];
    for (const source of discoverDatabases(this.rootDir, this.profiles)) {
      const db = openReadOnlyDatabase(this._sqlite, source.dbPath);
      if (!db) continue;
      try {
        const sessionColumns = tableColumns(db, 'sessions');
        const messageColumns = tableColumns(db, 'messages');
        const usageColumns = tableColumns(db, 'session_model_usage');
        const messages = recentMessageRows(db, messageColumns);
        const metadata = messageMetadata(messages);
        const rows = recentSessionRows(db, sessionColumns, [...metadata.latestActivity.keys()]);
        const activeRows = rows.filter(row => {
          if (Number(row.archived) || Number(row.hidden)) return false;
          return latestActivityFor(row, metadata.latestActivity.get(String(row.id))) >= cutoff;
        });
        const activeIds = activeRows.map(row => String(row.id));
        const latestTools = latestToolsBySession(db, messageColumns, activeIds);
        const usage = usageBySession(db, usageColumns, activeIds);
        const projectRows = [...rows, ...parentRowsForActiveSessions(db, sessionColumns, rows, activeRows)];
        const resolveProject = projectResolver(projectRows);
        for (const row of activeRows) {
          const profile = String(source.profile || 'default');
          const rawSessionId = String(row.id || '');
          if (!rawSessionId) continue;
          const lastActivity = latestActivityFor(row, metadata.latestActivity.get(rawSessionId));
          const tool = latestTools.get(rawSessionId)?.tool || null;
          sessions.push({
            sessionId: normalizedSessionId(profile, rawSessionId),
            provider: 'hermes',
            agentId: profile,
            profile,
            agentType: row.parent_session_id ? 'sub-agent' : 'main',
            agentName: profileLabel(profile),
            project: resolveProject(rawSessionId) || null,
            model: row.model || 'hermes',
            status: 'active',
            lastActivity,
            lastTool: tool,
            lastToolInput: tool ? HIDDEN_TOOL_DETAIL : null,
            lastMessage: null,
            tokenUsage: normalizedUsage(row, usage.get(rawSessionId)),
            parentSessionId: row.parent_session_id ? normalizedSessionId(profile, row.parent_session_id) : null,
            turnState: 'unknown',
            pendingTool: null,
            pendingSince: null,
            awaitingSince: null,
            waitReason: null,
            sendMessages: [],
            gitEvents: [],
            gitBranch: row.git_branch || null,
          });
        }
      } finally {
        try { db.close(); } catch { /* ignore */ }
      }
    }
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  getSessionDetail(sessionId, project = '') {
    if (!this._sqlite?.DatabaseSync) return this._emptyDetail(sessionId, project);
    const parsed = parseNormalizedSessionId(sessionId);
    if (!parsed) return this._emptyDetail(sessionId, project);
    const source = discoverDatabases(this.rootDir, this.profiles).find(candidate => candidate.profile === parsed.profile);
    if (!source) return this._emptyDetail(sessionId, project);
    const db = openReadOnlyDatabase(this._sqlite, source.dbPath);
    if (!db) return this._emptyDetail(sessionId, project);
    try {
      const sessionColumns = tableColumns(db, 'sessions');
      if (!sessionColumns.has('id')) return this._emptyDetail(sessionId, project);
      let row = null;
      try {
        row = db.prepare(`SELECT ${sessionSelection(sessionColumns)} FROM sessions s WHERE s.id = ? LIMIT 1`).get(parsed.rawSessionId);
      } catch {
        row = null;
      }
      if (!row) return this._emptyDetail(sessionId, project);
      const usageColumns = tableColumns(db, 'session_model_usage');
      const aggregate = usageBySession(db, usageColumns, [parsed.rawSessionId]).get(parsed.rawSessionId);
      const projectRows = [row, ...parentRowsForActiveSessions(db, sessionColumns, [row], [row])];
      return {
        provider: 'hermes',
        sessionId,
        project: projectResolver(projectRows)(parsed.rawSessionId) || project || '',
        toolHistory: toolHistoryForSession(db, parsed.rawSessionId, tableColumns(db, 'messages')),
        messages: [],
        tokenUsage: normalizedUsage(row, aggregate),
        agentName: profileLabel(parsed.profile),
        profile: parsed.profile,
      };
    } finally {
      try { db.close(); } catch { /* ignore */ }
    }
  }

  _emptyDetail(sessionId, project) {
    return {
      provider: 'hermes', sessionId: String(sessionId || ''), project: project || '',
      toolHistory: [], messages: [], tokenUsage: null, agentName: null, profile: null,
    };
  }

  getWatchPaths() {
    const paths = [];
    for (const source of discoverDatabases(this.rootDir, this.profiles)) {
      paths.push({ type: 'file', path: source.dbPath });
      const walPath = `${source.dbPath}-wal`;
      if (fs.existsSync(walPath)) paths.push({ type: 'file', path: walPath });
    }
    return paths;
  }
}

module.exports = {
  HermesAdapter,
  HIDDEN_TOOL_DETAIL,
  attemptWriteForTest,
  discoverDatabases,
  normalizedSessionId,
};

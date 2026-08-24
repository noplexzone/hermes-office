# Hermes Office Foundation Implementation Plan

> **For Hermes:** Use the claude-code skill to implement this plan task-by-task. Jarvis owns integration, verification, push, and artifact publication.

**Goal:** Turn the ClaudeVille fork into Hermes Office and deliver the first working vertical slice: Hermes sessions discovered read-only from profile SQLite databases, normalized through the existing adapter contract, visible through the real API and UI.

**Architecture:** Preserve ClaudeVille's zero-build Node server, adapter registry, WebSocket loop, dashboard, and pixel world. Add a synchronous `HermesAdapter` that scans profile-scoped `state.db` files below a configurable Hermes root, opens each database read-only through `node:sqlite`, and maps recent sessions plus sanitized tool activity into ClaudeVille's normalized session/detail contracts. Hermes data is observational only; no database write, migration, checkpoint, or direct control action is allowed in this slice.

**Tech Stack:** Node.js >=22.13.0 for `node:sqlite` Hermes support, CommonJS server/adapters, vanilla browser ES modules, `node:test`, SQLite fixtures, existing ClaudeVille validation scripts.

## Global Constraints

- Repository: `/mnt/user/appdata/dev/hermes-office`; branch: `develop`; origin: `https://github.com/noplexzone/hermes-office.git`; upstream: `https://github.com/TokenBrice/claude-ville.git`.
- Product name is `Hermes Office`; package/repository identity is `hermes-office`.
- Retain the MIT license and upstream attribution.
- Hermes is the primary provider; existing provider adapters remain available.
- Hermes SQLite files are opened read-only. Never mutate Hermes databases directly.
- Default Hermes root is `HERMES_OFFICE_HERMES_ROOT`, then `HERMES_HOME`'s install root when inferable, then `~/.hermes`.
- Discover the default install database and profile databases under `<root>/profiles/<profile>/state.db`; deduplicate real paths.
- Session IDs must be provider-global and deterministic: `hermes.<base64url profile>.<base64url raw session id>` with independently encoded, unambiguous components.
- Named profiles such as Jarvis, Light, and L are exposed as persistent agent names through `agentName` and provider `hermes`.
- Do not expose raw system prompts, reasoning, complete prompt text, tool result bodies, credentials, or arbitrary database contents. Detail output may include tool name, sanitized category/detail, timestamps, and aggregate token data only.
- Do not add write controls, task mutation, agent steering, container control, or release controls in this slice.
- Preserve the current desktop-only >=1280px product scope for the first slice.
- Do not consume or publish a new stable upstream-style version tag. Downstream identity is recorded separately while upstream version history remains intact.
- Add changes under `CHANGELOG.md` `Unreleased` (creating the section if absent).
- Follow TDD: prove fixture tests fail before implementation, then pass.

---

### Task 1: Establish Downstream Product Identity

**Assignee:** Light (Claude Code as implementation engine)

**Workspace:** `/mnt/user/appdata/dev/hermes-office` on `develop`

**Objective:** Make repository metadata and durable product/design context describe Hermes Office without erasing upstream attribution or the inherited visual system.

**Files:** `package.json`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`.

**Interfaces:** Produces downstream package name `hermes-office`; repository links under `noplexzone/hermes-office`; explicit attribution to `TokenBrice/claude-ville`; product brief naming Hermes as the primary coordinator and ClaudeVille's village/dashboard as the inherited visualization foundation.

**Steps:**
1. Update package identity and links while preserving the inherited upstream version value.
2. Update the README opening, product purpose, data-source overview, quick start, and architecture sections for Hermes Office while keeping accurate inherited validation/layout documentation.
3. Update PRODUCT.md for Caleb overseeing Jarvis, Light, L, and temporary workers; v0.1 remains read-only.
4. Update DESIGN.md product name/description only where needed; preserve the inherited medieval pixel-world visual authority.
5. Correct stale checkout/remotes in AGENTS.md and mirror CLAUDE.md per repository parity rules.
6. Add an `Unreleased` changelog entry.
7. Verify package JSON and agent-doc parity.

**Proof:** `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`; `diff <(tail -n +3 CLAUDE.md) <(tail -n +3 AGENTS.md)`.

### Task 2: Add Red Hermes Adapter Fixture Tests

**Assignee:** Light

**Prerequisite:** Task 1 complete.

**Objective:** Define the Hermes adapter contract with deterministic, privacy-safe SQLite fixtures before production code.

**Files:** Create `scripts/tests/hermes-adapter.test.mjs`; create a helper under `scripts/tests/helpers/` only if needed.

**Interfaces:** Tests profile discovery, deterministic IDs, parent mapping, token aggregation, sanitized tool history, unavailable-root behavior, threshold filtering, malformed optional JSON tolerance, and read-only enforcement.

**Steps:**
1. Create temporary Hermes root/profile directories and minimal `state.db` databases using `node:sqlite`.
2. Seed representative `sessions`, `messages`, and `session_model_usage` rows matching live fields.
3. Assert only recent sessions are returned, profile names become `agentName`, parent IDs normalize consistently, and tokens aggregate without exposing cost or prompts.
4. Assert details expose tool names/timestamps but not raw arguments, tool results, reasoning, system prompts, or secret-shaped fixture strings.
5. Assert missing databases/root return unavailable or empty results without throwing.
6. Prove a write through the adapter connection fails and fixture data remains unchanged.
7. Run the test and record expected RED evidence before implementation.

**Proof:** `NODE_NO_WARNINGS=1 node --test scripts/tests/hermes-adapter.test.mjs` fails for the expected missing adapter/behavior reason before Task 3.

### Task 3: Implement and Register Hermes Adapter

**Assignee:** Light

**Prerequisite:** Task 2 RED evidence.

**Objective:** Make tests pass with the smallest privacy-safe, read-only adapter.

**Files:** Create `claudeville/adapters/hermes.js`; modify `claudeville/adapters/index.js`, `claudeville/adapters/README.md`, and fixture validation only if required.

**Interfaces:** `name`, `provider`, `homeDir`, `isAvailable()`, `getActiveSessions(activeThresholdMs)`, `getSessionDetail(sessionId, project)`, `getWatchPaths()`; provider id `hermes`; detail shape `{provider, sessionId, project, toolHistory, messages: [], tokenUsage, agentName}`.

**Steps:**
1. Resolve and deduplicate default/profile DB paths.
2. Open with `node:sqlite` read-only and query-only protection where supported.
3. Query explicitly named columns and tolerate schema omissions.
4. Map session/profile/token/tool metadata to the normalized contract.
5. Parse only the outer `tool_calls` envelope needed for tool names; never return arguments/results.
6. Return file watch descriptors for discovered DB/WAL files.
7. Register/document Hermes.
8. Run targeted GREEN and adapter checks.

**Proof:** targeted node test, `node --check`, `npm run check:adapters`, and `npm run check:adapter-fixtures`.

### Task 4: Real Runtime Integration Smoke

**Assignee:** Jarvis

**Prerequisite:** No delegated writer remains active.

**Objective:** Prove the server reads live Jarvis Hermes data without modifying it and serves normalized Hermes sessions.

**Steps:**
1. Record hash/mtime/size for live DBs used.
2. Start Hermes Office on a free local port.
3. Request `/api/providers`, `/api/sessions?force=1`, and one Hermes detail response.
4. Assert Hermes/provider/session presence, UI-compatible schema, and absence of sensitive fields/content.
5. Stop only the session-created server.
6. Recheck database metadata; no source DB may have changed because of Hermes Office.

**Proof:** HTTP 200 JSON, privacy assertions, unchanged DB metadata.

### Task 5: Quality, Visual, Review, and Publication Foundation

**Assignee:** Jarvis, with L as independent reviewer.

**Objective:** Verify and push the vertical slice without claiming a stable release.

**Steps:**
1. Inspect the dev-only audit finding; do not blindly auto-upgrade.
2. Run `npm run validate:quick`.
3. Run `npx --yes impeccable detect` on changed UI/docs scope and resolve or justify exact findings.
4. Inspect real World/Dashboard desktop rendering, Hermes cards/characters, selection/details, console, and network.
5. Obtain independent stable-diff review for spec, privacy/read-only safety, correctness, and regressions; remediate confirmed findings once.
6. Inspect final diff and run fresh checks; commit conventionally.
7. Push `develop` to `origin`.
8. Implement Docker/CI and publish `noplexzone/hermes-office:develop` only if the complete tested publication path fits this session. Otherwise report it as a remaining gate rather than fabricating a digest.

**Proof:** command output, browser evidence, reviewer verdict, remote branch verification, and a Docker manifest digest only if publication is actually implemented.
